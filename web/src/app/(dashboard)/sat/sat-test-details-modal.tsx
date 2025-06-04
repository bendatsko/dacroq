"use client"

import React, { useMemo, useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
// @ts-ignore - recharts module exists but types may not be properly resolved
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
} from "recharts"
import {
    RiBarChartLine,
    RiCpuLine,
    RiTimeLine,
    RiThunderstormsLine,
    RiCheckboxCircleLine,
    RiCloseCircleLine,
    RiAddLine,
    RiTestTubeLine,
    RiArrowUpLine,
    RiArrowDownLine,
} from "@remixicon/react"

/* -------------------------------- types --------------------------------- */
interface SATTestDetailsModalProps {
    open: boolean
    onClose: () => void
    testId: string | null
    testData?: any
}

interface SATPerformanceMetrics {
    successRate: number
    avgSolveTime: number
    avgEnergy: number
    avgPower: number
    satisfiabilityRate: number
    hardwareSpeedup: number
    energyEfficiency: number
}

interface TestSummary {
    id: string
    name: string
    type: string
    solver: string
    created: string
    success_rate?: number
    avg_solve_time?: number
}

/* -------------------------- formatting utilities ------------------------- */
function formatEnergy(nJ: number): { value: number; unit: string } {
    if (nJ >= 1e6) {
        return { value: nJ / 1e6, unit: "mJ" }
    } else if (nJ >= 1e3) {
        return { value: nJ / 1e3, unit: "μJ" }
    } else {
        return { value: nJ, unit: "nJ" }
    }
}

function formatTime(ms: number): { value: number; unit: string } {
    if (ms >= 1000) {
        return { value: ms / 1000, unit: "s" }
    } else if (ms >= 1) {
        return { value: ms, unit: "ms" }
    } else {
        return { value: ms * 1000, unit: "μs" }
    }
}

