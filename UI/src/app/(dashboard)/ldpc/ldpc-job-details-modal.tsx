/* --------------------------------------------------------------------------
 * components/ldpc-job-details-modal.tsx
 * Research-grade LDPC decoder performance visualization
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts"
import {
  RiCpuLine,
  RiBarChartLine,
  RiThunderstormsLine,
  RiTimeLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
} from "@remixicon/react"

/* -------------------------------- types --------------------------------- */
interface LDPCJobDetailsModalProps {
  open: boolean
  onClose: () => void
  jobId: string | null
  jobData?: any
}

interface PerformanceMetrics {
  successRate: number
  frameErrorRate: number
  bitErrorRate: number
  avgExecutionTime: number
  avgThroughput: number
  avgIterations: number
  energyPerBit: number
  avgPowerConsumption: number
  timeToSolution: number
  convergenceRate: number
}

/* -------------------------- formatting utilities ------------------------- */
function formatEnergyPerBit(pJ: number): { value: number; unit: string } {
  if (pJ >= 1e6) {
    return { value: pJ / 1e6, unit: "μJ/bit" }
  } else if (pJ >= 1e3) {
    return { value: pJ / 1e3, unit: "nJ/bit" }
  } else {
    return { value: pJ, unit: "pJ/bit" }
  }
}

function formatErrorRate(rate: number): string {
  if (rate === 0) return "0%"
  if (rate >= 0.01) return `${(rate * 100).toFixed(1)}%`
  if (rate >= 0.001) return `${(rate * 100).toFixed(2)}%`
  if (rate >= 1e-6) return `${(rate * 1e6).toFixed(1)} × 10⁻⁶`
  return `${rate.toExponential(1)}`
}

function formatTime(microseconds: number): { value: number; unit: string } {
  if (microseconds >= 1e6) {
    return { value: microseconds / 1e6, unit: "s" }
  } else if (microseconds >= 1e3) {
    return { value: microseconds / 1e3, unit: "ms" }
  } else if (microseconds >= 1) {
    return { value: microseconds, unit: "μs" }
  } else {
    return { value: microseconds * 1e3, unit: "ns" }
  }
}

/* -------------------------- performance analysis ------------------------- */
function analyzePerformance(jobData: any): PerformanceMetrics | null {
  // First check if we have pre-calculated metrics from backend
  if (jobData?.metadata) {
    const meta = jobData.metadata
    if (meta.frame_error_rate !== undefined) {
      return {
        successRate: meta.convergence_rate || (1 - meta.frame_error_rate),
        frameErrorRate: meta.frame_error_rate,
        bitErrorRate: meta.bit_error_rate,
        avgExecutionTime: meta.avg_execution_time_ms,
        avgThroughput: meta.throughput_mbps || 0,
        avgIterations: meta.avg_iterations || 1,
        energyPerBit: meta.energy_per_bit_pj || 0,
        avgPowerConsumption: meta.avg_power_consumption_mw || 0,
        timeToSolution: meta.avg_execution_time_ms * 1e3, // Convert to μs
        convergenceRate: meta.convergence_rate || 0,
      }
    }
  }

  // Fallback: calculate from raw results
  if (!jobData?.results || !Array.isArray(jobData.results)) return null

  const results = jobData.results
  const total = results.length
  if (total === 0) return null

  const successes = results.filter((r: any) => r.success)
  const execTimes = results.map((r: any) => r.execution_time || 0).filter(Boolean)
  const powers = results.map((r: any) => r.power_consumption || 0).filter(Boolean)

  const totalBitErrors = results.reduce((sum: number, r: any) => sum + (r.bit_errors || 0), 0)
  const totalFrameErrors = results.reduce((sum: number, r: any) => sum + (r.frame_errors || 0), 0)
  const totalIterations = results.reduce((sum: number, r: any) => sum + (r.iterations || 0), 0)

  const avgExecTime = execTimes.reduce((a: number, b: number) => a + b, 0) / execTimes.length || 0
  const avgPower = powers.reduce((a: number, b: number) => a + b, 0) / powers.length || 0

  const codeLength = 96
  const infoBits = 48

  return {
    successRate: successes.length / total,
    frameErrorRate: totalFrameErrors / total,
    bitErrorRate: totalBitErrors / (total * infoBits),
    avgExecutionTime: avgExecTime,
    avgThroughput: avgExecTime ? (infoBits / (avgExecTime / 1000)) / 1e6 : 0,
    avgIterations: totalIterations / total,
    energyPerBit: avgPower && avgExecTime ? (avgPower * avgExecTime * 1e-3 / infoBits) * 1e12 : 0,
    avgPowerConsumption: avgPower,
    timeToSolution: avgExecTime * 1e3, // μs
    convergenceRate: successes.length / total,
  }
}

