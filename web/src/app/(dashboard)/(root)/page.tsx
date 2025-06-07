"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  RiSearchLine,
  RiRefreshLine,
  RiDownload2Line,
  RiDeleteBin5Line,
  RiFilterLine,
  RiEyeLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiTimeLine,
  RiCheckLine,
  RiCloseLine,
  RiMoreFill,
  RiWifiOffLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiCpuLine,
  RiTestTubeLine,
  RiAddLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dropdownmenu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { auth, User } from "@/lib/auth";
import { TestRun } from "@/types/test";
import { TbCpu, TbSortAscendingNumbers } from "react-icons/tb";
import { cn } from "@/lib/utils";
import {
  generateTestLabel,
  generateTestDescription,
  getTestStatusInfo,
  formatTestCreatedDate,
} from "@/lib/test-labels";
import PageNavigation from "@/components/PageNavigation";

const API_BASE = "/api/proxy";

/* -------------------------------------------------------------------------- */
/*  HELPER TYPES & FUNCTIONS                                                  */
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

const mapLdpcJobToTestRun = (job: LdpcJob): TestRun => ({
  id: job.id,
  name: job.name,
  chipType: "LDPC",
  processorType: "ARM (Teensy 4.1)",
  testType: job.test_mode || "LDPC Test",
  status: job.status === "error" || job.status === "stopped" ? "failed" : (job.status as never),
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

const getStatusBadgeStyles = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30";
    case "running":
      return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30";
    case "failed":
      return "bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30";
    case "queued":
      return "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30";
    default:
      return "";
  }
};

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

/* -------------------------------------------------------------------------- */
/*  MAIN COMPONENT                                                            */
/* -------------------------------------------------------------------------- */

