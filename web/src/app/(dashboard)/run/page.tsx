"use client";

import { useState, useEffect } from "react";
import { 
  RiPlayCircleLine, 
  RiFileList3Line, 
  RiCheckLine,
  RiCloseLine,
  RiInformationLine,
  RiFileUploadLine,
  RiHistoryLine
} from "@remixicon/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/Checkbox";

const chipTypeOptions = [
  { value: "3SAT", label: "3SAT", description: "Standard 3-SAT solver chip" },
  { value: "KSAT", label: "KSAT", description: "Advanced K-SAT solver with variable clause width" },
  { value: "LDPC", label: "LDPC", description: "Low-Density Parity-Check decoder" },
];

// Preset library
const presetLibrary = {
  "3SAT": [
    { id: "3sat-small", name: "Small random 3-SAT (100 variables, 400 clauses)", description: "Good for testing basic functionality" },
    { id: "3sat-medium", name: "Medium random 3-SAT (500 variables, 2100 clauses)", description: "Balance of complexity and solve time" },
    { id: "3sat-large", name: "Large random 3-SAT (2000 variables, 8500 clauses)", description: "For performance benchmarking" },
    { id: "3sat-hard", name: "Hard 3-SAT (ratio 4.25)", description: "Difficult instances at phase transition ratio" },
  ],
  "KSAT": [
    { id: "ksat-4sat", name: "4-SAT (500 variables)", description: "Standard K=4 SAT problem" },
    { id: "ksat-5sat", name: "5-SAT (300 variables)", description: "Standard K=5 SAT problem" },
    { id: "ksat-mixed", name: "Mixed K-SAT (variable K)", description: "Clauses with different widths" },
  ],
  "LDPC": [
    { id: "ldpc-small", name: "Small LDPC (512 bits, rate 1/2)", description: "Small LDPC code" },
    { id: "ldpc-medium", name: "Medium LDPC (1024 bits, rate 1/2)", description: "Standard LDPC benchmark" },
    { id: "ldpc-large", name: "Large LDPC (4096 bits, rate 5/6)", description: "High-rate LDPC code for throughput testing" },
  ]
};

