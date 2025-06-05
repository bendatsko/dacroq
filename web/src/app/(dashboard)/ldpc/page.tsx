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
    RiCheckboxCircleLine,
    RiErrorWarningLine,
    RiTerminalLine,
    RiRefreshLine,
    RiStopLine,
    RiDeleteBinLine,
    RiCommandLine,
} from "@remixicon/react"
import { ChevronRight, Activity, Zap, MonitorSpeaker, ChevronDown } from "lucide-react"
import { toast } from "@/lib/toast-utils"
import { useRouter } from "next/navigation"
import { Slider } from "@/components/ui/slider"

// Quick command definitions for LDPC chip
const QUICK_COMMANDS = [
    {
        category: "Status & Info",
        commands: [
            { name: "Check Status", cmd: "STATUS", description: "Get hardware status" },
            { name: "Health Check", cmd: "HEALTH_CHECK", description: "Run health check" },
            { name: "Identify", cmd: "I", description: "Identify hardware" },
        ]
    },
    {
        category: "Visual Feedback",
        commands: [
            { name: "Blink LED", cmd: "BLINK", description: "Blink LED 3 times" },
            { name: "LED On", cmd: "LED:ON", description: "Turn LED on" },
            { name: "LED Off", cmd: "LED:OFF", description: "Turn LED off" },
            { name: "Error Blink", cmd: "LED:ERROR", description: "Fast error blink pattern" },
        ]
    },
    {
        category: "Test Commands",
        commands: [
            { name: "Simple Test", cmd: "SIMPLE_TEST:5:1", description: "Run single test at 5dB SNR" },
            { name: "Reset Test", cmd: "RESET", description: "Reset test state" },
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

export default function LDPCTestingInterface() {
    const router = useRouter()

    // Test configuration state
    const [loading, setLoading] = useState(false)
    const [testName, setTestName] = useState("")
    const [autoTestName, setAutoTestName] = useState("ldpc_test")
    const [startSNR, setStartSNR] = useState(5)
    const [endSNR, setEndSNR] = useState(7)
    const [runsPerSNR, setRunsPerSNR] = useState(1)
    
    // Algorithm configuration
    const [useDigitalBP, setUseDigitalBP] = useState(false)
    const [useHardware, setUseHardware] = useState(true)
    
    // Hardware status
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
            
            return `${username}_ldpc_hw_${startSNR}-${endSNR}dB_${hash}`
        } catch {
            return "ldpc_hw_" + Date.now().toString(36).slice(-6)
        }
    }

    // Update auto-generated name
    useEffect(() => {
        setAutoTestName(generateTestName())
    }, [startSNR, endSNR, useHardware])

    // Auto-scroll serial output
    useEffect(() => {
        if (autoScroll && serialOutputRef.current) {
            serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight
        }
    }, [serialOutput, autoScroll])

    // Load serial history from backend
    const loadSerialHistory = useCallback(async (showLoading = false) => {
        if (!useHardware) return
        
        if (showLoading) setLoadingHistory(true)
        try {
            const res = await fetch("/api/hardware/ldpc/serial-history")
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
            console.error("Failed to load serial history:", e)
        } finally {
            if (showLoading) setLoadingHistory(false)
        }
    }, [useHardware])

    // Add output to serial monitor (for new local messages)
    const addSerialOutput = useCallback((text: string) => {
        if (!componentMountedRef.current) return
        const timestamp = new Date().toLocaleTimeString()
        setSerialOutput(prev => [...prev, `[${timestamp}] ${text}`])
    }, [])

    // Check hardware status - optimized for faster responses
    const checkHardware = useCallback(async (isAutomatic = false) => {
        if (!useHardware) {
            if (!isAutomatic) {
                toast({ variant: "error", description: "Hardware testing is disabled" })
            }
            return false
        }

        if (checkingHardware) return false

        // Rate limiting - don't check more than once every 15 seconds for automatic checks
        const now = Date.now()
        if (isAutomatic && (now - lastHardwareCheckRef.current) < 15000) {
            return false
        }
        lastHardwareCheckRef.current = now

        setCheckingHardware(true)
        
        try {
            // First try fast hardware status check
            const statusRes = await fetch("/api/hardware/status", {
                method: "GET",
                signal: AbortSignal.timeout(5000) // 5 second timeout
            })
            
            if (statusRes.ok) {
                const statusData = await statusRes.json()
                if (statusData.ldpc_connected) {
                    setHardwareStatus({ connected: true, status: "ready", lastCheck: new Date().toISOString() })
                    setSerialConnected(true)
                    setHardwareCheckAttempts(0)
                    
                    if (!isAutomatic) {
                        toast({ variant: "success", description: "Hardware connected and ready" })
                    }
                    return true
                }
            }
            
            // Fallback to direct command if status shows disconnected
            const res = await fetch("/api/hardware/ldpc/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: "STATUS" }),
                signal: AbortSignal.timeout(8000) // 8 second timeout
            })
            
            const data = await res.json()
            if (res.ok && data.output?.includes("STATUS:READY")) {
                setHardwareStatus({ connected: true, status: "ready", lastCheck: new Date().toISOString() })
                setSerialConnected(true)
                setHardwareCheckAttempts(0)
                
                // Refresh serial history to get the latest communication
                await loadSerialHistory(false)
                
                if (!isAutomatic) {
                    toast({ variant: "success", description: "Hardware connected and ready" })
                }
                return true
            } else {
                throw new Error("Hardware not responding")
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
            
            if (!isAutomatic && !(e instanceof Error && e.name === 'TimeoutError')) {
                toast({ variant: "error", description: "Hardware not responding" })
            }
            return false
        } finally {
            setCheckingHardware(false)
        }
    }, [useHardware, checkingHardware, hardwareCheckAttempts, loadSerialHistory])

    // Automatic hardware checking when hardware is enabled - reduced frequency
    useEffect(() => {
        // Clear any existing interval
        if (hardwareCheckIntervalRef.current) {
            clearInterval(hardwareCheckIntervalRef.current)
        }

        if (useHardware) {
            // Initial load of serial history and check
            loadSerialHistory(!historyLoaded)
            checkHardware(true)
            
            // Set up periodic checking every 45 seconds (reduced frequency to prevent timeouts)
            hardwareCheckIntervalRef.current = setInterval(() => {
                if (componentMountedRef.current && useHardware) {
                    checkHardware(true)
                }
            }, 45000)
        } else {
            // Reset hardware status when hardware is disabled
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
    }, [useHardware, checkHardware, loadSerialHistory, historyLoaded])

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
            const res = await fetch("/api/hardware/ldpc/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: serialCommand.trim() })
            })
            
            const data = await res.json()
            
            // Refresh history to get the latest communication including our command
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

    // Trigger hardware discovery
    const discoverHardware = async () => {
        if (checkingHardware) return
        
        setCheckingHardware(true)
        try {
            const res = await fetch("/api/hardware/discover", {
                method: "POST",
                signal: AbortSignal.timeout(30000) // 30 second timeout for discovery
            })
            
            const data = await res.json()
            if (res.ok && data.success) {
                toast({ variant: "success", description: `Found ${Object.keys(data.discovered).length} devices` })
                // Refresh status after discovery
                await checkHardware(false)
            } else {
                toast({ variant: "error", description: data.error || "Discovery failed" })
            }
        } catch (e) {
            toast({ variant: "error", description: "Discovery timeout or error" })
        } finally {
            setCheckingHardware(false)
        }
    }

    // Run test with improved validation
    const runTest = async () => {
        if (!useHardware) {
            toast({ variant: "error", description: "Hardware testing is required for LDPC evaluation" })
            return
        }

        // Ensure hardware is connected
        if (!hardwareStatus?.connected) {
            addSerialOutput("🔍 Verifying hardware connection before starting test...")
            const hardwareReady = await checkHardware(false)
            
            if (!hardwareReady) {
                toast({ 
                    variant: "error", 
                    description: "Hardware not ready. Check connection and try again." 
                })
                return
            }
        }

        try {
            setLoading(true)
            const finalName = testName.trim() || autoTestName

            addSerialOutput(`🚀 Starting test: ${finalName}`)
            addSerialOutput(`📊 SNR Range: ${startSNR}dB to ${endSNR}dB`)
            addSerialOutput(`🔄 Runs per SNR: ${runsPerSNR}`)
            addSerialOutput(`🔧 Algorithm: Hardware (AMORGOS)`)

            const res = await fetch("/api/data/ldpc/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: finalName,
                    start_snr: startSNR,
                    end_snr: endSNR,
                    runs_per_snr: runsPerSNR,
                    algorithms: {
                        digital_bp: false,
                        hardware: true
                    }
                })
            })

            const data = await res.json()
            
            if (res.ok) {
                addSerialOutput(`✅ Test "${finalName}" started successfully!`)
                toast({ 
                    variant: "success", 
                    description: `Test "${finalName}" started successfully!` 
                })
                router.push("/dashboard")
            } else {
                addSerialOutput(`❌ Error: ${data.error || "Unknown error"}`)
                toast({ 
                    variant: "error", 
                    description: data.error || "Failed to start test" 
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
        if (!useHardware) return false
        if (!hardwareStatus?.connected) return false
        return true
    }

    // Get hardware status display
    const getHardwareStatusDisplay = () => {
        if (!useHardware) {
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
                    <h1 className="text-3xl font-bold text-foreground">LDPC Testing Interface</h1>
                    <p className="mt-2 text-muted-foreground">
                        Configure and run Low-Density Parity-Check decoder tests with digital and analog algorithms
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
                                    Test Configuration
                                </CardTitle>
                                <CardDescription>
                                    Configure test parameters and algorithm selection
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

                                {/* SNR Configuration */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-snr">Start SNR (dB)</Label>
                                        <Input
                                            id="start-snr"
                                            type="number"
                                            min="0"
                                            max="10"
                                            value={startSNR}
                                            onChange={(e) => setStartSNR(parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-snr">End SNR (dB)</Label>
                                        <Input
                                            id="end-snr"
                                            type="number"
                                            min="0"
                                            max="10"
                                            value={endSNR}
                                            onChange={(e) => setEndSNR(parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                {/* Runs per SNR */}
                                <div className="space-y-3">
                                    <Label htmlFor="runs-per-snr" className="flex items-center justify-between">
                                        Runs per SNR: {runsPerSNR}
                                    </Label>
                                    <Slider
                                        id="runs-per-snr"
                                        min={1}
                                        max={10}
                                        step={1}
                                        value={[runsPerSNR]}
                                        onValueChange={(value) => setRunsPerSNR(value[0])}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Each run processes 76,800 test vectors
                                    </p>
                                </div>

                                <hr className="border-border" />

                                {/* Algorithm Selection */}
                                <div className="space-y-4">
                                    <Label className="text-base font-medium">Algorithm Selection</Label>
                                    
                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                        <div className="space-y-1">
                                            <Label htmlFor="hardware" className="font-medium">Hardware (AMORGOS)</Label>
                                            <p className="text-sm text-muted-foreground">Analog oscillator-based LDPC decoder</p>
                                        </div>
                                        <Switch
                                            id="hardware"
                                            checked={useHardware}
                                            onCheckedChange={setUseHardware}
                                        />
                                    </div>

                                    {!useHardware && (
                                        <div className="ml-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                                ⚠️ Hardware testing is required for LDPC decoder evaluation. Digital simulation is not available.
                                            </p>
                                        </div>
                                    )}

                                    {useHardware && (
                                        <div className="ml-4 p-3 bg-muted/50 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Hardware testing requires Teensy 4.1 connection
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
                                            <span>SNR Range:</span>
                                            <Badge variant="outline">{startSNR}dB → {endSNR}dB</Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Vectors:</span>
                                            <Badge variant="outline">
                                                {((endSNR - startSNR + 1) * runsPerSNR * 76800).toLocaleString()}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Algorithm:</span>
                                            <Badge variant="outline">
                                                {useHardware ? "Hardware (AMORGOS)" : "None Selected"}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Hardware:</span>
                                            <Badge variant={useHardware ? "default" : "secondary"}>
                                                {useHardware ? "Required" : "Disabled"}
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
                                            Starting Test...
                                        </>
                                    ) : (
                                        <>
                                            <RiPlayLine className="mr-2 h-4 w-4" />
                                            Start LDPC Test
                                        </>
                                    )}
                                </Button>

                                {/* Help text for disabled button */}
                                {!canRunTest() && !loading && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        {!useHardware ? "Hardware testing is required" :
                                         !hardwareStatus?.connected ? "Hardware connection required" : ""}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT PANEL - Unified Hardware & Serial Monitor */}
                    <div className="space-y-6">
                        {/* Combined Hardware Status & Serial Monitor */}
                        <Card className="flex-1">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    <RiCpuLine className="h-5 w-5" />
                                    Hardware System
                                    {loadingHistory && <RiLoader4Line className="h-4 w-4 animate-spin ml-2" />}
                                </CardTitle>
                                <CardDescription>
                                    Monitor hardware connection and serial communication
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
                                            {useHardware && (
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={refreshHardware}
                                                        disabled={checkingHardware}
                                                        className="h-8 w-8 p-0"
                                                        title="Quick status check"
                                                    >
                                                        <RiRefreshLine className={`h-4 w-4 ${checkingHardware ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={discoverHardware}
                                                        disabled={checkingHardware}
                                                        className="h-8 px-2"
                                                        title="Full hardware discovery"
                                                    >
                                                        <RiCommandLine className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {useHardware && hardwareStatus?.lastCheck && (
                                        <p className="text-xs text-muted-foreground">
                                            Auto-checking every 30s • Last: {new Date(hardwareStatus.lastCheck).toLocaleTimeString()}
                                        </p>
                                    )}

                                    {!useHardware && (
                                        <p className="text-sm text-muted-foreground">
                                            Enable hardware testing to monitor connection status
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
                                                {useHardware ? "No communication yet..." : "Enable hardware to see serial output"}
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
                                                {QUICK_COMMANDS.map((category, idx) => (
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
                                                        {idx < QUICK_COMMANDS.length - 1 && <DropdownMenuSeparator />}
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