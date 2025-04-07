# Hybrid Hardware-Software SAT Solver

This project implements a hybrid SAT solver approach that combines the WalkSAT software algorithm with hardware acceleration to efficiently solve Boolean satisfiability problems.

## Overview

The hybrid SAT solver intelligently combines the strengths of software SAT solving with hardware acceleration:

- **Software Solver**: Uses the WalkSAT algorithm, a randomized algorithm for solving boolean satisfiability problems.
- **Hardware Accelerator**: Simulates or interfaces with specialized SAT-solving hardware that can solve certain problem classes more efficiently.
- **Hybrid Approach**: Intelligently decides when to use software, hardware, or a combination of both based on problem characteristics.

## Architecture

The system consists of the following main components:

### 1. WalkSAT Software Solver

A Go implementation of the WalkSAT algorithm that:
- Parses DIMACS CNF format
- Uses probabilistic heuristics to find satisfying assignments
- Tracks unsatisfied clauses for efficiency
- Implements periodic restarts for escaping local minima

### 2. Hardware Accelerator Interface

An interface for SAT-solving hardware:
- Defines common operations (initialize, solve, offload partial problems)
- Includes a simulated hardware accelerator for testing
- Can be extended to support actual hardware devices

### 3. Hybrid Solver

The intelligent component that decides how to solve each problem:
- Analyzes problem characteristics (size, clause structure, etc.)
- Makes decisions about whether to use hardware acceleration
- Implements coordination between software and hardware phases
- Collects statistics about solver performance

## Implementation Details

### Hardware Decision Logic

The system uses several heuristics to decide when to use hardware:

1. **Problem Size**: Hardware is preferred for problems within its capacity limits
2. **Clause-to-Variable Ratio**: Hardware excels at problems near the phase transition (ratio ~4.26 for 3-SAT)
3. **Clause Structure**: Some hardware is optimized for specific clause patterns (e.g., 3-SAT)
4. **Current Progress**: When software stalls (few unsatisfied clauses), hardware can be used for refinement

### Hybrid Solving Approach

1. **Initial Analysis**: Evaluate the problem to determine if hardware would be beneficial
2. **Pure Hardware Solution**: Try hardware first for suitable problems
3. **Hybrid Solution**: For complex problems, the solver may:
   - Start with software to reduce complexity
   - Periodically offload partial solutions to hardware
   - Resume software solving with improved assignments from hardware
   - Switch between approaches based on progress

### Simulated Hardware

The included simulated hardware accelerator:
- Models real hardware performance characteristics
- Applies speedup factors to estimate hardware execution time
- Simulates different success rates for different problem types
- Provides API-compatible interface for testing without actual hardware

## Setup Instructions

### Setting up the Web Interface

1. Install pnpm
```
# Follow instructions at https://pnpm.io/installation
```

2. Update pnpm
```
pnpm update
```

3. Run the website
```
# From the root directory:
cd dacroq_web && pnpm install && pnpm build && pnpm start

# Or if already in dacroq_web directory:
pnpm install && pnpm build && pnpm start
```

The web interface runs on port 3000 by default.

### Setting up the API Server

1. Install Golang
```
# Follow instructions at https://go.dev/doc/install
```

2. Build the API
```
go build
```

3. Start the API
```
go run main.go
```

The API runs on port 8080 by default.

## Usage

### API Endpoints

The system exposes several HTTP endpoints:

#### Problem Discovery Endpoints

##### GET /presets
Lists all available test presets.

**Response Example:**
```json
["uf20-91", "uf50-218", "uf75-325", "uf100-430", "uf125-538", "uf150-645", "uf175-753", "uf200-860", "uf225-960", "uf250-1065"]
```

##### GET /cnf-files
Lists all CNF files available in a specific preset.

**Parameters:**
- `preset` (string): The name of the preset to list files from.

**Response Example:**
```json
{
  "preset": "uf20-91",
  "files": ["uf20-01.cnf", "uf20-02.cnf", "..."]
}
```

##### GET /get-test-cnf
Retrieves the CNF content for a specific test by name or index.

**Parameters:**
- `preset` (string, required): The name of the preset containing the test.
- `test` (string, optional): The filename of the test (with or without .cnf extension).
- `index` (number, optional): The index of the test in the preset (alternative to using the test name).

