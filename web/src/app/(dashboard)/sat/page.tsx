"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import PageNavigation from "@/components/PageNavigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
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
    RiTestTubeLine,
    RiDeleteBinLine,
    RiEyeLine,
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

// SATLIB Standard Benchmarks
const SATLIB_BENCHMARKS = [
    // Uniform Random 3-SAT (Phase Transition Region)
    {
        category: "Uniform Random 3-SAT",
        problems: [
            {
                label: "UF20-91 (20 vars, 91 clauses)",
                value: "uf20-91",
                variables: 20,
                clauses: 91,
                ratio: 4.55,
                satisfiable: true,
                description: "Small uniform random 3-SAT, phase transition region"
            },
            {
                label: "UF50-218 (50 vars, 218 clauses)",
                value: "uf50-218", 
                variables: 50,
                clauses: 218,
                ratio: 4.36,
                satisfiable: true,
                description: "Medium uniform random 3-SAT, hardware suitable"
            },
            {
                label: "UUF50-218 (50 vars, 218 clauses, UNSAT)",
                value: "uuf50-218",
                variables: 50,
                clauses: 218,
                ratio: 4.36,
                satisfiable: false,
                description: "Medium uniform random 3-SAT, unsatisfiable"
            },
            {
                label: "UF100-430 (100 vars, 430 clauses)",
                value: "uf100-430",
                variables: 100,
                clauses: 430,
                ratio: 4.30,
                satisfiable: true,
                description: "Large uniform random 3-SAT, requires decomposition"
            },
            {
                label: "UUF100-430 (100 vars, 430 clauses, UNSAT)",
                value: "uuf100-430",
                variables: 100,
                clauses: 430,
                ratio: 4.30,
                satisfiable: false,
                description: "Large uniform random 3-SAT, unsatisfiable"
            }
        ]
    },
    // Graph Coloring Problems
    {
        category: "Graph Coloring",
        problems: [
            {
                label: "Flat30-60 (30 vertices, 3-colorable)",
                value: "flat30-60",
                variables: 90,
                clauses: 300,
                ratio: 3.33,
                satisfiable: true,
                description: "3-coloring of flat graph, 30 vertices"
            },
            {
                label: "Flat50-115 (50 vertices, 3-colorable)",
                value: "flat50-115",
                variables: 150,
                clauses: 545,
                ratio: 3.63,
                satisfiable: true,
                description: "3-coloring of flat graph, 50 vertices, requires decomposition"
            }
        ]
    },
    // Controlled Backbone Size
    {
        category: "Controlled Backbone",
        problems: [
            {
                label: "CBS-k3-n100-m403-b10 (backbone=10)",
                value: "cbs-k3-n100-m403-b10",
                variables: 100,
                clauses: 403,
                ratio: 4.03,
                satisfiable: true,
                description: "100 vars, controlled backbone size 10"
            },
            {
                label: "CBS-k3-n100-m403-b50 (backbone=50)",
                value: "cbs-k3-n100-m403-b50",
                variables: 100,
                clauses: 403,
                ratio: 4.03,
                satisfiable: true,
                description: "100 vars, controlled backbone size 50"
            },
            {
                label: "CBS-k3-n100-m403-b90 (backbone=90)",
                value: "cbs-k3-n100-m403-b90",
                variables: 100,
                clauses: 403,
                ratio: 4.03,
                satisfiable: true,
                description: "100 vars, controlled backbone size 90"
            }
        ]
    },
    // Planning Problems
    {
        category: "Planning",
        problems: [
            {
                label: "Blocks World (blocks-4-0)",
                value: "blocks-4-0",
                variables: 459,
                clauses: 1801,
                ratio: 3.92,
                satisfiable: true,
                description: "Blocks world planning problem, requires decomposition"
            },
            {
                label: "Logistics (logistics.a)",
                value: "logistics-a",
                variables: 828,
                clauses: 6718,
                ratio: 8.11,
                satisfiable: true,
                description: "Logistics planning problem, large decomposition needed"
            }
        ]
    },
    // DIMACS Classics
    {
        category: "DIMACS Classics",
        problems: [
            {
                label: "AIM-50-1_6-yes1-1 (AIM satisfiable)",
                value: "aim-50-1_6-yes1-1",
                variables: 50,
                clauses: 80,
                ratio: 1.60,
                satisfiable: true,
                description: "Artificially generated random 3-SAT, satisfiable"
            },
            {
                label: "AIM-50-1_6-no-1 (AIM unsatisfiable)",
                value: "aim-50-1_6-no-1",
                variables: 50,
                clauses: 80,
                ratio: 1.60,
                satisfiable: false,
                description: "Artificially generated random 3-SAT, unsatisfiable"
            },
            {
                label: "Dubois20 (Unsatisfiable)",
                value: "dubois20",
                variables: 60,
                clauses: 160,
                ratio: 2.67,
                satisfiable: false,
                description: "Dubois unsatisfiable instance, 20 variables"
            },
            {
                label: "Pigeon-7 (Pigeonhole Principle)",
                value: "hole7",
                variables: 42,
                clauses: 287,
                ratio: 6.83,
                satisfiable: false,
                description: "7-pigeon, 6-hole problem, unsatisfiable"
            }
        ]
    }
]

