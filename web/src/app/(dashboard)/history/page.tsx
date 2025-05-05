"use client";

import React, { useState, useEffect } from "react";
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
    RiMoreFill
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-utils";

import { TestDetailDrawer } from "./_components/TestDetailDrawer";
import { TestCreatePanel } from "./_components/TestCreatePanel";

// Import only the components we're using
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/Select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/DropdownMenu";
import { Badge } from "@/components/Badge";
import { Checkbox } from "@/components/Checkbox";
import { TestRun } from "@/types/test";

// Base URL for the backend API; configure NEXT_PUBLIC_API_BASE_URL in .env.local
const API_BASE = "https://dacroq-api.bendatsko.com";

// Hardware configuration options
const CHIP_TYPES = ["3SAT", "KSAT", "LDPC"];
const PROCESSOR_TYPES = ["ARM (Teensy 4.1)"];
const TEST_TYPES = ["CNF Problem", "Binary File", "SNR Sweep", "Hardware Test", "Integration Test"];

export default function Dashboard() {
    const router = useRouter();
    const [tests, setTests] = useState<TestRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // State for the drawer component
    const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [apiConnected, setApiConnected] = useState(true);

    // State for filters
    const [chipTypeFilter, setChipTypeFilter] = useState("all");
    const [testTypeFilter, setTestTypeFilter] = useState("all");
    const [processorTypeFilter] = useState("all");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [testsPerPage] = useState(10);

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

    // Handle test actions like delete, rerun, etc.
    const handleTestAction = async (action: 'delete' | 'rerun' | 'download', testId: string) => {
        if (action === 'delete') {
            handleDeleteTest(testId);
        } else if (action === 'rerun') {
            handleRerunTest(testId);
        } else if (action === 'download') {
            // Implement download functionality
            try {
                const res = await fetch(`${API_BASE}/api/tests/${testId}/download`);
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
                    // Create a batch of promises for each test deletion
                    const deletePromises = selectedTests.map(testId => 
                        fetch(`${API_BASE}/api/tests/${testId}`, {
                            method: 'DELETE',
                        })
                    );
                    
                    await Promise.all(deletePromises);
                    
                    // Refresh the tests list
                    fetchTests();
                    setSelectedTests([]);
                } catch (error) {
                    console.error("Error deleting tests:", error);
                    setError("Failed to delete tests. Please try again.");
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
                    fetch(`${API_BASE}/api/tests/${testId}/rerun`, {
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
                    const res = await fetch(`${API_BASE}/api/tests/${testId}/download`);
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

    // Handler functions
    const handleSelectTest = (testId: string, e: React.MouseEvent | React.ChangeEvent) => {
        e.stopPropagation(); // Prevent row expansion when clicking checkbox
        setSelectedTests(prev => {
            if (prev.includes(testId)) {
                return prev.filter(id => id !== testId);
            }
            return [...prev, testId];
        });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTests(filteredTests.map(test => test.id));
        } else {
            setSelectedTests([]);
        }
    };

    const handleCreateTest = async (testData: any) => {
        try {
            setUploading(true);
            const storedUser = localStorage.getItem("user");
            const user = storedUser ? JSON.parse(storedUser) : null;
            if (!user) {
                setError("You must be logged in to create a test");
                setUploading(false);
                return;
            }

            const payload = {
                ...testData,
                createdBy: {
                    name: user.name,
                    photoURL: user.photoURL
                }
            };

            const res = await fetch(`${API_BASE}/api/tests`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => res.statusText);
                console.error("Create test error:", text);
                setError("Failed to create test");
                setUploading(false);
                return;
            }

            const newTest = await res.json();
            setTests(prev => [newTest, ...prev]);
            setIsCreateDrawerOpen(false);
            setError(null);
        } catch (e) {
            console.error("Create test exception:", e);
            setError("Failed to create test");
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteTest = async (testId: string) => {
        if (!window.confirm("Are you sure you want to delete this test? This action cannot be undone.")) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/tests/${testId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error(`Failed to delete test (${res.status})`);
            }

            // Refresh the test list
            setTests(tests.filter(t => t.id !== testId));
            setError(null);
        } catch (e) {
            console.error("Delete test failed:", e);
            setError("Failed to delete test");
        }
    };

    // For TypeScript type safety with the selectedTest
    const handleRerunTest = async (testId: string) => {
        try {
            setIsLoading(true);
            // Create a batch of promises for each test rerun
            const rerunPromises = [testId].map(testId => 
                fetch(`${API_BASE}/api/tests/${testId}/rerun`, {
                    method: 'POST',
                })
            );
            
            await Promise.all(rerunPromises);
            
            // Refresh the tests list
            fetchTests();
            setSelectedTests([]);
        } catch (error) {
            console.error("Error rerunning test:", error);
            setError("Failed to rerun test. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Handle row click - open details drawer
    const handleRowClick = (test: TestRun) => {
        setSelectedTest(test);
        setIsDrawerOpen(true);
    };

    // Function to fetch tests from API
    const fetchTests = async () => {
        setIsLoading(true);
        try {
            const storedUser = localStorage.getItem("user");
            if (!storedUser) {
                router.push("/login");
                return;
            }

            const user = JSON.parse(storedUser);
            setIsAdmin(user.role === "admin");

            const res = await fetch(
                `${API_BASE}/api/tests`,
                {
                    method: "GET",
                    headers: { Accept: "application/json" },
                }
            );

            if (!res.ok) {
                const text = await res.text().catch(() => res.statusText);
                console.error("API error:", text);

                // Only set the error message for non-connectivity issues
                if (res.status !== 0 && res.status < 500) {
                    setError(`Failed to load tests (${res.status})`);
                } else {
                    // For connectivity issues, just update the API connection status
                    setApiConnected(false);
                    // Don't show the error toast for API connectivity issues
                    setError(null);
                }
            } else {
                setApiConnected(true);
                const data = await res.json();
                if (Array.isArray(data)) {
                    const mapped: TestRun[] = data.map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        chipType: t.chipType || "3SAT", // Default values for backwards compatibility
                        processorType: t.processorType || "ARM (Teensy 4.1)",
                        testType: t.testType || "CNF Problem",
                        environment: t.environment,
                        created: t.created,
                        status: t.status,
                        voltage: t.voltage,
                        results: t.results,
                        ...((t.metadata && typeof t.metadata === "object")
                            ? t.metadata
                            : {}),
                    }));
                    // Sort by creation date (most recent first)
                    mapped.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
                    setTests(mapped);
                } else {
                    console.warn("Unexpected API response:", data);
                    setTests([]);
                }
            }
        } catch (e) {
            console.error("Fetch tests failed:", e);
            // Don't show the error toast for API connectivity issues
            setApiConnected(false);
            // Clear any existing error so it doesn't show the error toast
            setError(null);
        } finally {
            setIsLoading(false);
        }
    };

    // Load tests from backend API
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            router.push("/login");
            return;
        }

        fetchTests();
    }, [router]);

    // Poll API health
    useEffect(() => {
        const checkApiHealth = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/health`, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                });
                await res.json(); // Just to check if the response is valid JSON
                setApiConnected(true);
                // Clear error message if connection is restored
                if (error && error.includes("Failed to load tests")) {
                    setError(null);
                }
            } catch (e) {
                console.error("Health check failed:", e);
                setApiConnected(false);
            }
        };

        checkApiHealth();
        const iv = setInterval(checkApiHealth, 30000);
        return () => clearInterval(iv);
    }, [error]);

    // Add real-time polling for running tests
    useEffect(() => {
        if (!tests.some(t => t.status === "running")) {
            return;
        }

        const pollTests = async () => {
            try {
                const runningTests = tests.filter(t => t.status === "running");
                const promises = runningTests.map(test =>
                    fetch(`${API_BASE}/api/tests/${test.id}`).then(res => res.json())
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
                        newTests.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
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
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Test History</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            View and manage your hardware test history across all chip types and processors.
                        </p>
                    </div>
                    <div>
                        <Link href="/run">
                            <Button 
                                variant="default" 
                                className="flex items-center gap-1.5 shadow-sm"
                            >
                                <RiAddLine className="h-4 w-4" />
                                Run New Test
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Filters and Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                    {/* Filter Section */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <div className="w-full sm:w-52">
                            <Select
                                value={chipTypeFilter}
                                onValueChange={setChipTypeFilter}
                            >
                                <SelectTrigger className="h-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-md">
                                    <SelectValue placeholder="Chip Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Chip Types</SelectItem>
                                    <SelectItem value="3SAT">3SAT ({satTestsCount})</SelectItem>
                                    <SelectItem value="KSAT">KSAT ({ksatTestsCount})</SelectItem>
                                    <SelectItem value="LDPC">LDPC ({ldpcTestsCount})</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-52">
                            <Select
                                value={testTypeFilter}
                                onValueChange={setTestTypeFilter}
                            >
                                <SelectTrigger className="h-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-md">
                                    <SelectValue placeholder="Test Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Test Types</SelectItem>
                                    <SelectItem value="CNF Problem">CNF Problem ({cnfProblemCount})</SelectItem>
                                    <SelectItem value="Binary File">Binary File ({binaryFileCount})</SelectItem>
                                    <SelectItem value="SNR Sweep">SNR Sweep ({snrSweepCount})</SelectItem>
                                    <SelectItem value="Hardware Test">Hardware Test ({hardwareTestCount})</SelectItem>
                                    <SelectItem value="Integration Test">Integration Test ({integrationTestCount})</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-52">
                            <Select
                                value={selectedCategory}
                                onValueChange={setSelectedCategory}
                            >
                                <SelectTrigger className="h-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-md">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="running">Running</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                    <SelectItem value="queued">Queued</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Search and bulk actions */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <RiSearchLine className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search tests..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 h-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-md"
                            />
                        </div>
                        {selectedTests.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkAction('rerun')}
                                    className="flex items-center gap-1.5"
                                >
                                    <RiPlayLine className="h-4 w-4" />
                                    Run All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBulkAction('download')}
                                    className="flex items-center gap-1.5"
                                >
                                    <RiDownload2Line className="h-4 w-4" />
                                    Download All
                                </Button>
                                {isAdmin && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBulkAction('delete')}
                                        className="flex items-center gap-1.5 border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50 dark:border-red-900/30 dark:hover:border-red-900/50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                    >
                                        <RiDeleteBin5Line className="h-4 w-4" />
                                        Delete All
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedTests([])}
                                    className="flex items-center"
                                >
                                    Cancel
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* API Connection Error */}
            {!apiConnected && (
                <div className="p-4 mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30 rounded-lg">
                    <div className="flex items-start gap-3">
                        <div className="text-orange-500 dark:text-orange-400 mt-0.5">
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">API Connection Issue</h3>
                            <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                                Cannot connect to the test backend API. Some functionality may be limited.
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

            {/* Main Table */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <th scope="col" className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <div className="flex items-center">
                                        <Checkbox 
                                            checked={selectedTests.length === currentTests.length && currentTests.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedTests(currentTests.map(test => test.id));
                                                } else {
                                                    setSelectedTests([]);
                                                }
                                            }}
                                            aria-label="Select all tests"
                                            className="rounded-sm border-gray-300 dark:border-gray-600"
                                        />
                                    </div>
                                </th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Test Name
                                </th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                    Created
                                </th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Hardware Config
                                </th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Test Type
                                </th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="relative px-3 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {isLoading ? (
                                // Loading skeleton state
                                Array.from({ length: 5 }).map((_, index) => (
                                    <tr key={index} className="animate-pulse">
                                        <td className="pl-4 pr-2 py-4 whitespace-nowrap">
                                            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap text-right">
                                            <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded ml-auto"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : currentTests.length === 0 ? (
                                // Empty state
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center">
                                        <div className="max-w-sm mx-auto flex flex-col items-center">
                                            <div className="flex justify-center items-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                                                <RiTestTubeLine className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                                            </div>
                                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No tests found</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {searchQuery ? (
                                                    <>No tests match your search criteria. Try adjusting your filters or search terms.</>
                                                ) : (
                                                    <>Run your first hardware test to see results here.</>
                                                )}
                                            </p>
                                            <div className="mt-6">
                                                <Link href="/run">
                                                    <Button variant="default" size="sm" className="flex items-center gap-1.5">
                                                        <RiPlayLine className="h-4 w-4" />
                                                        Run New Test
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                // Test data
                                currentTests.map((test) => (
                                    <tr 
                                        key={test.id}
                                        className={cn(
                                            "transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60",
                                            selectedTests.includes(test.id) ? "bg-blue-50 dark:bg-blue-950/20" : "bg-white dark:bg-gray-900"
                                        )}
                                    >
                                        <td className="pl-4 pr-2 py-4 whitespace-nowrap">
                                            <Checkbox
                                                checked={selectedTests.includes(test.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedTests([...selectedTests, test.id]);
                                                    } else {
                                                        setSelectedTests(selectedTests.filter(id => id !== test.id));
                                                    }
                                                }}
                                                aria-label="Select test"
                                                className="rounded-sm border-gray-300 dark:border-gray-600"
                                            />
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    <Link
                                                        href={`/test/${test.id}`}
                                                        className="hover:text-blue-600 hover:underline"
                                                    >
                                                        {test.name}
                                                    </Link>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    ID: {test.id.slice(0, 8)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-white">
                                                {formatDate(test.created_at)}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatTime(test.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                                                    <span className="inline-block w-3 h-3 rounded-full bg-purple-500"></span>
                                                    {test.chipType}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {test.processorType}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                {test.testType}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div 
                                                    className={cn(
                                                        "flex items-center justify-center h-6 px-2.5 text-xs font-medium rounded-full capitalize",
                                                        test.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                                                        test.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 
                                                        test.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 
                                                        test.status === 'scheduled' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 
                                                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                                    )}
                                                >
                                                    {test.status === 'running' && (
                                                        <span className="mr-1.5">
                                                            <span className="inline-block h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
                                                        </span>
                                                    )}
                                                    {test.status === 'scheduled' && (
                                                        <span className="mr-1.5">
                                                            <RiTimeLine className="h-3 w-3" />
                                                        </span>
                                                    )}
                                                    {test.status === 'completed' && (
                                                        <span className="mr-1.5">
                                                            <RiCheckLine className="h-3 w-3" />
                                                        </span>
                                                    )}
                                                    {test.status === 'failed' && (
                                                        <span className="mr-1.5">
                                                            <RiCloseLine className="h-3 w-3" />
                                                        </span>
                                                    )}
                                                    {test.status}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 whitespace-nowrap text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                                    >
                                                        <span className="sr-only">Open options</span>
                                                        <RiMoreFill className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                                                    <DropdownMenuLabel className="text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2">Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                                                    <DropdownMenuItem 
                                                        onClick={() => router.push(`/test/${test.id}`)}
                                                        className="text-sm flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                                    >
                                                        <RiEyeLine className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                        <span>View Details</span>
                                                    </DropdownMenuItem>
                                                    
                                                    {test.status !== "running" && (
                                                        <DropdownMenuItem 
                                                            onClick={() => handleTestAction('rerun', test.id)}
                                                            className="text-sm flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                                        >
                                                            <RiPlayLine className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                            <span>Run Again</span>
                                                        </DropdownMenuItem>
                                                    )}
                                                    
                                                    <DropdownMenuItem 
                                                        onClick={() => handleTestAction('download', test.id)}
                                                        className="text-sm flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                                    >
                                                        <RiDownload2Line className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                        <span>Download</span>
                                                    </DropdownMenuItem>
                                                    
                                                    {isAdmin && (
                                                        <DropdownMenuItem 
                                                            onClick={() => handleTestAction('delete', test.id)}
                                                            className="text-sm flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 cursor-pointer"
                                                        >
                                                            <RiDeleteBin5Line className="h-4 w-4" />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {currentTests.length > 0 && (
                    <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <Button
                                variant="outline"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(currentPage - 1)}
                                className="bg-white dark:bg-gray-800"
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                disabled={indexOfLastTest >= filteredTests.length}
                                onClick={() => setCurrentPage(currentPage + 1)}
                                className="bg-white dark:bg-gray-800"
                            >
                                Next
                            </Button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700 dark:text-gray-400">
                                    Showing <span className="font-medium">{indexOfFirstTest + 1}</span> to{" "}
                                    <span className="font-medium">
                                        {Math.min(indexOfLastTest, filteredTests.length)}
                                    </span>{" "}
                                    of <span className="font-medium">{filteredTests.length}</span> results
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm gap-1" aria-label="Pagination">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <RiArrowLeftSLine className="h-5 w-5" />
                                    </Button>
                                    
                                    {/* Page numbers */}
                                    <div className="flex gap-1 mx-1">
                                        {Array.from({ length: Math.ceil(filteredTests.length / testsPerPage) }).map((_, index) => (
                                            <Button
                                                key={index}
                                                variant={currentPage === index + 1 ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(index + 1)}
                                                className={cn(
                                                    "relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md",
                                                    currentPage === index + 1
                                                        ? "bg-blue-600 text-white border-blue-600"
                                                        : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                )}
                                            >
                                                {index + 1}
                                            </Button>
                                        ))}
                                    </div>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={indexOfLastTest >= filteredTests.length}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        <span className="sr-only">Next</span>
                                        <RiArrowRightSLine className="h-5 w-5" />
                                    </Button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Error toast */}
            {error && (
                <div className="fixed bottom-6 right-6 max-w-xs w-72 p-4 bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900/30 rounded-lg shadow-lg">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <div className="h-5 w-5 text-red-500">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Error</h3>
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span className="sr-only">Dismiss</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Test Detail Drawer */}
            <TestDetailDrawer
                open={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
                test={selectedTest}
                onRerunTest={handleRerunTest}
                onDeleteTest={handleDeleteTest}
                isAdmin={isAdmin}
            />

            {/* Test Create Panel */}
            <TestCreatePanel
                open={isCreateDrawerOpen}
                onOpenChange={setIsCreateDrawerOpen}
                onCreateTest={handleCreateTest}
                isLoading={uploading}
                chipTypes={CHIP_TYPES}
                processorTypes={PROCESSOR_TYPES}
                testTypes={TEST_TYPES}
            />
        </div>
    );
}