export default function RunTest() {
  // State for the form
  const [testName, setTestName] = useState("");
  const [chipType, setChipType] = useState("3SAT");
  const [uploadMethod, setUploadMethod] = useState("preset"); // "preset", "upload", or "library"
  const [selectedPreset, setSelectedPreset] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [libraryFiles, setLibraryFiles] = useState<Array<{ id: string, name: string, date: string }>>([]);
  const [selectedLibraryFile, setSelectedLibraryFile] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [useParallel, setUseParallel] = useState(true);
  
  // Load previously uploaded files
  useEffect(() => {
    // Simulating API call to get user's uploaded CNF files
    // In a real application, this would be an API call to your backend
    const timer = window.setTimeout(() => {
      setLibraryFiles([
        { id: "file1", name: "recent_problem.cnf", date: "2025-05-01" },
        { id: "file2", name: "complex_circuit.cnf", date: "2025-04-28" },
        { id: "file3", name: "large_instance.cnf", date: "2025-04-15" },
      ]);
    }, 500);
    
    return () => window.clearTimeout(timer);
  }, []);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      toast({
        title: "Files added",
        description: `${newFiles.length} file(s) added successfully.`,
      });
    }
  };

  // Remove a file from the upload list
  const removeFile = (index: number) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!testName) {
      toast({
        title: "Test name required",
        description: "Please enter a name for your test.",
        variant: "destructive",
      });
      return;
    }

    if (uploadMethod === "preset" && !selectedPreset) {
      toast({
        title: "No preset selected",
        description: "Please select a preset problem.",
        variant: "destructive",
      });
      return;
    } else if (uploadMethod === "upload" && uploadedFiles.length === 0) {
      toast({
        title: "No files uploaded",
        description: "Please upload at least one CNF file.",
        variant: "destructive",
      });
      return;
    } else if (uploadMethod === "library" && !selectedLibraryFile) {
      toast({
        title: "No library file selected",
        description: "Please select a file from your library.",
        variant: "destructive",
      });
      return;
    }

    // Begin test run
    setIsRunning(true);
    
    try {
      // In a real application, this would be a FormData upload to your API
      // For now, we'll simulate an API call with a timeout
      const testConfig = {
        testName,
        chipType,
        inputSource: uploadMethod,
        sourceId: uploadMethod === "preset" ? selectedPreset : 
                 uploadMethod === "library" ? selectedLibraryFile : "uploaded",
        useParallel
      };
      
      console.log("Starting test with config:", testConfig);
      
      // Simulate API delay
      await new Promise<void>(resolve => {
        window.setTimeout(() => resolve(), 2000);
      });
      
      // Success!
      toast({
        title: "Test started",
        description: "Your hardware test has been successfully started.",
      });
      
      // Redirect to test history or status page
      window.location.href = "/history";
    } catch (error) {
      console.error("Error starting test:", error);
      toast({
        title: "Error",
        description: "Failed to start test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Run Hardware Test</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure and run tests on hardware accelerators for SAT solving and LDPC decoding
            </p>
          </div>
          <div>
            <Link href="/history">
              <Button 
                variant="outline" 
                className="flex items-center gap-1.5"
              >
                <RiHistoryLine className="h-4 w-4" />
                View Test History
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Test Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Test Configuration</h2>
          
          <div className="grid gap-6 mb-6 md:grid-cols-2">
            <div>
              <Label htmlFor="test-name">Test Name</Label>
              <Input
                id="test-name"
                type="text"
                placeholder="E.g., Circuit verification test"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="chip-type">Chip Type</Label>
              <Select value={chipType} onValueChange={setChipType}>
                <SelectTrigger id="chip-type" className="mt-1">
                  <SelectValue placeholder="Select chip type" />
                </SelectTrigger>
                <SelectContent>
                  {chipTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2 mt-7">
              <Checkbox 
                id="parallel-execution" 
                checked={useParallel}
                onCheckedChange={(checked) => setUseParallel(checked as boolean)}
              />
              <Label htmlFor="parallel-execution" className="cursor-pointer">
                Use parallel execution
              </Label>
              <div className="tooltip relative group">
                <RiInformationLine className="h-4 w-4 text-gray-400" />
                <div className="tooltip-content invisible group-hover:visible absolute bg-black text-white text-xs rounded py-1 px-2 -mt-1 ml-1 w-48">
                  Enable parallel execution across multiple processing units for faster results
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Step 2: Problem Input */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Problem Input</h2>
          
          <Tabs defaultValue="preset" onValueChange={(value) => setUploadMethod(value)}>
            <TabsList className="mb-4 bg-gray-100 dark:bg-gray-700">
              <TabsTrigger value="preset">Preset Problems</TabsTrigger>
              <TabsTrigger value="upload">Upload Files</TabsTrigger>
              <TabsTrigger value="library">My Library</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preset">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select from our library of preset problems optimized for the {chipType} chip.
                </p>
                
                <div className="grid gap-3 mt-2">
                  {presetLibrary[chipType as keyof typeof presetLibrary]?.map((preset) => (
                    <div 
                      key={preset.id}
                      className={cn(
                        "p-3 border rounded-md cursor-pointer transition-colors",
                        selectedPreset === preset.id 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                      onClick={() => setSelectedPreset(preset.id)}
                    >
                      <div className="flex items-start">
                        <div className={cn(
                          "h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5",
                          selectedPreset === preset.id 
                            ? "border-blue-500 bg-blue-500" 
                            : "border-gray-300 dark:border-gray-600"
                        )}>
                          {selectedPreset === preset.id && (
                            <RiCheckLine className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{preset.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{preset.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="upload">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Upload your own CNF files for running on the hardware accelerator.
                </p>
                
                <div className="mt-2">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      accept=".cnf,.dimacs,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700"
                    >
                      <RiFileUploadLine className="mr-2 h-5 w-5" />
                      Select Files
                    </label>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Drag and drop files here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Supports .CNF, .DIMACS, and .TXT files
                    </p>
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Uploaded Files</h4>
                      <div className="space-y-2">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center">
                              <RiFileList3Line className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-sm truncate max-w-xs">{file.name}</span>
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                            >
                              <RiCloseLine className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="library">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select from your previously uploaded CNF files.
                </p>
                
                <div className="grid gap-3 mt-2">
                  {libraryFiles.map((file) => (
                    <div 
                      key={file.id}
                      className={cn(
                        "p-3 border rounded-md cursor-pointer transition-colors",
                        selectedLibraryFile === file.id 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                      onClick={() => setSelectedLibraryFile(file.id)}
                    >
                      <div className="flex items-start">
                        <div className={cn(
                          "h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5",
                          selectedLibraryFile === file.id 
                            ? "border-blue-500 bg-blue-500" 
                            : "border-gray-300 dark:border-gray-600"
                        )}>
                          {selectedLibraryFile === file.id && (
                            <RiCheckLine className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="flex items-center">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</h4>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Uploaded on {file.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <Button 
            type="submit" 
            className="flex items-center gap-2"
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Starting Test...</span>
              </>
            ) : (
              <>
                <RiPlayCircleLine className="h-5 w-5" />
                <span>Run Test</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}