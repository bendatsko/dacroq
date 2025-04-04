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
  RiSearchLine,
  RiFilterLine,
  RiAddLine,
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
import { TestRun, SolverMetrics } from "@/types/test";

// ---------------------- Types ----------------------
interface TestResults {
  solverMetrics: any;
  hardwareMetrics: any;
  performanceMetrics: any;
  resourceUsage: any;
  hardwareTimeSeconds: number[];
  [key: string]: any;
}

interface PlotConfig {
  id: string;
  type: "line" | "scatter" | "bar" | "box";
  xAxis: string;
  yAxis: string;
  operation: "none" | "derivative" | "movingAverage" | "standardDeviation";
  windowSize?: number;
  title?: string;
}

interface TestDetailsProps {
  test: TestRun;
  onBack: () => void;
}

// ---------------------- Utilities ----------------------
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

function formatEnergyNanojoules(nJ: number): string {
  if (nJ < 1_000) {
    return `${nJ.toPrecision(3)} nJ`;
  } else if (nJ < 1_000_000) {
    return `${(nJ / 1_000).toPrecision(3)} µJ`;
  } else if (nJ < 1_000_000_000) {
    return `${(nJ / 1_000_000).toPrecision(3)} mJ`;
  } else {
    return `${(nJ / 1_000_000_000).toPrecision(3)} J`;
  }
}

function formatTimeSeconds(sec: number): string {
  if (sec < 1) {
    return `${(sec * 1000).toPrecision(3)} ms`;
  }
  if (sec < 60) {
    return `${sec.toPrecision(3)} s`;
  }
  return `${sec.toPrecision(3)} s`;
}

/**
 * Adjust the displayed numeric format depending on the metric path.
 */
const formatWithUnits = (value: number, metric: string): string => {
  if (value === null || Number.isNaN(value)) return "N/A";
  switch (metric) {
    case "metadata.ets_nj":
    case "ets_nj":
      return formatEnergyNanojoules(value);
    case "performance_metrics.average_runtime":
    case "performance_metrics.min_runtime":
    case "performance_metrics.max_runtime":
    case "performance_metrics.median_runtime":
    case "hardwareTimeSeconds":
      return formatTimeSeconds(value);
    default:
      return value.toPrecision(3);
  }
};

/**
 * Format x-axis values concisely and append a unit if appropriate.
 * If the value is nearly an integer we assume it's an index ("Run X"),
 * otherwise we format it as a time value in seconds.
 */
const formatXAxisValueWithUnit = (value: number): string => {
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `Run ${Math.round(value)}`;
  }
  return `${value.toFixed(2)} s`;
};

const formatRuntime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// CNF parsing and validation utilities
const parseCNF = (cnfContent: string) => {
  console.log("Starting to parse CNF, sample:", cnfContent.substring(0, 200) + "...");
  
  const lines = cnfContent.trim().split('\n');
  console.log(`CNF has ${lines.length} lines`);
  
  const clauses: number[][] = [];
  let numVars = 0;
  let numClauses = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip comments
    if (trimmedLine.startsWith('c')) {
      continue;
    }
    
    // Parse problem line (p cnf numVars numClauses)
    if (trimmedLine.startsWith('p cnf')) {
      const parts = trimmedLine.split(/\s+/);
      if (parts.length >= 4) {
        numVars = parseInt(parts[2]);
        numClauses = parseInt(parts[3]);
        console.log(`Found problem line: ${numVars} variables, ${numClauses} clauses`);
      }
      continue;
    }
    
    // Parse clause lines
    if (trimmedLine && !trimmedLine.startsWith('c')) {
      const literals = trimmedLine.split(/\s+/)
        .map(lit => parseInt(lit))
        .filter(lit => lit !== 0);
      
      if (literals.length > 0) {
        clauses.push(literals);
      }
    }
  }
  
  console.log(`Parsed ${clauses.length} clauses out of expected ${numClauses}`);
  if (clauses.length === 0) {
    console.warn("No clauses were parsed! First 5 lines:", lines.slice(0, 5));
  }
  
  return { numVars, numClauses, clauses };
};

