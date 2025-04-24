"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  RiRefreshLine,
  RiAddLine,
  RiSearchLine,
  RiArrowDownSLine,
  RiCalendarLine,
  RiFilterLine,
  RiMoreLine,
  RiCheckLine,
  RiArrowRightSLine,
  RiArrowDownSFill,
  RiFileDownloadLine,
  RiCodeLine,
  RiSettings4Line,
  RiFileListLine,
  RiAttachmentLine,
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
  DropdownMenuTrigger
} from "@/components/DropdownMenu";
import { Badge } from "@/components/Badge";
import { Checkbox } from "@/components/Checkbox";
import { TestRun } from "@/types/test";
import TestDetails from "@/components/dashboard/TestDetails";

// Base URL for the backend API; configure NEXT_PUBLIC_API_BASE_URL in .env.local
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// Add types for API responses
interface ApiHealth {
  api_status: string;
  db_status: string;
  timestamp: string;
}

interface TestResponse {
  id: string;
  name: string;
  chipType: string;
  environment: string;
  created: string;
  status: string;
  files?: Array<{
    id: string;
    filename: string;
    file_size: number;
    created: string;
  }>;
  metadata?: {
    createdBy?: {
      name: string;
      photoURL?: string;
    };
    [key: string]: any;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("Last 12 hours");
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [testName, setTestName] = useState("");
  const [chipType, setChipType] = useState("3SAT");
  const [expandedTests, setExpandedTests] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement> | any) => {
    // Handle both direct checkbox events and custom component events
    const isChecked = e.target ? e.target.checked : e;
    
    if (isChecked) {
      setSelectedTests(filteredTests.map(test => test.id));
    } else {
      setSelectedTests([]);
    }
  };

  const handleBulkAction = async (action: 'delete' | 'rerun') => {
    if (action === 'delete') {
      if (window.confirm(`Delete ${selectedTests.length} selected tests?`)) {
        await handleBulkDelete(selectedTests);
      }
    } else if (action === 'rerun') {
      if (window.confirm(`Rerun ${selectedTests.length} selected tests?`)) {
        await handleBulkRerun(selectedTests);
      }
    }
    setShowActions(false);
  };

  const handleBulkDelete = async (testIds: string[]) => {
    const promises = testIds.map(id =>
      fetch(`${API_BASE}/api/tests/${id}`, {
        method: "DELETE",
      })
    );

    try {
      await Promise.all(promises);
      setTests(prev => prev.filter(t => !testIds.includes(t.id)));
      setSelectedTests([]);
      setError(null);
    } catch (e) {
      console.error("Bulk delete failed:", e);
      setError("Failed to delete some tests");
    }
  };

