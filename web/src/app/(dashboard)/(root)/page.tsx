"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    RiRefreshLine,
    RiAddLine,
    RiSearchLine,
    RiArrowDownSLine,
    RiFilterLine,
    RiMoreLine,
    RiPlayLine,
    RiDownload2Line,
    RiDeleteBin5Line,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";

import { TestDetailDrawer } from "./_components/TestDetailDrawer";
import { TestCreatePanel } from "./_components/TestCreatePanel";

// Import components from their actual locations
import {
    Drawer,
    DrawerTrigger,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerBody,
    DrawerFooter,
    DrawerClose,
    DrawerDescription
} from "@/components/Drawer";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectGroupLabel,
    SelectTrigger,
    SelectValue
} from "@/components/Select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/DropdownMenu";
import { Badge } from "@/components/Badge";
import { Checkbox } from "@/components/Checkbox";
import { TestRun } from "@/types/test";

// Base URL for the backend API; configure NEXT_PUBLIC_API_BASE_URL in .env.local
const API_BASE = "https://medusa.bendatsko.com";

// Hardware configuration options
const CHIP_TYPES = ["3SAT", "LDPC", "HARDWARE", "RISC-V"];
const PROCESSOR_TYPES = ["ARM (Teensy 4.1)", "RISC-V", "Embedded"];
const TEST_TYPES = ["Hardware-in-Loop", "Software-in-Loop", "Chip-in-Loop", "Unit Test", "Integration Test"];

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
    const [timeRange, setTimeRange] = useState("Last 12 hours");
    const [apiHealth, setApiHealth] = useState<any | null>(null);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [chipType, setChipType] = useState("3SAT");
    const [processorType, setProcessorType] = useState("ARM (Teensy 4.1)");
    const [testType, setTestType] = useState("Hardware-in-Loop");
    const [expandedTests, setExpandedTests] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [apiConnected, setApiConnected] = useState(true);

    // New filters for hardware specific needs
    const [chipTypeFilter, setChipTypeFilter] = useState("all");
    const [processorTypeFilter, setProcessorTypeFilter] = useState("all");
    const [testTypeFilter, setTestTypeFilter] = useState("all");

    // Toggle test expansion in accordion view
    const toggleTestExpansion = (testId: string) => {
        setExpandedTests(prev =>
            prev.includes(testId)
                ? prev.filter(id => id !== testId)
                : [...prev, testId]
        );
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

    const handleBulkAction = async (action: 'delete' | 'rerun' | 'download') => {
        if (action === 'delete') {
            if (window.confirm(`Delete ${selectedTests.length} selected tests?`)) {
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
            // For download, we'll need to handle each test sequentially
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

            let ms = 12 * 60 * 60 * 1000;
            if (timeRange === "Last 24 hours") ms = 24 * 60 * 60 * 1000;
            else if (timeRange === "Last 7 days") ms = 7 * 24 * 60 * 60 * 1000;

            const res = await fetch(
                `${API_BASE}/api/tests?timeRange=${ms}`,
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
                        testType: t.testType || "Hardware-in-Loop",
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
    }, [router, timeRange]);

    // Poll API health
    useEffect(() => {
        const checkApiHealth = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/health`, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                });
                const data = await res.json();
                setApiHealth(data);
                setApiConnected(true);
                // Clear error message if connection is restored
                if (error && error.includes("Failed to load tests")) {
                    setError(null);
                }
            } catch (e) {
                console.error("Health check failed:", e);
                setApiHealth({
                    api_status: "error",
                    db_status: "unknown",
                    timestamp: new Date().toISOString(),
                });
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

    // Counts per category for filters
    const satTestsCount = tests.filter((t) => t.chipType === "3SAT").length;
    const ldpcTestsCount = tests.filter((t) => t.chipType === "LDPC").length;
    const hardwareTestsCount = tests.filter((t) => t.chipType === "HARDWARE").length;
    const riscvTestsCount = tests.filter((t) => t.chipType === "RISC-V").length;

    const armTestsCount = tests.filter((t) => t.processorType?.includes("ARM")).length;
    const embeddedTestsCount = tests.filter((t) => t.processorType === "Embedded").length;
    const riscvProcessorTestsCount = tests.filter((t) => t.processorType === "RISC-V").length;

    const hwLoopCount = tests.filter((t) => t.testType === "Hardware-in-Loop").length;
    const swLoopCount = tests.filter((t) => t.testType === "Software-in-Loop").length;
    const chipLoopCount = tests.filter((t) => t.testType === "Chip-in-Loop").length;
    const unitTestCount = tests.filter((t) => t.testType === "Unit Test").length;
    const integrationTestCount = tests.filter((t) => t.testType === "Integration Test").length;

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
            if (selectedCategory === "ldpc") return t.chipType === "LDPC";
            if (selectedCategory === "hardware") return t.chipType === "HARDWARE";
            if (selectedCategory === "risc-v") return t.chipType === "RISC-V";
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
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
            {/* Page Header */}
            <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Test History</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Manage and monitor your hardware test runs across all platforms
                    </p>
                </div>

                <div className="flex gap-2">
                    {/* Hardware Filters Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1.5"
                            >
                                <RiFilterLine className="h-4 w-4" />
                                Filters
                                <RiArrowDownSLine className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <div className="p-2">
                                <h3 className="font-medium text-sm mb-2">Chip Type</h3>
                                <Select value={chipTypeFilter} onValueChange={setChipTypeFilter}>
                                    <SelectTrigger className="w-full text-xs h-8">
                                        <SelectValue placeholder="All Chip Types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Chip Types</SelectItem>
                                        <SelectItem value="3SAT">3SAT ({satTestsCount})</SelectItem>
                                        <SelectItem value="LDPC">LDPC ({ldpcTestsCount})</SelectItem>
                                        <SelectItem value="HARDWARE">Hardware ({hardwareTestsCount})</SelectItem>
                                        <SelectItem value="RISC-V">RISC-V ({riscvTestsCount})</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <DropdownMenuSeparator />

                            <div className="p-2">
                                <h3 className="font-medium text-sm mb-2">Processor Type</h3>
                                <Select value={processorTypeFilter} onValueChange={setProcessorTypeFilter}>
                                    <SelectTrigger className="w-full text-xs h-8">
                                        <SelectValue placeholder="All Processors" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Processors</SelectItem>
                                        <SelectItem value="ARM (Teensy 4.1)">ARM/Teensy ({armTestsCount})</SelectItem>
                                        <SelectItem value="RISC-V">RISC-V ({riscvProcessorTestsCount})</SelectItem>
                                        <SelectItem value="Embedded">Embedded ({embeddedTestsCount})</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <DropdownMenuSeparator />

                            <div className="p-2">
                                <h3 className="font-medium text-sm mb-2">Test Type</h3>
                                <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                                    <SelectTrigger className="w-full text-xs h-8">
                                        <SelectValue placeholder="All Test Types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Test Types</SelectItem>
                                        <SelectItem value="Hardware-in-Loop">Hardware-in-Loop ({hwLoopCount})</SelectItem>
                                        <SelectItem value="Software-in-Loop">Software-in-Loop ({swLoopCount})</SelectItem>
                                        <SelectItem value="Chip-in-Loop">Chip-in-Loop ({chipLoopCount})</SelectItem>
                                        <SelectItem value="Unit Test">Unit Test ({unitTestCount})</SelectItem>
                                        <SelectItem value="Integration Test">Integration Test ({integrationTestCount})</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <DropdownMenuSeparator />

                            <div className="p-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                        setChipTypeFilter("all");
                                        setProcessorTypeFilter("all");
                                        setTestTypeFilter("all");
                                    }}
                                >
                                    Reset Filters
                                </Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {isAdmin && (
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                            size="sm"
                            onClick={() => setIsCreateDrawerOpen(true)}
                        >
                            <RiAddLine className="h-4 w-4" />
                            New Test
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters & Controls */}
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-grow lg:max-w-md">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <RiSearchLine className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg
                            bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white
                            placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500
                            text-sm shadow-sm transition duration-200 ease-in-out
                            hover:border-gray-300 dark:hover:border-gray-600"
                            placeholder="Search tests by name, type, or status..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                    >
                        <SelectTrigger className="w-[140px] bg-white border border-gray-200 rounded-lg text-sm h-9 shadow-sm hover:border-gray-300 transition duration-200 dark:bg-gray-800 dark:border-gray-700">
                            <SelectValue placeholder="All Tests" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tests</SelectItem>
                            <SelectGroup>
                                <SelectGroupLabel>Status</SelectGroupLabel>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="running">Running</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="queued">Queued</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Select
                        value={timeRange}
                        onValueChange={setTimeRange}
                    >
                        <SelectTrigger className="w-[140px] bg-white border border-gray-200 rounded-lg text-sm h-9 shadow-sm hover:border-gray-300 transition duration-200 dark:bg-gray-800 dark:border-gray-700">
                            <SelectValue placeholder="Time Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Last 12 hours">Last 12 hours</SelectItem>
                            <SelectItem value="Last 24 hours">Last 24 hours</SelectItem>
                            <SelectItem value="Last 7 days">Last 7 days</SelectItem>
                        </SelectContent>
                    </Select>

                    {selectedTests.length > 0 && (
                        <div className="flex items-center gap-2 ml-auto">
                            <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                {selectedTests.length} selected
                            </Badge>

                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1.5 bg-white"
                                    onClick={() => handleBulkAction('delete')}
                                >
                                    <RiDeleteBin5Line className="h-4 w-4 text-red-500" />
                                    <span>Delete</span>
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1.5 bg-white"
                                    onClick={() => handleBulkAction('rerun')}
                                >
                                    <RiPlayLine className="h-4 w-4 text-blue-500" />
                                    <span>Rerun</span>
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1.5 bg-white"
                                    onClick={() => handleBulkAction('download')}
                                >
                                    <RiDownload2Line className="h-4 w-4 text-green-500" />
                                    <span>Download</span>
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedTests([])}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tests List */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                {!apiConnected ? (
                    <div className="text-center py-12">
                        <div className="mx-auto h-12 w-12 text-orange-500 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                            <RiErrorWarningLine className="h-6 w-6" />
                        </div>
                        <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">
                            Unable to connect to API
                        </h3>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                            The test service is currently unavailable. This is why the table is empty.
                        </p>
                        <div className="mt-4 space-y-3">
                            <Button
                                onClick={() => window.location.reload()}
                                className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
                                size="sm"
                            >
                                <RiRefreshLine className="h-4 w-4 mr-1.5" />
                                Retry Connection
                            </Button>
                        </div>
                    </div>
                ) : filteredTests.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12 px-4">
                                    <Checkbox
                                        checked={filteredTests.length > 0 && selectedTests.length === filteredTests.length}
                                        onChange={handleSelectAll}
                                        aria-label="Select all tests"
                                    />
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                    Test Name
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                    Created
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                    Hardware Config
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                    Test Type
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                    Status
                                </TableHead>
                                <TableHead className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTests.map((test) => (
                                <TableRow
                                    key={test.id}
                                    className={cn(
                                        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                        selectedTests.includes(test.id) && "bg-gray-50 dark:bg-gray-800/50"
                                    )}
                                >
                                    <TableCell className="w-12 px-4 py-4">
                                        <Checkbox
                                            checked={selectedTests.includes(test.id)}
                                            onChange={(e) => handleSelectTest(test.id, e)}
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`Select ${test.name}`}
                                        />
                                    </TableCell>
                                    <TableCell
                                        className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
                                        onClick={() => handleRowClick(test)}
                                    >
                                        {test.name}
                                    </TableCell>
                                    <TableCell
                                        className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 cursor-pointer"
                                        onClick={() => handleRowClick(test)}
                                    >
                                        {/* Format the timestamp in a nice, readable way */}
                                        {test.id && test.id.split('-')[0] ? (
                                            new Date(parseInt(test.id.split('-')[0]) * 1000).toLocaleString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                        ) : (
                                            new Date(test.created).toLocaleString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                        )}
                                    </TableCell>
                                    <TableCell
                                        className="px-4 py-4 cursor-pointer"
                                        onClick={() => handleRowClick(test)}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center">
                                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                    {test.chipType}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {test.processorType || "ARM (Teensy 4.1)"}
                                            </div>
                                            {test.voltage && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    Voltage: {test.voltage.v1 && `V1: ${test.voltage.v1}V`}
                                                    {test.voltage.v2 && ` V2: ${test.voltage.v2}V`}
                                                    {test.voltage.v3 && ` V3: ${test.voltage.v3}V`}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell
                                        className="px-4 py-4 cursor-pointer"
                                        onClick={() => handleRowClick(test)}
                                    >
                                        <span className="px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                            {test.testType || "Hardware-in-Loop"}
                                        </span>
                                    </TableCell>
                                    <TableCell
                                        className="px-4 py-4 cursor-pointer"
                                        onClick={() => handleRowClick(test)}
                                    >
                                        <span
                                            className={cn(
                                                "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                                                test.status === "completed"
                                                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                                    : test.status === "running"
                                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                                        : test.status === "failed"
                                                            ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                            )}
                                        >
                                            {test.status === "running" && (
                                                <span className="w-1.5 h-1.5 mr-1.5 bg-current rounded-full animate-pulse" />
                                            )}
                                            {test.status.charAt(0).toUpperCase() +
                                                test.status.slice(1)}
                                        </span>

                                        {test.results && (
                                            <div className="mt-1 text-xs">
                                                {test.results.success !== undefined && (
                                                    <div className={test.results.success ? "text-green-600" : "text-red-600"}>
                                                        {test.results.success ? "✓ Passed" : "✗ Failed"}
                                                    </div>
                                                )}
                                                {test.results.errorRate !== undefined && (
                                                    <div className="text-gray-500">
                                                        Error rate: {test.results.errorRate.toFixed(2)}%
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-4 py-4 text-sm text-right">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowClick(test);
                                                }}>
                                                View
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <RiMoreLine className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRerunTest(test.id);
                                                    }}>
                                                        <RiPlayLine className="h-4 w-4 mr-2 text-blue-500" />
                                                        Rerun Test
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Implement download functionality
                                                        handleBulkAction('download');
                                                    }}>
                                                        <RiDownload2Line className="h-4 w-4 mr-2 text-green-500" />
                                                        Download Results
                                                    </DropdownMenuItem>
                                                    {isAdmin && (
                                                        <DropdownMenuItem onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTest(test.id);
                                                        }}
                                                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                                                        >
                                                            <RiDeleteBin5Line className="h-4 w-4 mr-2" />
                                                            Delete Test
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-12">
                        <div className="mx-auto h-12 w-12 text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <RiSearchLine className="h-6 w-6" />
                        </div>
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                            No tests found
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {searchQuery || chipTypeFilter !== "all" || processorTypeFilter !== "all" || testTypeFilter !== "all"
                                ? `No tests match your current filters`
                                : "Try creating a new test."}
                        </p>
                        {(searchQuery || chipTypeFilter !== "all" || processorTypeFilter !== "all" || testTypeFilter !== "all") && (
                            <Button
                                onClick={() => {
                                    setSearchQuery("");
                                    setChipTypeFilter("all");
                                    setProcessorTypeFilter("all");
                                    setTestTypeFilter("all");
                                    setSelectedCategory("all");
                                }}
                                variant="outline"
                                size="sm"
                                className="mt-2"
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                )}

                {filteredTests.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Showing <span className="font-medium">{filteredTests.length}</span> of{" "}
                                <span className="font-medium">{tests.length}</span> tests
                            </div>
                            {filteredTests.length < tests.length && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedCategory("all");
                                        setChipTypeFilter("all");
                                        setProcessorTypeFilter("all");
                                        setTestTypeFilter("all");
                                        setSearchQuery("");
                                    }}
                                    className="text-sm border border-gray-200 px-3 py-1.5 rounded-md text-gray-600 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    View all tests
                                </Button>
                            )}
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
                        <div className="flex-1">
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