// ./EnhancedTestTable.tsx
'use client';

import React, { useEffect, useState, useMemo } from "react";
import { RiUser3Line, RiTeamLine, RiDeleteBin5Line, RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/Button";
import { DataTable } from "@/components/ui/data-table-support/DataTable";
import { writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface EnhancedTestTableProps {
    tests: any[];
    columns: any[];
    handleViewResults: (test: any) => void;
    isAdmin: boolean;
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
            const selectedIds = Object.keys(selectedTests);
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

    const enhancedColumns = useMemo(() => {
        const selectionColumn = {
            id: "select",
            header: "Select",
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
                ) : null;
            },
        };
        return [selectionColumn, ...columns];
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
                            <path
                                fillRule="evenodd"
                                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                clipRule="evenodd"
                            />
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
                    <span className="text-red-600 dark:text-red-400 font-medium">
            Admin Mode: You can delete any test
          </span>
                </div>
            )}
            {/* Search results stats and actions */}
            <div className="flex flex-wrap justify-between items-center">
                <div className="text-sm text-gray-500 mb-2 md:mb-0">
                    {filteredTests.length} {filteredTests.length === 1 ? "test" : "tests"} found
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
                <DataTable data={filteredTests} columns={enhancedColumns} />
            ) : (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <p className="text-gray-500 dark:text-gray-400">
                        No tests found matching your criteria.
                    </p>
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
};

export default EnhancedTestTable;
