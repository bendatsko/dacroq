"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dropdownmenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdownmenu"
import {
    RiLoader4Line,
    RiPlayLine,
    RiCpuLine,
    RiSettings3Line,
    RiTerminalLine,
    RiRefreshLine,
    RiDeleteBinLine,
    RiCommandLine,
} from "@remixicon/react"
import { ChevronDown } from "lucide-react"
import { toast } from "@/lib/toast-utils"

// Example problems library
const EXAMPLES = [
    {
        label: "Simple Satisfiable (3-SAT)",
        value: "example1",
        dimacs: `c Simple satisfiable example
p cnf 3 2
1 -3 0
2 3 -1 0`,
        description: "Basic 3-variable, 2-clause satisfiable problem",
    },
    {
        label: "Unsatisfiable (Contradiction)",
        value: "example2",
        dimacs: `c Unsatisfiable example
p cnf 1 2
1 0
-1 0`,
        description: "Contradiction: x ∧ ¬x",
    },
    {
        label: "Complex 3-SAT",
        value: "example3",
        dimacs: `c Complex 3-SAT problem
p cnf 5 7
1 2 -3 0
-1 3 4 0
2 -4 5 0
-2 -3 -5 0
1 -4 -5 0
3 4 5 0
-1 -2 -3 0`,
        description: "5 variables, 7 clauses with multiple solutions",
    },
]

// Quick command definitions for DAEDALUS SAT chip
const SAT_QUICK_COMMANDS = [
    {
        category: "Status & Info",
        commands: [
            { name: "Check Status", cmd: "STATUS", description: "Get hardware status" },
            { name: "Health Check", cmd: "HEALTH_CHECK", description: "Run health check" },
            { name: "Chip Info", cmd: "INFO", description: "Get chip information" },
        ]
    },
    {
        category: "Calibration",
        commands: [
            { name: "Start Calibration", cmd: "CALIBRATION:START", description: "Calibrate DAEDALUS chip" },
            { name: "Check Calibration", cmd: "CALIBRATION:STATUS", description: "Check calibration status" },
        ]
    },
    {
        category: "SAT Tests",
        commands: [
            { name: "UF20 Test", cmd: "SAT_TEST:uf20:1", description: "Run single UF20 test" },
            { name: "UF50 Test", cmd: "SAT_TEST:uf50:1", description: "Run single UF50 test" },
            { name: "Batch UF20", cmd: "BATCH:uf20:5", description: "Run 5 UF20 problems" },
        ]
    },
    {
        category: "Visual Feedback",
        commands: [
            { name: "Blink LED", cmd: "LED:BLINK", description: "Blink LED 3 times" },
            { name: "LED On", cmd: "LED:ON", description: "Turn LED on" },
            { name: "LED Off", cmd: "LED:OFF", description: "Turn LED off" },
            { name: "Error Pattern", cmd: "LED:ERROR", description: "Error blink pattern" },
        ]
    },
    {
        category: "Hardware Control",
        commands: [
            { name: "Soft Reset", cmd: "RESET", description: "Soft reset chip" },
            { name: "Stop All", cmd: "LED:IDLE", description: "Stop all operations" },
        ]
    }
]

// Random 3-SAT generator
const generateRandom3SAT = (vars = 3, clauses = 3) => {
    const lits = Array.from({ length: vars }, (_, i) => i + 1)
    const clause = () =>
        Array.from({ length: 3 }, () => {
            const lit = lits[Math.floor(Math.random() * lits.length)]
            return Math.random() < 0.5 ? lit : -lit
        }).join(" ") + " 0"
    return (
        `c Random 3-SAT\np cnf ${vars} ${clauses}\n` +
        Array.from({ length: clauses }, clause).join("\n")
    )
}

