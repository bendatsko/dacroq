"use client";

import { useState, useEffect } from "react";
import {
  RiCloseLine,
  RiPlayLine,
  RiDeleteBin5Line,
  RiFileDownloadLine,
  RiCodeLine,
  RiFileListLine,
  RiLoopLeftLine,
  RiSettings4Line,
  RiInformationLine,
  RiTerminalLine,
  RiClipboardLine,
  RiTimeLine,
  RiErrorWarningLine,
} from "@remixicon/react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
  DrawerDescription
} from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/Tabs";
import { Badge } from "@/components/Badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Base URL for the backend API
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export interface TestDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: any | null;
  onRerunTest: (testId: string) => Promise<void>;
  onDeleteTest: (testId: string) => Promise<void>;
  isAdmin: boolean;
}

export function TestDetailDrawer({
                                   open,
                                   onOpenChange,
                                   test,
                                   onRerunTest,
                                   onDeleteTest,
                                   isAdmin,
                                 }: TestDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);

  // Reset the active tab when a new test is selected
  useEffect(() => {
    if (open && test) {
      setActiveTab("overview");
      fetchTestDetails(test.id);
    } else {
      setTestData(null);
      setLogs([]);
      setResults(null);
    }
  }, [open, test]);

  const fetchTestDetails = async (testId: string) => {
    if (!testId) return;

    setLoading(true);
    try {
      // Fetch test details
      const res = await fetch(`${API_BASE}/api/tests/${testId}`);
      if (!res.ok) throw new Error(`Failed to fetch test details (${res.status})`);
      const data = await res.json();
      setTestData(data);

      // Fetch test logs if test is completed or running
      if (data.status === "completed" || data.status === "running" || data.status === "failed") {
        try {
          const logsRes = await fetch(`${API_BASE}/api/tests/${testId}/logs`);
          if (logsRes.ok) {
            const logsData = await logsRes.text();
            setLogs(logsData.split('\n').filter(line => line.trim()));
          }
        } catch (e) {
          console.error("Failed to fetch logs:", e);
        }
      }

      // Fetch test results if test is completed
      if (data.status === "completed") {
        try {
          const resultsRes = await fetch(`${API_BASE}/api/tests/${testId}/results`);
          if (resultsRes.ok) {
            const resultsData = await resultsRes.json();
            setResults(resultsData);
          }
        } catch (e) {
          console.error("Failed to fetch results:", e);
        }
      }
    } catch (e) {
      console.error("Error fetching test details:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "";

    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const downloadResults = async () => {
    if (!test?.id) return;

    try {
      const res = await fetch(`${API_BASE}/api/tests/${test.id}/download`);
      if (!res.ok) throw new Error(`Failed to download results (${res.status})`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-${test.id}-results.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Error downloading results:", e);
    }
  };

  const copyTestId = () => {
    if (!test?.id) return;

    navigator.clipboard.writeText(test.id).then(
      () => {
        // Success
        console.log("Test ID copied to clipboard");
      },
      () => {
        // Failure
        console.error("Failed to copy test ID");
      }
    );
  };

  // If no test is selected, don't render the drawer
  if (!test) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="sm:max-w-xl lg:max-w-2xl h-full">
        <DrawerHeader className="px-6 py-4 pb-0 border-none">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-lg font-medium text-gray-900 dark:text-white">
                {testData?.name || test.name}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                <span className="font-mono text-xs">{test.id}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 p-0"
                  onClick={copyTestId}
                >
                  <RiClipboardLine className="h-4 w-4 text-gray-400" />
                </Button>
              </DrawerDescription>
            </div>
            
          </div>

          <div className="flex items-center justify-between mt-6 mb-4">
            <div className="flex items-center space-x-3">
              <span
                className={cn(
                  "h-7 px-3 py-1 inline-flex items-center justify-center text-xs leading-5 font-semibold rounded-full",
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
                {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
              </span>

              <Badge variant="outline" className="h-7 px-3 py-1 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {testData?.chipType || test.chipType}
              </Badge>

              <Badge variant="outline" className="h-7 px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                {testData?.processorType || test.processorType || "ARM (Teensy 4.1)"}
              </Badge>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 ml-3">
              <RiTimeLine className="h-4 w-4" />
              <span>{formatTimestamp(test.created).split(',')[0]}</span>
            </div>
          </div>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="px-6 pt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="overview" className="py-2.5">Overview</TabsTrigger>
              <TabsTrigger value="logs" className="py-2.5">Logs</TabsTrigger>
              <TabsTrigger value="results" className="py-2.5">Results</TabsTrigger>
            </TabsList>
          </div>

          <DrawerBody className="p-0 flex-1 overflow-auto">
            <TabsContent value="overview" className="h-full mt-0 p-6">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="flex items-center space-x-2">
                    <svg
                      className="animate-spin h-5 w-5 text-blue-600"
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
                    <span className="text-sm text-gray-500">Loading test details...</span>
                  </div>
                </div>
              ) : testData ? (
                <div className="space-y-6">
                  {/* Test Progress Section */}
                  {test.status === "running" && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">Test Progress</h3>
                      <Progress value={testData.progress || 25} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                        <span>Started: {formatTimestamp(testData.startTime || test.created)}</span>
                        <span>Estimated completion: {testData.estimatedEndTime ? formatTimestamp(testData.estimatedEndTime) : "Unknown"}</span>
                      </div>
                    </div>
                  )}

                  {/* Hardware Configuration */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                      <RiSettings4Line className="h-4 w-4 text-blue-500" />
                      Hardware Configuration
                    </h3>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Chip Type</h4>
                          <p className="text-sm font-medium">{testData.chipType || test.chipType}</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Processor</h4>
                          <p className="text-sm font-medium">{testData.processorType || test.processorType || "ARM (Teensy 4.1)"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {testData.voltage && (
                          <>
                            {testData.voltage.v1 !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">V₁ Voltage</h4>
                                <p className="text-sm font-medium">{testData.voltage.v1}V</p>
                              </div>
                            )}

                            {testData.voltage.v2 !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">V₂ Voltage</h4>
                                <p className="text-sm font-medium">{testData.voltage.v2}V</p>
                              </div>
                            )}

                            {testData.voltage.v3 !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">V₃ Voltage</h4>
                                <p className="text-sm font-medium">{testData.voltage.v3}V</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {testData.config && (
                        <div className="grid grid-cols-2 gap-2">
                          {testData.config.clockFrequency !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Clock Frequency</h4>
                              <p className="text-sm font-medium">{testData.config.clockFrequency} MHz</p>
                            </div>
                          )}

                          {testData.config.testDuration !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Test Duration</h4>
                              <p className="text-sm font-medium">{testData.config.testDuration} seconds</p>
                            </div>
                          )}

                          {/* Chip-specific configuration values */}
                          {testData.chipType === "3SAT" && testData.config.satIterations !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">SAT Iterations</h4>
                              <p className="text-sm font-medium">{testData.config.satIterations}</p>
                            </div>
                          )}

                          {testData.chipType === "LDPC" && testData.config.ldpcCodeRate !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">LDPC Code Rate</h4>
                              <p className="text-sm font-medium">{testData.config.ldpcCodeRate.toFixed(2)}</p>
                            </div>
                          )}

                          {testData.chipType === "HARDWARE" && testData.config.hardwareParallelization !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Parallelization</h4>
                              <p className="text-sm font-medium">{testData.config.hardwareParallelization}x</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Test Information */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                      <RiInformationLine className="h-4 w-4 text-blue-500" />
                      Test Information
                    </h3>

                    <div className="space-y-3">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Test Type</h4>
                        <p className="text-sm font-medium">{testData.testType || test.testType || "Hardware-in-Loop"}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Created At</h4>
                          <p className="text-sm font-medium">{formatTimestamp(testData.created || test.created)}</p>
                        </div>

                        {testData.status === "completed" && testData.completedAt && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Completed At</h4>
                            <p className="text-sm font-medium">{formatTimestamp(testData.completedAt)}</p>
                          </div>
                        )}

                        {testData.metadata?.createdBy && (
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Created By</h4>
                            <p className="text-sm font-medium">{testData.metadata.createdBy.name}</p>
                          </div>
                        )}
                      </div>

                      {testData.description && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md">
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Description</h4>
                          <p className="text-sm">{testData.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Error Information (if test failed) */}
                  {testData.status === "failed" && testData.error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-1.5">
                        <RiErrorWarningLine className="h-4 w-4" />
                        Error Information
                      </h3>
                      <div className="text-sm text-red-700 dark:text-red-300 font-mono bg-red-100 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-900/30 whitespace-pre-wrap">
                        {testData.error}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex justify-center items-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p>No test details available</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs" className="h-full mt-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-6 py-3 border-b">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <RiTerminalLine className="h-4 w-4 text-gray-500" />
                    Test Logs
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-1"
                    onClick={() => {
                      if (test?.id) {
                        fetchTestDetails(test.id);
                      }
                    }}
                  >
                    <RiLoopLeftLine className="h-4 w-4" />
                    <span className="sr-only">Refresh</span>
                  </Button>
                </div>

                <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800/50 font-mono text-xs p-4">
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="flex items-center space-x-2">
                        <svg
                          className="animate-spin h-5 w-5 text-blue-600"
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
                        <span className="text-sm text-gray-500">Loading logs...</span>
                      </div>
                    </div>
                  ) : logs.length > 0 ? (
                    <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {logs.map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            "py-0.5",
                            line.includes("ERROR") && "text-red-600 dark:text-red-400",
                            line.includes("WARNING") && "text-amber-600 dark:text-amber-400",
                            line.includes("SUCCESS") && "text-green-600 dark:text-green-400"
                          )}
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <p>No logs available</p>
                        {(test.status === "queued" || !test.status) && (
                          <p className="mt-1 text-xs">Logs will appear once the test starts running</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results" className="h-full mt-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-6 py-3 border-b">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <RiFileListLine className="h-4 w-4 text-gray-500" />
                    Test Results
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 p-1"
                    onClick={() => {
                      if (test?.id) {
                        fetchTestDetails(test.id);
                      }
                    }}
                  >
                    <RiLoopLeftLine className="h-4 w-4" />
                    <span className="sr-only">Refresh</span>
                  </Button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="flex items-center space-x-2">
                        <svg
                          className="animate-spin h-5 w-5 text-blue-600"
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
                        <span className="text-sm text-gray-500">Loading results...</span>
                      </div>
                    </div>
                  ) : test.status === "completed" && results ? (
                    <div className="space-y-6">
                      {/* Success/Failure Status */}
                      <div className={cn(
                        "p-4 rounded-lg",
                        results.success
                          ? "bg-green-50 dark:bg-green-900/10"
                          : "bg-red-50 dark:bg-red-900/10"
                      )}>
                        <h3 className={cn(
                          "text-sm font-medium mb-2 flex items-center gap-1.5",
                          results.success
                            ? "text-green-800 dark:text-green-400"
                            : "text-red-800 dark:text-red-400"
                        )}>
                          {results.success ? "Test Passed" : "Test Failed"}
                        </h3>
                        <p className={cn(
                          "text-sm",
                          results.success
                            ? "text-green-700 dark:text-green-300"
                            : "text-red-700 dark:text-red-300"
                        )}>
                          {results.message || (results.success
                            ? "All test criteria were met successfully"
                            : "One or more test criteria failed")}
                        </p>
                      </div>

                      {/* Performance Metrics */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                          Performance Metrics
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                          {results.errorRate !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Error Rate</h4>
                              <p className={cn(
                                "text-2xl font-semibold",
                                results.errorRate <= (testData?.config?.errorThreshold || 0.01)
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              )}>
                                {(results.errorRate * 100).toFixed(2)}%
                              </p>
                              {testData?.config?.errorThreshold !== undefined && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Threshold: {(testData.config.errorThreshold * 100).toFixed(2)}%
                                </p>
                              )}
                            </div>
                          )}

                          {results.throughput !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Throughput</h4>
                              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {results.throughput.toFixed(2)} Mbps
                              </p>
                              {results.throughputTarget && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Target: {results.throughputTarget} Mbps
                                </p>
                              )}
                            </div>
                          )}

                          {results.latency !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Latency</h4>
                              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {results.latency.toFixed(2)} ms
                              </p>
                              {results.latencyTarget && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Target: {results.latencyTarget} ms
                                </p>
                              )}
                            </div>
                          )}

                          {results.temperature !== undefined && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                              <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Temperature</h4>
                              <p className={cn(
                                "text-2xl font-semibold",
                                results.temperature > 80
                                  ? "text-red-600 dark:text-red-400"
                                  : results.temperature > 60
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-green-600 dark:text-green-400"
                              )}>
                                {results.temperature.toFixed(1)}°C
                              </p>
                              {results.temperatureMax && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Max: {results.temperatureMax}°C
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chip-Specific Results */}
                      {testData?.chipType === "3SAT" && results.satResults && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                            3SAT Solver Results
                          </h3>

                          <div className="grid grid-cols-2 gap-4">
                            {results.satResults.problemsSolved !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Problems Solved</h4>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                  {results.satResults.problemsSolved} / {results.satResults.totalProblems || testData.config.satIterations}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {((results.satResults.problemsSolved / (results.satResults.totalProblems || testData.config.satIterations)) * 100).toFixed(1)}% success rate
                                </p>
                              </div>
                            )}

                            {results.satResults.averageSolveTime !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Avg. Solve Time</h4>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                  {results.satResults.averageSolveTime.toFixed(2)} ms
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {testData?.chipType === "LDPC" && results.ldpcResults && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                            LDPC Decoder Results
                          </h3>

                          <div className="grid grid-cols-2 gap-4">
                            {results.ldpcResults.frameErrorRate !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Frame Error Rate</h4>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                  {(results.ldpcResults.frameErrorRate * 100).toFixed(4)}%
                                </p>
                              </div>
                            )}

                            {results.ldpcResults.bitErrorRate !== undefined && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                                <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Bit Error Rate</h4>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                  {(results.ldpcResults.bitErrorRate * 100).toFixed(6)}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      {results.files && results.files.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                            Result Files
                          </h3>

                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md overflow-hidden">
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                              {results.files.map((file: any, index: number) => (
                                <li key={index} className="px-4 py-3 flex items-center justify-between">
                                  <div className="flex items-center">
                                    <RiFileListLine className="h-5 w-5 text-gray-400 mr-2" />
                                    <span className="text-sm">{file.filename}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      // Handle file download
                                    }}
                                  >
                                    <RiFileDownloadLine className="h-4 w-4" />
                                    <span className="sr-only">Download</span>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : test.status === "failed" ? (
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-1.5">
                        <RiErrorWarningLine className="h-4 w-4" />
                        Test Failed
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {testData?.error || "The test failed to complete. See error details in the Overview tab."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <p>No results available</p>
                        {(test.status === "queued" || test.status === "running" || !test.status) && (
                          <p className="mt-1 text-xs">Results will be available once the test completes</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </DrawerBody>

          <DrawerFooter className="flex justify-between border-t px-6 py-4">
            <div>
              {test.status === "completed" && (
                <Button
                  variant="outline"
                  onClick={downloadResults}
                  className="flex items-center gap-1.5"
                >
                  <RiFileDownloadLine className="h-4 w-4" />
                  Download Results
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  className="flex items-center gap-1.5 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                  onClick={() => {
                    onOpenChange(false);
                    onDeleteTest(test.id);
                  }}
                >
                  <RiDeleteBin5Line className="h-4 w-4" />
                  Delete Test
                </Button>
              )}

              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                disabled={test.status === "running"}
                onClick={() => {
                  onOpenChange(false);
                  onRerunTest(test.id);
                }}
              >
                <RiPlayLine className="h-4 w-4" />
                {test.status === "running" ? "Running..." : "Rerun Test"}
              </Button>
            </div>
          </DrawerFooter>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}