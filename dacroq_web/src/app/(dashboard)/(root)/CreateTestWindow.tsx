// ./CreateTestWindow.tsx
'use client';

import { RiAppsFill, RiCloseLine, RiDeleteBinLine, RiFileLine } from "@remixicon/react";
import { Dialog, DialogPanel, Select, SelectItem } from "@tremor/react";
import React, { useEffect, useState } from "react";
import { useDropzone } from 'react-dropzone';

// Define custom CSS to fix the double arrow issue
import './test-window.css';

interface CreateTestWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateTest: (testName: string, chipType: string) => void;
}

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

const CreateTestWindow: React.FC<CreateTestWindowProps> = ({ isOpen, onClose, onCreateTest }) => {
    const [newTestName, setNewTestName] = useState("");
    const [newChipType, setNewChipType] = useState("3-SAT");
    const [testSource, setTestSource] = useState("cached"); // "cached" or "upload"
    const [testBatch, setTestBatch] = useState("standard");
    const [testCount, setTestCount] = useState("10");
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Generate a default test name with timestamp when modal opens
    useEffect(() => {
        if (isOpen) {
            const timestamp = new Date().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            });
            setNewTestName(`Untitled Test - ${timestamp}`);
            setError(null);
        }
    }, [isOpen]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => setFiles(acceptedFiles),
        accept: {
            'application/zip': ['.zip'],
            'text/plain': ['.cnf']
        }
    });

    // Function to submit the test request to the API and handle response
    const submitToApi = async (testName, chipType, testCount, testBatch, priority) => {
        try {
            // Get user data from localStorage
            const storedUserStr = localStorage.getItem("user");
            if (!storedUserStr) {
                throw new Error("User information not found. Please log in again.");
            }

            const storedUser = JSON.parse(storedUserStr);

            // Prepare data for API with exact structure needed
            const testRequest = {
                testName: testName,
                chipType: chipType,
                priority: priority,
                numTests: parseInt(testCount),
                email: storedUser.email || "",
                testOptions: testBatch,
                createdBy: {
                    uid: storedUser.uid || "unknown-user",
                    name: storedUser.displayName || storedUser.name || "Unknown User",
                    email: storedUser.email || "",
                    role: storedUser.role || "user",
                    photoURL: storedUser.photoURL || "",
                    avatar: storedUser.photoURL || ""
                }
            };

            console.log("Submitting test request:", testRequest);

            // Call the API
            const response = await fetch('http://localhost:8080/test/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testRequest),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText || response.statusText}`);
            }

            const data = await response.json();
            console.log('Test queued successfully:', data);

            return {
                success: true,
                data: data
            };
        } catch (err) {
            console.error('Error submitting test:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to submit test'
            };
        }
    };

    // Usage in your component:
    //
    // const handleSubmit = async (e) => {
    //   e.preventDefault();
    //   setIsSubmitting(true);
    //   
    //   // If test name is empty, use the default "Untitled Test"
    //   const testName = newTestName.trim() || `Untitled Test - ${new Date().toLocaleString()}`;
    //   
    //   const priority = getPriorityValue();
    //   
    //   const result = await submitToApi(testName, newChipType, testCount, testBatch, priority);
    //   
    //   if (result.success) {
    //     // Call any UI update functions
    //     onCreateTest(testName, newChipType);
    //     resetForm();
    //   } else {
    //     setError(result.error);
    //   }
    //   
    //   setIsSubmitting(false);
    // };

    const getPriorityValue = () => {
        // Get the select element value and convert to numeric priority
        const prioritySelect = document.getElementById('priority') as HTMLSelectElement;
        if (!prioritySelect) return 1; // Default to normal priority

        switch (prioritySelect.value) {
            case 'high': return 3;
            case 'low': return 0;
            default: return 1; // normal
        }
    };

    const resetForm = () => {
        setNewTestName("");
        setNewChipType("3-SAT");
        setTestSource("cached");
        setTestBatch("standard");
        setTestCount("10");
        setFiles([]);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // If test name is empty, use the default "Untitled Test"
        const testName = newTestName.trim() || `Untitled Test - ${new Date().toLocaleString()}`;

        await submitToApi(testName, newChipType);
    };

    const removeFile = (path: string) => {
        setFiles((prevFiles) => prevFiles.filter((file) => file.name !== path));
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
                                                QuiCC - 3-SAT
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
                                            Default test name and settings are provided for your convenience.
                                        </p>
                                    </div>
                                    {error && (
                                        <div className="mt-4 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-gray-200 p-6 dark:border-gray-700">
                                <button
                                    type="button"
                                    className="rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Create Test'}
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
                                    placeholder="Default name will be used if empty"
                                    disabled={isSubmitting}
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
                                <div className="custom-select-wrapper">
                                    <Select
                                        name="chipType"
                                        id="chipType"
                                        className="mt-4 w-full"
                                        value={newChipType}
                                        onValueChange={setNewChipType}
                                        enableClear={false}
                                        disabled={isSubmitting}
                                    >
                                        <SelectItem value="3-SAT">3-SAT Solver</SelectItem>
                                        <SelectItem value="LDPC">LDPC Solver</SelectItem>
                                        <SelectItem value="K-SAT">K-SAT Solver</SelectItem>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center space-x-3">
                                    <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        3
                                    </div>
                                    <label htmlFor="testSource" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        Test Source
                                    </label>
                                </div>
                                <div className="mt-4 space-y-4">
                                    <div className="flex items-center">
                                        <input
                                            id="testSource-cached"
                                            name="testSource"
                                            type="radio"
                                            checked={testSource === "cached"}
                                            onChange={() => setTestSource("cached")}
                                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:focus:ring-blue-400"
                                            disabled={isSubmitting}
                                        />
                                        <label htmlFor="testSource-cached" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Use cached test batch
                                        </label>
                                    </div>
                                    <div className="flex items-center">
                                        <input
                                            id="testSource-upload"
                                            name="testSource"
                                            type="radio"
                                            checked={testSource === "upload"}
                                            onChange={() => setTestSource("upload")}
                                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:focus:ring-blue-400"
                                            disabled={isSubmitting}
                                        />
                                        <label htmlFor="testSource-upload" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Upload my own test files
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {testSource === "cached" ? (
                                <>
                                    <div>
                                        <div className="flex items-center space-x-3">
                                            <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                4
                                            </div>
                                            <label htmlFor="testBatch" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Test Batch
                                            </label>
                                        </div>
                                        <div className="custom-select-wrapper">
                                            <Select
                                                name="testBatch"
                                                id="testBatch"
                                                className="mt-4 w-full"
                                                value={testBatch}
                                                onValueChange={setTestBatch}
                                                enableClear={false}
                                                disabled={isSubmitting}
                                            >
                                                <SelectItem value="standard">Standard Test Suite</SelectItem>
                                                <SelectItem value="extended">Extended Test Suite</SelectItem>
                                                <SelectItem value="performance">Performance Benchmark</SelectItem>
                                                <SelectItem value="random">Random Problem Generator</SelectItem>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-3">
                                            <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                5
                                            </div>
                                            <label htmlFor="testCount" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Number of Tests
                                            </label>
                                        </div>
                                        <div className="custom-select-wrapper">
                                            <Select
                                                name="testCount"
                                                id="testCount"
                                                className="mt-4 w-full"
                                                value={testCount}
                                                onValueChange={setTestCount}
                                                enableClear={false}
                                                disabled={isSubmitting}
                                            >
                                                <SelectItem value="5">5 tests</SelectItem>
                                                <SelectItem value="10">10 tests</SelectItem>
                                                <SelectItem value="20">20 tests</SelectItem>
                                                <SelectItem value="50">50 tests</SelectItem>
                                                <SelectItem value="100">100 tests</SelectItem>
                                            </Select>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <div className="flex items-center space-x-3">
                                        <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                            4
                                        </div>
                                        <label htmlFor="fileUpload" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            Upload Test Files
                                        </label>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Upload .cnf files or .zip archives with multiple test cases
                                    </p>
                                    <div
                                        {...getRootProps()}
                                        className={classNames(
                                            isDragActive
                                                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                                                : '',
                                            'mt-2 flex justify-center rounded-md border border-dashed border-gray-300 px-6 py-10 dark:border-gray-600',
                                            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                        )}
                                    >
                                        <div className="text-center">
                                            <RiFileLine
                                                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
                                                aria-hidden={true}
                                            />
                                            <div className="mt-4 flex justify-center text-sm leading-6 text-gray-600 dark:text-gray-400">
                                                <label
                                                    htmlFor="file-upload"
                                                    className="relative cursor-pointer rounded-md font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                                >
                                                    <span>Upload a file</span>
                                                    <input
                                                        {...getInputProps()}
                                                        id="file-upload"
                                                        name="file-upload"
                                                        type="file"
                                                        className="sr-only"
                                                        disabled={isSubmitting}
                                                    />
                                                </label>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">
                                                .cnf or .zip files up to 50MB
                                            </p>
                                        </div>
                                    </div>
                                    {files.length > 0 && (
                                        <ul role="list" className="mt-4 space-y-4">
                                            {files.map((file) => (
                                                <li
                                                    key={file.name}
                                                    className="relative rounded-md border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-600 dark:bg-gray-700"
                                                >
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                        <button
                                                            type="button"
                                                            className="rounded-md p-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                                                            aria-label="Remove file"
                                                            onClick={() => removeFile(file.name)}
                                                            disabled={isSubmitting}
                                                        >
                                                            <RiDeleteBinLine className="size-5 shrink-0" aria-hidden={true} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">
                                                            <RiFileLine
                                                                className="size-5 text-gray-600 dark:text-gray-400"
                                                                aria-hidden={true}
                                                            />
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                {file.name}
                                                            </p>
                                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                                {(file.size / 1024).toFixed(2)} KB
                                                            </p>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                            <div>
                                <div className="flex items-center space-x-3">
                                    <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                        {testSource === "cached" ? "6" : "5"}
                                    </div>
                                    <label htmlFor="priority" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        Test Priority
                                    </label>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Higher priority tests will be processed sooner
                                </p>
                                <div className="custom-select-wrapper">
                                    <Select
                                        name="priority"
                                        id="priority"
                                        className="mt-4 w-full"
                                        defaultValue="normal"
                                        enableClear={false}
                                        disabled={isSubmitting}
                                    >
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </DialogPanel>
        </Dialog>
    );
};

export default CreateTestWindow;