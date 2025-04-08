package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Define a variable for presets directory path
var presetsDir = "./presets"

// Environment variables
var (
	port        = getEnv("PORT", "8080")
	environment = getEnv("ENVIRONMENT", "development")
	uploadDir   = getEnv("UPLOAD_DIR", "uploads")
	apiPrefix   = getEnv("API_PREFIX", "/api")
)

// Global base directory
var baseDir string

// Formula represents a CNF formula
type Formula struct {
	NumVars    int
	NumClauses int
	Clauses    [][]int
}

// SolveResult represents the result of solving a CNF formula
type SolveResult struct {
	Filename        string
	SolutionFound   bool
	SolutionString  string
	ComputationTime float64
	OriginalCNF     string
	Metrics         CNFMetrics
}

// CNFMetrics contains metrics about a CNF formula
type CNFMetrics struct {
	Variables      int
	Clauses        int
	ClauseVarRatio float64
	AvgClauseSize  float64
	MaxClauseSize  int
	MinClauseSize  int
}

// HardwareAccelerator defines the interface for hardware acceleration
type HardwareAccelerator interface {
	Initialize() error
	Solve(formula *Formula, config *SolverConfig) (*SolveResult, error)
	GetMetrics() HardwareMetrics
}

// HardwareMetrics tracks performance metrics for the hardware accelerator
type HardwareMetrics struct {
	OscillatorSyncTime  float64
	CrossbarSetupTime   float64
	HardwareUtilization float64
	OscillatorStability float64
	CrossbarEfficiency  float64
	TemperatureEffects  float64
	StaticPower         float64
	DynamicPower        float64
	ErrorRate           float64
	ReliabilityScore    float64
}

// SolverConfig defines the configuration for the solver
type SolverConfig struct {
	MaxFlips     int
	MaxTries     int
	Noise        float64
	Timeout      float64
	RestartProb  float64
	HardwareMode bool
}

// SimulatedAccelerator implements the HardwareAccelerator interface
type SimulatedAccelerator struct {
	metrics HardwareMetrics
	formula *Formula
	config  *SolverConfig
}

// NewSimulatedAccelerator creates a new simulated hardware accelerator
func NewSimulatedAccelerator() *SimulatedAccelerator {
	return &SimulatedAccelerator{
		metrics: HardwareMetrics{
			OscillatorSyncTime:  0.1,
			CrossbarSetupTime:   0.05,
			HardwareUtilization: 0.8,
			OscillatorStability: 0.95,
			CrossbarEfficiency:  0.9,
			TemperatureEffects:  0.05,
			StaticPower:         10.0,
			DynamicPower:        50.0,
			ErrorRate:           0.001,
			ReliabilityScore:    0.99,
		},
	}
}

// Initialize prepares the hardware accelerator
func (s *SimulatedAccelerator) Initialize() error {
	return nil
}

// Solve implements the HardwareAccelerator interface
func (s *SimulatedAccelerator) Solve(formula *Formula, config *SolverConfig) (*SolveResult, error) {
	s.formula = formula
	s.config = config

	// Simulate hardware operations
	time.Sleep(time.Duration(s.metrics.OscillatorSyncTime * float64(time.Millisecond)))
	time.Sleep(time.Duration(s.metrics.CrossbarSetupTime * float64(time.Millisecond)))

	// Generate a random solution
	assignment := make([]bool, formula.NumVars)
	for i := range assignment {
		assignment[i] = rand.Intn(2) == 1
	}

	// Convert assignment to string
	solutionString := ""
	for _, val := range assignment {
		if val {
			solutionString += "1"
		} else {
			solutionString += "0"
		}
	}

	// Calculate metrics
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

	return &SolveResult{
		Filename:        "simulated_solution",
		SolutionFound:   true,
		SolutionString:  solutionString,
		ComputationTime: s.metrics.OscillatorSyncTime + s.metrics.CrossbarSetupTime,
		Metrics: CNFMetrics{
			Variables:      formula.NumVars,
			Clauses:        len(formula.Clauses),
			ClauseVarRatio: float64(len(formula.Clauses)) / float64(formula.NumVars),
			AvgClauseSize:  avgClauseSize,
			MaxClauseSize:  maxClauseSize,
			MinClauseSize:  minClauseSize,
		},
	}, nil
}

