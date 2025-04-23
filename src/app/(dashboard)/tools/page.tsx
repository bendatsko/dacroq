"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Divider } from "@/components/Divider";
import { Textarea } from "@/components/ui/textarea";
import {
  RiUploadLine,
  RiFileLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiDownloadLine,
  RiCloseLine
} from "@remixicon/react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || "/api";

interface ConversionResult {
  batch?: string;
  submission_id?: string;
  submitter?: string;
  results?: any[];
  file_count?: number;
  overview?: {
    total_problems: number;
    solved_problems: number;
    unsolved_problems: number;
    success_rate: string;
    avg_cycles: number;
    avg_power_mw: string;
    solver_name: string;
    hardware: string[];
    correction_coeff: number;
    cycle_us: number;
  };
  benchmarks?: any[];
  // Local UI state:
  isExpanded?: boolean;
  isJsonExpanded?: boolean;
  original_filename?: string;
  filename?: string;
  [key: string]: any;
}

export default function ToolsPage() {
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [uploadedTypes, setUploadedTypes] = useState({
    emulationCsv: false,
    cnfFiles: false
  });

  useEffect(() => {
    if (isUploading) {
      setAllDone(false);
    }
  }, [isUploading]);

  // Helper function to check if a file is a CNF file
  const isCnfFile = (filename: string) => filename.toLowerCase().endsWith('.cnf');
  
  // Helper function to check ZIP contents
  const checkZipContents = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const hasCnfFiles = Object.keys(zip.files).some(filename => 
        !zip.files[filename].dir && isCnfFile(filename) &&
        !filename.startsWith('__MACOSX/') && 
        !filename.startsWith('.')
      );
      if (hasCnfFiles) {
        setUploadedTypes(prev => ({ ...prev, cnfFiles: true }));
      }
    } catch (err) {
      console.error('Error checking ZIP contents:', err);
    }
  };

  const uploadFiles = async (files: File[]) => {
    const formData = new FormData();
    formData.append("submitter", "anonymous");

    // Reset upload types when starting new upload
    setUploadedTypes({ emulationCsv: false, cnfFiles: false });

    // Check all files including ZIP contents
    for (const file of files) {
      formData.append("files", file);
      const ext = file.name.toLowerCase().split('.').pop() || '';
      
      if (ext === 'csv') {
        setUploadedTypes(prev => ({ ...prev, emulationCsv: true }));
      } else if (ext === 'cnf') {
        setUploadedTypes(prev => ({ ...prev, cnfFiles: true }));
      } else if (ext === 'zip') {
        await checkZipContents(file);
      }
    }

    try {
      setIsUploading(true);
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      const data = await res.json();
      const newResults = Array.isArray(data) ? data : [data];
      setResults((prev) => [...prev, ...newResults]);
      setError(null);
      setAllDone(true);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
      setAllDone(false);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter(
        (file) =>
          !file.name.startsWith(".") &&
          !file.name.startsWith("__MACOSX") &&
          !file.name.startsWith("._")
      );
      if (validFiles.length > 0) {
        uploadFiles(validFiles);
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".cnf"],
      "text/csv": [".csv"],
      "application/zip": [".zip"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  });

  const toggleExpanded = (index: number) => {
    setResults((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isExpanded: !item.isExpanded } : item
      )
    );
  };

  const getFileName = (item: ConversionResult, idx: number) => {
    // If we have an original filename, use it
    if (item.original_filename) {
      const baseName = item.original_filename.replace(/\.(csv|zip|cnf)$/, '');
      return `${baseName}_benchmark.json`;
    }
    
    // If we have a batch name, use it
    if (item.batch) {
      return `${item.batch}_benchmark.json`;
    }
    
    // Fallback to a generic name if no other information is available
    return `simulation_${idx + 1}_benchmark.json`;
  };

  const downloadFile = (item: ConversionResult, idx: number) => {
    const fileName = getFileName(item, idx);
    const blob = new Blob([JSON.stringify(item, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    results.forEach((item, idx) => {
      const fileName = getFileName(item, idx);
      zip.file(fileName, JSON.stringify(item, null, 2));
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "benchmark_results.zip");
  };

  const toggleJsonExpanded = (index: number) => {
    setResults((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isJsonExpanded: !item.isJsonExpanded } : item
      )
    );
  };

  // Render an overview extracted from the conversion result.
  const renderOverview = (item: ConversionResult) => {
    if (item.overview) {
      const overview = item.overview;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Problems</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {overview.total_problems}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {overview.success_rate}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Cycles</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {overview.avg_cycles.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Power</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {overview.avg_power_mw} mW
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium">Hardware:</span> {overview.hardware.join(", ")} |{" "}
            <span className="font-medium">Solver:</span> {overview.solver_name}
          </div>
        </div>
      );
    }
    if (item.file_count) {
      return (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Processed {item.file_count} problem{item.file_count === 1 ? "" : "s"}.
        </p>
      );
    }
    return <p className="text-sm text-gray-700 dark:text-gray-300">No overview available.</p>;
  };

  return (
    <main className="container max-w-4xl mx-auto p-4">
      {/* Header with Instructions */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Simulation Validation Tool
        </h1>
        <Card className="p-6">
          <div className="prose dark:prose-invert max-w-none">
            <h3 className="text-lg font-medium mb-4">Instructions</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>Upload your emulation CSV files containing simulation results
                <a href="#" className="text-blue-500 hover:text-blue-600 ml-1 text-sm">
                  (See example format)
                </a>
              </li>
              <li>Upload the CNF problem files (individually or in a ZIP archive)</li>
              <li>The tool will process your files and generate a validation report</li>
            </ol>
            
            {/* Upload Status Checklist */}
            <div className="mt-6 space-y-2">
              <h4 className="font-medium">Upload Checklist:</h4>
              <div className="flex items-center gap-2">
                {uploadedTypes.emulationCsv ? (
                  <RiCheckLine className="h-5 w-5 text-green-500" />
                ) : (
                  <RiCloseLine className="h-5 w-5 text-gray-400" />
                )}
                <span>Emulation CSV files</span>
              </div>
              <div className="flex items-center gap-2">
                {uploadedTypes.cnfFiles ? (
                  <RiCheckLine className="h-5 w-5 text-green-500" />
                ) : (
                  <RiCloseLine className="h-5 w-5 text-gray-400" />
                )}
                <span>CNF problem files (direct or in ZIP)</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Upload Area */}
      <Card className="relative mb-4">
        {isUploading && (
          <div className="absolute inset-0 bg-white/75 dark:bg-gray-900/75 flex flex-col items-center justify-center z-10 rounded-lg">
            <RiLoader4Line className="animate-spin text-blue-500 h-8 w-8 mb-2" />
            <p className="text-gray-900 dark:text-gray-100 font-medium">Processing files...</p>
            <div className="w-48 h-1 mt-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-progress"></div>
            </div>
          </div>
        )}
        <div
          {...getRootProps({
            className: `cursor-pointer p-8 text-center ${
              isDragActive ? "bg-blue-50 dark:bg-blue-900/10" : ""
            }`,
          })}
        >
          <input {...getInputProps()} disabled={isUploading} />
          <RiUploadLine className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
          <p className="mt-2 text-gray-900 dark:text-gray-100">
            {isDragActive
              ? "Drop files here..."
              : isUploading
              ? "Processing..."
              : "Drag and drop files here or click to select"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload CSV files and CNF files (or ZIP containing CNF files) - max size: 50MB per file
          </p>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 rounded-r-lg">
          <div className="flex items-center">
            <RiErrorWarningLine className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {allDone && !error && results.length > 0 && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500 rounded-r-lg">
          <div className="flex items-center">
            <RiCheckLine className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-green-700 dark:text-green-400">
              All conversions have finished. You may download or review the results below.
            </p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <Card className="mb-4">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Conversion Files
              </h2>
              <Button onClick={downloadAllAsZip} className="flex items-center gap-2">
                <RiDownloadLine className="size-4" />
                Download All as ZIP
              </Button>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((item, idx) => {
              const fileName = getFileName(item, idx);
              return (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <RiFileLine className="h-5 w-5 text-gray-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {fileName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => downloadFile(item, idx)}
                        className="flex items-center gap-2"
                      >
                        <RiDownloadLine className="size-4" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => toggleExpanded(idx)}
                        className="flex items-center gap-2"
                      >
                        {item.isExpanded ? (
                          <RiArrowDownSLine className="size-4" />
                        ) : (
                          <RiArrowRightSLine className="size-4" />
                        )}
                        {item.isExpanded ? "Hide Details" : "View Details"}
                      </Button>
                    </div>
                  </div>
                  {item.isExpanded && (
                    <div className="mt-4 pl-10">
                      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        {renderOverview(item)}
                        <div className="mt-4">
                          <Button
                            variant="ghost"
                            onClick={() => toggleJsonExpanded(idx)}
                            className="flex items-center gap-2 text-sm"
                          >
                            {item.isJsonExpanded ? (
                              <RiArrowDownSLine className="size-4" />
                            ) : (
                              <RiArrowRightSLine className="size-4" />
                            )}
                            {item.isJsonExpanded ? "Hide JSON" : "View JSON"}
                          </Button>
                          {item.isJsonExpanded && (
                            <>
                              <Divider className="my-3" />
                              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                                {JSON.stringify(item.benchmarks || item, null, 2)}
                              </pre>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </main>
  );
}

// Add this to your global CSS or as a style tag
const styles = `
@keyframes progress {
  0% { width: 0% }
  100% { width: 100% }
}

.animate-progress {
  animation: progress 2s infinite linear;
}
`;
