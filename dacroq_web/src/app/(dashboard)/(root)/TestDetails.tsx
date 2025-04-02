'use client';

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryBar } from "@/components/CategoryBar";
import { Divider } from "@/components/Divider";
import { RiArrowLeftLine, RiDownloadLine, RiFileTextLine, RiHardDriveLine, RiTimeLine } from "@remixicon/react";
import { format } from "date-fns";
import { useState } from "react";

interface TestRun {
    id: string;
    name: string;
    chipType: string;
    status: string;
    created: any;
    completed?: any;
    runtime?: number;
    results?: {
        successRate?: number;
        solutionCount?: number;
        evidence?: string;
        inputFiles?: string[];
        outputFiles?: string[];
        quiccConfig?: string;
        powerUsage?: {
            median: number;
            mean: number;
            stdDev: number;
            min: number;
            max: number;
        };
        resourceUsage?: {
            cpu: number[];
            memory: number[];
            gpu: number[];
        };
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

interface TestDetailsProps {
    test: TestRun;
    onBack: () => void;
    performanceData: any[];
    utilizationData: any[];
    runtimeData: any[];
    aggregatedData: any[];
    usageSummary: any[];
    resourceData: any[];
}

export default function TestDetails({
                                        test,
                                        onBack,
                                        performanceData,
                                        utilizationData,
                                        runtimeData,
                                        aggregatedData,
                                        usageSummary,
                                        resourceData,
                                    }: TestDetailsProps) {
    const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'gpu'>('cpu');

    const formatDate = (dateValue: any) => {
        if (!dateValue) return "";
        const date = dateValue?.seconds ? new Date(dateValue.seconds * 1000) : new Date(dateValue);
        return format(date, "MMM d, yyyy 'at' h:mm a");
    };

    const formatRuntime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    const handleDownload = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    return (
      <main className="p-6">
          <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                  <h1 className="text-2xl font-semibold text-gray-900">
                      {test.name}
                  </h1>
                  <p className="text-sm text-gray-500">
                      Created {formatDate(test.created)} by {test.createdBy?.displayName || test.createdBy?.name || "Unknown"}
                  </p>
              </div>
              <Button
                onClick={onBack}
                variant="ghost"
                className="flex items-center gap-2 text-sm"
              >
                  <RiArrowLeftLine className="size-4" />
                  Back to Dashboard
              </Button>
          </div>

          <Divider />

          <div className="space-y-6 mt-6">
              <Card className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                          <p className="text-sm text-gray-500">Status</p>
                          <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium mt-1
                ${test.status === "completed" ? "bg-green-500/10 text-green-500" :
                            test.status.includes("running") ? "bg-blue-500/10 text-blue-500" :
                              test.status === "failed" ? "bg-red-500/10 text-red-500" :
                                "bg-gray-500/10 text-gray-500"}`}>
                              {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                          </div>
                      </div>
                      <div>
                          <p className="text-sm text-gray-500">Hardware Type</p>
                          <p className="text-sm font-medium mt-1 flex items-center gap-1">
                              <RiHardDriveLine className="size-4" />
                              {test.chipType}
                          </p>
                      </div>
                      <div>
                          <p className="text-sm text-gray-500">Runtime</p>
                          <p className="text-sm font-medium mt-1 flex items-center gap-1">
                              <RiTimeLine className="size-4" />
                              {test.runtime ? formatRuntime(test.runtime) : "N/A"}
                          </p>
                      </div>
                      <div>
                          <p className="text-sm text-gray-500">Created</p>
                          <p className="text-sm font-medium mt-1">{formatDate(test.created)}</p>
                      </div>
                  </div>
              </Card>

              <Card className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Input Files</h2>
                  <div className="space-y-4">
                      {test.results?.inputFiles && test.results.inputFiles.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {test.results.inputFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                      <RiFileTextLine className="size-4 text-gray-400" />
                                      <span className="text-sm font-medium">{file}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    className="text-blue-500 hover:text-blue-700 p-2"
                                    onClick={() => handleDownload(file, `input_${index + 1}.dimacs`)}
                                  >
                                      <RiDownloadLine className="size-4" />
                                  </Button>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No input files available</p>
                      )}
                  </div>
              </Card>

              {test.results ? (
                <Card className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Test Results</h2>
                    <div className="space-y-6">
                        {test.results.successRate !== undefined && (
                          <div>
                              <p className="text-sm text-gray-500 mb-2">Success Rate</p>
                              <div className="space-y-2">
                                  <CategoryBar
                                    values={[test.results.successRate, 100 - test.results.successRate]}
                                    colors={["emerald", "lightGray"]}
                                    showLabels={false}
                                  />
                                  <p className="text-sm font-medium">
                                      {test.results.successRate.toFixed(1)}% of problems solved successfully
                                  </p>
                              </div>
                          </div>
                        )}

                        {test.results.outputFiles && test.results.outputFiles.length > 0 ? (
                          <div>
                              <p className="text-sm text-gray-500 mb-2">Output Files</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {test.results.outputFiles.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <RiFileTextLine className="size-4 text-gray-400" />
                                            <span className="text-sm font-medium">{file}</span>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          className="text-blue-500 hover:text-blue-700 p-2"
                                          onClick={() => handleDownload(file, `output_${index + 1}.dimacs`)}
                                        >
                                            <RiDownloadLine className="size-4" />
                                        </Button>
                                    </div>
                                  ))}
                              </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No output files available</p>
                        )}

                        {test.results.quiccConfig ? (
                          <div>
                              <p className="text-sm text-gray-500 mb-2">QUICC Configuration</p>
                              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                      <RiFileTextLine className="size-4 text-gray-400" />
                                      <span className="text-sm font-medium">quicc.config.json</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    className="text-blue-500 hover:text-blue-700 p-2"
                                    onClick={() =>
                                      test.results?.quiccConfig && handleDownload(test.results.quiccConfig, "quicc.config.json")
                                    }
                                  >
                                      <RiDownloadLine className="size-4" />
                                  </Button>
                              </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No test results available</p>
                        )}
                    </div>
                </Card>
              ) : (
                <Card className="p-6">
                    <p className="text-sm text-gray-500">Test results have not been reported yet.</p>
                </Card>
              )}
          </div>
      </main>
    );
}
