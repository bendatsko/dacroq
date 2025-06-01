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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts"
import {
  RiInformationLine,
  RiBarChartLine,
  RiCpuLine,
  RiFlashlightLine,
  RiTimeLine,
  RiThunderstormsLine,
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
        timeToSolution: meta.avg_execution_time_ms * 1e6, // Convert to ns
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

  const avgExecTime = execTimes.reduce((a, b) => a + b, 0) / execTimes.length || 0
  const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length || 0

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
    timeToSolution: avgExecTime * 1e6, // ns
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

  return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl">LDPC Decoder Performance Analysis</DialogTitle>
                <DialogDescription>
                  {jobData.name} • Job ID: {jobId.slice(0, 8)}
                </DialogDescription>
              </div>
              <Badge variant={jobData.status === "completed" ? "default" : "secondary"}>
                {jobData.status}
              </Badge>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
            </TabsList>

            <div className="overflow-y-auto max-h-[calc(90vh-180px)] mt-4">
              {/* ----------------------- OVERVIEW TAB ----------------------- */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Configuration Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <RiCpuLine className="h-5 w-5" />
                        Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <InfoRow label="Algorithm" value={
                        <Badge variant={isAnalogHardware ? "default" : "secondary"}>
                          {isAnalogHardware ? "Analog Hardware (Oscillator)" : "Digital Hardware (BP)"}
                        </Badge>
                      } />
                      <InfoRow label="Test Mode" value={jobData.test_mode || "N/A"} />
                      <InfoRow label="Code Parameters" value={`(${config.code_parameters?.n || 96}, ${config.code_parameters?.k || 48})`} />
                      <InfoRow label="Code Rate" value={`${(config.code_parameters?.rate || 0.5).toFixed(2)}`} />
                      <InfoRow label="Target SNR" value={`${config.snr_db?.toFixed(1) || "N/A"} dB`} />
                      <InfoRow label="Max Iterations" value={config.max_iterations || 10} />
                    </CardContent>
                  </Card>

                  {/* Quick Metrics Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <RiBarChartLine className="h-5 w-5" />
                        Key Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {metrics && (
                          <>
                            <MetricRow
                                label="Convergence Rate"
                                value={`${(metrics.convergenceRate * 100).toFixed(2)}%`}
                                highlight={metrics.convergenceRate > 0.99}
                            />
                            <MetricRow
                                label="Frame Error Rate"
                                value={metrics.frameErrorRate.toExponential(2)}
                                highlight={metrics.frameErrorRate < 1e-4}
                            />
                            <MetricRow
                                label="Bit Error Rate"
                                value={metrics.bitErrorRate.toExponential(2)}
                                highlight={metrics.bitErrorRate < 1e-5}
                            />
                            <MetricRow
                                label="Time to Solution"
                                value={`${(metrics.timeToSolution / 1000).toFixed(1)} μs`}
                                highlight={isAnalogHardware && metrics.timeToSolution < 100000}
                            />
                            <MetricRow
                                label="Energy Efficiency"
                                value={`${metrics.energyPerBit.toFixed(2)} pJ/bit`}
                                highlight={isAnalogHardware && metrics.energyPerBit < 10}
                            />
                          </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Message Recovery (if applicable) */}
                {jobData.metadata?.original_message && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <RiInformationLine className="h-5 w-5" />
                          Message Recovery
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Original Message</label>
                          <div className="font-mono bg-muted p-2 rounded mt-1">
                            {jobData.metadata.original_message}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Decoded Message</label>
                          <div className="font-mono bg-muted p-2 rounded mt-1 flex items-center gap-2">
                            {jobData.metadata.decoded_message}
                            {jobData.metadata.message_recovered ? (
                                <RiCheckboxCircleLine className="h-5 w-5 text-green-500" />
                            ) : (
                                <RiCloseCircleLine className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                )}
              </TabsContent>

              {/* --------------------- PERFORMANCE TAB ---------------------- */}
              <TabsContent value="performance" className="space-y-4">
                {metrics && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <PerformanceCard
                            title="Execution Performance"
                            icon={<RiTimeLine />}
                            metrics={[
                              { label: "Avg Execution Time", value: `${metrics.avgExecutionTime.toFixed(2)} ms` },
                              { label: "Time to Solution", value: `${(metrics.timeToSolution / 1000).toFixed(1)} μs` },
                              { label: "Throughput", value: `${metrics.avgThroughput.toFixed(2)} Mbps` },
                              { label: "Iterations", value: metrics.avgIterations.toFixed(1) },
                            ]}
                        />

                        <PerformanceCard
                            title="Error Performance"
                            icon={<RiBarChartLine />}
                            metrics={[
                              { label: "FER", value: metrics.frameErrorRate.toExponential(2) },
                              { label: "BER", value: metrics.bitErrorRate.toExponential(2) },
                              { label: "Success Rate", value: `${(metrics.successRate * 100).toFixed(1)}%` },
                              { label: "Convergence", value: `${(metrics.convergenceRate * 100).toFixed(2)}%` },
                            ]}
                        />

                        <PerformanceCard
                            title="Energy Performance"
                            icon={<RiThunderstormsLine />}
                            metrics={[
                              { label: "Energy/bit", value: `${metrics.energyPerBit.toFixed(2)} pJ/bit` },
                              { label: "Power", value: `${metrics.avgPowerConsumption.toFixed(1)} mW` },
                              { label: "vs Digital BP", value: isAnalogHardware ? "11× better" : "Baseline" },
                              { label: "vs State-of-Art", value: isAnalogHardware ? "3× better" : "—" },
                            ]}
                        />
                      </div>

                      {/* Detailed Statistics Table */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Detailed Run Statistics</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                              <tr className="border-b">
                                <th className="text-left p-2">Metric</th>
                                <th className="text-right p-2">Min</th>
                                <th className="text-right p-2">Mean</th>
                                <th className="text-right p-2">Max</th>
                                <th className="text-right p-2">Std Dev</th>
                              </tr>
                              </thead>
                              <tbody>
                              {jobData.results && calculateStatistics(jobData.results).map((stat: any) => (
                                  <tr key={stat.metric} className="border-b">
                                    <td className="p-2">{stat.metric}</td>
                                    <td className="text-right p-2 font-mono">{stat.min}</td>
                                    <td className="text-right p-2 font-mono font-medium">{stat.mean}</td>
                                    <td className="text-right p-2 font-mono">{stat.max}</td>
                                    <td className="text-right p-2 font-mono">{stat.stdDev}</td>
                                  </tr>
                              ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                )}
              </TabsContent>

              {/* -------------------- VISUALIZATIONS TAB -------------------- */}
              <TabsContent value="visualizations" className="space-y-4">
                {/* SNR vs Error Rate Plot */}
                <Card>
                  <CardHeader>
                    <CardTitle>SNR vs Error Rate Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData.scatter}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="snr" label={{ value: "SNR (dB)", position: "insideBottom", offset: -5 }} />
                        <YAxis scale="log" domain={[1e-8, 1]} tickFormatter={(v) => v.toExponential(0)} />
                        <Tooltip formatter={(v: any) => v.toExponential(2)} />
                        <Legend />
                        <Line type="monotone" dataKey="fer" stroke="#ef4444" name="FER" strokeWidth={2} />
                        <Line type="monotone" dataKey="ber" stroke="#3b82f6" name="BER" strokeWidth={2} />
                        <ReferenceLine y={1e-5} stroke="#666" strokeDasharray="5 5" label="Target BER" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Execution Time Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Execution Time & Power Consumption</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData.histogram}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="run" label={{ value: "Test Run", position: "insideBottom", offset: -5 }} />
                        <YAxis yAxisId="left" label={{ value: "Time (ms)", angle: -90, position: "insideLeft" }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: "Power (mW)", angle: 90, position: "insideRight" }} />
                        <Tooltip />
                        <Legend />
                        <Area yAxisId="left" type="monotone" dataKey="time" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Execution Time" />
                        <Area yAxisId="right" type="monotone" dataKey="power" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Power" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Success Rate Progress */}
                <Card>
                  <CardHeader>
                    <CardTitle>Convergence Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData.histogram}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="run" />
                        <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                        <Tooltip formatter={(v: any) => v ? "Success" : "Failed"} />
                        <Line type="stepAfter" dataKey="success" stroke="#10b981" strokeWidth={2} name="Decode Success" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* --------------------- COMPARISON TAB ----------------------- */}
              <TabsContent value="comparison" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Comparison vs State-of-the-Art</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Analog vs Digital Comparison */}
                    <div>
                      <h4 className="font-medium mb-3">Analog Hardware vs Digital Baseline</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <ComparisonMetric
                            label="Energy Efficiency"
                            analogValue="5.47 pJ/bit"
                            digitalValue="60.91 pJ/bit"
                            improvement="11.1×"
                            better={isAnalogHardware}
                        />
                        <ComparisonMetric
                            label="Time to Solution"
                            analogValue="89 ns"
                            digitalValue="5 ms"
                            improvement="56×"
                            better={isAnalogHardware}
                        />
                        <ComparisonMetric
                            label="Power Consumption"
                            analogValue="5.9 mW"
                            digitalValue="500 mW"
                            improvement="85×"
                            better={isAnalogHardware}
                        />
                        <ComparisonMetric
                            label="Low SNR Performance"
                            analogValue="3 OOM better"
                            digitalValue="Baseline"
                            improvement="1000×"
                            better={isAnalogHardware}
                        />
                      </div>
                    </div>

                    {/* Reference Implementations */}
                    <div>
                      <h4 className="font-medium mb-3">Published Results Comparison</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Implementation</th>
                            <th className="text-right p-2">Energy/bit</th>
                            <th className="text-right p-2">Throughput</th>
                            <th className="text-right p-2">Technology</th>
                            <th className="text-right p-2">Year</th>
                          </tr>
                          </thead>
                          <tbody>
                          <tr className="border-b font-medium bg-primary/5">
                            <td className="p-2">This Work (Analog)</td>
                            <td className="text-right p-2">5.47 pJ/bit</td>
                            <td className="text-right p-2">539 Mbps</td>
                            <td className="text-right p-2">28nm CMOS</td>
                            <td className="text-right p-2">2024</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2">SSC-L 2022 [1]</td>
                            <td className="text-right p-2">60.91 pJ/bit</td>
                            <td className="text-right p-2">1.78 Gbps</td>
                            <td className="text-right p-2">40nm CMOS</td>
                            <td className="text-right p-2">2022</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2">A-SSCC 2015 [2]</td>
                            <td className="text-right p-2">18 pJ/bit</td>
                            <td className="text-right p-2">18 Gbps</td>
                            <td className="text-right p-2">28nm CMOS</td>
                            <td className="text-right p-2">2015</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2">ISSCC 2014 [3]</td>
                            <td className="text-right p-2">8.2 pJ/bit</td>
                            <td className="text-right p-2">6 Gbps</td>
                            <td className="text-right p-2">28nm FDSOI</td>
                            <td className="text-right p-2">2014</td>
                          </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Visual Comparison Chart */}
                    <div>
                      <h4 className="font-medium mb-3">Energy Efficiency Comparison</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { name: "This Work", energy: 5.47 },
                          { name: "ISSCC'14", energy: 8.2 },
                          { name: "A-SSCC'15", energy: 18 },
                          { name: "SSC-L'22", energy: 60.91 },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis label={{ value: "Energy (pJ/bit)", angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          <Bar dataKey="energy" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
  )
}

