"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    RiArrowLeftLine,
    RiDownloadLine,
    RiBarChartLine,
    RiTimeLine,
    RiThunderstormsLine,
    RiArrowRightSLine,
    RiHomeLine,
    RiTestTubeLine,
    RiFileDownloadLine,
    RiExpandUpDownLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface SATTestResultsViewProps {
    testData: any
    onBack: () => void
}

interface ChartDataPoint {
    problem: number
    time: number
    energy: number
    solver: string
    satisfiable: boolean
}

const SATTestResultsView: React.FC<SATTestResultsViewProps> = ({ testData, onBack }) => {
    const router = useRouter()

    // Prepare chart data
    const chartData = useMemo(() => {
        if (!testData?.results || !testData.results[0]?.results) return []
        
        const resultData = testData.results[0].results // First (and usually only) result entry
        let runs: any[] = []
        
        // Check if this is batch mode with batch_results structure
        if (resultData.batch_results && Array.isArray(resultData.batch_results)) {
            // Batch results - each batch_result is a different problem
            resultData.batch_results.forEach((problemResult: any, problemIdx: number) => {
                if (problemResult?.solver_results) {
                    const problemIndex = problemResult.problem_index || (problemIdx + 1)
                    
                    Object.entries(problemResult.solver_results).forEach(([solver, results]: [string, any]) => {
                        if (Array.isArray(results)) {
                            // Average the iterations for this problem
                            const avgTime = results.reduce((sum: number, r: any) => sum + (r.solve_time_ms || 0), 0) / results.length
                            const avgEnergy = results.reduce((sum: number, r: any) => sum + (r.energy_nj || 0), 0) / results.length
                            const successRate = results.filter((r: any) => r.satisfiable === true).length / results.length
                            
                            runs.push({
                                problem: problemIndex,
                                time: avgTime * 1000, // Convert to microseconds for display
                                energy: avgEnergy,
                                solver: solver,
                                satisfiable: successRate > 0.5,
                                iterations: results.length
                            })
                        }
                    })
                }
            })
        } else if (resultData.solver_results) {
            // Single result or flattened batch results
            Object.entries(resultData.solver_results).forEach(([solver, results]: [string, any]) => {
                if (Array.isArray(results)) {
                    results.forEach((result, idx) => {
                        runs.push({
                            problem: idx + 1,
                            time: (result.solve_time_ms || 0) * 1000, // Convert to microseconds
                            energy: result.energy_nj || 0,
                            solver: solver,
                            satisfiable: result.satisfiable === true,
                            iterations: 1
                        })
                    })
                }
            })
        }
        
        return runs
    }, [testData])

    // Group data by solver
    const solverData = useMemo(() => {
        const grouped: Record<string, ChartDataPoint[]> = {}
        chartData.forEach(point => {
            if (!grouped[point.solver]) {
                grouped[point.solver] = []
            }
            grouped[point.solver].push(point)
        })
        return grouped
    }, [chartData])

    const solverColors = {
        minisat: "#3b82f6", // blue
        walksat: "#ef4444", // red
        daedalus: "#10b981", // green
        medusa: "#f59e0b", // amber
    }

    // Prepare line chart data (problem by problem)
    const lineChartData = useMemo(() => {
        if (chartData.length === 0) return []
        
        const problemNums = [...new Set(chartData.map(d => d.problem))].sort((a, b) => a - b)
        
        return problemNums.map(problemNum => {
            const problemData: any = { problem: problemNum }
            Object.keys(solverData).forEach(solver => {
                const solverPoint = solverData[solver].find(d => d.problem === problemNum)
                if (solverPoint) {
                    problemData[`${solver}_time`] = solverPoint.time / 1000 // Convert to ms
                    problemData[`${solver}_energy`] = solverPoint.energy
                }
            })
            return problemData
        })
    }, [chartData, solverData])

    // Find biggest performance differences
    const performanceAnalysis = useMemo(() => {
        if (lineChartData.length === 0 || Object.keys(solverData).length < 2) return null
        
        const solvers = Object.keys(solverData)
        let maxDifferenceData = { problem: 0, ratio: 0, faster: '', slower: '', time_diff: 0 }
        
        lineChartData.forEach(data => {
            for (let i = 0; i < solvers.length; i++) {
                for (let j = i + 1; j < solvers.length; j++) {
                    const solver1 = solvers[i]
                    const solver2 = solvers[j]
                    const time1 = data[`${solver1}_time`]
                    const time2 = data[`${solver2}_time`]
                    
                    if (time1 && time2) {
                        const ratio = Math.max(time1, time2) / Math.min(time1, time2)
                        if (ratio > maxDifferenceData.ratio) {
                            maxDifferenceData = {
                                problem: data.problem,
                                ratio,
                                faster: time1 < time2 ? solver1 : solver2,
                                slower: time1 < time2 ? solver2 : solver1,
                                time_diff: Math.abs(time1 - time2)
                            }
                        }
                    }
                }
            }
        })
        
        return maxDifferenceData.ratio > 1 ? maxDifferenceData : null
    }, [lineChartData, solverData])

    const exportResults = () => {
        const exportData = {
            test_name: testData.name,
            test_id: testData.id,
            created: testData.created,
            configuration: testData.config,
            metadata: testData.metadata,
            results: testData.results,
            export_timestamp: new Date().toISOString()
        }
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${testData.name || testData.id}_results.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Breadcrumb Navigation */}
            

            {/* Header */}
            <div className="px-4 py-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-start">
                        <div className="w-full">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold">{testData.name}</h1>
                                <Badge variant="outline">
                                    {testData.status === 'completed' ? 'Completed' : testData.status}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground">
                                Test ID: {testData.id} • Created: {new Date(testData.created).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 pb-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Performance Summary */}
                    {Object.keys(solverData).length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Time Performance */}
                            <Card>
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <RiTimeLine className="h-5 w-5 text-blue-500" />
                                        Solve Time Performance
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {Object.entries(solverData).map(([solver, data]) => {
                                            const avgTime = data.reduce((sum, d) => sum + d.time, 0) / data.length
                                            const minTime = Math.min(...data.map(d => d.time))
                                            const maxTime = Math.max(...data.map(d => d.time))
                                            
                                            return (
                                                <div key={solver} className="p-3 bg-muted/30 rounded-lg">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div 
                                                            className="w-3 h-3 rounded"
                                                            style={{ 
                                                                backgroundColor: solverColors[solver as keyof typeof solverColors] || "#6b7280" 
                                                            }}
                                                        />
                                                        <span className="font-medium">{solver.toUpperCase()}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                                        <div>
                                                            <div className="text-muted-foreground">Avg</div>
                                                            <div className="font-mono">{avgTime.toFixed(0)} μs</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">Min</div>
                                                            <div className="font-mono">{minTime.toFixed(0)} μs</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">Max</div>
                                                            <div className="font-mono">{maxTime.toFixed(0)} μs</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Energy Performance */}
                            <Card>
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <RiThunderstormsLine className="h-5 w-5 text-amber-500" />
                                        Energy Consumption
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {Object.entries(solverData).map(([solver, data]) => {
                                            const avgEnergy = data.reduce((sum, d) => sum + d.energy, 0) / data.length
                                            const minEnergy = Math.min(...data.map(d => d.energy))
                                            const maxEnergy = Math.max(...data.map(d => d.energy))
                                            
                                            return (
                                                <div key={solver} className="p-3 bg-muted/30 rounded-lg">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div 
                                                            className="w-3 h-3 rounded"
                                                            style={{ 
                                                                backgroundColor: solverColors[solver as keyof typeof solverColors] || "#6b7280" 
                                                            }}
                                                        />
                                                        <span className="font-medium">{solver.toUpperCase()}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                                        <div>
                                                            <div className="text-muted-foreground">Avg</div>
                                                            <div className="font-mono">{avgEnergy.toFixed(1)} nJ</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">Min</div>
                                                            <div className="font-mono">{minEnergy.toFixed(1)} nJ</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground">Max</div>
                                                            <div className="font-mono">{maxEnergy.toFixed(1)} nJ</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Problem-by-Problem Analysis Charts */}
                    {lineChartData.length > 1 && (
                        <div className="space-y-6">
                            {/* Performance Analysis Header */}
                            {performanceAnalysis && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <RiBarChartLine className="h-5 w-5 text-orange-500" />
                                            Performance Analysis
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                                            <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                                                Biggest Performance Difference
                                            </h4>
                                            <p className="text-sm text-orange-700 dark:text-orange-300">
                                                <strong>Problem {performanceAnalysis.problem}:</strong> {' '}
                                                <span className="font-mono">{performanceAnalysis.faster.toUpperCase()}</span> was{' '}
                                                <strong>{performanceAnalysis.ratio.toFixed(1)}x faster</strong> than{' '}
                                                <span className="font-mono">{performanceAnalysis.slower.toUpperCase()}</span>
                                                {' '}({performanceAnalysis.time_diff.toFixed(2)}ms difference)
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Time vs Problem Number Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <RiTimeLine className="h-5 w-5 text-blue-500" />
                                        Solve Time vs Problem Number
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={lineChartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis 
                                                    dataKey="problem" 
                                                    label={{ value: 'Problem Number', position: 'insideBottom', offset: -5 }}
                                                />
                                                <YAxis 
                                                    label={{ value: 'Solve Time (ms)', angle: -90, position: 'insideLeft' }}
                                                />
                                                <Tooltip 
                                                    formatter={(value: any, name: string) => [
                                                        `${value?.toFixed(3)} ms`, 
                                                        name.replace('_time', '').toUpperCase()
                                                    ]}
                                                    labelFormatter={(label) => `Problem ${label}`}
                                                />
                                                <Legend />
                                                {Object.keys(solverData).map(solver => (
                                                    <Line
                                                        key={solver}
                                                        type="monotone"
                                                        dataKey={`${solver}_time`}
                                                        stroke={solverColors[solver as keyof typeof solverColors]}
                                                        strokeWidth={2}
                                                        dot={{ r: 4 }}
                                                        name={solver.toUpperCase()}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Energy vs Problem Number Chart */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <RiThunderstormsLine className="h-5 w-5 text-amber-500" />
                                        Energy Consumption vs Problem Number
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={lineChartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis 
                                                    dataKey="problem" 
                                                    label={{ value: 'Problem Number', position: 'insideBottom', offset: -5 }}
                                                />
                                                <YAxis 
                                                    label={{ value: 'Energy (nJ)', angle: -90, position: 'insideLeft' }}
                                                />
                                                <Tooltip 
                                                    formatter={(value: any, name: string) => [
                                                        `${value?.toFixed(3)} nJ`, 
                                                        name.replace('_energy', '').toUpperCase()
                                                    ]}
                                                    labelFormatter={(label) => `Problem ${label}`}
                                                />
                                                <Legend />
                                                {Object.keys(solverData).map(solver => (
                                                    <Line
                                                        key={solver}
                                                        type="monotone"
                                                        dataKey={`${solver}_energy`}
                                                        stroke={solverColors[solver as keyof typeof solverColors]}
                                                        strokeWidth={2}
                                                        dot={{ r: 4 }}
                                                        name={solver.toUpperCase()}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Analysis Tools */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <RiBarChartLine className="h-5 w-5 text-green-500" />
                                Analysis Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(solverData).map(([solver, data]) => {
                                    const avgTime = data.reduce((sum, d) => sum + d.time, 0) / data.length
                                    const avgEnergy = data.reduce((sum, d) => sum + d.energy, 0) / data.length
                                    const satisfiableCount = data.filter(d => d.satisfiable).length
                                    const totalIterations = data.reduce((sum, d) => sum + (d.iterations || 1), 0)
                                    
                                    return (
                                        <div key={solver} className="p-4 bg-muted/30 rounded-lg">
                                            <h4 className="font-medium mb-2 flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded"
                                                    style={{ 
                                                        backgroundColor: solverColors[solver as keyof typeof solverColors] || "#6b7280" 
                                                    }}
                                                />
                                                {solver.toUpperCase()}
                                            </h4>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Problems:</span>
                                                    <span className="font-mono">{data.length}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Total Runs:</span>
                                                    <span className="font-mono">{totalIterations}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Avg Time:</span>
                                                    <span className="font-mono">{avgTime.toFixed(2)} μs</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Avg Energy:</span>
                                                    <span className="font-mono">{avgEnergy.toFixed(2)} nJ</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Satisfiable:</span>
                                                    <span className="font-mono">
                                                        {satisfiableCount}/{data.length}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Success Rate:</span>
                                                    <span className="font-mono">
                                                        {((satisfiableCount / data.length) * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Export Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <RiDownloadLine className="h-5 w-5 text-purple-500" />
                                Export & Download
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Button 
                                    variant="outline" 
                                    onClick={exportResults}
                                    className="flex items-center gap-2 h-auto p-4"
                                >
                                    <RiFileDownloadLine className="h-5 w-5" />
                                    <div className="text-left">
                                        <div className="font-medium">Complete Results (JSON)</div>
                                        <div className="text-xs text-muted-foreground">
                                            Full test data including configuration and raw results
                                        </div>
                                    </div>
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        const csvData = chartData.map(d => 
                                            `${d.problem},${d.solver},${d.time},${d.energy},${d.satisfiable}`
                                        ).join('\n')
                                        const csvContent = 'Problem,Solver,Time(μs),Energy(nJ),Satisfiable\n' + csvData
                                        const blob = new Blob([csvContent], { type: 'text/csv' })
                                        const url = URL.createObjectURL(blob)
                                        const a = document.createElement('a')
                                        a.href = url
                                        a.download = `${testData.name || testData.id}_data.csv`
                                        a.click()
                                        URL.revokeObjectURL(url)
                                    }}
                                    className="flex items-center gap-2 h-auto p-4"
                                >
                                    <RiFileDownloadLine className="h-5 w-5" />
                                    <div className="text-left">
                                        <div className="font-medium">Performance Data (CSV)</div>
                                        <div className="text-xs text-muted-foreground">
                                            Chart data for external analysis tools
                                        </div>
                                    </div>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default SATTestResultsView 