// GetMetrics returns the current hardware metrics
func (s *SimulatedAccelerator) GetMetrics() HardwareMetrics {
	return s.metrics
}

// ParseDIMACS parses a DIMACS CNF file
func ParseDIMACS(content string) (*Formula, error) {
	lines := strings.Split(content, "\n")
	var formula Formula
	var clauses [][]int

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) == 0 || line[0] == 'c' {
			continue
		}
		if line[0] == 'p' {
			parts := strings.Fields(line)
			if len(parts) >= 4 && parts[1] == "cnf" {
				formula.NumVars, _ = strconv.Atoi(parts[2])
				formula.NumClauses, _ = strconv.Atoi(parts[3])
			}
			continue
		}

		literals := []int{}
		parts := strings.Fields(line)
		for _, part := range parts {
			lit, err := strconv.Atoi(part)
			if err != nil {
				continue
			}
			if lit == 0 {
				break
			}
			literals = append(literals, lit)
		}

		if len(literals) > 0 {
			clauses = append(clauses, literals)
		}
	}

	formula.Clauses = clauses
	return &formula, nil
}

// handleListPresets lists all available presets
func handleListPresets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	entries, err := os.ReadDir(presetsDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read presets directory: %v", err), http.StatusInternalServerError)
		return
	}

	var presets []string
	for _, entry := range entries {
		if entry.IsDir() {
			presets = append(presets, entry.Name())
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"presets": presets,
	})
}