const validateSolution = (cnfContent: string, solutionStr: string) => {
  if (!cnfContent || !solutionStr) return { isValid: false, message: "Missing CNF or solution" };
  
  console.log("Validating solution:", {
    cnfContentLength: cnfContent.length,
    solutionStr,
  });
  
  // Parse CNF
  const parsed = parseCNF(cnfContent);
  console.log("Parsed CNF:", {
    numVars: parsed.numVars,
    numClauses: parsed.numClauses,
    actualClauses: parsed.clauses.length,
    firstFewClauses: parsed.clauses.slice(0, 3)
  });
  
  const { clauses } = parsed;
  
  // Parse solution (format: "1 -2 3 -4 ... 0")
  const solution = solutionStr.split(/\s+/)
    .map(lit => parseInt(lit))
    .filter(lit => lit !== 0);
  
  console.log("Parsed solution:", {
    solutionLength: solution.length,
    firstFewAssignments: solution.slice(0, 5)
  });
  
  // Create a map of variable assignments
  const assignments = new Map<number, boolean>();
  for (const lit of solution) {
    const variable = Math.abs(lit);
    const value = lit > 0;
    assignments.set(variable, value);
  }
  
  // Check each clause
  const unsatisfiedClauses: number[] = [];
  
  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    let clauseSatisfied = false;
    
    for (const lit of clause) {
      const variable = Math.abs(lit);
      const expectedValue = lit > 0;
      const assignedValue = assignments.get(variable);
      
      if (assignedValue === undefined) {
        return { isValid: false, message: `Variable ${variable} not assigned` };
      }
      
      if (assignedValue === expectedValue) {
        clauseSatisfied = true;
        break;
      }
    }
    
    if (!clauseSatisfied) {
      unsatisfiedClauses.push(i + 1); // +1 for 1-based indexing in output
    }
  }
  
  console.log("Validation result:", {
    unsatisfiedClauses: unsatisfiedClauses.length,
    isValid: unsatisfiedClauses.length === 0
  });
  
  if (unsatisfiedClauses.length === 0) {
    return { isValid: true, message: "All clauses satisfied" };
  } else {
    return {
      isValid: false,
      message: `${unsatisfiedClauses.length} unsatisfied clauses: ${
        unsatisfiedClauses.length > 5 
          ? `${unsatisfiedClauses.slice(0, 5).join(', ')}... (and ${unsatisfiedClauses.length - 5} more)`
          : unsatisfiedClauses.join(', ')
      }`
    };
  }
};

// ---------------------- PDF Export ----------------------
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

const PDFReport = ({ test }: { test: TestRun }) => {
  // Calculate performance metrics for PDF report
  const testResults = test.results?.results || [];
  
  // Perform validation for the PDF report
  const validationResults = testResults.map(result => {
    // Either solution_found or solverMetrics.solutionFound might be true
    const solutionClaimed = 
      result.solution_found === true || 
      (result.solverMetrics && result.solverMetrics.solutionFound === true);
    
    // If no solution was claimed, no need to validate
    if (!solutionClaimed) {
      return { isValid: false, claimed: false, message: "No solution claimed" };
    }
    
    // Check for solution string in either location
    const solutionString = 
      result.solution_string || 
      (result.solverMetrics && result.solverMetrics.solutionString);
    
    // If there's no solution string despite claiming success, that's an issue
    if (!solutionString || solutionString.trim() === '') {
      return { isValid: false, claimed: true, message: "Solution claimed but no assignment provided" };
    }
    
    // Get CNF content from either cnf or original_cnf field
    const cnfContent = result.cnf || result.original_cnf;
    
    // Only try to validate if we have the CNF content
    if (!cnfContent) {
      return { isValid: false, claimed: true, message: "Missing CNF formula" };
    }
    
    // Handle undefined cnfContent
    if (typeof cnfContent !== 'string') {
      return { isValid: false, claimed: true, message: "Invalid CNF format" };
    }
    
    // Validate the solution against the CNF
    try {
      const validation = validateSolution(cnfContent, solutionString);
      return {
        isValid: validation.isValid,
        claimed: true,
        message: validation.message
      };
    } catch (error) {
      return { 
        isValid: false, 
        claimed: true, 
        message: "Validation error: " + (error instanceof Error ? error.message : String(error)) 
      };
    }
  });
  
  const validatedSuccessCount = validationResults.filter(v => v.isValid).length;
  const claimedSuccessCount = validationResults.filter(v => v.claimed).length;
  const incorrectClaimsCount = validationResults.filter(v => v.claimed && !v.isValid).length;
  
  const validatedSuccessRate = testResults.length > 0
    ? (validatedSuccessCount / testResults.length) * 100
    : 0;
  const claimedSuccessRate = testResults.length > 0
    ? (claimedSuccessCount / testResults.length) * 100
    : 0;
  
  const solveTimes = testResults.map((r) =>
    r.hardware_time_seconds?.split(',').map(Number) || []
  ).flat();
  const averageRuntime = solveTimes.length > 0
    ? solveTimes.reduce((a: number, b: number) => a + b, 0) / solveTimes.length * 1000
    : 0;
  const minRuntime = solveTimes.length > 0
    ? Math.min(...solveTimes) * 1000
    : 0;
  const maxRuntime = solveTimes.length > 0
    ? Math.max(...solveTimes) * 1000
    : 0;
  const medianRuntime = solveTimes.length > 0
    ? solveTimes.sort((a: number, b: number) => a - b)[Math.floor(solveTimes.length / 2)] * 1000
    : 0;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.header}>{test.name} - Test Report</Text>
          <Text style={pdfStyles.subheader}>Test Information</Text>
          <Text style={pdfStyles.text}>Status: {test.status}</Text>
          <Text style={pdfStyles.text}>Hardware Type: {test.chipType}</Text>
          <Text style={pdfStyles.text}>Created: {formatDate(test.created)}</Text>
          <Text style={pdfStyles.text}>Completed: {formatDate(test.completed)}</Text>
          {testResults.length > 0 && (
            <>
              <Text style={pdfStyles.subheader}>Solution Validation</Text>
              <Text style={pdfStyles.text}>
                Validated Success Rate: {validatedSuccessRate.toFixed(1)}%
              </Text>
              <Text style={pdfStyles.text}>
                Claimed Success Rate: {claimedSuccessRate.toFixed(1)}%
              </Text>
              <Text style={pdfStyles.text}>
                Valid Solutions: {validatedSuccessCount} of {testResults.length}
              </Text>
              <Text style={pdfStyles.text}>
                Invalid Claims: {incorrectClaimsCount} 
                ({claimedSuccessCount > 0 
                  ? ((incorrectClaimsCount / claimedSuccessCount) * 100).toFixed(1) 
                  : 0}% of claimed successes)
              </Text>
              
              <Text style={pdfStyles.subheader}>Performance Metrics</Text>
              <Text style={pdfStyles.text}>
                Average Runtime: {averageRuntime.toFixed(2)}ms
              </Text>
              <Text style={pdfStyles.text}>
                Min Runtime: {minRuntime.toFixed(2)}ms
              </Text>
              <Text style={pdfStyles.text}>
                Max Runtime: {maxRuntime.toFixed(2)}ms
              </Text>
              <Text style={pdfStyles.text}>
                Median Runtime: {medianRuntime.toFixed(2)}ms
              </Text>
            </>
          )}
        </View>
      </Page>
    </Document>
  );
};

