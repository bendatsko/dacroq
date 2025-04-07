package walksat

import (
	"errors"
	"math/rand"
	"time"
)

// HardwareAccelerator defines the interface for a SAT solving hardware accelerator
type HardwareAccelerator interface {
	// Initialize sets up the hardware with the given CNF formula
	Initialize(formula *Formula) error

	// Solve attempts to solve the formula using the hardware
	// Returns the assignment, whether a solution was found, and the time taken in microseconds
	Solve(timeout float64) ([]bool, bool, float64, error)

	// Offload sends a partial assignment to the hardware for refinement
	// Returns the improved assignment, whether it's a solution, and the time taken
	Offload(partialAssignment []bool, unsatClauses []int, timeout float64) ([]bool, bool, float64, error)

	// IsAvailable checks if the hardware is available for computation
	IsAvailable() bool

	// GetCapabilities returns hardware capabilities including max variables, max clauses
	GetCapabilities() map[string]interface{}
}

// HardwareDecision contains the decision data from hardware accelerator
type HardwareDecision struct {
	// UseHardware indicates whether the problem should be offloaded to hardware
	UseHardware bool

	// Reason provides an explanation for the decision
	Reason string

	// Confidence level in the decision (0-1)
	Confidence float64
}

// SimulatedAccelerator provides a simulated hardware accelerator for testing
type SimulatedAccelerator struct {
	// Configuration parameters
	maxVariables     int
	maxClauses       int
	speedupFactor    float64 // How much faster than software (e.g., 5.0 = 5x faster)
	successRate      float64 // Probability of successfully solving (0-1)
	powerConsumption float64 // Power in watts
	available        bool

	// Current state
	formula *Formula
	rng     *rand.Rand
}