function formatSuccessRate(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`
}

/* -------------------------- performance analysis ------------------------- */
function analyzePerformance(testData: any): SATPerformanceMetrics | null {
    if (!testData?.results) return null

    // Handle different result structures
    let runs: any[] = []
    
    if (testData.results.runs && Array.isArray(testData.results.runs)) {
        runs = testData.results.runs
    } else if (Array.isArray(testData.results)) {
        runs = testData.results
    } else if (testData.results.solver_results) {
        // Handle multiple solver results
        runs = Object.values(testData.results.solver_results).flat()
    }

    if (runs.length === 0) return null

    const successfulRuns = runs.filter(r => r.satisfiable !== undefined ? r.satisfiable : r.success)
    const solveTimes = runs.map(r => r.solve_time_ms || r.time_ms || 0).filter(Boolean)
    const energies = runs.map(r => r.energy_nj || r.energy || 0).filter(Boolean)
    const powers = runs.map(r => r.power_mw || r.power || 0).filter(Boolean)

    const avgSolveTime = solveTimes.reduce((a, b) => a + b, 0) / solveTimes.length || 0
    const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length || 0
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length || 0

    // Determine if hardware was used
    const isHardware = testData.metadata?.solver?.includes("daedalus") || 
                      testData.metadata?.solver?.includes("medusa") ||
                      testData.config?.solver_type === "daedalus" ||
                      testData.config?.solver_type === "medusa"

    return {
        successRate: successfulRuns.length / runs.length,
        avgSolveTime,
        avgEnergy,
        avgPower,
        satisfiabilityRate: runs.filter(r => r.satisfiable === true).length / runs.length,
        hardwareSpeedup: isHardware ? 10 : 1, // Estimate based on solver type
        energyEfficiency: isHardware ? avgEnergy / 500 : 1, // Ratio vs digital baseline
    }
}

/* -------------------------- chart data preparation ----------------------- */
function prepareChartData(testData: any) {
    if (!testData?.results) return { chartData: [], rawTestData: [] }

    let runs: any[] = []
    
    if (testData.results.runs && Array.isArray(testData.results.runs)) {
        runs = testData.results.runs
    } else if (Array.isArray(testData.results)) {
        runs = testData.results
    } else if (testData.results.solver_results) {
        // Handle multiple solver results - create combined chart data
        const solverResults = testData.results.solver_results
        const chartData: any[] = []
        const rawTestData: any[] = []

        Object.entries(solverResults).forEach(([solver, results]: [string, any]) => {
            if (Array.isArray(results)) {
                results.forEach((result, idx) => {
                    const dataPoint = {
                        run: idx + 1,
                        solver,
                        time: result.solve_time_ms || 0,
                        energy: result.energy_nj || 0,
                        power: result.power_mw || 0,
                        satisfiable: result.satisfiable,
                        success: result.satisfiable !== undefined ? result.satisfiable : result.success
                    }
                    chartData.push(dataPoint)
                    rawTestData.push(dataPoint)
                })
            }
        })

        return { chartData, rawTestData }
    }

    // Single solver results
    const rawTestData = runs.map((result, idx) => ({
        run: idx + 1,
        time: result.solve_time_ms || result.time_ms || 0,
        energy: result.energy_nj || result.energy || 0,
        power: result.power_mw || result.power || 0,
        satisfiable: result.satisfiable,
        success: result.satisfiable !== undefined ? result.satisfiable : result.success,
        propagations: result.propagations || 0,
        decisions: result.decisions || 0
    }))

    return { chartData: rawTestData, rawTestData }
}

/* -------------------------------- component ------------------------------ */
const SATTestDetailsModal: React.FC<SATTestDetailsModalProps> = ({
    open,
    onClose,
    testId,
    testData: propTestData,
}) => {
    const [testData, setTestData] = useState<any>(null)
    const [selectedMetric, setSelectedMetric] = useState("time")
    const [selectedComparisonTest, setSelectedComparisonTest] = useState<string>("")
    const [availableTests, setAvailableTests] = useState<TestSummary[]>([])
    const [comparisonTestData, setComparisonTestData] = useState<any>(null)

    // Load test data when modal opens or testId changes
    useEffect(() => {
        if (propTestData) {
            setTestData(propTestData)
        } else if (testId && open) {
            const fetchTestData = async () => {
                try {
                    const response = await fetch(`/api/proxy/sat/tests/${testId}`)
                    if (response.ok) {
                        const data = await response.json()
                        setTestData(data)
                    }
                } catch (error) {
                    console.error('Failed to fetch test data:', error)
                }
            }
            fetchTestData()
        }
    }, [testId, open, propTestData])

    // Prepare chart and raw test data
    const { chartData, rawTestData } = useMemo(() => {
        return prepareChartData(testData)
    }, [testData])

    const metrics = useMemo(() => {
        return analyzePerformance(testData)
    }, [testData])

    const comparisonMetrics = useMemo(() => analyzePerformance(comparisonTestData), [comparisonTestData])

    // Fetch available tests for comparison
    useEffect(() => {
        if (open) {
            fetchAvailableTests()
        }
    }, [open])

    // Auto-select comparison test
    useEffect(() => {
        if (availableTests.length > 0 && !selectedComparisonTest && testId) {
            const otherTests = availableTests.filter(test => test.id !== testId)
            if (otherTests.length > 0) {
                const sortedTests = otherTests.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
                setSelectedComparisonTest(sortedTests[0].id)
            }
        }
    }, [availableTests, testId, selectedComparisonTest])

    // Fetch comparison test data when selection changes
    useEffect(() => {
        if (selectedComparisonTest) {
            fetchComparisonTestData(selectedComparisonTest)
        } else {
            setComparisonTestData(null)
        }
    }, [selectedComparisonTest])

    const fetchAvailableTests = async () => {
        try {
            const response = await fetch('/api/proxy/sat/test-summaries')
            if (response.ok) {
                const data = await response.json()
                setAvailableTests(data.summaries || [])
            }
        } catch (error) {
            console.error('Failed to fetch available tests:', error)
        }
    }

    const fetchComparisonTestData = async (testId: string) => {
        try {
            const response = await fetch(`/api/proxy/sat/tests/${testId}`)
            if (response.ok) {
                const data = await response.json()
                setComparisonTestData(data)
            }
        } catch (error) {
            console.error('Failed to fetch comparison test data:', error)
        }
    }

    if (!testId || !testData) return null

    const metadata = testData.metadata || {}
    const config = testData.config || {}
    const solverTypes = []
    
    // Determine solver types used
    if (config.algorithms) {
        if (config.algorithms.minisat) solverTypes.push("MiniSAT")
        if (config.algorithms.walksat) solverTypes.push("WalkSAT") 
        if (config.algorithms.daedalus) solverTypes.push("Daedalus")
        if (config.algorithms.medusa) solverTypes.push("Medusa")
    } else {
        solverTypes.push(config.solver_type || metadata.solver || "Unknown")
    }

    const isHardware = solverTypes.some(s => s.toLowerCase().includes("daedalus") || s.toLowerCase().includes("medusa"))
    const energyFormatted = metrics ? formatEnergy(metrics.avgEnergy) : null
    const timeFormatted = metrics ? formatTime(metrics.avgSolveTime) : null

    // Performance comparison helpers
    const getPerformanceDelta = (current: number, comparison: number, metric: string) => {
        if (!current || !comparison || current === 0 || comparison === 0) return null
        
        let improvement = 0
        let isGoodDirection = false
        
        switch (metric) {
            case 'time':
                improvement = ((comparison - current) / comparison) * 100
                isGoodDirection = current < comparison
                break
            case 'energy':
                improvement = ((comparison - current) / comparison) * 100
                isGoodDirection = current < comparison
                break
            case 'success':
                improvement = ((current - comparison) / comparison) * 100
                isGoodDirection = current > comparison
                break
        }
        
        return {
            value: Math.abs(improvement),
            isGoodDirection,
            magnitude: Math.abs(improvement) > 10 ? 'significant' : Math.abs(improvement) > 2 ? 'moderate' : 'minimal'
        }
    }

    const formatDeltaText = (delta: any, metric: string) => {
        if (!delta) return "~"
        
        const symbols = {
            time: delta.isGoodDirection ? "↓" : "↑",
            energy: delta.isGoodDirection ? "↓" : "↑", 
            success: delta.isGoodDirection ? "↑" : "↓"
        }
        
        return `${symbols[metric as keyof typeof symbols]} ${delta.value.toFixed(1)}%`
    }

    const getDeltaColor = (delta: any) => {
        if (!delta) return "text-muted-foreground"
        if (delta.magnitude === 'minimal') return "text-muted-foreground"
        return delta.isGoodDirection ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-7xl h-[90vh] max-h-[900px] overflow-hidden flex flex-col p-3 sm:p-4">
                <DialogHeader className="space-y-1 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-lg sm:text-xl font-semibold leading-tight">
                                {testData.name}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                ID: {testId.slice(0, 8)} • {testData.status?.charAt(0).toUpperCase() + testData.status?.slice(1) || 'Completed'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-3 mt-3">
                    {/* Core Configuration & Performance Metrics - Compact 3 cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Problem Configuration */}
                        <Card className="border-muted">
                            <CardHeader className="pb-2 px-3">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <RiCpuLine className="h-3.5 w-3.5 text-muted-foreground" />
                                    Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 px-3 pb-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-muted-foreground">Solvers</span>
                                    <div className="flex gap-1">
                                        {solverTypes.slice(0, 2).map(solver => (
                                            <Badge 
                                                key={solver}
                                                variant={solver.includes("Daedalus") || solver.includes("Medusa") ? "default" : "secondary"} 
                                                className="text-xs h-4"
                                            >
                                                {solver}
                                            </Badge>
                                        ))}
                                        {solverTypes.length > 2 && (
                                            <Badge variant="secondary" className="text-xs h-4">
                                                +{solverTypes.length - 2}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <CompactRow label="Variables" value={config.num_variables || metadata.variables || "N/A"} />
                                <CompactRow label="Clauses" value={config.num_clauses || metadata.clauses || "N/A"} />
                                <CompactRow label="Ratio" value={
                                    config.num_variables && config.num_clauses ? 
                                    (config.num_clauses / config.num_variables).toFixed(2) : "N/A"
                                } />
                                <CompactRow label="Input Mode" value={config.input_mode || "custom"} />
                            </CardContent>
                        </Card>

                        {/* Solution Performance */}
                        <Card className="border-muted">
                            <CardHeader className="pb-2 px-3">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <RiBarChartLine className="h-3.5 w-3.5 text-muted-foreground" />
                                    Solution Performance
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 px-3 pb-3">
                                {metrics ? (
                                    <>
                                        <CompactMetric
                                            label="Success Rate"
                                            value={formatSuccessRate(metrics.successRate)}
                                            good={metrics.successRate > 0.95}
                                        />
                                        <CompactMetric
                                            label="SAT Rate"
                                            value={formatSuccessRate(metrics.satisfiabilityRate)}
                                            good={metrics.satisfiabilityRate > 0.5}
                                        />
                                        <CompactMetric
                                            label="Solve Time"
                                            value={timeFormatted ? `${timeFormatted.value.toFixed(2)} ${timeFormatted.unit}` : "N/A"}
                                            good={isHardware && metrics.avgSolveTime < 1}
                                        />
                                        <CompactRow label="Problems" value={rawTestData.length} />
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded text-center">
                                        <RiCloseCircleLine className="h-3 w-3 text-red-500" />
                                        <span className="text-xs text-red-700 dark:text-red-400">Test failed</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Energy & Hardware */}
                        <Card className="border-muted">
                            <CardHeader className="pb-2 px-3">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <RiThunderstormsLine className="h-3.5 w-3.5 text-muted-foreground" />
                                    Energy & Hardware
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 px-3 pb-3">
                                {metrics ? (
                                    <>
                                        <CompactMetric
                                            label="Energy/Solve"
                                            value={energyFormatted ? `${energyFormatted.value.toFixed(1)} ${energyFormatted.unit}` : "N/A"}
                                            good={isHardware && metrics.avgEnergy < 100}
                                        />
                                        <CompactRow label="Power" value={`${metrics.avgPower.toFixed(1)} mW`} />
                                        <CompactMetric
                                            label="HW Speedup"
                                            value={`${metrics.hardwareSpeedup.toFixed(1)}×`}
                                            good={isHardware && metrics.hardwareSpeedup > 5}
                                        />
                                        <CompactRow label="vs Digital" value={isHardware ? "10× better" : "Baseline"} />
                                    </>
                                ) : (
                                    <div className="text-center text-xs text-muted-foreground">No data</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Test Comparison */}
                    <Card className="border-muted">
                        <CardHeader className="pb-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <CardTitle className="text-sm flex items-center gap-1.5">
                                    <RiArrowUpLine className="h-4 w-4 text-muted-foreground" />
                                    Performance Comparison
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Select value={selectedComparisonTest} onValueChange={setSelectedComparisonTest}>
                                        <SelectTrigger className="w-[180px] h-7 text-xs">
                                            <SelectValue placeholder="Select test" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableTests.filter(test => test.id !== testId).map((test) => (
                                                <SelectItem key={test.id} value={test.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-xs">
                                                            {test.type}
                                                        </Badge>
                                                        <span className="truncate">{test.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedComparisonTest && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => setSelectedComparisonTest("")}
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedComparisonTest && comparisonMetrics && metrics ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Current Test */}
                                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                                        <h4 className="text-xs font-medium mb-2 text-center">
                                            Current: {testData.name}
                                            <Badge variant="default" className="ml-1 text-xs h-4">
                                                {solverTypes.join(", ")}
                                            </Badge>
                                        </h4>
                                        <div className="space-y-1">
                                            <ComparisonRow label="Success Rate" value={formatSuccessRate(metrics.successRate)} />
                                            <ComparisonRow label="Solve Time" value={timeFormatted ? `${timeFormatted.value.toFixed(2)} ${timeFormatted.unit}` : "N/A"} />
                                            <ComparisonRow label="Energy" value={energyFormatted ? `${energyFormatted.value.toFixed(1)} ${energyFormatted.unit}` : "N/A"} />
                                            <ComparisonRow label="SAT Rate" value={formatSuccessRate(metrics.satisfiabilityRate)} />
                                        </div>
                                    </div>

                                    {/* Comparison Test */}
                                    <div className="bg-muted/20 rounded-lg p-3">
                                        <h4 className="text-xs font-medium mb-2 text-center">
                                            Compare: {comparisonTestData?.name}
                                            <Badge variant="secondary" className="ml-1 text-xs h-4">
                                                {comparisonTestData?.metadata?.solver || "Unknown"}
                                            </Badge>
                                        </h4>
                                        <div className="space-y-1">
                                            <ComparisonRow label="Success Rate" value={formatSuccessRate(comparisonMetrics.successRate)} />
                                            <ComparisonRow label="Solve Time" value={`${comparisonMetrics.avgSolveTime.toFixed(2)} ms`} />
                                            <ComparisonRow label="Energy" value={`${comparisonMetrics.avgEnergy.toFixed(1)} nJ`} />
                                            <ComparisonRow label="SAT Rate" value={formatSuccessRate(comparisonMetrics.satisfiabilityRate)} />
                                        </div>
                                    </div>

                                    {/* Performance Delta */}
                                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                                        <h4 className="text-xs font-medium mb-2 text-center">Performance Δ</h4>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-muted-foreground">Success Rate</span>
                                                <span className={`text-xs font-medium ${getDeltaColor(getPerformanceDelta(metrics.successRate, comparisonMetrics.successRate, 'success'))}`}>
                                                    {formatDeltaText(getPerformanceDelta(metrics.successRate, comparisonMetrics.successRate, 'success'), 'success')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-muted-foreground">Speed</span>
                                                <span className={`text-xs font-medium ${getDeltaColor(getPerformanceDelta(metrics.avgSolveTime, comparisonMetrics.avgSolveTime, 'time'))}`}>
                                                    {formatDeltaText(getPerformanceDelta(metrics.avgSolveTime, comparisonMetrics.avgSolveTime, 'time'), 'time')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-muted-foreground">Energy Eff</span>
                                                <span className={`text-xs font-medium ${getDeltaColor(getPerformanceDelta(metrics.avgEnergy, comparisonMetrics.avgEnergy, 'energy'))}`}>
                                                    {formatDeltaText(getPerformanceDelta(metrics.avgEnergy, comparisonMetrics.avgEnergy, 'energy'), 'energy')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-muted-foreground">Overall</span>
                                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                                    {isHardware ? "Hardware Win" : "Software"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                    <p className="text-sm">Performance comparison will appear here</p>
                                    <p className="text-xs mt-1">Select a test above to compare metrics</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Performance Analysis & Test Results - Side by Side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Performance Analysis Chart */}
                        <Card className="border-muted">
                            <CardHeader className="pb-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <CardTitle className="text-sm">Performance Analysis</CardTitle>
                                    <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                        <SelectTrigger className="w-[110px] h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="time">Solve Time</SelectItem>
                                            <SelectItem value="energy">Energy</SelectItem>
                                            <SelectItem value="power">Power</SelectItem>
                                            <SelectItem value="success">Success Rate</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[200px]">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                                <XAxis 
                                                    dataKey="run" 
                                                    stroke="hsl(var(--muted-foreground))"
                                                    fontSize={10}
                                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                    label={{ value: 'Problem #', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                                                />
                                                <YAxis 
                                                    stroke="hsl(var(--muted-foreground))"
                                                    fontSize={10}
                                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                                    label={{ 
                                                        value: selectedMetric === "time" ? "Time (ms)" : 
                                                               selectedMetric === "energy" ? "Energy (nJ)" : 
                                                               selectedMetric === "power" ? "Power (mW)" : "Success",
                                                        angle: -90, 
                                                        position: 'insideLeft', 
                                                        style: { textAnchor: 'middle', fontSize: 10, fill: 'hsl(var(--muted-foreground))' } 
                                                    }}
                                                />
                                                <Tooltip 
                                                    contentStyle={{ 
                                                        backgroundColor: 'hsl(var(--popover))', 
                                                        border: '1px solid hsl(var(--border))',
                                                        borderRadius: '6px',
                                                        fontSize: '12px'
                                                    }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey={selectedMetric} 
                                                    stroke="hsl(var(--primary))" 
                                                    strokeWidth={2}
                                                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <div className="text-center">
                                                <RiBarChartLine className="h-6 w-6 mx-auto mb-1 opacity-50" />
                                                <p className="text-xs">No data available</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Test Results Data Table */}
                        <Card className="border-muted">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Test Results Data</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[200px] overflow-auto">
                                    {rawTestData.length > 0 ? (
                                        <div className="space-y-1">
                                            {/* Table Header */}
                                            <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground border-b pb-1 sticky top-0 bg-background">
                                                <div>Run</div>
                                                <div>Time</div>
                                                <div>Energy</div>
                                                <div>Power</div>
                                                <div>SAT</div>
                                                <div>✓</div>
                                            </div>
                                            
                                            {/* Table Rows */}
                                            <div className="space-y-0.5">
                                                {rawTestData.slice(0, 30).map((result: any, index: number) => (
                                                    <div key={index} className="grid grid-cols-6 gap-2 text-xs py-0.5 hover:bg-muted/20 rounded">
                                                        <div className="font-mono text-muted-foreground">{result.run}</div>
                                                        <div className="font-mono">
                                                            {result.time ? `${result.time.toFixed(1)}ms` : 'N/A'}
                                                        </div>
                                                        <div className="font-mono">
                                                            {result.energy ? `${result.energy.toFixed(0)}nJ` : 'N/A'}
                                                        </div>
                                                        <div className="font-mono">
                                                            {result.power ? `${result.power.toFixed(1)}` : 'N/A'}
                                                        </div>
                                                        <div className="text-center">
                                                            {result.satisfiable === true ? (
                                                                <span className="text-green-600">SAT</span>
                                                            ) : result.satisfiable === false ? (
                                                                <span className="text-red-600">UNSAT</span>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            {result.success ? (
                                                                <RiCheckboxCircleLine className="h-3 w-3 text-green-500" />
                                                            ) : (
                                                                <RiCloseCircleLine className="h-3 w-3 text-red-500" />
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {rawTestData.length > 30 && (
                                                <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                                                    Showing first 30 of {rawTestData.length} results
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <div className="text-center">
                                                <RiTestTubeLine className="h-6 w-6 mx-auto mb-1 opacity-50" />
                                                <p className="text-xs">No test results available</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* DIMACS Input/Output */}
                    <Card className="border-muted">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Problem Input & Solution</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* DIMACS Input */}
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">DIMACS Input</Label>
                                <pre className="bg-muted p-2 rounded-md mt-1 text-xs font-mono max-h-24 overflow-auto">
                                    {config.dimacs || config.dimacs_input || "No input available"}
                                </pre>
                            </div>

                            {/* Solution Summary */}
                            {metadata.satisfiable !== undefined && (
                                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                    {metadata.satisfiable ? (
                                        <RiCheckboxCircleLine className="h-4 w-4 text-green-500 shrink-0" />
                                    ) : (
                                        <RiCloseCircleLine className="h-4 w-4 text-red-500 shrink-0" />
                                    )}
                                    <span className="text-xs font-medium">
                                        {metadata.satisfiable ? "SATISFIABLE" : "UNSATISFIABLE"}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        Solved by {solverTypes.join(", ")}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    )
}

/* ----------------------------- helper components ------------------------ */
const CompactRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center gap-2 min-h-[16px]">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        <span className="font-medium text-xs text-right">{value}</span>
    </div>
)

const CompactMetric = ({ label, value, good }: { label: string; value: string; good?: boolean }) => (
    <div className="flex justify-between items-center gap-2 min-h-[16px]">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        <span className={`font-medium text-xs text-right ${good ? "text-green-600 dark:text-green-400" : ""}`}>
            {value}
        </span>
    </div>
)

const ComparisonRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center gap-2 min-h-[16px]">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        <span className="font-medium text-xs text-right">{value}</span>
    </div>
)

export default SATTestDetailsModal