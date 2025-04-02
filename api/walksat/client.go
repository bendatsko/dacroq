package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

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

// SolveResult stores the result of a WalkSAT solve.
// Note the new OriginalCNF field.
type SolveResult struct {
	Filename        string  `json:"filename"`
	SolutionFound   bool    `json:"solution_found"`
	SolutionString  string  `json:"solution_string"`
	SolutionCount   int     `json:"solution_count"`
	ComputationTime float64 `json:"computation_time_us"` // in microseconds
	Restarts        int     `json:"restarts"`
	TotalSteps      int     `json:"total_steps"`
	OriginalCNF     string  `json:"original_cnf"` // New field with original CNF text
}

// BatchSummary holds summary statistics for a batch of tests
type BatchSummary struct {
	TotalFiles    int     `json:"total_files"`
	SolvedCount   int     `json:"solved_count"`
	AverageTime   float64 `json:"average_time_us"`
	TotalRestarts int     `json:"total_restarts"`
	TotalSteps    int     `json:"total_steps"`
}

// BatchResults holds the entire batch results along with a timestamp and summary
type BatchResults struct {
	Timestamp string         `json:"timestamp"`
	Results   []*SolveResult `json:"results"`
	Summary   BatchSummary   `json:"summary"`
}

// ParseDIMACS parses a DIMACS CNF file into a Formula.
func ParseDIMACS(filename string) (*Formula, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	formula := &Formula{
		Clauses:      []Clause{},
		VarToClauses: make(map[int][]ClauseInfo),
	}
	var currentClause Clause
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) == 0 {
			continue
		}
		if line[0] == 'c' {
			continue
		}
		if line[0] == 'p' {
			parts := strings.Fields(line)
			if len(parts) != 4 || parts[1] != "cnf" {
				return nil, fmt.Errorf("invalid problem line: %s", line)
			}
			numVars, err := strconv.Atoi(parts[2])
			if err != nil {
				return nil, fmt.Errorf("invalid number of variables: %s", parts[2])
			}
			numClauses, err := strconv.Atoi(parts[3])
			if err != nil {
				return nil, fmt.Errorf("invalid number of clauses: %s", parts[3])
			}
			formula.NumVars = numVars
			formula.NumClauses = numClauses
			formula.Clauses = make([]Clause, 0, numClauses)
			continue
		}
		tokens := strings.Fields(line)
		for _, token := range tokens {
			literalValue, err := strconv.Atoi(token)
			if err != nil {
				return nil, fmt.Errorf("invalid literal: %s", token)
			}
			// End of clause
			if literalValue == 0 {
				if len(currentClause) > 0 {
					formula.Clauses = append(formula.Clauses, currentClause)
					currentClause = nil
				}
				continue
			}
			// New clause
			if currentClause == nil {
				currentClause = make(Clause, 0)
			}
			var lit Literal
			if literalValue > 0 {
				lit = Literal{Var: literalValue - 1, Sign: false} // 0-based indexing
			} else {
				lit = Literal{Var: -literalValue - 1, Sign: true}
			}
			currentClause = append(currentClause, lit)
		}
	}
	if len(currentClause) > 0 {
		formula.Clauses = append(formula.Clauses, currentClause)
	}
	// Build var-to-clauses map.
	for clauseIdx, clause := range formula.Clauses {
		for _, lit := range clause {
			formula.VarToClauses[lit.Var] = append(formula.VarToClauses[lit.Var],
				ClauseInfo{Index: clauseIdx, Sign: lit.Sign})
		}
	}
	return formula, nil
}