// NewSimulatedAccelerator creates a new simulated hardware accelerator
func NewSimulatedAccelerator() *SimulatedAccelerator {
	return &SimulatedAccelerator{
		maxVariables:     200,   // Can handle problems up to 200 variables
		maxClauses:       1000,  // Can handle up to 1000 clauses
		speedupFactor:    10.0,  // 10x faster than software
		successRate:      0.85,  // 85% success rate
		powerConsumption: 0.045, // 45mW
		available:        true,
		rng:              rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Initialize prepares the simulated hardware with the formula
func (h *SimulatedAccelerator) Initialize(formula *Formula) error {
	if formula.NumVars > h.maxVariables {
		return errors.New("formula exceeds hardware maximum variable count")
	}

	if formula.NumClauses > h.maxClauses {
		return errors.New("formula exceeds hardware maximum clause count")
	}

	h.formula = formula
	return nil
}

// Solve attempts to solve the formula using simulated hardware
func (h *SimulatedAccelerator) Solve(timeout float64) ([]bool, bool, float64, error) {
	if h.formula == nil {
		return nil, false, 0, errors.New("hardware not initialized with formula")
	}

	if !h.available {
		return nil, false, 0, errors.New("hardware not available")
	}

	// Calculate estimated software runtime
	estimatedSoftwareTime := float64(h.formula.NumVars*h.formula.NumClauses) * 0.01 // microseconds

	// Apply hardware speedup
	hardwareTime := estimatedSoftwareTime / h.speedupFactor

	// Add some randomness to simulate real hardware behavior
	hardwareTime = hardwareTime * (0.8 + 0.4*h.rng.Float64())

	// Check if we found a solution (based on success rate)
	foundSolution := h.rng.Float64() < h.successRate

	// Generate a random assignment
	assignment := make([]bool, h.formula.NumVars)

	if foundSolution {
		// If we "found" a solution, create a valid one
		// Start with random assignment
		for i := range assignment {
			assignment[i] = h.rng.Intn(2) == 1
		}

		// Fix assignment to satisfy all clauses
		unsatisfied := true
		maxIterations := 1000

		for i := 0; i < maxIterations && unsatisfied; i++ {
			unsatisfied = false

			for _, clause := range h.formula.Clauses {
				if !isSatisfied(clause, assignment) {
					unsatisfied = true
					// Pick a random variable from the clause and flip it
					lit := clause[h.rng.Intn(len(clause))]
					assignment[lit.Var] = !assignment[lit.Var]
				}
			}
		}

		// If we still couldn't find a solution, report failure
		if unsatisfied {
			foundSolution = false
		}
	} else {
		// Just return a random assignment
		for i := range assignment {
			assignment[i] = h.rng.Intn(2) == 1
		}
	}

	return assignment, foundSolution, hardwareTime, nil
}

// Offload sends a partial assignment to hardware for refinement
func (h *SimulatedAccelerator) Offload(partialAssignment []bool, unsatClauses []int, timeout float64) ([]bool, bool, float64, error) {
	if h.formula == nil {
		return nil, false, 0, errors.New("hardware not initialized with formula")
	}

	if !h.available {
		return nil, false, 0, errors.New("hardware not available")
	}

	// Copy the assignment to avoid modifying the original
	assignment := make([]bool, len(partialAssignment))
	copy(assignment, partialAssignment)

	// Estimate computation time based on unsatisfied clauses
	estimatedSoftwareTime := float64(len(unsatClauses) * 10) // microseconds
	hardwareTime := estimatedSoftwareTime / h.speedupFactor

	// Add some randomness
	hardwareTime = hardwareTime * (0.8 + 0.4*h.rng.Float64())

	// Probability of improvement depends on how many clauses are unsatisfied
	// More unsatisfied clauses = harder to improve
	improvementProbability := 0.9 - (float64(len(unsatClauses)) / float64(h.formula.NumClauses))
	if improvementProbability < 0.1 {
		improvementProbability = 0.1
	}

	improved := h.rng.Float64() < improvementProbability

	if improved {
		// Simulate improvement by fixing some unsatisfied clauses
		for _, clauseIdx := range unsatClauses {
			if h.rng.Float64() < 0.7 { // 70% chance to fix each clause
				clause := h.formula.Clauses[clauseIdx]
				// Pick a random variable and set it to satisfy the clause
				lit := clause[h.rng.Intn(len(clause))]
				assignment[lit.Var] = !lit.Sign // Set to make literal true
			}
		}
	}

	// Check if we've found a complete solution
	allSatisfied := true
	for _, clause := range h.formula.Clauses {
		if !isSatisfied(clause, assignment) {
			allSatisfied = false
			break
		}
	}

	return assignment, allSatisfied, hardwareTime, nil
}

// IsAvailable checks if hardware is available
func (h *SimulatedAccelerator) IsAvailable() bool {
	return h.available
}

// GetCapabilities returns hardware capabilities
func (h *SimulatedAccelerator) GetCapabilities() map[string]interface{} {
	return map[string]interface{}{
		"max_variables":     h.maxVariables,
		"max_clauses":       h.maxClauses,
		"speedup_factor":    h.speedupFactor,
		"success_rate":      h.successRate,
		"power_consumption": h.powerConsumption,
		"optimized_for":     []string{"3-SAT", "LDPC"},
	}
}

// DecideHardwareOffload makes an intelligent decision about whether to use
// hardware acceleration based on problem characteristics
func DecideHardwareOffload(formula *Formula, hardware HardwareAccelerator) HardwareDecision {
	// If hardware isn't available, return immediately
	if !hardware.IsAvailable() {
		return HardwareDecision{
			UseHardware: false,
			Reason:      "Hardware accelerator not available",
			Confidence:  1.0,
		}
	}

	capabilities := hardware.GetCapabilities()

	// Check if problem is too large for hardware
	maxVars, _ := capabilities["max_variables"].(int)
	maxClauses, _ := capabilities["max_clauses"].(int)

	if formula.NumVars > maxVars {
		return HardwareDecision{
			UseHardware: false,
			Reason:      "Problem exceeds hardware variable capacity",
			Confidence:  1.0,
		}
	}

	if formula.NumClauses > maxClauses {
		return HardwareDecision{
			UseHardware: false,
			Reason:      "Problem exceeds hardware clause capacity",
			Confidence:  1.0,
		}
	}

	// Calculate clause-to-variable ratio
	ratio := float64(formula.NumClauses) / float64(formula.NumVars)

	// Hardware is generally better for problems near the phase transition
	// (around 4.26 for 3-SAT)
	nearPhaseTransition := ratio >= 4.0 && ratio <= 4.5

	// Check average clause size - hardware may be optimized for certain sizes
	totalLiterals := 0
	for _, clause := range formula.Clauses {
		totalLiterals += len(clause)
	}
	avgClauseSize := float64(totalLiterals) / float64(formula.NumClauses)

	// Decision logic based on problem characteristics
	if nearPhaseTransition && avgClauseSize >= 2.8 && avgClauseSize <= 3.2 {
		// Likely a 3-SAT problem near phase transition - ideal for hardware
		return HardwareDecision{
			UseHardware: true,
			Reason:      "3-SAT problem near phase transition",
			Confidence:  0.9,
		}
	} else if formula.NumVars <= maxVars/2 && formula.NumClauses <= maxClauses/2 {
		// Small problem, hardware should be efficient
		return HardwareDecision{
			UseHardware: true,
			Reason:      "Small problem suitable for hardware acceleration",
			Confidence:  0.8,
		}
	} else if ratio > 5.0 {
		// Very constrained problem, may benefit from hardware's parallelism
		return HardwareDecision{
			UseHardware: true,
			Reason:      "Highly constrained problem",
			Confidence:  0.7,
		}
	} else if avgClauseSize > 5.0 {
		// Large clauses, software might be more efficient
		return HardwareDecision{
			UseHardware: false,
			Reason:      "Large clause size better suited for software",
			Confidence:  0.6,
		}
	}

	// Default to hardware for problems that fit well within its capacity
	return HardwareDecision{
		UseHardware: formula.NumVars <= maxVars/2,
		Reason:      "General problem evaluation",
		Confidence:  0.5,
	}
}
