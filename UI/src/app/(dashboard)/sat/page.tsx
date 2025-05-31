"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast-utils";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiLoader4Line, RiPlayLine, RiCloseLine, RiAddLine, RiBrainLine, RiCodeSSlashLine, RiSettings3Line, RiFileTextLine } from "@remixicon/react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/Slider";
import { ChevronRight, Sparkles, BarChart3, Cpu } from 'lucide-react';

const EXAMPLES = [
    {
        label: "Simple Satisfiable (3-SAT)",
        value: "example1",
        dimacs: `c Simple satisfiable example\np cnf 3 2\n1 -3 0\n2 3 -1 0`,
        description: "Basic 3-variable, 2-clause satisfiable problem"
    },
    {
        label: "Unsatisfiable (Contradiction)",
        value: "example2",
        dimacs: `c Unsatisfiable example\np cnf 1 2\n1 0\n-1 0`,
        description: "Simple contradiction: x AND NOT x"
    },
    {
        label: "Complex 3-SAT",
        value: "example3",
        dimacs: `c Complex 3-SAT problem\np cnf 5 7\n1 2 -3 0\n-1 3 4 0\n2 -4 5 0\n-2 -3 -5 0\n1 -4 -5 0\n3 4 5 0\n-1 -2 -3 0`,
        description: "5 variables, 7 clauses with multiple solutions"
    }
];

// Parameter configuration for dynamic UI
const PARAMETER_OPTIONS = {
    solver_type: {
        label: "Solver Type",
        type: "select",
        options: [
            { value: "pysat", label: "PySat (Software)", description: "Fast software-based SAT solver" },
            { value: "hardware", label: "Hardware Accelerated", description: "FPGA-accelerated solver (coming soon)" }
        ],
        default: "pysat",
        icon: <RiCodeSSlashLine className="h-4 w-4" />
    },
    timeout: {
        label: "Timeout",
        type: "slider",
        min: 1,
        max: 60,
        step: 1,
        default: 10,
        unit: "s",
        description: "Maximum solving time in seconds",
        icon: <RiSettings3Line className="h-4 w-4" />
    },
    max_conflicts: {
        label: "Max Conflicts",
        type: "number",
        min: 100,
        max: 10000,
        default: 1000,
        description: "Maximum conflict clauses before giving up",
        icon: <RiBrainLine className="h-4 w-4" />
    },
    branching_heuristic: {
        label: "Branching Heuristic",
        type: "select",
        options: [
            { value: "vsids", label: "VSIDS", description: "Variable State Independent Decaying Sum" },
            { value: "random", label: "Random", description: "Random variable selection" },
            { value: "jeroslow", label: "Jeroslow-Wang", description: "Weighted literal counting" }
        ],
        default: "vsids",
        icon: <RiBrainLine className="h-4 w-4" />
    }
};

export default function SATTestingInterface() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Test configuration state
    const [testName, setTestName] = useState('');
    const [dimacsInput, setDimacsInput] = useState('');
    const [selectedExample, setSelectedExample] = useState('');

    // Dynamic parameters state
    const [activeParameters, setActiveParameters] = useState<Record<string, any>>({
        solver_type: PARAMETER_OPTIONS.solver_type.default,
        timeout: PARAMETER_OPTIONS.timeout.default
    });

    const [showParameterSelector, setShowParameterSelector] = useState(false);

    // Auto-generate test name
    const generateTestName = () => {
        if (typeof window === 'undefined') {
            return 'sat_' + Date.now().toString(36).slice(-6);
        }

        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            const email = user.email || "user@example.com";
            const username = email.split("@")[0];
            const timestamp = Date.now();
            const hash = timestamp.toString(36).slice(-6);
            return `${username}_sat_${hash}`;
        } catch (error) {
            console.error('Error generating test name:', error);
            return 'sat_' + Date.now().toString(36).slice(-6);
        }
    };

    useEffect(() => {
        setInitialLoading(false);
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

    const loadExample = (exampleValue: string) => {
        const example = EXAMPLES.find(ex => ex.value === exampleValue);
        if (example) {
            setDimacsInput(example.dimacs);
            setSelectedExample(exampleValue);
        }
    };

    const runTest = async () => {
        try {
            setLoading(true);
            const finalTestName = testName.trim() || generateTestName();

            const response = await fetch('/api/proxy/sat/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: finalTestName,
                    dimacs_input: dimacsInput,
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
                setDimacsInput('');
                setSelectedExample('');

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
                        SAT Solver
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Solve Boolean satisfiability problems using cutting-edge algorithms and hardware acceleration
                    </p>
                </div>

                {/* Main Configuration Card */}
                <Card className="card-elevated">
                    <CardHeader className="border-b border-border">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <RiSettings3Line className="h-5 w-5" />
                            SAT Problem Configuration
                        </CardTitle>
                        <CardDescription>
                            Configure your SAT problem in DIMACS format with custom solver parameters
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
                            <p className="form-description">Leave empty to auto-generate</p>
                        </div>

                        {/* Active Parameters */}
                        <div className="form-group">
                            <div className="flex items-center justify-between mb-4">
                                <Label className="form-label">Solver Parameters</Label>
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
                                                {!['solver_type', 'timeout'].includes(key) && (
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

                        {/* DIMACS Input */}
                        <div className="form-group">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="form-label">DIMACS Input</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const example = EXAMPLES[0];
                                        loadExample(example.value);
                                    }}
                                    className="text-xs"
                                >
                                    Load Example...
                                </Button>
                            </div>
                            <textarea
                                value={dimacsInput}
                                onChange={(e) => setDimacsInput(e.target.value)}
                                placeholder="c Example SAT problem&#10;p cnf 3 2&#10;1 -3 0&#10;2 3 -1 0"
                                className="w-full h-32 p-3 text-sm font-mono bg-foreground/5 text-foreground border border-border rounded-lg resize-none focus:ring-2 focus:ring-ring focus:border-transparent"
                            />
                            <p className="form-description">
                                Enter your SAT problem in DIMACS CNF format. Each clause should end with 0.
                            </p>
                        </div>

                        {/* Run Button */}
                        <div className="flex justify-end pt-4">
                            <Button
                                size="lg"
                                onClick={runTest}
                                disabled={loading || !dimacsInput.trim()}
                                className="gap-2 px-8 h-12"
                            >
                                {loading ? (
                                    <>
                                        <RiLoader4Line className="h-5 w-5 animate-spin" />
                                        Solving Problem...
                                    </>
                                ) : (
                                    <>
                                        <RiPlayLine className="h-5 w-5" />
                                        Solve Problem
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
                                <RiCodeSSlashLine className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <CardTitle>Software Solver</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                State-of-the-art CDCL algorithm with advanced heuristics
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-elevated-hover">
                        <CardHeader>
                            <div className="p-3 bg-muted rounded-lg w-fit mb-2">
                                <Cpu className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <CardTitle>Hardware Acceleration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                FPGA-accelerated solving for complex problems (coming soon)
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="card-elevated-hover">
                        <CardHeader>
                            <div className="p-3 bg-muted rounded-lg w-fit mb-2">
                                <BarChart3 className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <CardTitle>Performance Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Track solving time, conflicts, and solution quality
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}