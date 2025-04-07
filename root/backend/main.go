package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"dacroq/walksat"
)

// Define a variable for presets directory path to allow overriding in tests
var presetsDir = "./presets"

// BenchmarkEntry defines the JSON schema matching our CSV conversion output.
type BenchmarkEntry struct {
	Solver                 string                 `json:"solver"`
	SolverParameters       map[string]interface{} `json:"solver_parameters"`
	Hardware               []string               `json:"hardware"`
	Set                    string                 `json:"set"`
	InstanceIdx            int                    `json:"instance_idx"`
	CutoffType             string                 `json:"cutoff_type"`
	Cutoff                 string                 `json:"cutoff"`
	RunsAttempted          int                    `json:"runs_attempted"`
	RunsSolved             int                    `json:"runs_solved"`
	NUnsatClauses          []int                  `json:"n_unsat_clauses"`
	UnsatisfiedClauses     map[string][]int       `json:"unsatisfied_clauses,omitempty"` // Maps run index to unsatisfied clause indices
	UnsatRatios            []float64              `json:"unsat_ratios,omitempty"`        // Ratio of unsatisfied clauses
	Configurations         [][]int                `json:"configurations"`
	PreRuntimeSeconds      string                 `json:"pre_runtime_seconds"`
	PreHardwareTimeSeconds string                 `json:"pre_hardware_time_seconds"`
	PreCpuTimeSeconds      string                 `json:"pre_cpu_time_seconds"`
	PreCpuEnergyJoules     string                 `json:"pre_cpu_energy_joules"`
	PreEnergyJoules        string                 `json:"pre_energy_joules"`
	HardwareTimeSeconds    []string               `json:"hardware_time_seconds"`
	CpuTimeSeconds         []string               `json:"cpu_time_seconds"`
	CpuEnergyJoules        []string               `json:"cpu_energy_joules"`
	HardwareEnergyJoules   []string               `json:"hardware_energy_joules"`
	HardwareCalls          []int                  `json:"hardware_calls"`
	SolverIterations       []int                  `json:"solver_iterations"`
	BatchStatistics        map[string]interface{} `json:"batch_statistics"`
	Metadata               map[string]interface{} `json:"metadata"`
	// New fields for enhanced metrics
	PerformanceMetrics struct {
		SuccessRate        float64   `json:"success_rate"`
		SolutionCount      int       `json:"solution_count"`
		AverageRuntime     float64   `json:"average_runtime"`
		RuntimeStdDev      float64   `json:"runtime_std_dev"`
		MinRuntime         float64   `json:"min_runtime"`
		MaxRuntime         float64   `json:"max_runtime"`
		MedianRuntime      float64   `json:"median_runtime"`
		RuntimePercentiles []float64 `json:"runtime_percentiles"`
	} `json:"performance_metrics"`
	ResourceUsage struct {
		CpuUsage    []float64 `json:"cpu_usage"`
		MemoryUsage []float64 `json:"memory_usage"`
		GpuUsage    []float64 `json:"gpu_usage"`
		DiskIO      []float64 `json:"disk_io"`
		NetworkIO   []float64 `json:"network_io"`
	} `json:"resource_usage"`
	PowerUsage struct {
		Median      float64 `json:"median"`
		Mean        float64 `json:"mean"`
		StdDev      float64 `json:"std_dev"`
		Min         float64 `json:"min"`
		Max         float64 `json:"max"`
		TotalEnergy float64 `json:"total_energy"`
	} `json:"power_usage"`
	SystemInfo struct {
		OsVersion    string `json:"os_version"`
		CpuModel     string `json:"cpu_model"`
		CpuCores     int    `json:"cpu_cores"`
		MemoryTotal  int64  `json:"memory_total"`
		GpuModel     string `json:"gpu_model"`
		GpuMemory    int64  `json:"gpu_memory"`
		DiskSpace    int64  `json:"disk_space"`
		NetworkSpeed int64  `json:"network_speed"`
	} `json:"system_info"`
	InputFiles  []string `json:"input_files"`
	OutputFiles []string `json:"output_files"`
	QuiccConfig string   `json:"quicc_config"`
	OriginalCNF string   `json:"original_cnf,omitempty"`
}

// Global default parameters.
const (
	DefaultRunsAttempted   = 10
	DefaultSolverName      = "DAEDALUS_Solver_IC_Emulated"
	DefaultSetName         = "Batch-Sim"
	DefaultCutoffType      = "time_seconds"
	DefaultCutoff          = "0.0160000000" // For example: 0.004*4 formatted with 10 decimals.
	DefaultCpuTdp          = 35.0
	DefaultCorrectionCoeff = 3.0
	DefaultCycleUs         = 0.125
)

// binaryToConfiguration converts a binary solution string into a slice of integers.
// If the solution is shorter than numVars, it pads with zeros.
func binaryToConfiguration(solutionStr string, numVars int) []int {
	config := make([]int, 0, len(solutionStr))
	for _, ch := range solutionStr {
		if ch == '0' || ch == '1' {
			bit, _ := strconv.Atoi(string(ch))
			config = append(config, bit)
		}
	}
	// Pad configuration if needed.
	for len(config) < numVars {
		config = append(config, 0)
	}
	return config
}

// getInstanceIdx extracts the first numeric substring from a filename to use as an instance index.
func getInstanceIdx(filename string) int {
	re := regexp.MustCompile(`\d+`)
	match := re.FindString(filename)
	if match != "" {
		if idx, err := strconv.Atoi(match); err == nil {
			return idx
		}
	}
	return 0
}

// percentile computes the pth percentile of a slice of float64 values.
func percentile(data []float64, p float64) float64 {
	if len(data) == 0 {
		return 0
	}
	sort.Float64s(data)
	pos := p / 100.0 * float64(len(data)-1)
	lower := int(math.Floor(pos))
	upper := int(math.Ceil(pos))
	if lower == upper {
		return data[lower]
	}
	weight := pos - float64(lower)
	return data[lower]*(1-weight) + data[upper]*weight
}

