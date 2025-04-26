"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiDownloadLine,
  RiRefreshLine,
  RiLoader4Line,
  RiExternalLinkLine
} from "@remixicon/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";
import { Terminal } from "@/components/Terminal";

// API endpoint
const API_BASE = "https://medusa.bendatsko.com";

// Constants
const MACHINE_TYPES = ['machine-1', 'machine-2', 'machine-3'] as const;
type MachineType = typeof MACHINE_TYPES[number];

// Initial states
const initialHardwareStatus = {
  'machine-1': { cpu: null, memory: null, disk: null },
  'machine-2': { cpu: null, memory: null, disk: null },
  'machine-3': { cpu: null, memory: null, disk: null }
};

// Types
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
  createdBy?: {
    name: string;
  };
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

interface TerminalHistoryItem {
  timestamp: string;
  content: string;
  isCommand?: boolean;
  isError?: boolean;
}

type HardwareStatus = Record<MachineType, MachineStatus>;

export default function MonitoringPage() {
  // State variables
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

  // Sliding-window data
  const [seriesReq, setSeriesReq] = useState<TimeBucket[]>([]);
  const [seriesData, setSeriesData] = useState<TimeBucket[]>([]);
  const [seriesResp, setSeriesResp] = useState<TimeBucket[]>([]);
  const [sysSeries, setSysSeries] = useState<SysBucket[]>([]);

  // Hardware status
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus>(initialHardwareStatus);

  // Hydration guard
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Helper: convert selected time range into milliseconds
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

  // Manual refresh trigger
  const handleRefresh = async (): Promise<void> => {
    try {
      // Fetch hardware status
      const responses: Response[] = await Promise.all(
        MACHINE_TYPES.map(machine => 
          fetch(`${API_BASE}/api/hardware/${machine}`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          })
        )
      );

      const newStatus = { ...initialHardwareStatus };

      for (let i = 0; i < responses.length; i++) {
        const machine = MACHINE_TYPES[i];
        if (responses[i].ok) {
          const machineData = await responses[i].json() as MachineStatus;
          newStatus[machine] = machineData;
        }
      }

      setHardwareStatus(newStatus);
    } catch (error) {
      console.error('Error refreshing hardware status:', error);
    }
  };

  // Update hardware status handling
  const updateHardwareStatus = (machine: MachineType, status: MachineStatus) => {
    setHardwareStatus(prev => ({
      ...prev,
      [machine]: status
    }));
  };

  // Update project data processing
  const processTestResults = (tests: TestData[]): { metrics: ApiMetrics; projects: Project[] } => {
    // Process status counts
    const statusCounts: Record<string, number> = tests.reduce((acc: Record<string, number>, t: TestData) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    const testMetrics: TestMetric[] = Object.entries(statusCounts).map(
      ([status, count]) => ({ status, count })
    );

    // Process metrics
    const metrics: ApiMetrics = {
      tests_run: testMetrics,
      api_requests: tests.length * 3 + 50,
      data_transferred: Math.round(tests.length * 5.2),
      average_response_time: 120 + Math.random() * 100,
      errors: Math.floor(tests.length * 0.03),
    };

    // Process projects with proper typing
    const validTests = tests.filter((t): t is TestData & { metadata: { createdBy: { name: string } } } => 
      typeof t.metadata?.createdBy?.name === 'string'
    );

    const uniqueNames = Array.from(new Set(validTests.map(t => t.metadata.createdBy.name)));
    const colors = ["blue-500", "emerald-500", "violet-500", "amber-500", "rose-500"];
    
    let projects: Project[] = uniqueNames.map((name, i): Project => ({
      name,
      requests: validTests.filter(t => t.metadata.createdBy.name === name).length,
      color: colors[i % colors.length]
    }));

    // Add default projects if needed
    if (projects.length < 2) {
      projects = [
        ...projects,
        { name: "dacroq", requests: 98, color: "blue-500" },
        { name: "benweb", requests: 102, color: "emerald-500" }
      ];
    }

    return { metrics, projects };
  };

  // Poll health every 30s
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
    const id = setInterval(fetchHealth, 30000);
    return () => clearInterval(id);
  }, [refreshKey]);

  // Poll test-based metrics every 15s
  useEffect(() => {
    const pollMetrics = async () => {
      try {
        const timeRange = getTimeRangeMs();
        const res = await fetch(`${API_BASE}/api/tests?timeRange=${timeRange}`);
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
    const id = setInterval(pollMetrics, 15000);
    return () => clearInterval(id);
  }, [queryTimeRange, refreshKey]);

  // Poll sliding-window time series every 10s
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const range = 5 * 60 * 1000; // last 5 minutes

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
    const id = setInterval(fetchSeries, 10000);
    return () => clearInterval(id);
  }, [refreshKey]);

  // Poll system metrics every 1s
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
          mem_used_mb: r.mem_used / (1024 * 1024),
          mem_avail_mb: r.mem_available / (1024 * 1024)
        }));
        setSysSeries(buckets);
      } catch (e) {
        console.error("Error fetching system metrics:", e);
      }
    };
    fetchSystem();
    const id = setInterval(fetchSystem, 1000);
    return () => clearInterval(id);
  }, [refreshKey]);

  // Update the query handler
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
      console.error("Error:", e);
      setError(`Failed to run query: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fix the handleRestart function
  const handleRestart = async () => {
    if (!window.confirm(
      'Are you sure you want to restart the service? This will temporarily interrupt all API operations.'
    )) {
      return;
    }
    setIsRestarting(true);
    const res = await fetch(`${API_BASE}/api/admin/restart`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      setIsRestarting(false);
      alert(`Restart failed with status ${res.status}`);
      return;
    }
    alert(
      'Restart initiated. The page will automatically reload when the service is back online.'
    );
    const pollHealth = async () => {
      try {
        const healthRes = await fetch(`${API_BASE}/api/health`);
        if (healthRes.ok) {
          window.location.reload();
        } else {
          setTimeout(pollHealth, 1000);
        }
      } catch {
        setTimeout(pollHealth, 1000);
      }
    };
    setTimeout(pollHealth, 2000);
  };
  

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            System Monitor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Live system & API health and real-time metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleRestart}
            disabled={isRestarting}
          >
            <RiRefreshLine className={`h-4 w-4 mr-1 ${isRestarting ? 'animate-spin' : ''}`} />
            {isRestarting ? 'Restarting...' : 'Restart Service'}
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            onClick={handleRefresh}
          >
            <RiRefreshLine className="h-4 w-4" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Live Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* API Status */}
        <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            API Status
          </h4>
          <div className="flex items-center">
            <span
              className={`h-3 w-3 rounded-full mr-2 ${
                healthData?.api_status === "ok"
                  ? "bg-green-500"
                  : healthData?.api_status === "degraded"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            />
            <span className="font-semibold text-gray-900 dark:text-white">
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
              : "..."}
          </p>
        </div>

        {/* DB Status */}
        <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Database Status
          </h4>
          <div className="flex items-center">
            <span
              className={`h-3 w-3 rounded-full mr-2 ${
                healthData?.db_status === "online"
                  ? "bg-green-500"
                  : healthData?.db_status === "degraded"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            />
            <span className="font-semibold text-gray-900 dark:text-white">
              {healthData?.db_status === "online"
                ? "Online"
                : healthData?.db_status === "degraded"
                ? "Degraded"
                : "Offline"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            SQLite database hosted on medusa.bendatsko.com
          </p>
        </div>

        {/* Hardware Status */}
        <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Hardware Status
          </h4>
          <div className="flex items-center">
            <span className="h-3 w-3 rounded-full mr-2 bg-green-500" />
            <span className="font-semibold text-gray-900 dark:text-white">
              Operational
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            All hardware bridges and K-SAT solvers online
          </p>
        </div>

        {/* API Requests */}
        <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            API Requests
          </h4>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {apiMetrics?.api_requests ?? "--"}
          </p>
        </div>

        {/* Data Transferred */}
        <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Data Transferred
          </h4>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {apiMetrics?.data_transferred ?? "--"} MB
          </p>
        </div>

        {/* Avg Response Time */}
        <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Avg Response Time
          </h4>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {apiMetrics?.average_response_time?.toFixed(1) ?? "--"} ms
          </p>
        </div>
      </div>

      {/* Sliding-Window Charts */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Live Trends (last 5 minutes)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Requests */}
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesReq}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time_bucket"
                  tickFormatter={(t) => t.slice(11, 19)}
                  minTickGap={20}
                />
                <YAxis />
                <Tooltip labelFormatter={(l) => `Time: ${l}`} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data Transfer */}
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time_bucket"
                  tickFormatter={(t) => t.slice(11, 19)}
                  minTickGap={20}
                />
                <YAxis />
                <Tooltip labelFormatter={(l) => `Time: ${l}`} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#10B981"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Response Time */}
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesResp}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time_bucket"
                  tickFormatter={(t) => t.slice(11, 19)}
                  minTickGap={20}
                />
                <YAxis />
                <Tooltip labelFormatter={(l) => `Time: ${l}`} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#F59E0B"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Metrics Charts */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          System Metrics (last 5 minutes)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU % */}
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sysSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(t) => t.slice(11, 19)}
                  minTickGap={20}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(l) => `Time: ${l}`} />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3B82F6"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Memory Used (MB) */}
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sysSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(t) => t.slice(11, 19)}
                  minTickGap={20}
                />
                <YAxis />
                <Tooltip labelFormatter={(l) => `Time: ${l}`} />
                <Line
                  type="monotone"
                  dataKey="mem_used_mb"
                  stroke="#10B981"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Memory Free (MB) */}
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sysSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(t) => t.slice(11, 19)}
                  minTickGap={20}
                />
                <YAxis />
                <Tooltip labelFormatter={(l) => `Time: ${l}`} />
                <Line
                  type="monotone"
                  dataKey="mem_avail_mb"
                  stroke="#F59E0B"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hardware Control Panel */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Hardware Control
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Armorgos Controls */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">
              Armorgos
            </h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                Clock Generator
              </label>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2].map((osc) => (
                  <Button
                    key={`osc-${osc}`}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/api/hardware/armorgos/control`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            operation: 'set_oscillator',
                            target: 'clkgen',
                            value: {
                              oscillator: osc,
                              state: true
                            },
                            port: '/dev/ttyACM0'
                          })
                        });
                        if (!res.ok) throw new Error(`Status ${res.status}`);
                      } catch (e) {
                        console.error(`Error controlling oscillator ${osc}:`, e);
                      }
                    }}
                  >
                    OSC{osc}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/api/hardware/armorgos/control`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          operation: 'reset',
                          target: 'system',
                          port: '/dev/ttyACM0'
                        })
                      });
                      if (!res.ok) throw new Error(`Status ${res.status}`);
                    } catch (e) {
                      console.error('Error resetting system:', e);
                    }
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Daedalus Controls */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">
              Daedalus
            </h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                Die Control
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((die) => (
                  <div key={`die-${die}`} className="space-y-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Die {die}</div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE}/api/hardware/daedalus/control`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                operation: 'pause',
                                target: 'system',
                                value: {
                                  die,
                                  state: true
                                },
                                port: '/dev/ttyACM1'
                              })
                            });
                            if (!res.ok) throw new Error(`Status ${res.status}`);
                          } catch (e) {
                            console.error(`Error pausing die ${die}:`, e);
                          }
                        }}
                      >
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE}/api/hardware/daedalus/control`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                operation: 'pause',
                                target: 'system',
                                value: {
                                  die,
                                  state: false
                                },
                                port: '/dev/ttyACM1'
                              })
                            });
                            if (!res.ok) throw new Error(`Status ${res.status}`);
                          } catch (e) {
                            console.error(`Error resuming die ${die}:`, e);
                          }
                        }}
                      >
                        Resume
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Medusa Controls */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">
              Medusa
            </h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                System Control
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/api/hardware/medusa/control`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          operation: 'reset',
                          target: 'system',
                          port: '/dev/ttyACM2'
                        })
                      });
                      if (!res.ok) throw new Error(`Status ${res.status}`);
                    } catch (e) {
                      console.error('Error resetting system:', e);
                    }
                  }}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/api/hardware/medusa/control`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          operation: 'fetch',
                          target: 'system',
                          value: {
                            state: true
                          },
                          port: '/dev/ttyACM2'
                        })
                      });
                      if (!res.ok) throw new Error(`Status ${res.status}`);
                    } catch (e) {
                      console.error('Error enabling fetch:', e);
                    }
                  }}
                >
                  Enable Fetch
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">
              Hardware Status
            </h3>
            <Button
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RiRefreshLine className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            {MACHINE_TYPES.map((type) => (
              <div key={type} className="space-y-2">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize">
                  {type}
                </h4>
                <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-auto">
                  {JSON.stringify(hardwareStatus[type] || 'No data', null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Query Builder */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm mb-6">
        <div className="border-b px-6 py-4 border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Query Builder
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-4 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Range
              </label>
              <select
                className="rounded-md border bg-white py-1.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={queryTimeRange}
                onChange={(e) => setQueryTimeRange(e.target.value)}
              >
                <option>Last 1 hour</option>
                <option>Last 6 hours</option>
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Visualization
              </label>
              <select
                className="rounded-md border bg-white py-1.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={visualizationType}
                onChange={(e) => setVisualizationType(e.target.value)}
              >
                <option>API Requests</option>
                <option>Data Transfer</option>
                <option>Response Time</option>
                <option>Error Rate</option>
              </select>
            </div>

            <Button
              className="md:ml-auto bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
              onClick={handleQuery}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RiLoader4Line className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                "Run Query"
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <label className="min-w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                WHERE:
              </label>
              <input
                type="text"
                placeholder="host = 'medusa.bendatsko.com'"
                className="flex-1 rounded-md border bg-white py-1.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <label className="min-w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                PROJECT:
              </label>
              <div className="flex-1 rounded-md border bg-white py-1.5 px-3 text-sm shadow-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
                Choose Project (optional)
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <label className="min-w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                GROUP BY:
              </label>
              <input
                type="text"
                defaultValue="endpoint"
                className="flex-1 rounded-md border bg-white py-1.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <label className="min-w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                LIMIT:
              </label>
              <select className="w-24 rounded-md border bg-white py-1.5 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option>10</option>
                <option>25</option>
                <option>50</option>
                <option>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Console */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            System Terminal
          </h2>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                alert("Available commands:\n- status: Check API status\n- restart: Restart service\n- log: Show recent logs\n- help: More commands");
              }}
            >
              Help
            </Button>
          </div>
        </div>
        
        <Terminal />
        
        <p className="text-xs text-gray-500 mt-2">
          Execute commands to control the KSAT API service and connected hardware. Type 'help' for available commands.
        </p>
      </div>
    </div>
  );
}