  const handleBulkRerun = async (testIds: string[]) => {
    const promises = testIds.map(async (id) => {
      try {
        // First get the original test configuration
        const res = await fetch(`${API_BASE}/api/tests/${id}`);
        if (!res.ok) throw new Error(`Failed to get test ${id}`);
        const test = await res.json();

        // Create a new test with the same configuration
        const payload = {
          name: `${test.name} (Rerun)`,
          chipType: test.chipType,
          testMode: test.testMode,
          config: test.config,
          createdBy: test.metadata?.createdBy
        };

        const createRes = await fetch(`${API_BASE}/api/tests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!createRes.ok) throw new Error(`Failed to create rerun test for ${id}`);
        return await createRes.json();
      } catch (e) {
        console.error(`Failed to rerun test ${id}:`, e);
        throw e;
      }
    });

    try {
      const newTests = await Promise.all(promises);
      setTests(prev => [...newTests, ...prev]);
      setSelectedTests([]);
      setError(null);
    } catch (e) {
      console.error("Bulk rerun failed:", e);
      setError("Failed to rerun some tests");
    }
  };

  const handleCreateTest = async () => {
    try {
      setUploading(true);
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (!user) {
        setError("You must be logged in to create a test");
        setUploading(false);
        return;
      }

      // Verify test name is not empty
      if (!testName.trim()) {
        setError("Test name cannot be empty");
        setUploading(false);
        return;
      }

      const payload = {
        name: testName,
        chipType,
        testMode: "production",
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
      
      // Reset form
      setTestName("");
      setChipType("3SAT");
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
      await handleBulkRerun([testId]);
    } catch (e) {
      console.error(`Failed to rerun test ${testId}:`, e);
      setError("Failed to rerun test");
    }
  };

  // Load tests from backend API
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/login");
      return;
    }

    const fetchTests = async () => {
      setIsLoading(true);
      try {
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
          setError(`Failed to load tests (${res.status})`);
        } else {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped: TestRun[] = data.map((t: any) => ({
              id: t.id,
              name: t.name,
              chipType: t.chipType,
              environment: t.environment,
              created: t.created,
              status: t.status,
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
        setError("Failed to load tests");
      } finally {
        setIsLoading(false);
      }
    };

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
        const data: ApiHealth = await res.json();
        setApiHealth(data);
      } catch (e) {
        console.error("Health check failed:", e);
        setApiHealth({
          api_status: "error",
          db_status: "unknown",
          timestamp: new Date().toISOString(),
        });
      }
    };

    checkApiHealth();
    const iv = setInterval(checkApiHealth, 30000);
    return () => clearInterval(iv);
  }, []);

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
          results.forEach((result: TestResponse) => {
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

  // Functions for handling file downloads
  const handleDownloadFile = async (testId: string, fileType: string, fileName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tests/${testId}/files/${fileType}/${fileName}`, {
        method: "GET",
      });
      
      if (!res.ok) {
        throw new Error(`Failed to download file (${res.status})`);
      }
      
      // Create a temporary link to trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed:", e);
      setError("Failed to download file");
    }
  };
  
  const handleDownloadConfig = async (testId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tests/${testId}/config`, {
        method: "GET",
      });
      
      if (!res.ok) {
        throw new Error(`Failed to download configuration (${res.status})`);
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "config.json";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Config download failed:", e);
      setError("Failed to download configuration");
    }
  };

  // Counts per chip type
  const satTestsCount = tests.filter((t) => t.chipType === "3SAT").length;
  const ldpcTestsCount = tests.filter((t) => t.chipType === "LDPC").length;
  const hardwareTestsCount = tests.filter((t) => t.chipType === "HARDWARE").length;

  // Filter & search
  const filteredTests = tests
    .filter((t) => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "3sat") return t.chipType === "3SAT";
      if (selectedCategory === "ldpc") return t.chipType === "LDPC";
      if (selectedCategory === "hardware") return t.chipType === "HARDWARE";
      if (selectedCategory === "completed") return t.status === "completed";
      if (selectedCategory === "running") return t.status === "running";
      if (selectedCategory === "failed") return t.status === "failed";
      if (selectedCategory === "queued") return t.status === "queued";
      return true;
    })
    .filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.chipType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.status.toLowerCase().includes(searchQuery.toLowerCase())
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
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Tests Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage and monitor your hardware test runs across all platforms
          </p>
        </div>
        {isAdmin && (
          <Drawer>
            <DrawerTrigger asChild>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                size="sm"
              >
                <RiAddLine className="h-4 w-4" />
                New Test
              </Button>
            </DrawerTrigger>
            <DrawerContent className="sm:max-w-lg">
              <DrawerHeader>
                <DrawerTitle>Create New Test</DrawerTitle>
                <DrawerDescription className="text-sm text-gray-500">
                  Configure your test parameters below
                </DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="testName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Test Name
                    </label>
                    <input
                      type="text"
                      id="testName"
                      name="testName"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter test name"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="chipType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Chip Type
                    </label>
                    <select
                      id="chipType"
                      name="chipType"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      value={chipType}
                      onChange={(e) => setChipType(e.target.value)}
                    >
                      <option value="3SAT">3SAT</option>
                      <option value="LDPC">LDPC</option>
                      <option value="HARDWARE">Hardware</option>
                    </select>
                  </div>
                </div>
              </DrawerBody>
              <DrawerFooter className="flex justify-end space-x-2">
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </DrawerClose>
                <Button 
                  size="sm"
                  onClick={handleCreateTest}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={uploading || !testName}
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>Create Test</>
                  )}
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-grow lg:max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <RiSearchLine className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg
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
            <SelectTrigger className="w-[140px] bg-white border border-gray-200 rounded-lg text-sm h-10 shadow-sm hover:border-gray-300 transition duration-200 dark:bg-gray-800 dark:border-gray-700">
              <SelectValue placeholder="All Tests" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tests</SelectItem>
              <SelectGroup>
                <SelectGroupLabel>Chip Type</SelectGroupLabel>
                <SelectItem value="3sat">3SAT ({satTestsCount})</SelectItem>
                <SelectItem value="ldpc">LDPC ({ldpcTestsCount})</SelectItem>
                <SelectItem value="hardware">Hardware ({hardwareTestsCount})</SelectItem>
              </SelectGroup>
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
            <SelectTrigger className="w-[140px] bg-white border border-gray-200 rounded-lg text-sm h-10 shadow-sm hover:border-gray-300 transition duration-200 dark:bg-gray-800 dark:border-gray-700">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5"
                  >
                    Actions
                    <RiArrowDownSLine className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkAction('delete')}>
                    Delete selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction('rerun')}>
                    Rerun selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTests([])}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tests List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        {filteredTests.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="relative w-12 px-6 sm:w-16 sm:px-8">
                  <Checkbox
                    checked={filteredTests.length > 0 && selectedTests.length === filteredTests.length}
                    onChange={handleSelectAll}
                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4"
                  />
                  <span className="sr-only">Select</span>
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Created
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Chip Type
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Status
                </TableHead>
                <TableHead className="relative px-6 py-3">
                  <span className="sr-only">Expand</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTests.map((test) => (
                <React.Fragment key={test.id}>
                  <TableRow
                    onClick={() => toggleTestExpansion(test.id)}
                    className={cn(
                      "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer",
                      selectedTests.includes(test.id) && "bg-gray-50 dark:bg-gray-800/50"
                    )}
                  >
                    <TableCell className="relative w-12 px-6 sm:w-16 sm:px-8">
                      <Checkbox
                        checked={selectedTests.includes(test.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectTest(test.id, e);
                        }}
                        className="absolute left-4 top-1/2 -mt-2 h-4 w-4"
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
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
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 inline-flex text-xs font-mono leading-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        {test.chipType}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={cn(
                          "px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
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
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {expandedTests.includes(test.id) ? (
                        <RiArrowDownSFill className="h-5 w-5 text-gray-400" />
                      ) : (
                        <RiArrowRightSLine className="h-5 w-5 text-gray-400" />
                      )}
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded row with details */}
                  {expandedTests.includes(test.id) && (
                    <TableRow className="bg-gray-50 dark:bg-gray-800/30">
                      <TableCell colSpan={5} className="px-6 py-4">
                        <div className="grid grid-cols-1 gap-6">
                          {/* Test Details Section */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Test Details</h4>
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <dt className="text-gray-500 dark:text-gray-400">Name</dt>
                                <dd className="text-gray-900 dark:text-white">{test.name}</dd>
                                
                                <dt className="text-gray-500 dark:text-gray-400">ID</dt>
                                <dd className="text-gray-900 dark:text-white font-mono text-xs">{test.id}</dd>
                                
                                <dt className="text-gray-500 dark:text-gray-400">Created By</dt>
                                <dd className="text-gray-900 dark:text-white">
                                  {test.metadata?.createdBy?.name || "—"}
                                </dd>
                                
                                <dt className="text-gray-500 dark:text-gray-400">Created At</dt>
                                <dd className="text-gray-900 dark:text-white">
                                  {new Date(test.created).toLocaleString()}
                                </dd>
                              </dl>
                            </div>

                            <div>
                              {test.status === "completed" && test.results && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Test Results Summary</h4>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div className="text-gray-500 dark:text-gray-400">Status</div>
                                    <div className="text-green-600 dark:text-green-400 font-medium">Completed</div>
                                    
                                    <div className="text-gray-500 dark:text-gray-400">Runtime</div>
                                    <div className="text-gray-900 dark:text-white">
                                      {test.runtime ? `${test.runtime.toFixed(2)}s` : "—"}
                                    </div>
                                    
                                    <div className="text-gray-500 dark:text-gray-400">Success Rate</div>
                                    <div className="text-gray-900 dark:text-white">
                                      {test.results.summary?.successRate ? 
                                        `${(test.results.summary.successRate * 100).toFixed(1)}%` : 
                                        test.runsSolved && test.runsAttempted ? 
                                          `${((test.runsSolved / test.runsAttempted) * 100).toFixed(1)}%` : 
                                          "—"}
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {test.status === "failed" && (
                                <div>
                                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Error Information</h4>
                                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-md p-3 text-sm text-red-800 dark:text-red-400">
                                    {test.error || "Unknown error occurred during test execution."}
                                  </div>
                                </div>
                              )}
                              
                              {test.status === "running" && (
                                <div>
                                  <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">Test In Progress</h4>
                                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-md p-3 text-sm text-blue-800 dark:text-blue-400 flex items-center">
                                    <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse mr-2"></span>
                                    Test is currently running. Results will be available when completed.
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Files and Downloads Section */}
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h4 className="text-sm font-medium mb-3">Files & Downloads</h4>
                            
                            {/* Show Attached Files */}
                            {test.files && test.files.length > 0 && (
                              <div className="mb-4">
                                <h5 className="text-sm font-medium mb-2">Attached Files</h5>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700">
                                  {test.files.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between p-2.5 text-sm">
                                      <div className="flex items-center">
                                        <RiAttachmentLine className="h-4 w-4 text-blue-500 mr-2" />
                                        <span className="text-gray-800 dark:text-gray-200">
                                          {file.filename}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500">
                                          ({(file.file_size / 1024).toFixed(1)} KB)
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs flex items-center gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadFile(test.id, 'files', file.filename);
                                        }}
                                      >
                                        <RiFileDownloadLine className="h-3.5 w-3.5" />
                                        Download
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Input Files Section */}
                              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                                <div className="flex items-center mb-2">
                                  <RiFileListLine className="h-4 w-4 text-blue-500 mr-2" />
                                  <h5 className="text-sm font-medium">Input Files</h5>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                  Original test input parameters and files
                                </p>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadFile(test.id, 'input', 'input.txt');
                                  }}
                                  className="w-full justify-center text-xs"
                                  variant="outline"
                                  size="sm"
                                >
                                  <RiFileDownloadLine className="h-3.5 w-3.5 mr-1.5" />
                                  Download Input Files
                                </Button>
                              </div>
                              
                              {/* Configuration Section */}
                              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                                <div className="flex items-center mb-2">
                                  <RiSettings4Line className="h-4 w-4 text-green-500 mr-2" />
                                  <h5 className="text-sm font-medium">Configuration</h5>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                  Test configuration and metadata
                                </p>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadConfig(test.id);
                                  }}
                                  className="w-full justify-center text-xs"
                                  variant="outline"
                                  size="sm"
                                >
                                  <RiFileDownloadLine className="h-3.5 w-3.5 mr-1.5" />
                                  Download Config
                                </Button>
                              </div>
                              
                              {/* Output Files Section */}
                              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                                <div className="flex items-center mb-2">
                                  <RiCodeLine className="h-4 w-4 text-purple-500 mr-2" />
                                  <h5 className="text-sm font-medium">Output Files</h5>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                  Test results and generated output
                                </p>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadFile(test.id, 'output', 'output.txt');
                                  }}
                                  className="w-full justify-center text-xs"
                                  variant="outline"
                                  size="sm"
                                  disabled={test.status !== "completed"}
                                >
                                  <RiFileDownloadLine className="h-3.5 w-3.5 mr-1.5" />
                                  Download Output Files
                                </Button>
                              </div>
                            </div>
                          </div>
                          
                          {/* JSON Results Section for completed tests */}
                          {test.status === "completed" && test.results && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium">Detailed Results</h4>
                                <Button
                                  variant="ghost" 
                                  size="sm"
                                  className="text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const jsonStr = JSON.stringify(test.results, null, 2);
                                    const blob = new Blob([jsonStr], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `results-${test.id}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                  }}
                                >
                                  <RiFileDownloadLine className="h-3.5 w-3.5 mr-1.5" />
                                  Download JSON
                                </Button>
                              </div>
                              <pre className="text-xs border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-auto max-h-48">
                                {JSON.stringify(test.results, null, 2)}
                              </pre>
                            </div>
                          )}
                        
                          {/* Actions Section */}
                          <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 pt-4 gap-2">
                            {test.status !== "running" && (
                              <Button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRerunTest(test.id);
                                }}
                                className="text-blue-600 dark:text-blue-400"
                                variant="outline"
                                size="sm"
                              >
                                <RiRefreshLine className="h-4 w-4 mr-1.5" />
                                Rerun Test
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTest(test.id);
                                }}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                variant="outline"
                                size="sm"
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
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
              {searchQuery
                ? `No tests match "${searchQuery}"`
                : "Try changing your search criteria or create a new test."}
            </p>
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
                  onClick={() => setSelectedCategory("all")}
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

      {/* API Health Status */}
      {apiHealth && apiHealth.api_status !== "ok" && (
        <div className="fixed bottom-6 left-6 max-w-xs w-72 p-4 bg-white dark:bg-gray-900 border border-yellow-100 dark:border-yellow-900/30 rounded-lg shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="h-5 w-5 text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">API Status Warning</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {apiHealth.api_status === "error" ? "API is currently experiencing issues" : "API performance may be degraded"}
                {apiHealth.db_status === "error" && " (Database connection error)"}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Always-visible API Status Indicator */}
      <div className="fixed bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 text-xs">
        <span 
          className={cn(
            "w-2 h-2 rounded-full", 
            !apiHealth ? "bg-gray-400" : apiHealth.api_status === "ok" ? "bg-green-500" : "bg-red-500"
          )}
        ></span>
        <span className="text-gray-600 dark:text-gray-400">API</span>
      </div>
    </div>
  );
}
