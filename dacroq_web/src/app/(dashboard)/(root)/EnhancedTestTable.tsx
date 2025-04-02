'use client';

import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table-support/DataTable";
import { db } from "@/lib/firebase";
import {
  RiCloseLine,
  RiDeleteBin5Line,
  RiEyeLine,
  RiSearchLine,
  RiTeamLine,
  RiUser3Line
} from "@remixicon/react";
import { format, formatDistanceToNow } from 'date-fns';
import { doc, writeBatch } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { TestRun } from "@/types/test";

interface EnhancedTestTableProps {
    tests: TestRun[];
    columns: any[];
    handleViewResults: (test: TestRun) => void;
    isAdmin: boolean;
}

interface DataTableProps<T> {
    data: T[];
    columns: any[];
    rowClassName?: string;
    onRowClick?: (row: { original: T }) => void;
}

const EnhancedTestTable: React.FC<EnhancedTestTableProps> = ({
                                                                 tests,
                                                                 columns,
                                                                 handleViewResults,
                                                                 isAdmin,
                                                             }) => {
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
        // Only reset selections when filter changes
        setSelectedTests({});
    }, [showOnlyMyTests, searchQuery, tests, currentUser]);

    const handleBulkDelete = async () => {
        try {
            const selectedIds = Object.keys(selectedTests).filter(id => selectedTests[id]);
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
        if (!dateValue) return "";

        let date: Date;
        try {
            if (dateValue?.seconds) {
                date = new Date(dateValue.seconds * 1000);
            } else {
                date = new Date(dateValue);
            }

            // Check if the date is valid
            if (isNaN(date.getTime())) {
                return "Invalid date";
            }

            // Check if date is today or within the last week
            const now = new Date();
            const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

            if (diffInDays < 1) {
                return formatDistanceToNow(date, { addSuffix: true });
            } else if (diffInDays < 7) {
                return formatDistanceToNow(date, { addSuffix: true });
            } else {
                return format(date, "MMM d, yyyy");
            }
        } catch (error) {
            console.error("Error formatting date:", error);
            return "Invalid date";
        }
    };

    const truncateText = (text: string, maxLength: number = 20) => {
        if (!text || text.length <= maxLength) return text;
        return `${text.substring(0, maxLength)}...`;
    };

    const enhancedColumns = useMemo(() => {
        // Override cell renderers for better presentation
        const modifiedColumns = columns.map(column => {
            // Skip the "details" column as we'll handle it separately
            if (column.id === "details") return null;

            // Create a copy of the column to modify
            const newColumn = { ...column };

            // Customize name column
            if (column.accessorKey === "name") {
                newColumn.cell = ({ row }: any) => {
                    const test = row.original;
                    const name = test.name || "";
                    return (
                      <div className="flex items-center">
                          <span className="font-medium">{truncateText(name, 25)}</span>
                      </div>
                    );
                };
            }

            // Customize date column
            if (column.accessorKey === "created") {
                newColumn.cell = ({ row }: any) => {
                    const created = row.original.created;
                    return <span className="text-gray-500 text-sm">{formatDate(created)}</span>;
                };
            }

            return newColumn;
        }).filter(Boolean);

        // Add the selection column
        const selectionColumn = {
            id: "select",
            header: ({ table }: any) => {
                const canSelectAll = adminMode || currentUser;
                if (!canSelectAll) return null;
                
                const allVisibleSelected = filteredTests.length > 0 && 
                    filteredTests.every(test => selectedTests[test.id]);
                
                return (
                    <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => {
                            const newSelected: { [key: string]: boolean } = {};
                            if (e.target.checked) {
                                filteredTests.forEach(test => {
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
                ) : <span className="w-4"></span>;
            },
        };

        // Add actions column
        const actionsColumn = {
            id: "actions",
            header: "",
            size: 70,
            cell: ({ row }: any) => {
                const test = row.original;
                return (
                    <div className="flex items-center justify-end">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleViewResults(test);
                            }}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="View results"
                        >
                            <RiEyeLine className="h-4 w-4 text-blue-500" />
                        </button>
                    </div>
                );
            },
        };

        return [selectionColumn, ...modifiedColumns, actionsColumn];
    }, [columns, selectedTests, currentUser, adminMode, handleViewResults]);

    const selectedCount = Object.keys(selectedTests).filter(id => selectedTests[id]).length;

    return (
      <div className="space-y-6">
          {/* Search and Filter Section */}
          <Card className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Search bar */}
                  <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <RiSearchLine className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search tests..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                      />
                      {searchQuery && (
                        <button
                          className="absolute inset-y-0 right-0 flex items-center pr-3"
                          onClick={() => setSearchQuery("")}
                        >
                            <RiCloseLine className="h-4 w-4 text-gray-400 hover:text-gray-500" />
                        </button>
                      )}
                  </div>

                  {/* Filter buttons */}
                  <div className="flex items-center space-x-2">
                      <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                          <button
                            onClick={() => setShowOnlyMyTests(true)}
                            className={`px-3 py-1.5 text-xs flex items-center gap-1 ${
                              showOnlyMyTests
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                : "bg-white text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                              <RiUser3Line className="h-3.5 w-3.5" />
                              <span>My Tests</span>
                          </button>
                          <button
                            onClick={() => setShowOnlyMyTests(false)}
                            className={`px-3 py-1.5 text-xs flex items-center gap-1 ${
                              !showOnlyMyTests
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                : "bg-white text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                              <RiTeamLine className="h-3.5 w-3.5" />
                              <span>All Tests</span>
                          </button>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={handleToggleAdminMode}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs border ${
                            adminMode
                              ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                              : "bg-white text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                          }`}
                        >
                            <RiDeleteBin5Line className="h-3.5 w-3.5" />
                            {adminMode ? "Cancel Deletion" : "Delete Tests"}
                        </button>
                      )}
                  </div>
              </div>

              {/* Selected items and filters info */}
              {(selectedCount > 0 || (searchQuery || showOnlyMyTests)) && (
                <div className="flex flex-wrap justify-between items-center mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500">
                        <span className="mr-2">{filteredTests.length} {filteredTests.length === 1 ? "test" : "tests"} found</span>
                        {(searchQuery || showOnlyMyTests) && (
                          <button
                            className="text-blue-500 hover:text-blue-700 hover:underline text-xs"
                            onClick={handleResetFilters}
                          >
                              Clear filters
                          </button>
                        )}
                    </div>

                    {selectedCount > 0 && (
                      <div className="flex items-center">
                <span className="text-xs mr-2">
                  <span className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 font-medium">
                    {selectedCount}
                  </span>
                  <span className="ml-1 text-gray-600 dark:text-gray-400">selected</span>
                </span>
                          <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                              <RiDeleteBin5Line className="h-3.5 w-3.5" />
                              Delete
                          </button>
                      </div>
                    )}
                </div>
              )}
          </Card>

          {/* Admin mode indicator */}
          {adminMode && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-center text-sm">
                <RiDeleteBin5Line className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-600 dark:text-red-400">
                    Select tests to delete. You can delete any test in this mode.
                </span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-lg border  dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              {filteredTests.length > 0 ? (
                <DataTable<TestRun>
                  data={filteredTests}
                  columns={enhancedColumns}
                  onRowClick={(row) => handleViewResults(row.original)}
                  rowClassName="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                />
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No tests found matching your criteria.
                    </p>
                    <button
                      className="mt-3 text-blue-500 hover:text-blue-700 hover:underline text-sm"
                      onClick={handleResetFilters}
                    >
                        Clear filters
                    </button>
                </div>
              )}
          </div>
      </div>
    );
};

export default EnhancedTestTable;