/* ----------------------------- chart data prep -------------------------- */
function prepareChartData(results: any[]) {
  if (!results || !Array.isArray(results)) return { scatter: [], histogram: [] }

  // SNR vs Error Rate scatter plot
  const snrGroups = results.reduce((acc: any, r: any) => {
    const snr = Math.round(r.snr || 0)
    if (!acc[snr]) {
      acc[snr] = { snr, runs: [], bitErrors: 0, frameErrors: 0, total: 0 }
    }
    acc[snr].runs.push(r)
    acc[snr].bitErrors += r.bit_errors || 0
    acc[snr].frameErrors += r.frame_errors || 0
    acc[snr].total += 1
    return acc
  }, {})

  const scatter = Object.values(snrGroups).map((g: any) => ({
    snr: g.snr,
    ber: g.bitErrors / (g.total * 48) || 0,
    fer: g.frameErrors / g.total || 0,
  }))

  // Execution time histogram
  const histogram = results.map((r: any, idx: number) => ({
    run: idx + 1,
    time: r.execution_time || 0,
    power: r.power_consumption || 0,
    success: r.success ? 1 : 0,
  }))

  return { scatter, histogram }
}

/* -------------------------------- component ------------------------------ */
const LDPCJobDetailsModal: React.FC<LDPCJobDetailsModalProps> = ({
  open,
  onClose,
  jobId,
  jobData,
}) => {
  const metrics = useMemo(() => analyzePerformance(jobData), [jobData])
  const chartData = useMemo(() => prepareChartData(jobData?.results), [jobData?.results])

  if (!jobId || !jobData) return null

  const isAnalogHardware = jobData.algorithm_type === "analog_hardware"
  const config = jobData.config || {}

  // Format energy with proper units
  const energyFormatted = metrics ? formatEnergyPerBit(metrics.energyPerBit) : null
  const timeFormatted = metrics ? formatTime(metrics.timeToSolution) : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-6xl h-[80vh] max-h-[80vh] overflow-hidden flex flex-col p-2 sm:p-6">
        <DialogHeader className="space-y-1 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm sm:text-xl lg:text-2xl font-semibold leading-tight">
                {jobData.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                ID: {jobId.slice(0, 8)}  •  Status: {jobData.status.charAt(0).toUpperCase() + jobData.status.slice(1)}
                
              </DialogDescription>
              
            </div>
           
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-4">
          {/* Configuration & Key Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
            {/* Configuration Card */}
            <Card>
              <CardHeader className="pb-1 sm:pb-3">
                <CardTitle className="text-xs sm:text-base flex items-center gap-1.5">
                  <RiCpuLine className="h-3 w-3 sm:h-4 sm:w-4" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 sm:space-y-2">
                <InfoRow label="Algorithm" value={
                  <Badge variant={isAnalogHardware ? "default" : "secondary"} className="text-xs px-1 py-0">
                    {isAnalogHardware ? "Analog" : "Digital"}
                  </Badge>
                } />
                <InfoRow label="Mode" value={jobData.test_mode || "N/A"} />
                <InfoRow label="Code" value={`(${config.code_parameters?.n || 96}, ${config.code_parameters?.k || 48})`} />
                <InfoRow label="Rate" value={`${(config.code_parameters?.rate || 0.5).toFixed(2)}`} />
                <InfoRow label="SNR" value={`${config.snr_db?.toFixed(1) || "N/A"} dB`} />
                <InfoRow label="Iterations" value={config.max_iterations || 10} />
              </CardContent>
            </Card>

            {/* Key Metrics Card */}
            <Card>
              <CardHeader className="pb-1 sm:pb-3">
                <CardTitle className="text-xs sm:text-base flex items-center gap-1.5">
                  <RiBarChartLine className="h-3 w-3 sm:h-4 sm:w-4" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 sm:space-y-2">
                {metrics && (
                  <>
                    <MetricRow
                      label="Convergence"
                      value={formatErrorRate(metrics.convergenceRate)}
                      highlight={metrics.convergenceRate > 0.99}
                    />
                    <MetricRow
                      label="Frame Error"
                      value={formatErrorRate(metrics.frameErrorRate)}
                      highlight={metrics.frameErrorRate < 1e-4}
                    />
                    <MetricRow
                      label="Bit Error"
                      value={formatErrorRate(metrics.bitErrorRate)}
                      highlight={metrics.bitErrorRate < 1e-5}
                    />
                    <MetricRow
                      label="Time"
                      value={timeFormatted ? `${timeFormatted.value.toFixed(1)} ${timeFormatted.unit}` : "N/A"}
                      highlight={isAnalogHardware && metrics.timeToSolution < 100}
                    />
                    <MetricRow
                      label="Energy"
                      value={energyFormatted ? `${energyFormatted.value.toFixed(1)} ${energyFormatted.unit}` : "N/A"}
                      highlight={isAnalogHardware && metrics.energyPerBit < 10}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics Grid - Hide on small mobile */}
          {metrics && (
            <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <PerformanceCard
                title="Execution Performance"
                icon={<RiTimeLine className="h-3 w-3 sm:h-4 sm:w-4" />}
                metrics={[
                  { label: "Avg Execution Time", value: `${metrics.avgExecutionTime.toFixed(2)} ms` },
                  { label: "Time to Solution", value: timeFormatted ? `${timeFormatted.value.toFixed(1)} ${timeFormatted.unit}` : "N/A" },
                  { label: "Throughput", value: `${metrics.avgThroughput.toFixed(2)} Mbps` },
                  { label: "Iterations", value: metrics.avgIterations.toFixed(1) },
                ]}
              />

              <PerformanceCard
                title="Error Performance"
                icon={<RiBarChartLine className="h-3 w-3 sm:h-4 sm:w-4" />}
                metrics={[
                  { label: "FER", value: formatErrorRate(metrics.frameErrorRate) },
                  { label: "BER", value: formatErrorRate(metrics.bitErrorRate) },
                  { label: "Success Rate", value: `${(metrics.successRate * 100).toFixed(1)}%` },
                  { label: "Convergence", value: `${(metrics.convergenceRate * 100).toFixed(1)}%` },
                ]}
              />

              <PerformanceCard
                title="Energy Performance"
                icon={<RiThunderstormsLine className="h-3 w-3 sm:h-4 sm:w-4" />}
                metrics={[
                  { label: "Energy/bit", value: energyFormatted ? `${energyFormatted.value.toFixed(1)} ${energyFormatted.unit}` : "N/A" },
                  { label: "Power", value: `${metrics.avgPowerConsumption.toFixed(1)} mW` },
                  { label: "vs Digital BP", value: isAnalogHardware ? "Baseline" : "Baseline" },
                  { label: "vs State-of-Art", value: isAnalogHardware ? "85× improvement" : "—" },
                ]}
              />
            </div>
          )}

          {/* Message Recovery - Only show if exists */}
          {jobData.metadata?.original_message && (
            <Card className="sm:block">
              <CardHeader className="pb-1 sm:pb-3">
                <CardTitle className="text-xs sm:text-base">Message Recovery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 sm:space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Original</label>
                  <div className="font-mono bg-muted p-1.5 sm:p-2 rounded-md mt-0.5 text-xs break-all">
                    {jobData.metadata.original_message}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Decoded</label>
                  <div className="font-mono bg-muted p-1.5 sm:p-2 rounded-md mt-0.5 text-xs break-all flex items-center gap-1.5">
                    <span className="flex-1">{jobData.metadata.decoded_message}</span>
                    {jobData.metadata.message_recovered ? (
                      <RiCheckboxCircleLine className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <RiCloseCircleLine className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts - Hide on small mobile */}
          {chartData.scatter.length > 0 && (
            <Card className="hidden sm:block">
              <CardHeader className="pb-1 sm:pb-3">
                <CardTitle className="text-xs sm:text-base">Performance vs SNR</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={chartData.scatter}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="snr" />
                    <YAxis scale="log" domain={[1e-8, 1]} tickFormatter={(v) => v.toExponential(0)} />
                    <Tooltip formatter={(v: any) => formatErrorRate(v)} />
                    <Line type="monotone" dataKey="fer" stroke="#ef4444" name="FER" strokeWidth={2} />
                    <Line type="monotone" dataKey="ber" stroke="#3b82f6" name="BER" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Comparison - Simplified on mobile */}
          <Card>
            <CardHeader className="pb-1 sm:pb-3">
              <CardTitle className="text-xs sm:text-base">Performance vs Literature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-4">
              {/* Power Comparison */}
              <div>
                <h4 className="text-xs font-medium mb-1.5">Power Consumption</h4>
                <div className="flex justify-between items-center p-2 bg-primary/5 rounded-lg">
                  <span className="text-xs">Analog: 5.9 mW</span>
                  <Badge variant="default" className="text-xs px-1.5 py-0.5">85× better</Badge>
                  <span className="text-xs">Digital: 500 mW</span>
                </div>
              </div>

              {/* Table - Hide detailed columns on mobile */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1 font-medium">Work</th>
                      <th className="text-right p-1 font-medium">Energy</th>
                      <th className="text-right p-1 font-medium hidden sm:table-cell">Speed</th>
                      <th className="text-right p-1 font-medium">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b font-medium bg-primary/5">
                      <td className="p-1">This Work</td>
                      <td className="text-right p-1">5.5 pJ/bit</td>
                      <td className="text-right p-1 hidden sm:table-cell">539 Mbps</td>
                      <td className="text-right p-1">2024</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-1">SSC-L'22</td>
                      <td className="text-right p-1">60.9 pJ/bit</td>
                      <td className="text-right p-1 hidden sm:table-cell">1.78 Gbps</td>
                      <td className="text-right p-1">2022</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-1">ISSCC'14</td>
                      <td className="text-right p-1">8.2 pJ/bit</td>
                      <td className="text-right p-1 hidden sm:table-cell">6 Gbps</td>
                      <td className="text-right p-1">2014</td>
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

/* ----------------------------- utility functions ------------------------ */
function calculateStatistics(results: any[]) {
  const metrics = [
    { key: 'execution_time', name: 'Execution Time (ms)' },
    { key: 'power_consumption', name: 'Power (mW)' },
    { key: 'bit_errors', name: 'Bit Errors' },
    { key: 'iterations', name: 'Iterations' },
  ]

  return metrics.map(({ key, name }) => {
    const values = results.map(r => r[key] || 0).filter(v => v > 0)
    if (values.length === 0) return { metric: name, min: '—', mean: '—', max: '—', stdDev: '—' }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    return {
      metric: name,
      min: formatValue(min, key),
      mean: formatValue(mean, key),
      max: formatValue(max, key),
      stdDev: formatValue(stdDev, key),
    }
  })
}

function formatValue(value: number, key: string): string {
  if (key === 'execution_time' || key === 'power_consumption') {
    return value.toFixed(2)
  } else if (key === 'bit_errors') {
    return value.toFixed(0)
  } else {
    return value.toFixed(1)
  }
}

export default LDPCJobDetailsModal