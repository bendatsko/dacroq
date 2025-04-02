package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// handleListPresets lists all preset batches available in the "./presets" directory.
func handleListPresets(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS requests.
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

// handleMaxTests returns the total number of CNF files for a given preset.
func handleMaxTests(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS requests.
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Get preset from query parameter.
	preset := r.URL.Query().Get("preset")
	if preset == "" {
		http.Error(w, "preset is required", http.StatusBadRequest)
		return
	}

	presetPath := filepath.Join("./presets", preset)
	// Check if the preset folder exists.
	if _, err := os.Stat(presetPath); os.IsNotExist(err) {
		http.Error(w, "preset not found", http.StatusNotFound)
		return
	}

	// Get list of .cnf files.
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

// handleDaedalus processes a test request.
// It copies the preset CNF files into ./walksat/problems,
// runs the client binary, waits for recent.json to be generated,
// then reads and returns the JSON results.
func handleDaedalus(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS requests.
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Decode the request JSON.
	var req struct {
		Preset     string `json:"preset"`
		StartIndex int    `json:"start_index"`
		EndIndex   int    `json:"end_index"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	// If the client sends "standard" or empty, map it to a valid preset.
	if req.Preset == "standard" || req.Preset == "" {
		req.Preset = "hardware-t_batch_0"
	}

	presetPath := filepath.Join("./presets", req.Preset)
	if _, err := os.Stat(presetPath); os.IsNotExist(err) {
		http.Error(w, "preset not found", http.StatusNotFound)
		return
	}

	// Prepare the destination folder: ./walksat/problems.
	problemsDir := filepath.Join("./walksat", "problems")
	os.RemoveAll(problemsDir)
	if err := os.MkdirAll(problemsDir, 0755); err != nil {
		http.Error(w, fmt.Sprintf("failed to create problems directory: %v", err), http.StatusInternalServerError)
		return
	}

	// List all .cnf files in the preset folder.
	files, err := filepath.Glob(filepath.Join(presetPath, "*.cnf"))
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to list CNF files: %v", err), http.StatusInternalServerError)
		return
	}
	if len(files) == 0 {
		http.Error(w, "no CNF files found in preset", http.StatusNotFound)
		return
	}

	// Apply start and end index filtering.
	if req.StartIndex < 0 {
		req.StartIndex = 0
	}
	if req.EndIndex <= 0 || req.EndIndex > len(files) {
		req.EndIndex = len(files)
	}
	selectedFiles := files[req.StartIndex:req.EndIndex]

	// Copy files into the problems folder with standardized filenames.
	for i, src := range selectedFiles {
		dest := filepath.Join(problemsDir, fmt.Sprintf("%03d.cnf", i))
		input, err := os.ReadFile(src)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to read file %s: %v", src, err), http.StatusInternalServerError)
			return
		}
		if err := os.WriteFile(dest, input, 0644); err != nil {
			http.Error(w, fmt.Sprintf("failed to write file %s: %v", dest, err), http.StatusInternalServerError)
			return
		}
	}

	// Execute the client binary from within the "./walksat" folder.
	cmd := exec.Command("./client")
	cmd.Dir = "./walksat"
	// Capture combined stdout and stderr for debugging.
	output, err := cmd.CombinedOutput()
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to run client: %v\nOutput: %s", err, string(output)), http.StatusInternalServerError)
		return
	}
	// Log the output from the client.
	fmt.Println("Client output:", string(output))

	// Wait for recent.json to be generated (up to 2 seconds).
	recentPath := filepath.Join("./walksat", "recent.json")
	var data []byte
	waitTime := 2 * time.Second
	start := time.Now()
	for {
		data, err = os.ReadFile(recentPath)
		if err == nil && len(data) > 0 {
			break
		}
		if time.Since(start) > waitTime {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if err != nil || len(data) == 0 {
		http.Error(w, "recent.json not generated in time", http.StatusInternalServerError)
		return
	}
	// Log the content of recent.json for debugging.
	fmt.Println("recent.json content:", string(data))

	// Validate the JSON content.
	var jsonData interface{}
	if err := json.Unmarshal(data, &jsonData); err != nil {
		http.Error(w, fmt.Sprintf("failed to parse recent.json: %v", err), http.StatusInternalServerError)
		return
	}

	// Return the JSON data.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(jsonData)
}

func main() {
	// Register endpoints.
	http.HandleFunc("/presets", handleListPresets)
	http.HandleFunc("/max-tests", handleMaxTests)
	http.HandleFunc("/daedalus", handleDaedalus)

	fmt.Println("API server starting on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
