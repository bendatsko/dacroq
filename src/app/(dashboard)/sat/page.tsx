"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import {
  RiLoader4Line,
  RiCheckLine,
  RiDownloadLine,
  RiFlaskLine,
  RiRocketLine,
  RiDownload2Line,
  RiSettings4Line,
  RiUploadLine,
  RiFileUploadLine,
  RiCloseLine
} from "@remixicon/react";
import { saveAs } from "file-saver";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import JSZip from 'jszip';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || "/api";

// Types for Presets from the backend
interface PresetTestSet {
  id: string;
  name: string;
  description: string;
  category: string;
  problemCount: number;
}

interface PresetProblem {
  problem: {
    id: string;
    name: string;
    source: string;
    category: string;
    variables: number;
    clauses: number;
    tags?: string[];
  };
  results: {
    status: string;
    time_ms: number;
    solution?: string;
    error?: string;
  };
}

// Type for Solver
interface Solver {
  id: string;
  name: string;
  disabled?: boolean;
}

// List of SAT solvers
const SOLVERS: Solver[] = [
    {
        id: "minisat",
        name: "MiniSAT"
    },
    {
        id: "walksat",
        name: "WalkSAT"
    }
];

// Type alias for SATBenchmark to match PresetProblem interface
type SATBenchmark = PresetProblem;

const solverOptions = [
  { id: 'simulator', name: 'Digital SOTA' },
  { id: 'ksat', name: 'kSAT Hardware' },
  { id: 'daedalus', name: 'DAEDALUS', disabled: true }
];

