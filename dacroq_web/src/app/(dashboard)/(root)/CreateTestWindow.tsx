'use client';

import { db } from "@/lib/firebase";
import { RiAppsFill, RiCloseLine, RiDeleteBinLine, RiFileLine, RiFileListLine } from "@remixicon/react";
import { Dialog, DialogPanel } from "@tremor/react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/Select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
// Using Tremor's progress bar instead since it's already available
import { ProgressBar } from "@tremor/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CreateTestWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onTestComplete?: (testId: string) => void;
}

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

const CreateTestWindow: React.FC<CreateTestWindowProps> = ({ isOpen, onClose, onTestComplete }) => {
    const [newTestName, setNewTestName] = useState("");
    const [newChipType, setNewChipType] = useState("3-SAT");
    const [testSource, setTestSource] = useState("cached");
    const [testBatch, setTestBatch] = useState("hardware-t_batch_0");
    const [testCount, setTestCount] = useState("10");
    const [maxTests, setMaxTests] = useState(100);
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiResponse, setApiResponse] = useState<any>(null);
    const [presets, setPresets] = useState<string[]>([]);
    const [isApiConnected, setIsApiConnected] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [isResultsExpanded, setIsResultsExpanded] = useState(false);

    // Initialize dropzone
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => {
            setFiles((prev) => [...prev, ...acceptedFiles]);
        }
    });

    const removeFile = (fileName: string) => {
        setFiles((prev) => prev.filter(file => file.name !== fileName));
    };

    // Check API connection
    const checkApiConnection = async () => {
        try {
            console.log("Checking API connection...");
            const response = await fetch("http://localhost:8080/presets", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            
            console.log("API response status:", response.status);
            if (response.ok) {
                const data = await response.json();
                console.log("API connection successful, presets:", data.presets);
                setIsApiConnected(true);
                return true;
            } else {
                console.error("API connection failed with status:", response.status);
                setIsApiConnected(false);
                return false;
            }
        } catch (error) {
            console.error("API connection error:", error);
            setIsApiConnected(false);
            return false;
        }
    };

    // Fetch available presets from the API
    const fetchPresets = async () => {
        try {
            console.log("Fetching presets...");
            const response = await fetch("http://localhost:8080/presets", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            
            console.log("Presets response status:", response.status);
            if (response.ok) {
                const data = await response.json();
                console.log("Fetched presets:", data.presets);
                if (data.presets && Array.isArray(data.presets)) {
                    setPresets(data.presets);
                    return data.presets;
                }
            } else {
                console.error("Failed to fetch presets with status:", response.status);
            }
            return [];
        } catch (error) {
            console.error("Error fetching presets:", error);
            return [];
        }
    };

    // Fetch maximum number of tests for a preset
    const fetchMaxTests = async (preset: string) => {
        try {
            const response = await fetch(`http://localhost:8080/max-tests?preset=${encodeURIComponent(preset)}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.total_tests) {
                    setMaxTests(data.total_tests);
                    return data.total_tests;
                }
            }
            return 100; // Default value
        } catch (error) {
            console.error("Error fetching max tests:", error);
            return 100; // Default value
        }
    };

    // Check API connection and fetch presets when component mounts or dialog opens
    useEffect(() => {
        const initializeApi = async () => {
            const isConnected = await checkApiConnection();
            if (isConnected) {
                await fetchPresets();
                await fetchMaxTests(testBatch);
            }
        };
        
        if (isOpen) {
            initializeApi();
        }
    }, [isOpen, testBatch]);

    // Update max tests when test batch changes
    useEffect(() => {
        if (isApiConnected && testBatch) {
            fetchMaxTests(testBatch);
        }
    }, [testBatch, isApiConnected]);

    // Function to submit the test request to the API.
    const submitToApi = async (testName: string, chipType: string) => {
        try {
            // Get user data from localStorage.
            const storedUserStr = localStorage.getItem("user");
            if (!storedUserStr) {
                throw new Error("User information not found. Please log in again.");
            }
            const storedUser = JSON.parse(storedUserStr);

            // Create a payload for the /daedalus endpoint.
            const payload = {
                preset: testBatch,
                start_index: 0,
                end_index: parseInt(testCount),
            };

            console.log("Submitting payload to /daedalus:", payload);

            const response = await fetch("http://localhost:8080/daedalus", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText || response.statusText}`);
            }

            const data = await response.json();
            console.log("Received API response:", JSON.stringify(data, null, 2));
            setApiResponse(data);

            // Flatten nested arrays in the results
            const flattenedResults = {
                timestamp: data.timestamp,
                summary: data.summary,
                results: data.results.map((result: any) => ({
                    ...result,
                    // Keep the nested objects as they are
                    powerUsage: result.powerUsage,
                    solverMetrics: result.solverMetrics,
                    performanceMetrics: result.performanceMetrics,
                    resourceUsage: result.resourceUsage,
                    // Flatten only the arrays that need to be flattened
                    configurations: result.configurations.map((config: number[]) => config.join(',')),
                    n_unsat_clauses: result.n_unsat_clauses.join(','),
                    hardware_time_seconds: result.hardware_time_seconds.join(','),
                    cpu_time_seconds: result.cpu_time_seconds.join(','),
                    cpu_energy_joules: result.cpu_energy_joules.join(','),
                    hardware_energy_joules: result.hardware_energy_joules.join(','),
                    hardware_calls: result.hardware_calls.join(','),
                    solver_iterations: result.solver_iterations.join(',')
                }))
            };

            // Create the test document in Firestore with the flattened results
            const newTest = {
                name: testName || 'Untitled Test',
                chipType: chipType || '3-SAT',
                status: "completed",
                created: new Date().toISOString(),
                results: flattenedResults || {
                    timestamp: new Date().toISOString(),
                    summary: {},
                    results: []
                },
                createdBy: {
                    uid: storedUser.uid || '',
                    name: storedUser.displayName || storedUser.name || 'Unknown User',
                    email: storedUser.email || '',
                    role: storedUser.role || "user",
                    photoURL: storedUser.photoURL || '',
                    avatar: storedUser.photoURL || '',
                },
            };

            // Clean up any undefined values before saving
            const cleanTest = JSON.parse(JSON.stringify(newTest));

            // Log the document before saving
            console.log("Saving to Firestore:", JSON.stringify(cleanTest, null, 2));

            const docRef = await addDoc(collection(db, "tests"), cleanTest);
            console.log("Document saved with ID:", docRef.id);

            return { success: true, docId: docRef.id };
        } catch (err) {
            console.error("Error submitting SAT job:", err);
            return {
                success: false,
                error: err instanceof Error ? err.message : "Failed to submit test",
            };
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setTestStatus('running');
        setProgress(0);
        setCurrentStep('Initializing test...');

        try {
            const testName = newTestName.trim() || `Untitled Test - ${new Date().toLocaleString()}`;

            if (testSource === "upload" && files.length === 0) {
                throw new Error("Please upload at least one test file");
            }

            setCurrentStep('Submitting test to API...');
            setProgress(20);
            const result = await submitToApi(testName, newChipType);

            if (result.success && result.docId) {
                setCurrentStep('Test completed successfully');
                setProgress(100);
                setTestStatus('completed');
                setIsResultsExpanded(false);
                setApiResponse({ 
                    id: result.docId,
                    name: testName || 'Untitled Test',
                    chipType: newChipType,
                    status: 'completed',
                    created: new Date().toISOString()
                });
            } else {
                setError(result.error || 'Failed to create test');
                setTestStatus('error');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
            setTestStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} static={true} className="relative z-50">
            <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
            <DialogPanel className="relative z-50 max-w-5xl overflow-visible rounded-lg bg-white shadow-xl dark:bg-gray-800">
                {/* Header Section */}
                <div className="border-b border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                New Performance Test
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Benchmark and evaluate your solver's efficiency
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className={classNames(
                                "px-2 py-0.5 text-xs rounded-full inline-flex items-center gap-1",
                                isApiConnected
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                    : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            )}>
                                <span className={classNames(
                                    "w-1.5 h-1.5 rounded-full",
                                    isApiConnected ? "bg-green-500" : "bg-gray-400"
                                )} />
                                {isApiConnected ? "API Ready" : "API Status"}
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700"
                            >
                                <RiCloseLine className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                {/* Main Content */}
                <div className="flex flex-col">
                    {testStatus === 'idle' ? (
                        <form onSubmit={handleSubmit} className="flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                                {/* Test Configuration Section */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Test Name
                                        </label>
                                        <input
                                            type="text"
                                            value={newTestName}
                                            onChange={(e) => setNewTestName(e.target.value)}
                                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                            placeholder="Enter test name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Chip Type
                                        </label>
                                        <Select value={newChipType} onValueChange={setNewChipType}>
                                            <SelectTrigger>
                                                {newChipType}
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="3-SAT">3-SAT Solver</SelectItem>
                                                <SelectItem value="LDPC">LDPC Solver</SelectItem>
                                                <SelectItem value="K-SAT">K-SAT Solver</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Test Source
                                        </label>
                                        <div className="space-y-2">
                                            <div className="flex items-center">
                                                <input
                                                    type="radio"
                                                    checked={testSource === "cached"}
                                                    onChange={() => setTestSource("cached")}
                                                    className="h-4 w-4 border-gray-300 text-blue-600"
                                                />
                                                <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                                    Use cached test batch
                                                </label>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="radio"
                                                    checked={testSource === "upload"}
                                                    onChange={() => setTestSource("upload")}
                                                    className="h-4 w-4 border-gray-300 text-blue-600"
                                                />
                                                <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                                    Upload test files
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Test Parameters Section */}
                                <div className="space-y-6">
                                    {testSource === "cached" ? (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Batch Name
                                                </label>
                                                <Select value={testBatch} onValueChange={setTestBatch}>
                                                    <SelectTrigger>
                                                        {testBatch}
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {presets.map((preset) => (
                                                            <SelectItem key={preset} value={preset}>
                                                                {preset}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Number of Tests
                                                    </label>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                                        {testCount} / {maxTests}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max={maxTests}
                                                    value={testCount}
                                                    onChange={(e) => setTestCount(e.target.value)}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-4">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Upload Files
                                            </label>
                                            <div {...getRootProps()} className={classNames(
                                                "border-2 border-dashed rounded-lg p-6 text-center",
                                                isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
                                            )}>
                                                <RiFileLine className="mx-auto h-12 w-12 text-gray-400" />
                                                <p className="mt-2 text-sm text-gray-600">
                                                    Drag and drop your files here, or click to select
                                                </p>
                                            </div>
                                            {files.length > 0 && (
                                                <ul className="space-y-2">
                                                    {files.map((file) => (
                                                        <li key={file.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                                            <span className="text-sm text-gray-700">{file.name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeFile(file.name)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <RiDeleteBinLine className="h-5 w-5" />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex justify-between">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    {isSubmitting ? "Running..." : "Start Benchmark"}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Progress Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                        Performance Test
                                    </h3>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {progress}%
                                    </span>
                                </div>
                                <ProgressBar value={progress} className="mt-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {currentStep}
                                </p>
                            </div>

                            {/* Results Section */}
                            {apiResponse && (
                                <Card className="overflow-hidden">
                                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center space-x-2">
                                            <RiFileListLine className="h-5 w-5 text-gray-500" />
                                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Test Results
                                            </h4>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsResultsExpanded(!isResultsExpanded)}
                                        >
                                            {isResultsExpanded ? "Show Less" : "Show More"}
                                        </Button>
                                    </div>
                                    {isResultsExpanded ? (
                                        <div className="p-4 max-h-96 overflow-auto">
                                            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                                {JSON.stringify(apiResponse, null, 2)}
                                            </pre>
                                        </div>
                                    ) : (
                                        <div className="p-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Test Name</p>
                                                    <p className="text-sm font-medium">{apiResponse.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Chip Type</p>
                                                    <p className="text-sm font-medium">{apiResponse.chipType}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                                                    <p className="text-sm font-medium text-green-600 dark:text-green-400">{apiResponse.status}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                                                    <p className="text-sm font-medium">{new Date(apiResponse.created).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            )}

                            {/* Action Buttons for Completed Test */}
                            <div className="flex justify-end space-x-4 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    Close
                                </Button>
                                {testStatus === 'completed' && (
                                    <Button
                                        onClick={() => {
                                            if (onTestComplete && apiResponse?.id) {
                                                console.log("Calling onTestComplete with ID:", apiResponse.id);
                                                onTestComplete(apiResponse.id);
                                            } else {
                                                console.error("Cannot view full report: Missing test ID or onTestComplete function");
                                            }
                                            onClose();
                                        }}
                                        className="bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                        View Full Report
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogPanel>
        </Dialog>
    );
};

export default CreateTestWindow;