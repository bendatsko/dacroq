package walksat

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"time"
)

// HybridSolverConfig contains configuration parameters for the hybrid solver
type HybridSolverConfig struct {
	// Maximum number of WalkSAT steps to try
	MaxSoftwareSteps int

	// Maximum amount of hardware time to use (in microseconds)
	MaxHardwareTime float64

	// Probability of random walk in WalkSAT
	WalkProbability float64

	// How often to switch between software and hardware
	SwitchFrequency int

	// Threshold of unsatisfied clauses below which to use hardware
	UnsatThreshold int

	// Minimum confidence to use hardware
	MinConfidence float64

	// Whether to collect detailed statistics
	CollectStats bool
}

// HybridSolverStats collects statistics from hybrid solver runs
type HybridSolverStats struct {
	// Number of times software was used
	SoftwareRuns int

	// Number of times hardware was used
	HardwareRuns int

	// Total time spent in software (microseconds)
	SoftwareTime float64

	// Total time spent in hardware (microseconds)
	HardwareTime float64

	// Success rate of hardware calls
	HardwareSuccessRate float64

	// Improvement rate of hardware calls
	HardwareImprovementRate float64

	// Total steps performed in software
	SoftwareSteps int

	// Average unsatisfied clauses after software phase
	AvgUnsatClauses float64

	// Number of variables flipped by software
	SoftwareFlips int

	// Number of restarts performed
	Restarts int

	// Hardware offload decisions
	Decisions []struct {
		UseHardware bool
		Reason      string
		Confidence  float64
	}
}

// DefaultHybridConfig returns a default configuration for the hybrid solver
func DefaultHybridConfig() HybridSolverConfig {
	return HybridSolverConfig{
		MaxSoftwareSteps: 100000,
		MaxHardwareTime:  10000, // 10ms
		WalkProbability:  0.5,
		SwitchFrequency:  5000,
		UnsatThreshold:   10,
		MinConfidence:    0.6,
		CollectStats:     true,
	}
}