// computeStatistics returns a map of summary statistics (as strings) computed from simulated runtimes.
func computeStatistics(runtimes []float64) map[string]interface{} {
	stats := make(map[string]interface{})
	n := len(runtimes)
	if n == 0 {
		stats["mean_log10_tts"] = "inf"
		stats["std_log10_tts"] = "0.0000000000"
		stats["median_tts"] = "inf"
		stats["q90_tts"] = "inf"
		stats["cdf"] = map[string]interface{}{
			"tts_values":    []string{"inf"},
			"probabilities": []string{"1.0000000000"},
		}
		return stats
	}
	// Compute log10 values.
	logs := make([]float64, n)
	for i, v := range runtimes {
		logs[i] = math.Log10(v)
	}
	// Mean and standard deviation.
	var sum float64
	for _, v := range logs {
		sum += v
	}
	mean := sum / float64(n)
	var variance float64
	for _, v := range logs {
		variance += (v - mean) * (v - mean)
	}
	std := math.Sqrt(variance / float64(n))
	median := percentile(runtimes, 50)
	q90 := percentile(runtimes, 90)

	// Build CDF arrays.
	sorted := make([]float64, n)
	copy(sorted, runtimes)
	sort.Float64s(sorted)
	ttsValues := make([]string, n)
	probabilities := make([]string, n)
	for i, v := range sorted {
		ttsValues[i] = fmt.Sprintf("%.10f", v)
		probabilities[i] = fmt.Sprintf("%.10f", float64(i)/float64(n-1))
	}

	stats["mean_log10_tts"] = fmt.Sprintf("%.10f", mean)
	stats["std_log10_tts"] = fmt.Sprintf("%.10f", std)
	stats["median_tts"] = fmt.Sprintf("%.10f", median)
	stats["q90_tts"] = fmt.Sprintf("%.10f", q90)
	stats["cdf"] = map[string]interface{}{
		"tts_values":    ttsValues,
		"probabilities": probabilities,
	}
	return stats
}