// WalkSAT implements the WalkSAT algorithm.
func WalkSAT(formula *Formula, maxSteps int, probability float64) ([]bool, int, int) {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	assignment := make([]bool, formula.NumVars)
	for i := range assignment {
		assignment[i] = rng.Intn(2) == 1
	}
	unsatClauses := []int{}
	for i, clause := range formula.Clauses {
		if !isSatisfied(clause, assignment) {
			unsatClauses = append(unsatClauses, i)
		}
	}
	numRestarts := 0
	totalSteps := 0
	for step := 0; step < maxSteps; step++ {
		totalSteps++
		if len(unsatClauses) == 0 {
			return assignment, numRestarts, totalSteps
		}
		clauseIdx := unsatClauses[rng.Intn(len(unsatClauses))]
		clause := formula.Clauses[clauseIdx]
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
		if probability > 0 && rng.Float64() < probability && minBreaks > 0 {
			bestVar = clause[rng.Intn(len(clause))].Var
		} else {
			bestVar = bestVars[rng.Intn(len(bestVars))]
		}
		assignment[bestVar] = !assignment[bestVar]
		unsatClauses = []int{}
		for i, cl := range formula.Clauses {
			if !isSatisfied(cl, assignment) {
				unsatClauses = append(unsatClauses, i)
			}
		}
		if step > 0 && step%10000 == 0 && len(unsatClauses) > 0 {
			numRestarts++
			for i := range assignment {
				assignment[i] = rng.Intn(2) == 1
			}
			unsatClauses = []int{}
			for i, cl := range formula.Clauses {
				if !isSatisfied(cl, assignment) {
					unsatClauses = append(unsatClauses, i)
				}
			}
		}
	}
	return assignment, numRestarts, totalSteps
}

// isSatisfied checks if a clause is satisfied.
func isSatisfied(clause Clause, assignment []bool) bool {
	for _, lit := range clause {
		if assignment[lit.Var] != lit.Sign {
			return true
		}
	}
	return false
}

// wouldBreak checks if flipping a variable would break the clause.
func wouldBreak(clause Clause, assignment []bool, varToFlip int) bool {
	satCount := 0
	criticalVar := -1
	for _, lit := range clause {
		if assignment[lit.Var] != lit.Sign {
			satCount++
			criticalVar = lit.Var
		}
	}
	return satCount == 1 && criticalVar == varToFlip
}

// SolveCNFFile solves a single CNF file using WalkSAT and also reads the original CNF text.
func SolveCNFFile(cnfPath string) (*SolveResult, error) {
	formula, err := ParseDIMACS(cnfPath)
	if err != nil {
		return nil, err
	}
	maxSteps := 100000
	probability := 0.5
	startTime := time.Now()
	assignment, restarts, steps := WalkSAT(formula, maxSteps, probability)
	duration := time.Since(startTime)
	var solutionString strings.Builder
	for _, val := range assignment {
		if val {
			solutionString.WriteRune('1')
		} else {
			solutionString.WriteRune('0')
		}
	}
	solutionFound := true
	for _, clause := range formula.Clauses {
		if !isSatisfied(clause, assignment) {
			solutionFound = false
			break
		}
	}
	// Read the original CNF file contents.
	originalData, err := os.ReadFile(cnfPath)
	originalCNF := ""
	if err == nil {
		originalCNF = string(originalData)
	}
	return &SolveResult{
		Filename:        filepath.Base(cnfPath),
		SolutionFound:   solutionFound,
		SolutionString:  solutionString.String(),
		SolutionCount:   1,
		ComputationTime: float64(duration.Microseconds()),
		Restarts:        restarts,
		TotalSteps:      steps,
		OriginalCNF:     originalCNF,
	}, nil
}

// CreateExampleFiles creates example CNF files for testing.
func CreateExampleFiles() error {
	cnf1 := `c Example SAT problem 000.cnf
c 3 variables, 5 clauses
p cnf 3 5
1 2 0
-1 -2 0
2 3 0
-2 -3 0
1 3 0
`
	cnf2 := `c Example SAT problem 001.cnf
c 4 variables, 8 clauses 
p cnf 4 8
1 2 3 0
-1 -2 3 0
1 -3 4 0
-1 3 -4 0
-2 -3 -4 0
2 3 4 0
1 -2 -3 0
-1 2 -4 0
`
	if err := os.MkdirAll("problems", 0755); err != nil {
		return fmt.Errorf("failed to create problems directory: %v", err)
	}
	if err := os.WriteFile("problems/000.cnf", []byte(cnf1), 0644); err != nil {
		return fmt.Errorf("failed to write 000.cnf: %v", err)
	}
	if err := os.WriteFile("problems/001.cnf", []byte(cnf2), 0644); err != nil {
		return fmt.Errorf("failed to write 001.cnf: %v", err)
	}
	return nil
}

