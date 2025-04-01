package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

type Job struct {
	ID          string    `json:"id"`
	DeviceID    string    `json:"device_id"`
	TestType    string    `json:"test_type"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	CompletedAt time.Time `json:"completed_at,omitempty"`
}

type DeviceStatus struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Connected bool   `json:"connected"`
}

type HardwareAPI struct {
	jobs     map[string]Job
	devices  map[string]DeviceStatus
	jobQueue []string
	mutex    sync.Mutex
}

func NewHardwareAPI() *HardwareAPI {
	return &HardwareAPI{
		jobs:     make(map[string]Job),
		devices:  make(map[string]DeviceStatus),
		jobQueue: []string{},
	}
}

func (api *HardwareAPI) RegisterHandlers() {
	http.HandleFunc("/api/status", api.handleStatus)
	http.HandleFunc("/api/devices", api.handleDevices)
	http.HandleFunc("/api/jobs", api.handleJobs)
	http.HandleFunc("/api/queue-job", api.handleQueueJob)
}

func (api *HardwareAPI) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	status := map[string]interface{}{
		"status":       "online",
		"device_count": len(api.devices),
		"job_count":    len(api.jobs),
		"queue_size":   len(api.jobQueue),
	}

	json.NewEncoder(w).Encode(status)
}

func (api *HardwareAPI) handleDevices(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	api.mutex.Lock()
	defer api.mutex.Unlock()

	devices := make([]DeviceStatus, 0, len(api.devices))
	for _, device := range api.devices {
		devices = append(devices, device)
	}

	json.NewEncoder(w).Encode(devices)
}

func (api *HardwareAPI) handleJobs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	api.mutex.Lock()
	defer api.mutex.Unlock()

	jobs := make([]Job, 0, len(api.jobs))
	for _, job := range api.jobs {
		jobs = append(jobs, job)
	}

	json.NewEncoder(w).Encode(jobs)
}

func (api *HardwareAPI) handleQueueJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var newJob Job
	if err := json.NewDecoder(r.Body).Decode(&newJob); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate a simple ID if not provided
	if newJob.ID == "" {
		newJob.ID = fmt.Sprintf("job-%d", time.Now().Unix())
	}

	newJob.Status = "queued"
	newJob.CreatedAt = time.Now()

	api.mutex.Lock()
	defer api.mutex.Unlock()

	// Check if device exists
	if _, exists := api.devices[newJob.DeviceID]; !exists {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	api.jobs[newJob.ID] = newJob
	api.jobQueue = append(api.jobQueue, newJob.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newJob)

	// Simulate starting the job processing in background
	go api.processJobs()
}

func (api *HardwareAPI) processJobs() {
	api.mutex.Lock()
	if len(api.jobQueue) == 0 {
		api.mutex.Unlock()
		return
	}

	// Get the next job
	jobID := api.jobQueue[0]
	api.jobQueue = api.jobQueue[1:]
	job := api.jobs[jobID]
	job.Status = "running"
	api.jobs[jobID] = job
	api.mutex.Unlock()

	// Simulate hardware interaction
	log.Printf("Running job %s on device %s\n", job.ID, job.DeviceID)
	time.Sleep(5 * time.Second)

	// Update job status
	api.mutex.Lock()
	job = api.jobs[jobID]
	job.Status = "completed"
	job.CompletedAt = time.Now()
	api.jobs[jobID] = job
	api.mutex.Unlock()

	log.Printf("Completed job %s\n", job.ID)
}

func main() {
	api := NewHardwareAPI()

	// Add some sample devices
	api.devices["device-001"] = DeviceStatus{
		ID:        "device-001",
		Name:      "Test Machine Alpha",
		Status:    "idle",
		Connected: true,
	}

	api.devices["device-002"] = DeviceStatus{
		ID:        "device-002",
		Name:      "Test Machine Beta",
		Status:    "idle",
		Connected: true,
	}

	api.RegisterHandlers()

	fmt.Println("Hardware API server starting on port 5000...")
	log.Fatal(http.ListenAndServe(":5000", nil))
}
