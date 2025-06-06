"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
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
    RiMoreFill,
    RiCpuLine,
    RiWifiOffLine,
    RiWifiLine,
    RiDeleteBinLine,
    RiSoundModuleLine,
    RiLoader4Line,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dropdownmenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdownmenu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TestRun } from "@/types/test";
import { TbCpu } from "react-icons/tb";
import { TbSortAscendingNumbers } from "react-icons/tb";

import LDPCJobDetailsModal from "@/app/(dashboard)/ldpc/ldpc-job-details-modal";
import SATTestDetailsModal from "@/app/(dashboard)/sat/sat-test-details-modal";
import { generateTestLabel, generateTestDescription, getTestStatusInfo, formatTestCreatedDate } from "@/lib/test-labels";

const API_BASE = "/api/proxy";

/* -------------------------------------------------------------------------- */
/*                               Helper Types                                 */
/* -------------------------------------------------------------------------- */

interface LdpcJob {
    id: string;
    name: string;
    algorithm_type: "analog_hardware" | "digital_hardware";
    test_mode: "custom_message" | "pre_written" | "random_string" | "ber_test";
    message_content?: string;
    noise_level: number;
    status: "queued" | "running" | "completed" | "error" | "stopped";
    created: string;
    success_rate?: number;
    total_execution_time?: number;
    original_message?: string;
    corrupted_message?: string;
    decoded_message?: string;
    correction_successful?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                           Mapping / Formatting                             */
/* -------------------------------------------------------------------------- */

const mapLdpcJobToTestRun = (job: LdpcJob): TestRun => ({
    id: job.id,
    name: job.name,
    chipType: "LDPC",
    processorType: "ARM (Teensy 4.1)",
    testType: job.test_mode || "LDPC Test",
    status:
        job.status === "error" || job.status === "stopped"
            ? "failed"
            : (job.status as never),
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
});

const getPlatform = (test: TestRun): string => {
    if (test.chipType === "LDPC") {
        const algo = test.results?.algorithm_type;
        return `ldpc (${algo?.replace("_hardware", "") || "unknown"})`;
    }
    return test.chipType?.toLowerCase() || "unknown";
};

const formatDate = (dateString: string | undefined) =>
    dateString
        ? new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
        : "N/A";

const formatTime = (dateString: string | undefined) =>
    dateString
        ? new Date(dateString).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        })
        : "N/A";

/* -------------------------------------------------------------------------- */
/*                            VLSI Metrics Helper                             */
/* -------------------------------------------------------------------------- */

const calculateVLSIMetrics = (
    results: any[],
    algorithmType: string,
    jobId?: string,
) => {
    if (!results?.length) return null;

    const totalResults = results.length;
    const successfulResults = results.filter((r) => r.success);
    const executionTimes = results
        .map((r) => r.execution_time || 0)
        .filter((t) => t > 0);
    const totalBitErrors = results.reduce(
        (acc, r) => acc + (r.bit_errors || 0),
        0,
    );
    const totalIterations = results.reduce(
        (acc, r) => acc + (r.iterations || 0),
        0,
    );
    const powerConsumptions = results
        .map((r) => r.power_consumption || 0)
        .filter((p) => p > 0);

    const codeLength = 96;
    const informationBits = 48;

    const avgExecutionTime =
        executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length || 0;
    const minExecutionTime = Math.min(...executionTimes);
    const avgPowerConsumption =
        powerConsumptions.reduce((a, b) => a + b, 0) / powerConsumptions.length ||
        0;

    const avgThroughput = avgExecutionTime
        ? informationBits / (avgExecutionTime / 1000) / 1e6
        : 0;
    const energyPerBit =
        avgPowerConsumption && avgExecutionTime
            ? (avgPowerConsumption * (avgExecutionTime / 1000) * 1e-3) /
            informationBits *
            1e12
            : 0;

    return {
        successRate: successfulResults.length / totalResults,
        frameErrorRate:
            (totalResults - successfulResults.length) / totalResults || 0,
        bitErrorRate:
            totalBitErrors / (totalResults * codeLength) || 0,
        avgExecutionTime,
        avgThroughput,
        avgIterations: totalIterations / totalResults || 0,
        energyPerBit,
    };
};

/* -------------------------------------------------------------------------- */
/*                         Success-rate convenience                           */
/* -------------------------------------------------------------------------- */

