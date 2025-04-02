'use client';

import { db } from "@/lib/firebase";
import { RiAppsFill, RiCloseLine, RiDeleteBinLine, RiFileLine } from "@remixicon/react";
import { Dialog, DialogPanel } from "@tremor/react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import "./test-window.css";
// Import the new select components from your custom component
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/Select";

interface CreateTestWindowProps {
    isOpen: boolean;
    onClose: () => void;
    // Removed onCreateTest callback to prevent duplicate insertion.
}

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

const CreateTestWindow: React.FC<CreateTestWindowProps> = ({ isOpen, onClose }) => {
    const [newTestName, setNewTestName] = useState("");
    const [newChipType, setNewChipType] = useState("3-SAT");
    const [testSource, setTestSource] = useState("cached"); // "cached" or "upload"
    // Use a valid default preset that exists on the server.
    const [testBatch, setTestBatch] = useState("hardware-t_batch_0");
    const [testCount, setTestCount] = useState("10");
    const [maxTests, setMaxTests] = useState(100);
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiResponse, setApiResponse] = useState<any>(null);
    const [presets, setPresets] = useState<string[]>([]);

    // Fetch presets when component mounts
    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const response = await fetch("http://localhost:8080/presets", {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    mode: 'cors'
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch presets: ${response.status}`);
                }

                const data = await response.json();
                if (data.status === "success") {
                    setPresets(data.presets);
                    // Set initial test batch to first preset if available.
                    if (data.presets.length > 0) {
                        setTestBatch(data.presets[0]);
                    }
                } else {
                    console.warn("Presets response not in expected format:", data);
                }
            } catch (err) {
                console.error("Error fetching presets:", err);
                // Set some default presets in case of error.
                setPresets([
                    "hardware-t_batch_0",
                    "hardware-t_batch_1",
                    "hardware-t_batch_2",
                    "hardware-t_batch_3",
                    "hardware-t_batch_4"
                ]);
            }
        };

        if (isOpen) {
            fetchPresets();
        }
    }, [isOpen]);

    // Fetch max tests when test batch changes.
    useEffect(() => {
        const fetchMaxTests = async () => {
            try {
                const response = await fetch(`http://localhost:8080/max-tests?preset=${encodeURIComponent(testBatch)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    mode: 'cors'
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch max tests: ${response.status}`);
                }

                const data = await response.json();
                // Get the total number of tests from the response.
                const totalTests = data.total_tests || 100; // Default to 100 if not specified.
                setMaxTests(totalTests);
                // Reset test count if it's greater than max tests.
                if (parseInt(testCount) > totalTests) {
                    setTestCount(totalTests.toString());
                }
            } catch (err) {
                console.error("Error fetching max tests:", err);
                setMaxTests(100); // Default to 100 on error.
            }
        };

        if (testBatch) {
            fetchMaxTests();
        }
    }, [testBatch, testCount]);

    // Generate a default test name with timestamp when modal opens.
    useEffect(() => {
        if (isOpen) {
            const timestamp = new Date().toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
                hour12: true,
            });
            setNewTestName(`Untitled Test - ${timestamp}`);
            setError(null);
            setApiResponse(null);
        }
    }, [isOpen]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => setFiles(acceptedFiles),
        accept: {
            "application/zip": [".zip"],
            "text/plain": [".cnf"],
        },
    });

    // Function to submit the test request to the API.
    const submitToApi = async (testName: string, chipType: string) => {
        try {
            // Get user data from localStorage.
            const storedUserStr = localStorage.getItem("user");
            if (!storedUserStr) {
                throw new Error("User information not found. Please log in again.");
            }
            const storedUser = JSON.parse(storedUserStr);

            // Prepare CNF file content or reference.
            let cnfContent = "";
            if (testSource === "upload" && files.length > 0) {
                // For uploaded files, read the content.
                cnfContent = await readFileAsText(files[0]);
            } else {
                // For cached tests, create a reference identifier.
                cnfContent = `${testBatch}_${testCount}`;
            }

            // Create a payload for the /daedalus endpoint.
            // Use the testBatch state so that the preset matches what the server expects.
            const payload = {
                preset: testBatch,
                start_index: 0,
                end_index: 50,
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
            console.log("Received API response:", data);
            setApiResponse(data);

            // Create the test document in Firestore.
            // Only one insertion occurs here. The onSnapshot in the dashboard will pick up this document.
            const newTest = {
                name: testName,
                chipType: chipType,
                status: "completed",
                created: serverTimestamp(),
                results: data, // store the entire results JSON.
                createdBy: {
                    uid: storedUser.uid,
                    name: storedUser.displayName || storedUser.name,
                    email: storedUser.email,
                    role: storedUser.role || "user",
                    photoURL: storedUser.photoURL || "",
                    avatar: storedUser.photoURL || "",
                },
            };

            await addDoc(collection(db, "tests"), newTest);

            return { success: true };
        } catch (err) {
            console.error("Error submitting SAT job:", err);
            return {
                success: false,
                error: err instanceof Error ? err.message : "Failed to submit test",
            };
        }
    };

    // Helper function to read file content.
    const readFileAsText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const resetForm = () => {
        setNewTestName("");
        setNewChipType("3-SAT");
        setTestSource("cached");
        // Do not reset testBatch so that the user’s choice persists.
        setTestCount("10");
        setFiles([]);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const testName = newTestName.trim() || `Untitled Test - ${new Date().toLocaleString()}`;

            if (testSource === "upload" && files.length === 0) {
                throw new Error("Please upload at least one test file");
            }

            const result = await submitToApi(testName, newChipType);

            if (result.success) {
                // We no longer call onCreateTest to prevent duplicate test insertion.
                resetForm();
                onClose();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
        } finally {
            setIsSubmitting(false);
        }
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
                      <div className="flex items-center space-x-3">
                          <div className="inline-flex shrink-0 items-center justify-center rounded bg-blue-100 p-3 dark:bg-blue-900">
                              <RiAppsFill className="size-5 text-blue-600 dark:text-blue-300" aria-hidden={true} />
                          </div>
                          <div>
                              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                                  SAT Solver Performance Test
                              </h3>
                              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                  Benchmark and evaluate your solver’s efficiency.
                              </p>
                          </div>
                      </div>
                      <div className="mt-6">
                          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                              Configure your test parameters below and launch a performance benchmark.
                          </p>
                          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                              Modify the default test name and settings as required.
                          </p>
                          {error && (
                            <div className="mt-4 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                            </div>
                          )}
                      </div>
                  </div>
                  <div className="flex flex-col-reverse md:flex-row">
                      <div className="flex flex-col justify-between md:w-80 md:border-r md:border-gray-200 dark:md:border-gray-700">
                          <div className="flex-1 grow">
                              <div className="border-t border-gray-200 p-6 dark:border-gray-700 md:border-none">
                                  {/* Additional content can be placed here if needed */}
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
                                  {isSubmitting ? "Submitting..." : "Create Test"}
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
                                placeholder="Enter a custom test name or use the default"
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
                                    value={newChipType}
                                    onValueChange={setNewChipType}
                                    disabled={isSubmitting}
                                  >
                                      <SelectTrigger className="mt-4 w-full">
                                          {newChipType}
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="3-SAT">3-SAT Solver</SelectItem>
                                          <SelectItem value="LDPC">LDPC Solver</SelectItem>
                                          <SelectItem value="K-SAT">K-SAT Solver</SelectItem>
                                      </SelectContent>
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
                                            Batch Name
                                        </label>
                                    </div>
                                    <div className="custom-select-wrapper">
                                        <Select
                                          value={testBatch}
                                          onValueChange={setTestBatch}
                                          disabled={isSubmitting}
                                        >
                                            <SelectTrigger className="mt-4 w-full">
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
                                </div>
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="inline-flex size-6 items-center justify-center rounded bg-gray-100 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                5
                                            </div>
                                            <label htmlFor="testCount" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Number of Tests
                                            </label>
                                        </div>
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
                                      className="mt-4 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                      disabled={isSubmitting}
                                    />
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
                                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                                      : "",
                                    "mt-2 flex justify-center rounded-md border border-dashed border-gray-300 px-6 py-10 dark:border-gray-600",
                                    isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                                  )}
                                >
                                    <div className="text-center">
                                        <RiFileLine className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" aria-hidden={true} />
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
                              <RiFileLine className="size-5 text-gray-600 dark:text-gray-400" aria-hidden={true} />
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
                      </div>
                  </div>
              </form>
              {apiResponse && (
                <div className="p-6">
                    <h2 className="mb-2 text-xl font-bold">API Response</h2>
                    <pre className="rounded bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
                </div>
              )}
          </DialogPanel>
      </Dialog>
    );
};

export default CreateTestWindow;
