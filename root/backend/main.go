package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Environment variables
var (
	port        = getEnv("PORT", "8080")
	environment = getEnv("ENVIRONMENT", "development")
	uploadDir   = getEnv("UPLOAD_DIR", "uploads")
	apiPrefix   = getEnv("API_PREFIX", "/api")
)

// Global base directory
var baseDir string

func init() {
	var err error
	baseDir, err = os.Getwd()
	if err != nil {
		log.Fatal("Failed to get working directory: ", err)
	}
	log.Printf("Server starting in directory: %s", baseDir)

	uploadPath := filepath.Join(baseDir, uploadDir)
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		log.Fatal("Failed to create upload directory: ", err)
	}
	log.Printf("Upload directory: %s", uploadPath)
}

// APIResponse represents a standardized JSON response.
type APIResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
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
	Status    string  `json:"status"`          // "SAT", "UNSAT", or "UNKNOWN"
	TimeMs    float64 `json:"time_ms"`         // Time taken in milliseconds
	Variables int     `json:"variables"`       // Number of variables in the problem
	Clauses   int     `json:"clauses"`         // Number of clauses in the problem
	Solver    string  `json:"solver"`          // Name of the solver used
	FileName  string  `json:"file_name"`       // Original file name
	Error     string  `json:"error,omitempty"` // Error message if any
}

// getEnv returns the value of the environment variable key if set or the defaultValue.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// corsMiddleware adds CORS headers to the response.
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		allowedOrigin := "https://dacroq.eecs.umich.edu"
		if environment == "development" {
			allowedOrigin = "http://localhost:3000"
		}
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Cache-Control")
		log.Printf("CORS headers set for origin: %s", allowedOrigin)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

// handleHealth is a simple health check endpoint.
func handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "ok",
		Message: "Server is running",
	})
}

// processFiles runs convert.py (located in tools/Model2JSON) to convert simulation CSV data.
// It expects that convert.py produces a JSON file named [batch]_benchmark.json in the output directory.
func processFiles(submissionPath string, batchName string) error {
	scriptDir := filepath.Join(baseDir, "tools", "Model2JSON")
	cmd := exec.Command("python3", "convert.py",
		"--batch", batchName,
		"--sims-dir", "sims",
		"--output-dir", "output")
	cmd.Dir = scriptDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("convert.py failed: %v, output: %s", err, string(output))
	}
	return nil
}

