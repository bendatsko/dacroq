package walksat

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Literal represents a variable with a sign (true = negated, false = positive).
type Literal struct {
	Var  int
	Sign bool
}

// Clause represents a disjunction of literals.
type Clause []Literal

// Formula represents a CNF formula.
type Formula struct {
	Clauses      []Clause
	NumVars      int
	NumClauses   int
	VarToClauses map[int][]ClauseInfo
}

// ClauseInfo stores clause index and the sign of the variable in that clause.
type ClauseInfo struct {
	Index int
	Sign  bool
}

// CNFMetrics stores the metrics of a CNF file.
type CNFMetrics struct {
	Variables      int     `json:"variables"`
	Clauses        int     `json:"clauses"`
	ClauseVarRatio float64 `json:"clause_var_ratio"`
	AvgClauseSize  float64 `json:"avg_clause_size"`
	MaxClauseSize  int     `json:"max_clause_size"`
	MinClauseSize  int     `json:"min_clause_size"`
}

// SolveResult stores the result of a WalkSAT solve.
type SolveResult struct {
	Filename        string     `json:"filename"`
	Metrics         CNFMetrics `json:"metrics"`
	SolutionFound   bool       `json:"solution_found"`
	SolutionString  string     `json:"solution_string"`
	SolutionCount   int        `json:"solution_count"`
	ComputationTime float64    `json:"computation_time_us"` // in microseconds
	Restarts        int        `json:"restarts"`
	TotalSteps      int        `json:"total_steps"`
	OriginalCNF     string     `json:"original_cnf"`
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
			if literalValue == 0 {
				if len(currentClause) > 0 {
					formula.Clauses = append(formula.Clauses, currentClause)
					currentClause = nil
				}
				continue
			}
			if currentClause == nil {
				currentClause = make(Clause, 0)
			}
			var lit Literal
			if literalValue > 0 {
				lit = Literal{Var: literalValue - 1, Sign: false}
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

// isSatisfied checks if a clause is satisfied by a given assignment.
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
		clauseIdx := unsatClauses[rand.Intn(len(unsatClauses))]
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
		if probability > 0 && rand.Float64() < probability && minBreaks > 0 {
			bestVar = clause[rand.Intn(len(clause))].Var
		} else {
			bestVar = bestVars[rand.Intn(len(bestVars))]
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
				assignment[i] = rand.Intn(2) == 1
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

// SolveCNFFile solves a single CNF file using WalkSAT and returns the result.
func SolveCNFFile(cnfPath string) (*SolveResult, error) {
	formula, err := ParseDIMACS(cnfPath)
	if err != nil {
		return nil, err
	}

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

	metrics := CNFMetrics{
		Variables:      formula.NumVars,
		Clauses:        formula.NumClauses,
		ClauseVarRatio: float64(formula.NumClauses) / float64(formula.NumVars),
		AvgClauseSize:  avgClauseSize,
		MaxClauseSize:  maxClauseSize,
		MinClauseSize:  minClauseSize,
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

	originalData, err := os.ReadFile(cnfPath)
	originalCNF := ""
	if err == nil {
		originalCNF = string(originalData)
	}

	result := &SolveResult{
		Filename:        filepath.Base(cnfPath),
		Metrics:         metrics,
		SolutionFound:   solutionFound,
		SolutionString:  solutionString.String(),
		SolutionCount:   1,
		ComputationTime: float64(duration.Microseconds()),
		Restarts:        restarts,
		TotalSteps:      steps,
		OriginalCNF:     originalCNF,
	}
	return result, nil
}