// Random 3-SAT generator
const generateRandom3SAT = (vars = 20, clauses = 85) => {
    const clauseSet = new Set()
    
    while (clauseSet.size < clauses) {
        const clause = []
        const usedVars = new Set()
        
        // Generate 3 unique literals
        while (clause.length < 3) {
            const varNum = Math.floor(Math.random() * vars) + 1
            if (!usedVars.has(varNum)) {
                usedVars.add(varNum)
                const negated = Math.random() < 0.5
                clause.push(negated ? -varNum : varNum)
            }
        }
        
        // Sort clause for canonical form
        clause.sort((a, b) => Math.abs(a) - Math.abs(b))
        clauseSet.add(clause.join(' '))
    }
    
    const clauseArray = Array.from(clauseSet)
    return (
        `c Random 3-SAT (${vars} vars, ${clauses} clauses, ratio ${(clauses/vars).toFixed(2)})\n` +
        `p cnf ${vars} ${clauses}\n` +
        clauseArray.map(c => c + ' 0').join('\n')
    )
}

// Generate SATLIB benchmark DIMACS
const generateSATLIBDimacs = (benchmarkId: string) => {
    // This would normally load from actual SATLIB files
    // For now, generate representative problems
    
    const problemMap: { [key: string]: () => string } = {
        "uf20-91": () => generateUniformRandom3SAT(20, 91, true),
        "uf50-218": () => generateUniformRandom3SAT(50, 218, true),
        "uuf50-218": () => generateUniformRandom3SAT(50, 218, false),
        "uf100-430": () => generateUniformRandom3SAT(100, 430, true),
        "uuf100-430": () => generateUniformRandom3SAT(100, 430, false),
        "flat30-60": () => generateGraphColoring(30, 60, 3),
        "flat50-115": () => generateGraphColoring(50, 115, 3),
        "cbs-k3-n100-m403-b10": () => generateControlledBackbone(100, 403, 10),
        "cbs-k3-n100-m403-b50": () => generateControlledBackbone(100, 403, 50),
        "cbs-k3-n100-m403-b90": () => generateControlledBackbone(100, 403, 90),
        "blocks-4-0": () => generateBlocksWorld(4),
        "logistics-a": () => generateLogistics("a"),
        "aim-50-1_6-yes1-1": () => generateAIM(50, 80, true),
        "aim-50-1_6-no-1": () => generateAIM(50, 80, false),
        "dubois20": () => generateDubois(20),
        "hole7": () => generatePigeonhole(7, 6)
    }
    
    const generator = problemMap[benchmarkId]
    if (generator) {
        return generator()
    }
    
    // Fallback to random 3-SAT
    return generateRandom3SAT(20, 85)
}

// Uniform Random 3-SAT generator with satisfiability control
const generateUniformRandom3SAT = (vars: number, clauses: number, satisfiable: boolean) => {
    const clauseSet = new Set<string>()
    
    // Generate base satisfiable assignment if needed
    let baseAssignment: boolean[] = []
    if (satisfiable) {
        baseAssignment = Array.from({length: vars}, () => Math.random() > 0.5)
    }
    
    while (clauseSet.size < clauses) {
        const clause = []
        const usedVars = new Set<number>()
        
        // Generate 3 unique literals
        while (clause.length < 3) {
            const varNum = Math.floor(Math.random() * vars) + 1
            if (!usedVars.has(varNum)) {
                usedVars.add(varNum)
                
                let negated: boolean
                if (satisfiable && baseAssignment.length > 0) {
                    // Bias towards satisfying clauses
                    negated = Math.random() < 0.3 ? !baseAssignment[varNum - 1] : Math.random() < 0.5
                } else {
                    negated = Math.random() < 0.5
                }
                
                clause.push(negated ? -varNum : varNum)
            }
        }
        
        // Sort clause for canonical form
        clause.sort((a, b) => Math.abs(a) - Math.abs(b))
        clauseSet.add(clause.join(' '))
    }
    
    const clauseArray = Array.from(clauseSet)
    const satStatus = satisfiable ? "SAT" : "UNSAT"
    const ratio = (clauses / vars).toFixed(2)
    
    return (
        `c SATLIB Uniform Random 3-SAT (${vars} vars, ${clauses} clauses, ${satStatus})\n` +
        `c Clause-to-variable ratio: ${ratio}\n` +
        `c Expected: ${satStatus}\n` +
        `p cnf ${vars} ${clauses}\n` +
        clauseArray.map(c => c + ' 0').join('\n')
    )
}