// unzipFile extracts the ZIP archive at src into dst.
func unzipFile(src, dst string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, f := range r.File {
		// Skip directories and macOS system files.
		if f.FileInfo().IsDir() ||
			strings.HasPrefix(f.Name, "__MACOSX/") ||
			strings.HasPrefix(filepath.Base(f.Name), "._") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		fpath := filepath.Join(dst, f.Name)
		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			rc.Close()
			return err
		}
		outFile, err := os.Create(fpath)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

// uploadHandler processes file uploads. It saves the files into a unique submission directory,
// unzips ZIP archives, and for each CSV file, it runs convert.py. The conversion output JSON is read
// and wrapped (if necessary) with extra metadata (submission_id and submitter) before being returned.
func uploadHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Starting file upload handler")
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
		return
	}

	submitter := r.FormValue("submitter")
	if submitter == "" {
		submitter = "anonymous"
	}
	submissionID := fmt.Sprintf("%d", time.Now().UnixNano())
	submissionDir := filepath.Join(baseDir, uploadDir, submissionID)
	if err := os.MkdirAll(submissionDir, os.ModePerm); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create submission directory: %v", err), http.StatusInternalServerError)
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		http.Error(w, "No files uploaded", http.StatusBadRequest)
		return
	}
	log.Printf("Processing %d files", len(files))
	var results []json.RawMessage

	// Prepare conversion directories (for CSV processing).
	scriptDir := filepath.Join(baseDir, "tools", "Model2JSON")
	simsDir := filepath.Join(scriptDir, "sims")
	outputDir := filepath.Join(scriptDir, "output")
	// Clean up and recreate sims and output directories.
	os.RemoveAll(simsDir)
	os.RemoveAll(outputDir)
	if err := os.MkdirAll(simsDir, 0755); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create sims directory: %v", err), http.StatusInternalServerError)
		return
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create output directory: %v", err), http.StatusInternalServerError)
		return
	}

	// Process each uploaded file.
	for i, fileHeader := range files {
		log.Printf("Processing file %d: %s", i, fileHeader.Filename)
		file, err := fileHeader.Open()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to open file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
			return
		}
		defer file.Close()

		destPath := filepath.Join(submissionDir, fileHeader.Filename)
		dst, err := os.Create(destPath)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
			return
		}
		if _, err := io.Copy(dst, file); err != nil {
			dst.Close()
			http.Error(w, fmt.Sprintf("Failed to save file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
			return
		}
		dst.Close()

		// If the file is a ZIP archive, unzip it.
		if strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".zip") {
			if err := unzipFile(destPath, submissionDir); err != nil {
				http.Error(w, fmt.Sprintf("Failed to unzip file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
				return
			}
		}

		// For CSV files, perform conversion.
		if strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".csv") {
			// Use the original file name (without extension) as the batch name.
			batchName := strings.TrimSuffix(fileHeader.Filename, filepath.Ext(fileHeader.Filename))
			simsFile := filepath.Join(simsDir, fmt.Sprintf("%s.csv", batchName))
			csvFile, err := os.Open(destPath)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to open CSV file %s: %v", fileHeader.Filename, err), http.StatusInternalServerError)
				return
			}
			outCSV, err := os.Create(simsFile)
			if err != nil {
				csvFile.Close()
				http.Error(w, fmt.Sprintf("Failed to create CSV copy: %v", err), http.StatusInternalServerError)
				return
			}
			if _, err := io.Copy(outCSV, csvFile); err != nil {
				csvFile.Close()
				outCSV.Close()
				http.Error(w, fmt.Sprintf("Failed to copy CSV: %v", err), http.StatusInternalServerError)
				return
			}
			csvFile.Close()
			outCSV.Close()

			// Run conversion.
			if err := processFiles(submissionDir, batchName); err != nil {
				log.Printf("Conversion error for batch %s: %v", batchName, err)
				// Use fallback if conversion fails.
			}

			// Read the conversion output JSON.
			jsonFile := filepath.Join(outputDir, fmt.Sprintf("%s_benchmark.json", batchName))
			var raw interface{}
			if _, err := os.Stat(jsonFile); os.IsNotExist(err) {
				log.Printf("Output JSON not found for batch %s", batchName)
				raw = map[string]interface{}{
					"overview": map[string]interface{}{
						"total_problems":    1,
						"solved_problems":   0,
						"unsolved_problems": 1,
						"success_rate":      "0%",
						"avg_cycles":        0,
						"avg_power_mw":      "0.00",
						"solver_name":       "Unknown",
						"hardware":          []string{"Unknown"},
					},
					"benchmarks": []interface{}{
						map[string]interface{}{
							"batch":      batchName,
							"message":    "No benchmark data produced",
							"file_count": 1,
						},
					},
				}
			} else {
				bytes, err := os.ReadFile(jsonFile)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to read output JSON for batch %s: %v", batchName, err), http.StatusInternalServerError)
					return
				}
				if err := json.Unmarshal(bytes, &raw); err != nil {
					http.Error(w, fmt.Sprintf("Failed to parse output JSON for batch %s: %v", batchName, err), http.StatusInternalServerError)
					return
				}
			}

			// Add submission metadata
			switch v := raw.(type) {
			case map[string]interface{}:
				v["submission_id"] = submissionID
				v["batch"] = batchName
				v["original_filename"] = fileHeader.Filename
				// Only store email hash, not the actual email
				if submitter != "anonymous" {
					v["submitter"] = "***"
				} else {
					v["submitter"] = submitter
				}
			}

			resultsBytes, err := json.Marshal(raw)
			if err != nil {
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			results = append(results, resultsBytes)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if len(results) == 0 {
		json.NewEncoder(w).Encode(APIResponse{
			Status:  "success",
			Message: "Files uploaded (no CSV conversion performed)",
			Data: map[string]interface{}{
				"submission_id": submissionID,
				"file_count":    len(files),
			},
		})
		return
	}
	// Write out the JSON array.
	w.Write([]byte("["))
	for i, result := range results {
		if i > 0 {
			w.Write([]byte(","))
		}
		w.Write(result)
	}
	w.Write([]byte("]"))

	// Schedule cleanup after 20 minutes.
	go func() {
		time.Sleep(20 * time.Minute)
		os.RemoveAll(submissionDir)
	}()
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(APIResponse{
		Status: "success",
		Data:   results,
	})
}

// processCNFFile runs the specified solver on a CNF file and returns the results
func processCNFFile(filepath string, solver SolverType) SolverResult {
	// TODO: Implement actual solver logic
	// For now, return dummy results
	return SolverResult{
		Status:    "SAT",
		TimeMs:    100.0,
		Variables: 100,
		Clauses:   400,
		Solver:    string(solver),
		FileName:  filepath,
	}
}

func main() {
	var err error
	baseDir, err = os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc(apiPrefix+"/health", corsMiddleware(handleHealth))
	mux.HandleFunc(apiPrefix+"/upload", corsMiddleware(uploadHandler))
	mux.HandleFunc(apiPrefix+"/solve", corsMiddleware(handleSolve)) // Add the solve endpoint
	log.Printf("Server starting on port %s with API prefix '%s'", port, apiPrefix)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
