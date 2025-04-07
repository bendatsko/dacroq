package walksat

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"
)

// Solver represents a WalkSAT solver instance
type Solver struct {
	NumVars    int
	NumClauses int
	Clauses    [][]int
	MaxFlips   int
	Noise      float64
	Random     *rand.Rand
}

// NewSolver creates a new WalkSAT solver instance
func NewSolver(numVars, numClauses int, clauses [][]int, maxFlips int, noise float64) *Solver {
	return &Solver{
		NumVars:    numVars,
		NumClauses: numClauses,
		Clauses:    clauses,
		MaxFlips:   maxFlips,
		Noise:      noise,
		Random:     rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// SolveResult represents the result of a SAT solving attempt
type SolveResult struct {
	Filename        string
	Satisfiable     bool
	Assignment      []int
	Runtime         time.Duration
	Flips           int
	Error           error
	ComputationTime float64
	OriginalCNF     string
	SolutionFound   bool
	Metrics         CNFMetrics
	SolutionString  string
}

// CNFMetrics represents metrics about a CNF formula
type CNFMetrics struct {
	Variables      int
	Clauses        int
	ClauseVarRatio float64
	AvgClauseSize  float64
	MaxClauseSize  int
	MinClauseSize  int
	ClauseLen      []int
	VarOccur       []int
}

// HardwareAccelerator represents a hardware accelerator for SAT solving
type HardwareAccelerator interface {
	Initialize(cnf string) error
	Solve(timeout float64) ([]int, bool, float64, error)
	GetCapabilities() map[string]interface{}
	IsAvailable() bool
	GetMetrics() CNFMetrics
}

// SimulatedAccelerator implements HardwareAccelerator with simulation
type SimulatedAccelerator struct {
	MaxFlips int
	Noise    float64
	Random   *rand.Rand
	Metrics  CNFMetrics
	CNF      string
}

// NewSimulatedAccelerator creates a new simulated accelerator
func NewSimulatedAccelerator(maxFlips int, noise float64) *SimulatedAccelerator {
	return &SimulatedAccelerator{
		MaxFlips: maxFlips,
		Noise:    noise,
		Random:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Initialize implements the HardwareAccelerator interface
func (sa *SimulatedAccelerator) Initialize(cnf string) error {
	sa.CNF = cnf
	return nil
}

// Solve implements the HardwareAccelerator interface
func (sa *SimulatedAccelerator) Solve(timeout float64) ([]int, bool, float64, error) {
	start := time.Now()

	// Parse CNF
	numVars, numClauses, clauses, err := ParseDIMACS(sa.CNF)
	if err != nil {
		return nil, false, 0, err
	}

	// Update metrics
	sa.Metrics = CNFMetrics{
		Variables: numVars,
		Clauses:   numClauses,
		ClauseLen: make([]int, numClauses),
		VarOccur:  make([]int, numVars),
	}

	// Calculate clause lengths and variable occurrences
	for i, clause := range clauses {
		sa.Metrics.ClauseLen[i] = len(clause)
		for _, lit := range clause {
			varIdx := abs(lit) - 1
			sa.Metrics.VarOccur[varIdx]++
		}
	}

	// Create solver
	solver := NewSolver(numVars, numClauses, clauses, sa.MaxFlips, sa.Noise)

	// Solve
	assignment, satisfiable := solver.Solve()

	// Calculate computation time
	computationTime := time.Since(start).Seconds()

	return assignment, satisfiable, computationTime, nil
}

// GetCapabilities implements the HardwareAccelerator interface
func (sa *SimulatedAccelerator) GetCapabilities() map[string]interface{} {
	return map[string]interface{}{
		"max_flips":    sa.MaxFlips,
		"noise":        sa.Noise,
		"is_simulated": true,
	}
}

// IsAvailable implements the HardwareAccelerator interface
func (sa *SimulatedAccelerator) IsAvailable() bool {
	return true
}

// GetMetrics implements the HardwareAccelerator interface
func (sa *SimulatedAccelerator) GetMetrics() CNFMetrics {
	return sa.Metrics
}

// ParseDIMACS parses a DIMACS CNF file
func ParseDIMACS(cnf string) (int, int, [][]int, error) {
	lines := strings.Split(cnf, "\n")
	var numVars, numClauses int
	var clauses [][]int

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "c") {
			continue
		}

		if strings.HasPrefix(line, "p cnf") {
			parts := strings.Fields(line)
			if len(parts) != 4 {
				return 0, 0, nil, fmt.Errorf("invalid problem line: %s", line)
			}
			var err error
			numVars, err = strconv.Atoi(parts[2])
			if err != nil {
				return 0, 0, nil, fmt.Errorf("invalid number of variables: %s", parts[2])
			}
			numClauses, err = strconv.Atoi(parts[3])
			if err != nil {
				return 0, 0, nil, fmt.Errorf("invalid number of clauses: %s", parts[3])
			}
			continue
		}

		// Parse clause
		parts := strings.Fields(line)
		clause := make([]int, 0, len(parts))
		for _, part := range parts {
			if part == "0" {
				break
			}
			lit, err := strconv.Atoi(part)
			if err != nil {
				return 0, 0, nil, fmt.Errorf("invalid literal: %s", part)
			}
			clause = append(clause, lit)
		}
		clauses = append(clauses, clause)
	}

	return numVars, numClauses, clauses, nil
}

// SolveCNFFile solves a CNF file using the provided hardware accelerator
func SolveCNFFile(filename string, acc HardwareAccelerator) (SolveResult, error) {
	// Read the file
	content, err := os.ReadFile(filename)
	if err != nil {
		return SolveResult{Error: err}, err
	}

	// Initialize the accelerator
	if err := acc.Initialize(string(content)); err != nil {
		return SolveResult{Error: err}, err
	}

	// Solve with a 10ms timeout
	assignment, found, hwTime, err := acc.Solve(10.0)
	if err != nil {
		return SolveResult{Error: err}, err
	}

	// Create solution string
	var solutionString string
	if found {
		for _, val := range assignment {
			if val > 0 {
				solutionString += "1"
			} else {
				solutionString += "0"
			}
		}
	}

	// Get metrics from accelerator
	metrics := acc.GetMetrics()

	return SolveResult{
		Filename:        filename,
		Satisfiable:     found,
		Assignment:      assignment,
		Runtime:         time.Duration(hwTime * float64(time.Second)),
		Flips:           len(assignment), // Use length of assignment as proxy for flips
		ComputationTime: hwTime,
		OriginalCNF:     string(content),
		SolutionFound:   found,
		Metrics:         metrics,
		SolutionString:  solutionString,
	}, nil
}

// HybridConfig represents the configuration for hybrid solving
type HybridConfig struct {
	MaxSoftwareSteps int
	MaxHardwareTime  float64
	UnsatThreshold   float64
	SwitchFrequency  int
	WalkProbability  float64
}

// DefaultHybridConfig returns the default configuration for hybrid solving
func DefaultHybridConfig() HybridConfig {
	return HybridConfig{
		MaxSoftwareSteps: 10000,
		MaxHardwareTime:  1.0,
		UnsatThreshold:   0.1,
		SwitchFrequency:  100,
		WalkProbability:  0.5,
	}
}

// Solve attempts to find a satisfying assignment
func (s *Solver) Solve() ([]int, bool) {
	// Initialize random assignment
	assignment := make([]int, s.NumVars)
	for i := range assignment {
		if s.Random.Float64() < 0.5 {
			assignment[i] = 1
		}
	}

	// Main loop
	for flip := 0; flip < s.MaxFlips; flip++ {
		// Check if current assignment is satisfying
		if s.isSatisfying(assignment) {
			return assignment, true
		}

		// Choose an unsatisfied clause
		unsatClause := s.chooseUnsatClause(assignment)
		if unsatClause == -1 {
			return nil, false
		}

		// Choose a variable to flip
		varToFlip := s.chooseVarToFlip(assignment, unsatClause)
		if varToFlip == -1 {
			return nil, false
		}

		// Flip the variable
		assignment[varToFlip] = 1 - assignment[varToFlip]
	}

	return nil, false
}

// isSatisfying checks if the current assignment satisfies all clauses
func (s *Solver) isSatisfying(assignment []int) bool {
	for _, clause := range s.Clauses {
		satisfied := false
		for _, lit := range clause {
			varIdx := abs(lit) - 1
			if (lit > 0 && assignment[varIdx] == 1) || (lit < 0 && assignment[varIdx] == 0) {
				satisfied = true
				break
			}
		}
		if !satisfied {
			return false
		}
	}
	return true
}

// chooseUnsatClause selects an unsatisfied clause
func (s *Solver) chooseUnsatClause(assignment []int) int {
	var unsatClauses []int
	for i, clause := range s.Clauses {
		satisfied := false
		for _, lit := range clause {
			varIdx := abs(lit) - 1
			if (lit > 0 && assignment[varIdx] == 1) || (lit < 0 && assignment[varIdx] == 0) {
				satisfied = true
				break
			}
		}
		if !satisfied {
			unsatClauses = append(unsatClauses, i)
		}
	}
	if len(unsatClauses) == 0 {
		return -1
	}
	return unsatClauses[s.Random.Intn(len(unsatClauses))]
}

// chooseVarToFlip selects a variable to flip in the given clause
func (s *Solver) chooseVarToFlip(assignment []int, clauseIdx int) int {
	clause := s.Clauses[clauseIdx]
	if s.Random.Float64() < s.Noise {
		// Random walk: choose any variable in the clause
		lit := clause[s.Random.Intn(len(clause))]
		return abs(lit) - 1
	}

	// Greedy walk: choose variable that minimizes the number of unsatisfied clauses
	bestVar := -1
	minUnsat := len(s.Clauses) + 1

	for _, lit := range clause {
		varIdx := abs(lit) - 1
		// Try flipping this variable
		assignment[varIdx] = 1 - assignment[varIdx]
		unsatCount := s.countUnsatClauses(assignment)
		if unsatCount < minUnsat {
			minUnsat = unsatCount
			bestVar = varIdx
		}
		// Flip back
		assignment[varIdx] = 1 - assignment[varIdx]
	}

	return bestVar
}

// countUnsatClauses counts the number of unsatisfied clauses
func (s *Solver) countUnsatClauses(assignment []int) int {
	count := 0
	for _, clause := range s.Clauses {
		satisfied := false
		for _, lit := range clause {
			varIdx := abs(lit) - 1
			if (lit > 0 && assignment[varIdx] == 1) || (lit < 0 && assignment[varIdx] == 0) {
				satisfied = true
				break
			}
		}
		if !satisfied {
			count++
		}
	}
	return count
}

// abs returns the absolute value of an integer
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
