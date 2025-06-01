/* ============================================================================
 *  ldpc.tsx – aesthetic-only refactor
 *  - Extra breathing-room between sections
 *  - “Custom Message” / “Pre-written Message” now lives in the same
 *    Test-Parameters card (styled like every other parameter)
 *  - Cleaner full-width Select / Input styling
 *  - Quick-remove (×) button for each active parameter
 *  No functional logic changed.
 * ==========================================================================*/

"use client"

import React, { useState, useEffect } from "react"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    RiLoader4Line,
    RiPlayLine,
    RiCloseLine,
    RiCpuLine,
    RiAddLine,
    RiCodeSSlashLine,
    RiFlashlightLine,
    RiSettings3Line,
} from "@remixicon/react"
import { Sparkles, ChevronRight } from "lucide-react"
import { toast } from "@/lib/toast-utils"
import { useRouter } from "next/navigation"
import { Slider } from "@/components/ui/slider"
import { motion, AnimatePresence } from "framer-motion"

/* -------------------------------------------------------------------------- */
/*                               PARAMETER META                               */
/* -------------------------------------------------------------------------- */

const PARAMETER_OPTIONS = {
    algorithm_type: {
        label: "Algorithm Type",
        type: "select",
        options: [
            {
                value: "analog_hardware",
                label: "Analog Hardware",
                description: "Energy-efficient oscillator-based decoder",
            },
            {
                value: "digital_hardware",
                label: "Digital Hardware",
                description: "Traditional belief-propagation decoder",
            },
        ],
        default: "digital_hardware",
        icon: <RiCpuLine className="h-4 w-4" />,
    },
    test_mode: {
        label: "Test Mode",
        type: "select",
        options: [
            { value: "custom_message", label: "Custom Message" },
            { value: "pre_written", label: "Pre-written Message" },
            { value: "random_string", label: "Random String" },
            { value: "ber_test", label: "BER Test" },
        ],
        default: "random_string",
        icon: <RiCodeSSlashLine className="h-4 w-4" />,
    },
    iterations: {
        label: "Max Iterations",
        type: "number",
        min: 1,
        max: 50,
        default: 10,
        description: "Maximum decoder iterations",
        icon: <RiSettings3Line className="h-4 w-4" />,
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
        icon: <RiFlashlightLine className="h-4 w-4" />,
    },
} as const

/* -------------------------------------------------------------------------- */
/*                          PRE-WRITTEN MESSAGE SET                           */
/* -------------------------------------------------------------------------- */

const preWrittenMessages = [
    {
        value: "hello_world",
        label: "Hello World",
        content:
            "Hello, World! This is a test message for LDPC error correction.",
    },
    {
        value: "lorem_ipsum",
        label: "Lorem Ipsum",
        content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    },
    {
        value: "technical",
        label: "Technical Text",
        content:
            "The Low-Density Parity-Check (LDPC) codes are highly efficient.",
    },
    {
        value: "quote",
        label: "Famous Quote",
        content:
            "The only way to do great work is to love what you do. – Steve Jobs",
    },
    {
        value: "pangram",
        label: "Pangram",
        content: "The quick brown fox jumps over the lazy dog.",
    },
]

/* ============================================================================
 *                              MAIN COMPONENT
 * ==========================================================================*/

