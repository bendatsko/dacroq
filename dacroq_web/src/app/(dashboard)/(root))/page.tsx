'use client';

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiCloseLine,
  RiArrowLeftLine,
  RiAppsFill,
  RiUser3Line,
  RiTeamLine,
  RiDeleteBin5Line
} from "@remixicon/react";

// Existing components & icons
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryBar } from "@/components/CategoryBar";
import { Divider } from "@/components/Divider";
import { ProgressCircle } from "@/components/ProgressCircle";
import { Example } from "@/components/ui/Example";

// Tremor UI components for charts & modal dialog
import {
  Badge,
  BarChart,
  LineChart,
  DonutChart,
  Dialog,
  DialogPanel,
  Select,
  SelectItem,
} from "@tremor/react";

// Firestore
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";

// DataTable
import { DataTable } from "@/components/ui/data-table-support/DataTable";

// Types
interface ChipStatus {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline" | "maintenance" | "connecting";
  successRate?: number;
  avgRuntime?: number;
}

interface TestRun {
  id: string;
  name: string;
  chipType: string;
  status: string;
  created: any;
  completed?: any;
  results?: {
    successRate?: number;
    solutionCount?: number;
    evidence?: string;
    [key: string]: any;
  };
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

// Resource usage data (mock)
const resourceData = [
  { date: 'Aug 01', 'GPU cluster': 7100, 'Workspace usage': 4434 },
  { date: 'Aug 15', 'GPU cluster': 7124, 'Workspace usage': 4903 },
  { date: 'Sep 01', 'GPU cluster': 12347, 'Workspace usage': 4839 },
  { date: 'Sep 15', 'GPU cluster': 12012, 'Workspace usage': 10412 },
  { date: 'Sep 26', 'GPU cluster': 17349, 'Workspace usage': 10943 },
];

// Monthly performance data (mock)
const performanceData = [
  { month: 'Apr', success: 91.2, failures: 8.8 },
  { month: 'May', success: 92.8, failures: 7.2 },
  { month: 'Jun', success: 93.7, failures: 6.3 },
  { month: 'Jul', success: 92.5, failures: 7.5 },
  { month: 'Aug', success: 94.3, failures: 5.7 },
  { month: 'Sep', success: 95.8, failures: 4.2 },
];

// Chip utilization data (mock)
const utilizationData = [
  { name: '3-SAT', value: 42 },
  { name: 'LDPC', value: 38 },
  { name: 'K-SAT', value: 20 },
];

// Test runtime data (mock)
const runtimeData = [
  { date: 'Aug 01', avg: 124, min: 98, max: 156 },
  { date: 'Aug 15', avg: 118, min: 92, max: 145 },
  { date: 'Sep 01', avg: 115, min: 87, max: 142 },
  { date: 'Sep 15', avg: 110, min: 85, max: 138 },
  { date: 'Sep 26', avg: 105, min: 82, max: 132 },
];

// Usage summary data (mock)
const usageSummary = [
  { name: 'Actual', value: '$8,110.15' },
  { name: 'Forecasted', value: '$10,230.25' },
  { name: 'Last invoice', value: 'Sept 20, 2024' },
];

// Enhanced DataTable component that adds filtering, selection, and search
// Enhanced DataTable component with admin mode
function EnhancedTestTable({ tests, columns, handleViewResults, isAdmin }) {
  const [showOnlyMyTests, setShowOnlyMyTests] = useState(false);
  const [filteredTests, setFilteredTests] = useState(tests);
  const [selectedTests, setSelectedTests] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [adminMode, setAdminMode] = useState(false);

  // Get current user from localStorage
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error("Error parsing user from localStorage:", e);
      return null;
    }
  }, []);

  // Filter tests when filter state, search query, or tests change
  useEffect(() => {
    let filtered = [...tests];

    // First apply user filter if enabled
    if (showOnlyMyTests && currentUser) {
      filtered = filtered.filter(test =>
        test.createdBy?.uid === currentUser.uid
      );
    }

    // Then apply search query if present
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(test => {
        // Search in test name
        if (test.name && test.name.toLowerCase().includes(query)) return true;

        // Search in chip type
        if (test.chipType && test.chipType.toLowerCase().includes(query)) return true;

        // Search in status
        if (test.status && test.status.toLowerCase().includes(query)) return true;

        // Search in creator fields
        if (test.createdBy) {
          if (test.createdBy.name && test.createdBy.name.toLowerCase().includes(query)) return true;
          if (test.createdBy.displayName && test.createdBy.displayName.toLowerCase().includes(query)) return true;
          if (test.createdBy.email && test.createdBy.email.toLowerCase().includes(query)) return true;
        }

        return false;
      });
    }

    setFilteredTests(filtered);
    // Clear selections when filters change
    setSelectedTests({});
  }, [showOnlyMyTests, searchQuery, tests, currentUser]);

  // Handle bulk deletion
  const handleBulkDelete = async () => {
    try {
      const selectedIds = Object.keys(selectedTests);
      if (selectedIds.length === 0) return;

      if (confirm(`Are you sure you want to delete ${selectedIds.length} tests?`)) {
        // Use Firestore batch for efficient deletion
        const batch = writeBatch(db);

        selectedIds.forEach(id => {
          const testRef = doc(db, "tests", id);
          batch.delete(testRef);
        });

        await batch.commit();
        console.log(`Deleted ${selectedIds.length} tests`);

        // Clear selections
        setSelectedTests({});
      }
    } catch (error) {
      console.error("Error deleting tests:", error);
      alert("An error occurred while deleting tests");
    }
  };

  // Reset search and filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setShowOnlyMyTests(false);
    setSelectedTests({});
  };

  // Toggle admin mode
  const handleToggleAdminMode = () => {
    setAdminMode(prev => !prev);
    setSelectedTests({}); // Clear selections when toggling mode
  };

  // Add selection column to the columns array
  const enhancedColumns = useMemo(() => {
    const selectionColumn = {
      id: "select",
      header: "Select",
      cell: ({ row }) => {
        const test = row.original;
        // In admin mode, show checkboxes for all tests
        // In normal mode, only show checkboxes for user's own tests
        const canSelect = adminMode || test.createdBy?.uid === currentUser?.uid;

        return canSelect ? (
          <input
            type="checkbox"
            checked={!!selectedTests[test.id]}
            onChange={(e) => {
              setSelectedTests(prev => ({
                ...prev,
                [test.id]: e.target.checked
              }));
            }}
            className="size-4 rounded border-tremor-border text-blue-600"
            onClick={(e) => e.stopPropagation()}
          />
        ) : null;
      }
    };

    return [
      selectionColumn,
      ...columns
    ];
  }, [columns, selectedTests, currentUser, adminMode]);

  return (
    <div className="space-y-4">
      {/* Filter and search controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant={showOnlyMyTests ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyMyTests(true)}
            className="flex items-center gap-2"
          >
            <RiUser3Line className="h-4 w-4" />
            My Tests
          </Button>
          <Button
            variant={!showOnlyMyTests ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyMyTests(false)}
            className="flex items-center gap-2"
          >
            <RiTeamLine className="h-4 w-4" />
            All Tests
          </Button>

          {/* Admin Mode Toggle - Only visible to admins */}
          {isAdmin && (
            <Button
              variant={adminMode ? "destructive" : "outline"}
              size="sm"
              onClick={handleToggleAdminMode}
              className="flex items-center gap-2 ml-2"
            >
              <RiDeleteBin5Line className="h-4 w-4" />
              {adminMode ? "Exit Admin Mode" : "Admin Mode"}
            </Button>
          )}
        </div>

        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search tests by name, type, creator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          {searchQuery && (
            <button
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setSearchQuery("")}
            >
              <RiCloseLine className="h-5 w-5 text-gray-400 hover:text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Admin mode indicator */}
      {adminMode && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-center">
          <RiDeleteBin5Line className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-600 dark:text-red-400 font-medium">Admin Mode: You can delete any test</span>
        </div>
      )}

      {/* Search results stats and actions */}
      <div className="flex flex-wrap justify-between items-center">
        <div className="text-sm text-gray-500 mb-2 md:mb-0">
          {filteredTests.length} {filteredTests.length === 1 ? 'test' : 'tests'} found
          {(searchQuery || showOnlyMyTests) && (
            <button
              className="ml-2 text-blue-500 hover:text-blue-700 hover:underline"
              onClick={handleResetFilters}
            >
              Reset filters
            </button>
          )}
        </div>

        {Object.keys(selectedTests).length > 0 && (
          <div className="flex items-center gap-4 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <span className="text-sm font-medium">
              <span className="rounded bg-blue-100 dark:bg-blue-900 px-2 py-1 font-medium text-blue-700 dark:text-blue-300">
                {Object.keys(selectedTests).length}
              </span>
              <span className="ml-2">selected</span>
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="flex items-center gap-2"
            >
              <RiDeleteBin5Line className="h-4 w-4" />
              Delete selected
            </Button>
          </div>
        )}
      </div>

      {filteredTests.length > 0 ? (
        <DataTable
          data={filteredTests}
          columns={enhancedColumns}
        />
      ) : (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-md">
          <p className="text-gray-500 dark:text-gray-400">No tests found matching your criteria.</p>
          <button
            className="mt-2 text-blue-500 hover:text-blue-700 hover:underline"
            onClick={handleResetFilters}
          >
            Clear search and filters
          </button>
        </div>
      )}
    </div>
  );
}
export default function HardwareDashboard() {
  const router = useRouter();

  // Dashboard state
  const [chips, setChips] = useState<ChipStatus[]>([]);
  const [tests, setTests] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false); // controls the Create Test modal
  const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Aggregated test data for charts
  const [aggregatedData, setAggregatedData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);

  // New Test modal form fields
  const [newTestName, setNewTestName] = useState("");
  const [newChipType, setNewChipType] = useState("3-SAT");

  // For your chips (mock data)
  const mockChips: ChipStatus[] = [
    { id: "1", name: "3-SAT Solver", type: "3-SAT", status: "online", successRate: 97.8, avgRuntime: 124 },
    { id: "2", name: "LDPC Solver", type: "LDPC", status: "online", successRate: 94.2, avgRuntime: 156 },
    { id: "3", name: "K-SAT Solver", type: "K-SAT", status: "maintenance", successRate: 89.5, avgRuntime: 200 },
  ];

  // Authenticate and fetch tests in real time, also check if user is admin
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      // Check if user is admin
      setIsAdmin(user.role === "admin");

      // Set chips data
      setChips(mockChips);

      // Subscribe to tests collection
      const unsubscribe = onSnapshot(
        collection(db, "tests"),
        (snapshot) => {
          const testsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          })) as TestRun[];
          testsData.sort((a, b) => {
            const dateA = a.created?.seconds ? a.created.seconds * 1000 : new Date(a.created).getTime();
            const dateB = b.created?.seconds ? b.created.seconds * 1000 : new Date(b.created).getTime();
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

  // Aggregate tests for charts and summary stats
  useEffect(() => {
    if (tests.length === 0) {
      setAggregatedData([]);
      setSummary([]);
      return;
    }

    const groups: { [key: string]: number } = {};
    tests.forEach((test) => {
      const created = test.created?.seconds
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

    const totalTests = tests.length;
    const avgSuccess = tests.reduce((sum, test) => sum + (test.results?.successRate || 0), 0) / totalTests;
    const latest = tests[0];
    const latestTestDate = latest.created?.seconds
      ? new Date(latest.created.seconds * 1000).toLocaleString()
      : new Date(latest.created).toLocaleString();

    setSummary([
      { name: "Total Tests", value: totalTests.toString() },
      { name: "Average Success", value: `${avgSuccess.toFixed(1)}%` },
      { name: "Latest Test", value: latestTestDate },
    ]);
  }, [tests]);

  // Handler to add a sample test
  const handleAddSampleTest = async () => {
    try {
      const sampleTest = {
        name: "Sample Test " + new Date().toLocaleString(),
        chipType: "3-SAT",
        status: "completed",
        created: serverTimestamp(),
        completed: serverTimestamp(),
        results: {
          successRate: 95.5,
          solutionCount: 10,
          evidence: "Placeholder evidence: This is a sample JSON result."
        },
        createdBy: {
          uid: "bdatsko_uid", // Use a consistent UID for all sample tests
          name: "Ben Datsko",
          displayName: "Ben Datsko",
          email: "bdatsko@umich.edu",
          role: "user",
          photoURL: "https://ui-avatars.com/api/?name=Ben+Datsko&background=0D8ABC&color=fff", // Optional: Generate an avatar
          avatar: "https://ui-avatars.com/api/?name=Ben+Datsko&background=0D8ABC&color=fff"
        }
      };
      await addDoc(collection(db, "tests"), sampleTest);
      console.log("Sample test added");
    } catch (error) {
      console.error("Error adding sample test:", error);
    }
  };

  // Handler to view a test's details
  const handleViewResults = (test: TestRun) => {
    setScrollPosition(window.scrollY);
    setSelectedTest(test);
    window.scrollTo(0, 0);
  };

  // Handler to return to the dashboard from details view
  const handleBackToDashboard = () => {
    setSelectedTest(null);
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 0);
  };

  // Handler for creating a new test via the modal form
  const handleCreateTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const storedUserStr = localStorage.getItem("user");
      const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;

      if (!storedUser) {
        console.error("No user found in localStorage");
        setError("You must be logged in to create a test");
        return;
      }

      const newTest = {
        name: newTestName,
        chipType: newChipType,
        status: "queued",
        created: serverTimestamp(),
        createdBy: {
          uid: storedUser.uid,
          name: storedUser.displayName,
          displayName: storedUser.displayName,  // Include both for compatibility
          email: storedUser.email,
          role: storedUser.role || "user",
          photoURL: storedUser.photoURL,        // Add Google photo URL
          avatar: storedUser.photoURL           // Include both for compatibility
        }
      };

      await addDoc(collection(db, "tests"), newTest);
      console.log("New test created");
      setNewTestName("");
      setNewChipType("3-SAT");
      setIsOpen(false);
    } catch (error) {
      console.error("Error creating new test:", error);
    }
  };

  // DataTable columns
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
              src={creator?.photoURL || creator?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.name || 'User')}`}
              alt="Creator Avatar"
              className="h-8 w-8 rounded-full"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.name || 'User')}`;
              }}
            />
            <div className="absolute left-0 top-full mt-1 hidden w-48 p-2 bg-gray-700 text-white text-xs rounded-md group-hover:block z-10">
              <p className="font-medium">{creator?.displayName || creator?.name || "Unknown"}</p>
              <p>{creator?.email || "No email"}</p>
              <p className="text-gray-300">{creator?.role || "No role"}</p>
            </div>
          </div>
        );
      }
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
            className={`
              inline-flex items-center rounded-full px-2 py-1 text-xs font-medium 
              ${status === "completed" ? "bg-green-500/10 text-green-500" :
              status.includes("running") ? "bg-blue-500/10 text-blue-500" :
                status === "failed" ? "bg-red-500/10 text-red-500" :
                  "bg-gray-500/10 text-gray-500"}
            `}
          >
            {displayStatus}
          </div>
        );
      }
    },
    {
      accessorKey: "created",
      header: "Created",
      cell: ({ row }: any) => {
        const created = row.original.created;
        const date = created?.seconds ? new Date(created.seconds * 1000) : new Date(created);
        return date.toLocaleString();
      }
    },
    {
      id: "details",
      header: "Results",
      cell: ({ row }: any) => (
        <Button variant="link" onClick={() => handleViewResults(row.original)}>
          View Results
        </Button>
      )
    }
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  // Calculate chip metrics
  const onlineChips = mockChips.filter(c => c.status === "online").length;
  const totalChips = mockChips.length;
  const avgChipSuccess = totalChips > 0
    ? mockChips.reduce((sum, chip) => sum + (chip.successRate || 0), 0) / totalChips
    : 0;

  // Calculate test metrics
  const runningTests = tests.filter(t =>
    t.status === "running" ||
    t.status.startsWith("running_") ||
    t.status === "queued"
  ).length;
  const completedTests = tests.filter(t => t.status === "completed").length;
  const failedTests = tests.filter(t => t.status === "failed" || t.status === "error").length;

  const valueFormatter = (num: number) => `${Intl.NumberFormat("us").format(num)}`;

  // Render test details view if a test is selected
  if (selectedTest) {
    return (
      <main className="p-4">
        <div className="flex items-center mb-6">
          <Button
            variant="outline"
            onClick={handleBackToDashboard}
            className="mr-4 flex items-center gap-2"
          >
            <RiArrowLeftLine className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            Test Details: {selectedTest.name}
          </h1>
        </div>
        <Divider />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <h3 className="text-lg font-medium mb-2">Test Info</h3>
              <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-500">Chip Type</dt>
                  <dd className="text-sm font-medium">{selectedTest.chipType}</dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd className="text-sm font-medium">
                    <div
                      className={`
                        inline-flex items-center rounded-full px-2 py-1 text-xs font-medium 
                        ${selectedTest.status === "completed" ? "bg-green-500/10 text-green-500" :
                        selectedTest.status.includes("running") ? "bg-blue-500/10 text-blue-500" :
                          selectedTest.status === "failed" ? "bg-red-500/10 text-red-500" :
                            "bg-gray-500/10 text-gray-500"}
                      `}
                    >
                      {selectedTest.status.charAt(0).toUpperCase() + selectedTest.status.slice(1)}
                    </div>
                  </dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-sm font-medium">
                    {selectedTest.created?.seconds
                      ? new Date(selectedTest.created.seconds * 1000).toLocaleString()
                      : new Date(selectedTest.created).toLocaleString()}
                  </dd>
                </div>
                <div className="py-2 flex justify-between">
                  <dt className="text-sm text-gray-500">Created by</dt>
                  <dd className="text-sm font-medium flex items-center">
                    <img
                      src={selectedTest.createdBy?.photoURL || selectedTest.createdBy?.avatar || '/default-avatar.png'}
                      alt="Avatar"
                      className="h-6 w-6 rounded-full mr-2"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTest.createdBy?.displayName || selectedTest.createdBy?.name || 'User')}`;
                      }}
                    />
                    {selectedTest.createdBy?.displayName || selectedTest.createdBy?.name || "Unknown"}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card>
              <h3 className="text-lg font-medium mb-2">Results</h3>
              {selectedTest.results ? (
                <pre className="mt-2 rounded bg-gray-100 p-4 dark:bg-gray-700 overflow-auto max-h-80">
                  {JSON.stringify(selectedTest.results, null, 2)}
                </pre>
              ) : (
                <p>No results available</p>
              )}
            </Card>
          </div>
        </div>
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-4">Test Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-base font-medium mb-2">Success Rate Trend</h3>
              <p className="text-sm text-gray-500 mb-4">Monthly performance history</p>
              <LineChart
                data={performanceData}
                index="month"
                categories={["success", "failures"]}
                colors={["emerald", "rose"]}
                valueFormatter={(num) => `${num.toFixed(1)}%`}
                showYAxis={true}
                showLegend={true}
                className="h-64"
              />
            </Card>
            <Card>
              <h3 className="text-base font-medium mb-2">Chip Utilization</h3>
              <p className="text-sm text-gray-500 mb-4">Distribution by chip type</p>
              <DonutChart
                data={utilizationData}
                category="value"
                index="name"
                valueFormatter={(num) => `${num.toFixed(1)}%`}
                colors={["blue", "indigo", "violet"]}
                className="h-64"
              />
            </Card>
            <Card>
              <h3 className="text-base font-medium mb-2">Test Runtime</h3>
              <p className="text-sm text-gray-500 mb-4">Performance metrics over time (ms)</p>
              <LineChart
                data={runtimeData}
                index="date"
                categories={["avg", "min", "max"]}
                colors={["blue", "emerald", "amber"]}
                valueFormatter={(num) => Intl.NumberFormat("us").format(num)}
                showYAxis={true}
                showLegend={true}
                className="h-64"
              />
            </Card>
            <Card>
              <h3 className="text-base font-medium mb-2">Test Frequency</h3>
              <p className="text-sm text-gray-500 mb-4">Total tests by date</p>
              <BarChart
                data={aggregatedData}
                index="date"
                categories={["Tests"]}
                colors={["blue"]}
                valueFormatter={valueFormatter}
                showYAxis={true}
                showLegend={false}
                className="h-64"
              />
            </Card>
          </div>
        </div>
        <div className="mt-6">
          <Card>
            <h3 className="text-lg font-medium mb-4">Resource Usage</h3>
            <div className="flex flex-col gap-x-6 gap-y-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                  Enterprise
                </h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                  User ID: <span className="font-medium text-gray-900 dark:text-gray-50">admin_dfQ7s</span>
                </p>
              </div>
              <div className="mt-4 flex items-center gap-4 gap-y-2 sm:mt-0 sm:gap-x-8">
                {usageSummary.map((item, index) => (
                  <React.Fragment key={item.name}>
                    <div>
                      <p className="whitespace-nowrap text-sm text-gray-500 dark:text-gray-500">
                        {item.name}
                      </p>
                      {item.name === 'Last invoice' ? (
                        <a
                          className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-blue-500 hover:underline hover:underline-offset-4 dark:text-blue-500"
                          href="#"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {item.value}
                        </p>
                      )}
                    </div>
                    <span className="flex">
                      {index < usageSummary.length - 1 && (
                        <span className="h-10 w-px bg-slate-500/20" aria-hidden="true" />
                      )}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <Divider className="my-5" />
            <div className="flex items-center gap-3">
              <Badge variant="success" className="rounded-full">
                Active
              </Badge>
              <span className="h-6 w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
              <span className="text-sm text-gray-500 dark:text-gray-500">
                Sept 24 period
              </span>
              <span className="hidden h-6 w-px bg-gray-200 dark:bg-gray-800 sm:block" aria-hidden="true" />
              <span className="hidden text-sm text-gray-500 dark:text-gray-500 sm:block">
                Started Sep 1, 2024 (billed on the 28th)
              </span>
            </div>
            <BarChart
              data={resourceData}
              index="date"
              colors={['blue', 'emerald']}
              categories={['GPU cluster', 'Workspace usage']}
              stack={true}
              valueFormatter={(num) => `$${Intl.NumberFormat("us").format(num)}`}
              showLegend={true}
              showYAxis={true}
              className="mt-6 h-64"
            />
          </Card>
        </div>
      </main>
    );
  }

  // Dashboard view with modal integrated
  return (
    <main className="p-4">
      {/* Dashboard header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Hardware Dashboard
          </h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
            Real-time monitoring of hardware solvers with performance metrics
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 text-base sm:text-sm"
          >
            Create Test
            <RiAddLine className="-mr-0.5 size-5 shrink-0" aria-hidden="true" />
          </Button>
          {/*<Button*/}
          {/*  onClick={handleAddSampleTest}*/}
          {/*  className="flex items-center gap-2 text-base sm:text-sm"*/}
          {/*>*/}
          {/*  Add Sample Test*/}
          {/*</Button>*/}
        </div>
      </div>
      <Divider />

      {/* Chip and test status cards */}
      <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Chip Status
          </dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">
            {onlineChips}/{totalChips}
          </dd>
          <CategoryBar
            values={[onlineChips, totalChips - onlineChips]}
            className="mt-6"
            colors={["blue", "lightGray"]}
            showLabels={false}
          />
          <ul
            role="list"
            className="mt-4 flex flex-wrap gap-x-10 gap-y-4 text-sm"
          >
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
                <span className="ml-5 text-xs text-gray-500">
                  {chip.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Success Rate
          </dt>
          <div className="mt-4 flex flex-nowrap items-center justify-between gap-y-4">
            <dd className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm bg-blue-500 dark:bg-blue-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm">Successful</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {avgChipSuccess.toFixed(1)}%
                </span>
              </div>
            </dd>
            <ProgressCircle
              value={avgChipSuccess}
              radius={45}
              strokeWidth={7}
            />
          </div>
        </Card>

        <Card>
          <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Test Status
          </dt>
          <div className="mt-4 flex items-center gap-x-8 gap-y-4">
            <dd className="space-y-3 whitespace-nowrap">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm bg-blue-500 dark:bg-blue-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm">Active</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {runningTests}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm bg-green-500 dark:bg-green-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm">Completed</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {completedTests}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-sm bg-red-500 dark:bg-red-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm">Failed</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {failedTests}
                </span>
              </div>
            </dd>
          </div>
        </Card>
      </dl>

      <Divider className="my-6" />

      {/* Recent tests DataTable */}
      <h2 className="mb-4 text-lg font-medium">Recent Tests</h2>
      <EnhancedTestTable
        tests={tests}
        columns={columns}
        handleViewResults={handleViewResults}
        isAdmin={isAdmin} // Pass the isAdmin state
      />

      {/* Create New Test Modal */}
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        static={true}
        className="relative z-50"
      >
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
        <DialogPanel className="relative z-50 max-w-5xl overflow-visible rounded-lg bg-white p-0 shadow-xl dark:bg-gray-800">
          <form onSubmit={handleCreateTest} method="POST">
            <div className="absolute right-0 top-0 pr-3 pt-3">
              <button
                type="button"
                className="rounded-tremor-small text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content p-2"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <RiCloseLine className="size-5 shrink-0" aria-hidden={true} />
              </button>
            </div>
            <div className="border-tremor-border dark:border-dark-tremor-border border-b px-6 py-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Create New Test
              </h3>
            </div>
            <div className="flex flex-col-reverse md:flex-row">
              <div
                className="flex flex-col justify-between md:w-80 md:border-r md:border-gray-200 dark:md:border-gray-700">
                <div className="flex-1 grow">
                  <div className="border-t border-gray-200 p-6 dark:border-gray-700 md:border-none">
                    <div className="flex items-center space-x-3">
                      <div
                        className="inline-flex shrink-0 items-center justify-center rounded bg-blue-100 p-3 dark:bg-blue-900"
                      >
                        <RiAppsFill
                          className="size-5 text-blue-600 dark:text-blue-300"
                          aria-hidden={true}
                        />
                      </div>
                      <div>
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                          Astro Analytics
                        </h3>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                          Hardware testing platform
                        </p>
                      </div>
                    </div>
                    <Divider />
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-4">
                      Description:
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      Create a new hardware test to evaluate solver performance.
                    </p>
                    <h4 className="mt-6 text-sm font-medium text-gray-900 dark:text-gray-100">
                      Supported functionality:
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      Tests can be configured for different chip types and will provide detailed performance metrics upon completion.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 p-6 dark:border-gray-700">
                  <button
                    type="button"
                    className="rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Create Test
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-6 p-6 md:px-6 md:pb-20 md:pt-6">
                <div>
                  <div className="flex items-center space-x-3">
                    <div
                      className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      1
                    </div>
                    <label
                      htmlFor="testName"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      Test Name
                    </label>
                  </div>
                  <input
                    type="text"
                    name="testName"
                    id="testName"
                    value={newTestName}
                    onChange={(e) => setNewTestName(e.target.value)}
                    className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    placeholder="Enter test name"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <div
                      className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      2
                    </div>
                    <label
                      htmlFor="chipType"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      Select Chip Type
                    </label>
                  </div>
                  <Select
                    name="chipType"
                    id="chipType"
                    className="mt-4 w-full"
                    value={newChipType}
                    onValueChange={setNewChipType}
                  >
                    <SelectItem value="3-SAT">3-SAT Solver</SelectItem>
                    <SelectItem value="LDPC">LDPC Solver</SelectItem>
                    <SelectItem value="K-SAT">K-SAT Solver</SelectItem>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <div
                      className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      3
                    </div>
                    <label
                      htmlFor="testOptions"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      Test Options
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Configure advanced test parameters (optional)
                  </p>
                  <Select
                    name="testOptions"
                    id="testOptions"
                    className="mt-4 w-full"
                    defaultValue="standard"
                  >
                    <SelectItem value="standard">Standard Test Suite</SelectItem>
                    <SelectItem value="extended">Extended Test Suite</SelectItem>
                    <SelectItem value="performance">Performance Benchmark</SelectItem>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <div
                      className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      4
                    </div>
                    <label
                      htmlFor="priority"
                      className="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      Test Priority
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Higher priority tests will be processed sooner
                  </p>
                  <Select
                    name="priority"
                    id="priority"
                    className="mt-4 w-full"
                    defaultValue="normal"
                  >
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </Select>
                </div>
              </div>
            </div>
          </form>
        </DialogPanel>
      </Dialog>
    </main>
  );
}