// HybridSolve uses a combination of software and hardware to solve a SAT problem
func HybridSolve(formula *Formula, hardware HardwareAccelerator, config HybridSolverConfig) (*SolveResult, error) {
	startTime := time.Now()

	// First, make a decision about whether to use hardware for this problem
	decision := DecideHardwareOffload(formula, hardware)

	var stats HybridSolverStats
	if config.CollectStats {
		stats.Decisions = append(stats.Decisions, struct {
			UseHardware bool
			Reason      string
			Confidence  float64
		}{
			UseHardware: decision.UseHardware,
			Reason:      decision.Reason,
			Confidence:  decision.Confidence,
		})
	}

	// If confidence is high enough, try hardware first
	if decision.UseHardware && decision.Confidence >= config.MinConfidence {
		// Initialize the hardware
		if err := hardware.Initialize(formula); err != nil {
			// If hardware fails, fall back to software
			fmt.Printf("Hardware initialization failed: %v, falling back to software\n", err)
		} else {
			// Try pure hardware approach first
			if config.CollectStats {
				stats.HardwareRuns++
			}

			assignment, found, hwTime, err := hardware.Solve(config.MaxHardwareTime)

			if config.CollectStats {
				stats.HardwareTime += hwTime
			}

			if err == nil && found {
				// Hardware found a solution!
				endTime := time.Now()
				duration := endTime.Sub(startTime)

				// Verify solution
				allSatisfied := true
				for _, clause := range formula.Clauses {
					if !isSatisfied(clause, assignment) {
						allSatisfied = false
						break
					}
				}

				if allSatisfied {
					// Build solution string
					var solutionString string
					for _, val := range assignment {
						if val {
							solutionString += "1"
						} else {
							solutionString += "0"
						}
					}

					result := &SolveResult{
						SolutionFound:   true,
						SolutionString:  solutionString,
						SolutionCount:   1,
						ComputationTime: float64(duration.Microseconds()),
						Restarts:        0,
						TotalSteps:      0, // No software steps
						Metrics: CNFMetrics{
							Variables:      formula.NumVars,
							Clauses:        formula.NumClauses,
							ClauseVarRatio: float64(formula.NumClauses) / float64(formula.NumVars),
						},
					}

					return result, nil
				}
			}
		}
	}

	// If we get here, either hardware wasn't used or it failed
	// Proceed with hybrid approach
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	// Initialize random assignment
	assignment := make([]bool, formula.NumVars)
	for i := range assignment {
		assignment[i] = rng.Intn(2) == 1
	}

	// Track unsatisfied clauses
	unsatClauses := []int{}
	for i, clause := range formula.Clauses {
		if !isSatisfied(clause, assignment) {
			unsatClauses = append(unsatClauses, i)
		}
	}

	numRestarts := 0
	totalSteps := 0
	softwareTime := 0.0
	hardwareTime := 0.0
	softwareFlips := 0

	// Store initial number of unsatisfied clauses for comparison
	initialUnsatCount := len(unsatClauses)

	// Main solving loop
	for step := 0; step < config.MaxSoftwareSteps; step++ {
		totalSteps++

		// If all clauses are satisfied, we're done
		if len(unsatClauses) == 0 {
			break
		}

		// Every SwitchFrequency steps, consider using hardware
		if step > 0 && step%config.SwitchFrequency == 0 && hardware.IsAvailable() {
			// Check if we should offload to hardware
			if len(unsatClauses) <= config.UnsatThreshold {
				if config.CollectStats {
					stats.HardwareRuns++
					stats.AvgUnsatClauses += float64(len(unsatClauses))
				}

				// Try to improve with hardware
				hwStart := time.Now()

				if err := hardware.Initialize(formula); err == nil {
					improvedAssignment, solved, hwTime, err := hardware.Offload(
						assignment, unsatClauses, config.MaxHardwareTime)

					hardwareTime += hwTime
					if config.CollectStats {
						stats.HardwareTime += hwTime
					}

					if err == nil {
						// Check if hardware made an improvement
						oldUnsatCount := len(unsatClauses)

						// Update assignment with hardware result
						assignment = improvedAssignment

						// Recompute unsatisfied clauses
						unsatClauses = []int{}
						for i, clause := range formula.Clauses {
							if !isSatisfied(clause, assignment) {
								unsatClauses = append(unsatClauses, i)
							}
						}

						newUnsatCount := len(unsatClauses)

						if config.CollectStats {
							if solved {
								stats.HardwareSuccessRate++
							}
							if newUnsatCount < oldUnsatCount {
								stats.HardwareImprovementRate++
							}
						}

						if solved {
							// Hardware found a solution!
							break
						}
					}
				}

				hwDuration := time.Since(hwStart)
				softwareTime += float64(hwDuration.Microseconds())
			}
		}

		// Standard WalkSAT step
		swStart := time.Now()

		// Select a random unsatisfied clause
		clauseIdx := unsatClauses[rng.Intn(len(unsatClauses))]
		clause := formula.Clauses[clauseIdx]

		// Find variable that breaks fewest clauses when flipped
		var bestVar int
		minBreaks := len(formula.Clauses) + 1
		bestVars := []int{}
		for _, lit := range clause {
			breaks := 0
			for _, clauseInfo := range formula.VarToClauses[lit.Var] {
				otherClause := formula.Clauses[clauseInfo.Index]
				if isSatisfied(otherClause, assignment) && wouldBreak(otherClause, assignment, lit.Var) {
					breaks++
				}
			}
			if breaks < minBreaks {
				minBreaks = breaks
				bestVars = []int{lit.Var}
			} else if breaks == minBreaks {
				bestVars = append(bestVars, lit.Var)
			}
		}

		// Either pick the best variable or do a random walk
		if config.WalkProbability > 0 && rng.Float64() < config.WalkProbability && minBreaks > 0 {
			bestVar = clause[rng.Intn(len(clause))].Var
		} else {
			bestVar = bestVars[rng.Intn(len(bestVars))]
		}

		// Flip the selected variable
		assignment[bestVar] = !assignment[bestVar]
		softwareFlips++

		// Update unsatisfied clauses
		unsatClauses = []int{}
		for i, cl := range formula.Clauses {
			if !isSatisfied(cl, assignment) {
				unsatClauses = append(unsatClauses, i)
			}
		}

		// If we haven't made progress for a while, restart
		if step > 0 && step%10000 == 0 && len(unsatClauses) > 0 &&
			float64(len(unsatClauses)) > float64(initialUnsatCount)*0.7 {
			numRestarts++

			if config.CollectStats {
				stats.Restarts++
			}

			// Reinitialize with random assignment
			for i := range assignment {
				assignment[i] = rng.Intn(2) == 1
			}

			// Update unsatisfied clauses
			unsatClauses = []int{}
			for i, cl := range formula.Clauses {
				if !isSatisfied(cl, assignment) {
					unsatClauses = append(unsatClauses, i)
				}
			}

			// Update initial count for comparison
			initialUnsatCount = len(unsatClauses)
		}

		swDuration := time.Since(swStart)
		softwareTime += float64(swDuration.Microseconds())

		if config.CollectStats {
			stats.SoftwareTime += float64(swDuration.Microseconds())
			stats.SoftwareRuns++
			stats.SoftwareSteps++
		}
	}

	// Check if we found a solution
	solutionFound := len(unsatClauses) == 0

	// Build solution string
	var solutionString string
	for _, val := range assignment {
		if val {
			solutionString += "1"
		} else {
			solutionString += "0"
		}
	}

	// Calculate total time
	endTime := time.Now()
	duration := endTime.Sub(startTime)

	// Update stats if requested
	if config.CollectStats {
		if stats.HardwareRuns > 0 {
			stats.HardwareSuccessRate /= float64(stats.HardwareRuns)
			stats.HardwareImprovementRate /= float64(stats.HardwareRuns)
			stats.AvgUnsatClauses /= float64(stats.HardwareRuns)
		}
		stats.SoftwareFlips = softwareFlips
	}

	result := &SolveResult{
		SolutionFound:   solutionFound,
		SolutionString:  solutionString,
		SolutionCount:   1,
		ComputationTime: float64(duration.Microseconds()),
		Restarts:        numRestarts,
		TotalSteps:      totalSteps,
		Metrics: CNFMetrics{
			Variables:      formula.NumVars,
			Clauses:        formula.NumClauses,
			ClauseVarRatio: float64(formula.NumClauses) / float64(formula.NumVars),
		},
	}

	return result, nil
}

