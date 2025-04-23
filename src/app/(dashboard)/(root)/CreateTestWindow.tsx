"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import {
  RiCloseLine,
  RiDeleteBinLine,
  RiFileLine,
  RiFileListLine,
  RiCheckLine,
  RiCloseFill
} from "@remixicon/react";
import { Dialog, DialogPanel } from "@tremor/react";
import { addDoc, collection } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ProgressBar } from "@tremor/react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/Select";

interface CreateTestWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onTestComplete?: (testId: string) => void;
}

interface UploadedFileTypes {
  cnf: boolean;
}

// Define the chip types available.
type ChipType = "3sat" | "ldpc" | "hardware";
// For test mode (only applicable for 3sat)
type TestMode = "hardware-only" | "hardware-refinement";

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const CreateTestWindow: React.FC<CreateTestWindowProps> = ({ isOpen, onClose, onTestComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [uploadedTypes, setUploadedTypes] = useState<UploadedFileTypes>({ cnf: false });
  
  // New: chip selection and test mode state.
  const [selectedChip, setSelectedChip] = useState<ChipType>("3sat");
  const [testMode, setTestMode] = useState<TestMode>("hardware-only");

  // Initialize dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const newFiles = [...files, ...acceptedFiles];
      setFiles(newFiles);
      
      // Update uploaded types – check for .cnf or .zip files.
      const types: UploadedFileTypes = { cnf: false };
      newFiles.forEach(file => {
        if (file.name.endsWith('.cnf') || file.name.endsWith('.zip')) {
          types.cnf = true;
        }
      });
      setUploadedTypes(types);
    },
    accept: {
      'text/plain': ['.cnf'],
      'application/zip': ['.zip']
    }
  });

  const removeFile = (fileName: string) => {
    const updatedFiles = files.filter(file => file.name !== fileName);
    setFiles(updatedFiles);
    
    const types: UploadedFileTypes = { cnf: false };
    updatedFiles.forEach(file => {
      if (file.name.endsWith('.cnf') || file.name.endsWith('.zip')) {
        types.cnf = true;
      }
    });
    setUploadedTypes(types);
  };

  // Check API connection
  const checkApiConnection = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/api/health`);
      if (response.ok) {
        setIsApiConnected(true);
        return true;
      }
      setIsApiConnected(false);
      return false;
    } catch (error) {
      console.error("API connection error:", error);
      setIsApiConnected(false);
      return false;
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkApiConnection();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setTestStatus('running');
    setProgress(0);
    
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      // Append the selected chip type.
      formData.append('chip', selectedChip);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      try {
        const response = await fetch(`${apiUrl}/api/solve`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.message || 
            `Solver failed: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid response format from solver');
        }
        
        // Create test document in Firestore.
        const storedUserStr = localStorage.getItem("user");
        if (!storedUserStr) {
          throw new Error("User information not found");
        }
        const storedUser = JSON.parse(storedUserStr);
        const newTest = {
          name: `${selectedChip.toUpperCase()} Benchmark`,
          chipType: selectedChip,
          // Only include testMode if the selected chip is 3sat.
          testMode: selectedChip === "3sat" ? testMode : null,
          status: "completed",
          created: new Date().toISOString(),
          results: data.data,
          solver: selectedChip,
          createdBy: {
            uid: storedUser.uid || '',
            name: storedUser.displayName || storedUser.name || 'Unknown User',
            email: storedUser.email || '',
            role: storedUser.role || "user",
            photoURL: storedUser.photoURL || '',
            avatar: storedUser.photoURL || '',
          },
        };

        const docRef = await addDoc(collection(db, "tests"), newTest);
        setTestStatus('completed');
        setProgress(100);
        
        if (onTestComplete) {
          onTestComplete(docRef.id);
        }
        
        onClose();
      } catch (err) {
        console.error("Error during solving:", err);
        setError(err instanceof Error ? err.message : "Failed to solve problems");
        setTestStatus('error');
      } finally {
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Error during upload:", err);
      setError(err instanceof Error ? err.message : "Failed to upload files");
      setTestStatus('error');
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} static>
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <DialogPanel className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">New Benchmark Test</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <Card className="p-4 mb-4">
            <h3 className="text-sm font-medium mb-2">Instructions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload your CNF problem files (individually or in a ZIP archive) and select the chip you want to run tests on.
              If you choose 3-SAT, you can also select whether you want hardware only or hardware with refinement.
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                {uploadedTypes.cnf ? (
                  <RiCheckLine className="h-4 w-4 text-green-500" />
                ) : (
                  <RiCloseFill className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm">CNF problem files (direct or in ZIP)</span>
              </div>
            </div>

            {/* Chip Type Selection */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Select Chip</label>
              <Select
                value={selectedChip}
                onValueChange={(value) => setSelectedChip(value as ChipType)}
              >
                <SelectTrigger>
                  {selectedChip.toUpperCase()}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3sat">3-SAT</SelectItem>
                  <SelectItem value="ldpc">LDPC</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Test Mode Selection – Only shown for 3-SAT */}
            {selectedChip === "3sat" && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">
                  Select Test Mode
                </label>
                <Select
                  value={testMode}
                  onValueChange={(value) =>
                    setTestMode(value as TestMode)
                  }
                >
                  <SelectTrigger>
                    {testMode === "hardware-only" ? "Hardware Only" : "Hardware with Refinement"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hardware-only">Hardware Only</SelectItem>
                    <SelectItem value="hardware-refinement">Hardware with Refinement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={classNames(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-700"
                )}
              >
                <input {...getInputProps()} />
                <RiFileLine className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Drag and drop your CNF files here, or click to select files
                </p>
              </div>

              {files.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Uploaded Files</h4>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                      >
                        <div className="flex items-center">
                          <RiFileListLine className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(file.name)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <RiDeleteBinLine className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {testStatus === 'running' && (
                <div className="space-y-2">
                  <ProgressBar value={progress} />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentStep || 'Running solver...'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!uploadedTypes.cnf || isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Run Solver'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogPanel>
    </Dialog>
  );
};

export default CreateTestWindow;
