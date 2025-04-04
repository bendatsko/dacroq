"use client";

import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiSearchLine,
  RiTeamLine,
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiSettings4Line,
  RiDragMove2Line,
  RiRefreshLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

// Existing components
import { Button } from "@/components/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Divider } from "@/components/Divider";
import { DataTable } from "@/components/ui/data-table-support/DataTable";
import CreateTestWindow from "./CreateTestWindow";
import TestDetails from "./TestDetails";

// Firestore
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  doc,
  writeBatch,
  setDoc,
  getDocs,
} from "firebase/firestore";

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
  results?: any;
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

// Add interface for test run results
interface TestRunResult {
  success: boolean;
  runtime?: number;
  [key: string]: any;
}

// Card configuration interfaces
interface CardConfig {
  id: string;
  title: string;
  description?: string;
  type: "test-statistics" | "solver-status";
  visible: boolean;
  order: number;
  metrics?: string[];
}

const defaultCardConfigs: CardConfig[] = [
  {
    id: "test-statistics",
    title: "Test Statistics",
    description: "Overview of test performance and metrics",
    type: "test-statistics",
    visible: true,
    order: 0,
    metrics: ["totalTests", "lastHourTests", "successRate", "avgRuntime"],
  },
];

// Card customization component
function CardCustomizer({
  config,
  onConfigChange,
  onDelete,
  availableMetrics,
}: {
  config: CardConfig;
  onConfigChange: (newConfig: CardConfig) => void;
  onDelete: () => void;
  availableMetrics: string[];
}) {
  return (
    <div className="absolute top-2 right-2 z-10 rounded-md border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <button
          onClick={() => {
            onConfigChange({ ...config, visible: !config.visible });
          }}
          className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          title={config.visible ? "Hide card" : "Show card"}
        >
          {config.visible ? (
            <RiEyeLine className="h-4 w-4" />
          ) : (
            <RiEyeOffLine className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => {
            const dialog = document.createElement("dialog");
            dialog.className =
              "rounded-md shadow-md ring-1 ring-black ring-opacity-5 p-4 bg-white dark:bg-gray-800";
            dialog.innerHTML = `
              <div class="space-y-4">
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Edit Card</h3>
                <form method="dialog" class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Title</label>
                    <input type="text" value="${config.title}" class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
                    <input type="text" value="${
                      config.description || ""
                    }" class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Metrics</label>
                    <select multiple class="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                      ${availableMetrics
                        .map(
                          (metric) => `
                            <option value="${metric}" ${
                            config.metrics?.includes(metric) ? "selected" : ""
                          }>
                              ${metric}
                            </option>
                          `
                        )
                        .join("")}
                    </select>
                  </div>
                  <div class="flex justify-end gap-2 mt-4">
                    <button type="button" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">Cancel</button>
                    <button type="submit" class="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Save</button>
                  </div>
                </form>
              </div>
            `;
            document.body.appendChild(dialog);
            dialog.showModal();

            const form = dialog.querySelector("form");
            if (!form) return;

            form.addEventListener("submit", (e) => {
              e.preventDefault();
              const [titleInput, descInput] =
                form.querySelectorAll("input[type='text']");
              const select = form.querySelector("select") as HTMLSelectElement;
              const selectedMetrics = Array.from(select.selectedOptions).map(
                (opt) => opt.value
              );
              onConfigChange({
                ...config,
                title: (titleInput as HTMLInputElement).value,
                description: (descInput as HTMLInputElement).value,
                metrics: selectedMetrics,
              });
              dialog.close();
              document.body.removeChild(dialog);
            });

            const cancelButton = dialog.querySelector(
              'button[type="button"]'
            ) as HTMLButtonElement;
            cancelButton?.addEventListener("click", () => {
              dialog.close();
              document.body.removeChild(dialog);
            });
          }}
          className="rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Edit card"
        >
          <RiSettings4Line className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-md p-1 text-red-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Delete card"
        >
          <RiCloseLine className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
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
  const [cardConfigs, setCardConfigs] = useState<CardConfig[]>([]);
  const [isEditingCards, setIsEditingCards] = useState(false);

  // Mock chips
  const mockChips: ChipStatus[] = [
    {
      id: "1",
      name: "3-SAT Solver",
      type: "3-SAT",
      status: "online",
      successRate: 97.8,
      avgRuntime: 124,
    },
    {
      id: "2",
      name: "LDPC Solver",
      type: "LDPC",
      status: "online",
      successRate: 94.2,
      avgRuntime: 156,
    },
    {
      id: "3",
      name: "K-SAT Solver",
      type: "K-SAT",
      status: "maintenance",
      successRate: 89.5,
      avgRuntime: 200,
    },
  ];

  // Firestore tests
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

  // Aggregated data
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
      const dateStr = created.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      groups[dateStr] = (groups[dateStr] || 0) + 1;
    });
    const aggregated = Object.keys(groups).map((date) => ({
      date,
      Tests: groups[date],
    }));
    aggregated.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setAggregatedData(aggregated);
  }, [tests]);

  // Test metrics calculation
  useEffect(() => {
    if (tests.length === 0) return;
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let totalRuns = 0;
    let successfulRuns = 0;
    let totalRuntime = 0;
    let recentTestCount = 0;

    tests.forEach((test) => {
      const testDate =
        test.created && test.created.seconds !== undefined
          ? new Date(test.created.seconds * 1000)
          : new Date(test.created);
      if (testDate >= hourAgo) {
        recentTestCount++;
      }

      if (test.status === "completed" && test.results?.results) {
        const testRuns = test.results.results as TestRunResult[];
        testRuns.forEach((run) => {
          totalRuns++;
          if (run.success) successfulRuns++;
          if (run.runtime) totalRuntime += run.runtime;
        });
      }
    });

    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
    const avgRuntime = totalRuns > 0 ? totalRuntime / totalRuns : 0;

    setTestMetrics({
      totalTests: totalRuns,
      successRate,
      avgRuntime,
      lastHourTests: recentTestCount,
    });
  }, [tests]);

  // Load and save card configurations
  useEffect(() => {
    const initializeCardConfigs = async () => {
      const configsRef = collection(db, "cardConfigs");
      const configsSnapshot = await getDocs(configsRef);

      if (configsSnapshot.empty) {
        const docRef = doc(configsRef);
        await setDoc(docRef, defaultCardConfigs[0]);
        setCardConfigs(defaultCardConfigs);
      } else {
        const configs = configsSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as CardConfig[];
        setCardConfigs(configs.sort((a, b) => a.order - b.order));
      }
    };

    initializeCardConfigs();
  }, []);

  useEffect(() => {
    const saveCardConfigs = async () => {
      if (cardConfigs.length === 0) return;

      const batch = writeBatch(db);
      const configsRef = collection(db, "cardConfigs");

      const existingConfigs = await getDocs(configsRef);
      existingConfigs.docs.forEach((doc) => batch.delete(doc.ref));

      cardConfigs.forEach((config) => {
        const docRef = doc(configsRef, config.id);
        batch.set(docRef, config);
      });

      await batch.commit();
    };
    saveCardConfigs();
  }, [cardConfigs]);

  // Reset layout to default
  const handleResetLayout = async () => {
    if (confirm("Are you sure you want to reset the layout to default?")) {
      const batch = writeBatch(db);
      const configsRef = collection(db, "cardConfigs");
      const existingConfigs = await getDocs(configsRef);
      existingConfigs.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      const newDocRef = doc(configsRef);
      batch.set(newDocRef, defaultCardConfigs[0]);
      await batch.commit();
      setCardConfigs(defaultCardConfigs);
    }
  };

  // Handle drag and drop reordering
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(cardConfigs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedConfigs = items.map((item, index) => ({
      ...item,
      order: index,
    }));
    setCardConfigs(updatedConfigs);

    const batch = writeBatch(db);
    const configsRef = collection(db, "cardConfigs");
    updatedConfigs.forEach((config) => {
      const docRef = doc(configsRef, config.id);
      batch.set(docRef, config, { merge: true });
    });
    await batch.commit();
  };

  // Add new card configuration
  const addNewCard = () => {
    const newCard: CardConfig = {
      id: crypto.randomUUID(),
      type: "test-statistics",
      title: "New Card",
      description: "New customizable card",
      metrics: [],
      order: cardConfigs.length,
      visible: true,
    };
    setCardConfigs((prev) => [...prev, newCard]);
  };

  // Available metrics list
  const availableMetrics = [
    "totalTests",
    "lastHourTests",
    "successRate",
    "avgRuntime",
    "onlineChips",
    "totalChips",
    "failureRate",
    "queuedTests",
    "completedTests",
  ];

  // Create test handler
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
      setIsOpen(false);
    } catch (err) {
      console.error("Error creating new test:", err);
    }
  };

  // View test details handler
  const handleViewResults = (test: TestRun) => {
    setScrollPosition(window.scrollY);
    setSelectedTest(test);
    window.scrollTo(0, 0);
  };
  const handleBackToDashboard = () => {
    setSelectedTest(null);
    setTimeout(() => window.scrollTo(0, scrollPosition), 0);
  };

  // Table columns definition with our modifications
  const columns = [
    {
      accessorKey: "name",
      header: "Test Name",
      cell: ({ row }: any) => {
        const test = row.original;
        const name = test.name || "";
        return (
          <span className="font-medium">
            {name.length > 25 ? `${name.substring(0, 25)}...` : name}
          </span>
        );
      },
    },
    {
      id: "creator",
      header: "Creator",
      cell: ({ row }: any) => {
        const creator = row.original.createdBy;
        return (
          <div className="relative flex items-center">
            <div className="group/avatar">
              <img
                src={
                  creator?.photoURL ||
                  creator?.avatar ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    creator?.name || "User"
                  )}&backgroundColor=random`
                }
                alt="Creator Avatar"
                className="h-8 w-8 rounded-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    creator?.name || "User"
                  )}&backgroundColor=random`;
                }}
              />
              <div className="absolute left-0 top-full mt-1 hidden w-48 rounded-md bg-gray-700 p-2 text-xs text-white group-hover/avatar:block z-50">
                <p className="font-medium">
                  {creator?.displayName || creator?.name || "Unknown"}
                </p>
                <p>{creator?.email || "No email"}</p>
                <p className="text-gray-300">{creator?.role || "No role"}</p>
              </div>
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
        const displayStatus =
          status.charAt(0).toUpperCase() + status.slice(1);
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
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => (
        <div className="flex justify-end">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleViewResults(row.original);
            }}
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="View test details"
          >
            <RiEyeLine className="mr-1 h-4 w-4" />
            Details
          </Button>
        </div>
      ),
    },
  ];

  // TestTable subcomponent (complete with search, filters, and admin logic)
  function TestTable({
    tests,
    columns,
    handleViewResults,
    isAdmin,
  }: {
    tests: TestRun[];
    columns: any[];
    handleViewResults: (test: TestRun) => void;
    isAdmin: boolean;
  }) {
    const [showOnlyMyTests, setShowOnlyMyTests] = useState(false);
    const [filteredTests, setFilteredTests] = useState(tests);
    const [selectedTests, setSelectedTests] = useState<{ [key: string]: boolean }>(
      {}
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);

    const currentUser = useMemo(() => {
      try {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }, []);

    useEffect(() => {
      let updated = [...tests];
      if (showOnlyMyTests && currentUser) {
        updated = updated.filter(
          (test) => test.createdBy?.uid === currentUser.uid
        );
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        updated = updated.filter((test) => {
          if (test.name?.toLowerCase().includes(query)) return true;
          if (test.chipType?.toLowerCase().includes(query)) return true;
          if (test.status?.toLowerCase().includes(query)) return true;
          if (test.createdBy) {
            if (test.createdBy.name?.toLowerCase().includes(query)) return true;
            if (test.createdBy.displayName?.toLowerCase().includes(query)) return true;
            if (test.createdBy.email?.toLowerCase().includes(query)) return true;
          }
          return false;
        });
      }
      setFilteredTests(updated);
      setSelectedTests({});
    }, [showOnlyMyTests, searchQuery, tests, currentUser]);

    const handleBulkDelete = async () => {
      const selectedIds = Object.keys(selectedTests).filter(
        (id) => selectedTests[id]
      );
      if (!selectedIds.length) return;
      if (confirm(`Are you sure you want to delete ${selectedIds.length} tests?`)) {
        const batch = writeBatch(db);
        selectedIds.forEach((id) => {
          batch.delete(doc(db, "tests", id));
        });
        await batch.commit();
        setSelectedTests({});
      }
    };

    const handleResetFilters = () => {
      setSearchQuery("");
      setShowOnlyMyTests(false);
      setSelectedTests({});
    };

    const formatDate = (dateValue: any) => {
      if (!dateValue) return "Pending...";
      try {
        let dateObj;
        if (typeof dateValue === "string") {
          dateObj = new Date(dateValue);
        } else if (dateValue?.toDate) {
          dateObj = dateValue.toDate();
        } else if (dateValue?.seconds !== undefined) {
          dateObj = new Date(dateValue.seconds * 1000);
        } else {
          dateObj = new Date(dateValue);
        }
        if (isNaN(dateObj.getTime())) return "Invalid date";
        const now = new Date();
        const diffInDays = Math.floor(
          (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffInDays < 7
          ? formatDistanceToNow(dateObj, { addSuffix: true })
          : format(dateObj, "MMM d, yyyy");
      } catch {
        return "Error";
      }
    };

    const enhancedColumns = useMemo(() => {
      // Add selection column for all users
      const selectionColumn = {
        id: "select",
        header: ({ table }: any) => {
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
                    // Admins can select any test, users can only select their own
                    if (test.createdBy?.uid === currentUser?.uid) {
                      newSelected[test.id] = true;
                    }
                  });
                }
                setSelectedTests(newSelected);
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
        size: 40,
        cell: ({ row }: any) => {
          const test = row.original;
          const canSelect = test.createdBy?.uid === currentUser?.uid;
          return (
            <input
              type="checkbox"
              checked={!!selectedTests[test.id]}
              onChange={(e) => {
                if (!canSelect) return;
                setSelectedTests((prev) => ({
                  ...prev,
                  [test.id]: e.target.checked,
                }));
              }}
              disabled={!canSelect}
              className={cn(
                "h-4 w-4 rounded border-gray-300 focus:ring-blue-500",
                canSelect ? "text-blue-600 cursor-pointer" : "text-gray-300 cursor-not-allowed"
              )}
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
      };

      // Return columns with selection column always visible
      return [selectionColumn, ...columns];
    }, [columns, selectedTests, filteredTests, currentUser]);

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-50">
            Test Results
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and manage your quantum solver test results
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="w-full rounded-md border border-gray-200 bg-white/75 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800/75 dark:text-white dark:placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <RiCloseLine className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                variant={showOnlyMyTests ? "secondary" : "ghost"}
                className="flex w-[120px] items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <RiTeamLine className="h-4 w-4" />
                Filters
              </Button>
              {filterMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-md bg-white p-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800">
                  <button
                    onClick={() => {
                      setShowOnlyMyTests(!showOnlyMyTests);
                      setFilterMenuOpen(false);
                    }}
                    className={`w-full rounded-md px-4 py-2 text-left text-sm ${
                      showOnlyMyTests
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    {showOnlyMyTests ? "Show All Tests" : "Show My Tests Only"}
                  </button>
                  <button
                    onClick={() => {
                      handleResetFilters();
                      setFilterMenuOpen(false);
                    }}
                    className="w-full rounded-md px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Card className="border-0 rounded-md shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-visible">
              <DataTable
                data={filteredTests}
                columns={enhancedColumns}
                rowClassName="group hover:bg-gray-50/75 dark:hover:bg-gray-800/50 cursor-pointer"
                onRowClick={({ original }) => handleViewResults(original)}
              />
            </div>
            {filteredTests.length === 0 && (
              <div className="px-4 py-12 text-center sm:px-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No tests found matching your criteria
                </p>
                {(searchQuery || showOnlyMyTests) && (
                  <button
                    onClick={handleResetFilters}
                    className="mt-2 text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Hardware Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Real-time monitoring of hardware solvers with performance metrics
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 text-base sm:text-sm"
          >
            New Hardware Benchmark Test
            <RiAddLine className="h-5 w-5 shrink-0" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <Divider className="mb-6" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-50">
              Statistics
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsEditingCards(!isEditingCards)}
                  variant="ghost"
                  className="text-sm text-gray-600 dark:text-gray-400"
                  title={isEditingCards ? "Done customizing" : "Customize cards"}
                >
                  <RiSettings4Line className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setIsCardsExpanded(!isCardsExpanded)}
                  variant="ghost"
                  className="text-sm text-gray-600 dark:text-gray-400"
                  title={isCardsExpanded ? "Collapse stats" : "Expand stats"}
                >
                  {isCardsExpanded ? (
                    <RiArrowUpLine className="h-4 w-4" />
                  ) : (
                    <RiArrowDownLine className="h-4 w-4" />
                  )}
                </Button>
                {isEditingCards && (
                  <Button
                    onClick={handleResetLayout}
                    variant="ghost"
                    className="text-sm text-gray-600 dark:text-gray-400"
                    title="Reset layout"
                  >
                    <RiRefreshLine className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          id="dashboard-stats"
          className={cn(
            "transition-all duration-300 ease-in-out",
            isCardsExpanded 
              ? "max-h-[1000px] opacity-100" 
              : "max-h-0 overflow-hidden opacity-0 mb-0"
          )}
          role="region"
          aria-label="Dashboard statistics"
        >
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="cards" direction="horizontal">
              {(provided) => (
                <dl
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2"
                >
                  {cardConfigs.map((config, index) => (
                    <Draggable
                      key={config.id}
                      draggableId={config.id}
                      index={index}
                      isDragDisabled={!isEditingCards}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn("relative", snapshot.isDragging ? "opacity-50" : "")}
                        >
                          {config.visible && (
                            <Card className="relative rounded-md shadow-sm">
                              {isEditingCards && (
                                <>
                                  <div
                                    {...provided.dragHandleProps}
                                    className="absolute top-2 left-2 cursor-move text-gray-400"
                                  >
                                    <RiDragMove2Line className="h-4 w-4" />
                                  </div>
                                  <CardCustomizer
                                    config={config}
                                    onConfigChange={(newConfig) => {
                                      const newConfigs = cardConfigs.map((c) =>
                                        c.id === config.id ? newConfig : c
                                      );
                                      setCardConfigs(newConfigs);
                                    }}
                                    onDelete={() => {
                                      setCardConfigs((prev) =>
                                        prev.filter((c) => c.id !== config.id)
                                      );
                                    }}
                                    availableMetrics={availableMetrics}
                                  />
                                </>
                              )}
                              <CardContent className="p-4">
                                <div className="grid grid-cols-2 gap-4">
                                  {config.metrics?.map((metric) => (
                                    <div
                                      key={metric}
                                      className="flex flex-col items-center justify-center rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50"
                                    >
                                      <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                        {metric === "totalTests" && testMetrics.totalTests}
                                        {metric === "lastHourTests" && testMetrics.lastHourTests}
                                        {metric === "successRate" &&
                                          `${testMetrics.successRate.toFixed(1)}%`}
                                        {metric === "avgRuntime" &&
                                          `${testMetrics.avgRuntime.toFixed(0)}ms`}
                                        {metric === "onlineChips" &&
                                          mockChips.filter((c) => c.status === "online").length}
                                        {metric === "totalChips" && mockChips.length}
                                      </span>
                                      <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {metric === "totalTests" && "Total Tests"}
                                        {metric === "lastHourTests" && "Last Hour"}
                                        {metric === "successRate" && "Success Rate"}
                                        {metric === "avgRuntime" && "Avg Runtime"}
                                        {metric === "onlineChips" && "Online Chips"}
                                        {metric === "totalChips" && "Total Chips"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {isEditingCards && (
                    <button
                      onClick={addNewCard}
                      className="flex items-center justify-center rounded-md border-2 border-dashed border-gray-300 p-6 text-sm text-gray-600 transition-colors hover:border-gray-400 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600"
                    >
                      <RiAddLine className="h-4 w-4" />
                      <span>Add New Card</span>
                    </button>
                  )}
                </dl>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <TestTable
          tests={tests}
          columns={columns}
          handleViewResults={handleViewResults}
          isAdmin={isAdmin}
        />
      </div>

      <CreateTestWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onTestComplete={(testId) => {
          const test = tests.find((t) => t.id === testId);
          if (test) setSelectedTest(test);
        }}
        onCreateTest={handleCreateTest}
      />
    </main>
  );
}
