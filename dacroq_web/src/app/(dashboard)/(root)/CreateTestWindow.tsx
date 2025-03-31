// ./CreateTestWindow.tsx
'use client';

import React, { useState } from "react";
import { Dialog, DialogPanel, Select, SelectItem } from "@tremor/react";
import { Button } from "@/components/Button";
import { RiCloseLine, RiAppsFill } from "@remixicon/react";

interface CreateTestWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateTest: (testName: string, chipType: string) => void;
}

const CreateTestWindow: React.FC<CreateTestWindowProps> = ({ isOpen, onClose, onCreateTest }) => {
    const [newTestName, setNewTestName] = useState("");
    const [newChipType, setNewChipType] = useState("3-SAT");

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onCreateTest(newTestName, newChipType);
        // Reset fields after submission
        setNewTestName("");
        setNewChipType("3-SAT");
    };

    return (
        <Dialog open={isOpen} onClose={onClose} static={true} className="relative z-50">
            <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
            <DialogPanel className="relative z-50 max-w-5xl overflow-visible rounded-lg bg-white p-0 shadow-xl dark:bg-gray-800">
                <form onSubmit={handleSubmit} method="POST">
                    <div className="absolute right-0 top-0 pr-3 pt-3">
                        <button
                            type="button"
                            className="rounded-tremor-small text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content p-2"
                            onClick={onClose}
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
                        <div className="flex flex-col justify-between md:w-80 md:border-r md:border-gray-200 dark:md:border-gray-700">
                            <div className="flex-1 grow">
                                <div className="border-t border-gray-200 p-6 dark:border-gray-700 md:border-none">
                                    <div className="flex items-center space-x-3">
                                        <div className="inline-flex shrink-0 items-center justify-center rounded bg-blue-100 p-3 dark:bg-blue-900">
                                            <RiAppsFill className="size-5 text-blue-600 dark:text-blue-300" aria-hidden={true} />
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
                                    <div className="mt-6">
                                        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                            Create a new hardware test to evaluate solver performance.
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                            Tests can be configured for different chip types and will provide detailed performance metrics upon completion.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-gray-200 p-6 dark:border-gray-700">
                                <button
                                    type="button"
                                    className="rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                                    onClick={onClose}
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
                                    <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        1
                                    </div>
                                    <label htmlFor="testName" className="text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                    <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        2
                                    </div>
                                    <label htmlFor="chipType" className="text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                    <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        3
                                    </div>
                                    <label htmlFor="testOptions" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        Test Options
                                    </label>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Configure advanced test parameters (optional)
                                </p>
                                <Select name="testOptions" id="testOptions" className="mt-4 w-full" defaultValue="standard">
                                    <SelectItem value="standard">Standard Test Suite</SelectItem>
                                    <SelectItem value="extended">Extended Test Suite</SelectItem>
                                    <SelectItem value="performance">Performance Benchmark</SelectItem>
                                </Select>
                            </div>
                            <div>
                                <div className="flex items-center space-x-3">
                                    <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        4
                                    </div>
                                    <label htmlFor="priority" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        Test Priority
                                    </label>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Higher priority tests will be processed sooner
                                </p>
                                <Select name="priority" id="priority" className="mt-4 w-full" defaultValue="normal">
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
    );
};

export default CreateTestWindow;
