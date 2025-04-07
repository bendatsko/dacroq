package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleGetTestCNFEndpoint(t *testing.T) {
	// Create test directory structure
	tmpDir := t.TempDir()
	presetDir := filepath.Join(tmpDir, "presets", "test_preset")
	err := os.MkdirAll(presetDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}

	// Create test CNF file
	testCNFContent := "c Test CNF file\np cnf 3 3\n1 2 3 0\n-1 -2 3 0\n1 -2 -3 0\n"
	err = os.WriteFile(filepath.Join(presetDir, "test.cnf"), []byte(testCNFContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test CNF file: %v", err)
	}

	// Save original presetsDir and restore it after test
	originalPresetsDir := presetsDir
	presetsDir = filepath.Join(tmpDir, "presets")
	defer func() { presetsDir = originalPresetsDir }()

	// Test by name
	req, err := http.NewRequest("GET", "/get-test-cnf?preset=test_preset&test=test.cnf", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	rr := httptest.NewRecorder()
	handleGetTestCNF(rr, req)

	// Check response
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify response contents
	if response["filename"] != "test.cnf" {
		t.Errorf("Expected filename 'test.cnf', got '%v'", response["filename"])
	}
	if response["preset"] != "test_preset" {
		t.Errorf("Expected preset 'test_preset', got '%v'", response["preset"])
	}
	if response["cnf"] != testCNFContent {
		t.Errorf("Expected CNF content '%s', got '%v'", testCNFContent, response["cnf"])
	}

	// Test by index
	req, err = http.NewRequest("GET", "/get-test-cnf?preset=test_preset&index=0", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	rr = httptest.NewRecorder()
	handleGetTestCNF(rr, req)

	// Check response
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	response = nil
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Verify response
	if response["filename"] != "test.cnf" {
		t.Errorf("Expected filename 'test.cnf', got '%v'", response["filename"])
	}
}

func TestHandleGetTestCNFEndpointWithMissingParams(t *testing.T) {
	// Test missing preset
	req, err := http.NewRequest("GET", "/get-test-cnf?test=test.cnf", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	rr := httptest.NewRecorder()
	handleGetTestCNF(rr, req)

	// Should get bad request for missing preset
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusBadRequest)
	}

	// Test missing test and index
	req, err = http.NewRequest("GET", "/get-test-cnf?preset=test_preset", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	rr = httptest.NewRecorder()
	handleGetTestCNF(rr, req)

	// Should get bad request for missing test and index
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusBadRequest)
	}
}