const getSuccessRate = (test: TestRun) => {
    if (test.chipType === "LDPC") {
        // Handle new nested SNR structure from LDPC jobs
        if (test.results && typeof test.results === 'object' && !Array.isArray(test.results)) {
            const snrKeys = Object.keys(test.results).filter(key => key.endsWith('dB'))
            
            if (snrKeys.length > 0) {
                let totalVectors = 0
                let totalSuccessful = 0
                let hasErrors = false
                let errorCount = 0
                
                for (const snrKey of snrKeys) {
                    const snrData = test.results[snrKey]
                    
                    if (snrData && typeof snrData === 'object') {
                        // Check for error case
                        if (snrData.error) {
                            hasErrors = true
                            errorCount++
                            continue
                        }
                        
                        if (snrData.results && Array.isArray(snrData.results)) {
                            // Digital BP style - count successes in results array
                            const successful = snrData.results.filter((r: any) => r.success).length
                            totalSuccessful += successful
                            totalVectors += snrData.results.length
                        } else if (snrData.successful_decodes !== undefined && snrData.total_vectors !== undefined) {
                            // Hardware style - use summary stats
                            totalSuccessful += snrData.successful_decodes
                            totalVectors += snrData.total_vectors
                        }
                    }
                }
                
                // If all SNR points have errors, show error state
                if (hasErrors && totalVectors === 0) {
                    return (
                        <div className="text-sm">
                            <div className="font-medium text-red-600">Error</div>
                            <div className="text-xs text-muted-foreground">
                                {errorCount} SNR point{errorCount > 1 ? 's' : ''} failed
                            </div>
                        </div>
                    );
                }
                
                // If some data exists, show results
                if (totalVectors > 0) {
                    const successRate = (totalSuccessful / totalVectors) * 100
                    return (
                        <div className="text-sm">
                            <div className="font-medium">{`${totalSuccessful}/${totalVectors}`}</div>
                            <div className="text-xs text-muted-foreground">
                                {`${successRate.toFixed(1)}%`}
                                {hasErrors && <span className="text-red-500"> (with errors)</span>}
                            </div>
                        </div>
                    );
                }
            }
        }
        
        // Check for direct results on the test object (from LDPC job metadata)
        if (test.results) {
            // Check for metadata-style performance summary
            if (test.results.convergence_rate !== undefined) {
                const convergenceRate = test.results.convergence_rate * 100;
                return (
                    <div className="text-sm">
                        <div className="font-medium">Converged</div>
                        <div className="text-xs text-muted-foreground">
                            {`${convergenceRate.toFixed(1)}%`}
                        </div>
                    </div>
                );
            }

            // Check for simple success rate
            if (test.results.success_rate !== undefined) {
                const successRate = test.results.success_rate * 100;
                return (
                    <div className="text-sm">
                        <div className="font-medium">Success</div>
                        <div className="text-xs text-muted-foreground">
                            {`${successRate.toFixed(1)}%`}
                        </div>
                    </div>
                );
            }

            // Check for correction success (single test result)
            if (test.results.correction_successful !== undefined) {
                return (
                    <div className="text-sm">
                        <div className="font-medium">{test.results.correction_successful ? "Success" : "Failed"}</div>
                        <div className="text-xs text-muted-foreground">
                            {test.results.correction_successful ? "100%" : "0%"}
                        </div>
                    </div>
                );
            }
        }
        
        // Handle legacy flat array structure
        const arr = Array.isArray(test.results?.results)
            ? test.results.results
            : [];
        if (arr.length) {
            const vlsi = calculateVLSIMetrics(
                arr,
                test.results?.algorithm_type,
                test.id,
            );
            if (vlsi) {
                const succeeded = Math.round(vlsi.successRate * arr.length);
                return (
                    <div className="text-sm">
                        <div className="font-medium">{`${succeeded}/${arr.length}`}</div>
                        <div className="text-xs text-muted-foreground">
                            {`${(vlsi.successRate * 100).toFixed(1)}%`}
                        </div>
                    </div>
                );
            }
        }
    }
    
    if (
        (test.chipType === "3SAT" || test.chipType === "KSAT") &&
        test.results?.satResults
    ) {
        const solved = test.results.satResults.problemsSolved || 0;
        const total =
            test.results.satResults.totalProblems ||
            test.results.satResults.satIterations ||
            0;
        if (total) {
            return (
                <div className="text-sm">
                    <div className="font-medium">{`${solved}/${total}`}</div>
                    <div className="text-xs text-muted-foreground">
                        {`${((solved / total) * 100).toFixed(1)}%`}
                    </div>
                </div>
            );
        }
    }
    
    return (
        <div className="text-sm text-muted-foreground">
            Pending
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/*                               Main Page                                    */
/* -------------------------------------------------------------------------- */

export default function Dashboard() {
    const router = useRouter();

    const [tests, setTests] = useState<TestRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [chipTypeFilter, setChipTypeFilter] = useState("all");
    const [testTypeFilter] = useState("all");
    const [processorTypeFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("newest");

    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isAutoItemsPerPage, setIsAutoItemsPerPage] = useState(true);
    const [autoCalculatedItemsPerPage, setAutoCalculatedItemsPerPage] = useState(10);

    const [apiConnected, setApiConnected] = useState(true);

    // Modal state
    const [ldpcJobDetails, setLdpcJobDetails] = useState<Record<string, any>>({});
    const [satTestDetails, setSatTestDetails] = useState<Record<string, any>>({});
    const [selectedLdpcJobForModal, setSelectedLdpcJobForModal] =
        useState<string | null>(null);
    const [selectedSatTestForModal, setSelectedSatTestForModal] =
        useState<string | null>(null);

    /* ---------------------------- data fetchers --------------------------- */

    const loadJobDetails = async (jobId: string, type: "ldpc" | "sat") => {
        try {
            const endpoint =
                type === "ldpc"
                    ? `${API_BASE}/ldpc/jobs/${jobId}`
                    : `${API_BASE}/tests/${jobId}`;
            const res = await fetch(endpoint);
            if (!res.ok) return;
            const details = await res.json();
            if (type === "ldpc") {
                setLdpcJobDetails((p) => ({ ...p, [jobId]: details }));
            } else {
                setSatTestDetails((p) => ({ ...p, [jobId]: details }));
            }
        } catch (e) {
            console.error(`loadJobDetails error (${type})`, e);
        }
    };

    const fetchTests = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const storedUser = localStorage.getItem("user");
            if (!storedUser) {
                router.push("/login");
                return;
            }
            const user = JSON.parse(storedUser);
            setIsAdmin(user.role === "admin");

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const [testsRes, ldpcRes] = await Promise.all([
                fetch(`${API_BASE}/tests`, {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                }),
                fetch(`${API_BASE}/ldpc/jobs`, {
                    headers: { Accept: "application/json" },
                }),
            ]);

            clearTimeout(timeoutId);

            if (!testsRes.ok && !ldpcRes.ok) {
                setApiConnected(false);
                setTests([]);
                return;
            }

            const parse = async (r: Response) => {
                if (!r.ok) return [];
                const data = await r.json();
                return Array.isArray(data) ? data : data.tests || data.jobs || [];
            };

            const [testsArr, ldpcArr] = await Promise.all([
                parse(testsRes),
                parse(ldpcRes),
            ]);

            const mapped = testsArr.map((t: any) => ({
                id: t.id,
                name: t.name,
                chipType: t.chip_type || t.chipType || "LDPC",
                testType: t.test_mode || t.testType || "Hardware Test",
                status: t.status === "error" ? "failed" : t.status || "completed",
                createdAt:
                    t.createdAt || t.created_at || t.created || new Date().toISOString(),
                duration: t.duration || null,
                results: t.results || null,
            }));

            const all = [
                ...mapped,
                ...ldpcArr.map(mapLdpcJobToTestRun),
            ].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );

            setTests(all);
            setApiConnected(true);
        } catch (e) {
            setApiConnected(false);
            setTests([]);
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    /* ------------------------------- effects ------------------------------ */

    useEffect(() => {
        fetchTests();
    }, [fetchTests]);

    // Add real-time clock updates
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 30000); // Update every 30 seconds

        return () => clearInterval(timer);
    }, []);

    // Add periodic data refresh
    useEffect(() => {
        const refreshTimer = setInterval(() => {
            fetchTests();
        }, 60000); // Refresh data every minute

        return () => clearInterval(refreshTimer);
    }, [fetchTests]);

    /* Calculate optimal items per page based on viewport height - only when auto mode is enabled */
    useEffect(() => {
        if (!isAutoItemsPerPage) return; // Only run when auto mode is enabled

        const calculateOptimalItemsPerPage = () => {
            // Wait for DOM to be ready
            const timer = setTimeout(() => {
                const viewportHeight = window.innerHeight;
                
                // More precise measurements
                const navbar = document.querySelector('nav') as HTMLElement;
                const headerTitle = document.querySelector('h1') as HTMLElement;
                const filtersSection = document.querySelector('[class*="rounded-xl"][class*="border"]') as HTMLElement;
                const tableHeader = document.querySelector('thead') as HTMLElement;
                
                // Calculate used height more precisely
                const navbarHeight = navbar?.offsetHeight || 60;
                const titleHeight = headerTitle?.offsetHeight || 48;
                const titleMargins = 40; // pt-6 + mt-4 spacing
                const filtersHeight = filtersSection?.offsetHeight || 88;
                const filtersMargin = 16; // mt-4
                const tableHeaderHeight = tableHeader?.offsetHeight || 48;
                const tableMargins = 16; // mt-4
                const paginationHeight = 80; // Estimated pagination height
                const safetyBuffer = 20; // Extra buffer to ensure no scroll
                
                const usedHeight = navbarHeight + titleHeight + titleMargins + 
                                 filtersHeight + filtersMargin + tableHeaderHeight + 
                                 tableMargins + paginationHeight + safetyBuffer;
                
                const availableHeight = viewportHeight - usedHeight;
                
                // Row heights based on actual rendering
                const isMobile = window.innerWidth < 768;
                const rowHeight = isMobile ? 74 : 64; // Slightly more accurate measurements
                
                const calculatedItems = Math.floor(availableHeight / rowHeight);
                
                // Available preset values
                const presets = [5, 10, 15, 25, 50];
                
                // Find the largest preset that is less than or equal to calculated items
                let optimalPreset = 5;
                for (const preset of presets) {
                    if (preset <= calculatedItems) {
                        optimalPreset = preset;
                    } else {
                        break;
                    }
                }
                
                setAutoCalculatedItemsPerPage(optimalPreset);
                setItemsPerPage(optimalPreset);
            }, 100); // Small delay to ensure DOM is rendered

            return () => clearTimeout(timer);
        };

        calculateOptimalItemsPerPage();

        // Recalculate on window resize only when auto mode is enabled
        const handleResize = () => {
            if (isAutoItemsPerPage) {
                calculateOptimalItemsPerPage();
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isAutoItemsPerPage]); // Add isAutoItemsPerPage as dependency

    /* periodic API health check */
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const controller = new AbortController();
                const to = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(`${API_BASE}/health`, {
                    signal: controller.signal,
                });
                clearTimeout(to);
                if (res.ok) {
                    if (!apiConnected) fetchTests();
                    setApiConnected(true);
                } else {
                    setApiConnected(false);
                    setTests([]);
                }
            } catch {
                setApiConnected(false);
                setTests([]);
            }
        };
        checkHealth();
        const id = setInterval(checkHealth, 30000);
        return () => clearInterval(id);
    }, [apiConnected, fetchTests]);

    /* ---------------------------------------------------------------------- */
    /*                              UI Handlers                               */
    /* ---------------------------------------------------------------------- */

    const handleRowClick = (test: TestRun) => {
        if (test.chipType === "LDPC") {
            openJobResultsModal(test.id, "ldpc");
        } else if (test.chipType === "3SAT" || test.chipType === "KSAT") {
            openJobResultsModal(test.id, "sat");
        }
    };

    const openJobResultsModal = async (
        id: string,
        type: "ldpc" | "sat",
    ): Promise<void> => {
        const cache = type === "ldpc" ? ldpcJobDetails : satTestDetails;
        if (!cache[id]) await loadJobDetails(id, type);
        if (type === "ldpc") setSelectedLdpcJobForModal(id);
        else setSelectedSatTestForModal(id);
    };

    const handleDelete = async (ids: string[], tests: TestRun[]) => {
        if (!confirm(`Are you sure you want to delete ${ids.length} test${ids.length > 1 ? 's' : ''}?`)) {
            return;
        }

        try {
            await Promise.all(ids.map(async (id) => {
                const test = tests.find(t => t.id === id);
                const endpoint = test?.chipType === 'LDPC' 
                    ? `${API_BASE}/ldpc/jobs/${id}`
                    : `${API_BASE}/tests/${id}`;
                
                const res = await fetch(endpoint, { method: 'DELETE' });
                if (!res.ok) throw new Error(`Failed to delete test ${id}`);
            }));

            // Refresh tests after deletion
            fetchTests();
            setSelectedTests([]);
        } catch (e) {
            console.error('Error deleting tests:', e);
            setError('Failed to delete one or more tests');
        }
    };

    // Add missing handleDownload function
    const handleDownload = async (ids: string[], tests: TestRun[]) => {
        try {
            // Create a simple CSV export of the test data
            const csvHeaders = ["ID", "Name", "Type", "Status", "Created", "Results"];
            const csvRows = tests.map(test => [
                test.id,
                test.name,
                test.chipType,
                test.status,
                formatTestCreatedDate(test.created || test.createdAt || "", currentTime),
                test.results ? "Available" : "None"
            ]);
            
            const csvContent = [
                csvHeaders.join(","),
                ...csvRows.map(row => row.map(cell => `"${cell}"`).join(","))
            ].join("\n");
            
            const blob = new Blob([csvContent], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `dacroq-tests-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
        }
    };

    /* ---------------------------------------------------------------------- */
    /*                       Filtering / Pagination logic                      */
    /* ---------------------------------------------------------------------- */

    const filteredTests = tests
        .filter((t) => {
            if (chipTypeFilter !== "all" && t.chipType !== chipTypeFilter)
                return false;
            if (
                processorTypeFilter !== "all" &&
                t.processorType !== processorTypeFilter
            )
                return false;
            if (testTypeFilter !== "all" && t.testType !== testTypeFilter)
                return false;

            const categoryFilters: Record<string, (t: TestRun) => boolean> = {
                all: () => true,
                "3sat": (t) => t.chipType === "3SAT",
                ksat: (t) => t.chipType === "KSAT",
                ldpc: (t) => t.chipType === "LDPC",
                completed: (t) => t.status === "completed",
                running: (t) => t.status === "running",
                failed: (t) => t.status === "failed",
                queued: (t) => t.status === "queued",
            };

            return categoryFilters[selectedCategory]?.(t) ?? true;
        })
        .filter((t) => {
            const q = searchQuery.toLowerCase();
            return [t.name, t.chipType, t.processorType, t.testType, t.status]
                .filter(Boolean)
                .some((f) => f!.toLowerCase().includes(q));
        })
        .sort((a, b) => {
            // Apply sorting based on sortOrder
            switch (sortOrder) {
                case "newest":
                    const aDate = new Date(a.createdAt || a.created || 0);
                    const bDate = new Date(b.createdAt || b.created || 0);
                    return bDate.getTime() - aDate.getTime();
                case "oldest":
                    const aDateOld = new Date(a.createdAt || a.created || 0);
                    const bDateOld = new Date(b.createdAt || b.created || 0);
                    return aDateOld.getTime() - bDateOld.getTime();
                case "name_asc":
                    return a.name.localeCompare(b.name);
                case "name_desc":
                    return b.name.localeCompare(a.name);
                case "status":
                    // Sort by status priority: running > queued > completed > failed
                    const statusOrder = { running: 4, queued: 3, completed: 2, failed: 1 };
                    const aOrder = statusOrder[a.status as keyof typeof statusOrder] || 0;
                    const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 0;
                    return bOrder - aOrder;
                default:
                    const aDateDefault = new Date(a.createdAt || a.created || 0);
                    const bDateDefault = new Date(b.createdAt || b.created || 0);
                    return bDateDefault.getTime() - aDateDefault.getTime();
            }
        });

    const indexOfLastTest = currentPage * itemsPerPage;
    const indexOfFirstTest = indexOfLastTest - itemsPerPage;
    const currentTests = filteredTests.slice(indexOfFirstTest, indexOfLastTest);

    const counts = {
        sat: tests.filter((t) => t.chipType === "3SAT").length,
        ksat: tests.filter((t) => t.chipType === "KSAT").length,
        ldpc: tests.filter((t) => t.chipType === "LDPC").length,
    };

    /* ---------------------------------------------------------------------- */
    /*                                RENDER                                   */
    /* ---------------------------------------------------------------------- */

    return (
        <div className="min-h-screen bg-background">
            <div className="flex-1 flex flex-col">
                <main className="flex-1">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                        {/* Header */}
                        <div className="pt-0 md:pt-1 flex items-center justify-between">
                            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                        </div>

                        {/* Search / filters */}
                        <div className="mt-4 lg:mt-6 rounded-xl border border-border bg-card/50 p-4 lg:p-5 space-y-4">
                            {/* Search Row - For Finding Things */}
                            <div className="w-full">
                                <div className="relative">
                                    <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search tests..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Action Row - For Doing Things */}
                            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1">
                            {selectedTests.length > 0 && (
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => handleDelete(selectedTests, tests)}
                                        className="flex-shrink-0 bg-red-500 hover:bg-red-600 text-white"
                                    >
                                        <RiDeleteBinLine className="h-3 w-3" />
                                    </Button>
                                )}
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger className="w-36 sm:w-40 flex-shrink-0">
                                        <RiFilterLine className="mr-1 h-4 w-4 sm:mr-2" />
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Tests ({tests.length})</SelectItem>
                                        <SelectItem value="ldpc">LDPC ({counts.ldpc})</SelectItem>
                                        <SelectItem value="3sat">3-SAT ({counts.sat})</SelectItem>
                                        <SelectItem value="ksat">K-SAT ({counts.ksat})</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="running">Running</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="queued">Queued</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={chipTypeFilter} onValueChange={setChipTypeFilter}>
                                    <SelectTrigger className="w-32 sm:w-36 flex-shrink-0">
                                        <TbCpu className="mr-1 h-4 w-4 sm:mr-2" />
                                        <SelectValue placeholder="Chip Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Chips</SelectItem>
                                        <SelectItem value="LDPC">LDPC</SelectItem>
                                        <SelectItem value="3SAT">3-SAT</SelectItem>
                                        <SelectItem value="KSAT">K-SAT</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={sortOrder} onValueChange={setSortOrder}>
                                    <SelectTrigger className="w-32 sm:w-36 flex-shrink-0">
                                        <RiTimeLine className="mr-1 h-4 w-4 sm:mr-2" />
                                        <SelectValue placeholder="Sort" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">Newest First</SelectItem>
                                        <SelectItem value="oldest">Oldest First</SelectItem>
                                        <SelectItem value="name_asc">Name A-Z</SelectItem>
                                        <SelectItem value="name_desc">Name Z-A</SelectItem>
                                        <SelectItem value="status">By Status</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select 
                                    value={isAutoItemsPerPage ? "auto" : itemsPerPage.toString()} 
                                    onValueChange={(value) => {
                                        if (value === "auto") {
                                            setIsAutoItemsPerPage(true);
                                            // Let the useEffect handle setting the optimal value
                                        } else {
                                            setIsAutoItemsPerPage(false);
                                            setItemsPerPage(parseInt(value));
                                        }
                                        setCurrentPage(1); // Reset to first page when changing page size
                                    }}
                                >
                                    <SelectTrigger className="w-28 sm:w-32 flex-shrink-0">
                                        <TbSortAscendingNumbers className="mr-1 h-4 w-4 sm:mr-2"/>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto ({autoCalculatedItemsPerPage})</SelectItem>
                                        <SelectItem value="5">5 per page</SelectItem>
                                        <SelectItem value="10">10 per page</SelectItem>
                                        <SelectItem value="15">15 per page</SelectItem>
                                        <SelectItem value="25">25 per page</SelectItem>
                                        <SelectItem value="50">50 per page</SelectItem>
                                    </SelectContent>
                                </Select>
                                
                            </div>
                        </div>

                        {/* Table / empty / offline states */}
                        <div className="mt-3 lg:mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                            {!apiConnected ? (
                                <EmptyState
                                    icon={<RiWifiOffLine className="h-full w-full" />}
                                    title="API Connection Lost"
                                    description="Unable to fetch test data. The backend API is currently unreachable."
                                    action={
                                        <Button
                                            onClick={fetchTests}
                                            variant="outline"
                                            size="sm"
                                            className="mx-auto flex items-center gap-2"
                                        >
                                            <RiRefreshLine className="h-4 w-4" />
                                            Retry Connection
                                        </Button>
                                    }
                                />
                            ) : filteredTests.length === 0 ? (
                                <EmptyState
                                    icon={<RiTestTubeLine className="h-full w-full" />}
                                    title="No tests found"
                                    description={
                                        searchQuery || selectedCategory !== "all"
                                            ? "Try adjusting your search or filters"
                                            : "Start running tests to see results here"
                                    }
                                />
                            ) : (
                                <>
                                    {/* Desktop table view */}
                                    <div className="hidden md:block">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left p-3 font-medium">
                                                        <Checkbox
                                                            checked={selectedTests.length === currentTests.length && currentTests.length > 0}
                                                            onCheckedChange={(checked) => setSelectedTests(checked ? currentTests.map((t) => t.id) : [])}
                                                        />
                                                    </th>
                                                    <th className="text-left p-3 font-medium">Test</th>
                                                    <th className="text-left p-3 font-medium">Type</th>
                                                    <th className="text-left p-3 font-medium">Status</th>
                                                    <th className="text-left p-3 font-medium">Created</th>
                                                    <th className="text-left p-3 font-medium">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentTests.map((test) => {
                                                    const testStatusInfo = getTestStatusInfo(test);
                                                    const testLabel = generateTestLabel(test);
                                                    const testDescription = generateTestDescription(test);
                                                    
                                                    // Convert iconName to actual icon element
                                                    const getIconElement = (iconName: string) => {
                                                        switch (iconName) {
                                                            case "check":
                                                                return <RiCheckLine size={12} />;
                                                            case "loader":
                                                                return <RiLoader4Line size={12} className="animate-spin" />;
                                                            case "close":
                                                                return <RiCloseLine size={12} />;
                                                            case "time":
                                                                return <RiTimeLine size={12} />;
                                                            default:
                                                                return <RiCheckLine size={12} />;
                                                        }
                                                    };
                                                    
                                                    return (
                                                        <tr
                                                            key={test.id}
                                                            className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                                                            onClick={() => openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat")}
                                                        >
                                                            <td className="p-3">
                                                                <Checkbox
                                                                    checked={selectedTests.includes(test.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setSelectedTests([...selectedTests, test.id]);
                                                                        } else {
                                                                            setSelectedTests(selectedTests.filter(id => id !== test.id));
                                                                        }
                                                                    }}
                                                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{test.name}</span>
                                                                    <span className="text-sm text-muted-foreground">{testDescription}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center gap-1">
                                                                        {test.chipType === "LDPC" ? <RiCpuLine size={16} /> : <TbCpu size={16} />}
                                                                        <span className="text-sm">{test.chipType}</span>
                                                                    </div>
                                                                    <span className="text-muted-foreground">•</span>
                                                                    <span className="text-sm text-muted-foreground">{test.processorType}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant={testStatusInfo.variant as any} className="flex items-center gap-1">
                                                                        {getIconElement(testStatusInfo.iconName)}
                                                                        {testStatusInfo.label}
                                                                    </Badge>
                                                                    {/* Show error details inline if available */}
                                                                    {testStatusInfo.variant === "destructive" && (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {getSuccessRate(test)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="text-sm text-muted-foreground">
                                                                    {formatTestCreatedDate(test.created || test.createdAt || "", currentTime)}
                                                                </span>
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        onClick={(e: React.MouseEvent) => {
                                                                            e.stopPropagation();
                                                                            openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat");
                                                                        }}
                                                                    >
                                                                        <RiEyeLine size={16} />
                                                                    </Button>
                                                                    <Dropdownmenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                                                <RiMoreFill size={16} />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuItem
                                                                                onClick={() => openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat")}
                                                                            >
                                                                                <RiEyeLine className="w-4 h-4 mr-2" />
                                                                                View Details
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                onClick={() => handleDownload([test.id], [test])}
                                                                            >
                                                                                <RiDownload2Line className="w-4 h-4 mr-2" />
                                                                                Download
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                onClick={() => handleDelete([test.id], tests)}
                                                                                className="text-destructive focus:text-destructive"
                                                                            >
                                                                                <RiDeleteBin5Line className="w-4 h-4 mr-2" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </Dropdownmenu>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile card view */}
                                    <div className="md:hidden space-y-4">
                                        {currentTests.map((test) => {
                                            const testStatusInfo = getTestStatusInfo(test);
                                            const testLabel = generateTestLabel(test);
                                            const testDescription = generateTestDescription(test);
                                            
                                            // Convert iconName to actual icon element
                                            const getIconElement = (iconName: string) => {
                                                switch (iconName) {
                                                    case "check":
                                                        return <RiCheckLine size={12} />;
                                                    case "loader":
                                                        return <RiLoader4Line size={12} className="animate-spin" />;
                                                    case "close":
                                                        return <RiCloseLine size={12} />;
                                                    case "time":
                                                        return <RiTimeLine size={12} />;
                                                    default:
                                                        return <RiCheckLine size={12} />;
                                                }
                                            };
                                            
                                            return (
                                                <Card 
                                                    key={test.id} 
                                                    className="cursor-pointer hover:shadow-md transition-shadow"
                                                    onClick={() => openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat")}
                                                >
                                                    <CardContent className="p-4">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <Checkbox
                                                                    checked={selectedTests.includes(test.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setSelectedTests([...selectedTests, test.id]);
                                                                        } else {
                                                                            setSelectedTests(selectedTests.filter(id => id !== test.id));
                                                                        }
                                                                    }}
                                                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="font-medium text-sm truncate">{test.name}</h3>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">{testDescription}</p>
                                                                </div>
                                                            </div>
                                                            <Dropdownmenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                                        <RiMoreFill size={16} />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        onClick={() => openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat")}
                                                                    >
                                                                        <RiEyeLine className="w-4 h-4 mr-2" />
                                                                        View Details
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleDownload([test.id], [test])}
                                                                    >
                                                                        <RiDownload2Line className="w-4 h-4 mr-2" />
                                                                        Download
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleDelete([test.id], tests)}
                                                                        className="text-destructive focus:text-destructive"
                                                                    >
                                                                        <RiDeleteBin5Line className="w-4 h-4 mr-2" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </Dropdownmenu>
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                {test.chipType === "LDPC" ? <RiCpuLine size={14} /> : <TbCpu size={14} />}
                                                                <span className="text-xs font-medium">{test.chipType}</span>
                                                                <span className="text-muted-foreground">•</span>
                                                                <span className="text-xs text-muted-foreground">{test.processorType}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant={testStatusInfo.variant as any} className="flex items-center gap-1 text-xs">
                                                                    {getIconElement(testStatusInfo.iconName)}
                                                                    {testStatusInfo.label}
                                                                </Badge>
                                                                {/* Show error info for failed tests */}
                                                                {testStatusInfo.variant === "destructive" && (
                                                                    <span className="text-xs text-red-500">
                                                                        Error
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between text-xs">
                                                            <div className="text-muted-foreground">
                                                                {formatTestCreatedDate(test.created || test.createdAt || "", currentTime)}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0"
                                                                    onClick={(e: React.MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat");
                                                                    }}
                                                                >
                                                                    <RiEyeLine size={14} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>

                                    {/* Pagination */}
                                    {filteredTests.length > itemsPerPage && (
                                        <div className="border-t border-border px-4 py-4 sm:px-6">
                                            {/* Mobile Pagination */}
                                            <div className="block sm:hidden">
                                                <div className="flex gap-2 mb-3">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                        className="flex-1"
                                                    >
                                                        <RiArrowLeftSLine className="h-4 w-4 mr-1" />
                                                        Previous
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setCurrentPage((p) =>
                                                                Math.min(
                                                                    Math.ceil(filteredTests.length / itemsPerPage),
                                                                    p + 1,
                                                                ),
                                                            )
                                                        }
                                                        disabled={
                                                            currentPage >=
                                                            Math.ceil(filteredTests.length / itemsPerPage)
                                                        }
                                                        className="flex-1"
                                                    >
                                                        Next
                                                        <RiArrowRightSLine className="h-4 w-4 ml-1" />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm text-muted-foreground">
                                                        {indexOfFirstTest + 1}–{Math.min(indexOfLastTest, filteredTests.length)} of {filteredTests.length}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Page {currentPage} of {Math.ceil(filteredTests.length / itemsPerPage)}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Desktop Pagination */}
                                            <div className="hidden sm:flex items-center justify-between">
                                                <div className="text-sm text-muted-foreground">
                                                    Showing {indexOfFirstTest + 1}–
                                                    {Math.min(indexOfLastTest, filteredTests.length)} of{" "}
                                                    {filteredTests.length} results
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setCurrentPage((p) => Math.max(1, p - 1))
                                                        }
                                                        disabled={currentPage === 1}
                                                    >
                                                        <RiArrowLeftSLine className="h-4 w-4" />
                                                        Previous
                                                    </Button>
                                                    <span className="px-2 text-sm text-muted-foreground">
                                                        Page {currentPage} of{" "}
                                                        {Math.ceil(filteredTests.length / itemsPerPage)}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setCurrentPage((p) =>
                                                                Math.min(
                                                                    Math.ceil(filteredTests.length / itemsPerPage),
                                                                    p + 1,
                                                                ),
                                                            )
                                                        }
                                                        disabled={
                                                            currentPage >=
                                                            Math.ceil(filteredTests.length / itemsPerPage)
                                                        }
                                                    >
                                                        Next
                                                        <RiArrowRightSLine className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* ---------------------------- Modals ---------------------------- */}
            <LDPCJobDetailsModal
                open={!!selectedLdpcJobForModal}
                onClose={() => setSelectedLdpcJobForModal(null)}
                jobId={selectedLdpcJobForModal}
                jobData={
                    selectedLdpcJobForModal
                        ? ldpcJobDetails[selectedLdpcJobForModal]
                        : undefined
                }
            />

            <SATTestDetailsModal
                open={!!selectedSatTestForModal}
                onClose={() => setSelectedSatTestForModal(null)}
                testId={selectedSatTestForModal}
                testData={
                    selectedSatTestForModal
                        ? satTestDetails[selectedSatTestForModal]
                        : undefined
                }
            />
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*                           Small Re-usable bits                             */
/* -------------------------------------------------------------------------- */

const Th: React.FC<React.PropsWithChildren> = ({ children }) => (
    <th className="py-2 px-3 text-left text-sm font-medium text-muted-foreground">
        {children}
    </th>
);

const Td: React.FC<React.PropsWithChildren & { onClick?: (e: React.MouseEvent) => void }> = ({ children, onClick }) => (
    <td className="py-2 px-3" onClick={onClick}>
        {children}
    </td>
);

const EmptyState: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
    <div className="p-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30">{icon}</div>
        <h3 className="mb-2 text-lg font-medium text-foreground">{title}</h3>
        <p className="mb-6 text-muted-foreground">{description}</p>
        {action}
    </div>
);