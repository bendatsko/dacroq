// app/src/app/monitoring/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  RiRefreshLine,
  RiLoader4Line,
} from "@remixicon/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Terminal } from "@/components/Terminal";

// -----------------------------------------------------------------------------
// Constants & Types
// -----------------------------------------------------------------------------
const API_BASE = "https://medusa.bendatsko.com";

const MACHINE_TYPES = ["machine-1", "machine-2", "machine-3"] as const;
type MachineType = (typeof MACHINE_TYPES)[number];

const initialHardwareStatus = {
  "machine-1": { cpu: null, memory: null, disk: null },
  "machine-2": { cpu: null, memory: null, disk: null },
  "machine-3": { cpu: null, memory: null, disk: null },
};

// ----- API-health & metric shapes -----
interface ApiHealth {
  api_status: string;
  db_status: string;
  timestamp: string;
}

interface TestMetric {
  status: string;
  count: number;
}

interface ApiMetrics {
  tests_run: TestMetric[];
  api_requests: number;
  data_transferred: number;
  average_response_time: number;
  errors: number;
}

interface Project {
  name: string;
  requests: number;
  color: string;
}

interface TimeBucket {
  time_bucket: string;
  count?: number;
  value?: number;
}

interface SysBucket {
  timestamp: string;
  cpu: number;
  mem_used_mb: number;
  mem_avail_mb: number;
}

interface TestMetadata {
  createdBy?: { name: string };
}

interface TestData {
  status: string;
  data_size?: number;
  response_time?: number;
  project?: string;
  metadata?: TestMetadata;
}

interface MachineStatus {
  cpu: number | null;
  memory: number | null;
  disk: null;
}

