'use client';

import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiSearchLine,
  RiUser3Line,
  RiTeamLine,
  RiDeleteBin5Line,
  RiCloseLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";

// Existing components & icons
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryBar } from "@/components/CategoryBar";
import { Divider } from "@/components/Divider";
import CreateTestWindow from "./CreateTestWindow";
import { DataTable } from "@/components/ui/data-table-support/DataTable";
import TestDetails from "./TestDetails";

// Firestore
import { db } from "@/lib/firebase";
import { addDoc, collection, onSnapshot, doc, writeBatch } from "firebase/firestore";

// Types
interface ChipStatus {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline" | "maintenance" | "connecting";
  successRate?: number;
  avgRuntime?: number;
}

export interface TestRun {
  id: string;
  name: string;
  chipType: string;
  status: string;
  created: any;
  completed?: any;
  results?: any; // JSON file with test results
  createdBy?: {
    uid: string;
    name: string;
    email: string;
    role: string;
    avatar: string;
    photoURL?: string;
    displayName?: string;
  };
}

export default function HardwareDashboard() {
  const router = useRouter();
  const [chips, setChips] = useState<ChipStatus[]>([]);
  const [tests, setTests] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aggregatedData, setAggregatedData] = useState<any[]>([]);
  const [isCardsExpanded, setIsCardsExpanded] = useState(true);
  const [testMetrics, setTestMetrics] = useState({
    totalTests: 0,
    successRate: 0,
    avgRuntime: 0,
    lastHourTests: 0,
  });

  const mockChips: ChipStatus[] = [
    { id: "1", name: "3-SAT Solver", type: "3-SAT", status: "online", successRate: 97.8, avgRuntime: 124 },
    { id: "2", name: "LDPC Solver", type: "LDPC", status: "online", successRate: 94.2, avgRuntime: 156 },
    { id: "3", name: "K-SAT Solver", type: "K-SAT", status: "maintenance", successRate: 89.5, avgRuntime: 200 },
  ];

  // Load tests from Firestore
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/login");
      return;
    }
    try {
      const user = JSON.parse(storedUser);
      setIsAdmin(user.role === "admin");
      setChips(mockChips);
      const unsubscribe = onSnapshot(
        collection(db, "tests"),
        (snapshot) => {
          const testsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as TestRun[];
          testsData.sort((a, b) => {
            const dateA =
              a.created && a.created.seconds !== undefined
                ? a.created.seconds * 1000
                : new Date(a.created).getTime();
            const dateB =
              b.created && b.created.seconds !== undefined
                ? b.created.seconds * 1000
                : new Date(b.created).getTime();
            return dateB - dateA;
          });
          setTests(testsData);
          setIsLoading(false);
        },
        (error) => {
          console.error("Error fetching tests:", error);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Error parsing user data:", error);
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (tests.length === 0) {
      setAggregatedData([]);
      return;
    }
    const groups: { [key: string]: number } = {};
    tests.forEach((test) => {
      const created =
        test.created && test.created.seconds !== undefined
          ? new Date(test.created.seconds * 1000)
          : new Date(test.created);
      const dateStr = created.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      groups[dateStr] = (groups[dateStr] || 0) + 1;
    });
    const aggregated = Object.keys(groups).map((date) => ({
      date,
      Tests: groups[date],
    }));
    aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setAggregatedData(aggregated);
  }, [tests]);

  useEffect(() => {
    if (tests.length === 0) return;
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentTests = tests.filter((test) => {
      const testDate =
        test.created && test.created.seconds !== undefined
          ? new Date(test.created.seconds * 1000)
          : new Date(test.created);
      return testDate >= hourAgo;
    });
    const completedTests = tests.filter((t) => t.status === "completed");
    const successfulTests = completedTests.filter(
      (t) => t.results?.successRate && t.results.successRate > 0
    );
    const avgSuccess =
      successfulTests.length > 0
        ? successfulTests.reduce((acc, test) => acc + (test.results?.successRate || 0), 0) / successfulTests.length
        : 0;
    const avgRuntime =
      successfulTests.length > 0
        ? successfulTests.reduce((acc, test) => acc + (test.results?.runtime || 0), 0) / successfulTests.length
        : 0;
    setTestMetrics({
      totalTests: tests.length,
      successRate: avgSuccess,
      avgRuntime: avgRuntime,
      lastHourTests: recentTests.length,
    });
  }, [tests]);

  const handleCreateTest = async (testName: string, chipType: string) => {
    try {
      const storedUserStr = localStorage.getItem("user");
      const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
      if (!storedUser) {
        console.error("No user found in localStorage");
        setError("You must be logged in to create a test");
        return;
      }
      const newTest = {
        name: testName,
        chipType,
        status: "queued",
        created: new Date().toISOString(),
        createdBy: {
          uid: storedUser.uid,
          name: storedUser.displayName,
          displayName: storedUser.displayName,
          email: storedUser.email,
          role: storedUser.role || "user",
          photoURL: storedUser.photoURL,
          avatar: storedUser.photoURL,
        },
      };
      await addDoc(collection(db, "tests"), newTest);
      console.log("New test created");
      setIsOpen(false);
    } catch (error) {
      console.error("Error creating new test:", error);
    }
  };

  const handleViewResults = (test: TestRun) => {
    setScrollPosition(window.scrollY);
    setSelectedTest(test);
    window.scrollTo(0, 0);
  };

  const handleBackToDashboard = () => {
    setSelectedTest(null);
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 0);
  };

  // Define columns for the DataTable
  const columns = [
    { accessorKey: "name", header: "Test Name" },
    {
      id: "creator",
      header: "Creator",
      cell: ({ row }: any) => {
        const creator = row.original.createdBy;
        return (
          <div className="relative group flex items-center">
            <img
              src={
                creator?.photoURL ||
                creator?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.name || "User")}`
              }
              alt="Creator Avatar"
              className="h-8 w-8 rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.name || "User")}`;
              }}
            />
            <div className="absolute left-0 top-full mt-1 hidden w-48 p-2 bg-gray-700 text-white text-xs rounded-md group-hover:block z-10">
              <p className="font-medium">{creator?.displayName || creator?.name || "Unknown"}</p>
              <p>{creator?.email || "No email"}</p>
              <p className="text-gray-300">{creator?.role || "No role"}</p>
            </div>
          </div>
        );
      },
    },
    { accessorKey: "chipType", header: "Chip Type" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const status = row.original.status;
        const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
        return (
          <div
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              status === "completed"
                ? "bg-green-500/10 text-green-500"
                : status.includes("running")
                ? "bg-blue-500/10 text-blue-500"
                : status === "failed"
                ? "bg-red-500/10 text-red-500"
                : "bg-gray-500/10 text-gray-500"
            }`}
          >
            {displayStatus}
          </div>
        );
      },
    },
    {
      accessorKey: "created",
      header: "Created",
      cell: ({ row }: any) => {
        const created = row.original.created;
        let dateObj =
          created && created.seconds !== undefined
            ? new Date(created.seconds * 1000)
            : new Date(created);
        return isNaN(dateObj.getTime())
          ? "Invalid date"
          : dateObj.toLocaleString();
      },
    },
    {
      id: "details",
      header: "Results",
      cell: ({ row }: any) => (
        <Button className="text-sm" variant="secondary" onClick={() => handleViewResults(row.original)}>
          View
        </Button>
      ),
    },
  ];

  // TestTable Component with filtering and date formatting
  const TestTable: React.FC<{
    tests: TestRun[];
    columns: any[];
    handleViewResults: (test: TestRun) => void;
    isAdmin: boolean;
  }> = ({ tests, columns, handleViewResults, isAdmin }) => {
    const [showOnlyMyTests, setShowOnlyMyTests] = useState(false);
    const [filteredTests, setFilteredTests] = useState(tests);
    const [selectedTests, setSelectedTests] = useState<{ [key: string]: boolean }>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [adminMode, setAdminMode] = useState(false);
    const [isFilterVisible, setIsFilterVisible] = useState(false);

    const currentUser = useMemo(() => {
      try {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        console.error("Error parsing user from localStorage:", e);
        return null;
      }
    }, []);

    useEffect(() => {
      let filtered = [...tests];
      if (showOnlyMyTests && currentUser) {
        filtered = filtered.filter((test) => test.createdBy?.uid === currentUser.uid);
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((test) => {
          if (test.name && test.name.toLowerCase().includes(query)) return true;
          if (test.chipType && test.chipType.toLowerCase().includes(query)) return true;
          if (test.status && test.status.toLowerCase().includes(query)) return true;
          if (test.createdBy) {
            if (test.createdBy.name && test.createdBy.name.toLowerCase().includes(query)) return true;
            if (test.createdBy.displayName && test.createdBy.displayName.toLowerCase().includes(query)) return true;
            if (test.createdBy.email && test.createdBy.email.toLowerCase().includes(query)) return true;
          }
          return false;
        });
      }
      setFilteredTests(filtered);
      setSelectedTests({});
    }, [showOnlyMyTests, searchQuery, tests, currentUser]);

    const handleBulkDelete = async () => {
      try {
        const selectedIds = Object.keys(selectedTests).filter((id) => selectedTests[id]);
        if (selectedIds.length === 0) return;
        if (confirm(`Are you sure you want to delete ${selectedIds.length} tests?`)) {
          const batch = writeBatch(db);
          selectedIds.forEach((id) => {
            const testRef = doc(db, "tests", id);
            batch.delete(testRef);
          });
          await batch.commit();
          console.log(`Deleted ${selectedIds.length} tests`);
          setSelectedTests({});
        }
      } catch (error) {
        console.error("Error deleting tests:", error);
        alert("An error occurred while deleting tests");
      }
    };

    const handleResetFilters = () => {
      setSearchQuery("");
      setShowOnlyMyTests(false);
      setSelectedTests({});
    };

    const handleToggleAdminMode = () => {
      setAdminMode((prev) => !prev);
      setSelectedTests({});
    };

    const formatDate = (dateValue: any) => {
      if (!dateValue) return "Pending...";
      try {
        let dateObj;
        if (typeof dateValue === "string") {
          dateObj = new Date(dateValue);
        } else if (dateValue && typeof dateValue.toDate === "function") {
          dateObj = dateValue.toDate();
        } else if (dateValue && dateValue.seconds !== undefined) {
          dateObj = new Date(dateValue.seconds * 1000);
        } else {
          dateObj = new Date(dateValue);
        }
        if (isNaN(dateObj.getTime())) return "Invalid date";
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
        return diffInDays < 7 ? formatDistanceToNow(dateObj, { addSuffix: true }) : format(dateObj, "MMM d, yyyy");
      } catch (error) {
        console.error("Date formatting error:", error);
        return "Error";
      }
    };

    const enhancedColumns = useMemo(() => {
      const modifiedColumns = columns
        .map((column) => {
          if (column.id === "details") return null;
          const newColumn = { ...column };
          if (column.accessorKey === "name") {
            newColumn.cell = ({ row }: any) => {
              const test = row.original;
              const name = test.name || "";
              return (
                <div className="flex items-center">
                  <span className="font-medium">{name.length > 25 ? name.substring(0, 25) + "..." : name}</span>
                </div>
              );
            };
          }
          if (column.accessorKey === "created") {
            newColumn.cell = ({ row }: any) => {
              const created = row.original.created;
              return <span className="text-gray-500 text-sm">{formatDate(created)}</span>;
            };
          }
          return newColumn;
        })
        .filter(Boolean);
      const selectionColumn = {
        id: "select",
        header: ({ table }: any) => {
          const canSelectAll = adminMode || currentUser;
          if (!canSelectAll) return null;
          const allVisibleSelected =
            filteredTests.length > 0 && filteredTests.every((test) => selectedTests[test.id]);
          return (
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => {
                const newSelected: { [key: string]: boolean } = {};
                if (e.target.checked) {
                  filteredTests.forEach((test) => {
                    if (adminMode || test.createdBy?.uid === currentUser?.uid) {
                      newSelected[test.id] = true;
                    }
                  });
                }
                setSelectedTests(newSelected);
              }}
              className="size-4 rounded border-tremor-border text-blue-600"
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
        size: 40,
        cell: ({ row }: any) => {
          const test = row.original;
          const canSelect = adminMode || test.createdBy?.uid === currentUser?.uid;
          return canSelect ? (
            <input
              type="checkbox"
              checked={!!selectedTests[test.id]}
              onChange={(e) => {
                setSelectedTests((prev) => ({
                  ...prev,
                  [test.id]: e.target.checked,
                }));
              }}
              className="size-4 rounded border-tremor-border text-blue-600"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="w-4"></span>
          );
        },
      };
      return [selectionColumn, ...modifiedColumns];
    }, [columns, selectedTests, adminMode, currentUser, filteredTests]);

    return (
      <Card className="mt-6">
        <div className="p-4 sm:flex sm:items-center sm:justify-between">
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="pl-10 pr-4 py-2 w-full sm:w-96 rounded-md border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>
          <div className="mt-4 flex items-center gap-4 sm:mt-0">
            <button
              onClick={() => setShowOnlyMyTests(!showOnlyMyTests)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                showOnlyMyTests
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              {showOnlyMyTests ? <RiUser3Line /> : <RiTeamLine />}
              {showOnlyMyTests ? "My Tests" : "All Tests"}
            </button>
            {Object.keys(selectedTests).some((id) => selectedTests[id]) && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                <RiDeleteBin5Line />
                Delete Selected
              </button>
            )}
            {(searchQuery || showOnlyMyTests) && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <RiCloseLine />
                Reset Filters
              </button>
            )}
            {isAdmin && (
              <button
                onClick={handleToggleAdminMode}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  adminMode
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                }`}
              >
                {adminMode ? "Exit Admin Mode" : "Admin Mode"}
              </button>
            )}
          </div>
        </div>
        <DataTable
          data={filteredTests}
          columns={enhancedColumns}
          onRowClick={({ original }) => handleViewResults(original)}
          rowClassName="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        />
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Button isLoading loadingText="Loading..." variant="ghost" />
      </div>
    );
  }

  if (selectedTest) {
    return <TestDetails test={selectedTest} onBack={handleBackToDashboard} />;
  }

  const onlineChips = mockChips.filter((c) => c.status === "online").length;
  const totalChips = mockChips.length;

  return (
    <main className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Hardware Dashboard
          </h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500 mt-1">
            Real-time monitoring of hardware solvers with performance metrics
          </p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2 text-base sm:text-sm">
            Create Test
            <RiAddLine className="-mr-0.5 size-5 shrink-0" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <Divider className="mb-6" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-50">Recent Tests</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              View and manage your test runs
            </p>
          </div>
          <button
            onClick={() => setIsCardsExpanded(!isCardsExpanded)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-expanded={isCardsExpanded}
            aria-controls="dashboard-stats"
          >
            {isCardsExpanded ? (
              <>
                <span>Hide Stats</span>
                <RiArrowUpLine className="size-4" aria-hidden="true" />
              </>
            ) : (
              <>
                <span>Show Stats</span>
                <RiArrowDownLine className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
        <div
          id="dashboard-stats"
          className={`transition-all duration-300 ease-in-out ${isCardsExpanded ? "opacity-100 max-h-[1000px]" : "opacity-0 max-h-0 overflow-hidden"}`}
          role="region"
          aria-label="Dashboard statistics"
        >
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 mb-8">
            <Card className="p-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">Test Statistics</dt>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Tests</span>
                  <span className="text-sm font-medium">{testMetrics.totalTests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Tests (Last Hour)</span>
                  <span className="text-sm font-medium">{testMetrics.lastHourTests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Average Success Rate</span>
                  <span className="text-sm font-medium">{testMetrics.successRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Average Runtime</span>
                  <span className="text-sm font-medium">{testMetrics.avgRuntime.toFixed(2)}ms</span>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">Solver Status</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">
                {onlineChips}/{totalChips}
              </dd>
              <CategoryBar values={[onlineChips, totalChips - onlineChips]} className="mt-6" colors={["blue", "lightGray"]} showLabels={false} />
              <ul role="list" className="mt-4 flex flex-wrap gap-x-10 gap-y-4 text-sm">
                {mockChips.map((chip) => (
                  <li key={chip.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2.5 shrink-0 rounded-sm ${
                          chip.status === "online"
                            ? "bg-blue-500 dark:bg-blue-500"
                            : chip.status === "maintenance"
                            ? "bg-amber-500 dark:bg-amber-500"
                            : "bg-red-500 dark:bg-red-500"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-sm">{chip.name}</span>
                    </div>
                    <span className="ml-5 text-xs text-gray-500">{chip.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </dl>
        </div>
        <TestTable tests={tests} columns={columns} handleViewResults={handleViewResults} isAdmin={isAdmin} />
      </div>
      <CreateTestWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onCreateTest={handleCreateTest}
      />
    </main>
  );
}
