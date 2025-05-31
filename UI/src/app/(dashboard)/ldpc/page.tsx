"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiLoader4Line, RiPlayLine, RiCloseLine, RiDeleteBin5Line, RiEyeLine, RiInformationLine, RiCpuLine, RiAddLine, RiCodeSSlashLine, RiFlashlightLine, RiSettings3Line } from "@remixicon/react";
import { CheckCircle, Clock, AlertCircle, Upload, Play, Settings, BarChart3, Sparkles, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from "@/lib/toast-utils";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/Slider";
import { motion, AnimatePresence } from "framer-motion";

// Constants
const API_BASE = "/api/proxy";

// Parameter configuration for dynamic UI
const PARAMETER_OPTIONS = {
    algorithm_type: {
        label: "Algorithm Type",
        type: "select",
        options: [
            { value: "analog_hardware", label: "Analog Hardware", description: "Energy-efficient oscillator-based decoder" },
            { value: "digital_hardware", label: "Digital Hardware", description: "Traditional belief propagation decoder" }
        ],
        default: "digital_hardware",
        icon: <RiCpuLine className="h-4 w-4" />
    },
    test_mode: {
        label: "Test Mode",
        type: "select",
        options: [
            { value: "custom_message", label: "Custom Message", description: "Enter your own message" },
            { value: "pre_written", label: "Pre-written Message", description: "Select from examples" },
            { value: "random_string", label: "Random String", description: "Generate random data" },
            { value: "ber_test", label: "BER Test", description: "Bit error rate testing" }
        ],
        default: "custom_message",
        icon: <RiCodeSSlashLine className="h-4 w-4" />
    },
    noise_level: {
        label: "Noise Level",
        type: "slider",
        min: 0,
        max: 50,
        step: 1,
        default: 10,
        unit: "%",
        description: "Channel noise percentage",
        icon: <RiFlashlightLine className="h-4 w-4" />
    },
    iterations: {
        label: "Max Iterations",
        type: "number",
        min: 1,
        max: 50,
        default: 10,
        description: "Maximum decoder iterations",
        icon: <RiSettings3Line className="h-4 w-4" />
    },
    snr_variation: {
        label: "SNR Variation",
        type: "slider",
        min: 0,
        max: 5,
        step: 0.1,
        default: 1,
        unit: "dB",
        description: "Signal-to-noise ratio variation",
        icon: <RiFlashlightLine className="h-4 w-4" />
    }
};

// Pre-written message options
const preWrittenMessages = [
    { value: 'hello_world', label: 'Hello World', content: 'Hello, World! This is a test message for LDPC error correction.' },
    { value: 'lorem_ipsum', label: 'Lorem Ipsum', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
    { value: 'technical', label: 'Technical Text', content: 'The Low-Density Parity-Check (LDPC) codes are highly efficient.' },
    { value: 'quote', label: 'Famous Quote', content: 'The only way to do great work is to love what you do. - Steve Jobs' },
    { value: 'pangram', label: 'Pangram', content: 'The quick brown fox jumps over the lazy dog.' }
];

export default function LDPCTestingInterface() {
    const router = useRouter();
    const [apiHealth, setApiHealth] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Test configuration state
    const [testName, setTestName] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [selectedPreWritten, setSelectedPreWritten] = useState('');

    // Dynamic parameters state
    const [activeParameters, setActiveParameters] = useState<Record<string, any>>({
        algorithm_type: PARAMETER_OPTIONS.algorithm_type.default,
        test_mode: PARAMETER_OPTIONS.test_mode.default,
        noise_level: PARAMETER_OPTIONS.noise_level.default
    });

    const [showParameterSelector, setShowParameterSelector] = useState(false);

    // Auto-generate test name
    const generateTestName = () => {
        if (typeof window === 'undefined') {
            return 'ldpc_' + Date.now().toString(36).slice(-6);
        }

        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const email = user.email || "user@example.com";
            const username = email.split("@")[0];
            const timestamp = Date.now();
            const hash = timestamp.toString(36).slice(-6);
            return `${username}_ldpc_${hash}`;
        } catch (error) {
            console.error('Error generating test name:', error);
            return 'ldpc_' + Date.now().toString(36).slice(-6);
        }
    };

    useEffect(() => {
        const initializeData = async () => {
            try {
                setInitialLoading(true);
                await checkApiHealth();
            } catch (error) {
                console.error('Error initializing:', error);
            } finally {
                setInitialLoading(false);
            }
        };

        const checkApiHealth = async () => {
            try {
                const response = await fetch('/api/proxy/health');
                if (response.ok) {
                    const data = await response.json();
                    setApiHealth(data);
                }
            } catch (error) {
                console.error('API health check failed:', error);
            }
        };

        initializeData();
    }, []);

    const addParameter = (paramKey: string) => {
        if (!activeParameters[paramKey]) {
            setActiveParameters(prev => ({
                ...prev,
                [paramKey]: PARAMETER_OPTIONS[paramKey as keyof typeof PARAMETER_OPTIONS].default
            }));
        }
        setShowParameterSelector(false);
    };

    const removeParameter = (paramKey: string) => {
        const newParams = { ...activeParameters };
        delete newParams[paramKey];
        setActiveParameters(newParams);
    };

    const updateParameter = (paramKey: string, value: any) => {
        setActiveParameters(prev => ({
            ...prev,
            [paramKey]: value
        }));
    };

    const runTest = async () => {
        try {
            setLoading(true);
            const finalTestName = testName.trim() || generateTestName();

            const response = await fetch('/api/proxy/ldpc/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: finalTestName,
                    algorithm_type: activeParameters.algorithm_type,
                    test_mode: activeParameters.test_mode,
                    message_content: activeParameters.test_mode === 'custom_message' ? customMessage :
                        activeParameters.test_mode === 'pre_written' ? preWrittenMessages.find(m => m.value === selectedPreWritten)?.content : undefined,
                    noise_level: activeParameters.noise_level,
                    ...activeParameters
                })
            });

            const result = await response.json();

            if (response.ok) {
                toast({
                    variant: 'success',
                    description: `Test "${finalTestName}" started successfully!`
                });

                // Reset form
                setTestName('');
                setCustomMessage('');
                setSelectedPreWritten('');

                // Redirect to dashboard
                setTimeout(() => {
                    router.push('/dashboard');
                }, 1000);
            } else {
                toast({
                    variant: 'error',
                    description: result.error || 'Failed to start test'
                });
            }
        } catch (error) {
            console.error('Error running test:', error);
            toast({
                variant: 'error',
                description: 'Error starting test'
            });
        } finally {
            setLoading(false);
        }
    };

    const renderParameterControl = (paramKey: string, config: any) => {
        const value = activeParameters[paramKey];

        switch (config.type) {
            case 'select':
                return (
                    <Select value={value} onValueChange={(val) => updateParameter(paramKey, val)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {config.options.map((option: any) => (
                                <SelectItem key={option.value} value={option.value}>
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">{option.label}</span>
                                        {option.description && (
                                            <span className="text-xs text-muted-foreground">{option.description}</span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case 'slider':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{value}{config.unit}</span>
                        </div>
                        <Slider
                            value={[value]}
                            onValueChange={([val]: number[]) => updateParameter(paramKey, val)}
                            min={config.min}
                            max={config.max}
                            step={config.step}
                            className="w-full"
                        />
                    </div>
                );

            case 'number':
                return (
                    <Input
                        type="number"
                        value={value}
                        onChange={(e) => updateParameter(paramKey, parseInt(e.target.value) || config.default)}
                        min={config.min}
                        max={config.max}
                        className="w-full"
                    />
                );

            default:
                return null;
        }
    };

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex items-center space-x-2">
                    <RiLoader4Line className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-lg text-muted-foreground">Loading interface...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
                {/* Header */}
                <div className="text-center page-header">
                    <div className="inline-flex items-center justify-center p-3 bg-muted rounded-2xl mb-6">
                        <Sparkles className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h1 className="text-4xl font-bold text-foreground mb-4">
                        LDPC Error Correction
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Test message error correction with cutting-edge analog and digital hardware acceleration
                    </p>
                </div>

                {/* Main Configuration Card */}
                <Card className="card-elevated">
                    <CardHeader className="border-b border-border">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <RiSettings3Line className="h-5 w-5" />
                            Test Configuration
                        </CardTitle>
                        <CardDescription>
                            Configure your LDPC error correction test with custom parameters
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 section-spacing">
                        {/* Test Name */}
                        <div className="form-group">
                            <Label className="form-label">Test Name</Label>
                            <Input
                                placeholder={`Auto: ${generateTestName()}`}
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                                className="h-11"
                            />
                        </div>

                        {/* Active Parameters */}
                        <div className="form-group">
                            <div className="flex items-center justify-between mb-4">
                                <Label className="form-label">Test Parameters</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowParameterSelector(!showParameterSelector)}
                                    className="gap-2"
                                >
                                    <RiAddLine className="h-4 w-4" />
                                    Add Parameter
                                </Button>
                            </div>

                            <AnimatePresence>
                                {showParameterSelector && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden mb-4"
                                    >
                                        <div className="border-2 border-dashed border-border rounded-lg p-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(PARAMETER_OPTIONS).map(([key, config]) => (
                                                    !activeParameters[key] && (
                                                        <Button
                                                            key={key}
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => addParameter(key)}
                                                            className="justify-start gap-2 h-auto p-3"
                                                        >
                                                            {config.icon}
                                                            <span>{config.label}</span>
                                                        </Button>
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Render active parameters */}
                            <div className="space-y-4">
                                {Object.entries(activeParameters).map(([key, value]) => {
                                    const config = PARAMETER_OPTIONS[key as keyof typeof PARAMETER_OPTIONS];
                                    if (!config) return null;

                                    return (
                                        <motion.div
                                            key={key}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-muted/50 rounded-lg p-4 space-y-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-background rounded-lg">
                                                        {config.icon}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-foreground">{config.label}</h4>
                                                        {'description' in config && config.description && (
                                                            <p className="text-xs text-muted-foreground">{config.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {!['algorithm_type', 'test_mode', 'noise_level'].includes(key) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeParameter(key)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <RiCloseLine className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="pl-12">
                                                {renderParameterControl(key, config)}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Message Input (conditional) */}
                        {activeParameters.test_mode === 'custom_message' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="form-group"
                            >
                                <Label className="form-label">Custom Message</Label>
                                <Input
                                    placeholder="Enter your message to encode..."
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    className="h-11"
                                />
                            </motion.div>
                        )}

                        {activeParameters.test_mode === 'pre_written' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="form-group"
                            >
                                <Label className="form-label">Select Message</Label>
                                <Select value={selectedPreWritten} onValueChange={setSelectedPreWritten}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Choose a pre-written message" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {preWrittenMessages.map((msg) => (
                                            <SelectItem key={msg.value} value={msg.value}>
                                                <div className="flex flex-col items-start">
                                                    <span className="font-medium">{msg.label}</span>
                                                    <span className="text-xs text-muted-foreground line-clamp-1">{msg.content}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedPreWritten && (
                                    <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                                        <p className="text-sm text-muted-foreground">
                                            {preWrittenMessages.find(m => m.value === selectedPreWritten)?.content}
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Run Button */}
                        <div className="flex justify-end pt-4">
                            <Button
                                size="lg"
                                onClick={runTest}
                                disabled={loading || (activeParameters.test_mode === 'custom_message' && !customMessage.trim()) ||
                                    (activeParameters.test_mode === 'pre_written' && !selectedPreWritten)}
                                className="gap-2 px-8 h-12"
                            >
                                {loading ? (
                                    <>
                                        <RiLoader4Line className="h-5 w-5 animate-spin" />
                                        Running Test...
                                    </>
                                ) : (
                                    <>
                                        <RiPlayLine className="h-5 w-5" />
                                        Run Test
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="card-elevated-hover">
                        <CardHeader>
                            <div className="p-3 bg-muted rounded-lg w-fit mb-2">
                                <RiCpuLine className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <CardTitle>Analog Hardware</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Energy-efficient oscillator-based decoder with 5.47 pJ/bit consumption
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-elevated-hover">
                        <CardHeader>
                            <div className="p-3 bg-muted rounded-lg w-fit mb-2">
                                <RiFlashlightLine className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <CardTitle>Digital Hardware</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Traditional belief propagation decoder for baseline comparison
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-elevated-hover">
                        <CardHeader>
                            <div className="p-3 bg-muted rounded-lg w-fit mb-2">
                                <BarChart3 className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <CardTitle>Real-time Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Monitor performance metrics and convergence in real-time
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}