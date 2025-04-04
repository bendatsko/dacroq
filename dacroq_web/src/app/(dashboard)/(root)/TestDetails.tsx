'use client';

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryBar } from "@/components/CategoryBar";
import { Divider } from "@/components/Divider";
import { LineChart } from "@/components/LineChart";
import JsonExplorer from "@/components/JsonExplorer";
import {
  RiArrowLeftLine,
  RiFileTextLine,
  RiHardDriveLine,
  RiTimeLine,
  RiSearchLine,
  RiFilterLine,
  RiAddLine,
  RiPencilLine,
  RiDeleteBinLine,
  RiArrowDownLine,
} from "@remixicon/react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import FileSaver from "file-saver";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/Select";

interface TestDetailsProps {
  test: TestRun;
  onBack: () => void;
}

// Utility: format dates
const formatDate = (date: string | Date | undefined) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatRuntime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// PDF Report styles and component
const pdfStyles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
  },
  section: {
    margin: 10,
    padding: 10,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
  },
  subheader: {
    fontSize: 18,
    marginBottom: 10,
    marginTop: 15,
    color: "#666",
  },
  text: {
    fontSize: 12,
    marginBottom: 5,
  },
});

const PDFReport = ({ test }: { test: TestRun }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.header}>{test.name} - Test Report</Text>
        <Text style={pdfStyles.subheader}>Test Information</Text>
        <Text style={pdfStyles.text}>Status: {test.status}</Text>
        <Text style={pdfStyles.text}>Hardware Type: {test.chipType}</Text>
        <Text style={pdfStyles.text}>Created: {formatDate(test.created)}</Text>
        <Text style={pdfStyles.text}>Completed: {formatDate(test.completed)}</Text>
        {test.results && test.results.performanceMetrics && (
          <>
            <Text style={pdfStyles.subheader}>Performance Metrics</Text>
            <Text style={pdfStyles.text}>
              Success Rate: {test.results.performanceMetrics.successRate}%
            </Text>
            <Text style={pdfStyles.text}>
              Average Runtime: {test.results.performanceMetrics.averageRuntime}ms
            </Text>
            <Text style={pdfStyles.text}>
              Min Runtime: {test.results.performanceMetrics.minRuntime}ms
            </Text>
            <Text style={pdfStyles.text}>
              Max Runtime: {test.results.performanceMetrics.maxRuntime}ms
            </Text>
            <Text style={pdfStyles.text}>
              Median Runtime: {test.results.performanceMetrics.medianRuntime}ms
            </Text>
          </>
        )}
      </View>
    </Page>
  </Document>
);

// Utility to determine chart domain from an array of numbers
const getChartDomain = (data: any[], key: string) => {
  if (!data || data.length === 0) return [0, 100];
  const values = data.map((item) => item[key]).filter((val) => val != null);
  if (values.length === 0) return [0, 100];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [Math.max(0, min - 10), max + 10];
  const padding = (max - min) * 0.1;
  return [Math.max(0, min - padding), max + padding];
};

// New types for plot configuration
interface PlotConfig {
  id: string;
  type: 'line' | 'scatter' | 'bar' | 'box';
  xAxis: string;
  yAxis: string;
  operation: 'none' | 'derivative' | 'movingAverage' | 'standardDeviation';
  windowSize?: number;
  title?: string;
}