**Note:** Either `test` or `index` must be provided.

**Response Example:**
```json
{
  "filename": "uf20-01.cnf",
  "preset": "uf20-91",
  "cnf": "c This is a sample CNF file\np cnf 20 91\n1 2 0\n..."
}
```

##### GET /max-tests
Returns the maximum number of tests allowed per request.

**Response Example:**
```json
{
  "max_tests": 50
}
```

#### Solver Endpoints

##### POST /daedalus
Solves a batch of SAT problems using the specified solver type.

**Parameters:**
```json
{
  "preset": "batch_name",
  "start_index": 0,
  "end_index": 10,
  "solver_type": "hybrid",
  "enable_hardware": true,
  "hardware_threshold": 10,
  "max_hardware_time": 10000,
  "include_cnf": true
}
```

- `preset` (string): The name of the test preset to use.
- `start_index` (number): The starting index of the tests to solve.
- `end_index` (number): The ending index of the tests to solve.
- `solver_type` (string): "software", "hardware", or "hybrid".
- `enable_hardware` (boolean): Whether to use hardware acceleration.
- `hardware_threshold` (number): Maximum unsatisfied clauses for hardware offload.
- `max_hardware_time` (number): Maximum hardware execution time (microseconds).
- `include_cnf` (boolean): Whether to include the original CNF content in the response.

**Response Example:**
```json
{
  "results": [
    {
      "filename": "uf20-01.cnf",
      "solved": true,
      "solution": "1 -2 3 -4 5 -6 7 -8 9 -10 11 -12 13 -14 15 -16 17 -18 19 -20 0",
      "computation_time": 1523.45,
      "solver_used": "hybrid",
      "hardware_utilized": true,
      "total_clause_size": 91,
      "max_clause_size": 3,
      "min_clause_size": 3,
      "avg_clause_size": 3.0,
      "cnf": "c This is a sample CNF file\np cnf 20 91\n1 2 0\n..." // Only included when include_cnf is true
    },
    // More results...
  ]
}
```

#### Hardware Information Endpoints

##### GET /hardware-capabilities
Returns information about the available hardware accelerator.

**Response Example:**
```json
{
  "available": true,
  "max_variables": 1000,
  "max_clauses": 10000,
  "speed_factors": {
    "small": 100.0,
    "medium": 50.0,
    "large": 10.0
  },
  "success_rates": {
    "easy": 0.99,
    "medium": 0.85,
    "hard": 0.60
  },
  "power_consumption": {
    "idle": 0.5,
    "active": 25.0,
    "units": "watts"
  }
}
```

### Programmatic Usage

```go
import "dacroq/walksat"

// Parse DIMACS file
formula, _ := walksat.ParseDIMACS("problem.cnf")

// Initialize hardware
hardware := walksat.NewSimulatedAccelerator()

// Configure hybrid solver
config := walksat.DefaultHybridConfig()
config.MaxSoftwareSteps = 50000
config.MaxHardwareTime = 5000
config.UnsatThreshold = 5

// Solve using hybrid approach
result, _ := walksat.HybridSolve(formula, hardware, config)

// Check result
if result.SolutionFound {
    fmt.Println("Solution:", result.SolutionString)
    fmt.Printf("Time: %.2f μs\n", result.ComputationTime)
} else {
    fmt.Println("No solution found")
}
```

## Performance

The hybrid approach offers several advantages:

1. **Speed**: Hardware acceleration can be orders of magnitude faster for suitable problems
2. **Energy Efficiency**: Hardware often uses significantly less energy than software
3. **Flexibility**: Can handle a wider range of problems than either approach alone
4. **Adaptability**: Makes intelligent decisions based on problem characteristics

Benchmark results vary by problem type, but the hybrid approach generally shows the most consistent performance across problem classes.

## Running Tests

To run tests for the hybrid solver:

```
cd api
go test ./walksat -v
```

To run benchmarks:

```
cd api
go test ./walksat -bench=. -benchmem
```

## Future Work

1. Integration with actual hardware accelerators
2. Improved decision-making heuristics based on machine learning
3. Support for more SAT problem types and specialized encodings
4. Distributed solving across multiple hardware accelerators