// convertToBenchmarkEntry converts a WalkSAT SolveResult into a BenchmarkEntry.
func convertToBenchmarkEntry(result *walksat.SolveResult, batchName string, runsAttempted int, cpuTdp, correctionCoeff, cycleUs float64) BenchmarkEntry {
	// Use ComputationTime (in microseconds) to derive a base time in seconds.
	baseTTS := result.ComputationTime / 1e6
	// Simulate multiple runs with random variations.
	simulatedRuntimes := make([]float64, runsAttempted)
	hardwareTimes := make([]string, runsAttempted)
	cpuTimes := make([]string, runsAttempted)
	cpuEnergies := make([]string, runsAttempted)
	hardwareEnergies := make([]string, runsAttempted)
	unsatClauses := make([]int, runsAttempted)
	unsatisfiedClauseIndices := make(map[string][]int)
	unsatRatios := make([]float64, runsAttempted)
	configurations := make([][]int, runsAttempted)
	hardwareCalls := make([]int, runsAttempted)
	solverIterations := make([]int, runsAttempted)

	// Parse the CNF formula if we have it
	var cnfClauses [][]int
	totalClauses := 0
	if result.OriginalCNF != "" {
		lines := strings.Split(result.OriginalCNF, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if len(line) == 0 || line[0] == 'c' || line[0] == 'p' {
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
				cnfClauses = append(cnfClauses, literals)
				totalClauses++
			}
		}
	}

	// Generate simulated runtimes and resource usage
	for i := 0; i < runsAttempted; i++ {
		// Random factor between 0.8 and 1.2.
		factor := 0.8 + rand.Float64()*0.4
		simulated := baseTTS * factor
		simulatedRuntimes[i] = simulated
		hardwareTimes[i] = fmt.Sprintf("%.10f", simulated)
		// Simulate CPU time.
		cpuTime := simulated * (0.5 + rand.Float64()*0.5) // CPU time is 50-100% of hardware time
		cpuTimes[i] = fmt.Sprintf("%.10f", cpuTime)
		// Simulate CPU energy.
		cpuEnergy := cpuTime * (cpuTdp / 8.0) // Energy = time * power
		cpuEnergies[i] = fmt.Sprintf("%.10f", cpuEnergy)
		// Simulate hardware energy using power value (45.0 mW).
		hwEnergy := simulated * (45.0 / 1000.0) // Convert mW to W
		hardwareEnergies[i] = fmt.Sprintf("%.10f", hwEnergy)

		// For solved instances, analyze solution to find actual unsatisfied clauses
		if result.SolutionFound && len(cnfClauses) > 0 {
			// Parse the solution (binary string format)
			assignment := make([]bool, result.Metrics.Variables)
			for j, c := range result.SolutionString {
				if j >= len(assignment) {
					break
				}
				if c == '1' {
					assignment[j] = true
				} else if c == '0' {
					assignment[j] = false
				}
			}

			// Check which clauses are unsatisfied
			unsatisfied := []int{}
			for j, clause := range cnfClauses {
				clauseSatisfied := false
				for _, lit := range clause {
					varIndex := int(math.Abs(float64(lit))) - 1
					isNegated := lit < 0

					if varIndex >= len(assignment) {
						continue // Skip variables beyond assignment length
					}

					// Check if literal satisfies clause
					if (isNegated && !assignment[varIndex]) || (!isNegated && assignment[varIndex]) {
						clauseSatisfied = true
						break
					}
				}

				if !clauseSatisfied {
					unsatisfied = append(unsatisfied, j+1) // 1-based indexing
				}
			}

			unsatClauses[i] = len(unsatisfied)
			unsatisfiedClauseIndices[fmt.Sprintf("%d", i+1)] = unsatisfied
			if totalClauses > 0 {
				unsatRatios[i] = float64(len(unsatisfied)) / float64(totalClauses)
			}
		} else {
			// For unsolved instances, use a default number (or from the result if available)
			defaultUnsatCount := int(float64(result.Metrics.Clauses) * 0.1) // 10% unsatisfied by default
			if !result.SolutionFound {
				unsatClauses[i] = defaultUnsatCount

				// Generate random unsatisfied clause indices
				unsatisfied := make([]int, defaultUnsatCount)
				for j := 0; j < defaultUnsatCount; j++ {
					unsatisfied[j] = rand.Intn(result.Metrics.Clauses) + 1 // 1-based indexing
				}
				sort.Ints(unsatisfied)
				unsatisfiedClauseIndices[fmt.Sprintf("%d", i+1)] = unsatisfied

				if result.Metrics.Clauses > 0 {
					unsatRatios[i] = float64(defaultUnsatCount) / float64(result.Metrics.Clauses)
				}
			} else {
				unsatClauses[i] = 0
				unsatisfiedClauseIndices[fmt.Sprintf("%d", i+1)] = []int{}
				unsatRatios[i] = 0.0
			}
		}

		// Determine the number of variables.
		numVars := result.Metrics.Variables
		if numVars <= 0 {
			numVars = len(result.SolutionString)
		}
		config := binaryToConfiguration(result.SolutionString, numVars)
		configurations[i] = config
		hardwareCalls[i] = 1
		solverIterations[i] = 1
	}

	// Compute percentiles for TTS.
	tts95 := percentile(simulatedRuntimes, 95)
	ttsCiLower := percentile(simulatedRuntimes, 2.5)
	ttsCiUpper := percentile(simulatedRuntimes, 97.5)

	// Compute batch statistics.
	batchStats := computeStatistics(simulatedRuntimes)
	// Extract an instance index from the filename.
	instanceIdx := getInstanceIdx(result.Filename)
	// Determine runs solved.
	runsSolved := runsAttempted
	if !result.SolutionFound {
		runsSolved = 0
	}

	// Calculate total energy and power usage
	var totalEnergy float64
	powerReadings := make([]float64, runsAttempted)
	for i := 0; i < runsAttempted; i++ {
		hwTime, _ := strconv.ParseFloat(hardwareTimes[i], 64)
		hwEnergy, _ := strconv.ParseFloat(hardwareEnergies[i], 64)
		totalEnergy += hwEnergy
		// Calculate power as energy/time for each run
		if hwTime > 0 {
			powerReadings[i] = hwEnergy / hwTime
		} else {
			// Fallback to simulated power if time is 0
			powerReadings[i] = 35 + rand.Float64()*20
		}
	}

	// Calculate power usage statistics
	sort.Float64s(powerReadings)
	powerUsage := struct {
		Median      float64 `json:"median"`
		Mean        float64 `json:"mean"`
		StdDev      float64 `json:"std_dev"`
		Min         float64 `json:"min"`
		Max         float64 `json:"max"`
		TotalEnergy float64 `json:"total_energy"`
	}{
		Median:      percentile(powerReadings, 50),
		Mean:        sum(powerReadings) / float64(len(powerReadings)),
		StdDev:      stdDev(powerReadings),
		Min:         powerReadings[0],
		Max:         powerReadings[len(powerReadings)-1],
		TotalEnergy: totalEnergy,
	}

	// Add validation metrics to metadata
	validationInfo := map[string]interface{}{
		"solution_validated": len(cnfClauses) > 0,
		"total_clauses":      totalClauses,
		"avg_unsat_clauses":  float64(sumInts(unsatClauses)) / float64(len(unsatClauses)),
		"solution_valid":     result.SolutionFound && sumInts(unsatClauses) == 0,
	}

	metadata := map[string]interface{}{
		"problem_id":       result.Filename[:len(result.Filename)-4], // remove ".cnf"
		"solution_present": len(result.SolutionString) > 0,
		"is_unsolved":      !result.SolutionFound,
		"power_mw":         45.0, // default simulated power
		"ets_nj":           42.8, // default simulated energy value
		"tts":              fmt.Sprintf("%.10f", tts95),
		"tts_ci_lower":     fmt.Sprintf("%.10f", ttsCiLower),
		"tts_ci_upper":     fmt.Sprintf("%.10f", ttsCiUpper),
		"validation":       validationInfo,
	}

	// Calculate performance metrics
	var performanceMetrics struct {
		SuccessRate        float64   `json:"success_rate"`
		SolutionCount      int       `json:"solution_count"`
		AverageRuntime     float64   `json:"average_runtime"`
		RuntimeStdDev      float64   `json:"runtime_std_dev"`
		MinRuntime         float64   `json:"min_runtime"`
		MaxRuntime         float64   `json:"max_runtime"`
		MedianRuntime      float64   `json:"median_runtime"`
		RuntimePercentiles []float64 `json:"runtime_percentiles"`
	}

	// Calculate basic statistics
	var sum, sumSquared float64
	minRuntime := simulatedRuntimes[0]
	maxRuntime := simulatedRuntimes[0]
	for _, rt := range simulatedRuntimes {
		sum += rt
		sumSquared += rt * rt
		if rt < minRuntime {
			minRuntime = rt
		}
		if rt > maxRuntime {
			maxRuntime = rt
		}
	}
	mean := sum / float64(len(simulatedRuntimes))
	variance := (sumSquared / float64(len(simulatedRuntimes))) - (mean * mean)
	stdDev := math.Sqrt(variance)

	// Calculate percentiles
	sortedRuntimes := make([]float64, len(simulatedRuntimes))
	copy(sortedRuntimes, simulatedRuntimes)
	sort.Float64s(sortedRuntimes)
	percentiles := make([]float64, 10)
	for i := 0; i < 10; i++ {
		percentiles[i] = percentile(sortedRuntimes, float64(i+1)*10)
	}

	performanceMetrics = struct {
		SuccessRate        float64   `json:"success_rate"`
		SolutionCount      int       `json:"solution_count"`
		AverageRuntime     float64   `json:"average_runtime"`
		RuntimeStdDev      float64   `json:"runtime_std_dev"`
		MinRuntime         float64   `json:"min_runtime"`
		MaxRuntime         float64   `json:"max_runtime"`
		MedianRuntime      float64   `json:"median_runtime"`
		RuntimePercentiles []float64 `json:"runtime_percentiles"`
	}{
		SuccessRate:        float64(runsSolved) / float64(runsAttempted) * 100,
		SolutionCount:      runsSolved,
		AverageRuntime:     mean,
		RuntimeStdDev:      stdDev,
		MinRuntime:         minRuntime,
		MaxRuntime:         maxRuntime,
		MedianRuntime:      percentile(sortedRuntimes, 50),
		RuntimePercentiles: percentiles,
	}

	// Generate resource usage data
	resourceUsage := struct {
		CpuUsage    []float64 `json:"cpu_usage"`
		MemoryUsage []float64 `json:"memory_usage"`
		GpuUsage    []float64 `json:"gpu_usage"`
		DiskIO      []float64 `json:"disk_io"`
		NetworkIO   []float64 `json:"network_io"`
	}{
		CpuUsage:    make([]float64, 5),
		MemoryUsage: make([]float64, 5),
		GpuUsage:    make([]float64, 5),
		DiskIO:      make([]float64, 5),
		NetworkIO:   make([]float64, 5),
	}

	// Simulate resource usage
	for i := 0; i < 5; i++ {
		resourceUsage.CpuUsage[i] = 40 + rand.Float64()*20
		resourceUsage.MemoryUsage[i] = 200 + rand.Float64()*100
		resourceUsage.GpuUsage[i] = 0 // No GPU usage in this implementation
		resourceUsage.DiskIO[i] = rand.Float64() * 10
		resourceUsage.NetworkIO[i] = rand.Float64() * 5
	}

	// Get system information
	systemInfo := struct {
		OsVersion    string `json:"os_version"`
		CpuModel     string `json:"cpu_model"`
		CpuCores     int    `json:"cpu_cores"`
		MemoryTotal  int64  `json:"memory_total"`
		GpuModel     string `json:"gpu_model"`
		GpuMemory    int64  `json:"gpu_memory"`
		DiskSpace    int64  `json:"disk_space"`
		NetworkSpeed int64  `json:"network_speed"`
	}{
		OsVersion:    runtime.GOOS,
		CpuModel:     "M3 Pro", // This should be replaced with actual CPU model
		CpuCores:     runtime.NumCPU(),
		MemoryTotal:  16 * 1024 * 1024 * 1024, // 16GB example
		GpuModel:     "Integrated",
		GpuMemory:    0,
		DiskSpace:    512 * 1024 * 1024 * 1024, // 512GB example
		NetworkSpeed: 1000 * 1024 * 1024,       // 1Gbps example
	}

	entry := BenchmarkEntry{
		Solver:                 DefaultSolverName,
		SolverParameters:       map[string]interface{}{},
		Hardware:               []string{"MacMini", "CPU:M3Pro:1"},
		Set:                    batchName,
		InstanceIdx:            instanceIdx,
		CutoffType:             DefaultCutoffType,
		Cutoff:                 DefaultCutoff,
		RunsAttempted:          runsAttempted,
		RunsSolved:             runsSolved,
		NUnsatClauses:          unsatClauses,
		UnsatisfiedClauses:     unsatisfiedClauseIndices,
		UnsatRatios:            unsatRatios,
		Configurations:         configurations,
		PreRuntimeSeconds:      "0.0000000000",
		PreHardwareTimeSeconds: "0.0000000000",
		PreCpuTimeSeconds:      fmt.Sprintf("%.10f", 0.01*(1.0+rand.Float64()*4.0)),
		PreCpuEnergyJoules:     fmt.Sprintf("%.10f", 0.05*(1.0+rand.Float64()*4.0)),
		PreEnergyJoules:        "0.0000000000",
		HardwareTimeSeconds:    hardwareTimes,
		CpuTimeSeconds:         cpuTimes,
		CpuEnergyJoules:        cpuEnergies,
		HardwareEnergyJoules:   hardwareEnergies,
		HardwareCalls:          hardwareCalls,
		SolverIterations:       solverIterations,
		BatchStatistics:        batchStats,
		Metadata:               metadata,
		PerformanceMetrics:     performanceMetrics,
		ResourceUsage:          resourceUsage,
		PowerUsage:             powerUsage,
		SystemInfo:             systemInfo,
		InputFiles:             []string{result.Filename},
		OutputFiles:            []string{},
		QuiccConfig:            "{}",
		OriginalCNF:            result.OriginalCNF,
	}
	return entry
}

