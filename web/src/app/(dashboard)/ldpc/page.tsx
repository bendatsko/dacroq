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
} from "@remixicon/react"
import { toast } from "@/lib/toast-utils"
import { useRouter } from "next/navigation"
import { Slider } from "@/components/ui/slider"

export default function LDPCTestingInterface() {
    const router = useRouter()

    // Test configuration state
    const [loading, setLoading] = useState(false)
    const [testName, setTestName] = useState("")
    const [autoTestName, setAutoTestName] = useState("ldpc_test")
    const [startSNR, setStartSNR] = useState(5)
    const [endSNR, setEndSNR] = useState(7)
    const [runsPerSNR, setRunsPerSNR] = useState(1)
    
    // Algorithm configuration - hardware only for LDPC
    const [useHardware, setUseHardware] = useState(true)
    
    // Hardware status
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
            
            return `${username}_ldpc_hw_${startSNR}-${endSNR}dB_${hash}`
        } catch {
            return "ldpc_hw_" + Date.now().toString(36).slice(-6)
        }
    }

    // Update auto-generated name
    useEffect(() => {
        setAutoTestName(generateTestName())
    }, [startSNR, endSNR])

    // Check hardware status
    const checkHardware = useCallback(async (isAutomatic = false) => {
        if (!useHardware || checkingHardware) return false

        setCheckingHardware(true)
        
        try {
            const res = await fetch("/api/proxy/ldpc/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: "STATUS" })
            })
            
            const data = await res.json()
            if (res.ok && data.output?.includes("STATUS:READY")) {
                setHardwareStatus({ connected: true, status: "ready", lastCheck: new Date().toISOString() })
                if (!isAutomatic) {
                    toast({ variant: "success", description: "Hardware connected and ready" })
                }
                return true
            } else {
                throw new Error("Hardware not responding")
            }
        } catch (e) {
            setHardwareStatus({ 
                connected: false, 
                status: "error", 
                lastCheck: new Date().toISOString(),
            })
            
            if (!isAutomatic) {
                toast({ variant: "error", description: "Hardware not responding" })
            }
            return false
        } finally {
            setCheckingHardware(false)
        }
    }, [useHardware, checkingHardware])

    // Automatic hardware checking
    useEffect(() => {
        if (hardwareCheckIntervalRef.current) {
            clearInterval(hardwareCheckIntervalRef.current)
        }

        if (useHardware) {
            checkHardware(true)
            
            hardwareCheckIntervalRef.current = setInterval(() => {
                if (componentMountedRef.current && useHardware) {
                    checkHardware(true)
                }
            }, 30000)
        }

        return () => {
            if (hardwareCheckIntervalRef.current) {
                clearInterval(hardwareCheckIntervalRef.current)
            }
        }
    }, [useHardware, checkHardware])

    // Cleanup on unmount
    useEffect(() => {
        componentMountedRef.current = true
        return () => {
            componentMountedRef.current = false
        }
    }, [])

    // Run test
    const runTest = async () => {
        if (!hardwareStatus?.connected) {
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

            const res = await fetch("/api/proxy/ldpc/jobs", {
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
                toast({ 
                    variant: "success", 
                    description: `Test "${finalName}" started successfully!` 
                })
                router.push("/dashboard")
            } else {
                toast({ 
                    variant: "error", 
                    description: data.error || "Failed to start test" 
                })
            }
        } catch (e) {
            toast({ variant: "error", description: "Connection error" })
        } finally {
            setLoading(false)
        }
    }

    const totalVectors = (endSNR - startSNR + 1) * runsPerSNR * 76800

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-4xl px-4 ">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">LDPC Testing</h1>
                    <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                        Configure and run AMORGOS analog LDPC decoder tests
                    </p>
                </div>

                {/* Main Configuration Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <RiSettings3Line className="h-5 w-5" />
                                <CardTitle>Test Configuration</CardTitle>
                            </div>
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
                        </div>
                        <CardDescription>
                            Set parameters for your LDPC decoding test
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

                        {/* SNR Configuration */}
                        <div className="space-y-4">
                            <Label className="text-base">Signal-to-Noise Ratio Range</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="start-snr" className="text-sm">Start SNR (dB)</Label>
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
                                    <Label htmlFor="end-snr" className="text-sm">End SNR (dB)</Label>
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
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="runs-per-snr" className="text-sm">
                                        Runs per SNR Point
                                    </Label>
                                    <span className="text-sm font-medium">{runsPerSNR}</span>
                                </div>
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
                        </div>

                        {/* Test Summary */}
                        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Total Test Vectors:</span>
                                <span className="font-mono font-medium">{totalVectors.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">SNR Points:</span>
                                <span className="font-mono font-medium">{endSNR - startSNR + 1}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Algorithm:</span>
                                <Badge variant="outline" className="font-mono">AMORGOS (Analog)</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Required Hardware:</span>
                                <Badge variant="outline">Teensy 4.1</Badge>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button 
                                onClick={runTest}
                                disabled={loading || !hardwareStatus?.connected}
                                className="flex-1"
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
                                                Direct communication with AMORGOS hardware
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
                        </div>

                        {!hardwareStatus?.connected && !loading && (
                            <p className="text-xs text-center text-destructive">
                                Hardware connection required to start test
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="mt-6">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <RiInformationLine className="h-4 w-4" />
                            <CardTitle className="text-base">About AMORGOS</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            AMORGOS is our analog oscillator-based LDPC decoder chip that leverages quantum-inspired 
                            classical computing principles. It uses coupled oscillators to solve the belief propagation 
                            algorithm in the analog domain, offering potential speedups over digital implementations 
                            for error correction in communication systems.

                            Check out the paper <a href="https://ieeexplore.ieee.org/document/10719549" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">here</a>.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}