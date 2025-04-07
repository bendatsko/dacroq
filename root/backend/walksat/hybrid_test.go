package walksat

import (
	"os"
	"path/filepath"
	"testing"
)

// TestHybridSolve tests the hybrid solver with different configurations
func TestHybridSolve(t *testing.T) {
	// Create a temporary CNF file for testing
	tempDir := t.TempDir()
	cnfPath := filepath.Join(tempDir, "test.cnf")

	// Simple 3-SAT problem that's easy to solve
	cnfContent := `c A simple 3-SAT problem
p cnf 4 4
1 2 3 0
-1 -2 4 0
-2 -3 -4 0
2 3 -4 0
`
	err := os.WriteFile(cnfPath, []byte(cnfContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test CNF file: %v", err)
	}

	// Parse the formula
	formula, err := ParseDIMACS(cnfPath)
	if err != nil {
		t.Fatalf("Failed to parse CNF: %v", err)
	}

	// Create a hardware accelerator
	hardware := NewSimulatedAccelerator()

	// Test cases with different configurations
	testCases := []struct {
		name     string
		config   HybridSolverConfig
		expected bool // Whether we expect to find a solution
	}{
		{
			name: "Software Only",
			config: HybridSolverConfig{
				MaxSoftwareSteps: 10000,
				MaxHardwareTime:  0, // Disable hardware
				WalkProbability:  0.5,
				SwitchFrequency:  5000,
				UnsatThreshold:   10,
				MinConfidence:    0.9, // Set high to disable hardware
				CollectStats:     true,
			},
			expected: true, // This problem is solvable with software
		},
		{
			name: "Hardware Only",
			config: HybridSolverConfig{
				MaxSoftwareSteps: 0,     // Disable software
				MaxHardwareTime:  10000, // 10ms
				WalkProbability:  0.5,
				SwitchFrequency:  1,
				UnsatThreshold:   100, // High threshold to encourage hardware
				MinConfidence:    0.1, // Low to force hardware
				CollectStats:     true,
			},
			expected: true, // Small enough for simulated hardware
		},
		{
			name: "Hybrid Mode",
			config: HybridSolverConfig{
				MaxSoftwareSteps: 5000,
				MaxHardwareTime:  5000,
				WalkProbability:  0.5,
				SwitchFrequency:  100, // Switch frequently
				UnsatThreshold:   5,
				MinConfidence:    0.5,
				CollectStats:     true,
			},
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := HybridSolve(formula, hardware, tc.config)
			if err != nil {
				t.Fatalf("Error in hybrid solve: %v", err)
			}

			if result.SolutionFound != tc.expected {
				t.Errorf("Expected solution found: %v, got: %v", tc.expected, result.SolutionFound)
			}

			// Verify solution if found
			if result.SolutionFound {
				// Parse the solution string back to a boolean array
				assignment := make([]bool, len(result.SolutionString))
				for i, ch := range result.SolutionString {
					assignment[i] = ch == '1'
				}

				// Check solution validity
				valid := true
				for _, clause := range formula.Clauses {
					if !isSatisfied(clause, assignment) {
						valid = false
						t.Errorf("Solution is invalid - clause not satisfied")
						break
					}
				}

				if !valid {
					t.Errorf("Invalid solution returned: %s", result.SolutionString)
				}
			}

			t.Logf("Solution found: %v, Solution: %s, Time: %.2f μs, Steps: %d",
				result.SolutionFound, result.SolutionString, result.ComputationTime, result.TotalSteps)
		})
	}
}

// TestHardwareEdgeCases tests the hybrid solver under various edge cases
func TestHardwareEdgeCases(t *testing.T) {
	// Create a hardware accelerator that's unavailable
	unavailableHW := &SimulatedAccelerator{
		maxVariables:     200,
		maxClauses:       1000,
		speedupFactor:    10.0,
		successRate:      0.85,
		powerConsumption: 0.045,
		available:        false, // Not available
		rng:              nil,   // Not initialized
	}

	// Create a hardware accelerator with very limited capacity
	limitedHW := &SimulatedAccelerator{
		maxVariables:     3, // Only 3 variables
		maxClauses:       3, // Only 3 clauses
		speedupFactor:    2.0,
		successRate:      0.5,
		powerConsumption: 0.045,
		available:        true,
		rng:              nil, // Will be initialized when used
	}

	// Create a formula that's too large for the limited hardware
	largeFormula := &Formula{
		NumVars:    10,
		NumClauses: 20,
		Clauses:    make([]Clause, 20),
	}

	// Simple formula that should fit in limited hardware
	smallFormula := &Formula{
		NumVars:    3,
		NumClauses: 2,
		Clauses: []Clause{
			{{Var: 0, Sign: false}, {Var: 1, Sign: false}},
			{{Var: 1, Sign: true}, {Var: 2, Sign: false}},
		},
	}

	// Test cases for edge conditions
	testCases := []struct {
		name     string
		formula  *Formula
		hardware HardwareAccelerator
		config   HybridSolverConfig
	}{
		{
			name:     "Unavailable Hardware",
			formula:  smallFormula,
			hardware: unavailableHW,
			config:   DefaultHybridConfig(),
		},
		{
			name:     "Formula Too Large",
			formula:  largeFormula,
			hardware: limitedHW,
			config:   DefaultHybridConfig(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// We don't expect errors, just fallbacks
			result, err := HybridSolve(tc.formula, tc.hardware, tc.config)
			if err != nil {
				t.Fatalf("Error in hybrid solve: %v", err)
			}

			// Test should complete despite hardware limitations
			t.Logf("Solution found: %v", result.SolutionFound)
		})
	}
}

// TestHardwareAccelerator tests the simulated hardware accelerator interface
func TestHardwareAccelerator(t *testing.T) {
	// Create a simple formula
	formula := &Formula{
		NumVars:    3,
		NumClauses: 2,
		Clauses: []Clause{
			{{Var: 0, Sign: false}, {Var: 1, Sign: false}},
			{{Var: 1, Sign: true}, {Var: 2, Sign: false}},
		},
	}

	// Create a hardware accelerator
	hw := NewSimulatedAccelerator()

	// Test initialization
	err := hw.Initialize(formula)
	if err != nil {
		t.Fatalf("Failed to initialize hardware: %v", err)
	}

	// Test solving
	assignment, found, hwTime, err := hw.Solve(1000)
	if err != nil {
		t.Fatalf("Hardware solve error: %v", err)
	}

	t.Logf("Hardware solve: found=%v, time=%.2f", found, hwTime)
	if len(assignment) != formula.NumVars {
		t.Errorf("Expected assignment of length %d, got %d", formula.NumVars, len(assignment))
	}

	// Test offloading
	partialAssignment := []bool{false, false, false}
	unsatClauses := []int{1} // Clause 1 is unsatisfied

	improved, solved, offloadTime, err := hw.Offload(partialAssignment, unsatClauses, 1000)
	if err != nil {
		t.Fatalf("Hardware offload error: %v", err)
	}

	t.Logf("Hardware offload: solved=%v, time=%.2f, improved=%v", solved, offloadTime, improved != nil && len(improved) > 0)

	// Test capabilities
	caps := hw.GetCapabilities()
	if caps == nil {
		t.Fatalf("Failed to get hardware capabilities")
	}

	t.Logf("Hardware capabilities: %v", caps)
}
