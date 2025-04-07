import React, { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/Select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { RiCloseLine, RiDeleteBinLine, RiFileLine, RiFileListLine } from "@remixicon/react";
import { Dialog, DialogPanel } from "@tremor/react";
import { addDoc, collection } from "firebase/firestore";
import { ProgressBar } from "@tremor/react";

interface CreateTestWindowProps {
    isOpen: boolean;
    onClose: () => void;
    onTestComplete?: (testId: string) => void;
}

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

const CreateTestWindow: React.FC<CreateTestWindowProps> = ({ isOpen, onClose, onTestComplete }) => {
    // State management
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

    // File handling
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => {
            setFiles((prev) => [...prev, ...acceptedFiles]);
        }
    });

    const removeFile = (fileName: string) => {
        setFiles((prev) => prev.filter(file => file.name !== fileName));
    };

    // API functions
    const checkApiConnection = async () => {
        try {
            console.log("Checking API connection...");
            const response = await fetch("https://dacroq.eecs.umich.edu/api/presets", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: 'include',
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                console.warn("API connection failed with status:", response.status);
                setIsApiConnected(false);
                return false;
            }

            try {
                const data = await response.json();
                console.log("API connection successful, presets:", data.presets);
                setIsApiConnected(true);
                return true;
            } catch (jsonError) {
                console.error("Failed to parse API response:", jsonError);
                setIsApiConnected(false);
                return false;
            }
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    console.warn("API connection timed out");
                } else {
                    console.error("API connection error:", error.message);
                }
            } else {
                console.error("Unknown API connection error:", error);
            }
            setIsApiConnected(false);
            return false;
        }
    };

    const fetchPresets = async () => {
        try {
            console.log("Fetching presets...");
            const response = await fetch("https://dacroq.eecs.umich.edu/api/presets", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.presets && Array.isArray(data.presets)) {
                    setPresets(data.presets);
                    return data.presets;
                }
            }
            return [];
        } catch (error) {
            console.error("Error fetching presets:", error);
            return [];
        }
    };

    const fetchMaxTests = async (preset: string) => {
        try {
            const response = await fetch(`https://dacroq.eecs.umich.edu/api/max-tests?preset=${encodeURIComponent(preset)}`, {
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
            return 100;
        } catch (error) {
            console.error("Error fetching max tests:", error);
            return 100;
        }
    };

    // API initialization
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

    // Test submission
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

            // Get user data from localStorage
            const storedUserStr = localStorage.getItem("user");
            if (!storedUserStr) {
                throw new Error("User information not found. Please log in again.");
            }
            const storedUser = JSON.parse(storedUserStr);

            // Create payload for the API
            const payload = {
                preset: testBatch,
                start_index: 0,
                end_index: parseInt(testCount),
                include_cnf: true
            };

            const response = await fetch("https://dacroq.eecs.umich.edu/api/daedalus", {
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
            setApiResponse(data);

            // Create test document in Firestore
            const newTest = {
                name: testName,
                chipType: newChipType,
                status: "completed",
                created: new Date().toISOString(),
                results: data,
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
            console.log("Document saved with ID:", docRef.id);

            setCurrentStep('Test completed successfully');
            setProgress(100);
            setTestStatus('completed');
            setIsResultsExpanded(false);

            if (onTestComplete) {
                onTestComplete(docRef.id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
            setTestStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render the component
    return (
        <Dialog open={isOpen} onClose={onClose} static={true} className="relative z-50">
            {/* ... rest of the JSX ... */}
        </Dialog>
    );
};

export default CreateTestWindow; 