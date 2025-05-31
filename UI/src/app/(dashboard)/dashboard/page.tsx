"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    RiAddLine,
    RiSearchLine,
    RiRefreshLine,
    RiPlayLine,
    RiDownload2Line,
    RiDeleteBin5Line,
    RiFilterLine,
    RiEyeLine,
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiTestTubeLine,
    RiTimeLine,
    RiCheckLine,
    RiCloseLine,
    RiFileListLine,
    RiMoreFill,
    RiBarChartLine,
    RiArrowRightLine,
    RiCpuLine,
    RiInformationLine
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/DropdownMenu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/Checkbox";
import { TestRun } from "@/types/test";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE = "/api/proxy";

interface LdpcJob {
    id: string;
    name: string;
    algorithm_type: 'analog_hardware' | 'digital_hardware';
    test_mode: 'custom_message' | 'pre_written' | 'random_string' | 'ber_test';
    message_content?: string;
    noise_level: number;
    status: 'queued' | 'running' | 'completed' | 'error' | 'stopped';
    created: string;
    success_rate?: number;
    total_execution_time?: number;
    original_message?: string;
    corrupted_message?: string;
    decoded_message?: string;
    correction_successful?: boolean;
}

// Helper to map LDPC jobs to TestRun format
function mapLdpcJobToTestRun(job: LdpcJob): TestRun {
    // Map LDPC job status to TestRun status
    let status: TestRun["status"] =
        job.status === "error"
            ? "failed"
            : job.status === "stopped"
            ? "failed"
            : (job.status as any) === "queued" || (job.status as any) === "running" || (job.status as any) === "completed"
            ? (job.status as any)
            : "queued";
    return {
        id: job.id,
        name: job.name,
        chipType: "LDPC",
        processorType: "ARM (Teensy 4.1)",
        testType: job.test_mode || "LDPC Test",
        status,
        createdAt: job.created,
        results: {
            success_rate: job.success_rate,
            total_execution_time: job.total_execution_time,
            correction_successful: job.correction_successful,
            original_message: job.original_message,
            decoded_message: job.decoded_message,
            test_mode: job.test_mode,
            algorithm_type: job.algorithm_type,
            noise_level: job.noise_level,
        },
    };
}

// Helper to get platform string
function getPlatform(test: TestRun): string {
    if (test.chipType === 'LDPC') {
        const algo = test.results?.algorithm_type;
        if (algo === 'analog_hardware') return 'ldpc (analog)';
        if (algo === 'digital_hardware') return 'ldpc (digital)';
        if (algo === 'mixedsignal_hardware') return 'ldpc (mixedsignal)';
        return 'ldpc (unknown)';
    }
    if (test.chipType === '3SAT' || test.chipType === 'KSAT') {
        return `sat (unknown)`;
    }
    return test.chipType?.toLowerCase() || 'unknown';
}

// Helper to format EST date/time
function formatDateTimeEST(dateString: string | undefined) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { timeZone: 'America/New_York' });
}

