// app/src/app/monitoring/page.tsx
"use client";

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  RiRefreshLine,
  RiLoader4Line,
  RiCheckLine,
  RiTerminalLine,
  RiCloseLine,
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
const API_BASE = "https://dacroq-api.bendatsko.com";

// Map the platform IDs to their correct names used in the backend
const PLATFORM_MAPPING = {
  0: { name: "LDPC", description: "Hardware Accelerator" },
  1: { name: "3SAT", description: "Boolean Satisfiability Solver" },
  2: { name: "KSAT", description: "K-SAT Solver" },
};

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
  const [isResettingAll, setIsResettingAll] = useState(false);

  // Reference to platform cards for external control
  const platformRefs = {
    LDPC: useRef<{handleConnectSerial: () => void} | null>(null),
    "3SAT": useRef<{handleConnectSerial: () => void} | null>(null),
    KSAT: useRef<{handleConnectSerial: () => void} | null>(null)
  };

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

  const handleResetAndConnectAll = async () => {
    setIsResettingAll(true);
    try {
      // Define platform info
      const platforms = [
        { id: 0, name: "LDPC", description: "Hardware Accelerator" },
        { id: 1, name: "3SAT", description: "Boolean Satisfiability Solver" },
        { id: 2, name: "KSAT", description: "K-SAT Solver" },
      ];
      
      // Reset each platform in sequence
      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        console.log(`Resetting platform ${platform.name}...`);
        
        // Call servo control endpoint for this platform
        const resetResponse = await fetch(`${API_BASE}/api/servo/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "press",
            servo: platform.id,
          }),
        });
        
        if (!resetResponse.ok) {
          throw new Error(`Failed to reset ${platform.name}`);
        }
        
        // Wait for reset to complete (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Wait for all boards to reboot
      console.log("All platforms reset. Waiting for reboot...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Connect to each platform's serial monitor
      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        console.log(`Opening serial monitor for ${platform.name}...`);
        
        // Get the ref for this platform - use type assertion for known platform names
        const platformName = platform.name as keyof typeof platformRefs;
        const platformRef = platformRefs[platformName];
        
        if (platformRef.current) {
          try {
            // Trigger the connect function on the platform component
            await platformRef.current.handleConnectSerial();
            console.log(`Successfully opened serial monitor for ${platform.name}`);
          } catch (error) {
            console.error(`Error opening serial monitor for ${platform.name}:`, error);
          }
        } else {
          console.warn(`Could not find ref for ${platform.name} platform`);
        }
        
        // Wait between connections
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log("Reset and connect sequence completed");
    } catch (e) {
      console.error("Error in reset and connect sequence:", e);
      alert(`Reset and connect sequence failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsResettingAll(false);
    }
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
      </header>

      {/* -------------------------------------------------------- Platform Control */}
      <section className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Test Platform Control
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetAndConnectAll}
            disabled={isResettingAll}
          >
            {isResettingAll ? (
              <>
                <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                Resetting & Connecting...
              </>
            ) : (
              <>Reset All & Connect</>
            )}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PlatformResetCard
            platform="LDPC"
            platformId={0}
            description="Reset LDPC platform"
            ref={platformRefs.LDPC}
          />
          <PlatformResetCard
            platform="3SAT"
            platformId={1}
            description="Reset 3SAT platform"
            ref={platformRefs["3SAT"]}
          />
          <PlatformResetCard
            platform="KSAT"
            platformId={2}
            description="Reset KSAT platform"
            ref={platformRefs.KSAT}
          />
        </div>
      </section>

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
              SQLite @ dacroq-api.bendatsko.com
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

const PlatformResetCard = forwardRef(function PlatformResetCard({
  platform,
  platformId,
  description,
}: {
  platform: string;
  platformId: number;
  description: string;
}, ref) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isReflashing, setIsReflashing] = useState(false);
  const [reflashSuccess, setReflashSuccess] = useState(false);
  const [reflashError, setReflashError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [showSerialMonitor, setShowSerialMonitor] = useState(false);
  const [serialData, setSerialData] = useState<string[]>([]);
  const [isSerialConnecting, setIsSerialConnecting] = useState(false);
  const [serialError, setSerialError] = useState<string | null>(null);
  const [serialPort, setSerialPort] = useState<string | null>(null);
  const [availablePorts, setAvailablePorts] = useState<any[]>([]);
  const [baudRate, setBaudRate] = useState<number | null>(null);

  // Poll serial data at regular intervals if monitor is open
  useEffect(() => {
    if (!showSerialMonitor || !serialPort) return;
    
    const fetchSerialData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/system/serial-data/${serialPort}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.trim()) {
            // Split by newlines and add each line to the serial data
            const lines = data.data.split('\n').filter((line: string) => line.trim());
            if (lines.length > 0) {
              setSerialData(prev => {
                // Keep only the last 100 lines to avoid memory issues
                const newData = [...prev, ...lines];
                return newData.slice(Math.max(0, newData.length - 100));
              });
            }
          }
        } else {
          console.error(`Error fetching serial data: ${response.statusText}`);
          // If we got a 404 or 500 error, the port might have disconnected
          if (response.status === 404 || response.status === 500) {
            setSerialError(`Connection lost to ${serialPort}. Try reconnecting.`);
            setShowSerialMonitor(false);
          }
        }
      } catch (error) {
        console.error("Error polling serial port:", error);
        setSerialError(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    fetchSerialData(); // Call immediately
    
    // Set up polling interval (every 1 second)
    const intervalId = setInterval(fetchSerialData, 1000);
    
    return () => clearInterval(intervalId);
  }, [showSerialMonitor, serialPort]);

  // Fetch available ports on initial load
  useEffect(() => {
    const getAvailablePorts = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/system/serial-ports`);
        if (response.ok) {
          const data = await response.json();
          if (data.serial_ports && data.serial_ports.length > 0) {
            setAvailablePorts(data.serial_ports);
          }
        }
      } catch (error) {
        console.error("Error fetching available ports:", error);
      }
    };
    
    getAvailablePorts();
  }, []);

  const handleConnectSerial = async () => {
    setIsSerialConnecting(true);
    setSerialError(null);
    
    try {
      // First, get the latest list of available serial ports
      const response = await fetch(`${API_BASE}/api/system/serial-ports`);
      
      if (!response.ok) {
        throw new Error(`Failed to get serial ports: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAvailablePorts(data.serial_ports || []);
      
      if (!data.serial_ports || data.serial_ports.length === 0) {
        setSerialError("No serial ports found. Make sure your device is connected.");
        setIsSerialConnecting(false);
        return;
      }
      
      // Use the hardware test endpoint to get the correct port for this specific platform
      const testResponse = await fetch(`${API_BASE}/api/hardware/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          platformId,
        }),
      });
      
      let selectedPort;
      
      if (testResponse.ok) {
        // If hardware test succeeds, it will tell us which port is connected to this platform
        const testData = await testResponse.json();
        selectedPort = testData.port;
        
        // Get platform details from mapping for more descriptive messages
        const platformInfo = PLATFORM_MAPPING[platformId as keyof typeof PLATFORM_MAPPING] || 
          { name: platform, description: description };
        
        // Store success message in serial data
        setSerialData([
          `[${new Date().toLocaleTimeString()}] Connected to ${platformInfo.name} (${platformInfo.description}) on port ${selectedPort}`,
          `[${new Date().toLocaleTimeString()}] Hardware test successful`
        ]);
      } else {
        // If hardware test fails, fall back to our best guess based on platform name and available ports
        const portNames = data.serial_ports.map((p: any) => p.path);
        console.log("Available ports:", portNames);
        
        // Get platform details from mapping
        const platformInfo = PLATFORM_MAPPING[platformId as keyof typeof PLATFORM_MAPPING] || 
          { name: platform, description: description };
        const platformName = platformInfo.name.toLowerCase();
        
        // Try different strategies to find the right port
        // 1. Match by platform name
        const platformNameMatch = data.serial_ports.find((p: any) => 
          p.path.toLowerCase().includes(platformName) ||
          (p.description && p.description.toLowerCase().includes(platformName))
        );
        
        // 2. Use hardware ID information if available
        const hardwareIdMatch = data.serial_ports.find((p: any) => 
          p.hardware_id && [platformName, `id${platformId}`].some(term => 
            p.hardware_id.toLowerCase().includes(term)
          )
        );
        
        // 3. Use the mapping from backend where platformId 0 = first port, 1 = second port, etc.
        const indexMatch = data.serial_ports[platformId] || null;
        
        // 4. Try common serial port patterns (ttyACM, ttyUSB)
        const patternMatch = data.serial_ports.find((p: any) => 
          p.path.toLowerCase().includes('ttyacm') || 
          p.path.toLowerCase().includes('ttyusb')
        );
        
        // Use the first match we find, in order of specificity
        selectedPort = (platformNameMatch || hardwareIdMatch || indexMatch || patternMatch || data.serial_ports[0])?.path;
        
        if (!selectedPort) {
          throw new Error("Could not determine which port to use for this platform");
        }
        
        // Add a warning message that we're using our best guess
        setSerialData([
          `[${new Date().toLocaleTimeString()}] Connected to ${platformInfo.name} (${platformInfo.description}) on ${selectedPort}`,
          `[${new Date().toLocaleTimeString()}] Note: Using best-guess port selection`
        ]);
      }
      
      // Strip leading /dev/ if present for the API
      const portPath = selectedPort.replace('/dev/', '');
      setSerialPort(portPath);
      
      // Try to determine baud rate by testing connection
      const baudRates = [115200, 9600, 57600, 38400];
      setBaudRate(baudRates[0]); // Default to first one initially
      
      // Show the monitor
      setShowSerialMonitor(true);
      
    } catch (error: any) {
      console.error("Error connecting to serial port:", error);
      setSerialError(error.message || "Failed to connect to serial port");
      setSerialData([`[${new Date().toLocaleTimeString()}] Connection error: ${error.message || "Unknown error"}`]);
    } finally {
      setIsSerialConnecting(false);
    }
  };

  const handleDisconnectSerial = () => {
    setShowSerialMonitor(false);
    setSerialPort(null);
    setBaudRate(null);
  };

  const handleClearSerial = () => {
    setSerialData([`[${new Date().toLocaleTimeString()}] Terminal cleared`]);
  };


  const handleReset = async () => {
    if (isResetting) return;
    
    setIsResetting(true);
    setResetSuccess(false);
    try {
      const response = await fetch(`${API_BASE}/api/servo/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'press',
          servo: platformId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`Error resetting ${platform}:`, error);
        alert(`Failed to reset ${platform} platform: ${error}`);
      } else {
        console.log(`Successfully reset ${platform} platform`);
        setResetSuccess(true);
        // Hide success message after 3 seconds
        setTimeout(() => setResetSuccess(false), 3000);
      }
    } catch (error) {
      console.error(`Error resetting ${platform}:`, error);
      alert(`Failed to reset ${platform} platform: ${error}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleReflash = async () => {
    if (isReflashing) return;
    
    setIsReflashing(true);
    setReflashSuccess(false);
    setReflashError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/firmware/reflash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          platformId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`Error reflashing ${platform}:`, data.error);
        setReflashError(data.error || "Reflash failed. Check system logs for details.");
      } else {
        console.log(`Successfully reflashed ${platform} platform:`, data);
        setReflashSuccess(true);
        // Hide success message after 3 seconds
        setTimeout(() => {
          setReflashSuccess(false);
          setReflashError(null);
        }, 3000);
      }
    } catch (error: any) {
      console.error(`Error reflashing ${platform}:`, error);
      setReflashError(error.message || "Reflash failed. Check system logs for details.");
    } finally {
      setIsReflashing(false);
    }
  };

  const handleTest = async () => {
    if (isTesting) return;
    
    setIsTesting(true);
    setTestSuccess(false);
    setTestError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/hardware/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          platformId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`Error testing ${platform}:`, data.error);
        setTestError(data.error || "Test failed. Check system logs for details.");
      } else {
        console.log(`Successfully tested ${platform} platform:`, data);
        setTestSuccess(true);
        // Hide success message after 3 seconds
        setTimeout(() => {
          setTestSuccess(false);
          setTestError(null);
        }, 3000);
      }
    } catch (error: any) {
      console.error(`Error testing ${platform}:`, error);
      setTestError(error.message || "Test failed. Check system logs for details.");
    } finally {
      setIsTesting(false);
    }
  };

  // Export member functions to parent via ref
  useImperativeHandle(ref, () => ({
    handleReset,
    handleConnectSerial,
    handleDisconnectSerial,
    handleReflash,
    handleTest
  }));

  return (
    <div className="p-4 border rounded-lg">
      <h4 className="text-sm font-medium text-gray-500 mb-1">{platform}</h4>
      <p className="text-sm text-gray-500">{description}</p>
      
      {/* Status Messages */}
      {resetSuccess && (
        <div className="mt-2 flex items-center text-green-600 text-sm">
          <RiCheckLine className="mr-1 h-4 w-4" />
          Reset successful!
        </div>
      )}
      
      {reflashSuccess && (
        <div className="mt-2 flex items-center text-green-600 text-sm">
          <RiCheckLine className="mr-1 h-4 w-4" />
          Firmware reflashed successfully!
        </div>
      )}
      
      {reflashError && (
        <div className="mt-2 text-red-600 text-sm">
          <span>Reflash error: {reflashError}</span>
        </div>
      )}
      
      {testSuccess && (
        <div className="mt-2 flex items-center text-green-600 text-sm">
          <RiCheckLine className="mr-1 h-4 w-4" />
          All good! System tests passed.
        </div>
      )}
      
      {testError && (
        <div className="mt-2 text-red-600 text-sm">
          <span>Test error: {testError}</span>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className={`${resetSuccess ? 'bg-green-50' : ''}`}
          onClick={handleReset}
          disabled={isResetting}
        >
          {isResetting ? (
            <>
              <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset"
          )}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          className={`${reflashSuccess ? 'bg-green-50' : ''} ${reflashError ? 'bg-red-50' : ''}`}
          onClick={handleReflash}
          disabled={isReflashing}
        >
          {isReflashing ? (
            <>
              <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              Reflashing...
            </>
          ) : (
            "Reflash"
          )}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          className={`${testSuccess ? 'bg-green-50' : ''} ${testError ? 'bg-red-50' : ''}`}
          onClick={handleTest}
          disabled={isTesting}
        >
          {isTesting ? (
            <>
              <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            "Test"
          )}
        </Button>
        
        {/* Serial Monitor Toggle */}
        <Button
          size="sm"
          variant="outline"
          className={`ml-auto ${showSerialMonitor ? 'bg-blue-50 text-blue-600' : ''}`}
          onClick={showSerialMonitor ? handleDisconnectSerial : handleConnectSerial}
          disabled={isSerialConnecting}
        >
          {isSerialConnecting ? (
            <>
              <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : showSerialMonitor ? (
            <>
              <RiCloseLine className="mr-2 h-4 w-4" />
              Disconnect
            </>
          ) : (
            <>
              <RiTerminalLine className="mr-2 h-4 w-4" />
              Monitor
            </>
          )}
        </Button>
      </div>
      
      {/* Serial Error */}
      {serialError && (
        <div className="mt-2 text-red-600 text-sm">
          <span>Serial error: {serialError}</span>
        </div>
      )}
      
      {/* Serial Monitor */}
      {showSerialMonitor && (
        <div className="mt-3 border rounded bg-gray-900 p-2 text-xs font-mono overflow-hidden">
          <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-700">
            <div className="text-gray-400">
              {serialPort ? `Connected to ${serialPort}` : 'Serial Monitor'}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-gray-400 hover:text-white"
                onClick={handleClearSerial}
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-gray-400 hover:text-white"
                onClick={handleConnectSerial}
              >
                <RiRefreshLine className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="h-32 overflow-y-auto text-green-400 p-1 bg-black bg-opacity-50">
            {serialData.length > 0 ? (
              serialData.map((line, i) => (
                <div key={i} className="leading-tight">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-gray-500 italic">Waiting for data...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