export default function SATTestingInterface() {
    // Test configuration state
    const [loading, setLoading] = useState(false)
    const [testName, setTestName] = useState("")
    const [autoTestName, setAutoTestName] = useState("sat_test")
    const [dimacsInput, setDimacsInput] = useState(
        `c Default 3-SAT\np cnf 3 2\n1 -3 0\n2 3 -1 0`
    )
    
    // Input mode and examples
    const [inputMode, setInputMode] = useState("custom")
    const [selectedExample, setSelectedExample] = useState("")
    
    // Algorithm configuration
    const [useMiniSAT, setUseMiniSAT] = useState(true)
    const [useWalkSAT, setUseWalkSAT] = useState(false)
    const [useDaedalus, setUseDaedalus] = useState(false)
    
    // Hardware status for Daedalus
    const [hardwareStatus, setHardwareStatus] = useState<any>(null)
    const [checkingHardware, setCheckingHardware] = useState(false)
    const [hardwareCheckAttempts, setHardwareCheckAttempts] = useState(0)
    
    // Serial monitor state
    const [serialConnected, setSerialConnected] = useState(false)
    const [serialOutput, setSerialOutput] = useState<string[]>([])
    const [serialCommand, setSerialCommand] = useState("")
    const [autoScroll, setAutoScroll] = useState(true)
    const [selectedQuickCommand, setSelectedQuickCommand] = useState("")
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [historyLoaded, setHistoryLoaded] = useState(false)
    const serialOutputRef = useRef<HTMLDivElement>(null)
    
    // Refs for cleanup
    const hardwareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const componentMountedRef = useRef(true)
    const lastHardwareCheckRef = useRef<number>(0)

    // Generate test name
    const generateTestName = () => {
        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}")
            const email = user.email || "user@example.com"
            const username = email.split("@")[0]
            const hash = Date.now().toString(36).slice(-6)
            
            const solvers = []
            if (useMiniSAT) solvers.push("minisat")
            if (useWalkSAT) solvers.push("walksat")
            if (useDaedalus) solvers.push("daedalus")
            const solverStr = solvers.join("-") || "sat"
            
            return `${username}_${solverStr}_${hash}`
        } catch {
            return "sat_" + Date.now().toString(36).slice(-6)
        }
    }

    // Update auto-generated name
    useEffect(() => {
        setAutoTestName(generateTestName())
    }, [useMiniSAT, useWalkSAT, useDaedalus, inputMode])

    // Auto-scroll serial output
    useEffect(() => {
        if (autoScroll && serialOutputRef.current) {
            serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight
        }
    }, [serialOutput, autoScroll])

    // Handle input mode changes
    useEffect(() => {
        if (inputMode === "example") {
            const ex = EXAMPLES[0]
            setSelectedExample(ex.value)
            setDimacsInput(ex.dimacs)
        } else if (inputMode === "random") {
            setDimacsInput(generateRandom3SAT())
        }
    }, [inputMode])

    // Load serial history from backend
    const loadSerialHistory = useCallback(async (showLoading = false) => {
        if (!useDaedalus) return
        
        if (showLoading) setLoadingHistory(true)
        try {
            const res = await fetch("/api/hardware/sat/serial-history")
            const data = await res.json()
            
            if (res.ok) {
                setSerialOutput(data.history || [])
                setSerialConnected(data.connected || false)
                setHistoryLoaded(true)
                setHardwareStatus((prev: any) => ({
                    ...prev,
                    connected: data.connected,
                    lastCheck: new Date().toISOString()
                }))
            }
        } catch (e) {
            console.error("Failed to load SAT serial history:", e)
        } finally {
            if (showLoading) setLoadingHistory(false)
        }
    }, [useDaedalus])

    // Add output to serial monitor
    const addSerialOutput = useCallback((text: string) => {
        if (!componentMountedRef.current) return
        const timestamp = new Date().toLocaleTimeString()
        setSerialOutput(prev => [...prev, `[${timestamp}] ${text}`])
    }, [])

    // Check hardware status
    const checkHardware = useCallback(async (isAutomatic = false) => {
        if (!useDaedalus) {
            if (!isAutomatic) {
                toast({ variant: "error", description: "Daedalus hardware testing is disabled" })
            }
            return false
        }

        if (checkingHardware) return false

        // Rate limiting
        const now = Date.now()
        if (isAutomatic && (now - lastHardwareCheckRef.current) < 10000) {
            return false
        }
        lastHardwareCheckRef.current = now

        setCheckingHardware(true)
        
        try {
            const res = await fetch("/api/proxy/sat/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: "STATUS" })
            })
            
            const data = await res.json()
            if (res.ok && data.output?.includes("STATUS:READY")) {
                setHardwareStatus({ connected: true, status: "ready", lastCheck: new Date().toISOString() })
                setSerialConnected(true)
                setHardwareCheckAttempts(0)
                
                await loadSerialHistory(false)
                
                if (!isAutomatic) {
                    toast({ variant: "success", description: "DAEDALUS hardware connected and ready" })
                }
                return true
            } else {
                throw new Error("DAEDALUS hardware not responding")
            }
        } catch (e) {
            const attempts = hardwareCheckAttempts + 1
            setHardwareCheckAttempts(attempts)
            setHardwareStatus({ 
                connected: false, 
                status: "error", 
                lastCheck: new Date().toISOString(),
                attempts 
            })
            setSerialConnected(false)
            
            if (!isAutomatic) {
                toast({ variant: "error", description: "DAEDALUS hardware not responding" })
            }
            return false
        } finally {
            setCheckingHardware(false)
        }
    }, [useDaedalus, checkingHardware, hardwareCheckAttempts, loadSerialHistory])

    // Automatic hardware checking when Daedalus is enabled
    useEffect(() => {
        if (hardwareCheckIntervalRef.current) {
            clearInterval(hardwareCheckIntervalRef.current)
        }

        if (useDaedalus) {
            loadSerialHistory(!historyLoaded)
            checkHardware(true)
            
            hardwareCheckIntervalRef.current = setInterval(() => {
                if (componentMountedRef.current && useDaedalus) {
                    checkHardware(true)
                }
            }, 30000)
        } else {
            setHardwareStatus(null)
            setSerialConnected(false)
            setSerialOutput([])
            setHistoryLoaded(false)
        }

        return () => {
            if (hardwareCheckIntervalRef.current) {
                clearInterval(hardwareCheckIntervalRef.current)
            }
        }
    }, [useDaedalus, checkHardware, loadSerialHistory, historyLoaded])

    // Cleanup on unmount
    useEffect(() => {
        componentMountedRef.current = true
        return () => {
            componentMountedRef.current = false
            if (hardwareCheckIntervalRef.current) {
                clearInterval(hardwareCheckIntervalRef.current)
            }
        }
    }, [])

    // Send serial command
    const sendSerialCommand = async () => {
        if (!serialCommand.trim()) return
        
        try {
            const res = await fetch("/api/hardware/sat/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: serialCommand.trim() })
            })
            
            const data = await res.json()
            
            await loadSerialHistory(false)
            
            if (!res.ok) {
                addSerialOutput(`Error: ${data.error || "Command failed"}`)
            }
        } catch (e) {
            addSerialOutput(`Error: ${e}`)
        }
        
        setSerialCommand("")
    }

    // Handle quick command selection
    const handleQuickCommand = (command: string) => {
        setSerialCommand(command)
        setSelectedQuickCommand("")
    }

    // Clear serial output
    const clearSerial = () => {
        setSerialOutput([])
    }

    // Manual hardware refresh
    const refreshHardware = async () => {
        await checkHardware(false)
    }

    // Run SAT test
    const runTest = async () => {
        if (!useMiniSAT && !useWalkSAT && !useDaedalus) {
            toast({ variant: "error", description: "Please select at least one solver algorithm" })
            return
        }

        // Check hardware if Daedalus is selected
        if (useDaedalus && !hardwareStatus?.connected) {
            addSerialOutput("🔍 Verifying DAEDALUS hardware connection...")
            const hardwareReady = await checkHardware(false)
            
            if (!hardwareReady) {
                toast({ 
                    variant: "error", 
                    description: "DAEDALUS hardware not ready. Check connection and try again." 
                })
                return
            }
        }

        try {
            setLoading(true)
            const finalName = testName.trim() || autoTestName

            // Determine primary solver (hardware takes precedence)
            const primarySolver = useDaedalus ? "daedalus" : 
                                 useMiniSAT ? "minisat" : "walksat"

            addSerialOutput(`🚀 Starting SAT test: ${finalName}`)
            addSerialOutput(`🧮 Primary solver: ${primarySolver}`)
            addSerialOutput(`📝 Problem: ${dimacsInput.split('\n').length} lines`)

            const res = await fetch("/api/data/sat/solve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: finalName,
                    dimacs: dimacsInput,
                    solver_type: primarySolver,
                    input_mode: inputMode,
                    enable_minisat: useMiniSAT,
                    enable_walksat: useWalkSAT,
                    enable_daedalus: useDaedalus
                })
            })

            const data = await res.json()
            
            if (res.ok) {
                addSerialOutput(`✅ Test "${finalName}" started successfully!`)
                toast({ 
                    variant: "success", 
                    description: `SAT test "${finalName}" started successfully!` 
                })
                setTestName("")
                window.location.href = "/dashboard"
            } else {
                addSerialOutput(`❌ Error: ${data.error || "Unknown error"}`)
                toast({ 
                    variant: "error", 
                    description: data.error || "Failed to start SAT test" 
                })
            }
        } catch (e) {
            addSerialOutput(`❌ Connection error: ${e}`)
            toast({ variant: "error", description: "Connection error" })
        } finally {
            setLoading(false)
        }
    }

    // Determine if test can be run
    const canRunTest = () => {
        if (loading) return false
        if (!dimacsInput.trim()) return false
        if (!useMiniSAT && !useWalkSAT && !useDaedalus) return false
        if (useDaedalus && !hardwareStatus?.connected) return false
        return true
    }

    // Get hardware status display
    const getHardwareStatusDisplay = () => {
        if (!useDaedalus) {
            return { label: "Disabled", variant: "secondary" as const, className: "" }
        }
        
        if (checkingHardware) {
            return { label: "Checking...", variant: "secondary" as const, className: "" }
        }
        
        if (!hardwareStatus) {
            return { label: "Unknown", variant: "secondary" as const, className: "" }
        }
        
        if (hardwareStatus.connected) {
            return { 
                label: "Connected", 
                variant: "default" as const, 
                className: "bg-green-100 text-green-800 border-green-200" 
            }
        }
        
        return { 
            label: `Error (${hardwareStatus.attempts || 0} attempts)`, 
            variant: "destructive" as const, 
            className: "" 
        }
    }

    const statusDisplay = getHardwareStatusDisplay()

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">SAT Solver</h1>
                    <p className="mt-2 text-muted-foreground">
                        Solve boolean satisfiability problems using custom hardware and integrated software
                    </p>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT PANEL - Test Configuration */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <RiSettings3Line className="h-5 w-5" />
                                    SAT Problem Configuration
                                </CardTitle>
                                <CardDescription>
                                    Configure problem input and algorithm selection
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Test Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="test-name">Test Name (optional)</Label>
                                    <Input
                                        id="test-name"
                                        placeholder={autoTestName}
                                        value={testName}
                                        onChange={(e) => setTestName(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Leave empty to use auto-generated name
                                    </p>
                                </div>

                                <hr className="border-border" />

                                {/* Input Mode */}
                                <div className="space-y-3">
                                    <Label className="text-base font-medium">Input Mode</Label>
                                    <Select value={inputMode} onValueChange={setInputMode}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select input mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="custom">Custom CNF</SelectItem>
                                            <SelectItem value="example">Example Library</SelectItem>
                                            <SelectItem value="random">Random 3-SAT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Example Selection */}
                                {inputMode === "example" && (
                                    <div className="space-y-3">
                                        <Label>Choose Example</Label>
                                        <Select
                                            value={selectedExample}
                                            onValueChange={(v) => {
                                                setSelectedExample(v)
                                                const ex = EXAMPLES.find((e) => e.value === v)
                                                if (ex) setDimacsInput(ex.dimacs)
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select example..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {EXAMPLES.map((ex) => (
                                                    <SelectItem key={ex.value} value={ex.value}>
                                                        <div className="flex flex-col items-start">
                                                            <span className="font-medium">{ex.label}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {ex.description}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* DIMACS Input */}
                                <div className="space-y-2">
                                    <Label>DIMACS CNF</Label>
                                    <textarea
                                        value={dimacsInput}
                                        onChange={(e) => setDimacsInput(e.target.value)}
                                        className="h-40 w-full resize-none rounded-lg border border-border bg-foreground/5 p-3 font-mono text-sm text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                                        placeholder="Enter DIMACS CNF format..."
                                    />
                                </div>

                                <hr className="border-border" />

                                {/* Algorithm Selection */}
                                <div className="space-y-4">
                                    <Label className="text-base font-medium">Algorithm Selection</Label>
                                    
                                    {/* MiniSAT */}
                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                        <div className="space-y-1">
                                            <Label htmlFor="minisat" className="font-medium">MiniSAT</Label>
                                            <p className="text-sm text-muted-foreground">Complete DPLL-based SAT solver</p>
                                        </div>
                                        <Switch
                                            id="minisat"
                                            checked={useMiniSAT}
                                            onCheckedChange={setUseMiniSAT}
                                        />
                                    </div>

                                    {/* WalkSAT */}
                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                        <div className="space-y-1">
                                            <Label htmlFor="walksat" className="font-medium">WalkSAT</Label>
                                            <p className="text-sm text-muted-foreground">Stochastic local search solver</p>
                                        </div>
                                        <Switch
                                            id="walksat"
                                            checked={useWalkSAT}
                                            onCheckedChange={setUseWalkSAT}
                                        />
                                    </div>

                                    {/* Daedalus Hardware */}
                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                        <div className="space-y-1">
                                            <Label htmlFor="daedalus" className="font-medium">Daedalus</Label>
                                            <p className="text-sm text-muted-foreground">Analog hardware 3-SAT accelerator</p>
                                        </div>
                                        <Switch
                                            id="daedalus"
                                            checked={useDaedalus}
                                            onCheckedChange={setUseDaedalus}
                                        />
                                    </div>

                                    {useDaedalus && (
                                        <div className="ml-4 p-3 bg-muted/50 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Hardware testing requires Teensy 4.1 with DAEDALUS chip
                                                    </p>
                                                    {hardwareStatus?.lastCheck && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Last checked: {new Date(hardwareStatus.lastCheck).toLocaleTimeString()}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge 
                                                    variant={statusDisplay.variant}
                                                    className={`ml-2 ${statusDisplay.className}`}
                                                >
                                                    {checkingHardware ? (
                                                        <>
                                                            <RiLoader4Line className="h-3 w-3 mr-1 animate-spin" />
                                                            Checking
                                                        </>
                                                    ) : (
                                                        statusDisplay.label
                                                    )}
                                                </Badge>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <hr className="border-border" />

                                {/* Test Summary */}
                                <div className="space-y-2">
                                    <Label className="text-base font-medium">Test Summary</Label>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="flex justify-between">
                                            <span>Input Mode:</span>
                                            <Badge variant="outline">{inputMode}</Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Algorithms:</span>
                                            <Badge variant="outline">
                                                {[useMiniSAT && "MiniSAT", useWalkSAT && "WalkSAT", useDaedalus && "Daedalus"]
                                                    .filter(Boolean).join(", ") || "None"}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Primary:</span>
                                            <Badge variant="outline">
                                                {useDaedalus ? "Hardware" : useMiniSAT ? "Software" : "Software"}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Hardware:</span>
                                            <Badge variant={useDaedalus ? "default" : "secondary"}>
                                                {useDaedalus ? "Enabled" : "Disabled"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Run Test Button */}
                                <Button 
                                    onClick={runTest}
                                    disabled={!canRunTest()}
                                    className="w-full"
                                    size="lg"
                                >
                                    {loading ? (
                                        <>
                                            <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                                            Solving...
                                        </>
                                    ) : (
                                        <>
                                            <RiPlayLine className="mr-2 h-4 w-4" />
                                            Run SAT Test
                                        </>
                                    )}
                                </Button>

                                {/* Help text for disabled button */}
                                {!canRunTest() && !loading && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        {!useMiniSAT && !useWalkSAT && !useDaedalus ? "Select at least one algorithm" :
                                         !dimacsInput.trim() ? "Enter a DIMACS problem" :
                                         useDaedalus && !hardwareStatus?.connected ? "DAEDALUS hardware connection required" : ""}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT PANEL - Hardware Monitoring */}
                    <div className="space-y-6">
                        <Card className="flex-1">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    <RiCpuLine className="h-5 w-5" />
                                    Hardware System
                                    {loadingHistory && <RiLoader4Line className="h-4 w-4 animate-spin ml-2" />}
                                </CardTitle>
                                <CardDescription>
                                    Monitor DAEDALUS hardware connection and serial communication
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Hardware Status Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Connection Status</span>
                                        <div className="flex items-center gap-2">
                                            <Badge 
                                                variant={statusDisplay.variant}
                                                className={`gap-1 ${statusDisplay.className}`}
                                            >
                                                {checkingHardware ? (
                                                    <>
                                                        <RiLoader4Line className="h-3 w-3 animate-spin" />
                                                        Checking
                                                    </>
                                                ) : (
                                                    statusDisplay.label
                                                )}
                                            </Badge>
                                            {useDaedalus && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={refreshHardware}
                                                    disabled={checkingHardware}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <RiRefreshLine className={`h-4 w-4 ${checkingHardware ? 'animate-spin' : ''}`} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {useDaedalus && hardwareStatus?.lastCheck && (
                                        <p className="text-xs text-muted-foreground">
                                            Auto-checking every 30s • Last: {new Date(hardwareStatus.lastCheck).toLocaleTimeString()}
                                        </p>
                                    )}

                                    {!useDaedalus && (
                                        <p className="text-sm text-muted-foreground">
                                            Enable Daedalus hardware to monitor connection status
                                        </p>
                                    )}
                                </div>

                                <hr className="border-border" />

                                {/* Serial Monitor Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <RiTerminalLine className="h-4 w-4" />
                                            <span className="text-sm font-medium">Serial Monitor</span>
                                            <Badge 
                                                variant={serialConnected ? "default" : "secondary"}
                                                className={serialConnected ? "bg-green-100 text-green-800 border-green-200" : ""}
                                            >
                                                {serialConnected ? "Connected" : "Disconnected"}
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearSerial}
                                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <RiDeleteBinLine className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Output Area */}
                                    <div 
                                        ref={serialOutputRef}
                                        className="bg-black text-green-400 p-3 rounded-md font-mono text-xs h-64 overflow-y-auto"
                                    >
                                        {loadingHistory ? (
                                            <div className="text-gray-500 flex items-center">
                                                <RiLoader4Line className="h-4 w-4 animate-spin mr-2" />
                                                Loading history...
                                            </div>
                                        ) : serialOutput.length === 0 ? (
                                            <div className="text-gray-500">
                                                {useDaedalus ? "No communication yet..." : "Enable Daedalus to see serial output"}
                                            </div>
                                        ) : (
                                            serialOutput.map((line, idx) => (
                                                <div key={idx} className="whitespace-pre-wrap">
                                                    {line}
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Quick Commands */}
                                    <div className="flex gap-2">
                                        <Dropdownmenu open={selectedQuickCommand !== ""} onOpenChange={(open: boolean) => !open && setSelectedQuickCommand("")}>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!serialConnected}
                                                    className="flex-shrink-0"
                                                    onClick={() => setSelectedQuickCommand(selectedQuickCommand === "" ? "open" : "")}
                                                >
                                                    <RiCommandLine className="h-4 w-4 mr-1" />
                                                    Quick
                                                    <ChevronDown className="h-3 w-3 ml-1" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-64">
                                                {SAT_QUICK_COMMANDS.map((category, idx) => (
                                                    <div key={idx}>
                                                        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                                                            {category.category}
                                                        </DropdownMenuLabel>
                                                        {category.commands.map((cmd, cmdIdx) => (
                                                            <DropdownMenuItem
                                                                key={cmdIdx}
                                                                onClick={() => handleQuickCommand(cmd.cmd)}
                                                                className="flex flex-col items-start py-2"
                                                            >
                                                                <div className="font-medium text-sm">{cmd.name}</div>
                                                                <div className="text-xs text-muted-foreground font-mono">
                                                                    {cmd.cmd}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground mt-1">
                                                                    {cmd.description}
                                                                </div>
                                                            </DropdownMenuItem>
                                                        ))}
                                                        {idx < SAT_QUICK_COMMANDS.length - 1 && <DropdownMenuSeparator />}
                                                    </div>
                                                ))}
                                            </DropdownMenuContent>
                                        </Dropdownmenu>
                                    </div>

                                    {/* Command Input */}
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Enter command..."
                                            value={serialCommand}
                                            onChange={(e) => setSerialCommand(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && sendSerialCommand()}
                                            disabled={!serialConnected}
                                            className="font-mono text-sm"
                                        />
                                        <Button
                                            onClick={sendSerialCommand}
                                            disabled={!serialConnected || !serialCommand.trim()}
                                            size="sm"
                                        >
                                            Send
                                        </Button>
                                    </div>

                                    {/* Auto-scroll toggle */}
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="auto-scroll"
                                            checked={autoScroll}
                                            onCheckedChange={setAutoScroll}
                                        />
                                        <Label htmlFor="auto-scroll" className="text-sm">Auto-scroll</Label>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
} 