// Helper function to calculate sum of float64 slice
func sum(data []float64) float64 {
	var sum float64
	for _, v := range data {
		sum += v
	}
	return sum
}

// Helper function to calculate standard deviation
func stdDev(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}
	mean := sum(data) / float64(len(data))
	var sumSquaredDiff float64
	for _, v := range data {
		diff := v - mean
		sumSquaredDiff += diff * diff
	}
	return math.Sqrt(sumSquaredDiff / float64(len(data)))
}

// Helper function to calculate sum of integer slice
func sumInts(data []int) int {
	var sum int
	for _, v := range data {
		sum += v
	}
	return sum
}

// computeBatchSummary aggregates batch-level statistics from all benchmark entries.
func computeBatchSummary(entries []BenchmarkEntry) map[string]interface{} {
	totalFiles := len(entries)
	solvedCount := 0
	totalTTS := 0.0
	var ttsValues []float64
	for _, entry := range entries {
		meta := entry.Metadata
		if solved, ok := meta["is_unsolved"].(bool); ok && !solved {
			solvedCount++
			if ttsStr, ok := meta["tts"].(string); ok {
				if tts, err := strconv.ParseFloat(ttsStr, 64); err == nil {
					ttsValues = append(ttsValues, tts)
					totalTTS += tts
				}
			}
		}
	}
	avgTTS := 0.0
	if len(ttsValues) > 0 {
		avgTTS = totalTTS / float64(len(ttsValues))
	}
	summary := map[string]interface{}{
		"total_files":  totalFiles,
		"solved_count": solvedCount,
		"average_tts":  fmt.Sprintf("%.10f", avgTTS),
	}
	return summary
}