export default function Dashboard() {
  const pathname = usePathname();
  const router = useRouter();

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  
  // Dashboard state
  const [tests, setTests] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [apiConnected, setApiConnected] = useState(true);
  
  // Filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [chipTypeFilter, setChipTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAutoItemsPerPage, setIsAutoItemsPerPage] = useState(true);
  const [autoCalculatedItemsPerPage, setAutoCalculatedItemsPerPage] = useState(10);

  /* -------------------------------- EFFECTS -------------------------------- */

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  // Clock updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  /* ----------------------------- CALLBACKS --------------------------------- */

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

      const [testsArr, ldpcArr] = await Promise.all([parse(testsRes), parse(ldpcRes)]);

      const mapped = testsArr.map((t: any) => ({
        id: t.id,
        name: t.name,
        chipType: t.chip_type || t.chipType || "LDPC",
        testType: t.test_mode || t.testType || "Hardware Test",
        status: t.status === "error" ? "failed" : t.status || "completed",
        createdAt: t.createdAt || t.created_at || t.created || new Date().toISOString(),
        duration: t.duration || null,
        results: t.results || null,
      }));

      const all = [...mapped, ...ldpcArr.map(mapLdpcJobToTestRun)].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

  const openJobResultsModal = async (id: string, type: "ldpc" | "sat"): Promise<void> => {
    if (type === "ldpc") {
      router.push(`/ldpc/${id}`);
    } else {
      router.push(`/sat/${id}`);
    }
  };

  const handleDelete = async (ids: string[], tests: TestRun[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} test${ids.length > 1 ? "s" : ""}?`)) {
      return;
    }

    try {
      await Promise.all(
        ids.map(async (id) => {
          const test = tests.find((t) => t.id === id);
          const endpoint = test?.chipType === "LDPC" ? `${API_BASE}/ldpc/jobs/${id}` : `${API_BASE}/tests/${id}`;

          const res = await fetch(endpoint, { method: "DELETE" });
          if (!res.ok) throw new Error(`Failed to delete test ${id}`);
        })
      );

      fetchTests();
      setSelectedTests([]);
    } catch (e) {
      console.error("Error deleting tests:", e);
      setError("Failed to delete one or more tests");
    }
  };

  const handleDownload = async (ids: string[], tests: TestRun[]) => {
    try {
      const csvHeaders = ["ID", "Name", "Type", "Status", "Created", "Results"];
      const csvRows = tests.map((test) => [
        test.id,
        test.name,
        test.chipType,
        test.status,
        formatTestCreatedDate(test.created || test.createdAt || "", currentTime),
        test.results ? "Available" : "None",
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dacroq-tests-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // Data fetching effects
  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  useEffect(() => {
    const hasRunningTests = tests.some((test) => test.status === "running" || test.status === "queued");
    const refreshInterval = hasRunningTests ? 15000 : 60000;

    const refreshTimer = setInterval(() => {
      fetchTests();
    }, refreshInterval);

    return () => clearInterval(refreshTimer);
  }, [fetchTests, tests]);

  // Calculate optimal items per page
  useEffect(() => {
    if (!isAutoItemsPerPage) return;

    const calculateOptimalItemsPerPage = () => {
      const timer = setTimeout(() => {
        const viewportHeight = window.innerHeight;
        const navbar = document.querySelector("nav") as HTMLElement;
        const headerTitle = document.querySelector("h1") as HTMLElement;
        const filtersSection = document.querySelector('[class*="rounded-xl"][class*="border"]') as HTMLElement;
        const tableHeader = document.querySelector("thead") as HTMLElement;

        const navbarHeight = navbar?.offsetHeight || 60;
        const titleHeight = headerTitle?.offsetHeight || 48;
        const titleMargins = 40;
        const filtersHeight = filtersSection?.offsetHeight || 88;
        const filtersMargin = 16;
        const tableHeaderHeight = tableHeader?.offsetHeight || 48;
        const tableMargins = 16;
        const paginationHeight = 80;
        const safetyBuffer = 20;

        const usedHeight =
          navbarHeight + titleHeight + titleMargins + filtersHeight + filtersMargin + tableHeaderHeight + tableMargins + paginationHeight + safetyBuffer;

        const availableHeight = viewportHeight - usedHeight;
        const isMobile = window.innerWidth < 768;
        const rowHeight = isMobile ? 74 : 64;
        const calculatedItems = Math.floor(availableHeight / rowHeight);
        const presets = [5, 10, 15, 25, 50];

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
      }, 100);

      return () => clearTimeout(timer);
    };

    calculateOptimalItemsPerPage();

    const handleResize = () => {
      if (isAutoItemsPerPage) {
        calculateOptimalItemsPerPage();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isAutoItemsPerPage]);

  // API health check
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

  /* ----------------------------- FILTERING --------------------------------- */

  const filteredTests = tests
    .filter((t) => {
      if (chipTypeFilter !== "all" && t.chipType !== chipTypeFilter) return false;

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

  /* -------------------------------- RENDER -------------------------------- */

  return (
    <div className="min-h-screen bg-background">
      <PageNavigation currentPage="Dashboard" />

      {/* Dashboard Content */}
      <main className="flex-1 pb-20 sm:pb-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            {/* Page Header with Create Button - Keep both locations */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                <p className="text-muted-foreground">View and manage your tests</p>
              </div>
              
              {/* Create Test Button - Keep on Dashboard for emphasis */}
              <Dropdownmenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <RiAddLine className="h-4 w-4" />
                    Create
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => router.push('/sat')}
                  >
                    <RiTestTubeLine className="h-4 w-4" />
                    <span>SAT Test</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => router.push('/ldpc')}
                  >
                    <RiCpuLine className="h-4 w-4" />
                    <span>LDPC Test</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </Dropdownmenu>
            </div>

            {/* Search & Filters */}
            <div className="mb-6 rounded-xl border border-border bg-card/50 p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-foreground/60"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1">
                {selectedTests.length > 0 && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(selectedTests, tests)}
                    className="flex-shrink-0"
                  >
                    <RiDeleteBinLine className="h-3 w-3" />
                  </Button>
                )}

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-auto flex-shrink-0">
                    <RiFilterLine className="mr-1 h-4 w-4 sm:mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tests ({tests.length})</SelectItem>
                    <SelectItem value="ldpc">LDPC ({counts.ldpc})</SelectItem>
                    <SelectItem value="3sat">SAT ({counts.sat})</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={chipTypeFilter} onValueChange={setChipTypeFilter}>
                  <SelectTrigger className="w-auto flex-shrink-0">
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
                  <SelectTrigger className="w-auto flex-shrink-0">
                    <RiTimeLine className="mr-0.5 h-4 w-4 sm:mr-2" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="name_asc">A-Z</SelectItem>
                    <SelectItem value="name_desc">Z-A</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={isAutoItemsPerPage ? "auto" : itemsPerPage.toString()}
                  onValueChange={(value) => {
                    if (value === "auto") {
                      setIsAutoItemsPerPage(true);
                    } else {
                      setIsAutoItemsPerPage(false);
                      setItemsPerPage(parseInt(value));
                    }
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-auto flex-shrink-0">
                    <TbSortAscendingNumbers className="mr-0.5 h-4 w-4 sm:mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto ({autoCalculatedItemsPerPage})</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Table/Cards */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {!apiConnected ? (
                <EmptyState
                  icon={<RiWifiOffLine className="h-full w-full" />}
                  title="API Connection Lost"
                  description="Unable to fetch test data. The backend API is currently unreachable."
                  action={
                    <Button onClick={fetchTests} variant="outline" size="sm" className="mx-auto flex items-center gap-2">
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
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium w-12">
                            <Checkbox
                              checked={selectedTests.length === currentTests.length && currentTests.length > 0}
                              onCheckedChange={(checked) =>
                                setSelectedTests(checked ? currentTests.map((t) => t.id) : [])
                              }
                            />
                          </th>
                          <th className="text-left p-3 font-medium">Test</th>
                          <th className="text-left p-3 font-medium w-36">Type</th>
                          <th className="text-left p-3 font-medium w-32">Status</th>
                          <th className="text-left p-3 font-medium w-24">Created</th>
                          <th className="text-left p-3 font-medium w-16">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTests.map((test) => {
                          const testStatusInfo = getTestStatusInfo(test);
                          const testDescription = generateTestDescription(test);

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
                              <td className="p-3 w-12">
                                <Checkbox
                                  checked={selectedTests.includes(test.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedTests([...selectedTests, test.id]);
                                    } else {
                                      setSelectedTests(selectedTests.filter((id) => id !== test.id));
                                    }
                                  }}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate" title={test.name}>{test.name}</span>
                                  <span className="text-sm text-muted-foreground truncate" title={testDescription}>{testDescription}</span>
                                </div>
                              </td>
                              <td className="p-3 w-36">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    {test.chipType === "LDPC" ? <RiCpuLine size={14} /> : <TbCpu size={14} />}
                                    <span className="text-sm">{test.chipType}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground truncate">{test.processorType}</span>
                                </div>
                              </td>
                              <td className="p-3 w-32">
                                <Badge
                                  variant="outline"
                                  className={cn("inline-flex items-center gap-1.5 border text-xs whitespace-nowrap", getStatusBadgeStyles(test.status))}
                                >
                                  <span className="flex items-center justify-center w-3 h-3">
                                    {getIconElement(testStatusInfo.iconName)}
                                  </span>
                                  <span>{testStatusInfo.label}</span>
                                </Badge>
                              </td>
                              <td className="p-3 w-24">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatTestCreatedDate(test.created || test.createdAt || "", currentTime)}
                                </span>
                              </td>
                              <td className="p-3 w-16">
                                <Dropdownmenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    >
                                      <RiMoreFill size={16} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat");
                                      }}
                                    >
                                      <RiEyeLine className="w-4 h-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload([test.id], [test]);
                                      }}
                                    >
                                      <RiDownload2Line className="w-4 h-4 mr-2" />
                                      Download
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete([test.id], tests);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <RiDeleteBin5Line className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </Dropdownmenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-4 p-4">
                    {currentTests.map((test) => {
                      const testStatusInfo = getTestStatusInfo(test);
                      const testDescription = generateTestDescription(test);

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
                                      setSelectedTests(selectedTests.filter((id) => id !== test.id));
                                    }
                                  }}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                />
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm truncate">{test.name}</h3>
                                  <p className="text-xs text-muted-foreground mt-0.5">{testDescription}</p>
                                </div>
                              </div>
                              <Dropdownmenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 flex-shrink-0"
                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                  >
                                    <RiMoreFill size={16} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openJobResultsModal(test.id, test.chipType === "LDPC" ? "ldpc" : "sat");
                                    }}
                                  >
                                    <RiEyeLine className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload([test.id], [test]);
                                    }}
                                  >
                                    <RiDownload2Line className="w-4 h-4 mr-2" />
                                    Download
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete([test.id], tests);
                                    }}
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
                                <span className="text-xs">{test.chipType}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{test.processorType}</span>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn("inline-flex items-center gap-1.5 text-xs border", getStatusBadgeStyles(test.status))}
                              >
                                <span className="flex items-center justify-center w-3 h-3">
                                  {getIconElement(testStatusInfo.iconName)}
                                </span>
                                {testStatusInfo.label}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <div className="text-muted-foreground">
                                {formatTestCreatedDate(test.created || test.createdAt || "", currentTime)}
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
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {indexOfFirstTest + 1}–{Math.min(indexOfLastTest, filteredTests.length)} of{" "}
                          {filteredTests.length} results
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <RiArrowLeftSLine className="h-4 w-4" />
                            Previous
                          </Button>
                          <span className="px-2 text-sm text-muted-foreground">
                            Page {currentPage} of {Math.ceil(filteredTests.length / itemsPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentPage((p) => Math.min(Math.ceil(filteredTests.length / itemsPerPage), p + 1))
                            }
                            disabled={currentPage >= Math.ceil(filteredTests.length / itemsPerPage)}
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
        </div>
      </main>
    </div>
  );
}

