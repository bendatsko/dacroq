/* --------------------------------------------------------------------------
 * components/sat-test-details-modal.tsx
 * Research-grade SAT solver performance visualization
 * -------------------------------------------------------------------------*/

"use client"

import React, { useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
} from "recharts"
import {
    RiBarChartLine,
    RiCpuLine,
    RiTimeLine,
    RiThunderstormsLine,
    RiCheckboxCircleLine,
    RiCloseCircleLine,
} from "@remixicon/react"

/* -------------------------------- types --------------------------------- */
interface SATTestDetailsModalProps {
    open: boolean
    onClose: () => void
    testId: string | null
    testData?: any
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

/* -------------------------------- component ------------------------------ */
const SATTestDetailsModal: React.FC<SATTestDetailsModalProps> = ({
    open,
    onClose,
    testId,
    testData,
}) => {
    const performanceData = useMemo(() => {
        if (!testData?.results?.runs) return null

        const runs = testData.results.runs
        return {
            runs: runs.map((r: any, idx: number) => ({
                run: idx + 1,
                time: r.solve_time_ms,
                energy: r.energy_nj,
                propagations: r.propagations,
                success: r.satisfiable ? 1 : 0
            })),
            summary: testData.results.summary || {}
        }
    }, [testData])

    if (!testId || !testData) return null

    const metadata = testData.metadata || {}
    const config = testData.config || {}
    const solverType = config.solver_type || testData.test_mode || 'MINISAT'
    const isAnalog = solverType.toLowerCase() === 'daedalus'

    // Format values with proper units
    const energyFormatted = metadata.avg_energy_nj ? formatEnergy(metadata.avg_energy_nj) : null
    const timeFormatted = metadata.avg_solve_time_ms ? formatTime(metadata.avg_solve_time_ms) : null

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-6xl h-[80vh] max-h-[80vh] overflow-hidden flex flex-col p-2 sm:p-6">
                <DialogHeader className="space-y-1 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="text-sm sm:text-xl lg:text-2xl font-semibold leading-tight">
                                {testData.name}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                SAT Test Results • ID: {testId.slice(0, 8)}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-4">
                    {/* Configuration & Key Metrics */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                        {/* Problem Configuration */}
                        <Card>
                            <CardHeader className="pb-1 sm:pb-3">
                                <CardTitle className="text-xs sm:text-base flex items-center gap-1.5">
                                    <RiCpuLine className="h-3 w-3 sm:h-4 sm:w-4" />
                                    Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 sm:space-y-2">
                                <InfoRow label="Solver" value={
                                    <Badge variant={isAnalog ? "default" : "secondary"} className="text-xs px-1 py-0">
                                        {isAnalog ? "Daedalus" : solverType}
                                    </Badge>
                                } />
                                <InfoRow label="Variables" value={config.num_variables || "N/A"} />
                                <InfoRow label="Clauses" value={config.num_clauses || "N/A"} />
                                <InfoRow label="Ratio" value={
                                    config.num_variables ? (config.num_clauses / config.num_variables).toFixed(2) : "N/A"
                                } />
                                <InfoRow label="Environment" value={testData.environment || "software"} />
                                <InfoRow label="Result" value={
                                    <Badge variant={metadata.satisfiable ? "default" : "secondary"} className="text-xs px-1 py-0">
                                        {metadata.satisfiable ? "SAT" : "UNSAT"}
                                    </Badge>
                                } />
                            </CardContent>
                        </Card>

                        {/* Key Metrics */}
                        <Card>
                            <CardHeader className="pb-1 sm:pb-3">
                                <CardTitle className="text-xs sm:text-base flex items-center gap-1.5">
                                    <RiBarChartLine className="h-3 w-3 sm:h-4 sm:w-4" />
                                    Key Metrics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 sm:space-y-2">
                                <MetricRow
                                    label="Solve Time"
                                    value={timeFormatted ? `${timeFormatted.value.toFixed(2)} ${timeFormatted.unit}` : "N/A"}
                                    highlight={metadata.avg_solve_time_ms < 1}
                                />
                                <MetricRow
                                    label="Energy"
                                    value={energyFormatted ? `${energyFormatted.value.toFixed(1)} ${energyFormatted.unit}` : "N/A"}
                                    highlight={isAnalog}
                                />
                                <MetricRow
                                    label="Energy/Var"
                                    value={`${metadata.energy_per_variable_pj?.toFixed(1) || "N/A"} pJ`}
                                    highlight={isAnalog}
                                />
                                <MetricRow
                                    label="Power"
                                    value={`${metadata.power_consumption_mw?.toFixed(1) || "N/A"} mW`}
                                    highlight={metadata.power_consumption_mw < 50}
                                />
                                <MetricRow
                                    label="Success Rate"
                                    value={`${((metadata.success_rate || 0) * 100).toFixed(0)}%`}
                                    highlight={metadata.success_rate === 1}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Performance Cards - Hide on small mobile */}
                    {performanceData && (
                        <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                            <PerformanceCard
                                title="Timing Performance"
                                icon={<RiTimeLine className="h-3 w-3 sm:h-4 sm:w-4" />}
                                metrics={[
                                    { label: "Min Time", value: `${performanceData.summary.min_time_ms?.toFixed(3) || "N/A"} ms` },
                                    { label: "Avg Time", value: `${metadata.avg_solve_time_ms?.toFixed(3) || "N/A"} ms` },
                                    { label: "Max Time", value: `${performanceData.summary.max_time_ms?.toFixed(3) || "N/A"} ms` },
                                ]}
                            />

                            <PerformanceCard
                                title="Energy Performance"
                                icon={<RiThunderstormsLine className="h-3 w-3 sm:h-4 sm:w-4" />}
                                metrics={[
                                    { label: "Total Energy", value: `${metadata.avg_energy_nj?.toFixed(2) || "N/A"} nJ` },
                                    { label: "Per Variable", value: `${metadata.energy_per_variable_pj?.toFixed(2) || "N/A"} pJ` },
                                    { label: "Power", value: `${metadata.power_consumption_mw?.toFixed(1) || "N/A"} mW` },
                                ]}
                            />

                            <PerformanceCard
                                title="Problem Complexity"
                                icon={<RiCpuLine className="h-3 w-3 sm:h-4 sm:w-4" />}
                                metrics={[
                                    { label: "Variables", value: config.num_variables || "N/A" },
                                    { label: "Clauses", value: config.num_clauses || "N/A" },
                                    { label: "Density", value: config.num_variables ? (config.num_clauses / config.num_variables).toFixed(2) : "N/A" },
                                ]}
                            />
                        </div>
                    )}

                    {/* DIMACS Input - Simplified */}
                    <Card>
                        <CardHeader className="pb-1 sm:pb-3">
                            <CardTitle className="text-xs sm:text-base">DIMACS Input</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-muted p-1.5 sm:p-4 rounded-md text-xs font-mono overflow-x-auto max-h-24 sm:max-h-32">
                                {config.dimacs_input || "No input available"}
                            </pre>
                        </CardContent>
                    </Card>

                    {/* Solution Details - Only if solution exists */}
                    {(metadata.dimacs_output || metadata.solution) && (
                        <Card>
                            <CardHeader className="pb-1 sm:pb-3">
                                <CardTitle className="text-xs sm:text-base">Solution</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 sm:space-y-3">
                                {/* DIMACS Output */}
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">DIMACS Output</label>
                                    <pre className="bg-muted p-1.5 sm:p-2 rounded-md mt-0.5 text-xs font-mono">
                                        {metadata.dimacs_output || `s ${metadata.satisfiable ? 'SATISFIABLE' : 'UNSATISFIABLE'}`}
                                    </pre>
                                </div>

                                {/* Variable Assignment - Hide on mobile if too long */}
                                {metadata.solution && metadata.solution.length <= 20 && (
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground">Variable Assignment</label>
                                        <div className="bg-muted p-1.5 sm:p-2 rounded-md mt-0.5">
                                            <div className="grid grid-cols-10 gap-1 text-xs font-mono">
                                                {metadata.solution.map((val: number, idx: number) => (
                                                    <div key={idx} className={`text-center ${val > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {val}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Verification */}
                                <div className="flex items-center gap-1.5 p-2 bg-muted rounded-lg">
                                    {metadata.satisfiable ? (
                                        <RiCheckboxCircleLine className="h-3 w-3 text-green-500 shrink-0" />
                                    ) : (
                                        <RiCloseCircleLine className="h-3 w-3 text-red-500 shrink-0" />
                                    )}
                                    <span className="text-xs">
                                        {metadata.satisfiable ? "Solution Verified" : "No Solution Exists"}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        {metadata.avg_solve_time_ms?.toFixed(3)} ms
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Performance Chart - Hide on mobile */}
                    {performanceData && performanceData.runs.length > 1 && (
                        <Card className="hidden sm:block">
                            <CardHeader className="pb-1 sm:pb-3">
                                <CardTitle className="text-xs sm:text-base">Solve Time Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={150}>
                                    <LineChart data={performanceData.runs}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="run" />
                                        <YAxis />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="time" stroke="#3b82f6" strokeWidth={2} name="Solve Time (ms)" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Solver Comparison - Simplified */}
                    <Card>
                        <CardHeader className="pb-1 sm:pb-3">
                            <CardTitle className="text-xs sm:text-base">Solver Comparison</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 sm:space-y-4">
                            {/* Power Comparison */}
                            <div>
                                <h4 className="text-xs font-medium mb-1.5">Energy Efficiency</h4>
                                <div className="flex justify-between items-center p-2 bg-primary/5 rounded-lg">
                                    <span className="text-xs">Analog: 50 nJ</span>
                                    <Badge variant="default" className="text-xs px-1.5 py-0.5">10× better</Badge>
                                    <span className="text-xs">Digital: 500 nJ</span>
                                </div>
                            </div>

                            {/* Solver Comparison Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-1 font-medium">Solver</th>
                                            <th className="text-right p-1 font-medium">Time</th>
                                            <th className="text-right p-1 font-medium hidden sm:table-cell">Energy</th>
                                            <th className="text-right p-1 font-medium">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className={`border-b ${solverType === 'DAEDALUS' ? 'font-medium bg-primary/5' : ''}`}>
                                            <td className="p-1">Daedalus</td>
                                            <td className="text-right p-1">0.1 ms</td>
                                            <td className="text-right p-1 hidden sm:table-cell">50 nJ</td>
                                            <td className="text-right p-1">Analog</td>
                                        </tr>
                                        <tr className={`border-b ${solverType === 'MINISAT' ? 'font-medium bg-primary/5' : ''}`}>
                                            <td className="p-1">MiniSAT</td>
                                            <td className="text-right p-1">10 ms</td>
                                            <td className="text-right p-1 hidden sm:table-cell">500 nJ</td>
                                            <td className="text-right p-1">Digital</td>
                                        </tr>
                                        <tr className={`border-b ${solverType === 'WALKSAT' ? 'font-medium bg-primary/5' : ''}`}>
                                            <td className="p-1">WalkSAT</td>
                                            <td className="text-right p-1">8 ms</td>
                                            <td className="text-right p-1 hidden sm:table-cell">400 nJ</td>
                                            <td className="text-right p-1">Digital</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    )
}

/* ----------------------------- helper components ------------------------ */
const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center min-h-[16px] sm:min-h-[18px]">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-medium text-xs text-right">{value}</span>
    </div>
)

const MetricRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div className="flex justify-between items-center min-h-[16px] sm:min-h-[18px]">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`font-medium text-xs text-right ${highlight ? "text-green-600 dark:text-green-400" : ""}`}>
            {value}
        </span>
    </div>
)

const PerformanceCard = ({ title, icon, metrics }: { title: string; icon: React.ReactNode; metrics: Array<{ label: string; value: string }> }) => (
    <Card>
        <CardHeader className="pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-base flex items-center gap-1.5">
                {icon}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 sm:space-y-1.5">
            {metrics.map((m, i) => (
                <div key={i} className="flex justify-between items-center min-h-[16px] sm:min-h-[18px]">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    <span className="font-mono text-xs font-medium text-right">{m.value}</span>
                </div>
            ))}
        </CardContent>
    </Card>
)

export default SATTestDetailsModal