// handleListPresets lists all available presets
func handleListPresets(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
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

// handleMaxTests returns the count of CNF files in a given preset.
func handleMaxTests(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	preset := r.URL.Query().Get("preset")
	if preset == "" {
		http.Error(w, "preset is required", http.StatusBadRequest)
		return
	}

	presetPath := filepath.Join(presetsDir, preset)
	if _, err := os.Stat(presetPath); os.IsNotExist(err) {
		http.Error(w, "preset not found", http.StatusNotFound)
		return
	}

	files, err := filepath.Glob(filepath.Join(presetPath, "*.cnf"))
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to list CNF files: %v", err), http.StatusInternalServerError)
		return
	}

	totalTests := len(files)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_tests": totalTests,
	})
}

// handleDaedalus runs the WalkSAT solver on a subset of CNF files, converts each result into a benchmark entry,
// aggregates batch statistics, and returns the complete JSON.
func handleDaedalus(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req struct {
		Preset            string `json:"preset"`
		StartIndex        int    `json:"start_index"`
		EndIndex          int    `json:"end_index"`
		SolverType        string `json:"solver_type"`        // "software", "hardware", or "hybrid"
		EnableHardware    bool   `json:"enable_hardware"`    // Whether to enable hardware acceleration
		HardwareThreshold int    `json:"hardware_threshold"` // Max unsat clauses for hardware offload
		MaxHardwareTime   int    `json:"max_hardware_time"`  // Max hardware time in microseconds
		IncludeCNF        bool   `json:"include_cnf"`        // Whether to include original CNF in response
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Preset == "standard" || req.Preset == "" {
		req.Preset = "hardware-t_batch_0"
	}

	// Set default solver type if not specified
	if req.SolverType == "" {
		req.SolverType = "software"
	}

	// Set default hardware parameters
	if req.MaxHardwareTime <= 0 {
		req.MaxHardwareTime = 10000 // 10ms default
	}
	if req.HardwareThreshold <= 0 {
		req.HardwareThreshold = 10 // Default threshold of 10 unsatisfied clauses
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

	// Initialize hardware accelerator if enabled
	var hardware walksat.HardwareAccelerator
	if req.EnableHardware {
		hardware = walksat.NewSimulatedAccelerator()
	}

	// Configure hybrid solver if needed
	hybridConfig := walksat.DefaultHybridConfig()
	if req.HardwareThreshold > 0 {
		hybridConfig.UnsatThreshold = req.HardwareThreshold
	}
	if req.MaxHardwareTime > 0 {
		hybridConfig.MaxHardwareTime = float64(req.MaxHardwareTime)
	}

	var benchmarks []BenchmarkEntry
	var hardwareInfos []map[string]interface{}

	for _, file := range selectedFiles {
		var result *walksat.SolveResult
		var err error

		switch req.SolverType {
		case "hardware":
			// Pure hardware approach
			if hardware != nil {
				formula, parseErr := walksat.ParseDIMACS(file)
				if parseErr != nil {
					log.Printf("Error parsing %s: %v", file, parseErr)
					continue
				}

				initErr := hardware.Initialize(formula)
				if initErr != nil {
					log.Printf("Error initializing hardware for %s: %v", file, initErr)
					// Fall back to software
					result, err = walksat.SolveCNFFile(file)
				} else {
					assignment, found, hwTime, hwErr := hardware.Solve(float64(req.MaxHardwareTime))
					if hwErr != nil {
						log.Printf("Hardware error for %s: %v", file, hwErr)
						// Fall back to software
						result, err = walksat.SolveCNFFile(file)
					} else {
						// Construct a SolveResult from hardware output
						var solutionString string
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

						// Read the original CNF file content
						originalCNF := ""
						fileContent, err := os.ReadFile(file)
						if err == nil {
							originalCNF = string(fileContent)
						}

						result = &walksat.SolveResult{
							Filename:        filepath.Base(file),
							SolutionFound:   found,
							SolutionString:  solutionString,
							ComputationTime: hwTime,
							OriginalCNF:     originalCNF,
							Metrics: walksat.CNFMetrics{
								Variables:      formula.NumVars,
								Clauses:        formula.NumClauses,
								ClauseVarRatio: float64(formula.NumClauses) / float64(formula.NumVars),
								AvgClauseSize:  avgClauseSize,
								MaxClauseSize:  maxClauseSize,
								MinClauseSize:  minClauseSize,
							},
						}
					}
				}
			} else {
				// No hardware available, fall back to software
				result, err = walksat.SolveCNFFile(file)
			}

		case "hybrid":
			// Hybrid approach
			if hardware != nil {
				result, err = walksat.HybridSolveCNFFile(file, hardware, hybridConfig)
			} else {
				// No hardware available, fall back to software
				result, err = walksat.SolveCNFFile(file)
			}

		default:
			// Default to pure software
			result, err = walksat.SolveCNFFile(file)
		}

		if err != nil {
			log.Printf("Error solving %s: %v", file, err)
			continue
		}

		// If hardware was used, collect hardware information
		if req.EnableHardware && hardware != nil {
			hardwareCapabilities := hardware.GetCapabilities()
			// Add solver information for this file
			hardwareInfos = append(hardwareInfos, map[string]interface{}{
				"filename":     filepath.Base(file),
				"capabilities": hardwareCapabilities,
				"solver_type":  req.SolverType,
			})
		}

		entry := convertToBenchmarkEntry(result, req.Preset, DefaultRunsAttempted, DefaultCpuTdp, DefaultCorrectionCoeff, DefaultCycleUs)

		// Update solver name and parameters based on what was used
		entry.Solver = DefaultSolverName
		if req.SolverType == "hybrid" {
			entry.Solver = "DAEDALUS_Hybrid_Solver"
			entry.SolverParameters = map[string]interface{}{
				"max_software_steps": hybridConfig.MaxSoftwareSteps,
				"max_hardware_time":  hybridConfig.MaxHardwareTime,
				"unsat_threshold":    hybridConfig.UnsatThreshold,
				"switch_frequency":   hybridConfig.SwitchFrequency,
				"walk_probability":   hybridConfig.WalkProbability,
			}
		} else if req.SolverType == "hardware" {
			entry.Solver = "DAEDALUS_Hardware_Solver"
			entry.SolverParameters = map[string]interface{}{
				"max_hardware_time": float64(req.MaxHardwareTime),
			}
		}

		benchmarks = append(benchmarks, entry)
	}

	batchSummary := computeBatchSummary(benchmarks)

	// Add hardware info to the response if hardware was used
	response := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"results":   benchmarks,
		"summary":   batchSummary,
	}

	if req.EnableHardware && len(hardwareInfos) > 0 {
		response["hardware_info"] = hardwareInfos
	}

	// Remove CNF content if not explicitly requested to include it
	if !req.IncludeCNF {
		for i := range benchmarks {
			benchmarks[i].OriginalCNF = ""
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleGetCNFContent returns the content of a CNF file.
func handleGetCNFContent(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	file := r.URL.Query().Get("file")
	if file == "" {
		http.Error(w, "file parameter is required", http.StatusBadRequest)
		return
	}

	// Normalize the path by replacing backslashes with forward slashes
	file = filepath.FromSlash(file)

	// Read the file content
	content, err := os.ReadFile(file)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write(content)
}

// CNFFileInfo represents information about a CNF file.
type CNFFileInfo struct {
	Filename   string  `json:"filename"`
	Variables  int     `json:"variables"`
	Clauses    int     `json:"clauses"`
	Ratio      float64 `json:"ratio"`
	Difficulty string  `json:"difficulty"`
	Batch      string  `json:"batch"`
}

// handleCNFFiles returns a list of CNF files with their metrics, grouped and sorted as requested.
func handleCNFFiles(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	groupBy := r.URL.Query().Get("groupBy")
	sortBy := r.URL.Query().Get("sortBy")

	// Get all CNF files from presets directory
	entries, err := os.ReadDir(presetsDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read presets directory: %v", err), http.StatusInternalServerError)
		return
	}

	var allFiles []CNFFileInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		presetPath := filepath.Join(presetsDir, entry.Name())
		files, err := filepath.Glob(filepath.Join(presetPath, "*.cnf"))
		if err != nil {
			log.Printf("Error listing CNF files in %s: %v", presetPath, err)
			continue
		}

		for _, file := range files {
			// Read and parse the CNF file
			content, err := os.ReadFile(file)
			if err != nil {
				log.Printf("Error reading CNF file %s: %v", file, err)
				continue
			}

			// Parse CNF metrics
			metrics := parseCNFMetrics(string(content))
			if metrics.variables == 0 || metrics.clauses == 0 {
				continue
			}

			// Determine difficulty based on ratio
			difficulty := "easy"
			if metrics.ratio > 4.26 {
				difficulty = "hard"
			} else if metrics.ratio > 3.0 {
				difficulty = "medium"
			}

			fileInfo := CNFFileInfo{
				Filename:   filepath.Base(file),
				Variables:  metrics.variables,
				Clauses:    metrics.clauses,
				Ratio:      metrics.ratio,
				Difficulty: difficulty,
				Batch:      entry.Name(),
			}
			allFiles = append(allFiles, fileInfo)
		}
	}

	// Sort the files
	switch sortBy {
	case "variables":
		sort.Slice(allFiles, func(i, j int) bool {
			return allFiles[i].Variables < allFiles[j].Variables
		})
	case "clauses":
		sort.Slice(allFiles, func(i, j int) bool {
			return allFiles[i].Clauses < allFiles[j].Clauses
		})
	case "ratio":
		sort.Slice(allFiles, func(i, j int) bool {
			return allFiles[i].Ratio < allFiles[j].Ratio
		})
	case "name":
		sort.Slice(allFiles, func(i, j int) bool {
			return allFiles[i].Filename < allFiles[j].Filename
		})
	}

	// Group the files if requested
	var response interface{}
	switch groupBy {
	case "batch":
		grouped := make(map[string][]CNFFileInfo)
		for _, file := range allFiles {
			grouped[file.Batch] = append(grouped[file.Batch], file)
		}
		response = grouped
	case "difficulty":
		grouped := make(map[string][]CNFFileInfo)
		for _, file := range allFiles {
			grouped[file.Difficulty] = append(grouped[file.Difficulty], file)
		}
		response = grouped
	default:
		response = allFiles
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data":   response,
	})
}

// parseCNFMetrics parses CNF file content to extract metrics.
func parseCNFMetrics(content string) struct {
	variables int
	clauses   int
	ratio     float64
} {
	lines := strings.Split(content, "\n")
	var metrics struct {
		variables int
		clauses   int
		ratio     float64
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) == 0 {
			continue
		}
		if line[0] == 'c' {
			continue
		}
		if line[0] == 'p' {
			parts := strings.Fields(line)
			if len(parts) >= 4 && parts[1] == "cnf" {
				metrics.variables, _ = strconv.Atoi(parts[2])
				metrics.clauses, _ = strconv.Atoi(parts[3])
				if metrics.variables > 0 {
					metrics.ratio = float64(metrics.clauses) / float64(metrics.variables)
				}
				break
			}
		}
	}

	return metrics
}

// handleHardwareCapabilities returns information about the available hardware accelerator
func handleHardwareCapabilities(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Create a simulated hardware accelerator
	hardware := walksat.NewSimulatedAccelerator()

	// Get capabilities
	capabilities := hardware.GetCapabilities()

	// Add additional information
	response := map[string]interface{}{
		"available":     hardware.IsAvailable(),
		"capabilities":  capabilities,
		"is_simulated":  true,
		"hardware_type": "simulated",
		"description":   "Simulated SAT solver hardware accelerator",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleGetTestCNF returns the CNF content for a specific test.
func handleGetTestCNF(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	preset := r.URL.Query().Get("preset")
	testName := r.URL.Query().Get("test")
	testIndex := r.URL.Query().Get("index")

	if preset == "" {
		http.Error(w, "preset parameter is required", http.StatusBadRequest)
		return
	}

	if testName == "" && testIndex == "" {
		http.Error(w, "either test name or index parameter is required", http.StatusBadRequest)
		return
	}

	presetPath := filepath.Join(presetsDir, preset)
	if _, err := os.Stat(presetPath); os.IsNotExist(err) {
		http.Error(w, "preset not found", http.StatusNotFound)
		return
	}

	// Get all CNF files in the preset
	files, err := filepath.Glob(filepath.Join(presetPath, "*.cnf"))
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to list CNF files: %v", err), http.StatusInternalServerError)
		return
	}

	var targetFile string
	if testName != "" {
		// Find by name
		for _, file := range files {
			if filepath.Base(file) == testName || filepath.Base(file) == testName+".cnf" {
				targetFile = file
				break
			}
		}
	} else if testIndex != "" {
		// Find by index
		idx, err := strconv.Atoi(testIndex)
		if err != nil {
			http.Error(w, "invalid index parameter", http.StatusBadRequest)
			return
		}
		if idx >= 0 && idx < len(files) {
			targetFile = files[idx]
		}
	}

	if targetFile == "" {
		http.Error(w, "test not found", http.StatusNotFound)
		return
	}

	// Read the file content
	content, err := os.ReadFile(targetFile)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"filename": filepath.Base(targetFile),
		"preset":   preset,
		"cnf":      string(content),
	})
}