// HybridSolveCNFFile solves a CNF file using the hybrid solver
func HybridSolveCNFFile(cnfPath string, hardware HardwareAccelerator, config HybridSolverConfig) (*SolveResult, error) {
	formula, err := ParseDIMACS(cnfPath)
	if err != nil {
		return nil, err
	}

	// Read original CNF content
	originalCNF := ""
	fileContent, err := os.ReadFile(cnfPath)
	if err == nil {
		originalCNF = string(fileContent)
	}

	// Calculate additional metrics
	totalClauseSize := 0
	maxClauseSize := 0
	minClauseSize := len(formula.Clauses[0])
	for _, clause := range formula.Clauses {
		size := len(clause)
		totalClauseSize += size
		if size > maxClauseSize {
			maxClauseSize = size
		}
		if size < minClauseSize {
			minClauseSize = size
		}
	}
	avgClauseSize := float64(totalClauseSize) / float64(len(formula.Clauses))

	// Solve the problem
	result, err := HybridSolve(formula, hardware, config)
	if err != nil {
		return nil, err
	}

	// Update metrics and filename
	result.Filename = filepath.Base(cnfPath)
	result.Metrics.AvgClauseSize = avgClauseSize
	result.Metrics.MaxClauseSize = maxClauseSize
	result.Metrics.MinClauseSize = minClauseSize
	result.OriginalCNF = originalCNF

	return result, nil
}
