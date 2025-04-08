package walksat

// HybridConfig defines configuration for the hybrid solver
type HybridConfig struct {
	MaxSoftwareSteps int     // Maximum steps in software before trying hardware
	MaxHardwareTime  float64 // Maximum hardware time in microseconds
	UnsatThreshold   int     // Threshold of unsatisfied clauses for hardware
	SwitchFrequency  int     // How often to switch between software and hardware
	WalkProbability  float64 // Probability of random walk in WalkSAT
	MinConfidence    float64 // Minimum confidence to use hardware
}

// NewHybridConfig creates a default hybrid configuration
func NewHybridConfig() *HybridConfig {
	return &HybridConfig{
		MaxSoftwareSteps: 1000,
		MaxHardwareTime:  10000.0, // 10ms
		UnsatThreshold:   10,
		SwitchFrequency:  100,
		WalkProbability:  0.5,
		MinConfidence:    0.8,
	}
}

// HybridSolve combines software and hardware approaches
func HybridSolve(formula *Formula, hardware HardwareAccelerator, config *HybridConfig, solverConfig *SolverConfig) (*SolveResult, error) {
	// Initialize hardware
	if err := hardware.Initialize(formula); err != nil {
		return nil, err
	}

	// Try hardware first
	assignment, found, hwTime, err := hardware.Solve(config.MaxHardwareTime)
	if err != nil {
		return nil, err
	}

	if found {
		return &SolveResult{
			SolutionFound:   true,
			SolutionString:  boolArrayToString(assignment),
			ComputationTime: hwTime,
			Metrics: SolveMetrics{
				Variables: formula.NumVars,
				Clauses:   formula.NumClauses,
			},
		}, nil
	}

	// If hardware fails, return a failed result
	return &SolveResult{
		SolutionFound:   false,
		ComputationTime: hwTime,
		Metrics: SolveMetrics{
			Variables: formula.NumVars,
			Clauses:   formula.NumClauses,
		},
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

// SolveResult represents the result of solving a SAT problem
type SolveResult struct {
	SolutionFound   bool
	SolutionString  string
	ComputationTime float64
	Metrics         SolveMetrics
	OriginalCNF     string
	Filename        string
}

// SolveMetrics contains metrics about the solving process
type SolveMetrics struct {
	Variables int
	Clauses   int
}
