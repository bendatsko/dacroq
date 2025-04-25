"use client";

import { useState } from "react";
import {
    RiCloseLine,
    RiAddLine,
    RiInformationLine,
    RiLightbulbLine,
    RiSettings4Line
} from "@remixicon/react";
import {
    Drawer,
    DrawerTrigger,
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
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/Select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/Tabs";
import { Label } from "@/components/Label";
import { Checkbox } from "@/components/Checkbox";
import { Switch } from "@/components/Switch";
import { Input } from "@/components/Input";
import { Slider } from "@/components/Slider";
import { cn } from "@/lib/utils";

interface TestCreatePanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateTest: (testData: any) => Promise<void>;
    isLoading: boolean;
    chipTypes: string[];
    processorTypes: string[];
    testTypes: string[];
}

export function TestCreatePanel({
                                    open,
                                    onOpenChange,
                                    onCreateTest,
                                    isLoading,
                                    chipTypes,
                                    processorTypes,
                                    testTypes
                                }: TestCreatePanelProps) {
    // Basic test info
    const [testName, setTestName] = useState("");
    const [chipType, setChipType] = useState(chipTypes[0]);
    const [processorType, setProcessorType] = useState(processorTypes[0]);
    const [testType, setTestType] = useState(testTypes[0]);
    const [description, setDescription] = useState("");

    // Define presets for 3SAT tests
    const PRESETS = {
        "Standard": {
            satIterations: 1000,
            clockFrequency: 100,
            testDuration: 60,
            errorThreshold: 0.01,
            voltageSettings: { v1: 3.3, v2: 1.8, v3: 1.2 }
        },
        "High-Performance": {
            satIterations: 5000,
            clockFrequency: 150,
            testDuration: 120,
            errorThreshold: 0.005,
            voltageSettings: { v1: 3.6, v2: 1.8, v3: 1.2 }
        },
        "Low-Power": {
            satIterations: 500,
            clockFrequency: 50,
            testDuration: 30,
            errorThreshold: 0.02,
            voltageSettings: { v1: 2.8, v2: 1.5, v3: 1.0 }
        }
    } as const;

    // Hardware configuration
    const [voltageV1, setVoltageV1] = useState(3.3);
    const [voltageV2, setVoltageV2] = useState(1.8);
    const [voltageV3, setVoltageV3] = useState(1.2);
    const [enableVoltageTesting, setEnableVoltageTesting] = useState(false);
    const [clockFrequency, setClockFrequency] = useState(100);

    // Test parameters
    const [enableErrorRateTesting, setEnableErrorRateTesting] = useState(true);
    const [enableThroughputTesting, setEnableThroughputTesting] = useState(true);
    const [enableLatencyTesting, setEnableLatencyTesting] = useState(true);
    const [testDuration, setTestDuration] = useState(60);
    const [autoRetry, setAutoRetry] = useState(false);
    const [errorThreshold, setErrorThreshold] = useState(0.01);

    // Custom configurations based on chip type
    const [satIterations, setSatIterations] = useState(1000);
    const [ldpcCodeRate, setLdpcCodeRate] = useState(0.5);
    const [hardwareParallelization, setHardwareParallelization] = useState(4);

    const validateForm = () => {
        return testName.trim().length > 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        const testData = {
            name: testName,
            chipType,
            processorType,
            testType,
            description,
            voltage: enableVoltageTesting ? {
                v1: voltageV1,
                v2: voltageV2,
                v3: voltageV3
            } : undefined,
            config: {
                clockFrequency,
                testDuration,
                autoRetry,
                errorThreshold,
                enableErrorRateTesting,
                enableThroughputTesting,
                enableLatencyTesting,
                // Custom configurations based on chip type
                ...(chipType === "3SAT" && { satIterations }),
                ...(chipType === "LDPC" && { ldpcCodeRate }),
                ...(chipType === "HARDWARE" && { hardwareParallelization })
            }
        };

        await onCreateTest(testData);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="sm:max-w-2xl">
                <DrawerHeader>
                    <DrawerTitle className="text-xl flex items-center gap-2">
                        <RiAddLine className="h-5 w-5 text-blue-500" />
                        Create New Hardware Test
                    </DrawerTitle>
                    <DrawerDescription className="text-sm text-gray-500">
                        Configure test parameters for hardware-in-the-loop testing of your PCB components
                    </DrawerDescription>
                </DrawerHeader>

                <Tabs defaultValue="basic" className="w-full">
                    <div className="px-6">
                        <TabsList className="grid grid-cols-3 mb-4">
                            <TabsTrigger value="basic" className="text-sm">Basic Info</TabsTrigger>
                            <TabsTrigger value="hardware" className="text-sm">Hardware Config</TabsTrigger>
                            <TabsTrigger value="params" className="text-sm">Test Parameters</TabsTrigger>
                        </TabsList>
                    </div>

                    <DrawerBody className="p-0">
                        <TabsContent value="basic" className="px-6 py-2 space-y-5 mt-0">
                            <div className="space-y-1.5">
                                <Label htmlFor="testName">Test Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="testName"
                                    placeholder="Enter a descriptive name for your test"
                                    value={testName}
                                    onChange={(e) => setTestName(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                    Choose a unique, descriptive name that identifies this test run
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Chip Type</Label>
                                <Select value={chipType} onValueChange={setChipType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select chip type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {chipTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                    {chipType === "3SAT" && "Test the 3SAT solver chip with configurable parameters"}
                                    {chipType === "LDPC" && "Test the LDPC decoder chip with error correction capabilities"}
                                    {chipType === "HARDWARE" && "General hardware testing of PCB components"}
                                    {chipType === "RISC-V" && "Test the embedded RISC-V processor functionality"}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Processor Type</Label>
                                <Select value={processorType} onValueChange={setProcessorType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select processor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {processorTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                    Select the processor that will control and interface with the test hardware
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Test Type</Label>
                                <Select value={testType} onValueChange={setTestType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select test type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {testTypes.map(type => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                    {testType === "Hardware-in-Loop" && "Physical hardware connected to the test system"}
                                    {testType === "Software-in-Loop" && "Software simulation of the hardware behavior"}
                                    {testType === "Chip-in-Loop" && "Testing specific chip functionality in isolation"}
                                    {testType === "Unit Test" && "Individual component testing for validation"}
                                    {testType === "Integration Test" && "Testing multiple components working together"}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="description">Description</Label>
                                <textarea
                                    id="description"
                                    rows={3}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    placeholder="Optional: Describe the purpose of this test"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="hardware" className="px-6 py-2 space-y-5 mt-0">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md flex items-start gap-3 mb-2">
                                <div className="mt-0.5 text-blue-500">
                                    <RiInformationLine className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Hardware Configuration</h3>
                                    <p className="text-sm text-blue-600 dark:text-blue-400">Configure the hardware parameters specifically for the selected chip type and processor.</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="enableVoltageTesting" className="font-medium">Voltage Testing</Label>
                                    <div className="text-xs text-gray-500">
                                        (Monitor voltage levels during test)
                                    </div>
                                </div>
                                <Switch
                                    id="enableVoltageTesting"
                                    checked={enableVoltageTesting}
                                    onCheckedChange={setEnableVoltageTesting}
                                />
                            </div>

                            {enableVoltageTesting && (
                                <div className="space-y-4 pl-2 border-l-2 border-blue-100 dark:border-blue-900/40">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="voltageV1">V₁ Voltage (V)</Label>
                                            <span className="text-sm font-medium">{voltageV1.toFixed(1)}V</span>
                                        </div>
                                        <Slider
                                            id="voltageV1"
                                            min={1.0}
                                            max={5.0}
                                            step={0.1}
                                            value={[voltageV1]}
                                            onValueChange={(values) => setVoltageV1(values[0])}
                                        />
                                        <p className="text-xs text-gray-500">
                                            Main supply voltage for the PCB (typical: 3.3V)
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="voltageV2">V₂ Voltage (V)</Label>
                                            <span className="text-sm font-medium">{voltageV2.toFixed(1)}V</span>
                                        </div>
                                        <Slider
                                            id="voltageV2"
                                            min={1.0}
                                            max={3.6}
                                            step={0.1}
                                            value={[voltageV2]}
                                            onValueChange={(values) => setVoltageV2(values[0])}
                                        />
                                        <p className="text-xs text-gray-500">
                                            Secondary voltage for digital components (typical: 1.8V)
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="voltageV3">V₃ Voltage (V)</Label>
                                            <span className="text-sm font-medium">{voltageV3.toFixed(1)}V</span>
                                        </div>
                                        <Slider
                                            id="voltageV3"
                                            min={0.8}
                                            max={1.5}
                                            step={0.1}
                                            value={[voltageV3]}
                                            onValueChange={(values) => setVoltageV3(values[0])}
                                        />
                                        <p className="text-xs text-gray-500">
                                            Core voltage for processing elements (typical: 1.2V)
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="clockFrequency">Clock Frequency (MHz)</Label>
                                    <span className="text-sm font-medium">{clockFrequency} MHz</span>
                                </div>
                                <Slider
                                    id="clockFrequency"
                                    min={10}
                                    max={200}
                                    step={1}
                                    value={[clockFrequency]}
                                    onValueChange={(values) => setClockFrequency(values[0])}
                                />
                                <p className="text-xs text-gray-500">
                                    Operating frequency for the test (higher = faster, but more power consumption)
                                </p>
                            </div>

                            {/* Chip-specific configurations */}
                            {chipType === "3SAT" && (
                                <div className="space-y-2 mt-5 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                    <h3 className="font-medium text-sm flex items-center gap-1.5">
                                        <RiSettings4Line className="h-4 w-4 text-blue-500" />
                                        3SAT Solver Configuration
                                    </h3>

                                    <div className="space-y-2 mt-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="satIterations">Iterations</Label>
                                            <span className="text-sm font-medium">{satIterations}</span>
                                        </div>
                                        <Slider
                                            id="satIterations"
                                            min={100}
                                            max={10000}
                                            step={100}
                                            value={[satIterations]}
                                            onValueChange={(values) => setSatIterations(values[0])}
                                        />
                                        <p className="text-xs text-gray-500">
                                            Number of 3SAT problems to solve during the test
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Preset Configuration</Label>
                                        <Select value="Custom" onValueChange={(value) => {
                                            if (value !== "Custom" && value in PRESETS) {
                                                const preset = PRESETS[value as keyof typeof PRESETS];
                                                setSatIterations(preset.satIterations);
                                                setClockFrequency(preset.clockFrequency);
                                                setTestDuration(preset.testDuration);
                                                setErrorThreshold(preset.errorThreshold);
                                                setVoltageV1(preset.voltageSettings.v1);
                                                setVoltageV2(preset.voltageSettings.v2);
                                                setVoltageV3(preset.voltageSettings.v3);
                                                setEnableVoltageTesting(true);
                                            }
                                        }}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select preset" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Custom">Custom</SelectItem>
                                                {Object.keys(PRESETS).map(preset => (
                                                    <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-gray-500">
                                            Select a predefined configuration for the 3SAT solver
                                        </p>
                                    </div>
                                </div>
                            )}

                            {chipType === "LDPC" && (
                                <div className="space-y-2 mt-5 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                    <h3 className="font-medium text-sm flex items-center gap-1.5">
                                        <RiSettings4Line className="h-4 w-4 text-blue-500" />
                                        LDPC Decoder Configuration
                                    </h3>

                                    <div className="space-y-2 mt-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="ldpcCodeRate">Code Rate</Label>
                                            <span className="text-sm font-medium">{ldpcCodeRate.toFixed(2)}</span>
                                        </div>
                                        <Slider
                                            id="ldpcCodeRate"
                                            min={0.1}
                                            max={0.9}
                                            step={0.01}
                                            value={[ldpcCodeRate]}
                                            onValueChange={(values) => setLdpcCodeRate(values[0])}
                                        />
                                        <p className="text-xs text-gray-500">
                                            LDPC code rate (lower = more redundancy, better error correction)
                                        </p>
                                    </div>
                                </div>
                            )}

                            {chipType === "HARDWARE" && (
                                <div className="space-y-2 mt-5 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                                    <h3 className="font-medium text-sm flex items-center gap-1.5">
                                        <RiSettings4Line className="h-4 w-4 text-blue-500" />
                                        Hardware Test Configuration
                                    </h3>

                                    <div className="space-y-2 mt-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="hardwareParallelization">Parallelization</Label>
                                            <span className="text-sm font-medium">{hardwareParallelization}x</span>
                                        </div>
                                        <Slider
                                            id="hardwareParallelization"
                                            min={1}
                                            max={16}
                                            step={1}
                                            value={[hardwareParallelization]}
                                            onValueChange={(values) => setHardwareParallelization(values[0])}
                                        />
                                        <p className="text-xs text-gray-500">
                                            Number of parallel hardware threads to use during testing
                                        </p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="params" className="px-6 py-2 space-y-5 mt-0">
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md flex items-start gap-3 mb-2">
                                <div className="mt-0.5 text-amber-500">
                                    <RiLightbulbLine className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Test Parameters</h3>
                                    <p className="text-sm text-amber-600 dark:text-amber-400">Configure how the test will be performed and what data will be collected.</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-medium text-sm">Performance Metrics</h3>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="enableErrorRateTesting"
                                        checked={enableErrorRateTesting}
                                        onCheckedChange={setEnableErrorRateTesting}
                                    />
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="enableErrorRateTesting" className="text-sm font-normal">
                                            Measure Error Rate
                                        </Label>
                                        <p className="text-xs text-gray-500">
                                            Track and report error rates during the test run
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="enableThroughputTesting"
                                        checked={enableThroughputTesting}
                                        onCheckedChange={setEnableThroughputTesting}
                                    />
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="enableThroughputTesting" className="text-sm font-normal">
                                            Measure Throughput
                                        </Label>
                                        <p className="text-xs text-gray-500">
                                            Measure processing speed and data throughput
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="enableLatencyTesting"
                                        checked={enableLatencyTesting}
                                        onCheckedChange={setEnableLatencyTesting}
                                    />
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="enableLatencyTesting" className="text-sm font-normal">
                                            Measure Latency
                                        </Label>
                                        <p className="text-xs text-gray-500">
                                            Measure response time and processing delays
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="testDuration">Test Duration (seconds)</Label>
                                    <span className="text-sm font-medium">{testDuration} sec</span>
                                </div>
                                <Slider
                                    id="testDuration"
                                    min={10}
                                    max={300}
                                    step={5}
                                    value={[testDuration]}
                                    onValueChange={(values) => setTestDuration(values[0])}
                                />
                                <p className="text-xs text-gray-500">
                                    How long each test iteration should run
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="autoRetry" className="font-medium">Auto-Retry on Failure</Label>
                                    <div className="text-xs text-gray-500">
                                        (Automatically retry failed tests)
                                    </div>
                                </div>
                                <Switch
                                    id="autoRetry"
                                    checked={autoRetry}
                                    onCheckedChange={setAutoRetry}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="errorThreshold">Error Threshold (%)</Label>
                                    <span className="text-sm font-medium">{(errorThreshold * 100).toFixed(2)}%</span>
                                </div>
                                <Slider
                                    id="errorThreshold"
                                    min={0}
                                    max={0.1}
                                    step={0.001}
                                    value={[errorThreshold]}
                                    onValueChange={(values) => setErrorThreshold(values[0])}
                                />
                                <p className="text-xs text-gray-500">
                                    Maximum acceptable error rate (test fails if exceeded)
                                </p>
                            </div>
                        </TabsContent>
                    </DrawerBody>

                    <DrawerFooter className="flex gap-2 border-t px-6 py-4">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={!validateForm() || isLoading}
                            onClick={handleSubmit}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating Test...
                                </>
                            ) : (
                                <>Create Test</>
                            )}
                        </Button>
                    </DrawerFooter>
                </Tabs>
            </DrawerContent>
        </Drawer>
    );
}