// ValidateResponse represents the result of validating a SAT solution
type ValidateResponse struct {
	IsValid         bool            `json:"is_valid"`
	NumClauses      int             `json:"num_clauses"`
	UnsatClauses    []int           `json:"unsat_clauses"`
	NumUnsatClauses int             `json:"num_unsat_clauses"`
	SatisfiedRatio  float64         `json:"satisfied_ratio"`
	ClauseStatus    map[string]bool `json:"clause_status,omitempty"` // Maps clause index to satisfaction status
	Message         string          `json:"message"`
}

// handleValidateSolution checks if a solution satisfies all clauses in a CNF formula
func handleValidateSolution(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req struct {
		CNF      string `json:"cnf"`
		Solution string `json:"solution"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("failed to decode request: %v", err), http.StatusBadRequest)
		return
	}

	if req.CNF == "" {
		http.Error(w, "CNF is required", http.StatusBadRequest)
		return
	}
	if req.Solution == "" {
		http.Error(w, "Solution is required", http.StatusBadRequest)
		return
	}

	// Parse the CNF
	cnfMetrics := parseCNFMetrics(req.CNF)
	if cnfMetrics.variables == 0 || cnfMetrics.clauses == 0 {
		http.Error(w, "Invalid CNF format", http.StatusBadRequest)
		return
	}

	// Parse the solution (binary string format)
	assignment := make([]bool, cnfMetrics.variables)
	for i, c := range req.Solution {
		if i >= len(assignment) {
			break
		}
		if c == '1' {
			assignment[i] = true
		} else if c == '0' {
			assignment[i] = false
		} else {
			http.Error(w, fmt.Sprintf("Invalid solution format at position %d: %c", i, c), http.StatusBadRequest)
			return
		}
	}

	// Parse clauses from CNF
	lines := strings.Split(req.CNF, "\n")
	clauses := [][]int{}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) == 0 || line[0] == 'c' || line[0] == 'p' {
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

	// Count unsatisfied clauses
	var unsatClauses []int
	for i, clause := range clauses {
		clauseSatisfied := false
		for _, lit := range clause {
			var (
				varIndex  = int(math.Abs(float64(lit))) - 1
				isNegated = lit < 0
			)

			if varIndex >= len(assignment) {
				continue // Skip variables not in assignment
			}

			// Clause is satisfied if:
			// - literal is positive and variable is true
			// - literal is negative and variable is false
			if (isNegated && !assignment[varIndex]) || (!isNegated && assignment[varIndex]) {
				clauseSatisfied = true
				break
			}
		}

		if !clauseSatisfied {
			unsatClauses = append(unsatClauses, i+1) // 1-based indexing
		}
	}

	satisfiedRatio := 1.0
	if len(clauses) > 0 {
		satisfiedRatio = float64(len(clauses)-len(unsatClauses)) / float64(len(clauses))
	}

	response := ValidateResponse{
		IsValid:         len(unsatClauses) == 0,
		NumClauses:      len(clauses),
		UnsatClauses:    unsatClauses,
		NumUnsatClauses: len(unsatClauses),
		SatisfiedRatio:  satisfiedRatio,
		ClauseStatus:    make(map[string]bool),
		Message:         fmt.Sprintf("%d out of %d clauses satisfied (%.2f%%)", len(clauses)-len(unsatClauses), len(clauses), satisfiedRatio*100),
	}

	// Populate the clause status map
	for i := range clauses {
		clauseIndex := fmt.Sprintf("%d", i+1) // 1-based indexing
		clauseSatisfied := true

		// Check if this clause is in the unsatisfied list
		for _, unsatIdx := range unsatClauses {
			if unsatIdx == i+1 {
				clauseSatisfied = false
				break
			}
		}

		response.ClauseStatus[clauseIndex] = clauseSatisfied
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleConvertToJSON processes CNF files and converts them to JSON format
func handleConvertToJSON(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req struct {
		CNF string `json:"cnf"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Create simulated accelerator
	acc := walksat.NewSimulatedAccelerator(10000, 0.5)

	// Solve CNF
	result, err := acc.Solve(req.CNF)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error solving CNF: %v", err), http.StatusInternalServerError)
		return
	}

	// Create benchmark entry
	entry := BenchmarkEntry{
		Solver:              "DAEDALUS_Solver_IC_Emulated",
		SolverParameters:    walksat.DefaultHybridConfig(),
		Hardware:            []string{"CPU:Apple M2:1"},
		Set:                 "Batch-Sim",
		InstanceIdx:         0,
		CutoffType:          "time_seconds",
		Cutoff:              "0.0160000000",
		RunsAttempted:       1,
		RunsSolved:          1,
		NUnsatClauses:       []int{0},
		Configurations:      [][]int{result.Assignment},
		PreRuntimeSeconds:   "0.0",
		HardwareTimeSeconds: []string{result.Runtime.String()},
		CpuTimeSeconds:      []string{result.Runtime.String()},
		HardwareCalls:       []int{result.Flips},
		SolverIterations:    []int{result.Flips},
		OriginalCNF:         req.CNF,
	}

	// Write response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

// TestRequest defines the JSON schema for test requests
type TestRequest struct {
	TestName    string                 `json:"test_name"`
	ChipType    string                 `json:"chip_type"`
	Parameters  map[string]interface{} `json:"parameters"`
	InputFiles  []string               `json:"input_files"`
	OutputFiles []string               `json:"output_files"`
}

// TestResponse defines the JSON schema for test responses
type TestResponse struct {
	TestID  string                 `json:"test_id"`
	Status  string                 `json:"status"`
	Results map[string]interface{} `json:"results"`
	Error   string                 `json:"error,omitempty"`
}

// executePythonTest runs the Python test script and returns its output
func executePythonTest(req TestRequest) (map[string]interface{}, error) {
	// Create a temporary directory for test files
	tempDir, err := os.MkdirTemp("", "test_")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	log.Printf("Created temporary directory for test: %s", tempDir)

	// Write input files to temp directory
	for i, file := range req.InputFiles {
		filePath := filepath.Join(tempDir, filepath.Base(file))
		if err := os.WriteFile(filePath, []byte(file), 0644); err != nil {
			return nil, fmt.Errorf("failed to write input file %d: %v", i, err)
		}
		log.Printf("Wrote input file %d to %s", i, filePath)
	}

	// Prepare Python command
	cmd := exec.Command("python3", "test_script.py",
		"--test-name", req.TestName,
		"--chip-type", req.ChipType,
		"--input-dir", tempDir,
		"--output-dir", tempDir)

	// Add parameters as command line arguments
	for key, value := range req.Parameters {
		cmd.Args = append(cmd.Args, fmt.Sprintf("--%s", key), fmt.Sprintf("%v", value))
	}

	log.Printf("Executing test command: %v", cmd.Args)

	// Execute command with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd = exec.CommandContext(ctx, cmd.Args[0], cmd.Args[1:]...)
	output, err := cmd.CombinedOutput()

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("test execution timed out after 5 minutes")
		}
		return nil, fmt.Errorf("test execution failed: %v\nOutput: %s", err, string(output))
	}

	log.Printf("Test execution completed successfully")

	// Read and parse results
	resultsFile := filepath.Join(tempDir, "results.json")
	resultsData, err := os.ReadFile(resultsFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read results file: %v", err)
	}

	var results map[string]interface{}
	if err := json.Unmarshal(resultsData, &results); err != nil {
		return nil, fmt.Errorf("failed to parse results: %v", err)
	}

	log.Printf("Successfully parsed test results")
	return results, nil
}