export default function Dashboard() {
    const router = useRouter();
    const [tests, setTests] = useState<TestRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [apiConnected, setApiConnected] = useState(true);

    // State for filters
    const [chipTypeFilter, setChipTypeFilter] = useState("all");
    const [testTypeFilter, setTestTypeFilter] = useState("all");
    const [processorTypeFilter] = useState("all");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [testsPerPage] = useState(10);

    // LDPC-specific state
    const [ldpcJobDetails, setLdpcJobDetails] = useState<Record<string, any>>({});
    const [selectedLdpcJobForModal, setSelectedLdpcJobForModal] = useState<string | null>(null);

    // SAT-specific state
    const [satTestDetails, setSatTestDetails] = useState<Record<string, any>>({});
    const [selectedSatTestForModal, setSelectedSatTestForModal] = useState<string | null>(null);


    // Helper functions for date formatting
    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (dateString: string | undefined) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Load LDPC job details
    const loadLdpcJobDetails = async (jobId: string) => {
        try {
            const response = await fetch(`${API_BASE}/ldpc/jobs/${jobId}`);
            if (response.ok) {
                const details = await response.json();
                setLdpcJobDetails(prev => ({ ...prev, [jobId]: details }));
            }
        } catch (error) {
            console.error('Error loading LDPC job details:', error);
        }
    };

    // Load SAT test details
    const loadSatTestDetails = async (testId: string) => {
        try {
            const response = await fetch(`${API_BASE}/tests/${testId}`);
            if (response.ok) {
                const details = await response.json();
                setSatTestDetails(prev => ({ ...prev, [testId]: details }));
            }
        } catch (error) {
            console.error('Error loading SAT test details:', error);
        }
    };

// VLSI/Computer Architecture Statistics Calculator (from LDPC dashboard)
    const calculateVLSIMetrics = (results: any[], algorithmType: string, jobId?: string) => {
        // Use REAL API data only - no mock data for researchers
        if (!results || !Array.isArray(results) || results.length === 0) {
            console.warn('No real test results available for job:', jobId);
            return null;
        }
        const totalResults = results.length;
        const successfulResults = results.filter(r => r.success);
        const failedResults = results.filter(r => !r.success);

        // Basic Performance Metrics from REAL data
        const totalExecutionTime = results.reduce((acc, r) => acc + (r.execution_time || 0), 0);
        const avgExecutionTime = totalResults > 0 ? totalExecutionTime / totalResults : 0;
        const executionTimes = results.map(r => r.execution_time || 0).filter(t => t > 0);
        const minExecutionTime = executionTimes.length > 0 ? Math.min(...executionTimes) : 0;
        const maxExecutionTime = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;

        // Error Rate Analysis from REAL data
        const totalBitErrors = results.reduce((acc, r) => acc + (r.bit_errors || 0), 0);
        const avgBitErrors = totalResults > 0 ? totalBitErrors / totalResults : 0;
        const frameErrorRate = totalResults > 0 ? failedResults.length / totalResults : 0;
        const bitErrorRate = totalResults > 0 ? totalBitErrors / (totalResults * 96) : 0; // 96-bit LDPC code

        // Iteration Analysis (Convergence) from REAL data
        const totalIterations = results.reduce((acc, r) => acc + (r.iterations || 0), 0);
        const avgIterations = totalResults > 0 ? totalIterations / totalResults : 0;
        const iterationCounts = results.map(r => r.iterations || 0);
        const maxIterations = iterationCounts.length > 0 ? Math.max(...iterationCounts) : 0;

        // VLSI-specific metrics
        const codeLength = 96; // (96,48) LDPC code
        const informationBits = 48;
        const redundancyBits = codeLength - informationBits;

        // Throughput Calculations using REAL timing data
        const codeRate = informationBits / codeLength; // 0.5 for (96,48)
        const avgThroughput = avgExecutionTime > 0 ? (informationBits / (avgExecutionTime / 1000)) / 1e6 : 0; // Mbps
        const peakThroughput = minExecutionTime > 0 ? (informationBits / (minExecutionTime / 1000)) / 1e6 : 0; // Mbps

        // Energy Efficiency using REAL power consumption data
        const powerConsumptions = results.map(r => r.power_consumption || 0).filter(p => p > 0);
        const avgPowerConsumption = powerConsumptions.length > 0 ?
            powerConsumptions.reduce((acc, p) => acc + p, 0) / powerConsumptions.length : 0;

        // Calculate energy per bit from REAL data
        const energyPerBit = avgPowerConsumption > 0 && avgExecutionTime > 0 ?
            (avgPowerConsumption * (avgExecutionTime / 1000) * 1e-3) / informationBits * 1e12 : 0; // pJ/bit

        // Latency Analysis from REAL data (convert ms to μs)
        const avgLatency = avgExecutionTime * 1000; // μs
        const minLatency = minExecutionTime * 1000; // μs
        const maxLatency = maxExecutionTime * 1000; // μs

        return {
            // Performance Metrics from REAL API data
            successRate: totalResults > 0 ? successfulResults.length / totalResults : 0,
            frameErrorRate,
            bitErrorRate,

            // Timing Analysis from REAL API data
            avgExecutionTime, // ms (already in ms from API)
            minExecutionTime, // ms
            maxExecutionTime, // ms
            avgLatency, // μs
            minLatency, // μs
            maxLatency, // μs

            // Throughput from REAL API data
            avgThroughput, // Mbps
            peakThroughput, // Mbps
            codeRate,

            // Power & Energy from REAL API data
            avgPowerConsumption, // mW
            energyPerBit, // pJ/bit

            // Convergence Analysis from REAL API data
            avgIterations,
            maxIterations,
            totalIterations,

            // Code Properties
            codeLength,
            informationBits,
            redundancyBits,

            // Error Analysis from REAL API data
            totalBitErrors,
            avgBitErrors,

            // Performance comparisons (only show if we have valid data)
            energyEfficiencyRatio: algorithmType === 'analog_hardware' && energyPerBit > 0 ?
                Math.max(1.0, 60.0 / energyPerBit) : 1.0, // Compare to 60 pJ/bit digital baseline
            speedupFactor: algorithmType === 'analog_hardware' && avgExecutionTime > 0 ?
                Math.max(1.0, 1.0 / avgExecutionTime) : 1.0 // Compare to 1ms digital baseline
        };
    };



    // Helper to get success rate as fraction and percent
    function getSuccessRate(test: TestRun): { fraction: string, percent: string } {
        if (test.chipType === 'LDPC') {
            // Use VLSI metrics if available
            const resultsArr = Array.isArray(test.results?.results) ? test.results.results : [];
            if (resultsArr.length > 0) {
                const vlsi = calculateVLSIMetrics(resultsArr, test.results?.algorithm_type, test.id);
                if (vlsi) {
                    const completed = resultsArr.length;
                    const succeeded = Math.round(vlsi.successRate * completed);
                    return {
                        fraction: `${succeeded}/${completed}`,
                        percent: `${(vlsi.successRate * 100).toFixed(1)}%`
                    };
                }
            }
        }
        if ((test.chipType === '3SAT' || test.chipType === 'KSAT') && test.results?.satResults) {
            const solved = test.results.satResults.problemsSolved || 0;
            const total = test.results.satResults.totalProblems || test.results.satResults.satIterations || 0;
            if (total > 0) {
                return {
                    fraction: `${solved}/${total}`,
                    percent: `${((solved / total) * 100).toFixed(1)}%`
                };
            }
        }
        return { fraction: 'N/A', percent: '' };
    }



    // Handle test actions like delete, rerun, etc.
    const handleTestAction = async (action: 'delete' | 'rerun' | 'download', testId: string) => {
        if (action === 'rerun') {
            handleRerunTest(testId);
        } else if (action === 'download') {
            try {
                const res = await fetch(`${API_BASE}/tests/${testId}/download`);
                if (!res.ok) {
                    throw new Error('Failed to download test results');
                }

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `test-${testId}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

                toast({
                    title: "Download started",
                    description: "Your test results are being downloaded.",
                });
            } catch (err) {
                console.error(err);
                toast({
                    title: "Download failed",
                    description: "Failed to download test results. Please try again.",
                    variant: "destructive",
                });
            }
        }
    };

    // Handle bulk actions
    const handleBulkAction = async (action: 'delete' | 'rerun' | 'download') => {
        if (action === 'delete') {
            if (selectedTests.length === 0) return;

            // Ask for confirmation
            if (window.confirm(`Are you sure you want to delete ${selectedTests.length} tests?`)) {
                try {
                    setIsLoading(true);
                    console.log(`Deleting ${selectedTests.length} tests...`, selectedTests);

                    let successCount = 0;
                    let failCount = 0;

                    for (const testId of selectedTests) {
                        try {
                            console.log(`Deleting test ${testId}...`);
                            const test = tests.find(t => t.id === testId);
                            let response, responseText;
                            if (test && test.chipType === 'LDPC') {
                                response = await fetch(`${API_BASE}/ldpc/jobs/${testId}`, {
                                    method: 'DELETE',
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Accept": "application/json"
                                    },
                                });
                                responseText = await response.text();
                            } else {
                                response = await fetch(`${API_BASE}/tests/${testId}`, {
                                    method: 'DELETE',
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Accept": "application/json"
                                    },
                                });
                                responseText = await response.text();
                            }
                            console.log(`Response for ${testId}:`, response.status, responseText);
                            if (response.ok) {
                                successCount++;
                            } else {
                                failCount++;
                                console.error(`Failed to delete test ${testId}: ${response.status} ${responseText}`);
                            }
                        } catch (err) {
                            failCount++;
                            console.error(`Error processing delete for test ${testId}:`, err);
                        }
                    }

                    // Show results
                    if (successCount > 0) {
                        toast({
                            title: "Success",
                            description: `Successfully deleted ${successCount} tests${failCount > 0 ? ` (${failCount} failed)` : ''}`,
                            variant: "success",
                        });
                    } else if (failCount > 0) {
                        toast({
                            title: "Error",
                            description: `Failed to delete ${failCount} tests`,
                            variant: "error",
                        });
                    }

                    // Refresh the tests list
                    fetchTests();
                    setSelectedTests([]);
                } catch (error) {
                    console.error("Error in bulk delete operation:", error);
                    toast({
                        title: "Error",
                        description: `Failed to delete tests: ${error instanceof Error ? error.message : String(error)}`,
                        variant: "error",
                    });
                } finally {
                    setIsLoading(false);
                }
            }
        } else if (action === 'rerun') {
            if (selectedTests.length === 0) return;

            // Rerun all selected tests
            try {
                setIsLoading(true);
                // Create a batch of promises for each test rerun
                const rerunPromises = selectedTests.map(testId =>
                    fetch(`${API_BASE}/tests/${testId}/rerun`, {
                        method: 'POST',
                    })
                );

                await Promise.all(rerunPromises);

                // Refresh the tests list
                fetchTests();
                setSelectedTests([]);
            } catch (error) {
                console.error("Error rerunning tests:", error);
                setError("Failed to rerun tests. Please try again.");
            } finally {
                setIsLoading(false);
            }
        } else if (action === 'download') {
            if (selectedTests.length === 0) return;

            // Download all selected tests
            try {
                for (const testId of selectedTests) {
                    const res = await fetch(`${API_BASE}/tests/${testId}/download`);
                    if (!res.ok) continue;

                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `test-${testId}-results.zip`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
            } catch (error) {
                console.error("Error downloading test results:", error);
                setError("Failed to download test results. Please try again.");
            }
        }
    };

    // For TypeScript type safety with the selectedTest
    const handleRerunTest = async (testId: string) => {
        try {
            const response = await fetch(`${API_BASE}/tests/${testId}/rerun`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(errorData.error || `API responded with status: ${response.status}`);
            }

            const data = await response.json();
            toast({
                title: "Success",
                description: "Test rerun started",
                variant: "success",
            });

            // Refresh the tests list
            fetchTests();
        } catch (error) {
            console.error("Error rerunning test:", error);
            toast({
                title: "Error",
                description: `Failed to rerun test: ${error instanceof Error ? error.message : String(error)}`,
                variant: "error",
            });
        }
    };

// Handle row click - open details drawer
    const handleRowClick = (test: TestRun) => {
        if (test.chipType === 'LDPC') {
            // For LDPC tests, open the LDPC modal
            openLdpcJobResultsModal(test.id);
        } else if (test.chipType === '3SAT' || test.chipType === 'KSAT') {
            // For SAT tests, open the SAT modal
            openSatTestResultsModal(test.id);
        }
    };

// Modal handler for viewing detailed LDPC job results
    const openLdpcJobResultsModal = async (jobId: string) => {
        if (!ldpcJobDetails[jobId]) {
            await loadLdpcJobDetails(jobId);
        }
        setSelectedLdpcJobForModal(jobId);
    };

    // Modal handler for viewing detailed SAT test results
    const openSatTestResultsModal = async (testId: string) => {
        if (!satTestDetails[testId]) {
            await loadSatTestDetails(testId);
        }
        setSelectedSatTestForModal(testId);
    };

    // Function to fetch tests from API
    const fetchTests = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Get stored user info
            let user;
            try {
                const storedUser = localStorage.getItem("user");
                if (!storedUser) {
                    router.push("/login");
                    return;
                }
                user = JSON.parse(storedUser);
                setIsAdmin(user.role === "admin");
            } catch (e) {
                console.error("Error getting user from localStorage:", e);
                router.push("/login");
                return;
            }
            // Fetch both generic tests and LDPC jobs
            const apiUrl = `${API_BASE}/tests`;
            const ldpcUrl = `${API_BASE}/ldpc/jobs`;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const [res, ldpcRes] = await Promise.all([
                    fetch(apiUrl, {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                            "Cache-Control": "no-cache",
                        },
                        signal: controller.signal,
                    }),
                    fetch(ldpcUrl, {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                            "Cache-Control": "no-cache",
                        },
                    }),
                ]);
                clearTimeout(timeoutId);
                if (!res.ok && !ldpcRes.ok) {
                    // API is offline
                    setApiConnected(false);
                    setTests([]);
                    return;
                }
                // Parse both responses
                let testsArray: any[] = [];
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        testsArray = data;
                    } else if (data && Array.isArray(data.tests)) {
                        testsArray = data.tests;
                    }
                }
                let ldpcArray: LdpcJob[] = [];
                if (ldpcRes.ok) {
                    const ldpcData = await ldpcRes.json();
                    if (ldpcData && Array.isArray(ldpcData.jobs)) {
                        ldpcArray = ldpcData.jobs;
                    }
                }
                // Map and merge
                const mappedTests = testsArray.map((test: any) => ({
                    id: test.id,
                    name: test.name,
                    chipType: test.chip_type || test.chipType || "LDPC",
                    processorType: test.processorType || "ARM (Teensy 4.1)",
                    testType: test.test_mode || test.testType || "Hardware Test",
                    status: test.status === "error" ? "failed" : test.status || "completed",
                    createdAt: test.createdAt || test.created_at || test.created || new Date().toISOString(),
                    duration: test.duration || null,
                    results: test.results || null,
                }));
                const mappedLdpcTests = ldpcArray.map(mapLdpcJobToTestRun);
                // Merge and sort by createdAt
                const allTests = [...mappedTests, ...mappedLdpcTests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setTests(allTests);
                setApiConnected(true);
                setError(null);
            } catch (fetchError) {
                // API is offline
                setApiConnected(false);
                setTests([]);
            }
        } catch (error) {
            // Unexpected error
            setApiConnected(false);
            setTests([]);
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    // Load tests on component mount
    useEffect(() => {
        fetchTests();
    }, [fetchTests]);

    // Poll API health with better error handling
    useEffect(() => {
        const checkApiHealth = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

                const res = await fetch(`${API_BASE}/health`, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (res.ok) {
                    await res.json(); // Just to check if the response is valid JSON
                    setApiConnected(true);
                    // Only refresh if we were previously offline
                    if (!apiConnected) {
                        fetchTests();
                    }
                } else {
                    setApiConnected(false);
                    setTests([]);
                }
            } catch (e) {
                setApiConnected(false);
                setTests([]);
            }
        };

        // Check immediately, then every 30 seconds
        checkApiHealth();
        const intervalId = setInterval(checkApiHealth, 30000);

        return () => clearInterval(intervalId);
    }, [apiConnected, fetchTests]);

    // Add real-time polling for running tests
    useEffect(() => {
        if (!tests.some(t => t.status === "running")) {
            return;
        }

        const pollTests = async () => {
            try {
                const runningTests = tests.filter(t => t.status === "running");
                const promises = runningTests.map(test =>
                    fetch(`${API_BASE}/tests/${test.id}`).then(res => res.json())
                );

                const results = await Promise.all(promises);
                let updated = false;

                setTests(prev => {
                    const newTests = [...prev];
                    results.forEach((result: any) => {
                        const idx = newTests.findIndex(t => t.id === result.id);
                        if (idx !== -1 && newTests[idx].status !== result.status) {
                            newTests[idx] = { ...newTests[idx], ...result };
                            updated = true;
                        }
                    });
                    // Sort by creation date (most recent first)
                    if (updated) {
                        newTests.sort((a, b) => {
                            const dateA = new Date(a.createdAt || a.created || a.created_at || Date.now());
                            const dateB = new Date(b.createdAt || b.created || b.created_at || Date.now());
                            return dateB.getTime() - dateA.getTime();
                        });
                    }
                    return updated ? newTests : prev;
                });
            } catch (e) {
                console.error("Poll tests failed:", e);
            }
        };

        const interval = setInterval(pollTests, 5000);
        return () => clearInterval(interval);
    }, [tests]);

    // Filter & search
    const filteredTests = tests
        .filter((t) => {
            // Apply chip type filter
            if (chipTypeFilter !== "all" && t.chipType !== chipTypeFilter) return false;

            // Apply processor type filter
            if (processorTypeFilter !== "all" && t.processorType !== processorTypeFilter) return false;

            // Apply test type filter
            if (testTypeFilter !== "all" && t.testType !== testTypeFilter) return false;

            // Apply category filter
            if (selectedCategory === "all") return true;
            if (selectedCategory === "3sat") return t.chipType === "3SAT";
            if (selectedCategory === "ksat") return t.chipType === "KSAT";
            if (selectedCategory === "ldpc") return t.chipType === "LDPC";
            if (selectedCategory === "completed") return t.status === "completed";
            if (selectedCategory === "running") return t.status === "running";
            if (selectedCategory === "failed") return t.status === "failed";
            if (selectedCategory === "queued") return t.status === "queued";
            return true;
        })
        .filter(
            (t) =>
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.chipType && t.chipType.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (t.processorType && t.processorType.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (t.testType && t.testType.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (t.status && t.status.toLowerCase().includes(searchQuery.toLowerCase()))
        );

    // Calculate pagination indices
    const indexOfLastTest = currentPage * testsPerPage;
    const indexOfFirstTest = indexOfLastTest - testsPerPage;
    const currentTests = filteredTests.slice(indexOfFirstTest, indexOfLastTest);

    // Counts per category for filters
    const satTestsCount = tests.filter((t) => t.chipType === "3SAT").length;
    const ksatTestsCount = tests.filter((t) => t.chipType === "KSAT").length;
    const ldpcTestsCount = tests.filter((t) => t.chipType === "LDPC").length;

    const cnfProblemCount = tests.filter((t) => t.testType === "CNF Problem").length;
    const binaryFileCount = tests.filter((t) => t.testType === "Binary File").length;
    const snrSweepCount = tests.filter((t) => t.testType === "SNR Sweep").length;
    const hardwareTestCount = tests.filter((t) => t.testType === "Hardware Test").length;
    const integrationTestCount = tests.filter((t) => t.testType === "Integration Test").length;

    // Loading state
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex items-center space-x-2 text-blue-600">
                    <svg
                        className="animate-spin h-6 w-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962
                7.962 0 014 12H0c0 3.042 1.135 5.824 3
                7.938l3-2.647z"
                        />
                    </svg>
                    <span className="text-sm font-medium">Loading dashboard...</span>
                </div>
            </div>
        );
    }

    // Main dashboard
    return (
        <div className="min-h-screen bg-background">
            <div className="flex-1 flex flex-col">

              {/* Main content area */}
              <main className="flex-1 py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                  {/* Welcome Header */}
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">
                      Dashboard
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                      Hardware acceleration platform for LDPC error correction and SAT solving
                    </p>
                  </div>

                  {/* Quick Actions Grid */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                    {/* LDPC Tests Card */}
                    <Link
                      href="/ldpc"
                      className="bg-card text-card-foreground border border-border rounded-2xl p-6 flex flex-col hover:bg-accent transition-colors group card-elevated-hover"
                    >
                      <div className="mb-0">

                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        LDPC Error Correction
                      </h3>
                      <p className="text-sm text-muted-foreground mb-5">
                        Test message error correction with analog and digital hardware acceleration
                      </p>
                      <div className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center group-hover:translate-x-1 transition-transform">
                        Create a Job
                        <RiArrowRightLine className="ml-1 h-4 w-4" />
                      </div>
                    </Link>

                    {/* SAT Tests Card */}
                    <Link
                      href="/sat"
                      className="bg-card text-card-foreground border border-border rounded-2xl p-6 flex flex-col hover:bg-accent transition-colors group card-elevated-hover"
                    >

                      <h3 className="text-lg font-medium text-foreground mb-2">
                        SAT Solving
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 ">
                        Hardware-accelerated Boolean satisfiability solving
                      </p>
                      <div className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center group-hover:translate-x-1 transition-transform">
                        Create a Job
                        <RiArrowRightLine className="ml-1 h-4 w-4" />
                      </div>
                    </Link>

                    {/* Settings Card */}
                    <Link
                      href="/settings"
                      className="bg-card text-card-foreground border border-border rounded-2xl p-6 flex flex-col hover:bg-accent transition-colors group card-elevated-hover"
                    >
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Documentation
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 flex-1">
                      Project abstract, architecture, commands and operations.
                      </p>
                      <div className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center group-hover:translate-x-1 transition-transform">
                        Take me to the docs
                        <RiArrowRightLine className="ml-1 h-4 w-4" />
                      </div>
                    </Link>
                  </div>

                  {/* API Connection Error */}
                  {!apiConnected && (
                    <div className="p-4 mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="text-orange-500 dark:text-orange-400 mt-0.5">
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v4a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">API Offline</h3>
                          <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                            Cannot connect to the test backend API. No test data is available.
                          </p>
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={fetchTests}
                              className="text-sm border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                            >
                              <RiRefreshLine className="mr-1.5 h-4 w-4" />
                              Retry Connection
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-5 w-5 text-red-500">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-foreground mb-1">Error</h3>
                          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="sr-only">Dismiss</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Test Results Section */}
                  <div className="space-y-6">
                    {/* Section Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Test Results</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          View and manage your hardware test runs
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={fetchTests}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          disabled={isLoading}
                        >
                          <RiRefreshLine className={cn("h-4 w-4", isLoading && "animate-spin")} />
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {/* Filters and Search */}
                    <div className="flex flex-col sm:flex-row gap-4 p-6 bg-card border border-border rounded-xl card-elevated">
                      {/* Search */}
                      <div className="flex-1">
                        <div className="relative">
                          <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search tests..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Category Filter */}
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-48">
                          <RiFilterLine className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tests ({tests.length})</SelectItem>
                          <SelectItem value="ldpc">LDPC ({ldpcTestsCount})</SelectItem>
                          <SelectItem value="3sat">3-SAT ({satTestsCount})</SelectItem>
                          <SelectItem value="ksat">K-SAT ({ksatTestsCount})</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="running">Running</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="queued">Queued</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Chip Type Filter */}
                      <Select value={chipTypeFilter} onValueChange={setChipTypeFilter}>
                        <SelectTrigger className="w-40">
                          <RiCpuLine className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Chip Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Chips</SelectItem>
                          <SelectItem value="LDPC">LDPC</SelectItem>
                          <SelectItem value="3SAT">3-SAT</SelectItem>
                          <SelectItem value="KSAT">K-SAT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Bulk Actions */}
                    {selectedTests.length > 0 && (
                      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleBulkAction('rerun')}
                            variant="outline"
                            size="sm"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                          >
                            <RiPlayLine className="mr-1.5 h-4 w-4" />
                            Rerun
                          </Button>
                          <Button
                            onClick={() => handleBulkAction('download')}
                            variant="outline"
                            size="sm"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                          >
                            <RiDownload2Line className="mr-1.5 h-4 w-4" />
                            Download
                          </Button>
                          {isAdmin && (
                            <Button
                              onClick={() => handleBulkAction('delete')}
                              variant="outline"
                              size="sm"
                              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                            >
                              <RiDeleteBin5Line className="mr-1.5 h-4 w-4" />
                              Delete
                            </Button>
                          )}
                          <Button
                            onClick={() => setSelectedTests([])}
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Test Table */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden table-container">
                      {filteredTests.length === 0 ? (
                        <div className="p-12 text-center">
                          <div className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4">
                            <RiTestTubeLine className="h-full w-full" />
                          </div>
                          <h3 className="text-lg font-medium text-foreground mb-2">No tests found</h3>
                          <p className="text-muted-foreground mb-6">
                            {searchQuery || selectedCategory !== "all"
                              ? "Try adjusting your search or filters"
                              : "Start running tests to see results here"}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                                    <Checkbox
                                      checked={selectedTests.length === currentTests.length && currentTests.length > 0}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedTests(currentTests.map(t => t.id));
                                        } else {
                                          setSelectedTests([]);
                                        }
                                      }}
                                    />
                                  </th>
                                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Test</th>
                                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Platform</th>
                                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
                                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Success Rate</th>
                                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Created</th>
                                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {currentTests.map((test) => {
                                  const { fraction, percent } = getSuccessRate(test);
                                  return (
                                    <tr
                                      key={test.id}
                                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                                      onClick={() => handleRowClick(test)}
                                    >
                                      <td className="py-4 px-4">
                                        <Checkbox
                                          checked={selectedTests.includes(test.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedTests(prev => [...prev, test.id]);
                                            } else {
                                              setSelectedTests(prev => prev.filter(id => id !== test.id));
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </td>
                                      <td className="py-4 px-4">
                                        <div>
                                          <div className="font-medium text-foreground">{test.name}</div>
                                          <div className="text-sm text-muted-foreground">{test.testType}</div>
                                        </div>
                                      </td>
                                      <td className="py-4 px-4">
                                        <div className="text-sm">
                                          <div className="font-medium text-foreground">{getPlatform(test)}</div>
                                          <div className="text-muted-foreground">{test.processorType}</div>
                                        </div>
                                      </td>
                                      <td className="py-4 px-4">
                                        <Badge
                                          variant={
                                            test.status === "completed"
                                              ? "default"
                                              : test.status === "running"
                                              ? "secondary"
                                              : test.status === "failed"
                                              ? "destructive"
                                              : "outline"
                                          }
                                          className="flex items-center gap-1.5 w-fit"
                                        >
                                          {test.status === "completed" && <RiCheckLine className="h-3 w-3" />}
                                          {test.status === "running" && <RiTimeLine className="h-3 w-3" />}
                                          {test.status === "failed" && <RiCloseLine className="h-3 w-3" />}
                                          {test.status === "queued" && <RiTimeLine className="h-3 w-3" />}
                                          {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                                        </Badge>
                                      </td>
                                      <td className="py-4 px-4">
                                        <div className="text-sm">
                                          <div className="font-medium text-foreground">{fraction}</div>
                                          {percent && <div className="text-muted-foreground">{percent}</div>}
                                        </div>
                                      </td>
                                      <td className="py-4 px-4">
                                        <div className="text-sm">
                                          <div className="font-medium text-foreground">{formatDate(test.createdAt)}</div>
                                          <div className="text-muted-foreground">{formatTime(test.createdAt)}</div>
                                        </div>
                                      </td>
                                      <td className="py-4 px-4">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                              <RiMoreFill className="h-4 w-4" />
                                              <span className="sr-only">Open menu</span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleRowClick(test)}>
                                              <RiEyeLine className="mr-2 h-4 w-4" />
                                              View Details
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleTestAction('rerun', test.id)}>
                                              <RiPlayLine className="mr-2 h-4 w-4" />
                                              Rerun Test
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleTestAction('download', test.id)}>
                                              <RiDownload2Line className="mr-2 h-4 w-4" />
                                              Download Results
                                            </DropdownMenuItem>
                                            {isAdmin && (
                                              <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  className="text-red-600 dark:text-red-400"
                                                  onClick={() => handleTestAction('delete', test.id)}
                                                >
                                                  <RiDeleteBin5Line className="mr-2 h-4 w-4" />
                                                  Delete Test
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          {filteredTests.length > testsPerPage && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                              <div className="text-sm text-muted-foreground">
                                Showing {indexOfFirstTest + 1} to {Math.min(indexOfLastTest, filteredTests.length)} of{' '}
                                {filteredTests.length} results
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                  disabled={currentPage === 1}
                                >
                                  <RiArrowLeftSLine className="h-4 w-4" />
                                  Previous
                                </Button>
                                <span className="text-sm text-muted-foreground px-2">
                                  Page {currentPage} of {Math.ceil(filteredTests.length / testsPerPage)}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredTests.length / testsPerPage), prev + 1))}
                                  disabled={currentPage >= Math.ceil(filteredTests.length / testsPerPage)}
                                >
                                  Next
                                  <RiArrowRightSLine className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* LDPC Job Details Modal */}
                  {selectedLdpcJobForModal && (
                    <Dialog open={!!selectedLdpcJobForModal} onOpenChange={() => setSelectedLdpcJobForModal(null)}>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>LDPC Test Results</DialogTitle>
                          <DialogDescription>
                            Detailed results for LDPC job {selectedLdpcJobForModal}
                          </DialogDescription>
                        </DialogHeader>
                        {ldpcJobDetails[selectedLdpcJobForModal] && (
                          <div className="space-y-6">
                            {/* Job Info */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <RiInformationLine className="h-5 w-5" />
                                  Job Information
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                                    <div className="text-foreground">{ldpcJobDetails[selectedLdpcJobForModal].name}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Algorithm</label>
                                    <div className="text-foreground">{ldpcJobDetails[selectedLdpcJobForModal].algorithm_type}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Test Mode</label>
                                    <div className="text-foreground">{ldpcJobDetails[selectedLdpcJobForModal].test_mode}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Noise Level</label>
                                    <div className="text-foreground">{ldpcJobDetails[selectedLdpcJobForModal].noise_level} dB</div>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                                    <div className="text-foreground">{formatDateTimeEST(ldpcJobDetails[selectedLdpcJobForModal].created)}</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Test Results */}
                            {ldpcJobDetails[selectedLdpcJobForModal].results && Array.isArray(ldpcJobDetails[selectedLdpcJobForModal].results) && (
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <RiBarChartLine className="h-5 w-5" />
                                    Test Results ({ldpcJobDetails[selectedLdpcJobForModal].results.length} runs)
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {(() => {
                                    const vlsi = calculateVLSIMetrics(
                                      ldpcJobDetails[selectedLdpcJobForModal].results,
                                      ldpcJobDetails[selectedLdpcJobForModal].algorithm_type,
                                      selectedLdpcJobForModal
                                    );
                                    if (!vlsi) return <div className="text-muted-foreground">No metrics available</div>;

                                    return (
                                      <div className="grid grid-cols-3 gap-4">
                                        <div>
                                          <label className="text-sm font-medium text-muted-foreground">Success Rate</label>
                                          <div className="text-lg font-semibold text-foreground">{(vlsi.successRate * 100).toFixed(1)}%</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-muted-foreground">Avg Execution Time</label>
                                          <div className="text-lg font-semibold text-foreground">{vlsi.avgExecutionTime.toFixed(2)} ms</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-muted-foreground">Avg Throughput</label>
                                          <div className="text-lg font-semibold text-foreground">{vlsi.avgThroughput.toFixed(2)} Mbps</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-muted-foreground">Frame Error Rate</label>
                                          <div className="text-lg font-semibold text-foreground">{(vlsi.frameErrorRate * 100).toFixed(1)}%</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-muted-foreground">Bit Error Rate</label>
                                          <div className="text-lg font-semibold text-foreground">{vlsi.bitErrorRate.toExponential(2)}</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-muted-foreground">Avg Iterations</label>
                                          <div className="text-lg font-semibold text-foreground">{vlsi.avgIterations.toFixed(1)}</div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* SAT Test Details Modal */}
                  {selectedSatTestForModal && (
                    <Dialog open={!!selectedSatTestForModal} onOpenChange={() => setSelectedSatTestForModal(null)}>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>SAT Test Results</DialogTitle>
                          <DialogDescription>
                            Detailed results for SAT test {selectedSatTestForModal}
                          </DialogDescription>
                        </DialogHeader>
                        {satTestDetails[selectedSatTestForModal] && (
                          <div className="space-y-6">
                            <Card>
                              <CardHeader>
                                <CardTitle>Test Information</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                                    <div className="text-foreground">{satTestDetails[selectedSatTestForModal].name}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Chip Type</label>
                                    <div className="text-foreground">{satTestDetails[selectedSatTestForModal].chip_type}</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  )}

                </div>
              </main>
            </div>
          </div>
    );
}