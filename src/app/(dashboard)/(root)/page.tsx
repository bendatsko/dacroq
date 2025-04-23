"use client";

import { RiAddLine, RiBookOpenLine, RiDatabase2Line, RiEyeLine, RiArrowRightSLine, RiFilterLine, RiDeleteBinLine, RiCheckboxBlankLine, RiCheckboxFill, RiArrowDownSLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// Tremor Table Components
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@tremor/react";

// Components
import { Button } from "@/components/Button";
import { Card, CardContent } from "@/components/ui/card";
import CreateTestWindow from "./CreateTestWindow";
import TestDetails from "./TestDetails";
import TestSelectionModal from './TestSelectionModal';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// Firestore
import { db } from "@/lib/firebase";
import { addDoc, collection, onSnapshot, deleteDoc, doc, query, orderBy, limit, Timestamp } from "firebase/firestore";

// Types
import { TestRun } from "@/types/test";

// Define type for SAT Problem
interface SATProblem {
  id: string;
  problemId: string;
  source: string;
  variables: number;
  clauses: number;
  solved: boolean;
  timeSeconds: number | string;
  timeMicroseconds: number | null;
  energyJoules: number | null;
  solver: string;
  timestamp: Timestamp;
}

export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<TestRun[]>([]);
  const [satProblems, setSatProblems] = useState<SATProblem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSat, setIsLoadingSat] = useState(true);
  const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterChipType, setFilterChipType] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Load tests from Firestore and validate the user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/login");
      return;
    }
    try {
      const user = JSON.parse(storedUser);
      setIsAdmin(user.role === "admin");
      const unsubscribe = onSnapshot(
        collection(db, "tests"),
        (snapshot) => {
          const testsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as TestRun[];
          // Sort tests by creation date, descending
          testsData.sort((a, b) => {
            const dateA = a.created && a.created.seconds !== undefined
              ? a.created.seconds * 1000
              : new Date(a.created).getTime();
            const dateB = b.created && b.created.seconds !== undefined
              ? b.created.seconds * 1000
              : new Date(b.created).getTime();
            return dateB - dateA;
          });
          setTests(testsData);
          setIsLoading(false);
        },
        (err) => {
          console.error("Error fetching tests:", err);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error("Error parsing user data:", err);
      router.push("/login");
    }
  }, [router]);
  
  // Load SAT problems from Firestore
  useEffect(() => {
    setIsLoadingSat(true);
    // Create a query to get the 10 most recent SAT problems
    const satProblemsQuery = query(
      collection(db, "sat_problems"),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    
    const unsubscribe = onSnapshot(
      satProblemsQuery,
      (snapshot) => {
        const problemsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SATProblem[];
        setSatProblems(problemsData);
        setIsLoadingSat(false);
      },
      (err) => {
        console.error("Error fetching SAT problems:", err);
        setIsLoadingSat(false);
      }
    );
    
    return () => unsubscribe();
  }, []);

  // Create test handler
  const handleCreateTest = async (testName: string, chipType: string) => {
    try {
      const storedUserStr = localStorage.getItem("user");
      const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
      if (!storedUser) {
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
          email: storedUser.email,
          role: storedUser.role || "user",
          photoURL: storedUser.photoURL,
        },
      };
      await addDoc(collection(db, "tests"), newTest);
      setIsTestModalOpen(false);
    } catch (err) {
      console.error("Error creating test:", err);
      setError("Failed to create test");
    }
  };

  // Filter tests based on selected criteria
  const filteredTests = tests.filter(test => {
    if (filterStatus && test.status !== filterStatus) return false;
    if (filterChipType && test.chipType !== filterChipType) return false;
    return true;
  });

  // Handle bulk selection
  const toggleSelectAll = () => {
    if (selectedTests.length === filteredTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(filteredTests.map(test => test.id));
    }
  };

  const toggleTestSelection = (testId: string) => {
    if (selectedTests.includes(testId)) {
      setSelectedTests(selectedTests.filter(id => id !== testId));
    } else {
      setSelectedTests([...selectedTests, testId]);
    }
  };

  // Handle bulk delete (admin only)
  const handleBulkDelete = async () => {
    if (!isAdmin || !window.confirm('Are you sure you want to delete all selected tests?')) return;
    
    try {
      // Delete each selected test
      const deletePromises = selectedTests.map(testId => 
        deleteDoc(doc(db, "tests", testId))
      );
      
      await Promise.all(deletePromises);
      setSelectedTests([]);
      setError(null);
    } catch (err) {
      console.error('Error deleting tests:', err);
      setError('Failed to delete tests');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Button variant="ghost" disabled>
          Loading...
        </Button>
      </div>
    );
  }

  if (selectedTest) {
    return <TestDetails test={selectedTest} onBack={() => setSelectedTest(null)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className={`w-64 border-r border-gray-200 dark:border-gray-800 ${showFilters ? 'block' : 'hidden'}`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <RiArrowRightSLine className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <Select
                value={filterStatus || 'all'}
                onValueChange={(value) => setFilterStatus(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  {filterStatus || 'All Statuses'}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chip Type</label>
              <Select
                value={filterChipType || 'all'}
                onValueChange={(value) => setFilterChipType(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  {filterChipType || 'All Types'}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="3sat">3-SAT</SelectItem>
                  <SelectItem value="ldpc">LDPC</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl mx-auto p-4 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-gray-200 pb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              Dashboard
            </h1>
            <div className="flex items-center gap-2">
            
              <Button onClick={() => setIsTestModalOpen(true)} className="flex items-center gap-2">
                <RiAddLine className="h-5 w-5" />
                New Test
              </Button>
              {!showFilters && (
                <Button
                  variant="ghost"
                  onClick={() => setShowFilters(true)}
                  className="flex items-center gap-2"
                >
                  <RiFilterLine className="h-4 w-4" />
                  Filters
                </Button>
              )}
            </div>
          </div>

          {/* Test Results Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                Test Results
              </h2>
              <div className="flex items-center gap-2">
                {isAdmin && selectedTests.length > 0 && (
                  <Button
                    variant="destructive"
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2"
                  >
                    <RiDeleteBinLine className="h-4 w-4" />
                    Delete Selected
                  </Button>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table className="w-full">
                  <TableHead>
                    <TableRow className="border-b border-tremor-border dark:border-dark-tremor-border">
                      <TableHeaderCell className="w-[5%]">
                        <button
                          onClick={toggleSelectAll}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {selectedTests.length === filteredTests.length ? (
                            <RiCheckboxFill className="h-5 w-5" />
                          ) : (
                            <RiCheckboxBlankLine className="h-5 w-5" />
                          )}
                        </button>
                      </TableHeaderCell>
                      <TableHeaderCell className="w-[30%] text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        Test Name
                      </TableHeaderCell>
                      <TableHeaderCell className="w-[15%] text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        Creator
                      </TableHeaderCell>
                      <TableHeaderCell className="w-[20%] text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        Chip Type
                      </TableHeaderCell>
                      <TableHeaderCell className="w-[15%] text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        Status
                      </TableHeaderCell>
                      <TableHeaderCell className="w-[20%] text-right text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        Actions
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTests.map((test) => (
                      <TableRow
                        key={test.id}
                        className="group border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <TableCell className="w-[5%]">
                          <button
                            onClick={() => toggleTestSelection(test.id)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            {selectedTests.includes(test.id) ? (
                              <RiCheckboxFill className="h-5 w-5" />
                            ) : (
                              <RiCheckboxBlankLine className="h-5 w-5" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-0 font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                          <div className="flex items-center">
                            <span className="truncate" title={test.name}>
                              {test.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-0">
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                test.createdBy?.photoURL ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${test.createdBy?.name || "User"}`
                              }
                              alt="Creator Avatar"
                              className="h-8 w-8 rounded-full flex-shrink-0"
                            />
                            <span className="truncate text-sm" title={test.createdBy?.name}>
                              {test.createdBy?.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-0">
                          <div className="flex items-center">
                            <span className="truncate" title={test.chipType}>
                              {test.chipType}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap",
                              test.status === "completed"
                                ? "bg-green-500/10 text-green-500"
                                : test.status === "running"
                                ? "bg-blue-500/10 text-blue-500"
                                : test.status === "failed"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-gray-500/10 text-gray-500"
                            )}
                          >
                            {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => setSelectedTest(test)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                          >
                            Details
                            <RiArrowRightSLine className="h-4 w-4 flex-shrink-0" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <TestSelectionModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />

      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  );
}