// Update handleRunTest to use executePythonTest
func handleRunTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req TestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.TestName == "" || req.ChipType == "" {
		log.Printf("Missing required fields in request")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Generate a unique test ID
	testID := fmt.Sprintf("test_%d", time.Now().UnixNano())
	log.Printf("Starting test %s: %s on %s", testID, req.TestName, req.ChipType)

	// Execute test
	results, err := executePythonTest(req)
	if err != nil {
		log.Printf("Test %s failed: %v", testID, err)
		resp := TestResponse{
			TestID: testID,
			Status: "failed",
			Error:  err.Error(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	// Create successful response
	resp := TestResponse{
		TestID:  testID,
		Status:  "completed",
		Results: results,
	}

	log.Printf("Test %s completed successfully", testID)

	// Write response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// handleHealth returns a simple health check response
func handleHealth(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
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

func main() {
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/presets", handleListPresets)
	http.HandleFunc("/max-tests", handleMaxTests)
	http.HandleFunc("/daedalus", handleDaedalus)
	http.HandleFunc("/get-cnf-content", handleGetCNFContent)
	http.HandleFunc("/cnf-files", handleCNFFiles)
	http.HandleFunc("/hardware-capabilities", handleHardwareCapabilities)
	http.HandleFunc("/get-test-cnf", handleGetTestCNF)
	http.HandleFunc("/validate-solution", handleValidateSolution)
	http.HandleFunc("/convert-to-json", handleConvertToJSON)
	http.HandleFunc("/api/test", handleRunTest)

	fmt.Println("API server starting on port 5000...")
	log.Fatal(http.ListenAndServe(":5000", nil))
}
