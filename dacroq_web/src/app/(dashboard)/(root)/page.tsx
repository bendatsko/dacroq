'use client';

import { RiAddLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Existing components & icons
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryBar } from "@/components/CategoryBar";
import { Divider } from "@/components/Divider";
import { ProgressCircle } from "@/components/ProgressCircle";
import CreateTestWindow from "./CreateTestWindow";
import EnhancedTestTable from "./EnhancedTestTable";
import TestDetails from "./TestDetails";

// Tremor UI components

// Firestore
import { db } from "@/lib/firebase";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";

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

// Mock data for charts and chips
const resourceData = [
  { date: "Aug 01", "GPU cluster": 7100, "Workspace usage": 4434 },
  { date: "Aug 15", "GPU cluster": 7124, "Workspace usage": 4903 },
  { date: "Sep 01", "GPU cluster": 12347, "Workspace usage": 4839 },
  { date: "Sep 15", "GPU cluster": 12012, "Workspace usage": 10412 },
  { date: "Sep 26", "GPU cluster": 17349, "Workspace usage": 10943 },
];

const performanceData = [
  { month: "Apr", success: 91.2, failures: 8.8 },
  { month: "May", success: 92.8, failures: 7.2 },
  { month: "Jun", success: 93.7, failures: 6.3 },
  { month: "Jul", success: 92.5, failures: 7.5 },
  { month: "Aug", success: 94.3, failures: 5.7 },
  { month: "Sep", success: 95.8, failures: 4.2 },
];

const utilizationData = [
  { name: "3-SAT", value: 42 },
  { name: "LDPC", value: 38 },
  { name: "K-SAT", value: 20 },
];

const runtimeData = [
  { date: "Aug 01", avg: 124, min: 98, max: 156 },
  { date: "Aug 15", avg: 118, min: 92, max: 145 },
  { date: "Sep 01", avg: 115, min: 87, max: 142 },
  { date: "Sep 15", avg: 110, min: 85, max: 138 },
  { date: "Sep 26", avg: 105, min: 82, max: 132 },
];

const usageSummary = [
  { name: "Actual", value: "$8,110.15" },
  { name: "Forecasted", value: "$10,230.25" },
  { name: "Last invoice", value: "Sept 20, 2024" },
];

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

  const mockChips: ChipStatus[] = [
    { id: "1", name: "3-SAT Solver", type: "3-SAT", status: "online", successRate: 97.8, avgRuntime: 124 },
    { id: "2", name: "LDPC Solver", type: "LDPC", status: "online", successRate: 94.2, avgRuntime: 156 },
    { id: "3", name: "K-SAT Solver", type: "K-SAT", status: "maintenance", successRate: 89.5, avgRuntime: 200 },
  ];

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

  useEffect(() => {
    if (tests.length === 0) {
      setAggregatedData([]);
      return;
    }
    const groups: { [key: string]: number } = {};
    tests.forEach((test) => {
      const created = test.created?.seconds ? new Date(test.created.seconds * 1000) : new Date(test.created);
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
        created: serverTimestamp(),
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

  // Define the columns for the DataTable
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
                `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.name || 'User')}`
              }
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
          <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium 
            ${status === "completed" ? "bg-green-500/10 text-green-500" :
              status.includes("running") ? "bg-blue-500/10 text-blue-500" :
                status === "failed" ? "bg-red-500/10 text-red-500" :
                  "bg-gray-500/10 text-gray-500"}`}>
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
        const date = created?.seconds ? new Date(created.seconds * 1000) : new Date(created);
        return date.toLocaleString();
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Button isLoading loadingText="Loading..." variant="ghost" />
      </div>
    );
  }

  if (selectedTest) {
    return (
      <TestDetails
        test={selectedTest}
        onBack={handleBackToDashboard}
        performanceData={performanceData}
        utilizationData={utilizationData}
        runtimeData={runtimeData}
        aggregatedData={aggregatedData}
        usageSummary={usageSummary}
        resourceData={resourceData}
      />
    );
  }

  // Calculate metrics for dashboard cards
  const onlineChips = mockChips.filter((c) => c.status === "online").length;
  const totalChips = mockChips.length;
  const avgChipSuccess =
    totalChips > 0
      ? mockChips.reduce((sum, chip) => sum + (chip.successRate || 0), 0) / totalChips
      : 0;

  const runningTests = tests.filter(
    (t) => t.status === "running" || t.status.startsWith("running_") || t.status === "queued"
  ).length;
  const completedTests = tests.filter((t) => t.status === "completed").length;
  const failedTests = tests.filter((t) => t.status === "failed" || t.status === "error").length;

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
          <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2 text-base sm:text-sm">
            Create Test
            <RiAddLine className="-mr-0.5 size-5 shrink-0" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <Divider />
      {/* Chip and test status cards */}
      <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">Chip Status</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">
            {onlineChips}/{totalChips}
          </dd>
          <CategoryBar
            values={[onlineChips, totalChips - onlineChips]}
            className="mt-6"
            colors={["blue", "lightGray"]}
            showLabels={false}
          />
          <ul role="list" className="mt-4 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            {mockChips.map((chip) => (
              <li key={chip.id}>
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2.5 shrink-0 rounded-sm ${chip.status === "online"
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
        <Card>
          <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">Success Rate</dt>
          <div className="mt-4 flex flex-nowrap items-center justify-between gap-y-4">
            <dd className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-blue-500 dark:bg-blue-500" aria-hidden="true" />
                  <span className="text-sm">Successful</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {avgChipSuccess.toFixed(1)}%
                </span>
              </div>
            </dd>
            <ProgressCircle value={avgChipSuccess} radius={45} strokeWidth={7} />
          </div>
        </Card>
        <Card>
          <dt className="text-sm font-medium text-gray-900 dark:text-gray-50">Test Status</dt>
          <div className="mt-4 flex items-center gap-x-8 gap-y-4">
            <dd className="space-y-3 whitespace-nowrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-blue-500 dark:bg-blue-500" aria-hidden="true" />
                  <span className="text-sm">Active</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {runningTests}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-green-500 dark:bg-green-500" aria-hidden="true" />
                  <span className="text-sm">Completed</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900 dark:text-gray-50">
                  {completedTests}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-red-500 dark:bg-red-500" aria-hidden="true" />
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
      <h2 className="mb-4 text-lg font-medium">Recent Tests</h2>
      <EnhancedTestTable tests={tests} columns={columns} handleViewResults={handleViewResults} isAdmin={isAdmin} />
      {/* Integrated Create Test Modal */}
      <CreateTestWindow isOpen={isOpen} onClose={() => setIsOpen(false)} onCreateTest={handleCreateTest} />
    </main>
  );
}