// ---------------------- Chart Helpers ----------------------
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

function getValueFromPath(obj: any, path: string): number | null {
  try {
    return path.split(".").reduce((o, i) => o[i], obj);
  } catch {
    return null;
  }
}

/**
 * Applies the specified operation to the data or returns it as is if operation === 'none'.
 */
const processDataForPlot = (results: any[], config: PlotConfig) => {
  if (!Array.isArray(results)) {
    console.error("Results is not an array");
    return [];
  }
  const data = results
    .map((r: any) => {
      const x = getValueFromPath(r, config.xAxis);
      const y = getValueFromPath(r, config.yAxis);
      if (x === null || y === null) return null;
      return { x, y };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
  switch (config.operation) {
    case "derivative":
      return data.map((point, i, arr) => {
        if (i === 0) return point;
        const dx = point.x - arr[i - 1].x;
        const dy = point.y - arr[i - 1].y;
        return { x: point.x, y: dx === 0 ? 0 : dy / dx };
      });
    case "movingAverage": {
      const windowSize = config.windowSize || 5;
      return data.map((point, i, arr) => {
        const start = Math.max(0, i - windowSize + 1);
        const window = arr.slice(start, i + 1);
        const avg = window.reduce((sum, p) => sum + p.y, 0) / window.length;
        return { x: point.x, y: avg };
      });
    }
    case "standardDeviation": {
      const windowSize2 = config.windowSize || 5;
      return data.map((point, i, arr) => {
        const start = Math.max(0, i - windowSize2 + 1);
        const window = arr.slice(start, i + 1);
        const mean = window.reduce((sum, p) => sum + p.y, 0) / window.length;
        const variance =
          window.reduce((sum, p) => sum + Math.pow(p.y - mean, 2), 0) /
          window.length;
        return { x: point.x, y: Math.sqrt(variance) };
      });
    }
    default:
      return data;
  }
};

// ---------------------- Plot Configurator ----------------------
const PlotConfigurator = ({
  config,
  availableVariables,
  onConfigChange,
  onDelete,
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Plot Type
          </label>
          <Select
            value={config.type}
            onValueChange={(value) =>
              onConfigChange({ ...config, type: value as PlotConfig["type"] })
            }
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Operation
          </label>
          <Select
            value={config.operation}
            onValueChange={(value) =>
              onConfigChange({
                ...config,
                operation: value as PlotConfig["operation"],
              })
            }
          >
            <SelectTrigger>
              {config.operation === "none" ? "None" : config.operation}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="derivative">Derivative</SelectItem>
              <SelectItem value="movingAverage">Moving Average</SelectItem>
              <SelectItem value="standardDeviation">
                Standard Deviation
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            X Axis
          </label>
          <Select
            value={config.xAxis}
            onValueChange={(value) =>
              onConfigChange({ ...config, xAxis: value })
            }
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Y Axis
          </label>
          <Select
            value={config.yAxis}
            onValueChange={(value) =>
              onConfigChange({ ...config, yAxis: value })
            }
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
        {config.operation === "movingAverage" && (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Window Size
            </label>
            <input
              type="number"
              min="2"
              value={config.windowSize || 5}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  windowSize: parseInt(e.target.value),
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
    </Card>
  );
};

// ---------------------- Main Component ----------------------
export default function TestDetails({ test, onBack }: TestDetailsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [plotConfigs, setPlotConfigs] = useState<PlotConfig[]>([]);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [isVisualizationExpanded, setIsVisualizationExpanded] = useState(true);
  const [isResultsExpanded, setIsResultsExpanded] = useState(true);
  const [includeCNF, setIncludeCNF] = useState(false);

  // Build runtime chart data from test.results (if available)
  const runtimeChartData =
    test.results?.results?.map((r, index) => ({
      run: index + 1,
      time: Number(r.hardware_time_seconds?.split(',')[0] || 0),
    })) || [];

  // Calculate statistics from test results
  const testResults = test.results?.results || [];
  console.log('Test Results:', testResults);
  console.log('Test Results Length:', testResults.length);
  
  // Calculate validated success rate - data processing only
  const validationResults = testResults.map((result, index) => {
    // Handle potential undefined/null results
    if (!result) {
      console.log(`Test ${index + 1}: Result is null or undefined`);
      return { isValid: false, claimed: false, message: "Missing test result data" };
    }
    
    // Check for various claim indicators - handle both boolean and string types
    // solution_found could be boolean true or string "true"
    const solutionFoundBoolean = result.solution_found === true;
    const solutionFoundString = typeof result.solution_found === 'string' && 
                               (result.solution_found as string).toLowerCase() === 'true';
    
    // SolverMetrics solution flag
    const solverMetricsSolutionFound = result.solverMetrics && result.solverMetrics.solutionFound === true;
    
    // Other possible solution indicators in proprietary formats
    const anyResult = result as any;
    const otherSolutionIndicators = ['solution', 'sat', 'satisfiable', 'solved']
      .some(prop => anyResult[prop] === true || anyResult[prop] === 'true');
    
    // Combine all possible claim indicators
    const solutionClaimed = solutionFoundBoolean || solutionFoundString || 
                           solverMetricsSolutionFound || otherSolutionIndicators;
    
    console.log(`Test ${index + 1}:`, {
      solution_found: result.solution_found,
      solution_found_type: typeof result.solution_found,
      solutionFoundBoolean,
      solutionFoundString,
      solverMetrics_solutionFound: result.solverMetrics?.solutionFound,
      otherSolutionIndicators,
      solutionClaimed,
      solution_string: result.solution_string,
      solution_string_length: result.solution_string?.length,
      solverMetrics_solutionString: result.solverMetrics?.solutionString,
      solverMetrics_solutionString_length: result.solverMetrics?.solutionString?.length,
      hasCNF: !!result.cnf || !!result.original_cnf,
      cnfLength: result.cnf?.length || result.original_cnf?.length || 0
    });
    
    // If no solution was claimed, no need to validate
    if (!solutionClaimed) {
      return { isValid: false, claimed: false, message: "No solution claimed" };
    }
    
    // Check for solution string in any possible location
    const solutionString = 
      result.solution_string || 
      (result.solverMetrics && result.solverMetrics.solutionString) ||
      anyResult.solution || 
      anyResult.assignment || 
      anyResult.variable_assignment;
    
    // If there's no solution string despite claiming success, that's an issue
    if (!solutionString || solutionString.trim() === '') {
      return { isValid: false, claimed: true, message: "Solution claimed but no assignment provided" };
    }
    
    // Get CNF content from either cnf or original_cnf field
    const cnfContent = result.cnf || result.original_cnf;
    
    // Only try to validate if we have the CNF content
    if (!cnfContent) {
      return { isValid: false, claimed: true, message: "Missing CNF formula" };
    }
    
    // Handle undefined cnfContent
    if (typeof cnfContent !== 'string') {
      return { isValid: false, claimed: true, message: "Invalid CNF format" };
    }
    
    // Validate the solution against the CNF
    try {
      const validation = validateSolution(cnfContent, solutionString);
      console.log(`Test ${index + 1} validation:`, validation);
      return {
        isValid: validation.isValid,
        claimed: true,
        message: validation.message
      };
    } catch (error) {
      console.error(`Test ${index + 1} validation error:`, error);
      return { 
        isValid: false, 
        claimed: true, 
        message: "Validation error: " + (error instanceof Error ? error.message : String(error)) 
      };
    }
  });
  
  const validatedSuccessCount = validationResults.filter(v => v.isValid).length;
  const claimedSuccessCount = validationResults.filter(v => v.claimed).length;
  const incorrectClaimsCount = validationResults.filter(v => v.claimed && !v.isValid).length;
  
  const validatedSuccessRate = testResults.length > 0
    ? (validatedSuccessCount / testResults.length) * 100
    : 0;
  const claimedSuccessRate = testResults.length > 0
    ? (claimedSuccessCount / testResults.length) * 100
    : 0;
    
  console.log('Validated Success Rate:', validatedSuccessRate);
  console.log('Claimed Success Rate:', claimedSuccessRate);
  console.log('Incorrect Claims:', incorrectClaimsCount);

  const totalTests = testResults.length;
  const solveTimes = testResults.map((r) => 
    r.hardware_time_seconds?.split(',').map(Number) || []
  ).flat();
  const medianSolveTime = solveTimes.length > 0 
    ? solveTimes.sort((a: number, b: number) => a - b)[Math.floor(solveTimes.length / 2)]
    : null;
  const averageSolveTime = solveTimes.length > 0
    ? solveTimes.reduce((a: number, b: number) => a + b, 0) / solveTimes.length
    : null;

  // Calculate hardware-software co-design metrics
  const hardwareSoftwareMetrics = testResults.map((r) => {
    const hwTimes = r.hardware_time_seconds?.split(',').map(Number) || [];
    const cpuTimes = r.cpu_time_seconds?.split(',').map(Number) || [];
    const hwEnergy = r.hardware_energy_joules?.split(',').map(Number) || [];
    const cpuEnergy = r.cpu_energy_joules?.split(',').map(Number) || [];
    const hwCalls = Array.isArray(r.hardware_calls) ? r.hardware_calls[0] : r.hardware_calls || 0;
    const solverIterations = Array.isArray(r.solver_iterations) ? r.solver_iterations[0] : r.solver_iterations || 0;
    
    return {
      hwTime: hwTimes[0] || 0,
      cpuTime: cpuTimes[0] || 0,
      hwEnergy: hwEnergy[0] || 0,
      cpuEnergy: cpuEnergy[0] || 0,
      hwCalls: Number(hwCalls),
      solverIterations: Number(solverIterations)
    };
  });

  const avgHwTime = hardwareSoftwareMetrics.length > 0 
    ? hardwareSoftwareMetrics.reduce((sum, m) => sum + m.hwTime, 0) / hardwareSoftwareMetrics.length 
    : 0;
  const avgCpuTime = hardwareSoftwareMetrics.length > 0
    ? hardwareSoftwareMetrics.reduce((sum, m) => sum + m.cpuTime, 0) / hardwareSoftwareMetrics.length
    : 0;
  const avgHwEnergy = hardwareSoftwareMetrics.length > 0
    ? hardwareSoftwareMetrics.reduce((sum, m) => sum + m.hwEnergy, 0) / hardwareSoftwareMetrics.length
    : 0;
  const avgCpuEnergy = hardwareSoftwareMetrics.length > 0
    ? hardwareSoftwareMetrics.reduce((sum, m) => sum + m.cpuEnergy, 0) / hardwareSoftwareMetrics.length
    : 0;
  const avgHwCalls = hardwareSoftwareMetrics.length > 0
    ? hardwareSoftwareMetrics.reduce((sum, m) => sum + m.hwCalls, 0) / hardwareSoftwareMetrics.length
    : 0;
  const avgSolverIterations = hardwareSoftwareMetrics.length > 0
    ? hardwareSoftwareMetrics.reduce((sum, m) => sum + m.solverIterations, 0) / hardwareSoftwareMetrics.length
    : 0;

  const hwCpuTimeRatio = avgCpuTime > 0 ? avgHwTime / avgCpuTime : 0;
  const hwCpuEnergyRatio = avgCpuEnergy > 0 ? avgHwEnergy / avgCpuEnergy : 0;
  const hwEfficiency = avgSolverIterations > 0 ? avgHwCalls / avgSolverIterations : 0;

  // Calculate performance metrics from test results
  const performanceMetrics = {
    successRate: validatedSuccessRate,
    averageRuntime: averageSolveTime ? averageSolveTime * 1000 : 0, // Convert to ms
    minRuntime: solveTimes.length > 0 ? Math.min(...solveTimes) * 1000 : 0, // Convert to ms
    maxRuntime: solveTimes.length > 0 ? Math.max(...solveTimes) * 1000 : 0, // Convert to ms
    medianRuntime: medianSolveTime ? medianSolveTime * 1000 : 0, // Convert to ms
  };

  // Get resource usage from first test result
  const resourceUsage = testResults[0]?.resourceUsage;

  // Format time in seconds to a readable string
  const formatTimeSecondsReadable = (seconds: number) => {
    const microseconds = seconds * 1_000_000;
    return `${microseconds.toFixed(2)} µs`;
  };

  // Format energy in joules to a readable string
  const formatEnergyJoules = (joules: number) => {
    if (joules < 1e-6) {
      return `${(joules * 1e9).toFixed(2)} nJ`;
    } else if (joules < 1e-3) {
      return `${(joules * 1e6).toFixed(2)} µJ`;
    } else if (joules < 1) {
      return `${(joules * 1e3).toFixed(2)} mJ`;
    }
    return `${joules.toFixed(2)} J`;
  };

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

    // Remove CNF content if not needed
    if (!includeCNF && exportData.results?.results) {
      exportData.results.results = exportData.results.results.map(result => {
        const { cnf, original_cnf, ...rest } = result;
        return rest;
      });
    }

    try {
      switch (format) {
        case "json": {
          const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
          });
          FileSaver.saveAs(jsonBlob, `${test.name}_results.json`);
          break;
        }
        case "csv": {
          const csvData = [exportData.testInfo, exportData.results];
          const csvBlob = new Blob([convertToCSV(csvData)], {
            type: "text/csv",
          });
          FileSaver.saveAs(csvBlob, `${test.name}_results.csv`);
          break;
        }
        case "pdf":
          // Handled via PDFDownloadLink
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

  // Extract available numeric variables for plotting
  useEffect(() => {
    if (test.results?.results) {
      const variables = extractVariables(test.results.results[0]);
      setAvailableVariables(variables);

      // Set up default plots
      const defaultPlots: PlotConfig[] = [
        {
          id: "1",
          type: "scatter",
          xAxis: "performance_metrics.average_runtime",
          yAxis: "metadata.ets_nj",
          operation: "none",
          title: "Energy vs Time Correlation",
        },
        {
          id: "2",
          type: "line",
          xAxis: "instance_idx",
          yAxis: "performance_metrics.success_rate",
          operation: "none",
          title: "Success Rate vs Problem Size",
        },
      ];
      setPlotConfigs(defaultPlots);
    }
  }, [test.results]);

  // Recursively extract numeric variables
  const extractVariables = (data: any, prefix = ""): string[] => {
    const vars: string[] = [];
    const traverse = (obj: any, path: string) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        if (obj.every((item) => typeof item === "number")) {
          vars.push(path);
        } else {
          obj.forEach((item, idx) => traverse(item, `${path}[${idx}]`));
        }
      } else if (typeof obj === "object") {
        Object.entries(obj).forEach(([k, v]) => {
          traverse(v, path ? `${path}.${k}` : k);
        });
      } else if (typeof obj === "number") {
        vars.push(path);
      }
    };
    traverse(data, prefix);
    return vars;
  };

  // At the beginning of the TestDetails component
  useEffect(() => {
    // Debug: Log the full first test result to check its structure
    if (test?.results?.results && test.results.results.length > 0) {
      console.log("3-SAT Test Structure:", {
        chip: test.chipType,
        firstResult: {
          solution_found: test.results.results[0].solution_found,
          solution_string: test.results.results[0].solution_string,
          solverMetrics: test.results.results[0].solverMetrics,
          hasCNF: !!test.results.results[0].cnf || !!test.results.results[0].original_cnf
        },
        raw: test.results.results[0]
      });

      // Check if the data is in a different format than expected
      if (test.chipType === "3-SAT") {
        // Try alternate properties that might indicate solutions
        for (const result of test.results.results) {
          console.log("3-SAT Result keys:", Object.keys(result));
          
          // Check for various potential formats of solution data
          const possibleSolutionProperties = [
            "solution", "solution_string", "solutions", "assignment", 
            "variable_assignment", "satisfying_assignment", "sat"
          ];
          
          for (const prop of possibleSolutionProperties) {
            // Using type assertion to avoid TypeScript errors
            const anyResult = result as any;
            if (prop in anyResult) {
              console.log(`Found potential solution in property: ${prop}`, anyResult[prop]);
            }
          }
          
          // Also check if the solution_found flag might be a string "true" instead of boolean true
          if (typeof result.solution_found === 'string') {
            console.log('Found solution_found as string:', result.solution_found);
            
            // If solution_found is the string "true", treat it as a claim
            if ((result.solution_found as string).toLowerCase() === 'true') {
              console.log('String "true" detected for solution_found - this should be treated as a claim');
            }
          }
        }
      }
    }
  }, [test]);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <RiArrowLeftLine className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {test.name}
            </h1>
            <p className="text-sm text-gray-500">
              Created {formatDate(test.created)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Results Brief */}
        <Card className="p-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Chip Type</p>
              <p className="text-lg font-semibold">{test.chipType}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Total Tests</p>
              <p className="text-lg font-semibold">{totalTests}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Median Solve Time</p>
              <p className="text-lg font-semibold">
                {medianSolveTime ? formatTimeSeconds(medianSolveTime) : "N/A"}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Success Rate</p>
              <p className="text-lg font-semibold">{validatedSuccessRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        {/* Solution Validation Summary */}
        {validationResults && validationResults.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Solution Validation Summary
            </h2>
            <pre className="text-xs bg-gray-100 p-2 mb-4 overflow-auto max-h-40 rounded">
              {JSON.stringify({
                testResultsLength: testResults.length,
                validatedSuccessCount,
                claimedSuccessCount,
                incorrectClaimsCount,
                validatedSuccessRate,
                claimedSuccessRate,
                validationSummary: validationResults.map((result, i) => ({
                  test: i + 1,
                  claimed: result.claimed,
                  isValid: result.isValid,
                  message: result.message
                }))
              }, null, 2)}
            </pre>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500">Valid Solutions</p>
                <p className="text-lg font-semibold text-green-700">{validatedSuccessCount}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">Claimed Successes</p>
                <p className="text-lg font-semibold text-blue-700">{claimedSuccessCount}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-500">Invalid Claims</p>
                <p className="text-lg font-semibold text-red-700">{incorrectClaimsCount}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Validation Rate</p>
                <p className="text-lg font-semibold">
                  {claimedSuccessCount > 0 
                    ? ((validatedSuccessCount / claimedSuccessCount) * 100).toFixed(1) 
                    : 0}%
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm">
                {incorrectClaimsCount > 0 
                  ? `Warning: ${incorrectClaimsCount} solutions claimed as valid don't actually satisfy all clauses.` 
                  : "All claimed solutions are valid."}
              </p>
            </div>
          </Card>
        )}

        {/* Hardware-Software Co-Design Metrics */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Hardware-Software Co-Design Analysis
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Hardware Time</p>
              <p className="text-lg font-semibold">{formatTimeSeconds(avgHwTime)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">CPU Time</p>
              <p className="text-lg font-semibold">{formatTimeSeconds(avgCpuTime)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Hardware Energy</p>
              <p className="text-lg font-semibold">{formatEnergyJoules(avgHwEnergy)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">CPU Energy</p>
              <p className="text-lg font-semibold">{formatEnergyJoules(avgCpuEnergy)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Time Ratio (HW/CPU)</p>
              <p className="text-lg font-semibold">{hwCpuTimeRatio.toFixed(2)}x</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Energy Ratio (HW/CPU)</p>
              <p className="text-lg font-semibold">{hwCpuEnergyRatio.toFixed(2)}x</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Hardware Calls</p>
              <p className="text-lg font-semibold">{avgHwCalls.toFixed(0)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Solver Iterations</p>
              <p className="text-lg font-semibold">{avgSolverIterations.toFixed(0)}</p>
            </div>
          </div>
        </Card>

        {/* Performance Metrics */}
        {performanceMetrics && (
          <Card className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Performance Metrics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Validated Success Rate</p>
                <p className="text-sm font-medium">
                  {validatedSuccessRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Claimed Success Rate</p>
                <p className="text-sm font-medium">
                  {claimedSuccessRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Incorrect Claims</p>
                <p className="text-sm font-medium">
                  {incorrectClaimsCount} ({testResults.length > 0 ? ((incorrectClaimsCount / testResults.length) * 100).toFixed(1) : 0}%)
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Average Runtime</p>
                <p className="text-sm font-medium">
                  {performanceMetrics.averageRuntime.toFixed(2)}ms
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Min Runtime</p>
                <p className="text-sm font-medium">
                  {performanceMetrics.minRuntime.toFixed(2)}ms
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Max Runtime</p>
                <p className="text-sm font-medium">
                  {performanceMetrics.maxRuntime.toFixed(2)}ms
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Runtime Analysis */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Runtime Analysis
            </h2>
          </div>
          <LineChart
            data={runtimeChartData}
            index="run"
            yAxisWidth={80}
            categories={["time"]}
            colors={["blue"]}
            valueFormatter={(value) => `${value.toFixed(2)}ms`}
            showLegend={false}
            className="h-64"
          />
        </Card>

        {/* Original CNF Content - only shown if available */}
        {testResults.length > 0 && (testResults[0].cnf || testResults[0].original_cnf) && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Original CNF Content
              </h2>
              {testResults.length > 1 && (
                <div className="text-sm text-gray-500">
                  Showing CNF for first test only
                </div>
              )}
            </div>
            <div className="overflow-auto max-h-64 bg-gray-50 p-4 rounded-md">
              <pre className="text-xs font-mono whitespace-pre">
                {testResults[0].cnf || testResults[0].original_cnf}
              </pre>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              This is the original DIMACS CNF format problem description
            </p>
          </Card>
        )}

        {/* Solution Validation */}
        {testResults.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Solution Validation
            </h2>
            {claimedSuccessCount === 0 ? (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-700">
                  No solutions were claimed by the solver for any test.
                </p>
              </div>
            ) : (
              <div>
                {validationResults.map((result, index) => {
                  if (!result.claimed) {
                    return (
                      <div key={index} className="mb-4 last:mb-0">
                        <div className="flex items-center mb-2">
                          <span className="mr-2 font-medium">
                            Test {index + 1}:
                          </span>
                          <div className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm">
                            No solution claimed
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Check for message about missing solution string
                  if (result.message === "Solution claimed but no assignment provided") {
                    return (
                      <div key={index} className="mb-4 last:mb-0">
                        <div className="flex items-center mb-2">
                          <span className="mr-2 font-medium">
                            Test {index + 1}:
                          </span>
                          <div className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-sm">
                            Solution claimed but no assignment provided
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  if (result.message === "Missing CNF formula" || result.message === "Invalid CNF format") {
                    // Get the solution string from the test result since it might not be in our result object
                    const solutionString = 
                      testResults[index]?.solution_string || 
                      (testResults[index]?.solverMetrics && testResults[index]?.solverMetrics.solutionString);
                    
                    return (
                      <div key={index} className="mb-4 last:mb-0">
                        <div className="flex items-center mb-2">
                          <span className="mr-2 font-medium">
                            Test {index + 1}:
                          </span>
                          <div className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-sm">
                            Cannot validate - {result.message}
                          </div>
                        </div>
                        {solutionString && (
                          <div className="text-sm bg-gray-50 p-3 rounded-md">
                            <div className="font-medium mb-1">
                              Assigned variables:
                            </div>
                            <div className="text-xs font-mono break-all">
                              {solutionString}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  // For valid or invalid solutions with validation messages
                  // Get the solution string from the test result
                  const solutionString = 
                    testResults[index]?.solution_string || 
                    (testResults[index]?.solverMetrics && testResults[index]?.solverMetrics.solutionString);
                  
                  return (
                    <div key={index} className="mb-4 last:mb-0">
                      <div className="flex items-center mb-2">
                        <span className="mr-2 font-medium">
                          Test {index + 1}:
                        </span>
                        {result.isValid ? (
                          <div className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">
                            ✓ Valid solution
                          </div>
                        ) : (
                          <div className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-sm">
                            ✗ Invalid solution: {result.message}
                          </div>
                        )}
                      </div>
                      {solutionString && (
                        <div className="text-sm bg-gray-50 p-3 rounded-md">
                          <div className="font-medium mb-1">
                            Assigned variables:
                          </div>
                          <div className="text-xs font-mono break-all">
                            {solutionString}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Raw Results */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Raw Test Results
            </h2>
          </div>
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
            <div className="flex items-center ml-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className={`${
                    includeCNF ? "bg-blue-600" : "bg-gray-200"
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                  onClick={() => setIncludeCNF(!includeCNF)}
                >
                  <span
                    className={`${
                      includeCNF ? "translate-x-5" : "translate-x-0"
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
                <span className="ml-2 text-sm text-gray-600">
                  Include CNF content
                </span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <JsonExplorer
              data={filterJsonData(test.results, searchQuery)}
              className="max-h-[600px] overflow-y-auto"
            />
          </div>
        </Card>

        {/* Resource Utilization */}
        {resourceUsage && (
          <Card className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Resource Utilization
            </h2>
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
              <h2 className="text-lg font-medium text-gray-900">
                Results Explorer
              </h2>
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
                <div className="flex items-center ml-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={`${
                        includeCNF ? "bg-blue-600" : "bg-gray-200"
                      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                      onClick={() => setIncludeCNF(!includeCNF)}
                    >
                      <span
                        className={`${
                          includeCNF ? "translate-x-5" : "translate-x-0"
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                      />
                    </button>
                    <span className="ml-2 text-sm text-gray-600">
                      Include CNF content
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <JsonExplorer
                  data={filterJsonData(test.results, searchQuery)}
                  className="max-h-[600px] overflow-y-auto"
                />
              </div>
            </div>
          ) : isResultsExpanded ? (
            <p className="text-sm text-gray-500">
              Test results have not been reported yet.
            </p>
          ) : null}
        </Card>

        {/* Data Visualization */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() =>
                  setIsVisualizationExpanded(!isVisualizationExpanded)
                }
                className="p-1"
              >
                {isVisualizationExpanded ? (
                  <RiArrowDownLine className="size-5" />
                ) : (
                  <RiArrowLeftLine className="size-5" />
                )}
              </Button>
              <h2 className="text-lg font-medium text-gray-900">
                Data Visualization
              </h2>
            </div>
            {isVisualizationExpanded && (
              <Button
                onClick={() => {
                  const newConfig: PlotConfig = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: "line",
                    xAxis: availableVariables[0] || "",
                    yAxis: availableVariables[1] || "",
                    operation: "none",
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
                      setPlotConfigs((prev) =>
                        prev.map((c) => (c.id === config.id ? newConfig : c))
                      );
                    }}
                    onDelete={() => {
                      setPlotConfigs((prev) =>
                        prev.filter((c) => c.id !== config.id)
                      );
                    }}
                  />
                  <Card className="p-4">
                    {config.title && (
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        {config.title}
                      </h3>
                    )}
                    <LineChart
                      data={processDataForPlot(
                        test.results?.results || [],
                        config
                      )}
                      index="x"
                      categories={["y"]}
                      colors={["blue"]}
                      showYAxis
                      showLegend={false}
                      className="h-64"
                      yAxisWidth={75}
                      valueFormatter={(value) =>
                        formatWithUnits(value, config.yAxis)
                      }
                      showGridLines
                      showXAxis
                      autoMinValue
                      xAxisLabel="Time (s)"
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
      </div>
    </main>
  );
}
