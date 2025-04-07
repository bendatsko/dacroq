package walksat

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// generateRandomCNF creates a random CNF formula with the given parameters
func generateRandomCNF(numVars, numClauses, clauseSize int) *Formula {
	rand.Seed(time.Now().UnixNano())
	formula := &Formula{
		NumVars:      numVars,
		NumClauses:   numClauses,
		Clauses:      make([]Clause, numClauses),
		VarToClauses: make(map[int][]ClauseInfo),
	}

	for i := 0; i < numClauses; i++ {
		clause := make(Clause, clauseSize)
		used := make(map[int]bool)

		for j := 0; j < clauseSize; j++ {
			// Select a variable that hasn't been used in this clause
			var variable int
			for {
				variable = rand.Intn(numVars)
				if !used[variable] {
					used[variable] = true
					break
				}
			}

			// Randomly decide if it's negated
			sign := rand.Intn(2) == 1
			clause[j] = Literal{Var: variable, Sign: sign}
		}

		formula.Clauses[i] = clause
	}

	// Build var-to-clauses map
	for clauseIdx, clause := range formula.Clauses {
		for _, lit := range clause {
			formula.VarToClauses[lit.Var] = append(formula.VarToClauses[lit.Var],
				ClauseInfo{Index: clauseIdx, Sign: lit.Sign})
		}
	}

	return formula
}

// writeCNFToFile writes a formula to a DIMACS CNF file
func writeCNFToFile(formula *Formula, path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	// Write header
	file.WriteString(fmt.Sprintf("p cnf %d %d\n", formula.NumVars, formula.NumClauses))

	// Write clauses
	for _, clause := range formula.Clauses {
		for _, lit := range clause {
			var value int
			if lit.Sign {
				value = -(lit.Var + 1) // Convert to 1-indexed and negate
			} else {
				value = lit.Var + 1 // Convert to 1-indexed
			}
			file.WriteString(fmt.Sprintf("%d ", value))
		}
		file.WriteString("0\n")
	}

	return nil
}

// BenchmarkSolvers compares the performance of different SAT solvers
func BenchmarkSolvers(b *testing.B) {
	// Problem sizes to test
	problemSizes := []struct {
		vars      int
		clauses   int
		clauseLen int
		name      string
	}{
		{20, 85, 3, "small_3sat"},   // Small 3-SAT
		{50, 213, 3, "medium_3sat"}, // Medium 3-SAT
		{100, 425, 3, "large_3sat"}, // Large 3-SAT
		{30, 90, 5, "5sat"},         // 5-SAT
	}

	// Create a temporary directory for CNF files
	tempDir := b.TempDir()

	// Setup hardware accelerator
	hardware := NewSimulatedAccelerator()

	// Hybrid configuration
	hybridConfig := DefaultHybridConfig()

	// Generate problems and run benchmarks
	for _, ps := range problemSizes {
		// Generate a random formula
		formula := generateRandomCNF(ps.vars, ps.clauses, ps.clauseLen)

		// Write it to a file
		cnfPath := filepath.Join(tempDir, fmt.Sprintf("%s.cnf", ps.name))
		err := writeCNFToFile(formula, cnfPath)
		if err != nil {
			b.Fatalf("Failed to write CNF file: %v", err)
		}

		// Benchmark pure software WalkSAT
		b.Run(fmt.Sprintf("Software_%s_v%d_c%d", ps.name, ps.vars, ps.clauses), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _, _ = WalkSAT(formula, 10000, 0.5)
			}
		})

		// Benchmark hybrid solver
		b.Run(fmt.Sprintf("Hybrid_%s_v%d_c%d", ps.name, ps.vars, ps.clauses), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = HybridSolve(formula, hardware, hybridConfig)
			}
		})

		// Benchmark the hardware-only solver for comparison
		hwOnlyConfig := HybridSolverConfig{
			MaxSoftwareSteps: 0,
			MaxHardwareTime:  10000,
			MinConfidence:    0.1, // Force hardware use
			CollectStats:     false,
		}

		b.Run(fmt.Sprintf("Hardware_%s_v%d_c%d", ps.name, ps.vars, ps.clauses), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = HybridSolve(formula, hardware, hwOnlyConfig)
			}
		})
	}
}

// BenchmarkPhaseTransition benchmarks solver performance near the SAT phase transition
func BenchmarkPhaseTransition(b *testing.B) {
	// Phase transition occurs around ratio 4.26 for 3-SAT
	// Test around this critical point
	ratios := []float64{3.5, 4.0, 4.26, 4.5, 5.0}
	numVars := 50 // Fixed number of variables

	// Create a temporary directory for CNF files
	tempDir := b.TempDir()

	// Setup solvers
	hardware := NewSimulatedAccelerator()
	hybridConfig := DefaultHybridConfig()

	for _, ratio := range ratios {
		numClauses := int(ratio * float64(numVars))

		// Generate a 3-SAT problem with the specified ratio
		formula := generateRandomCNF(numVars, numClauses, 3)

		// Write formula to file
		cnfPath := filepath.Join(tempDir, fmt.Sprintf("phase_v%d_r%.2f.cnf", numVars, ratio))
		err := writeCNFToFile(formula, cnfPath)
		if err != nil {
			b.Fatalf("Failed to write CNF file: %v", err)
		}

		// Benchmark solvers at this ratio
		b.Run(fmt.Sprintf("Software_ratio%.2f", ratio), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _, _ = WalkSAT(formula, 10000, 0.5)
			}
		})

		b.Run(fmt.Sprintf("Hybrid_ratio%.2f", ratio), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = HybridSolve(formula, hardware, hybridConfig)
			}
		})
	}
}
