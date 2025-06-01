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
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

// Externalized modal components
import LDPCJobDetailsModal from "@/app/(dashboard)/ldpc/ldpc-job-details-modal";
import SATTestDetailsModal from "@/app/(dashboard)/sat/sat-test-details-modal";

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
                return {
                    fraction: `${succeeded}/${arr.length}`,
                    percent: `${(vlsi.successRate * 100).toFixed(1)}%`,
                };
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
            return {
                fraction: `${solved}/${total}`,
                percent: `${((solved / total) * 100).toFixed(1)}%`,
            };
        }
    }
    return { fraction: "N/A", percent: "" };
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

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [chipTypeFilter, setChipTypeFilter] = useState("all");
    const [testTypeFilter] = useState("all");
    const [processorTypeFilter] = useState("all");

    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const testsPerPage = 10;

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
        });

    const indexOfLastTest = currentPage * testsPerPage;
    const indexOfFirstTest = indexOfLastTest - testsPerPage;
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
                <main className="flex-1 py-1.5">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                        {/* Header */}
                        <div className="mb-3 flex items-center justify-between">
                            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>

                        </div>

                        {/* Search / filters */}
                        <div className="mt-2 flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-2 sm:flex-row">
                            <div className="flex-1">
                                <div className="relative">
                                    <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search tests..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-48">
                                    <RiFilterLine className="mr-2 h-4 w-4" />
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

                            {selectedTests.length > 0 && (
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDelete(selectedTests, tests)}
                                    className="flex-shrink-0"
                                >
                                    <RiDeleteBinLine className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* Table / empty / offline states */}
                        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
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
                                    {/* Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="border-b border-border bg-muted/50">
                                            <tr>
                                                <Th>
                                                    <Checkbox
                                                        checked={selectedTests.length === currentTests.length && currentTests.length > 0}
                                                        onCheckedChange={(checked) => setSelectedTests(checked ? currentTests.map((t) => t.id) : [])}
                                                    />
                                                </Th>
                                                <Th>Test Details</Th>
                                                <Th>Hardware</Th>
                                                <Th>Status</Th>
                                                <Th>Date</Th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                            {currentTests.map((test) => {
                                                const {fraction, percent} = getSuccessRate(test);
                                                const statusConfig = {
                                                    completed: {
                                                        icon: RiCheckLine,
                                                        variant: "default",
                                                        color: "text-green-500",
                                                        bg: "bg-green-500/10"
                                                    },
                                                    running: {
                                                        icon: RiTimeLine,
                                                        variant: "secondary",
                                                        color: "text-blue-500",
                                                        bg: "bg-blue-500/10"
                                                    },
                                                    failed: {
                                                        icon: RiCloseLine,
                                                        variant: "destructive",
                                                        color: "text-red-500",
                                                        bg: "bg-red-500/10"
                                                    },
                                                    queued: {
                                                        icon: RiTimeLine,
                                                        variant: "outline",
                                                        color: "text-gray-500",
                                                        bg: "bg-gray-500/10"
                                                    },
                                                } as const;
                                                const sc = statusConfig[test.status as keyof typeof statusConfig];

                                                // Extract more meaningful data
                                                const isLDPC = test.chipType === "LDPC";
                                                const algorithmType = test.results?.algorithm_type || "unknown";
                                                const noiseLevel = test.results?.noise_level;
                                                const testMode = test.results?.test_mode;

                                                return (
                                                    <tr
                                                        key={test.id}
                                                        className="group cursor-pointer transition-colors hover:bg-muted/50"
                                                        onClick={() => handleRowClick(test)}
                                                    >
                                                        <Td onClick={(e) => e.stopPropagation()}>
                                                            <Checkbox
                                                                checked={selectedTests.includes(test.id)}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedTests((prev) =>
                                                                        checked
                                                                            ? [...prev, test.id]
                                                                            : prev.filter((id) => id !== test.id),
                                                                    );
                                                                }}
                                                            />
                                                        </Td>

                                                        <Td>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className="font-medium text-foreground group-hover:text-blue-500 transition-colors">
                                                                        {test.name}
                                                                    </div>
                                                                    {/* Algorithm type badge for LDPC */}
                                                                    {isLDPC && algorithmType !== "unknown" && (
                                                                        <Badge
                                                                            variant={algorithmType === "analog_hardware" ? "default" : "secondary"}
                                                                            className="text-xs"
                                                                        >
                                                                            {algorithmType === "analog_hardware" ? "Analog" : "Digital"}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <RiTestTubeLine className="h-3 w-3"/>
                            {testMode || test.testType}
                        </span>
                                                                    {noiseLevel !== undefined && (
                                                                        <span className="flex items-center gap-1">
                                <RiFlashlightLine className="h-3 w-3"/>
                                                                            {noiseLevel}% noise
                            </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Td>

                                                        <Td>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn(
                                                                        "flex h-8 w-8 items-center justify-center rounded-lg",
                                                                        isLDPC ? "bg-purple-500/10" : "bg-blue-500/10"
                                                                    )}>
                                                                        <RiCpuLine className={cn(
                                                                            "h-4 w-4",
                                                                            isLDPC ? "text-purple-500" : "text-blue-500"
                                                                        )}/>
                                                                    </div>
                                                                    <div>
                                                                        <div
                                                                            className="font-medium text-foreground text-sm">
                                                                            {test.chipType}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Td>

                                                        <Td>
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "flex h-8 w-8 items-center justify-center rounded-lg",
                                                                    sc?.bg
                                                                )}>
                                                                    {sc &&
                                                                        <sc.icon className={cn("h-4 w-4", sc.color)}/>}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-sm">
                                                                        {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                                                                    </div>
                                                                    {test.status === "completed" && test.duration && (
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {test.duration}ms
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Td>




                                                        <Td>
                                                            <div className="text-left">
                                                                <div className="font-medium text-sm text-foreground">
                                                                    {formatDate(test.createdAt)}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {formatTime(test.createdAt)}
                                                                </div>
                                                            </div>
                                                        </Td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {filteredTests.length > testsPerPage && (
                                        <div
                                            className="flex items-center justify-between border-t border-border px-6 py-4">
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
                                                    {Math.ceil(filteredTests.length / testsPerPage)}
                        </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setCurrentPage((p) =>
                                                            Math.min(
                                                                Math.ceil(filteredTests.length / testsPerPage),
                                                                p + 1,
                                                            ),
                                                        )
                                                    }
                                                    disabled={
                                                        currentPage >=
                                                        Math.ceil(filteredTests.length / testsPerPage)
                                                    }
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
    <th className="py-2 px-3 text-left text-sm font-medium text-muted-foreground sm:py-3 sm:px-4">
        {children}
    </th>
);

const Td: React.FC<React.PropsWithChildren & { onClick?: (e: React.MouseEvent) => void }> = ({ children, onClick }) => (
    <td className="py-2 px-3 sm:py-4 sm:px-4" onClick={onClick}>
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
