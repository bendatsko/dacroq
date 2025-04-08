package walksat

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"
)

// SolverConfig defines the configuration for the solver
type SolverConfig struct {
	// Basic solver parameters
	MaxFlips        int     // Maximum number of flips to try
	MaxTries        int     // Maximum number of tries
	Noise           float64 // Probability of random walk
	Timeout         float64 // Maximum time in microseconds
	RestartProb     float64 // Probability of restart
	HardwareMode    bool    // Whether to use hardware acceleration
	MaxHardwareTime float64 // Maximum hardware time in microseconds
}

// Literal represents a variable with a sign (true = negated, false = positive)
type Literal struct {
	Var  int
	Sign bool
}

// Clause represents a disjunction of literals
type Clause []Literal

// Formula represents a CNF formula
type Formula struct {
	Clauses      []Clause
	NumVars      int
	NumClauses   int
	VarToClauses map[int][]ClauseInfo
}

// ClauseInfo stores clause index and the sign of the variable in that clause
type ClauseInfo struct {
	Index int
	Sign  bool
}

// HardwareMetrics tracks performance metrics for the hardware accelerator
type HardwareMetrics struct {
	// Problem Characteristics
	ProblemSize       int
	ClauseCount       int
	ClauseDensity     float64
	ProblemComplexity string

	// Hardware Performance
	OscillatorSyncTime  float64
	CrossbarSetupTime   float64
	HardwareUtilization float64
	OscillatorStability float64
	CrossbarEfficiency  float64
	TemperatureEffects  float64

	// Power and Energy
	StaticPower       float64
	DynamicPower      float64
	TotalEnergy       float64
	EnergyPerSolution float64
	PowerEfficiency   float64

	// Timing
	HardwareTime    float64
	SoftwareTime    float64
	TotalTime       float64
	TimePerSolution float64
}

// HardwareAccelerator defines the interface for hardware acceleration
type HardwareAccelerator interface {
	Initialize(formula *Formula) error
	Solve(timeout float64) ([]bool, bool, float64, error)
	GetMetrics() HardwareMetrics
}

// SimulatedAccelerator implements the HardwareAccelerator interface
type SimulatedAccelerator struct {
	metrics HardwareMetrics
	formula *Formula
	config  *SolverConfig
	rng     *rand.Rand
}

// NewSimulatedAccelerator creates a new simulated hardware accelerator
func NewSimulatedAccelerator() *SimulatedAccelerator {
	return &SimulatedAccelerator{
		metrics: HardwareMetrics{
			OscillatorSyncTime:  0.1,  // 100µs
			CrossbarSetupTime:   0.05, // 50µs
			HardwareUtilization: 0.8,  // 80%
			OscillatorStability: 0.95, // 95%
			CrossbarEfficiency:  0.9,  // 90%
		},
		rng: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Initialize prepares the hardware accelerator
func (s *SimulatedAccelerator) Initialize(formula *Formula) error {
	s.formula = formula
	// Simulate hardware initialization
	time.Sleep(10 * time.Millisecond)
	return nil
}

// Solve implements the HardwareAccelerator interface
func (s *SimulatedAccelerator) Solve(timeout float64) ([]bool, bool, float64, error) {
	startTime := time.Now()

	// Simulate hardware operations
	time.Sleep(time.Duration(s.rng.Float64() * float64(time.Millisecond)))

	// Generate a solution
	assignment := make([]bool, s.formula.NumVars)
	for i := range assignment {
		assignment[i] = s.rng.Intn(2) == 1
	}

	// Check if the solution is valid
	satisfiable := true
	for _, clause := range s.formula.Clauses {
		clauseSatisfied := false
		for _, lit := range clause {
			if (lit.Sign && assignment[lit.Var-1]) || (!lit.Sign && !assignment[lit.Var-1]) {
				clauseSatisfied = true
				break
			}
		}
		if !clauseSatisfied {
			satisfiable = false
			break
		}
	}

	hwTime := time.Since(startTime).Seconds() * 1e6 // Convert to microseconds
	return assignment, satisfiable, hwTime, nil
}

// GetMetrics returns the current hardware metrics
func (s *SimulatedAccelerator) GetMetrics() HardwareMetrics {
	return s.metrics
}

// ParseDIMACS reads a DIMACS CNF file and returns a Formula
func ParseDIMACS(filename string) (*Formula, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	formula := &Formula{
		VarToClauses: make(map[int][]ClauseInfo),
	}

	var cnfContent strings.Builder
	for scanner.Scan() {
		line := scanner.Text()
		cnfContent.WriteString(line)
		cnfContent.WriteString("\n")

		line = strings.TrimSpace(line)
		if len(line) == 0 || line[0] == 'c' {
			continue
		}

		if line[0] == 'p' {
			parts := strings.Fields(line)
			if len(parts) != 4 || parts[1] != "cnf" {
				return nil, fmt.Errorf("invalid problem line: %s", line)
			}
			formula.NumVars, _ = strconv.Atoi(parts[2])
			formula.NumClauses, _ = strconv.Atoi(parts[3])
			continue
		}

		var clause Clause
		literals := strings.Fields(line)
		for _, lit := range literals {
			num, err := strconv.Atoi(lit)
			if err != nil {
				continue
			}
			if num == 0 {
				break
			}
			var literal Literal
			if num < 0 {
				literal = Literal{Var: -num, Sign: true}
			} else {
				literal = Literal{Var: num, Sign: false}
			}
			clause = append(clause, literal)
		}
		if len(clause) > 0 {
			formula.Clauses = append(formula.Clauses, clause)
		}
	}

	return formula, nil
}

// SolveCNFFile solves a CNF file and returns the result
func SolveCNFFile(filename string) (*SolveResult, error) {
	formula, err := ParseDIMACS(filename)
	if err != nil {
		return nil, err
	}

	// Create a simulated accelerator
	acc := NewSimulatedAccelerator()
	if err := acc.Initialize(formula); err != nil {
		return nil, err
	}

	assignment, found, hwTime, err := acc.Solve(10000.0) // 10ms timeout
	if err != nil {
		return nil, err
	}

	// Read the original CNF content
	content, _ := os.ReadFile(filename)

	return &SolveResult{
		SolutionFound:   found,
		SolutionString:  boolArrayToString(assignment),
		ComputationTime: hwTime,
		Metrics: SolveMetrics{
			Variables: formula.NumVars,
			Clauses:   formula.NumClauses,
		},
		OriginalCNF: string(content),
		Filename:    filename,
	}, nil
}

// Helper function to convert boolean array to string
func boolArrayToString(arr []bool) string {
	result := make([]byte, len(arr))
	for i, v := range arr {
		if v {
			result[i] = '1'
		} else {
			result[i] = '0'
		}
	}
	return string(result)
}
