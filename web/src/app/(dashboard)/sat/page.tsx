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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    RiLoader4Line,
    RiPlayLine,
    RiCpuLine,
    RiSettings3Line,
    RiTerminalLine,
    RiRefreshLine,
    RiInformationLine,
    RiCodeLine,
} from "@remixicon/react"
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
    const [serialMonitorOpen, setSerialMonitorOpen] = useState(false)
    
    // Refs for cleanup
    const hardwareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const componentMountedRef = useRef(true)

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
    }, [useMiniSAT, useWalkSAT, useDaedalus])

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

    // Check hardware status
    const checkHardware = useCallback(async (isAutomatic = false) => {
        if (!useDaedalus || checkingHardware) return false

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
                if (!isAutomatic) {
                    toast({ variant: "success", description: "DAEDALUS hardware connected and ready" })
                }
                return true
            } else {
                throw new Error("DAEDALUS hardware not responding")
            }
        } catch (e) {
            setHardwareStatus({ 
                connected: false, 
                status: "error", 
                lastCheck: new Date().toISOString(),
            })
            
            if (!isAutomatic) {
                toast({ variant: "error", description: "DAEDALUS hardware not responding" })
            }
            return false
        } finally {
            setCheckingHardware(false)
        }
    }, [useDaedalus, checkingHardware])

    // Automatic hardware checking when Daedalus is enabled
    useEffect(() => {
        if (hardwareCheckIntervalRef.current) {
            clearInterval(hardwareCheckIntervalRef.current)
        }

        if (useDaedalus) {
            checkHardware(true)
            
            hardwareCheckIntervalRef.current = setInterval(() => {
                if (componentMountedRef.current && useDaedalus) {
                    checkHardware(true)
                }
            }, 30000)
        }

        return () => {
            if (hardwareCheckIntervalRef.current) {
                clearInterval(hardwareCheckIntervalRef.current)
            }
        }
    }, [useDaedalus, checkHardware])

    // Cleanup on unmount
    useEffect(() => {
        componentMountedRef.current = true
        return () => {
            componentMountedRef.current = false
        }
    }, [])

    // Run SAT test
    const runTest = async () => {
        if (!useMiniSAT && !useWalkSAT && !useDaedalus) {
            toast({ variant: "error", description: "Please select at least one solver algorithm" })
            return
        }

        if (useDaedalus && !hardwareStatus?.connected) {
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
            const primarySolver = useDaedalus ? "daedalus" : 
                                 useMiniSAT ? "minisat" : "walksat"

            const res = await fetch("/api/proxy/sat/solve", {
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
                toast({ 
                    variant: "success", 
                    description: `SAT test "${finalName}" started successfully!` 
                })
                setTestName("")
                window.location.href = "/dashboard"
            } else {
                toast({ 
                    variant: "error", 
                    description: data.error || "Failed to start SAT test" 
                })
            }
        } catch (e) {
            toast({ variant: "error", description: "Connection error" })
        } finally {
            setLoading(false)
        }
    }

    const canRunTest = () => {
        if (loading) return false
        if (!dimacsInput.trim()) return false
        if (!useMiniSAT && !useWalkSAT && !useDaedalus) return false
        if (useDaedalus && !hardwareStatus?.connected) return false
        return true
    }

    const selectedAlgorithms = [
        useMiniSAT && "MiniSAT",
        useWalkSAT && "WalkSAT", 
        useDaedalus && "Daedalus"
    ].filter(Boolean)

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">SAT Solver</h1>
                    <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                        Solve boolean satisfiability problems using software and hardware acceleration
                    </p>
                </div>

                {/* Main Configuration Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <RiSettings3Line className="h-5 w-5" />
                                <CardTitle>Problem Configuration</CardTitle>
                            </div>
                            {useDaedalus && (
                                <Badge 
                                    variant={hardwareStatus?.connected ? "default" : "secondary"}
                                    className={hardwareStatus?.connected ? "bg-green-100 text-green-800 border-green-200" : ""}
                                >
                                    {checkingHardware ? (
                                        <>
                                            <RiLoader4Line className="h-3 w-3 mr-1 animate-spin" />
                                            Checking
                                        </>
                                    ) : hardwareStatus?.connected ? (
                                        "Hardware Ready"
                                    ) : (
                                        "Hardware Disconnected"
                                    )}
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Configure your SAT problem and select solving algorithms
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Test Name */}
                        <div className="space-y-2">
                            <Label htmlFor="test-name">Test Name</Label>
                            <Input
                                id="test-name"
                                placeholder={autoTestName}
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave empty for auto-generated name
                            </p>
                        </div>

                        {/* Input Mode */}
                        <div className="space-y-3">
                            <Label>Input Mode</Label>
                            <Select value={inputMode} onValueChange={setInputMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select input mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="custom">
                                        <div className="flex items-center gap-2">
                                            <RiCodeLine className="h-4 w-4" />
                                            Custom CNF
                                        </div>
                                    </SelectItem>
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
                                    <SelectTrigger>
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
                            <Label>DIMACS CNF Input</Label>
                            <textarea
                                value={dimacsInput}
                                onChange={(e) => setDimacsInput(e.target.value)}
                                className="h-32 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Enter DIMACS CNF format..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Format: p cnf [variables] [clauses], followed by clause lines ending with 0
                            </p>
                        </div>

                        {/* Algorithm Selection */}
                        <div className="space-y-4">
                            <Label className="text-base">Solver Algorithms</Label>
                            
                            <div className="space-y-3">
                                {/* MiniSAT */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="minisat" className="text-sm font-medium cursor-pointer">
                                            MiniSAT
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Complete DPLL-based solver (software)
                                        </p>
                                    </div>
                                    <Switch
                                        id="minisat"
                                        checked={useMiniSAT}
                                        onCheckedChange={setUseMiniSAT}
                                    />
                                </div>

                                {/* WalkSAT */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="walksat" className="text-sm font-medium cursor-pointer">
                                            WalkSAT
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Stochastic local search (software)
                                        </p>
                                    </div>
                                    <Switch
                                        id="walksat"
                                        checked={useWalkSAT}
                                        onCheckedChange={setUseWalkSAT}
                                    />
                                </div>

                                {/* Daedalus */}
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="daedalus" className="text-sm font-medium cursor-pointer">
                                            DAEDALUS
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Analog 3-SAT accelerator (hardware)
                                        </p>
                                    </div>
                                    <Switch
                                        id="daedalus"
                                        checked={useDaedalus}
                                        onCheckedChange={setUseDaedalus}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Test Summary */}
                        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Selected Algorithms:</span>
                                <span className="font-medium">
                                    {selectedAlgorithms.length > 0 
                                        ? selectedAlgorithms.join(", ")
                                        : "None selected"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Primary Solver:</span>
                                <Badge variant="outline" className="font-mono">
                                    {useDaedalus ? "Hardware" : selectedAlgorithms[0] || "None"}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Input Mode:</span>
                                <Badge variant="outline">{inputMode}</Badge>
                            </div>
                            {useDaedalus && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Hardware Status:</span>
                                    <Badge 
                                        variant={hardwareStatus?.connected ? "default" : "secondary"}
                                        className={hardwareStatus?.connected ? "bg-green-100 text-green-800 border-green-200" : ""}
                                    >
                                        {hardwareStatus?.connected ? "Connected" : "Required"}
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button 
                                onClick={runTest}
                                disabled={!canRunTest()}
                                className="flex-1"
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

                            {useDaedalus && (
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={() => checkHardware(false)}
                                        disabled={checkingHardware}
                                    >
                                        <RiRefreshLine className={`h-4 w-4 ${checkingHardware ? 'animate-spin' : ''}`} />
                                    </Button>

                                    <Dialog open={serialMonitorOpen} onOpenChange={setSerialMonitorOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="lg">
                                                <RiTerminalLine className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-3xl">
                                            <DialogHeader>
                                                <DialogTitle>Serial Monitor</DialogTitle>
                                                <DialogDescription>
                                                    Direct communication with DAEDALUS hardware
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="min-h-[400px] bg-black rounded-lg p-4 font-mono text-xs text-green-400">
                                                <p className="text-gray-500">
                                                    Serial monitor functionality available in dedicated view...
                                                </p>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            )}
                        </div>

                        {!canRunTest() && !loading && (
                            <p className="text-xs text-center text-destructive">
                                {!selectedAlgorithms.length ? "Select at least one algorithm" :
                                 !dimacsInput.trim() ? "Enter a DIMACS problem" :
                                 useDaedalus && !hardwareStatus?.connected ? "DAEDALUS hardware connection required" : ""}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="mt-6">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <RiInformationLine className="h-4 w-4" />
                            <CardTitle className="text-base">About Our SAT Solvers</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <p className="text-sm font-medium mb-1">Software Solvers</p>
                            <p className="text-sm text-muted-foreground">
                                MiniSAT uses the DPLL algorithm with conflict-driven clause learning for complete solving. 
                                WalkSAT employs stochastic local search for fast approximate solutions.
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium mb-1">DAEDALUS Hardware</p>
                            <p className="text-sm text-muted-foreground">
                                Our analog 3-SAT accelerator chip uses coupled oscillators to find satisfying assignments 
                                through energy minimization, offering potential speedups for certain problem classes through 
                                quantum-inspired classical computing.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}