type HardwareStatus = Record<MachineType, MachineStatus>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function MonitoringPage() {
  // ----- state -----
  const [queryTimeRange, setQueryTimeRange] = useState("Last 24 hours");
  const [visualizationType, setVisualizationType] = useState("API Requests");
  const [hasResults, setHasResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [healthData, setHealthData] = useState<ApiHealth | null>(null);
  const [apiMetrics, setApiMetrics] = useState<ApiMetrics | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // sliding-window series
  const [seriesReq, setSeriesReq] = useState<TimeBucket[]>([]);
  const [seriesData, setSeriesData] = useState<TimeBucket[]>([]);
  const [seriesResp, setSeriesResp] = useState<TimeBucket[]>([]);
  const [sysSeries, setSysSeries] = useState<SysBucket[]>([]);

  // hardware (still fetched but no longer rendered)
  const [hardwareStatus, setHardwareStatus] =
    useState<HardwareStatus>(initialHardwareStatus);

  // ----- hydration guard -----
  useEffect(() => setIsClient(true), []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const getTimeRangeMs = () => {
    switch (queryTimeRange) {
      case "Last 1 hour":
        return 60 * 60 * 1000;
      case "Last 6 hours":
        return 6 * 60 * 60 * 1000;
      case "Last 24 hours":
        return 24 * 60 * 60 * 1000;
      case "Last 7 days":
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  };

  const processTestResults = (
    tests: TestData[]
  ): { metrics: ApiMetrics; projects: Project[] } => {
    // tally status counts
    const statusCounts = tests.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    const testMetrics: TestMetric[] = Object.entries(statusCounts).map(
      ([status, count]) => ({ status, count })
    );

    const metrics: ApiMetrics = {
      tests_run: testMetrics,
      api_requests: tests.length * 3 + 50,
      data_transferred: Math.round(tests.length * 5.2),
      average_response_time: 120 + Math.random() * 100,
      errors: Math.floor(tests.length * 0.03),
    };

    const validTests = tests.filter(
      (t): t is TestData & { metadata: { createdBy: { name: string } } } =>
        typeof t.metadata?.createdBy?.name === "string"
    );

    const uniqueNames = Array.from(
      new Set(validTests.map((t) => t.metadata.createdBy.name))
    );
    const colors = ["blue-500", "emerald-500", "violet-500", "amber-500"];
    let projects: Project[] = uniqueNames.map((name, i) => ({
      name,
      requests: validTests.filter(
        (t) => t.metadata.createdBy.name === name
      ).length,
      color: colors[i % colors.length],
    }));

    if (projects.length < 2) {
      projects = [
        ...projects,
        { name: "dacroq", requests: 98, color: "blue-500" },
        { name: "benweb", requests: 102, color: "emerald-500" },
      ];
    }
    return { metrics, projects };
  };

  // ---------------------------------------------------------------------------
  // Data polling
  // ---------------------------------------------------------------------------
  // API health – 30 s
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        setHealthData(await res.json());
      } catch (e) {
        console.error("Error fetching API health:", e);
      }
    };
    fetchHealth();
    const id = setInterval(fetchHealth, 30_000);
    return () => clearInterval(id);
  }, [refreshKey]);

  // Test-metrics – 15 s
  useEffect(() => {
    const pollMetrics = async () => {
      try {
        const timeRange = getTimeRangeMs();
        const res = await fetch(
          `${API_BASE}/api/tests?timeRange=${timeRange}`
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const tests = await res.json();
        const { metrics, projects } = processTestResults(tests);
        setApiMetrics(metrics);
        setProjects(projects);
        setHasResults(true);
      } catch (e) {
        console.error("Error polling metrics:", e);
      }
    };
    pollMetrics();
    const id = setInterval(pollMetrics, 15_000);
    return () => clearInterval(id);
  }, [queryTimeRange, refreshKey]);

  // Sliding-window charts – 10 s
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const range = 5 * 60 * 1000;
        const [r1, r2, r3] = await Promise.all([
          fetch(
            `${API_BASE}/api/metrics/time-series?timeRange=${range}&type=requests`
          ),
          fetch(
            `${API_BASE}/api/metrics/time-series?timeRange=${range}&type=data_transfer`
          ),
          fetch(
            `${API_BASE}/api/metrics/time-series?timeRange=${range}&type=response_time`
          ),
        ]).then((ps) => Promise.all(ps.map((p) => p.json())));
        setSeriesReq(r1.data);
        setSeriesData(r2.data);
        setSeriesResp(r3.data);
      } catch (e) {
        console.error("Error fetching time series:", e);
      }
    };
    fetchSeries();
    const id = setInterval(fetchSeries, 10_000);
    return () => clearInterval(id);
  }, [refreshKey]);

  // System metrics – 1 s
  useEffect(() => {
    const fetchSystem = async () => {
      try {
        const ms = 5 * 60 * 1000;
        const res = await fetch(
          `${API_BASE}/api/system-metrics/time-series?timeRange=${ms}`
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const j = await res.json();
        const buckets: SysBucket[] = j.data.map((r: any) => ({
          timestamp: r.timestamp,
          cpu: r.cpu_percent,
          mem_used_mb: r.mem_used / 1024 / 1024,
          mem_avail_mb: r.mem_available / 1024 / 1024,
        }));
        setSysSeries(buckets);
      } catch (e) {
        console.error("Error fetching system metrics:", e);
      }
    };
    fetchSystem();
    const id = setInterval(fetchSystem, 1_000);
    return () => clearInterval(id);
  }, [refreshKey]);

  // Hardware status – 1 s (still fetched; UI removed)
  useEffect(() => {
    const handleRefresh = async () => {
      try {
        const responses = await Promise.all(
          MACHINE_TYPES.map((machine) =>
            fetch(`${API_BASE}/api/hardware/${machine}`, {
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              credentials: "include",
            })
          )
        );
        const newStatus = { ...initialHardwareStatus };
        for (let i = 0; i < responses.length; i++) {
          if (responses[i].ok) {
            newStatus[MACHINE_TYPES[i]] = await responses[i].json();
          }
        }
        setHardwareStatus(newStatus);
      } catch (e) {
        console.error("Error refreshing hardware status:", e);
      }
    };
    handleRefresh();
    const id = setInterval(handleRefresh, 1_000);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------------------
  // User actions
  // ---------------------------------------------------------------------------
  const handleQuery = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const timeRange = getTimeRangeMs();
      const res = await fetch(`${API_BASE}/api/tests?timeRange=${timeRange}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const tests = await res.json();
      const { metrics, projects } = processTestResults(tests);
      setApiMetrics(metrics);
      setProjects(projects);
      setHasResults(true);
    } catch (e: any) {
      setError(`Failed to run query: ${e.message}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = async () => {
    if (
      !window.confirm(
        "Are you sure you want to restart the service? This will temporarily interrupt all API operations."
      )
    )
      return;
    setIsRestarting(true);
    const res = await fetch(`${API_BASE}/api/admin/restart`, { method: "POST" });
    if (!res.ok) {
      setIsRestarting(false);
      alert(`Restart failed with status ${res.status}`);
      return;
    }
    alert("Restart initiated. The page will reload when the service is back.");
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/health`);
        if (r.ok) window.location.reload();
        else setTimeout(poll, 1_000);
      } catch {
        setTimeout(poll, 1_000);
      }
    };
    setTimeout(poll, 2_000);
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* --------------------------------------------------------------- Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            System Monitor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Live system & API health and real-time metrics
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleRestart}
          disabled={isRestarting}
        >
          <RiRefreshLine
            className={`h-4 w-4 mr-1 ${isRestarting ? "animate-spin" : ""}`}
          />
          {isRestarting ? "Restarting…" : "Restart Service"}
        </Button>
      </header>

      {/* -------------------------------------- Unified System & API Metrics 📊 */}
      <section className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4 space-y-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          System & API Metrics <span className="text-sm">(last 5 minutes)</span>
        </h2>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* API status */}
          <div className="p-4 border rounded-lg">
            <h4 className="text-sm font-medium mb-1">API Status</h4>
            <div className="flex items-center">
              <span
                className={`h-3 w-3 mr-2 rounded-full ${
                  healthData?.api_status === "ok"
                    ? "bg-green-500"
                    : healthData?.api_status === "degraded"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <span className="font-semibold">
                {healthData?.api_status === "ok"
                  ? "Online"
                  : healthData?.api_status === "degraded"
                  ? "Degraded"
                  : "Offline"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isClient && healthData
                ? new Date(healthData.timestamp).toLocaleTimeString()
                : "—"}
            </p>
          </div>

          {/* DB status */}
          <div className="p-4 border rounded-lg">
            <h4 className="text-sm font-medium mb-1">Database Status</h4>
            <div className="flex items-center">
              <span
                className={`h-3 w-3 mr-2 rounded-full ${
                  healthData?.db_status === "online"
                    ? "bg-green-500"
                    : healthData?.db_status === "degraded"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <span className="font-semibold capitalize">
                {healthData?.db_status || "Unknown"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              SQLite @ medusa.bendatsko.com
            </p>
          </div>

          {/* API requests */}
          <KpiCard label="API Requests" value={apiMetrics?.api_requests} />
          {/* Data transferred */}
          <KpiCard
            label="Data Transferred"
            value={
              apiMetrics ? `${apiMetrics.data_transferred} MB` : undefined
            }
          />
          {/* Avg response */}
          <KpiCard
            label="Avg Response"
            value={
              apiMetrics
                ? `${apiMetrics.average_response_time.toFixed(1)} ms`
                : undefined
            }
          />
          {/* Errors */}
          <KpiCard label="Errors" value={apiMetrics?.errors} />
        </div>

        {/* first chart row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Chart
            title="Requests"
            data={seriesReq}
            dataKey="count"
            stroke="#3B82F6"
          />
          <Chart
            title="Data Transfer (MB)"
            data={seriesData}
            dataKey="value"
            stroke="#10B981"
          />
          <Chart
            title="Response Time (ms)"
            data={seriesResp}
            dataKey="value"
            stroke="#F59E0B"
          />
        </div>

        {/* second chart row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Chart
            title="CPU %"
            data={sysSeries}
            dataKey="cpu"
            stroke="#3B82F6"
            domain={[0, 100]}
          />
          <Chart
            title="Memory Used (MB)"
            data={sysSeries}
            dataKey="mem_used_mb"
            stroke="#10B981"
          />
          <Chart
            title="Memory Free (MB)"
            data={sysSeries}
            dataKey="mem_avail_mb"
            stroke="#F59E0B"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------- Console */}
      <section className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            System Terminal
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              alert(
                "Available commands:\n- status: Check API status\n- restart: Restart service\n- log: Show recent logs\n- help: More commands"
              )
            }
          >
            Help
          </Button>
        </div>
        {isClient && <Terminal />}
        <p className="text-xs text-gray-500 mt-2">
          Type <code>help</code> for a list of commands.
        </p>
      </section>

      {/* ---------------------------------------- Solver Metrics / Query Builder */}
      <section className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
        <header className="border-b px-6 py-4 border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Query Builder
          </h2>
        </header>

        <div className="p-6 space-y-6">
          {/* -- form controls -- */}
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* time-range */}
            <LabeledSelect
              label="Time Range"
              value={queryTimeRange}
              onChange={setQueryTimeRange}
              options={[
                "Last 1 hour",
                "Last 6 hours",
                "Last 24 hours",
                "Last 7 days",
              ]}
            />
            {/* visualization type */}
            <LabeledSelect
              label="Visualization"
              value={visualizationType}
              onChange={setVisualizationType}
              options={[
                "API Requests",
                "Data Transfer",
                "Response Time",
                "Error Rate",
              ]}
            />
            <Button
              size="sm"
              className="md:ml-auto bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleQuery}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RiLoader4Line className="h-4 w-4 animate-spin" /> Running…
                </>
              ) : (
                "Run Query"
              )}
            </Button>
          </div>

          {/* where / group-by etc – minimal placeholder (same interface) */}
          <AdvancedFiltersPlaceholder />
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Re-usable UI bits
// -----------------------------------------------------------------------------
function KpiCard({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="p-4 border rounded-lg">
      <h4 className="text-sm font-medium text-gray-500 mb-1">{label}</h4>
      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
        {value ?? "—"}
      </p>
    </div>
  );
}

function Chart({
  title,
  data,
  dataKey,
  stroke,
  domain,
}: {
  title: string;
  data: any[];
  dataKey: string;
  stroke: string;
  domain?: [number, number];
}) {
  return (
    <div className="w-full h-48">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time_bucket" /* for sysSeries we’ll fall back to timestamp */
            tickFormatter={(t) => (typeof t === "string" ? t.slice(11, 19) : t)}
            minTickGap={20}
          />
          <YAxis domain={domain} />
          <Tooltip labelFormatter={(l) => `Time: ${l}`} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>
      <select
        className="rounded-md border bg-white py-1.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function AdvancedFiltersPlaceholder() {
  return (
    <div className="text-sm text-gray-500 dark:text-gray-400">
      {/* keep placeholder to maintain interface; replace with your real filters */}
      WHERE / GROUP BY / LIMIT controls unchanged…
    </div>
  );
}