export default function LDPCTestingInterface() {
    const router = useRouter()

    /* ------------------------------ state ------------------------------ */

    const [loading, setLoading] = useState(false)
    const [testName, setTestName] = useState("")
    const [customMessage, setCustomMessage] = useState("")
    const [selectedPreWritten, setSelectedPreWritten] = useState("")

    const [activeParameters, setActiveParameters] = useState<Record<string, any>>(
        {
            algorithm_type: PARAMETER_OPTIONS.algorithm_type.default,
            test_mode: PARAMETER_OPTIONS.test_mode.default,
        },
    )

    const [showParameterSelector, setShowParameterSelector] = useState(false)

    /* ------------------------- helpers / generators ------------------------- */

    const generateTestName = () => {
        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}")
            const email = user.email || "user@example.com"
            const username = email.split("@")[0]
            const hash = Date.now().toString(36).slice(-6)
            return `${username}_ldpc_${hash}`
        } catch {
            return "ldpc_" + Date.now().toString(36).slice(-6)
        }
    }

    /* --------------------------- parameter logic ---------------------------- */

    const addParameter = (key: string) => {
        setActiveParameters((p) => ({
            ...p,
            [key]: PARAMETER_OPTIONS[key as keyof typeof PARAMETER_OPTIONS].default,
        }))
        setShowParameterSelector(false)
    }

    const removeParameter = (key: string) => {
        setActiveParameters((p) => {
            const clone = { ...p }
            delete clone[key]
            return clone
        })
    }

    const updateParameter = (key: string, val: any) =>
        setActiveParameters((p) => ({ ...p, [key]: val }))

    /* ------------------------- parameter controls UI ------------------------ */

    const renderParameterControl = (
        key: string,
        config: (typeof PARAMETER_OPTIONS)[keyof typeof PARAMETER_OPTIONS],
    ) => {
        const value = activeParameters[key]

        switch (config.type) {
            case "select":
                return (
                    <Select
                        value={value}
                        onValueChange={(v) => updateParameter(key, v)}
                    >
                        <SelectTrigger className="h-11 w-full rounded-md border border-input bg-background focus:ring-2 focus:ring-ring">
                            <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                            {config.options.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">{o.label}</span>
                                        {o.description && (
                                            <span className="text-xs text-muted-foreground">
                        {o.description}
                      </span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )

            case "number":
                return (
                    <Input
                        type="number"
                        min={config.min}
                        max={config.max}
                        value={value}
                        onChange={(e) =>
                            updateParameter(key, parseInt(e.target.value) || config.min)
                        }
                        className="h-11 w-full"
                    />
                )

            case "slider":
                return (
                    <div className="space-y-2">
            <span className="text-sm text-muted-foreground">
              {value}
                {config.unit}
            </span>
                        <Slider
                            value={[value]}
                            min={config.min}
                            max={config.max}
                            step={config.step}
                            onValueChange={([val]) => updateParameter(key, val)}
                        />
                    </div>
                )

            default:
                return null
        }
    }

    /* ----------------------------- run test ----------------------------- */

    const runTest = async () => {
        try {
            setLoading(true)
            const finalName = testName.trim() || generateTestName()

            const res = await fetch("/api/proxy/ldpc/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: finalName,
                    algorithm_type: activeParameters.algorithm_type,
                    test_mode: activeParameters.test_mode,
                    message_content:
                        activeParameters.test_mode === "custom_message"
                            ? customMessage
                            : activeParameters.test_mode === "pre_written"
                                ? preWrittenMessages.find((m) => m.value === selectedPreWritten)
                                    ?.content
                                : undefined,
                    ...activeParameters,
                }),
            })

            const json = await res.json()

            if (res.ok) {
                toast({ variant: "success", description: `"${finalName}" started!` })
                setTestName("")
                setCustomMessage("")
                setSelectedPreWritten("")
                setTimeout(() => router.push("/dashboard"), 1000)
            } else {
                toast({ variant: "error", description: json.error || "Failed" })
            }
        } catch {
            toast({ variant: "error", description: "Error starting test" })
        } finally {
            setLoading(false)
        }
    }

    /* =========================================================================
     *                                 RENDER
     * =======================================================================*/

    return (
        <div className="page-container">
            <div className="mx-auto max-w-4xl space-y-10 py-10 px-4">
                {/* --------------------------- header --------------------------- */}
                <div className="text-center">
                    <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-muted p-3">
                        <Sparkles className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h1 className="mb-4 text-4xl font-bold text-foreground">
                        LDPC Error Correction
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Evaluate message-level error correction with analog/digital
                        acceleration.
                    </p>
                </div>

                {/* ---------------------- configuration card --------------------- */}
                <Card className="card-elevated">
                    <CardHeader className="border-b border-border">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <RiSettings3Line className="h-5 w-5" />
                            Test Configuration
                        </CardTitle>
                        <CardDescription>
                            Fine-tune parameters for your LDPC run.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 p-6">
                        {/* ----------------------- test name ----------------------- */}
                        <div className="space-y-2">
                            <Label>Test Name</Label>
                            <Input
                                placeholder={`Auto: ${generateTestName()}`}
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                                className="h-11"
                            />
                        </div>

                        {/* -------------------- parameters header ------------------- */}
                        <div className="flex items-center justify-between">
                            <Label>Test Parameters</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setShowParameterSelector((s) => !s)}
                            >
                                <RiAddLine className="h-4 w-4" />
                                Add Parameter
                            </Button>
                        </div>

                        {/* --------------- parameter quick-add grid ---------------- */}
                        <AnimatePresence>
                            {showParameterSelector && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="rounded-lg border-2 border-dashed border-border p-4">
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(PARAMETER_OPTIONS).map(([k, cfg]) =>
                                                activeParameters[k] ? null : (
                                                    <Button
                                                        key={k}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-auto justify-start gap-2 p-3"
                                                        onClick={() => addParameter(k)}
                                                    >
                                                        {cfg.icon}
                                                        <span>{cfg.label}</span>
                                                    </Button>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ---------------- active parameter list ----------------- */}
                        <div className="space-y-4">
                            {Object.entries(activeParameters).map(([key]) => {
                                const cfg =
                                    PARAMETER_OPTIONS[key as keyof typeof PARAMETER_OPTIONS]
                                if (!cfg) return null

                                return (
                                    <motion.div
                                        key={key}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-3 rounded-lg bg-muted/50 p-4"
                                    >
                                        {/* header row */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-background p-2">
                                                    {cfg.icon}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-foreground">
                                                        {cfg.label}
                                                    </h4>
                                                    {"description" in cfg && cfg.description && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {cfg.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* remove parameter */}
                                            {!(key === "algorithm_type" || key === "test_mode") && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => removeParameter(key)}
                                                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                >
                                                    <RiCloseLine className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>

                                        {/* control */}
                                        <div className="pl-12">
                                            {renderParameterControl(key, cfg)}
                                        </div>
                                    </motion.div>
                                )
                            })}

                            {/* -------- custom / pre-written message controls -------- */}
                            {activeParameters.test_mode === "custom_message" && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-2 rounded-lg bg-muted/50 p-4 pl-12"
                                >
                                    <Label>Custom Message</Label>
                                    <Input
                                        value={customMessage}
                                        onChange={(e) => setCustomMessage(e.target.value)}
                                        placeholder="Enter your message…"
                                        className="h-11"
                                    />
                                </motion.div>
                            )}

                            {activeParameters.test_mode === "pre_written" && (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-4 rounded-lg bg-muted/50 p-4 pl-12"
                                >
                                    <div className="space-y-2">
                                        <Label>Select Message</Label>
                                        <Select
                                            value={selectedPreWritten}
                                            onValueChange={setSelectedPreWritten}
                                        >
                                            <SelectTrigger className="h-11 w-full rounded-md border border-input bg-background focus:ring-2 focus:ring-ring">
                                                <SelectValue placeholder="Choose…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {preWrittenMessages.map((m) => (
                                                    <SelectItem key={m.value} value={m.value}>
                                                        <div className="flex flex-col items-start">
                                                            <span className="font-medium">{m.label}</span>
                                                            <span className="line-clamp-1 text-xs text-muted-foreground">
                                {m.content}
                              </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {selectedPreWritten && (
                                        <div className="rounded-lg bg-muted p-3">
                                            <p className="text-sm text-muted-foreground">
                                                {
                                                    preWrittenMessages.find(
                                                        (m) => m.value === selectedPreWritten,
                                                    )?.content
                                                }
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>

                        {/* ----------------------- run button ----------------------- */}
                        <div className="flex justify-end pt-2">
                            <Button
                                size="lg"
                                disabled={
                                    loading ||
                                    (activeParameters.test_mode === "custom_message" &&
                                        !customMessage.trim()) ||
                                    (activeParameters.test_mode === "pre_written" &&
                                        !selectedPreWritten)
                                }
                                onClick={runTest}
                                className="h-12 gap-2 px-8"
                            >
                                {loading ? (
                                    <>
                                        <RiLoader4Line className="h-5 w-5 animate-spin" />
                                        Running…
                                    </>
                                ) : (
                                    <>
                                        <RiPlayLine className="h-5 w-5" />
                                        Run Test
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