/* ----------------------------- helper components ------------------------ */
const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
)

const MetricRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? "text-green-600 dark:text-green-400" : ""}`}>
      {value}
    </span>
    </div>
)

const PerformanceCard = ({ title, icon, metrics }: { title: string; icon: React.ReactNode; metrics: Array<{ label: string; value: string }> }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {metrics.map((m, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{m.label}</span>
              <span className="font-mono text-sm font-medium">{m.value}</span>
            </div>
        ))}
      </CardContent>
    </Card>
)

const ComparisonMetric = ({
                            label,
                            analogValue,
                            digitalValue,
                            improvement,
                            better
                          }: {
  label: string;
  analogValue: string;
  digitalValue: string;
  improvement: string;
  better: boolean;
}) => (
    <div className="p-4 border rounded-lg">
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className={better ? "font-medium text-green-600 dark:text-green-400" : ""}>
          Analog: {analogValue}
        </div>
        <div className={!better ? "font-medium" : "text-muted-foreground"}>
          Digital: {digitalValue}
        </div>
      </div>
      <div className="mt-2 text-xs text-center">
        <Badge variant={better ? "default" : "secondary"}>{improvement} improvement</Badge>
      </div>
    </div>
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

/* Missing import for BarChart */
import { BarChart, Bar } from "recharts"

export default LDPCJobDetailsModal