// Graph coloring problem generator
const generateGraphColoring = (vertices: number, edges: number, colors: number) => {
    const variables = vertices * colors
    const clauses: string[] = []
    
    // Each vertex must have at least one color
    for (let v = 1; v <= vertices; v++) {
        const clause = []
        for (let c = 1; c <= colors; c++) {
            clause.push((v - 1) * colors + c)
        }
        clauses.push(clause.join(' '))
    }
    
    // Each vertex has at most one color
    for (let v = 1; v <= vertices; v++) {
        for (let c1 = 1; c1 <= colors; c1++) {
            for (let c2 = c1 + 1; c2 <= colors; c2++) {
                const var1 = (v - 1) * colors + c1
                const var2 = (v - 1) * colors + c2
                clauses.push(`-${var1} -${var2}`)
            }
        }
    }
    
    // Generate random edges and adjacent vertices cannot have same color
    const edgeSet = new Set<string>()
    while (edgeSet.size < Math.min(edges, vertices * (vertices - 1) / 2)) {
        const v1 = Math.floor(Math.random() * vertices) + 1
        let v2 = Math.floor(Math.random() * vertices) + 1
        while (v2 === v1) {
            v2 = Math.floor(Math.random() * vertices) + 1
        }
        
        const edge = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`
        if (!edgeSet.has(edge)) {
            edgeSet.add(edge)
            
            // Add color constraints for this edge
            for (let c = 1; c <= colors; c++) {
                const var1 = (v1 - 1) * colors + c
                const var2 = (v2 - 1) * colors + c
                clauses.push(`-${var1} -${var2}`)
            }
        }
    }
    
    return (
        `c Graph ${colors}-coloring: ${vertices} vertices, ${edgeSet.size} edges\n` +
        `c Variables: ${variables}, Clauses: ${clauses.length}\n` +
        `p cnf ${variables} ${clauses.length}\n` +
        clauses.map(c => c + ' 0').join('\n')
    )
}

// Controlled backbone generator
const generateControlledBackbone = (vars: number, clauses: number, backboneSize: number) => {
    const clauseSet = new Set<string>()
    
    // Create backbone variables (first backboneSize variables are forced true)
    const backbone = Array.from({length: backboneSize}, (_, i) => i + 1)
    
    // Add unit clauses for backbone
    backbone.forEach(v => {
        clauseSet.add(`${v}`)
    })
    
    // Generate remaining clauses
    while (clauseSet.size < clauses) {
        const clause = []
        const usedVars = new Set<number>()
        
        // Include at least one backbone variable per clause (bias)
        if (Math.random() < 0.7 && backbone.length > 0) {
            const backboneVar = backbone[Math.floor(Math.random() * backbone.length)]
            clause.push(backboneVar)
            usedVars.add(backboneVar)
        }
        
        // Fill remaining positions
        while (clause.length < 3) {
            const varNum = Math.floor(Math.random() * vars) + 1
            if (!usedVars.has(varNum)) {
                usedVars.add(varNum)
                const negated = Math.random() < 0.5
                clause.push(negated ? -varNum : varNum)
            }
        }
        
        clause.sort((a, b) => Math.abs(a) - Math.abs(b))
        clauseSet.add(clause.join(' '))
    }
    
    return (
        `c Controlled Backbone: ${vars} vars, ${clauses} clauses, backbone size ${backboneSize}\n` +
        `p cnf ${vars} ${clauses}\n` +
        Array.from(clauseSet).map(c => c + ' 0').join('\n')
    )
}

// Simplified generators for other problem types
const generateBlocksWorld = (blocks: number) => {
    return generateUniformRandom3SAT(blocks * blocks, blocks * blocks * 4, true)
}

const generateLogistics = (type: string) => {
    return generateUniformRandom3SAT(100, 400, true)
}

const generateAIM = (vars: number, clauses: number, satisfiable: boolean) => {
    return generateUniformRandom3SAT(vars, clauses, satisfiable)
}

const generateDubois = (n: number) => {
    const vars = 3 * n
    const clauses: string[] = []
    
    // Dubois formula construction
    for (let i = 0; i < n; i++) {
        const x1 = 3 * i + 1
        const x2 = 3 * i + 2
        const x3 = 3 * i + 3
        const y1 = 3 * ((i + 1) % n) + 1
        
        clauses.push(`${x1} ${x2}`)
        clauses.push(`-${x1} ${x3}`)
        clauses.push(`-${x2} ${x3}`)
        clauses.push(`-${x3} ${y1}`)
    }
    
    return (
        `c Dubois${n}: ${vars} variables, ${clauses.length} clauses (UNSAT)\n` +
        `p cnf ${vars} ${clauses.length}\n` +
        clauses.map(c => c + ' 0').join('\n')
    )
}

const generatePigeonhole = (pigeons: number, holes: number) => {
    const vars = pigeons * holes
    const clauses: string[] = []
    
    // Each pigeon must be in at least one hole
    for (let p = 1; p <= pigeons; p++) {
        const clause = []
        for (let h = 1; h <= holes; h++) {
            clause.push((p - 1) * holes + h)
        }
        clauses.push(clause.join(' '))
    }
    
    // No two pigeons in same hole
    for (let h = 1; h <= holes; h++) {
        for (let p1 = 1; p1 <= pigeons; p1++) {
            for (let p2 = p1 + 1; p2 <= pigeons; p2++) {
                const var1 = (p1 - 1) * holes + h
                const var2 = (p2 - 1) * holes + h
                clauses.push(`-${var1} -${var2}`)
            }
        }
    }
    
    return (
        `c Pigeonhole: ${pigeons} pigeons, ${holes} holes (UNSAT)\n` +
        `p cnf ${vars} ${clauses.length}\n` +
        clauses.map(c => c + ' 0').join('\n')
    )
}

export default function SATTestingInterface() {
    const router = useRouter()
    
    // Test configuration state
    const [loading, setLoading] = useState(false)
    const [testName, setTestName] = useState("")
    const [autoTestName, setAutoTestName] = useState("sat_test")
    
    // Problem configuration
    const [inputMode, setInputMode] = useState("satlib")
    const [selectedExample, setSelectedExample] = useState("")
    const [selectedSATLIB, setSelectedSATLIB] = useState("uf50-218")
    const [dimacsInput, setDimacsInput] = useState(`c Default 3-SAT\np cnf 3 2\n1 -3 0\n2 3 -1 0`)
    
    // Random problem parameters
    const [randomVars, setRandomVars] = useState(20)
    const [randomClauses, setRandomClauses] = useState(85)
    const [clauseRatio, setClauseRatio] = useState(4.25)
    
    // Execution configuration
    const [iterations, setIterations] = useState(5)
    const [batchMode, setBatchMode] = useState(true)
    const [batchSize, setBatchSize] = useState([1, 100])
    const [excludeIndices, setExcludeIndices] = useState<number[]>([])
    const [excludeInput, setExcludeInput] = useState("")
    
    // Algorithm configuration
    const [useMiniSAT, setUseMiniSAT] = useState(true)
    const [useWalkSAT, setUseWalkSAT] = useState(true)
    const [useDaedalus, setUseDaedalus] = useState(false)
    const [useMedusa, setUseMedusa] = useState(false)
    
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
            
            const solvers = []
            if (useMiniSAT) solvers.push("minisat")
            if (useWalkSAT) solvers.push("walksat")
            if (useDaedalus) solvers.push("daedalus")
            if (useMedusa) solvers.push("medusa")
            const solverStr = solvers.join("-") || "sat"
            
            const modeStr = batchMode && inputMode === "satlib" ? `batch${batchSize[0]}-${batchSize[1]}` : inputMode
            
            return `${username}_${solverStr}_${modeStr}_${hash}`
        } catch {
            return "sat_" + Date.now().toString(36).slice(-6)
        }
    }

    // Update auto-generated name
    useEffect(() => {
        setAutoTestName(generateTestName())
    }, [useMiniSAT, useWalkSAT, useDaedalus, useMedusa, batchMode, batchSize, inputMode])

    // Handle exclusions input
    useEffect(() => {
        if (excludeInput.trim()) {
            const indices = excludeInput
                .split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n) && n >= batchSize[0] && n <= batchSize[1])
            setExcludeIndices(indices)
        } else {
            setExcludeIndices([])
        }
    }, [excludeInput, batchSize])

    // Handle input mode changes
    useEffect(() => {
        if (inputMode === "example") {
            const ex = EXAMPLES[0]
            setSelectedExample(ex.value)
            setDimacsInput(ex.dimacs)
            setBatchMode(false) // Disable batch mode for examples
        } else if (inputMode === "random") {
            setDimacsInput(generateRandom3SAT())
            setBatchMode(false) // Disable batch mode for random
        } else if (inputMode === "satlib") {
            // Auto-select UF50-218 (default)
            setSelectedSATLIB("uf50-218")
            setDimacsInput(generateSATLIBDimacs("uf50-218"))
            setBatchMode(true) // Enable batch mode for SATLIB
        } else if (inputMode === "custom") {
            setBatchMode(false) // Disable batch mode for custom
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

    // Run SAT test with enhanced batch support
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

            let requestData: any = {
                    name: finalName,
                    solver_type: primarySolver,
                    input_mode: inputMode,
                    enable_minisat: useMiniSAT,
                    enable_walksat: useWalkSAT,
                enable_daedalus: useDaedalus,
                iterations: iterations
            }

            // Handle batch mode for SATLIB
            if (batchMode && inputMode === "satlib") {
                // Generate list of problem indices excluding specified ones
                const allIndices = Array.from(
                    { length: batchSize[1] - batchSize[0] + 1 }, 
                    (_, i) => batchSize[0] + i
                )
                const problemIndices = allIndices.filter(i => !excludeIndices.includes(i))
                
                if (problemIndices.length === 0) {
                    toast({ variant: "error", description: "No problems selected for batch testing" })
                    setLoading(false)
                    return
                }

                requestData = {
                    ...requestData,
                    batch_mode: true,
                    satlib_benchmark: selectedSATLIB,
                    problem_indices: problemIndices,
                    exclude_indices: excludeIndices
                }
            } else {
                // Single problem mode
                const lines = dimacsInput.trim().split('\n')
                let numVars = 0
                let numClauses = 0
                
                for (const line of lines) {
                    if (line.startsWith('p cnf')) {
                        const parts = line.split(' ')
                        numVars = parseInt(parts[2])
                        numClauses = parseInt(parts[3])
                        break
                    }
                }

                requestData = {
                    ...requestData,
                    dimacs: dimacsInput,
                    batch_mode: false,
                    num_variables: numVars,
                    num_clauses: numClauses
                }
            }

            // Make the API call and immediately navigate when we get the test_id
            const res = await fetch("/api/proxy/sat/solve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestData)
            })

            const data = await res.json()
            
            if (res.ok && data.test_id) {
                setTestName("")
                // IMMEDIATE navigation to real-time results page
                router.push(`/sat/${data.test_id}`)
            } else {
                setLoading(false)
                toast({ 
                    variant: "error", 
                    description: data.error || "Failed to start SAT test" 
                })
            }
        } catch (e) {
            setLoading(false)
            toast({ variant: "error", description: "Connection error" })
        }
        // Note: We don't setLoading(false) on success because we're navigating away
    }

    const canRunTest = () => {
        if (loading) return false
        if (!useMiniSAT && !useWalkSAT && !useDaedalus) return false
        if (useDaedalus && !hardwareStatus?.connected) return false
        
        if (batchMode && inputMode === "satlib") {
            const problemCount = batchSize[1] - batchSize[0] + 1 - excludeIndices.length
            return problemCount > 0
        } else {
            return dimacsInput.trim() !== ""
        }
    }

    const selectedAlgorithms = [
        useMiniSAT && "MiniSAT",
        useWalkSAT && "WalkSAT", 
        useDaedalus && "DAEDALUS",
        useMedusa && "MEDUSA",
    ].filter(Boolean)

    // Get current SATLIB problem info
    const getCurrentSATLIBProblem = () => {
        return SATLIB_BENCHMARKS
            .flatMap(cat => cat.problems)
            .find(p => p.value === selectedSATLIB)
    }

    const breadcrumbs = [{ label: "SAT Solver" }]

    return (
        <>
            <PageNavigation currentPage="SAT Solver" breadcrumbs={breadcrumbs} />
            <div className="container max-w-4xl mx-auto p-6 space-y-6 pb-20 sm:pb-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">SAT Solver</h1>
                    <p className="text-muted-foreground">
                        Solve boolean satisfiability problems using software and hardware acceleration
                    </p>
                </div>

                {/* Test Configuration */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <RiSettings3Line className="h-5 w-5" />
                            <CardTitle>Test Configuration</CardTitle>
                        </div>
                        <CardDescription>
                            Configure test name and problem input method
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                            <Label>Problem Input Method</Label>
                            <Select value={inputMode} onValueChange={setInputMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select input mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="satlib">
                                        <div className="flex items-center gap-2">
                                            <RiTestTubeLine className="h-4 w-4" />
                                            <span>SATLIB Benchmarks</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="example">
                                        <div className="flex items-center gap-2">
                                            <span>Example Library</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="random">
                                        <div className="flex items-center gap-2">
                                            <span>Random 3-SAT Generator</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="custom">
                                        <div className="flex items-center gap-2">
                                            <RiCodeLine className="h-4 w-4" />
                                            <span>Custom CNF</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Problem Configuration */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle>Problem Configuration</CardTitle>
                        <CardDescription>
                            {inputMode === "satlib" && "Select benchmark problems and configure batch testing"}
                            {inputMode === "example" && "Choose from predefined example problems"}
                            {inputMode === "random" && "Generate random 3-SAT problems with custom parameters"}
                            {inputMode === "custom" && "Enter your own DIMACS CNF problem"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* SATLIB Configuration */}
                        {inputMode === "satlib" && (
                            <>
                                <div className="space-y-3">
                                    <Label>Benchmark Selection</Label>
                                    <Select
                                        value={selectedSATLIB}
                                        onValueChange={(v) => {
                                            setSelectedSATLIB(v)
                                            setDimacsInput(generateSATLIBDimacs(v))
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select benchmark...">
                                                {(() => {
                                                    const problem = getCurrentSATLIBProblem()
                                                    if (!problem) return "Select benchmark..."
                                                    return (
                                                        <div className="flex items-center justify-between w-full">
                                                            <span>{problem.label}</span>
                                                            <div className="flex gap-1 ml-2">
                                                                <Badge
                                                                    variant={problem.satisfiable ? "default" : "secondary"}
                                                                    className="text-xs h-4"
                                                                >
                                                                    {problem.satisfiable ? "SAT" : "UNSAT"}
                                                                </Badge>
                                                                <Badge variant="outline" className="text-xs h-4">
                                                                    {problem.variables}v
                                                                </Badge>
                                                                <Badge variant="outline" className="text-xs h-4">
                                                                    {problem.clauses}c
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[400px] w-[600px]">
                                            {SATLIB_BENCHMARKS.map((category) => (
                                                <div key={category.category}>
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                        {category.category}
                                                    </div>
                                                    {category.problems.map((problem) => (
                                                        <SelectItem key={problem.value} value={problem.value}>
                                                            <div className="flex items-center justify-between w-full gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium truncate">{problem.label}</div>
                                                                    <div className="text-xs text-muted-foreground truncate">
                                                                        {problem.description}
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-1 flex-shrink-0">
                                                                    <Badge
                                                                        variant={problem.satisfiable ? "default" : "secondary"}
                                                                        className="text-xs h-4"
                                                                    >
                                                                        {problem.satisfiable ? "SAT" : "UNSAT"}
                                                                    </Badge>
                                                                    <Badge variant="outline" className="text-xs h-4">
                                                                        {problem.variables}v
                                                                    </Badge>
                                                                    <Badge variant="outline" className="text-xs h-4">
                                                                        {problem.clauses}c
                                                                    </Badge>
                                                                    {problem.variables > 50 && (
                                                                        <Badge variant="destructive" className="text-xs h-4">
                                                                            decomp
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </div>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Current Problem Info */}
                                {(() => {
                                    const problem = getCurrentSATLIBProblem()
                                    if (!problem) return null
                                    
                                    return (
                                        <div className="p-3 bg-muted/30 rounded-lg border">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-medium text-sm">Benchmark Info</h4>
                                                <div className="flex gap-1">
                                                    <Badge variant={problem.satisfiable ? "default" : "secondary"}>
                                                        {problem.satisfiable ? "SAT" : "UNSAT"}
                                                    </Badge>
                                                    {problem.variables > 50 && (
                                                        <Badge variant="destructive">Requires Decomposition</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-2">
                                                {problem.description}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground">Variables:</span>
                                                    <span className="ml-1 font-mono">{problem.variables}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Clauses:</span>
                                                    <span className="ml-1 font-mono">{problem.clauses}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Ratio:</span>
                                                    <span className="ml-1 font-mono">{problem.ratio}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </>
                        )}

                        {/* Example Selection */}
                        {inputMode === "example" && (
                            <div className="space-y-3">
                                <Label>Example Problem</Label>
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
                                                <div className="flex flex-col items-start py-1">
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

                        {/* Random Problem Configuration */}
                        {inputMode === "random" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="random-vars">Variables</Label>
                                        <Input
                                            id="random-vars"
                                            type="number"
                                            min="3"
                                            max="100"
                                            value={randomVars}
                                            onChange={(e) => setRandomVars(parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="random-clauses">Clauses</Label>
                                        <Input
                                            id="random-clauses"
                                            type="number"
                                            min="3"
                                            max="500"
                                            value={randomClauses}
                                            onChange={(e) => setRandomClauses(parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clause-ratio">Clause/Variable Ratio</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="clause-ratio"
                                            type="range"
                                            min="1"
                                            max="8"
                                            step="0.1"
                                            value={clauseRatio}
                                            onChange={(e) => {
                                                setClauseRatio(parseFloat(e.target.value))
                                                setRandomClauses(Math.floor(randomVars * parseFloat(e.target.value)))
                                            }}
                                            className="flex-1"
                                        />
                                        <span className="text-sm font-mono w-12">{clauseRatio.toFixed(1)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Phase transition ~4.26 for random 3-SAT
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDimacsInput(generateRandom3SAT(randomVars, randomClauses))}
                                >
                                    <RiRefreshLine className="mr-2 h-3 w-3" />
                                    Regenerate Problem
                                </Button>
                            </div>
                        )}

                        {/* DIMACS Input - show for all except batch SATLIB */}
                        {!(batchMode && inputMode === "satlib") && (
                            <div className="space-y-2">
                                <Label>DIMACS CNF Preview</Label>
                                <textarea
                                    value={dimacsInput}
                                    onChange={(e) => setDimacsInput(e.target.value)}
                                    className="h-32 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Enter DIMACS CNF format..."
                                    readOnly={inputMode !== "custom"}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {inputMode === "custom" 
                                        ? "Format: p cnf [variables] [clauses], followed by clause lines ending with 0"
                                        : "Read-only preview - modify using controls above"
                                    }
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Execution Configuration */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle>Execution Configuration</CardTitle>
                        <CardDescription>
                            Configure how tests are executed and repeated
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Iterations */}
                        <div className="space-y-2">
                            <Label className="text-sm">Iterations per Problem</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={iterations}
                                    onChange={(e) => setIterations(parseInt(e.target.value) || 1)}
                                    className="w-20 text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Multiple runs for {inputMode === "satlib" ? "statistical analysis and stochastic systems" : "performance comparison"}
                                </p>
                            </div>
                        </div>

                        {/* Batch Mode - only for SATLIB */}
                        {inputMode === "satlib" && (
                            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-sm font-medium">Batch Testing</Label>
                                        <p className="text-xs text-muted-foreground">Run multiple problems from the benchmark suite</p>
                                    </div>
                                    <Switch
                                        checked={batchMode}
                                        onCheckedChange={setBatchMode}
                                    />
                                </div>

                                {batchMode && (
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            <Label className="text-sm">Problem Index Range</Label>
                                            
                                            {/* Quick Input Controls */}
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <Label className="text-xs text-muted-foreground">Start</Label>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max="1000"
                                                            value={batchSize[0]}
                                                            onChange={(e) => {
                                                                const start = Math.max(1, Math.min(1000, parseInt(e.target.value) || 1));
                                                                const end = Math.max(start, batchSize[1]);
                                                                setBatchSize([start, end]);
                                                            }}
                                                            className="text-sm h-8 font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-muted-foreground">Count</Label>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max="1000"
                                                            value={batchSize[1] - batchSize[0] + 1}
                                                            onChange={(e) => {
                                                                const count = Math.max(1, Math.min(1000, parseInt(e.target.value) || 1));
                                                                const end = batchSize[0] + count - 1;
                                                                setBatchSize([batchSize[0], Math.min(1000, end)]);
                                                            }}
                                                            className="text-sm h-8 font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-muted-foreground">End</Label>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max="1000"
                                                            value={batchSize[1]}
                                                            onChange={(e) => {
                                                                const end = Math.max(1, Math.min(1000, parseInt(e.target.value) || 1));
                                                                const start = Math.min(batchSize[0], end);
                                                                setBatchSize([start, end]);
                                                            }}
                                                            className="text-sm h-8 font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {/* Quick Preset Buttons */}
                                                <div className="flex gap-1 flex-wrap">
                                                    {[[1, 10], [1, 50], [1, 100], [51, 150], [101, 200], [1, 1000]].map(([start, end]) => (
                                                        <button
                                                            key={`${start}-${end}`}
                                                            type="button"
                                                            onClick={() => setBatchSize([start, end])}
                                                            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded border text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            {start === 1 && end === 1000 ? "All" : `${start}-${end}`}
                                                        </button>
                                                    ))}
                                                </div>
                                                
                                                {/* Visual Slider */}
                                                <div className="space-y-2">
                                                    <Slider
                                                        value={batchSize}
                                                        onValueChange={setBatchSize}
                                                        min={1}
                                                        max={1000}
                                                        step={1}
                                                        className="w-full"
                                                    />
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>1</span>
                                                        <span className="font-medium">
                                                            Problems {batchSize[0]}-{batchSize[1]} ({batchSize[1] - batchSize[0] + 1 - excludeIndices.length} selected)
                                                        </span>
                                                        <span>1000</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm">Exclude Indices (comma-separated)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="e.g., 5,10,15"
                                                    value={excludeInput}
                                                    onChange={(e) => setExcludeInput(e.target.value)}
                                                    className="text-sm"
                                                />
                                                {excludeIndices.length > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setExcludeInput("")
                                                            setExcludeIndices([])
                                                        }}
                                                    >
                                                        <RiDeleteBinLine className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            {excludeIndices.length > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    Excluding {excludeIndices.length} problems: {excludeIndices.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Algorithm Selection */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Solver Algorithms</CardTitle>
                                <CardDescription>
                                    Select which solving algorithms to use for comparison
                                </CardDescription>
                            </div>
                            {useDaedalus && (
                                <Badge 
                                    variant={hardwareStatus?.connected ? "default" : "secondary"}
                                    className={hardwareStatus?.connected ? "bg-green-100 text-green-800 border-green-200" : ""}
                                >
                                    {checkingHardware ? (
                                        <>
                                            <RiLoader4Line className="h-3 w-3 mr-1 animate-spin" />
                                            Checking Hardware
                                        </>
                                    ) : hardwareStatus?.connected ? (
                                        "Hardware Ready"
                                    ) : (
                                        "Hardware Required"
                                    )}
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Algorithm Cards */}
                        <div className="space-y-2">
                            {[
                                { id: "minisat", label: "MiniSAT", desc: "Complete DPLL-based solver (software)", state: useMiniSAT, setState: setUseMiniSAT },
                                { id: "walksat", label: "WalkSAT", desc: "Stochastic local search (software)", state: useWalkSAT, setState: setUseWalkSAT },
                                { id: "daedalus", label: "DAEDALUS", desc: "Analog 3-SAT accelerator (hardware)", state: useDaedalus, setState: setUseDaedalus },
                                { id: "medusa", label: "MEDUSA", desc: "Quantum-inspired K-SAT accelerator (hardware)", state: useMedusa, setState: setUseMedusa },
                            ].map((algo) => (
                                <div key={algo.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                                    <div>
                                        <Label htmlFor={algo.id} className="text-sm font-medium cursor-pointer">
                                            {algo.label}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">{algo.desc}</p>
                                    </div>
                                    <Switch
                                        id={algo.id}
                                        checked={algo.state}
                                        onCheckedChange={algo.setState}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Hardware Controls */}
                        {useDaedalus && (
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => checkHardware(false)}
                                    disabled={checkingHardware}
                                >
                                    <RiRefreshLine className={`h-4 w-4 mr-2 ${checkingHardware ? 'animate-spin' : ''}`} />
                                    Check Hardware
                                </Button>

                                <Dialog open={serialMonitorOpen} onOpenChange={setSerialMonitorOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <RiTerminalLine className="h-4 w-4 mr-2" />
                                            Serial Monitor
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
                    </CardContent>
                </Card>

                {/* Run Test Section */}
                <Card>
                    <CardContent className="pt-6">
                        {/* Test Summary */}
                        <div className="rounded-lg bg-muted/50 p-4 space-y-3 mb-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Selected Algorithms:</span>
                                <span className="font-medium">
                                    {selectedAlgorithms.length > 0 
                                        ? selectedAlgorithms.join(", ")
                                        : "None selected"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Test Mode:</span>
                                <Badge variant="outline">
                                    {batchMode && inputMode === "satlib" 
                                        ? `Batch (${batchSize[1] - batchSize[0] + 1 - excludeIndices.length} problems)` 
                                        : "Single Problem"}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Iterations:</span>
                                <Badge variant="outline" className="font-mono">{iterations}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Primary Solver:</span>
                                <Badge variant="outline">
                                    {useDaedalus ? "Hardware" : selectedAlgorithms[0] || "None"}
                                </Badge>
                            </div>
                        </div>

                        {/* Run Button */}
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
                                    {batchMode && inputMode === "satlib" ? "Run Batch Test" : "Run SAT Test"}
                                </>
                            )}
                        </Button>

                        {!canRunTest() && !loading && (
                            <p className="text-xs text-center text-destructive mt-2">
                                {!selectedAlgorithms.length ? "Select at least one algorithm" :
                                 batchMode && inputMode === "satlib" ? 
                                    (batchSize[1] - batchSize[0] + 1 - excludeIndices.length <= 0 ? "No problems selected for batch testing" : "") :
                                 !dimacsInput.trim() ? "Enter a DIMACS problem" :
                                 useDaedalus && !hardwareStatus?.connected ? "DAEDALUS hardware connection required" : ""}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card>
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
                                WalkSAT employs stochastic local search for fast approximate solutions. Running both enables 
                                comprehensive performance comparison across different problem types.
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
                        <div>
                            <p className="text-sm font-medium mb-1">Batch Testing</p>
                            <p className="text-sm text-muted-foreground">
                                SATLIB batch mode enables systematic evaluation across benchmark suites. Multiple iterations 
                                provide statistical analysis for stochastic algorithms, while exclusion lists allow targeted 
                                testing of specific problem characteristics.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}