// PrintResults prints the WalkSAT results.
func PrintResults(results []*SolveResult) {
	if len(results) == 0 {
		fmt.Println("No results to display")
		return
	}
	fmt.Println("\n--- WalkSAT Results ---")
	fmt.Println(strings.Repeat("-", 70))
	fmt.Printf("%-12s %-7s %-20s %-12s %-10s\n",
		"File", "Solved", "Solution", "Time (μs)", "Restarts")
	fmt.Println(strings.Repeat("-", 70))
	for _, result := range results {
		solution := result.SolutionString
		if len(solution) > 20 {
			solution = solution[:17] + "..."
		}
		fmt.Printf("%-12s %-7t %-20s %-12.2f %-10d\n",
			result.Filename,
			result.SolutionFound,
			solution,
			result.ComputationTime,
			result.Restarts)
	}
	fmt.Println(strings.Repeat("-", 70))
}

// PrintDIMACSSolutions prints the solution in DIMACS format.
func PrintDIMACSSolutions(results []*SolveResult) {
	fmt.Println("\n--- DIMACS Solutions ---")
	for _, result := range results {
		var dimacsSolution strings.Builder
		dimacsSolution.WriteString("v ")
		for i, ch := range result.SolutionString {
			if ch == '1' {
				dimacsSolution.WriteString(fmt.Sprintf("%d ", i+1))
			} else {
				dimacsSolution.WriteString(fmt.Sprintf("-%d ", i+1))
			}
		}
		dimacsSolution.WriteString("0")
		fmt.Printf("%s: %s\n", result.Filename, dimacsSolution.String())
	}
}

// WriteBatchResults computes summary statistics and writes all results to recent.json.
func WriteBatchResults(results []*SolveResult) error {
	totalFiles := len(results)
	solvedCount := 0
	totalTime := 0.0
	totalRestarts := 0
	totalSteps := 0
	for _, res := range results {
		if res.SolutionFound {
			solvedCount++
		}
		totalTime += res.ComputationTime
		totalRestarts += res.Restarts
		totalSteps += res.TotalSteps
	}
	averageTime := 0.0
	if totalFiles > 0 {
		averageTime = totalTime / float64(totalFiles)
	}
	summary := BatchSummary{
		TotalFiles:    totalFiles,
		SolvedCount:   solvedCount,
		AverageTime:   averageTime,
		TotalRestarts: totalRestarts,
		TotalSteps:    totalSteps,
	}
	batchResults := BatchResults{
		Timestamp: time.Now().Format(time.RFC3339),
		Results:   results,
		Summary:   summary,
	}
	data, err := json.MarshalIndent(batchResults, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal batch results: %v", err)
	}
	err = os.WriteFile("recent.json", data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write recent.json: %v", err)
	}
	fmt.Println("Batch results successfully written to recent.json")
	return nil
}

func main() {
	fmt.Println("WalkSAT Solver Client (Native Go Implementation)")
	fmt.Println(strings.Repeat("=", 60))
	// Create example files if needed.
	if _, err := os.Stat("problems"); os.IsNotExist(err) {
		fmt.Println("Creating example CNF files...")
		if err := CreateExampleFiles(); err != nil {
			log.Fatalf("Failed to create example files: %v", err)
		}
		fmt.Println("Example files created in problems directory")
	}
	// Get all CNF files.
	files, err := filepath.Glob("problems/*.cnf")
	if err != nil {
		log.Fatalf("Error finding CNF files: %v", err)
	}
	if len(files) == 0 {
		log.Fatalf("No CNF files found in problems directory")
	}
	fmt.Printf("Found %d CNF files to process\n", len(files))
	var results []*SolveResult
	for _, file := range files {
		fmt.Printf("\nSolving %s...\n", file)
		result, err := SolveCNFFile(file)
		if err != nil {
			fmt.Printf("Error solving %s: %v\n", file, err)
			continue
		}
		results = append(results, result)
	}
	PrintResults(results)
	PrintDIMACSSolutions(results)
	if err := WriteBatchResults(results); err != nil {
		fmt.Printf("Error writing batch results: %v\n", err)
	}
}