// Add data processing functions
const processDataForPlot = (results: any, config: PlotConfig) => {
  if (!Array.isArray(results)) {
    console.error('Results is not an array');
    return [];
  }

  // Map the results array to extract x and y values
  const data = results.map((result: any) => {
    const x = getValueFromPath(result, config.xAxis);
    const y = getValueFromPath(result, config.yAxis);
    if (x === null || y === null) return null;
    return { x, y };
  }).filter((point): point is { x: number; y: number } => point !== null);

  // Apply operations if needed
  switch (config.operation) {
    case 'derivative':
      return data.map((point, i, arr) => {
        if (i === 0) return point;
        const dx = point.x - arr[i-1].x;
        const dy = point.y - arr[i-1].y;
        return { x: point.x, y: dy/dx };
      });
      
    case 'movingAverage':
      const windowSize = config.windowSize || 5;
      return data.map((point, i, arr) => {
        const start = Math.max(0, i - windowSize + 1);
        const window = arr.slice(start, i + 1);
        const avg = window.reduce((sum, p) => sum + p.y, 0) / window.length;
        return { x: point.x, y: avg };
      });
      
    case 'standardDeviation':
      const windowSize2 = config.windowSize || 5;
      return data.map((point, i, arr) => {
        const start = Math.max(0, i - windowSize2 + 1);
        const window = arr.slice(start, i + 1);
        const mean = window.reduce((sum, p) => sum + p.y, 0) / window.length;
        const variance = window.reduce((sum, p) => sum + Math.pow(p.y - mean, 2), 0) / window.length;
        return { x: point.x, y: Math.sqrt(variance) };
      });
      
    default:
      return data;
  }
};

const getValueFromPath = (obj: any, path: string): number | null => {
  try {
    return path.split('.').reduce((o, i) => o[i], obj);
  } catch (error) {
    console.error('Error getting value from path:', error);
    return null;
  }
};

