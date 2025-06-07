"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    RiArrowLeftLine,
    RiLoader4Line,
    RiPlayLine,
    RiTimeLine,
    RiCpuLine,
    RiTestTubeLine,
    RiCheckLine,
    RiCloseLine,
    RiPauseLine,
    RiStopLine,
    RiRefreshLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface SATTestProgressViewProps {
    testData: any
    onBack: () => void
}

const SATTestProgressView: React.FC<SATTestProgressViewProps> = ({ testData, onBack }) => {
    const router = useRouter()
    const [refreshing, setRefreshing] = useState(false)
    const [stopping, setStopping] = useState(false)

    // Single source of truth for status icon
    const statusIcon = React.useMemo(() => {
        switch (testData.status) {
            case 'queued':
                return <RiPauseLine className="h-5 w-5 text-amber-500" />
            case 'running':
                return <RiLoader4Line className="h-5 w-5 text-blue-500 animate-spin" />
            case 'completed':
                return <RiCheckLine className="h-5 w-5 text-green-500" />
            case 'failed':
                return <RiCloseLine className="h-5 w-5 text-red-500" />
            default:
                return <RiPlayLine className="h-5 w-5 text-gray-500" />
        }
    }, [testData.status])

    const getStatusMessage = (status: string) => {
        switch (status) {
            case 'queued':
                return 'Test is queued and waiting to start...'
            case 'running':
                return 'Test is currently running...'
            case 'completed':
                return 'Test completed successfully!'
            case 'failed':
                return 'Test failed to complete'
            default:
                return 'Unknown status'
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            // Force reload the page data
            window.location.reload()
        } finally {
            setRefreshing(false)
        }
    }

    const handleStopTest = async () => {
        if (stopping) return
        
        setStopping(true)
        try {
            const response = await fetch(`/api/proxy/sat/tests/${testData.id}/stop`, {
                method: 'POST'
            })
            
            if (response.ok) {
                // Immediately refresh to show stopped status
                window.location.reload()
            } else {
                console.error('Failed to stop test')
            }
        } catch (error) {
            console.error('Failed to stop test:', error)
        } finally {
            setStopping(false)
        }
    }

    // Calculate progress information from metadata
    const getProgressInfo = () => {
        const metadata = testData.metadata || {}
        const config = testData.config || {}
        
        let totalProblems = 1
        let currentProblem = 0
        let totalIterations = metadata.total_iterations || config.iterations || 1
        
        if (config.batch_mode && config.problem_indices) {
            totalProblems = config.problem_indices.length
            currentProblem = metadata.current_problem_index || 0
            
            // For batch mode, show both problem progress and total run progress
            const problemsCompleted = metadata.problems_completed || 0
            const progressPercent = metadata.progress_percent || 0
            
            return {
                totalProblems,
                currentProblem,
                problemsCompleted,
                totalIterations,
                totalRuns: totalProblems * totalIterations,
                completedRuns: problemsCompleted * totalIterations,
                progressPercent: Math.min(progressPercent, 100)
            }
        }
        
        const progressPercent = totalProblems > 0 ? (currentProblem / totalProblems) * 100 : 0
        
        return {
            totalProblems,
            currentProblem,
            problemsCompleted: currentProblem,
            totalIterations,
            totalRuns: totalIterations,
            completedRuns: currentProblem * totalIterations,
            progressPercent: Math.min(progressPercent, 100)
        }
    }

    const progressInfo = getProgressInfo()
    const config = testData.config || {}
    const metadata = testData.metadata || {}

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="px-4 py-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-start">
                        <div className="w-full">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold">{testData.name}</h1>
                                <Badge 
                                    variant={testData.status === 'running' ? "default" : 
                                            testData.status === 'queued' ? "secondary" : "outline"}
                                    className="flex items-center gap-1"
                                >
                                    <div className="w-4 h-4 flex items-center justify-center">
                                        {React.cloneElement(statusIcon, { className: "h-3 w-3" })}
                                    </div>
                                    {testData.status === 'queued' ? 'Queued' : 
                                     testData.status === 'running' ? 'Running' : 
                                     testData.status === 'completed' ? 'Completed' :
                                     testData.status}
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
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    {/* Status Card */}
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <RiTimeLine className="h-5 w-5 text-blue-500" />
                                    Test Status
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRefresh}
                                        disabled={refreshing}
                                    >
                                        <RiRefreshLine className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    </Button>
                                    {testData.status === 'running' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleStopTest}
                                            disabled={stopping}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            {stopping ? (
                                                <RiLoader4Line className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RiStopLine className="h-4 w-4" />
                                            )}
                                            {stopping ? 'Stopping...' : 'Stop'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-center py-6">
                                {/* Single large status indicator */}
                                <div className="text-6xl mb-4 flex justify-center">
                                    {React.cloneElement(statusIcon, { className: "h-16 w-16" })}
                                </div>
                                <h3 className="text-xl font-semibold mb-2">
                                    {getStatusMessage(testData.status)}
                                </h3>
                                
                                {/* Progress Bar */}
                                {testData.status === 'running' && (
                                    <div className="space-y-2 mt-6">
                                        <Progress value={progressInfo.progressPercent} className="w-full" />
                                        <p className="text-sm text-muted-foreground">
                                            {config.batch_mode ? 
                                                `Problem ${progressInfo.currentProblem} of ${progressInfo.totalProblems}` :
                                                `Running ${progressInfo.totalIterations} iterations`
                                            }
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configuration Summary */}
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <RiCpuLine className="h-5 w-5 text-purple-500" />
                                Test Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="font-medium text-sm text-muted-foreground">Test Type</h4>
                                        <div className="flex items-center gap-2">
                                            <RiTestTubeLine className="h-4 w-4" />
                                            <span>{config.batch_mode ? 'Batch Test' : 'Single Problem'}</span>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-medium text-sm text-muted-foreground">Solvers</h4>
                                        <div className="flex gap-1 flex-wrap">
                                            {config.enable_minisat && (
                                                <Badge variant="outline">MiniSAT</Badge>
                                            )}
                                            {config.enable_walksat && (
                                                <Badge variant="outline">WalkSAT</Badge>
                                            )}
                                            {config.enable_daedalus && (
                                                <Badge variant="outline">DAEDALUS</Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium text-sm text-muted-foreground">Iterations</h4>
                                        <span className="font-mono">{metadata.total_iterations || config.iterations || 1}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {config.batch_mode && (
                                        <>
                                            <div>
                                                <h4 className="font-medium text-sm text-muted-foreground">Benchmark</h4>
                                                <span className="font-mono">{config.satlib_benchmark}</span>
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-medium text-sm text-muted-foreground">Problems</h4>
                                                <span className="font-mono">
                                                    {config.problem_indices?.length || 0} problems
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    {!config.batch_mode && (
                                        <>
                                            <div>
                                                <h4 className="font-medium text-sm text-muted-foreground">Variables</h4>
                                                <span className="font-mono">{config.num_variables || 'N/A'}</span>
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-medium text-sm text-muted-foreground">Clauses</h4>
                                                <span className="font-mono">{config.num_clauses || 'N/A'}</span>
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <h4 className="font-medium text-sm text-muted-foreground">Started</h4>
                                        <span className="text-sm">{new Date(testData.created).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Real-time Progress Info - only show for truly running tests */}
                    {testData.status === 'running' && (
                        <Card>
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <RiLoader4Line className="h-5 w-5 text-green-500 animate-spin" />
                                    Live Progress
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-blue-600 mb-1">
                                            {progressInfo.progressPercent.toFixed(1)}%
                                        </div>
                                        <p className="text-muted-foreground">Complete</p>
                                    </div>

                                    {config.batch_mode && (
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            <div>
                                                <div className="text-lg font-semibold">{progressInfo.problemsCompleted}</div>
                                                <div className="text-xs text-muted-foreground">Problems Done</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-semibold">{progressInfo.totalProblems - progressInfo.problemsCompleted}</div>
                                                <div className="text-xs text-muted-foreground">Problems Left</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-semibold">{progressInfo.completedRuns}</div>
                                                <div className="text-xs text-muted-foreground">Total Runs Done</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-semibold">{progressInfo.totalRuns}</div>
                                                <div className="text-xs text-muted-foreground">Total Runs</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-3 bg-muted/30 rounded-lg">
                                        <p className="text-sm text-center text-muted-foreground">
                                            {config.batch_mode ? (
                                                <>Running {progressInfo.totalProblems} problems × {progressInfo.totalIterations} iterations = {progressInfo.totalRuns} total runs...</>
                                            ) : (
                                                <>Running {progressInfo.totalIterations} iterations...</>
                                            )}
                                            <br />
                                            This page will automatically refresh when complete.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => router.push('/sat')}
                                    className="flex items-center gap-2"
                                >
                                    <RiTestTubeLine className="h-4 w-4" />
                                    Start New Test
                                </Button>
                                
                                <Button
                                    variant="outline"
                                    onClick={() => router.push('/')}
                                    className="flex items-center gap-2"
                                >
                                    <RiArrowLeftLine className="h-4 w-4" />
                                    View All Tests
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default SATTestProgressView 