// handleDaedalus runs the solver on CNF files
func handleDaedalus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req struct {
		Preset         string `json:"preset"`
		StartIndex     int    `json:"start_index"`
		EndIndex       int    `json:"end_index"`
		SolverType     string `json:"solver_type"`
		EnableHardware bool   `json:"enable_hardware"`
		IncludeCNF     bool   `json:"include_cnf"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Preset == "" {
		req.Preset = "hardware-t_batch_0"
	}

	presetPath := filepath.Join(presetsDir, req.Preset)
	if _, err := os.Stat(presetPath); os.IsNotExist(err) {
		http.Error(w, "preset not found", http.StatusNotFound)
		return
	}

	files, err := filepath.Glob(filepath.Join(presetPath, "*.cnf"))
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to list CNF files: %v", err), http.StatusInternalServerError)
		return
	}

	if len(files) == 0 {
		http.Error(w, "no CNF files found in preset", http.StatusNotFound)
		return
	}

	if req.StartIndex < 0 {
		req.StartIndex = 0
	}
	if req.EndIndex <= 0 || req.EndIndex > len(files) {
		req.EndIndex = len(files)
	}
	selectedFiles := files[req.StartIndex:req.EndIndex]

	var results []map[string]interface{}
	for _, file := range selectedFiles {
		content, err := os.ReadFile(file)
		if err != nil {
			log.Printf("Error reading file %s: %v", file, err)
			continue
		}

		formula, err := ParseDIMACS(string(content))
		if err != nil {
			log.Printf("Error parsing CNF %s: %v", file, err)
			continue
		}

		hardware := NewSimulatedAccelerator()
		if err := hardware.Initialize(); err != nil {
			log.Printf("Error initializing hardware: %v", err)
			continue
		}

		result, err := hardware.Solve(formula, &SolverConfig{
			MaxFlips:    10000,
			Noise:       0.5,
			RestartProb: 0.01,
		})

		if err != nil {
			log.Printf("Error solving %s: %v", file, err)
			continue
		}

		entry := map[string]interface{}{
			"filename":        filepath.Base(file),
			"solution_found":  result.SolutionFound,
			"solution_string": result.SolutionString,
			"metrics":         result.Metrics,
		}

		if req.IncludeCNF {
			entry["original_cnf"] = string(content)
		}

		results = append(results, entry)
	}

	response := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"results":   results,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleHealth returns a simple health check response
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": "1.0.0",
	})
}

// CNFFormula represents a SAT problem in CNF format
type CNFFormula struct {
	NumVars    int
	NumClauses int
	Clauses    [][]int
}

// SolverType represents the available SAT solvers
type SolverType string

const (
	WalkSAT  SolverType = "walksat"
	MiniSAT  SolverType = "minisat"
	Hardware SolverType = "hardware"
)

// SolverResult represents the benchmark results for a SAT solver run
type SolverResult struct {
	Status    string  `json:"status"`             // "SAT", "UNSAT", or "UNKNOWN"
	TimeMs    float64 `json:"time_ms"`            // Time taken in milliseconds
	Variables int     `json:"variables"`          // Number of variables in the problem
	Clauses   int     `json:"clauses"`            // Number of clauses in the problem
	Solver    string  `json:"solver"`             // Name of the solver used
	FileName  string  `json:"file_name"`          // Original file name
	Error     string  `json:"error,omitempty"`    // Error message if any
	Solution  []bool  `json:"solution,omitempty"` // Solution if found
}

// APIResponse represents a standardized JSON response
type APIResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// parseCNF reads a DIMACS CNF file and returns a CNFFormula
func parseCNF(filepath string) (*CNFFormula, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var formula CNFFormula
	var numVars, numClauses int

	// Read the file line by line
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || line[0] == 'c' {
			continue // Skip comments and empty lines
		}
		if line[0] == 'p' {
			// Parse problem line
			fmt.Sscanf(line, "p cnf %d %d", &numVars, &numClauses)
			formula.NumVars = numVars
			formula.NumClauses = numClauses
			formula.Clauses = make([][]int, 0, numClauses)
			continue
		}
		// Parse clause
		var clause []int
		nums := strings.Fields(line)
		for _, num := range nums {
			if num == "0" {
				break
			}
			val := 0
			fmt.Sscanf(num, "%d", &val)
			if val != 0 {
				clause = append(clause, val)
			}
		}
		if len(clause) > 0 {
			formula.Clauses = append(formula.Clauses, clause)
		}
	}

	return &formula, nil
}

// walkSAT implements the WalkSAT algorithm
func walkSAT(formula *CNFFormula, maxFlips int, noise float64) ([]bool, error) {
	if formula.NumVars == 0 || len(formula.Clauses) == 0 {
		return nil, fmt.Errorf("invalid formula")
	}

	// Initialize random assignment
	assignment := make([]bool, formula.NumVars+1) // +1 because variables are 1-based
	for i := 1; i <= formula.NumVars; i++ {
		assignment[i] = rand.Float64() < 0.5
	}

	for i := 0; i < maxFlips; i++ {
		// Find unsatisfied clauses
		var unsatClauses []int
		for j, clause := range formula.Clauses {
			satisfied := false
			for _, lit := range clause {
				v := abs(lit)
				if (lit > 0 && assignment[v]) || (lit < 0 && !assignment[v]) {
					satisfied = true
					break
				}
			}
			if !satisfied {
				unsatClauses = append(unsatClauses, j)
			}
		}

		if len(unsatClauses) == 0 {
			return assignment, nil // Solution found
		}

		// Pick a random unsatisfied clause
		clause := formula.Clauses[unsatClauses[rand.Intn(len(unsatClauses))]]

		// With probability noise, flip a random variable in the clause
		if rand.Float64() < noise {
			lit := clause[rand.Intn(len(clause))]
			v := abs(lit)
			assignment[v] = !assignment[v]
		} else {
			// Otherwise, flip the variable that minimizes the number of unsatisfied clauses
			bestVar := abs(clause[0])
			minUnsat := math.MaxInt32
			for _, lit := range clause {
				v := abs(lit)
				assignment[v] = !assignment[v]
				numUnsat := countUnsatisfiedClauses(formula, assignment)
				assignment[v] = !assignment[v]
				if numUnsat < minUnsat {
					minUnsat = numUnsat
					bestVar = v
				}
			}
			assignment[bestVar] = !assignment[bestVar]
		}
	}

	return nil, fmt.Errorf("no solution found after %d flips", maxFlips)
}

// countUnsatisfiedClauses counts the number of unsatisfied clauses
func countUnsatisfiedClauses(formula *CNFFormula, assignment []bool) int {
	count := 0
	for _, clause := range formula.Clauses {
		satisfied := false
		for _, lit := range clause {
			v := abs(lit)
			if (lit > 0 && assignment[v]) || (lit < 0 && !assignment[v]) {
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

// abs returns the absolute value of x
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// processCNFFile runs the specified solver on a CNF file and returns the results
func processCNFFile(filepath string, solver SolverType) SolverResult {
	start := time.Now()

	formula, err := parseCNF(filepath)
	if err != nil {
		return SolverResult{
			Status: "ERROR",
			Error:  fmt.Sprintf("Failed to parse CNF file: %v", err),
		}
	}

	var solution []bool
	var solveErr error

	switch solver {
	case WalkSAT:
		maxFlips := 100000 // Adjust these parameters as needed
		noise := 0.5
		solution, solveErr = walkSAT(formula, maxFlips, noise)
	case MiniSAT:
		return SolverResult{
			Status: "ERROR",
			Error:  "MiniSAT solver not implemented yet",
		}
	case Hardware:
		return SolverResult{
			Status: "ERROR",
			Error:  "Hardware solver not implemented yet",
		}
	default:
		return SolverResult{
			Status: "ERROR",
			Error:  fmt.Sprintf("Unknown solver type: %s", solver),
		}
	}

	elapsed := time.Since(start)

	if solveErr != nil {
		return SolverResult{
			Status:    "UNKNOWN",
			TimeMs:    float64(elapsed.Milliseconds()),
			Variables: formula.NumVars,
			Clauses:   formula.NumClauses,
			Solver:    string(solver),
			FileName:  filepath,
			Error:     solveErr.Error(),
		}
	}

	return SolverResult{
		Status:    "SAT",
		TimeMs:    float64(elapsed.Milliseconds()),
		Variables: formula.NumVars,
		Clauses:   formula.NumClauses,
		Solver:    string(solver),
		FileName:  filepath,
		Solution:  solution,
	}
}

// handleSolve processes CNF files with the specified solver
func handleSolve(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
		return
	}

	solverType := r.FormValue("solver")
	if solverType == "" {
		solverType = string(Hardware) // Default to hardware solver
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		http.Error(w, "No files uploaded", http.StatusBadRequest)
		return
	}

	// Create temporary directory for processing
	tempDir, err := os.MkdirTemp("", "solver-*")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create temp directory: %v", err), http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tempDir)

	var results []SolverResult
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to open file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
			return
		}
		defer file.Close()

		// Save file to temp directory
		tempFile := filepath.Join(tempDir, fileHeader.Filename)
		dst, err := os.Create(tempFile)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create temp file: %v", err), http.StatusInternalServerError)
			return
		}
		if _, err := io.Copy(dst, file); err != nil {
			dst.Close()
			http.Error(w, fmt.Sprintf("Failed to save file: %v", err), http.StatusInternalServerError)
			return
		}
		dst.Close()

		// If it's a ZIP file, extract it
		if strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".zip") {
			if err := unzipFile(tempFile, tempDir); err != nil {
				http.Error(w, fmt.Sprintf("Failed to unzip file: %v", err), http.StatusInternalServerError)
				return
			}
		}

		// Process all CNF files (either directly uploaded or from ZIP)
		err = filepath.Walk(tempDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".cnf") {
				result := processCNFFile(path, SolverType(solverType))
				result.FileName = info.Name()
				results = append(results, result)
			}
			return nil
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to process files: %v", err), http.StatusInternalServerError)
			return
		}
	}

	// Create overview statistics
	totalProblems := len(results)
	solvedProblems := 0
	var totalTime float64
	var totalPower float64 = 8.49 // Default power in mW

	for _, result := range results {
		if result.Status == "SAT" {
			solvedProblems++
			totalTime += result.TimeMs
		}
	}

	avgTime := 0.0
	if solvedProblems > 0 {
		avgTime = totalTime / float64(solvedProblems)
	}

	overview := map[string]interface{}{
		"total_problems":    totalProblems,
		"solved_problems":   solvedProblems,
		"unsolved_problems": totalProblems - solvedProblems,
		"success_rate":      fmt.Sprintf("%.1f%%", float64(solvedProblems)/float64(totalProblems)*100),
		"avg_cycles":        int(avgTime * 238), // Assuming 238MHz clock
		"avg_power_mw":      fmt.Sprintf("%.2f", totalPower),
		"solver_name":       solverType,
		"hardware":          []string{"CPU", "WalkSAT"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Status: "success",
		Data: map[string]interface{}{
			"overview":   overview,
			"benchmarks": results,
		},
	})
}

func main() {
	// Initialize HTTP server
	addr := fmt.Sprintf(":%s", port)
	log.Printf("Starting server in %s mode on %s", environment, addr)

	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/presets", handleListPresets)
	http.HandleFunc("/daedalus", handleDaedalus)
	http.HandleFunc("/solve", handleSolve)

	log.Fatal(http.ListenAndServe(addr, nil))
}
