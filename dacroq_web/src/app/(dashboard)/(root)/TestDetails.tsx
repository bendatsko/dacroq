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
} from "@remixicon/react";
import { format } from "date-fns";
import { useState } from "react";
import FileSaver from "file-saver";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import { TestRun } from "@/types/test";

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

export default function TestDetails({ test, onBack }: TestDetailsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterExpanded, setFilterExpanded] = useState(false);

  // Build runtime chart data from test.results (if available)
  const runtimeChartData =
    test.results?.hardwareTimeSeconds?.map((time: string, index: number) => ({
      run: index + 1,
      time: parseFloat(time),
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
          <div className="flex flex-row justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <RiTimeLine className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium">
                  {test.completed
                    ? formatRuntime(
                        new Date(test.completed).getTime() -
                          new Date(test.created).getTime()
                      )
                    : "In Progress"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <RiHardDriveLine className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Hardware</p>
                <p className="font-medium">{test.chipType}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <RiFileTextLine className="size-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Input Files</p>
                <p className="font-medium">{inputFilesCount} files</p>
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

        {/* Results Explorer */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Results Explorer</h2>
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
          </div>
          
          {test.results ? (
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
          ) : (
            <p className="text-sm text-gray-500">Test results have not been reported yet.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
