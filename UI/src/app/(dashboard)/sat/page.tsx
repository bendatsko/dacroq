/* ============================================================================
 *  sat.tsx – refreshed UI (monochrome, spacious, flexible input modes)
 *  - Consistent styling with LDPC screen
 *  - “Input Mode” parameter: Custom CNF | Example Library | Random 3-SAT
 *  - Full-width Select / Input aesthetics
 *  - Quick-remove (×) on non-core parameters
 *  - Default CNF pre-filled so users never start with an empty box
 *  No backend logic altered; purely front-end quality-of-life.
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
    RiAddLine,
    RiCodeSSlashLine,
    RiSettings3Line,
} from "@remixicon/react"
import { toast } from "@/lib/toast-utils"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Slider } from "@/components/ui/slider"
import { ChevronRight, Sparkles } from "lucide-react"

/* -------------------------------------------------------------------------- */
/*                             EXAMPLE LIBRARY                                */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                           PARAMETER DEFINITIONS                            */
/* -------------------------------------------------------------------------- */

const PARAMETER_OPTIONS = {
    solver_type: {
        label: "Solver Type",
        type: "select",
        options: [
            { value: "WalkSAT", label: "WalkSAT (Digital)" },
            { value: "Daedalus", label: "Daedalus (Analog)" },
        ],
        default: "WalkSAT",
        icon: <RiCodeSSlashLine className="h-4 w-4" />,
    },

    input_mode: {
        label: "Input Mode",
        type: "select",
        options: [
            { value: "custom", label: "Custom CNF" },
            { value: "example", label: "Example Library" },
            { value: "random", label: "Random 3-SAT" },
        ],
        default: "custom",
        icon: <RiSettings3Line className="h-4 w-4" />,
    },
} as const

/* ---------------------------- random generator ---------------------------- */

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

/* ============================================================================
 *                           MAIN COMPONENT
 * ==========================================================================*/

export default function SATTestingInterface() {
    const router = useRouter()

    /* ------------------------------ state ------------------------------ */

    const [loading, setLoading] = useState(false)

    const [testName, setTestName] = useState("")
    const [dimacsInput, setDimacsInput] = useState(
        `c Default 3-SAT\np cnf 3 2\n1 -3 0\n2 3 -1 0`,
    )

    const [selectedExample, setSelectedExample] = useState("")

    const [activeParameters, setActiveParameters] = useState<Record<string, any>>(
        {
            solver_type: PARAMETER_OPTIONS.solver_type.default,
            input_mode: PARAMETER_OPTIONS.input_mode.default,
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
            return `${username}_sat_${hash}`
        } catch {
            return "sat_" + Date.now().toString(36).slice(-6)
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
        cfg: (typeof PARAMETER_OPTIONS)[keyof typeof PARAMETER_OPTIONS],
    ) => {
        const val = activeParameters[key]

        switch (cfg.type) {
            case "select":
                return (
                    <Select value={val} onValueChange={(v) => updateParameter(key, v)}>
                        <SelectTrigger className="h-11 w-full rounded-md border border-input bg-background focus:ring-2 focus:ring-ring">
                            <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                            {cfg.options.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )
            default:
                return null
        }
    }

    /* ------------------------------- effects ------------------------------- */

    /* React to input_mode changes */
    useEffect(() => {
        if (activeParameters.input_mode === "custom") {
            // keep whatever is in textarea
        } else if (activeParameters.input_mode === "example") {
            const ex = EXAMPLES[0]
            setSelectedExample(ex.value)
            setDimacsInput(ex.dimacs)
        } else if (activeParameters.input_mode === "random") {
            setDimacsInput(generateRandom3SAT())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeParameters.input_mode])

    /* ----------------------------- run solver ----------------------------- */

    const runTest = async () => {
        try {
            setLoading(true)
            const finalName = testName.trim() || generateTestName()

            const res = await fetch("/api/proxy/sat/solve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: finalName,
                    dimacs: dimacsInput,
                    ...activeParameters,
                }),
            })

            const json = await res.json()

            if (res.ok) {
                toast({ variant: "success", description: `"${finalName}" queued!` })
                setTestName("")
                router.push("/dashboard")
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
                    <h1 className="mb-4 text-4xl font-bold text-foreground">SAT Solver</h1>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        Solve Boolean satisfiability problems with advanced algorithms and
                        hardware acceleration.
                    </p>
                </div>

                {/* ---------------------- configuration card --------------------- */}
                <Card className="card-elevated">
                    <CardHeader className="border-b border-border">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <RiSettings3Line className="h-5 w-5" />
                            SAT Problem Configuration
                        </CardTitle>
                        <CardDescription>
                            Paste CNF, pick an example, or auto-generate – then pick your
                            solver.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-10 p-6">
                        {/* --------------------- test name --------------------- */}
                        <div className="space-y-2">
                            <Label>Test Name</Label>
                            <Input
                                placeholder={`Auto: ${generateTestName()}`}
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                                className="h-11"
                            />
                        </div>

                        {/* ---------------- parameters header ---------------- */}
                        <div className="flex items-center justify-between">
                            <Label>Solver Parameters</Label>
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

                        {/* ---------- parameter quick-add grid (hidden) --------- */}
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

                        {/* ---------------- active parameter list --------------- */}
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
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-background p-2">
                                                    {cfg.icon}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-foreground">
                                                        {cfg.label}
                                                    </h4>
                                                </div>
                                            </div>

                                            {/* removable? */}
                                            {!(key === "solver_type" || key === "input_mode") && (
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
                                        <div className="pl-12">{renderParameterControl(key, cfg)}</div>
                                    </motion.div>
                                )
                            })}
                        </div>

                        {/* ---------------- input mode sections --------------- */}
                        {activeParameters.input_mode === "example" && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-2 rounded-lg bg-muted/50 p-4"
                            >
                                <Label>Choose Example</Label>
                                <Select
                                    value={selectedExample}
                                    onValueChange={(v) => {
                                        setSelectedExample(v)
                                        const ex = EXAMPLES.find((e) => e.value === v)
                                        if (ex) setDimacsInput(ex.dimacs)
                                    }}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-md border border-input bg-background focus:ring-2 focus:ring-ring">
                                        <SelectValue placeholder="Select example…" />
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
                            </motion.div>
                        )}

                        {/* ---- textarea (always shown for preview / edits) ---- */}
                        <div className="space-y-2">
                            <Label>DIMACS CNF</Label>
                            <textarea
                                value={dimacsInput}
                                onChange={(e) => setDimacsInput(e.target.value)}
                                className="h-40 w-full resize-none rounded-lg border border-border bg-foreground/5 p-3 font-mono text-sm text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        {/* ----------------------- run button ----------------------- */}
                        <div className="flex justify-end pt-2">
                            <Button
                                size="lg"
                                disabled={loading || !dimacsInput.trim()}
                                onClick={runTest}
                                className="h-12 gap-2 px-8"
                            >
                                {loading ? (
                                    <>
                                        <RiLoader4Line className="h-5 w-5 animate-spin" />
                                        Solving…
                                    </>
                                ) : (
                                    <>
                                        <RiPlayLine className="h-5 w-5" />
                                        Solve Problem
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