export default function SATSolverPage() {
  const [presetList, setPresetList] = useState<PresetTestSet[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [presetProblems, setPresetProblems] = useState<PresetProblem[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [isLoadingPresetProblems, setIsLoadingPresetProblems] = useState(false);
  const [isSolvingPreset, setIsSolvingPreset] = useState(false);
  const [presetRunResults, setPresetRunResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'problems' | 'results'>('problems');
  const [problemsLoaded, setProblemsLoaded] = useState(false);
  
  // State for file uploads
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New state for solver selection and problem limit
  const [selectedSolver, setSelectedSolver] = useState<string>("simulator");
  const [problemLimit, setProblemLimit] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // On mount, fetch available preset test sets from the backend.
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        setIsLoadingPresets(true);
        const res = await fetch(`${API_BASE_URL}${API_PREFIX}/presets`);
        if (!res.ok) throw new Error("Failed to fetch presets");
        const data = await res.json();
        setPresetList(data);
      } catch (err) {
        console.error("Error fetching presets:", err);
      } finally {
        setIsLoadingPresets(false);
      }
    };
    fetchPresets();
  }, []);

  // Function to load problems for the selected preset.
  const loadPresetProblems = async () => {
    if (!selectedPreset) return;
    try {
      setIsLoadingPresetProblems(true);
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/presets/${selectedPreset}/`);
      if (!res.ok) throw new Error("Failed to fetch preset problems");
      const data = await res.json();
      setPresetProblems(data);
      setActiveTab('problems');
      setProblemsLoaded(true);
    } catch (err) {
      console.error("Error loading preset problems:", err);
      setPresetProblems([]); 
    } finally {
      setIsLoadingPresetProblems(false);
    }
  };

  // Handler for the preset form submit event.
  const handlePresetSubmit = (e: FormEvent) => {
    e.preventDefault();
    loadPresetProblems();
  };

  // Function to run the entire selected preset test set.
  const runPresetTest = async () => {
    if (!selectedPreset) return;
    setIsSolvingPreset(true);
    setPresetRunResults(null);

    const formData = new FormData();
    formData.append("presetId", selectedPreset);
    formData.append("solverType", selectedSolver === 'ksat' ? 'ksat' : 'preset_run');
    formData.append("mode", "batch");
    formData.append("solver", selectedSolver);
    
    // Only send problemLimit if it's greater than 0
    if (problemLimit > 0) {
      formData.append("problemLimit", problemLimit.toString());
    }

    try {
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/solve`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Preset run failed: ${errText}`);
      }
      const data = await res.json();
      setPresetRunResults(data);
      
      // Save results to Firestore for dashboard display
      await saveSATResultsToFirestore(data, selectedPreset, selectedSolver);
      
      setActiveTab('results');
    } catch (err) {
      console.error("Preset run error:", err);
      setPresetRunResults({ error: err instanceof Error ? err.message : "Preset run failed" });
    } finally {
      setIsSolvingPreset(false);
    }
  };

  // Function to download results as JSON
  const downloadResults = () => {
    if (!presetRunResults) return;
    
    const fileName = `${presetList.find(p => p.id === selectedPreset)?.name || 'preset'}_results.json`;
    const blob = new Blob([JSON.stringify(presetRunResults, null, 2)], {
      type: "application/json",
    });
    saveAs(blob, fileName);
  };

  // Calculate actual number of problems that will be processed
  const getEffectiveProblemCount = () => {
    const totalCount = presetProblems.length;
    if (problemLimit <= 0 || problemLimit >= totalCount) {
      return totalCount;
    }
    return problemLimit;
  };

  // Update the problem counts after preset details have been loaded
  useEffect(() => {
    if (selectedPreset && presetProblems.length > 0) {
      loadPresetProblems();
    }
  }, [selectedPreset]);

  // Save SAT problem results to Firestore
  const saveSATResultsToFirestore = async (
    results: any, 
    source: string, 
    solver: string
  ) => {
    try {
      // Handle both result formats (array or object with overview)
      if (Array.isArray(results)) {
        // For array format (convert.py format)
        for (const benchmark of results) {
          await addDoc(collection(db, "sat_problems"), {
            problemId: benchmark.metadata?.problem_id || `Problem ${benchmark.instance_idx}`,
            source: benchmark.metadata?.source || source,
            variables: benchmark.metadata?.vars || 0,
            clauses: benchmark.metadata?.clauses || 0,
            solver: benchmark.solver || solver,
            solved: benchmark.runs_solved > 0,
            timeSeconds: benchmark.metadata?.tts || "timeout",
            timeMicroseconds: benchmark.metadata?.tts && benchmark.metadata.tts !== "inf" 
              ? parseFloat(benchmark.metadata.tts) * 1000000 
              : null,
            energyJoules: benchmark.hardware_energy_joules && benchmark.hardware_energy_joules[0] !== "inf"
              ? parseFloat(benchmark.hardware_energy_joules[0])
              : null,
            timestamp: new Date()
          });
        }
      } else if (results.results) {
        // For standard format with overview
        for (const benchmark of results.results) {
          await addDoc(collection(db, "sat_problems"), {
            problemId: benchmark.problem.id,
            source: benchmark.problem.source,
            variables: benchmark.problem.variables,
            clauses: benchmark.problem.clauses,
            solver: results.overview?.solver_name || solver,
            solved: benchmark.results.status === "solved",
            timeSeconds: benchmark.results.time_ms / 1000,
            timeMicroseconds: benchmark.results.time_ms * 1000,
            energyJoules: (benchmark.results.solver_cycles * parseFloat(results.overview?.cycle_us || "0.1") * 1e-6) * 
                          (parseFloat(results.overview?.avg_power_mw || "0") / 1000),
            timestamp: new Date()
          });
        }
      }
      console.log("SAT results saved to Firestore");
    } catch (error) {
      console.error("Error saving SAT results to Firestore:", error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFile(e.target.files[0]);
      setUploadResults(null); // Reset previous results
    }
  };

  // Validate CNF content
  const validateCNFContent = (content: string): { valid: boolean; message?: string } => {
    // Check if content is empty
    if (!content.trim()) {
      return { valid: false, message: "The file is empty" };
    }

    // Check for CNF header (p cnf VARS CLAUSES)
    const headerRegex = /p\s+cnf\s+\d+\s+\d+/i;
    if (!headerRegex.test(content)) {
      return { 
        valid: false, 
        message: "Missing CNF header. File must contain a line starting with 'p cnf' followed by the number of variables and clauses."
      };
    }

    // Check if there are actual clauses after the header
    const lines = content.split('\n').filter(line => {
      // Remove comments and empty lines
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('c') && !trimmed.startsWith('p');
    });
    
    if (lines.length === 0) {
      return { 
        valid: false, 
        message: "No clauses found in the file after the CNF header."
      };
    }

    return { valid: true };
  };

  // Clear selected file
  const handleClearFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generate and download a sample CNF file
  const generateSampleCNF = () => {
    const sampleCNF = `c This is a sample CNF file in DIMACS format
c Lines starting with 'c' are comments
c 
c The problem line below specifies:
c 'p cnf' - this is a CNF format file
c '3' - there are 3 variables (numbered 1,2,3)
c '2' - there are 2 clauses
p cnf 3 2
c 
c Each of the following lines represents a clause
c Each number represents a variable (positive) or its negation (negative)
c Each clause ends with '0'
c 
c This clause (x1 OR !x2 OR x3) means "either x1 is true, OR x2 is false, OR x3 is true"
1 -2 3 0
c This clause (!x1 OR !x3) means "either x1 is false OR x3 is false"
-1 -3 0
`;
    
    const blob = new Blob([sampleCNF], { type: "text/plain" });
    saveAs(blob, "sample.cnf");
  };

  // Upload and solve the selected file
  const handleFileUpload = async () => {
    if (!uploadedFile) return;
    
    setIsFileUploading(true);
    setUploadResults(null);
    
    try {
      // Check if it's a ZIP file
      if (uploadedFile.name.toLowerCase().endsWith('.zip')) {
        // Process ZIP file
        const zipResults = await processZipFile(uploadedFile);
        setUploadResults(zipResults);
        setIsFileUploading(false);
        return;
      }
      
      // For CNF files, continue with the existing logic
      if (uploadedFile.name.toLowerCase().endsWith('.cnf')) {
        const fileContent = await uploadedFile.text();
        const validation = validateCNFContent(fileContent);
        
        if (!validation.valid) {
          setUploadResults({ 
            error: `Invalid CNF file: ${validation.message}`, 
            helpText: "A valid CNF file must contain a header line 'p cnf VARS CLAUSES' followed by the clauses. Each clause is a space-separated list of integers ending with 0." 
          });
          setIsFileUploading(false);
          return;
        }
      }
      
      console.log("Uploading file:", uploadedFile.name, "Size:", uploadedFile.size, "Type:", uploadedFile.type);
      
      const formData = new FormData();
      // The backend expects the file with field name "cnfFile"
      formData.append("cnfFile", uploadedFile);
      formData.append("solver", selectedSolver);
      
      console.log("Sending request to:", `${API_BASE_URL}${API_PREFIX}/solve`);
      
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/solve`, {
        method: "POST",
        body: formData,
      });
      
      console.log("Response status:", res.status, res.statusText);
      
      if (!res.ok) {
        const errText = await res.text();
        console.error("Server error response:", errText);
        
        // Provide a helpful message based on the error
        let helpText = "";
        if (errText.includes("CNF header not found")) {
          helpText = "Make sure your file follows the DIMACS CNF format with a header line 'p cnf VARS CLAUSES' where VARS is the number of variables and CLAUSES is the number of clauses.";
        } else if (errText.includes("invalid variable count") || errText.includes("invalid clause count")) {
          helpText = "The CNF header must contain valid numbers for variables and clauses.";
        }
        
        throw new Error(`File solving failed: ${errText}`);
      }
      
      const data = await res.json();
      console.log("Received data:", data);
      setUploadResults(data);
      
      // Save results to Firestore
      await saveSATResultsToFirestore(data, "User Upload", selectedSolver);
      
    } catch (err) {
      console.error("File upload error:", err);
      setUploadResults({ 
        error: err instanceof Error ? err.message : "File upload failed",
        helpText: err instanceof Error && err.message.includes("CNF header not found") 
          ? "A valid CNF file must contain a header line 'p cnf VARS CLAUSES' followed by the clauses. Each clause is a space-separated list of integers ending with 0."
          : undefined
      });
    } finally {
      setIsFileUploading(false);
    }
  };

  // Process a ZIP file containing CNF files
  const processZipFile = async (zipFile: File) => {
    try {
      // Load the ZIP file
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipFile);
      
      // Find all CNF files in the ZIP
      const cnfFiles: {name: string, content: string}[] = [];
      const filePromises: Promise<void>[] = [];
      
      zipContent.forEach((relativePath, file) => {
        if (!file.dir && relativePath.toLowerCase().endsWith('.cnf')) {
          const promise = file.async('string').then(content => {
            cnfFiles.push({
              name: relativePath,
              content
            });
          });
          filePromises.push(promise);
        }
      });
      
      // Wait for all file contents to be extracted
      await Promise.all(filePromises);
      
      // Check if we found any CNF files
      if (cnfFiles.length === 0) {
        return {
          error: "No CNF files found in the ZIP archive",
          helpText: "Please ensure your ZIP file contains at least one valid .cnf file."
        };
      }
      
      console.log(`Found ${cnfFiles.length} CNF files in the ZIP archive`);
      
      // Validate each CNF file
      const validCnfFiles = cnfFiles.filter(file => {
        const validation = validateCNFContent(file.content);
        return validation.valid;
      });
      
      if (validCnfFiles.length === 0) {
        return {
          error: "No valid CNF files found in the ZIP archive",
          helpText: "All .cnf files in the archive were invalid. Each CNF file must contain a header line 'p cnf VARS CLAUSES' followed by the clauses."
        };
      }
      
      // Process all valid CNF files to create a results structure similar to presets
      const satBenchmarks: SATBenchmark[] = [];
      const processPromises = validCnfFiles.map(async (file) => {
        try {
          // Parse CNF header to get variables and clauses
          const headerMatch = file.content.match(/p\s+cnf\s+(\d+)\s+(\d+)/i);
          if (!headerMatch) return null;
          
          const vars = parseInt(headerMatch[1]);
          const clauses = parseInt(headerMatch[2]);
          
          // Create a file object from the CNF content
          const cnfBlob = new Blob([file.content], { type: 'text/plain' });
          const cnfFile = new File([cnfBlob], file.name.split('/').pop() || 'problem.cnf', { type: 'text/plain' });
          
          // Create form data for the request
          const formData = new FormData();
          formData.append("cnfFile", cnfFile);
          formData.append("solver", selectedSolver);
          
          // Send the request to the server
          const res = await fetch(`${API_BASE_URL}${API_PREFIX}/solve`, {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) {
            console.error(`Solver failed for ${file.name}: ${await res.text()}`);
            return null;
          }
          
          const data = await res.json();
          return data.results[0]; // Return the benchmark result
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err);
          return null;
        }
      });
      
      // Use Promise.allSettled to process all files even if some fail
      const results = await Promise.allSettled(processPromises);
      
      // Collect successful results
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<SATBenchmark> => 
          result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
      
      if (successfulResults.length === 0) {
        return {
          error: "Failed to process any files in the ZIP archive",
          helpText: "All files in the archive could not be processed. Please check the file format and try again."
        };
      }
      
      // Create a combined result similar to the preset structure
      const totalProblems = successfulResults.length;
      const solvedProblems = successfulResults.filter(r => r.results.status === "solved").length;
      
      // Calculate averages
      let totalCycles = 0;
      let totalPower = 0;
      
      successfulResults.forEach(result => {
        // Estimate cycles based on time
        const timeMs = result.results.time_ms || 0;
        const vars = result.problem.variables || 0;
        const clauses = result.problem.clauses || 0;
        const complexityFactor = (vars * clauses) / 1000.0;
        const cycles = Math.floor((timeMs * 1000000.0 / 100.0) * Math.sqrt(complexityFactor));
        const power = 1.5 + (cycles / 50000.0);
        
        totalCycles += cycles;
        totalPower += power;
      });
      
      const avgCycles = totalProblems > 0 ? Math.floor(totalCycles / totalProblems) : 0;
      const avgPower = totalProblems > 0 ? totalPower / totalProblems : 0;
      
      // Create the final result structure
      const zipResults = {
        overview: {
          total_problems: totalProblems,
          solved_problems: solvedProblems,
          unsolved_problems: totalProblems - solvedProblems,
          success_rate: `${((solvedProblems / totalProblems) * 100).toFixed(1)}%`,
          avg_cycles: avgCycles,
          avg_power_mw: avgPower.toFixed(2),
          solver_name: selectedSolver,
          hardware: ["CPU"],
          correction_coeff: 1.0,
          cycle_us: 0.1
        },
        results: successfulResults,
        zipInfo: {
          totalFiles: cnfFiles.length,
          validFiles: validCnfFiles.length,
          processedFiles: successfulResults.length
        },
        note: `Processed ${successfulResults.length} of ${validCnfFiles.length} valid CNF files from the ZIP archive.`
      };
      
      // Save results to Firestore
      await saveSATResultsToFirestore(zipResults, "ZIP Archive", selectedSolver);
      
      // Set the presetProblems and results for display
      setPresetProblems(successfulResults as PresetProblem[]);
      setPresetRunResults(zipResults);
      setProblemsLoaded(true); // Mark problems as loaded after ZIP processing
      
      return zipResults;
      
    } catch (err) {
      console.error("ZIP processing error:", err);
      return {
        error: err instanceof Error ? err.message : "Failed to process ZIP file",
        helpText: "There was an error extracting or processing the CNF files from your ZIP archive."
      };
    }
  };

  return (
    <main className="container max-w-5xl mx-auto p-6">
      {/* Header and Description */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3">
          SAT Solver
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Test Boolean satisfiability solvers with your own problems or predefined test sets.
          Upload a CNF file or select from available problem sets to evaluate solver performance.
        </p>
      </div>

      {/* Main Content Area */}
      <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 mb-8">
        <div className="bg-gray-100 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">
            Choose Your Problem Source
          </h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Panel: File Upload */}
            <div className="border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 pb-6 md:pb-0 md:pr-6">
              <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-4">
                <RiUploadLine className="size-5 text-gray-600 dark:text-gray-400" />
                Upload a File
              </h3>
              
              <div className="mb-4">
                <label
                  htmlFor="fileUpload"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Select CNF File or ZIP Archive
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="fileUpload"
                    accept=".cnf,.zip"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-medium
                      file:bg-gray-100 file:text-gray-700
                      dark:file:bg-gray-700 dark:file:text-gray-200
                      hover:file:bg-gray-200 dark:hover:file:bg-gray-600"
                  />
                  {uploadedFile && (
                    <button
                      onClick={handleClearFile}
                      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                      <RiCloseLine className="size-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                {uploadedFile ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <p>Upload a <span className="font-medium">DIMACS CNF format</span> file with a valid header:</p>
                    <div className="mt-1 p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded font-mono">
                      p cnf [num_variables] [num_clauses]
                    </div>
                    <div className="mt-1 flex items-center">
                      <button
                        onClick={generateSampleCNF}
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                      >
                        <span>Download example file</span>
                        <RiDownloadLine className="ml-1 size-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <Button
                onClick={handleFileUpload}
                className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                disabled={!uploadedFile || isFileUploading}
              >
                {isFileUploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RiLoader4Line className="animate-spin size-5" />
                    Solving...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <RiFileUploadLine className="size-4" />
                    {uploadedFile?.name.toLowerCase().endsWith('.zip') 
                      ? 'Process ZIP Archive' 
                      : 'Upload and Solve'}
                  </div>
                )}
              </Button>
              
              {uploadResults && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Results</h4>
                  {uploadResults.error ? (
                    <div className="space-y-3">
                      <div className="text-sm text-red-600 dark:text-red-400">
                        Error: {uploadResults.error}
                      </div>
                      {uploadResults.helpText && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-200">
                          <div className="font-medium mb-1">Help:</div>
                          <p>{uploadResults.helpText}</p>
                          <button
                            onClick={generateSampleCNF}
                            className="mt-2 inline-flex items-center text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
                          >
                            <span>See Example CNF File</span>
                            <RiDownloadLine className="ml-1 size-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Display ZIP file processing information if available */}
                      {uploadResults.note && (
                        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-200">
                          <p>{uploadResults.note}</p>
                          {uploadResults.zipInfo && (
                            <div className="mt-1 text-xs">
                              <span>Found {uploadResults.zipInfo.totalFiles} files ({uploadResults.zipInfo.validFiles} valid)</span>
                              <div className="mt-1">Processed: {uploadResults.zipInfo.processedFiles}</div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
                          <div className={`mt-1 text-sm font-medium ${
                            uploadResults.overview?.solved_problems > 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {uploadResults.overview?.solved_problems > 0 ? 'Solved' : 'Unsolved'}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Time</span>
                          <div className="mt-1 text-sm font-medium">{uploadResults.results?.[0]?.results?.time_ms || 0} ms</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Variables</span>
                          <div className="mt-1 text-sm font-medium">{uploadResults.results?.[0]?.problem?.variables || 0}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Clauses</span>
                          <div className="mt-1 text-sm font-medium">{uploadResults.results?.[0]?.problem?.clauses || 0}</div>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => {
                          const fileName = uploadedFile?.name.replace(/\.[^/.]+$/, "") || "sat_problem";
                          const blob = new Blob([JSON.stringify(uploadResults, null, 2)], {
                            type: "application/json",
                          });
                          saveAs(blob, `${fileName}_results.json`);
                        }}
                        variant="secondary"
                        className="mt-3 flex items-center gap-2 text-xs w-full"
                      >
                        <RiDownloadLine className="size-4" />
                        Download Full Results
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Right Panel: Problem Set Selection */}
            <div className="pt-6 md:pt-0 md:pl-6">
              <h3 className="text-md font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-4">
                <RiFlaskLine className="size-5 text-gray-600 dark:text-gray-400" />
                Select a Problem Set
              </h3>
              
              {isLoadingPresets ? (
                <div className="flex items-center justify-center py-8">
                  <RiLoader4Line className="animate-spin h-6 w-6 text-gray-500" />
                </div>
              ) : (
                <form onSubmit={handlePresetSubmit} className="space-y-4">
                  <select
                    id="presetSelect"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                    value={selectedPreset}
                    onChange={(e) => {
                      setSelectedPreset(e.target.value);
                      setProblemsLoaded(false); // Reset the loaded state when a new preset is selected
                      setPresetProblems([]); // Clear previous problems
                    }}
                  >
                    <option value="">-- Choose a preset --</option>
                    {presetList.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.problemCount} problems)
                      </option>
                    ))}
                  </select>
                  
                  {selectedPreset && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm mb-4">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                        {presetList.find(p => p.id === selectedPreset)?.name}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        {presetList.find(p => p.id === selectedPreset)?.description || 'No description available.'}
                      </p>
                      <div className="mt-2 flex items-center">
                        <span className="px-2 py-1 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-xs rounded-full">
                          {presetList.find(p => p.id === selectedPreset)?.category}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
                    disabled={!selectedPreset || isLoadingPresetProblems}
                  >
                    {isLoadingPresetProblems ? (
                      <div className="flex items-center justify-center gap-2">
                        <RiLoader4Line className="animate-spin h-5 w-5" />
                        Loading...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <RiDownload2Line className="size-4" />
                        Load Problems (Step 1)
                      </div>
                    )}
                  </Button>
                  
                  {presetProblems.length > 0 && (
                    <div className="mt-4">
                      <div>
                        <label
                          htmlFor="problemLimit"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Problem Limit (0 = All)
                        </label>
                        <input
                          id="problemLimit"
                          type="number"
                          min="0"
                          max={presetProblems.length}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                          value={problemLimit}
                          onChange={(e) => setProblemLimit(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Will solve {getEffectiveProblemCount()} of {presetProblems.length} problems
                        </p>
                      </div>
                      
                      <Button
                        onClick={runPresetTest}
                        className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 text-white mt-4"
                        disabled={isSolvingPreset || !problemsLoaded}
                      >
                        {isSolvingPreset ? (
                          <div className="flex items-center justify-center gap-2">
                            <RiLoader4Line className="animate-spin h-5 w-5" />
                            Running...
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <RiRocketLine className="size-4" />
                            Run Solver (Step 2)
                          </div>
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Common Solver Selection */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Solver Selection
            </h3>
            <div className="flex items-center gap-2">
              <label htmlFor="solverSelect" className="text-sm text-gray-600 dark:text-gray-400">
                Select Solver:
              </label>
              <select
                id="solverSelect"
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600"
                value={selectedSolver}
                onChange={(e) => setSelectedSolver(e.target.value)}
              >
                {solverOptions.map((solver) => (
                  <option key={solver.id} value={solver.id}>
                    {solver.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Problem Preview Area (only shown after a preset is loaded) */}
      {presetProblems.length > 0 && (
        <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 mb-8">
          <div className="bg-gray-100 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                Problem Set Preview
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('problems')}
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    activeTab === 'problems'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Problems ({presetProblems.length})
                </button>
                <button
                  onClick={() => setActiveTab('results')}
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    activeTab === 'results'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                  disabled={!presetRunResults}
                >
                  Results {presetRunResults && <RiCheckLine className="inline-block size-4 ml-1 text-gray-600 dark:text-gray-400" />}
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {activeTab === 'problems' && (
              <div className="overflow-y-auto max-h-[400px] pr-2">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {presetProblems.map((prob, idx) => (
                    <li key={idx} className="py-3">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-200">
                            {prob.problem.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Source: {prob.problem.source}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                            Variables: {prob.problem.variables}
                          </span>
                          <span className="px-2 py-1 bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 rounded-full">
                            Clauses: {prob.problem.clauses}
                          </span>
                          {prob.problem.tags?.map((tag, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {activeTab === 'results' && (
              <>
                {presetRunResults ? (
                  <div className="space-y-4">
                    {/* Download button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={downloadResults}
                        variant="secondary"
                        className="flex items-center gap-2 text-sm"
                      >
                        <RiDownloadLine className="size-4" />
                        Download Results
                      </Button>
                    </div>
                    
                    {/* Results summary */}
                    {(presetRunResults.overview || (Array.isArray(presetRunResults) && presetRunResults.length > 0)) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Standard format results */}
                        {presetRunResults.overview && (
                          <>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Total Problems</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {presetRunResults.overview.total_problems}
                              </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {presetRunResults.overview.success_rate}
                              </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Cycles</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {typeof presetRunResults.overview.avg_cycles === 'number' 
                                  ? presetRunResults.overview.avg_cycles.toLocaleString()
                                  : presetRunResults.overview.avg_cycles}
                              </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Power</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {presetRunResults.overview.avg_power_mw} mW
                              </div>
                            </div>
                          </>
                        )}
                        
                        {/* Convert.py format results */}
                        {Array.isArray(presetRunResults) && presetRunResults.length > 0 && (
                          <>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Total Problems</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {presetRunResults.length}
                              </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Solved Problems</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {presetRunResults.filter(b => b.runs_solved > 0).length}
                              </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {((presetRunResults.filter(b => b.runs_solved > 0).length / presetRunResults.length) * 100).toFixed(1)}%
                              </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Solver</div>
                              <div className="text-xl font-bold text-gray-800 dark:text-gray-200">
                                {presetRunResults[0]?.solver || selectedSolver}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Problem Results table */}
                    {Array.isArray(presetRunResults) && presetRunResults.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Problem Results</h4>
                        <div className="overflow-y-auto max-h-[200px]">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-100 dark:bg-gray-900">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Problem</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {presetRunResults.map((benchmark, i) => (
                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                    {benchmark.metadata?.problem_id || `Problem ${benchmark.instance_idx}`}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                      ${benchmark.runs_solved > 0 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                      {benchmark.runs_solved > 0 ? 'Solved' : 'Unsolved'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                    {benchmark.runs_solved > 0 
                                      ? (typeof benchmark.metadata?.tts === 'string' 
                                          ? parseFloat(benchmark.metadata.tts).toFixed(6) 
                                          : 'N/A') + ' s'
                                      : 'Timeout'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                    <p>Run the solver to see results</p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Loader while solving */}
      {isSolvingPreset && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 dark:border-blue-500 mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Running...</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                Solving {getEffectiveProblemCount()} problems with {SOLVERS.find(s => s.id === selectedSolver)?.name}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
