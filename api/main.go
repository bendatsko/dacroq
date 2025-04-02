package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	// Import the local WalkSAT package.
	"dacroq/walksat"
)

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
		SuccessRate         float64   `json:"success_rate"`
		SolutionCount       int       `json:"solution_count"`
		AverageRuntime      float64   `json:"average_runtime"`
		RuntimeStdDev       float64   `json:"runtime_std_dev"`
		MinRuntime          float64   `json:"min_runtime"`
		MaxRuntime          float64   `json:"max_runtime"`
		MedianRuntime       float64   `json:"median_runtime"`
		RuntimePercentiles  []float64 `json:"runtime_percentiles"`
	} `json:"performance_metrics"`
	ResourceUsage struct {
		CpuUsage     []float64 `json:"cpu_usage"`
		MemoryUsage  []float64 `json:"memory_usage"`
		GpuUsage     []float64 `json:"gpu_usage"`
		DiskIO       []float64 `json:"disk_io"`
		NetworkIO    []float64 `json:"network_io"`
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
		OsVersion      string `json:"os_version"`
		CpuModel       string `json:"cpu_model"`
		CpuCores       int    `json:"cpu_cores"`
		MemoryTotal    int64   `json:"memory_total"`
		GpuModel       string `json:"gpu_model"`
		GpuMemory      int64   `json:"gpu_memory"`
		DiskSpace      int64   `json:"disk_space"`
		NetworkSpeed   int64   `json:"network_speed"`
	} `json:"system_info"`
	InputFiles  []string `json:"input_files"`
	OutputFiles []string `json:"output_files"`
	QuiccConfig string   `json:"quicc_config"`
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
	configurations := make([][]int, runsAttempted)
	hardwareCalls := make([]int, runsAttempted)
	solverIterations := make([]int, runsAttempted)

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
		// For solved instances, assume zero unsatisfied clauses.
		if result.SolutionFound {
			unsatClauses[i] = 0
		} else {
			unsatClauses[i] = 1
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

	metadata := map[string]interface{}{
		"problem_id":       result.Filename[:len(result.Filename)-4], // remove ".cnf"
		"solution_present": len(result.SolutionString) > 0,
		"is_unsolved":      !result.SolutionFound,
		"power_mw":         45.0, // default simulated power
		"ets_nj":           42.8, // default simulated energy value
		"tts":              fmt.Sprintf("%.10f", tts95),
		"tts_ci_lower":     fmt.Sprintf("%.10f", ttsCiLower),
		"tts_ci_upper":     fmt.Sprintf("%.10f", ttsCiUpper),
	}

	// Calculate performance metrics
	var performanceMetrics struct {
		SuccessRate         float64   `json:"success_rate"`
		SolutionCount       int       `json:"solution_count"`
		AverageRuntime      float64   `json:"average_runtime"`
		RuntimeStdDev       float64   `json:"runtime_std_dev"`
		MinRuntime          float64   `json:"min_runtime"`
		MaxRuntime          float64   `json:"max_runtime"`
		MedianRuntime       float64   `json:"median_runtime"`
		RuntimePercentiles  []float64 `json:"runtime_percentiles"`
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
	variance := (sumSquared/float64(len(simulatedRuntimes))) - (mean * mean)
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
		SuccessRate         float64   `json:"success_rate"`
		SolutionCount       int       `json:"solution_count"`
		AverageRuntime      float64   `json:"average_runtime"`
		RuntimeStdDev       float64   `json:"runtime_std_dev"`
		MinRuntime          float64   `json:"min_runtime"`
		MaxRuntime          float64   `json:"max_runtime"`
		MedianRuntime       float64   `json:"median_runtime"`
		RuntimePercentiles  []float64 `json:"runtime_percentiles"`
	}{
		SuccessRate:         float64(runsSolved) / float64(runsAttempted) * 100,
		SolutionCount:       runsSolved,
		AverageRuntime:      mean,
		RuntimeStdDev:       stdDev,
		MinRuntime:          minRuntime,
		MaxRuntime:          maxRuntime,
		MedianRuntime:       percentile(sortedRuntimes, 50),
		RuntimePercentiles:  percentiles,
	}

	// Generate resource usage data
	resourceUsage := struct {
		CpuUsage     []float64 `json:"cpu_usage"`
		MemoryUsage  []float64 `json:"memory_usage"`
		GpuUsage     []float64 `json:"gpu_usage"`
		DiskIO       []float64 `json:"disk_io"`
		NetworkIO    []float64 `json:"network_io"`
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
		OsVersion      string `json:"os_version"`
		CpuModel       string `json:"cpu_model"`
		CpuCores       int    `json:"cpu_cores"`
		MemoryTotal    int64  `json:"memory_total"`
		GpuModel       string `json:"gpu_model"`
		GpuMemory      int64  `json:"gpu_memory"`
		DiskSpace      int64  `json:"disk_space"`
		NetworkSpeed   int64  `json:"network_speed"`
	}{
		OsVersion:      runtime.GOOS,
		CpuModel:       "M3 Pro", // This should be replaced with actual CPU model
		CpuCores:       runtime.NumCPU(),
		MemoryTotal:    16 * 1024 * 1024 * 1024, // 16GB example
		GpuModel:       "Integrated",
		GpuMemory:      0,
		DiskSpace:      512 * 1024 * 1024 * 1024, // 512GB example
		NetworkSpeed:   1000 * 1024 * 1024, // 1Gbps example
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

// handleListPresets lists all available preset directories.
func handleListPresets(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	presetDir := "./presets"
	entries, err := os.ReadDir(presetDir)
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

	presetPath := filepath.Join("./presets", preset)
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
		Preset     string `json:"preset"`
		StartIndex int    `json:"start_index"`
		EndIndex   int    `json:"end_index"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Preset == "standard" || req.Preset == "" {
		req.Preset = "hardware-t_batch_0"
	}

	presetPath := filepath.Join("./presets", req.Preset)
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

	var benchmarks []BenchmarkEntry
	for _, file := range selectedFiles {
		result, err := walksat.SolveCNFFile(file)
		if err != nil {
			log.Printf("Error solving %s: %v", file, err)
			continue
		}
		entry := convertToBenchmarkEntry(result, req.Preset, DefaultRunsAttempted, DefaultCpuTdp, DefaultCorrectionCoeff, DefaultCycleUs)
		benchmarks = append(benchmarks, entry)
	}
	batchSummary := computeBatchSummary(benchmarks)
	response := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"results":   benchmarks,
		"summary":   batchSummary,
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
	presetDir := "./presets"
	entries, err := os.ReadDir(presetDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read presets directory: %v", err), http.StatusInternalServerError)
		return
	}

	var allFiles []CNFFileInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		presetPath := filepath.Join(presetDir, entry.Name())
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

func main() {
	http.HandleFunc("/presets", handleListPresets)
	http.HandleFunc("/max-tests", handleMaxTests)
	http.HandleFunc("/daedalus", handleDaedalus)
	http.HandleFunc("/get-cnf-content", handleGetCNFContent)
	http.HandleFunc("/cnf-files", handleCNFFiles)

	fmt.Println("API server starting on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
