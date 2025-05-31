/* --------------------------------------------------------------------------
 * components/ldpc-job-details-modal.tsx
 * Re‑usable dialog for viewing one LDPC job’s results.
 * -------------------------------------------------------------------------*/

"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  RiInformationLine,
  RiBarChartLine,
} from "@remixicon/react"

/* ---------------------------- derived metrics --------------------------- */
function calculateVLSIMetrics(results: any[], algorithmType: string) {
  if (!Array.isArray(results) || results.length === 0) return null

  const total = results.length
  const successes = results.filter((r) => r.success)
  const execTimes = results.map((r) => r.execution_time || 0).filter(Boolean)
  const totalBitErr = results.reduce((a, r) => a + (r.bit_errors || 0), 0)
  const totalIters = results.reduce((a, r) => a + (r.iterations || 0), 0)
  const powers = results.map((r) => r.power_consumption || 0).filter(Boolean)

  const codeLen = 96
  const kBits = 48

  const avgExec = execTimes.reduce((a, b) => a + b, 0) / execTimes.length || 0
  const minExec = Math.min(...execTimes)
  const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length || 0

  const avgThroughput = avgExec ? kBits / (avgExec / 1000) / 1e6 : 0
  const energyPerBit = avgPower && avgExec ? (avgPower * (avgExec / 1000) * 1e-3) / kBits * 1e12 : 0

  return {
    successRate: successes.length / total,
    frameErrorRate: (total - successes.length) / total,
    bitErrorRate: totalBitErr / (total * codeLen),
    avgExecutionTime: avgExec,
    avgThroughput,
    avgIterations: totalIters / total,
    energyPerBit,
  }
}

/* -------------------------------- component ---------------------------- */
interface LDPCJobDetailsModalProps {
  open: boolean
  onClose: () => void
  jobId: string | null
  jobData?: any
}

const LDPCJobDetailsModal: React.FC<LDPCJobDetailsModalProps> = ({
  open,
  onClose,
  jobId,
  jobData,
}) => {
  if (!jobId) return null

  const metrics = jobData?.results && Array.isArray(jobData.results)
    ? calculateVLSIMetrics(jobData.results, jobData.algorithm_type)
    : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>LDPC Test Results</DialogTitle>
          <DialogDescription>
            Detailed results for LDPC job {jobId}
          </DialogDescription>
        </DialogHeader>

        {jobData && (
          <div className="space-y-6">
            {/* -- Job info ------------------------------------------------ */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiInformationLine className="h-5 w-5" />
                  Job Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <div className="text-foreground">{jobData.name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Algorithm</label>
                  <div className="text-foreground">{jobData.algorithm_type}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Test Mode</label>
                  <div className="text-foreground">{jobData.test_mode}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Noise Level</label>
                  <div className="text-foreground">{jobData.noise_level} dB</div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <div className="text-foreground">
                    {new Date(jobData.created).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* -- Results -------------------------------------------------- */}
            {jobData.results && Array.isArray(jobData.results) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RiBarChartLine className="h-5 w-5" />
                    Test Results ({jobData.results.length} runs)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics ? (
                    <div className="grid grid-cols-3 gap-4">
                      <Metric label="Success Rate" value={`${(metrics.successRate * 100).toFixed(1)}%`} />
                      <Metric label="Avg Exec Time" value={`${metrics.avgExecutionTime.toFixed(2)} ms`} />
                      <Metric label="Avg Throughput" value={`${metrics.avgThroughput.toFixed(2)} Mbps`} />
                      <Metric label="Frame Error Rate" value={`${(metrics.frameErrorRate * 100).toFixed(1)}%`} />
                      <Metric label="Bit Error Rate" value={metrics.bitErrorRate.toExponential(2)} />
                      <Metric label="Avg Iterations" value={metrics.avgIterations.toFixed(1)} />
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No metrics available</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default LDPCJobDetailsModal

/* ----------------------------- tiny helper ----------------------------- */
const Metric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <div className="text-lg font-semibold text-foreground">{value}</div>
  </div>
)