// New component for plot configuration
const PlotConfigurator = ({ 
  config, 
  availableVariables, 
  onConfigChange, 
  onDelete 
}: { 
  config: PlotConfig;
  availableVariables: string[];
  onConfigChange: (config: PlotConfig) => void;
  onDelete: () => void;
}) => {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium">Plot Configuration</h4>
        <Button
          variant="ghost"
          onClick={onDelete}
          className="text-red-500 hover:text-red-700"
        >
          <RiDeleteBinLine className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plot Type</label>
          <Select
            value={config.type}
            onValueChange={(value) => onConfigChange({ ...config, type: value as PlotConfig['type'] })}
          >
            <SelectTrigger>
              {config.type.charAt(0).toUpperCase() + config.type.slice(1)}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="scatter">Scatter</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="box">Box</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Operation</label>
          <Select
            value={config.operation}
            onValueChange={(value) => onConfigChange({ ...config, operation: value as PlotConfig['operation'] })}
          >
            <SelectTrigger>
              {config.operation === 'none' ? 'None' : config.operation}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="derivative">Derivative</SelectItem>
              <SelectItem value="movingAverage">Moving Average</SelectItem>
              <SelectItem value="standardDeviation">Standard Deviation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">X Axis</label>
          <Select
            value={config.xAxis}
            onValueChange={(value) => onConfigChange({ ...config, xAxis: value })}
          >
            <SelectTrigger>{config.xAxis}</SelectTrigger>
            <SelectContent>
              {availableVariables.map((variable) => (
                <SelectItem key={variable} value={variable}>
                  {variable}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Y Axis</label>
          <Select
            value={config.yAxis}
            onValueChange={(value) => onConfigChange({ ...config, yAxis: value })}
          >
            <SelectTrigger>{config.yAxis}</SelectTrigger>
            <SelectContent>
              {availableVariables.map((variable) => (
                <SelectItem key={variable} value={variable}>
                  {variable}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {config.operation === 'movingAverage' && (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Window Size</label>
            <input
              type="number"
              min="2"
              value={config.windowSize || 5}
              onChange={(e) => onConfigChange({ ...config, windowSize: parseInt(e.target.value) })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
    </Card>
  );
};

// Update test results type
interface TestResults {
  solverMetrics: any;
  hardwareMetrics: any;
  performanceMetrics: any;
  resourceUsage: any;
  hardwareTimeSeconds: number[];
  [key: string]: any;
}

interface TestRun {
  id: string;
  name: string;
  chipType: string;
  status: string;
  created: any;
  completed?: any;
  results?: TestResults;
  createdBy?: {
    uid: string;
    name: string;
    email: string;
    role: string;
    avatar: string;
    photoURL?: string;
    displayName?: string;
  };
}

export default function TestDetails({ test, onBack }: TestDetailsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [plotConfigs, setPlotConfigs] = useState<PlotConfig[]>([]);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [isVisualizationExpanded, setIsVisualizationExpanded] = useState(true);
  const [isResultsExpanded, setIsResultsExpanded] = useState(true);

  // Build runtime chart data from test.results (if available)
  const runtimeChartData =
    test.results?.hardwareTimeSeconds?.map((time: number, index: number) => ({
      run: index + 1,
      time: time,
    })) || [];

  // Get performance and resource metrics from the JSON results
  const performanceMetrics = test.results?.performanceMetrics;
  const resourceUsage = test.results?.resourceUsage;
  const inputFilesCount = test.results?.inputFiles?.length || 0;

  // Export handlers
  const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const cell = row[header]?.toString() ?? "";
            return cell.includes(",") ? `"${cell}"` : cell;
          })
          .join(",")
      ),
    ];
    return csvRows.join("\n");
  };

  const handleExport = async (format: "json" | "csv" | "pdf") => {
    const exportData = {
      testInfo: {
        id: test.id,
        name: test.name,
        created: formatDate(test.created),
        completed: formatDate(test.completed),
        status: test.status,
        hardwareType: test.chipType,
      },
      results: test.results,
    };

    try {
      switch (format) {
        case "json":
          const jsonBlob = new Blob(
            [JSON.stringify(exportData, null, 2)],
            { type: "application/json" }
          );
          FileSaver.saveAs(jsonBlob, `${test.name}_results.json`);
          break;
        case "csv":
          const csvData = [exportData.testInfo, exportData.results];
          const csvBlob = new Blob([convertToCSV(csvData)], {
            type: "text/csv",
          });
          FileSaver.saveAs(csvBlob, `${test.name}_results.csv`);
          break;
        case "pdf":
          // PDF generation is handled via PDFDownloadLink below
          break;
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data");
    }
  };

  // Filter JSON data for explorer
  const filterJsonData = (data: any, query: string): any => {
    if (!query) return data;
    const lowerQuery = query.toLowerCase();
    const filterObject = (obj: any): any | null => {
      if (typeof obj !== "object" || obj === null) {
        return String(obj).toLowerCase().includes(lowerQuery) ? obj : null;
      }
      if (Array.isArray(obj)) {
        const filtered = obj.map((item) => filterObject(item)).filter(Boolean);
        return filtered.length > 0 ? filtered : null;
      }
      const filtered = Object.entries(obj).reduce((acc, [key, value]) => {
        if (key.toLowerCase().includes(lowerQuery)) {
          acc[key] = value;
          return acc;
        }
        const filteredValue = filterObject(value);
        if (filteredValue !== null) {
          acc[key] = filteredValue;
        }
        return acc;
      }, {} as any);
      return Object.keys(filtered).length > 0 ? filtered : null;
    };
    return filterObject(data) || data;
  };

  // Add to useEffect in TestDetails to extract available variables
  useEffect(() => {
    if (test.results?.results) {
      const variables = extractVariables(test.results.results[0]);
      setAvailableVariables(variables);
      
      // Set up more interesting default plots for SAT solver analysis
      const defaultPlots: PlotConfig[] = [
        {
          id: '1',
          type: 'scatter',
          xAxis: 'performance_metrics.average_runtime',
          yAxis: 'metadata.ets_nj',
          operation: 'none',
          title: 'Energy vs Time Correlation'
        },
        {
          id: '2',
          type: 'line',
          xAxis: 'instance_idx',
          yAxis: 'performance_metrics.success_rate',
          operation: 'none',
          title: 'Success Rate vs Problem Size'
        },
        {
          id: '3',
          type: 'line',
          xAxis: 'instance_idx',
          yAxis: 'performance_metrics.runtime_std_dev',
          operation: 'none',
          title: 'Runtime Variability vs Problem Size'
        }
      ];
      
      setPlotConfigs(defaultPlots);
    }
  }, [test.results]);

  // Add utility function to extract variables from results
  const extractVariables = (data: any, prefix = ''): string[] => {
    const variables: string[] = [];
    
    const traverse = (obj: any, path: string) => {
      if (!obj) return;
      
      if (Array.isArray(obj)) {
        if (obj.every(item => typeof item === 'number')) {
          variables.push(path);
        } else {
          obj.forEach((item, index) => traverse(item, `${path}[${index}]`));
        }
      } else if (typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          traverse(value, path ? `${path}.${key}` : key);
        });
      } else if (typeof obj === 'number') {
        variables.push(path);
      }
    };
    
    traverse(data, prefix);
    return variables;
  };

  // Update the formatWithUnits function to handle small numbers better
  const formatWithUnits = (value: number, metric: string): string => {
    // Helper to round to significant digits
    const roundToSigFigs = (num: number, sigFigs: number = 3) => {
      if (num === 0) return '0';
      const magnitude = Math.floor(Math.log10(Math.abs(num)));
      
      // For very small numbers, use scientific notation
      if (magnitude < -5) {
        return num.toExponential(sigFigs - 1);
      }
      
      const factor = Math.pow(10, sigFigs - magnitude - 1);
      return (Math.round(num * factor) / factor).toString();
    };

    // Convert to appropriate units and format
    switch (metric) {
      case 'metadata.ets_nj':
      case 'ets_nj':
        const microjoules = value * 1e6; // Convert to µJ
        return `${roundToSigFigs(microjoules)} µJ`;
      case 'performance_metrics.average_runtime':
      case 'performance_metrics.min_runtime':
      case 'performance_metrics.max_runtime':
      case 'performance_metrics.median_runtime':
      case 'hardwareTimeSeconds':
        const microseconds = value * 1e6; // Convert to µs
        return `${roundToSigFigs(microseconds)} µs`;
      default:
        return roundToSigFigs(value);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <RiArrowLeftLine className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{test.name}</h1>
            <p className="text-sm text-gray-500">
              Created {formatDate(test.created)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Test Overview */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Test Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-50 p-3 dark:bg-blue-900/20">
                <RiTimeLine className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {test.results?.performanceMetrics?.medianRuntime ? (
                    `${(test.results.performanceMetrics.medianRuntime).toFixed(2)} ms`
                  ) : test.status === "failed" ? (
                    "Failed"
                  ) : test.status === "queued" ? (
                    "Queued"
                  ) : (
                    "0.00 ms"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-50 p-3 dark:bg-green-900/20">
                <RiHardDriveLine className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Hardware</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{test.chipType || "3-SAT"}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-50 p-3 dark:bg-purple-900/20">
                <RiFileTextLine className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Input Files</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {test.results?.summary?.total_files || test.results?.results?.length || "0"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Performance Metrics */}
        {performanceMetrics && (
          <Card className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Success Rate</p>
                <p className="text-sm font-medium">{performanceMetrics.successRate}%</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Average Runtime</p>
                <p className="text-sm font-medium">{performanceMetrics.averageRuntime}ms</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Min Runtime</p>
                <p className="text-sm font-medium">{performanceMetrics.minRuntime}ms</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Max Runtime</p>
                <p className="text-sm font-medium">{performanceMetrics.maxRuntime}ms</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Median Runtime</p>
                <p className="text-sm font-medium">{performanceMetrics.medianRuntime}ms</p>
              </div>
            </div>
          </Card>
        )}

        {/* Runtime Analysis */}
        {runtimeChartData.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Runtime Analysis</h2>
            <LineChart
              data={runtimeChartData}
              index="run"
              categories={["time"]}
              colors={["blue"]}
              valueFormatter={(num) => `${num.toFixed(2)}ms`}
              showYAxis={true}
              showLegend={false}
              className="h-64"
              yAxisWidth={50}
              minValue={getChartDomain(runtimeChartData, "time")[0]}
              maxValue={getChartDomain(runtimeChartData, "time")[1]}
            />
          </Card>
        )}

        {/* Resource Utilization */}
        {resourceUsage && (
          <Card className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Resource Utilization</h2>
            <CategoryBar
              values={[
                resourceUsage.cpuUsage?.[0] || 0,
                resourceUsage.memoryUsage?.[0] || 0,
                resourceUsage.gpuUsage?.[0] || 0,
              ]}
              colors={["blue", "amber", "emerald"]}
            />
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>CPU: {resourceUsage.cpuUsage?.[0]?.toFixed(1)}%</span>
              <span>Memory: {resourceUsage.memoryUsage?.[0]?.toFixed(1)}%</span>
              <span>GPU: {resourceUsage.gpuUsage?.[0]?.toFixed(1)}%</span>
            </div>
          </Card>
        )}

        {/* Data Visualization */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => setIsVisualizationExpanded(!isVisualizationExpanded)}
                className="p-1"
              >
                {isVisualizationExpanded ? (
                  <RiArrowDownLine className="size-5" />
                ) : (
                  <RiArrowLeftLine className="size-5" />
                )}
              </Button>
              <h2 className="text-lg font-medium text-gray-900">Data Visualization</h2>
            </div>
            {isVisualizationExpanded && (
              <Button
                onClick={() => {
                  const newConfig: PlotConfig = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'line',
                    xAxis: availableVariables[0] || '',
                    yAxis: availableVariables[1] || '',
                    operation: 'none'
                  };
                  setPlotConfigs([...plotConfigs, newConfig]);
                }}
                className="flex items-center gap-2"
              >
                <RiAddLine className="size-4" />
                Add Plot
              </Button>
            )}
          </div>
          
          {isVisualizationExpanded && (
            <div className="space-y-4">
              {plotConfigs.map((config) => (
                <div key={config.id} className="space-y-4">
                  <PlotConfigurator
                    config={config}
                    availableVariables={availableVariables}
                    onConfigChange={(newConfig) => {
                      setPlotConfigs(plotConfigs.map(c => 
                        c.id === config.id ? newConfig : c
                      ));
                    }}
                    onDelete={() => {
                      setPlotConfigs(plotConfigs.filter(c => c.id !== config.id));
                    }}
                  />
                  <Card className="p-4">
                    {config.title && (
                      <h3 className="text-sm font-medium text-gray-700 mb-2">{config.title}</h3>
                    )}
                    <LineChart
                      data={processDataForPlot(test.results?.results || [], config)}
                      index="x"
                      categories={["y"]}
                      colors={["blue"]}
                      showYAxis={true}
                      showLegend={false}
                      className="h-64"
                      yAxisWidth={75}
                      valueFormatter={(value) => formatWithUnits(value, config.yAxis)}
                      showGridLines={true}
                      showXAxis={true}
                      autoMinValue={true}
                    />
                  </Card>
                </div>
              ))}
              
              {plotConfigs.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">
                    Click "Add Plot" to create a new visualization
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Results Explorer */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => setIsResultsExpanded(!isResultsExpanded)}
                className="p-1"
              >
                {isResultsExpanded ? (
                  <RiArrowDownLine className="size-5" />
                ) : (
                  <RiArrowLeftLine className="size-5" />
                )}
              </Button>
              <h2 className="text-lg font-medium text-gray-900">Results Explorer</h2>
            </div>
            {isResultsExpanded && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setFilterExpanded(!filterExpanded)}
                  className="flex items-center gap-2"
                >
                  <RiFilterLine className="size-4" />
                  Filter
                </Button>
                <div className="relative">
                  <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search results..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
          
          {isResultsExpanded && test.results ? (
            <div className="space-y-6">
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => handleExport("json")}
                  className="flex items-center gap-2"
                >
                  <RiFileTextLine className="size-4" />
                  Export JSON
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleExport("csv")}
                  className="flex items-center gap-2"
                >
                  <RiFileTextLine className="size-4" />
                  Export CSV
                </Button>
                <PDFDownloadLink
                  document={<PDFReport test={test} />}
                  fileName={`${test.name}_report.pdf`}
                >
                  {({ loading }) => (
                    <Button
                      variant="secondary"
                      className="flex items-center gap-2"
                      disabled={loading}
                    >
                      <RiFileTextLine className="size-4" />
                      {loading ? "Generating PDF..." : "Export PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <JsonExplorer
                  data={filterJsonData(test.results, searchQuery)}
                  className="max-h-[600px] overflow-y-auto"
                />
              </div>
            </div>
          ) : isResultsExpanded ? (
            <p className="text-sm text-gray-500">Test results have not been reported yet.</p>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
