'use client';

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryBar } from "@/components/CategoryBar";
import { Divider } from "@/components/Divider";
import { LineChart } from "@/components/LineChart";
import JsonExplorer from "@/components/JsonExplorer";
import { RiArrowLeftLine, RiDownloadLine, RiFileTextLine, RiHardDriveLine, RiTimeLine, RiSearchLine, RiFilterLine } from "@remixicon/react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import FileSaver from 'file-saver';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';
import { TestRun } from "@/types/test";

interface SolverMetrics {
    computationTime: number;  // in microseconds
    totalSteps: number;
    restarts: number;
    solutionFound: boolean;
    solutionString: string;
    solverIterations: number[];
    hardwareCalls: number[];
}

interface HardwareMetrics {
    hardwareTimeSeconds: string[];
    cpuTimeSeconds: string[];
    cpuEnergyJoules: string[];
    hardwareEnergyJoules: string[];
    preRuntimeSeconds: string;
    preHardwareTimeSeconds: string;
    preCpuTimeSeconds: string;
    preCpuEnergyJoules: string;
    preEnergyJoules: string;
}

interface PerformanceMetrics {
    successRate: number;
    solutionCount: number;
    averageRuntime: number;
    runtimeStdDev: number;
    minRuntime: number;
    maxRuntime: number;
    medianRuntime: number;
    runtimePercentiles: number[];
}

interface ResourceUsage {
    cpuUsage: number[];
    memoryUsage: number[];
    gpuUsage: number[];
    diskIO: number[];
    networkIO: number[];
}

interface PowerUsage {
    median: number;
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    totalEnergy: number;
}

interface SystemInfo {
    osVersion: string;
    cpuModel: string;
    cpuCores: number;
    memoryTotal: number;
    gpuModel: string;
    gpuMemory: number;
    diskSpace: number;
    networkSpeed: number;
}

interface CNFMetrics {
    variables: number;
    clauses: number;
    clauseVarRatio: number;
    avgClauseSize: number;
    maxClauseSize: number;
    minClauseSize: number;
}

interface BatchStatistics {
    meanLog10TTS: string;
    stdLog10TTS: string;
    medianTTS: string;
    q90TTS: string;
    cdf: {
        ttsValues: string[];
        probabilities: string[];
    };
}

interface TestDetailsProps {
    test: TestRun;
    onBack: () => void;
    performanceData: any[];
    utilizationData: any[];
    runtimeData: any[];
    aggregatedData: any[];
    usageSummary: any[];
    resourceData: any[];
}

interface CNFFileInfo {
    filename: string;
    variables: number;
    clauses: number;
    ratio: number;
    difficulty: string;
    batch: string;
}

interface CNFFilesResponse {
    status: string;
    data: CNFFileInfo[] | { [key: string]: CNFFileInfo[] };
}

// Helper function to convert object array to CSV
const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const cell = row[header]?.toString() ?? '';
                return cell.includes(',') ? `"${cell}"` : cell;
            }).join(',')
        )
    ];
    
    return csvRows.join('\n');
};

// Add PDF styles
const pdfStyles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 30
    },
    section: {
        margin: 10,
        padding: 10
    },
    header: {
        fontSize: 24,
        marginBottom: 20
    },
    subheader: {
        fontSize: 18,
        marginBottom: 10,
        marginTop: 15,
        color: '#666'
    },
    text: {
        fontSize: 12,
        marginBottom: 5
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#666',
        marginVertical: 10
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#666',
        minHeight: 25,
        alignItems: 'center'
    },
    tableHeader: {
        backgroundColor: '#f0f0f0'
    },
    tableCell: {
        flex: 1,
        padding: 5,
        fontSize: 10
    }
});

// Add date formatting utility
const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// PDF Report Component
const PDFReport = ({ test, fileMetrics, averageMetrics }: { 
    test: TestRun; 
    fileMetrics: Map<string, CNFMetrics>;
    averageMetrics: CNFMetrics;
}) => (
    <Document>
        <Page size="A4" style={pdfStyles.page}>
            <View style={pdfStyles.section}>
                <Text style={pdfStyles.header}>{test.name} - Test Report</Text>
                
                {/* Test Information */}
                <Text style={pdfStyles.subheader}>Test Information</Text>
                <Text style={pdfStyles.text}>Status: {test.status}</Text>
                <Text style={pdfStyles.text}>Hardware Type: {test.chipType}</Text>
                <Text style={pdfStyles.text}>Created: {formatDate(test.created)}</Text>
                <Text style={pdfStyles.text}>Completed: {formatDate(test.completed)}</Text>

                {/* CNF Problem Metrics */}
                <Text style={pdfStyles.subheader}>CNF Problem Metrics</Text>
                <View style={pdfStyles.table}>
                    <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
                        <Text style={pdfStyles.tableCell}>Problem</Text>
                        <Text style={pdfStyles.tableCell}>Variables</Text>
                        <Text style={pdfStyles.tableCell}>Clauses</Text>
                        <Text style={pdfStyles.tableCell}>Ratio</Text>
                        <Text style={pdfStyles.tableCell}>Status</Text>
                    </View>
                    {Array.from(fileMetrics.entries()).map(([file, metrics]) => (
                        <View key={file} style={pdfStyles.tableRow}>
                            <Text style={pdfStyles.tableCell}>{file.split('/').pop()}</Text>
                            <Text style={pdfStyles.tableCell}>{metrics.variables}</Text>
                            <Text style={pdfStyles.tableCell}>{metrics.clauses}</Text>
                            <Text style={pdfStyles.tableCell}>{metrics.clauseVarRatio.toFixed(2)}</Text>
                            <Text style={pdfStyles.tableCell}>
                                {test.results?.solverMetrics?.solutionFound ? "SOLVED" : "UNCERTAIN"}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Averages */}
                <Text style={pdfStyles.text}>Average Variables: {averageMetrics.variables}</Text>
                <Text style={pdfStyles.text}>Average Clauses: {averageMetrics.clauses}</Text>
                <Text style={pdfStyles.text}>Average Ratio: {averageMetrics.clauseVarRatio.toFixed(2)}</Text>

                {/* Solver Performance */}
                {test.results?.solverMetrics && (
                    <>
                        <Text style={pdfStyles.subheader}>Solver Performance</Text>
                        <Text style={pdfStyles.text}>
                            Computation Time: {(test.results.solverMetrics.computationTime / 1000).toFixed(2)}ms
                        </Text>
                        <Text style={pdfStyles.text}>
                            Total Steps: {test.results.solverMetrics.totalSteps.toLocaleString()}
                        </Text>
                        <Text style={pdfStyles.text}>
                            Restarts: {test.results.solverMetrics.restarts}
                        </Text>
                    </>
                )}

                {/* Power Metrics */}
                {test.results?.powerUsage && (
                    <>
                        <Text style={pdfStyles.subheader}>Power Efficiency</Text>
                        <Text style={pdfStyles.text}>
                            Energy per Solution: {
                                test.results.solverMetrics?.computationTime && test.results.powerUsage.mean
                                    ? ((test.results.powerUsage.mean * test.results.solverMetrics.computationTime / 1000000)).toFixed(2) + "J"
                                    : "N/A"
                            }
                        </Text>
                        <Text style={pdfStyles.text}>
                            Power Usage: {test.results.powerUsage.mean ? test.results.powerUsage.mean.toFixed(1) + "W" : "N/A"}
                        </Text>
                        <Text style={pdfStyles.text}>
                            Power Efficiency: {
                                test.results.solverMetrics?.totalSteps && test.results.powerUsage.mean && test.results.solverMetrics.computationTime
                                    ? (test.results.solverMetrics.totalSteps / (test.results.powerUsage.mean * test.results.solverMetrics.computationTime / 1000000)).toFixed(2) + " steps/J"
                                    : "N/A"
                            }
                        </Text>
                    </>
                )}
            </View>
        </Page>
    </Document>
);

export default function TestDetails({
    test,
    onBack,
    performanceData,
    utilizationData,
    runtimeData,
    aggregatedData,
    usageSummary,
    resourceData,
}: TestDetailsProps) {
    const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'gpu'>('cpu');
    const [fileMetrics, setFileMetrics] = useState<Map<string, CNFMetrics>>(new Map());
    const [cnfFiles, setCnfFiles] = useState<CNFFileInfo[] | { [key: string]: CNFFileInfo[] }>([]);
    const [groupBy, setGroupBy] = useState<'batch' | 'difficulty' | 'none'>('batch');
    const [sortBy, setSortBy] = useState<'variables' | 'clauses' | 'ratio' | 'name'>('variables');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [isLoadingCNF, setIsLoadingCNF] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterExpanded, setFilterExpanded] = useState(false);

    // Function to parse CNF file content and extract metrics
    const parseCNFMetrics = (content: string): CNFMetrics => {
        const lines = content.split('\n');
        let variables = 0;
        let clauses = 0;

        // Look for the header line
        for (const line of lines) {
            if (line.startsWith('c')) continue; // Skip comments
            if (line.startsWith('p cnf')) {
                const parts = line.split(' ');
                if (parts.length >= 4) {
                    variables = parseInt(parts[2], 10);
                    clauses = parseInt(parts[3], 10);
                    break;
                }
            }
        }

        // If no header found, count manually
        if (variables === 0 || clauses === 0) {
            let maxVar = 0;
            let clauseCount = 0;
            for (const line of lines) {
                if (line.startsWith('c')) continue;
                const nums = line.trim().split(/\s+/).map(n => parseInt(n, 10));
                if (nums.length > 0 && nums[nums.length - 1] === 0) {
                    clauseCount++;
                    for (const num of nums) {
                        const absNum = Math.abs(num);
                        if (absNum > maxVar && absNum !== 0) {
                            maxVar = absNum;
                        }
                    }
                }
            }
            if (maxVar > 0) variables = maxVar;
            if (clauseCount > 0) clauses = clauseCount;
        }

        const metrics: CNFMetrics = {
            variables,
            clauses,
            clauseVarRatio: variables > 0 ? clauses / variables : 0,
            avgClauseSize: 0,
            maxClauseSize: 0,
            minClauseSize: 0
        };
        
        return metrics;
    };

    // Function to fetch and parse CNF file content
    const fetchCNFMetrics = async (file: string) => {
        try {
            // Normalize the path by replacing backslashes with forward slashes
            const normalizedPath = file.replace(/\\/g, '/');
            
            // Log the request for debugging
            console.log('Fetching CNF content for:', normalizedPath);
            
            const response = await fetch(`http://localhost:8080/get-cnf-content?file=${encodeURIComponent(normalizedPath)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain',
                },
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch CNF content for ${file}:`, errorText);
                return null;
            }
            
            const content = await response.text();
            if (!content) {
                console.error('Received empty content for file:', file);
                return null;
            }

            return parseCNFMetrics(content);
        } catch (error) {
            console.error(`Error fetching CNF metrics for ${file}:`, error);
            return null;
        }
    };

    // Load CNF metrics when component mounts or when input files change
    useEffect(() => {
        const loadMetrics = async () => {
            const newMetrics = new Map<string, CNFMetrics>();
            if (test.results?.inputFiles) {
                for (const file of test.results.inputFiles) {
                    const metrics = await fetchCNFMetrics(file);
                    if (metrics) {
                        newMetrics.set(file, metrics);
                    }
                }
            }
            setFileMetrics(newMetrics);
        };
        loadMetrics();
    }, [test.results?.inputFiles]);

    useEffect(() => {
        const fetchCNFFiles = async () => {
            setIsLoadingCNF(true);
            try {
                const response = await fetch(`http://localhost:8080/cnf-files?groupBy=${groupBy}&sortBy=${sortBy}`);
                if (!response.ok) throw new Error('Failed to fetch CNF files');
                const data: CNFFilesResponse = await response.json();
                setCnfFiles(data.data);
            } catch (error) {
                console.error('Error fetching CNF files:', error);
            } finally {
                setIsLoadingCNF(false);
            }
        };

        fetchCNFFiles();
    }, [groupBy, sortBy]);

    // Calculate averages for the summary section
    const calculateAverageMetrics = (): CNFMetrics => {
        if (!fileMetrics.size) return { 
            variables: 0, 
            clauses: 0, 
            clauseVarRatio: 0,
            avgClauseSize: 0,
            maxClauseSize: 0,
            minClauseSize: 0 
        };
        
        let totalVars = 0;
        let totalClauses = 0;
        
        for (const metrics of fileMetrics.values()) {
            totalVars += metrics.variables;
            totalClauses += metrics.clauses;
        }
        
        const avgVars = totalVars / fileMetrics.size;
        const avgClauses = totalClauses / fileMetrics.size;
        
        const metrics: CNFMetrics = {
            variables: Math.round(avgVars),
            clauses: Math.round(avgClauses),
            clauseVarRatio: avgVars > 0 ? avgClauses / avgVars : 0,
            avgClauseSize: 0,
            maxClauseSize: 0,
            minClauseSize: 0
        };
        
        return metrics;
    };

    const formatRuntime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    const handleDownload = async (filePath: string, filename: string) => {
        try {
            // If it's a JSON file (test results), handle it directly
            if (filename.endsWith('.json')) {
                const blob = new Blob([filePath], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                return;
            }

            // For CNF files, fetch the content from the API
            // Convert backslashes to forward slashes for cross-platform compatibility
            const normalizedPath = filePath.replace(/\\/g, '/');
            const response = await fetch(`http://localhost:8080/get-cnf-content?file=${encodeURIComponent(normalizedPath)}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('File not found. Please check if the file exists.');
                }
                throw new Error(`Failed to fetch CNF content: ${response.statusText}`);
            }
            
            const content = await response.text();
            
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            // Show error message to user
            alert(error instanceof Error ? error.message : 'Failed to download file');
        }
    };

    const sortFiles = (files: Array<[string, CNFMetrics]>) => {
        return [...files].sort(([fileA, metricsA], [fileB, metricsB]) => {
            const multiplier = sortDirection === 'desc' ? -1 : 1;
            switch (sortBy) {
                case 'variables':
                    return (metricsA.variables - metricsB.variables) * multiplier;
                case 'clauses':
                    return (metricsA.clauses - metricsB.clauses) * multiplier;
                case 'ratio':
                    return (metricsA.clauseVarRatio - metricsB.clauseVarRatio) * multiplier;
                case 'name':
                    return fileA.localeCompare(fileB) * multiplier;
                default:
                    return 0;
            }
        });
    };

    const toggleSort = (column: 'variables' | 'clauses' | 'ratio' | 'name') => {
        if (sortBy === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortDirection('desc');
        }
    };

    const renderSortIcon = (column: 'variables' | 'clauses' | 'ratio' | 'name') => {
        if (sortBy !== column) return '↕️';
        return sortDirection === 'desc' ? '↓' : '↑';
    };

    const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
        try {
            // Prepare the data in DARPA-friendly format
            const exportData = {
                testInfo: {
                    id: test.id,
                    name: test.name,
                    created: formatDate(test.created),
                    completed: formatDate(test.completed),
                    status: test.status,
                    hardwareType: test.chipType
                },
                problemMetrics: Array.from(fileMetrics.entries()).map(([file, metrics]) => ({
                    filename: file.split('/').pop(),
                    variables: metrics.variables,
                    clauses: metrics.clauses,
                    ratio: metrics.clauseVarRatio,
                    solved: test.results?.solverMetrics?.solutionFound || false
                })),
                solverMetrics: test.results?.solverMetrics ? {
                    computationTime: test.results.solverMetrics.computationTime,
                    totalSteps: test.results.solverMetrics.totalSteps,
                    restarts: test.results.solverMetrics.restarts,
                    solutionFound: test.results.solverMetrics.solutionFound
                } : null,
                powerMetrics: test.results?.powerUsage ? {
                    averagePower: test.results.powerUsage.mean,
                    peakPower: test.results.powerUsage.max,
                    energyPerSolution: test.results.powerUsage.mean * (test.results.solverMetrics?.computationTime || 0) / 1000000
                } : null,
                resourceUtilization: test.results?.resourceUsage || null
            };

            // Handle different export formats
            switch (format) {
                case 'json':
                    const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    FileSaver.saveAs(jsonBlob, `${test.name}_results.json`);
                    break;
                case 'csv':
                    const csvData = exportData.problemMetrics.map(p => ({
                        ...p,
                        computationTime: exportData.solverMetrics?.computationTime,
                        averagePower: exportData.powerMetrics?.averagePower,
                        energyPerSolution: exportData.powerMetrics?.energyPerSolution
                    }));
                    const csvBlob = new Blob([convertToCSV(csvData)], { type: 'text/csv' });
                    FileSaver.saveAs(csvBlob, `${test.name}_results.csv`);
                    break;
                case 'pdf':
                    // PDF generation is handled by the PDFDownloadLink component
                    break;
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Failed to export data');
        }
    };

    // Filter JSON data based on search query
    const filterJsonData = (data: any, query: string): any => {
        if (!query) return data;
        const lowerQuery = query.toLowerCase();
        
        const filterObject = (obj: any): any | null => {
            if (typeof obj !== 'object' || obj === null) {
                return String(obj).toLowerCase().includes(lowerQuery) ? obj : null;
            }
            
            if (Array.isArray(obj)) {
                const filtered = obj.map(item => filterObject(item)).filter(Boolean);
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-blue-100 p-2">
                                <RiTimeLine className="size-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Duration</p>
                                <p className="font-medium">
                                    {test.completed ? 
                                        formatRuntime(new Date(test.completed).getTime() - new Date(test.created).getTime()) :
                                        'In Progress'}
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
                                <p className="font-medium">{test.results?.inputFiles?.length || 0} files</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h2>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-3">Success Rate</h3>
                                <LineChart
                                    data={performanceData}
                                    index="month"
                                    categories={["success", "failures"]}
                                    colors={["emerald", "red"]}
                                    valueFormatter={(num) => `${num.toFixed(1)}%`}
                                    showYAxis={true}
                                    showLegend={true}
                                    className="h-64"
                                />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-3">Resource Utilization</h3>
                                <CategoryBar
                                    values={[
                                        test.results?.resourceUsage?.cpuUsage?.[0] || 0,
                                        test.results?.resourceUsage?.memoryUsage?.[0] || 0,
                                        test.results?.resourceUsage?.gpuUsage?.[0] || 0,
                                    ]}
                                    colors={["blue", "amber", "emerald"]}
                                />
                                <div className="mt-2 flex justify-between text-xs text-gray-500">
                                    <span>CPU: {test.results?.resourceUsage?.cpuUsage?.[0]?.toFixed(1)}%</span>
                                    <span>Memory: {test.results?.resourceUsage?.memoryUsage?.[0]?.toFixed(1)}%</span>
                                    <span>GPU: {test.results?.resourceUsage?.gpuUsage?.[0]?.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Runtime Analysis</h2>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-3">Runtime Distribution</h3>
                                <LineChart
                                    data={runtimeData}
                                    index="time"
                                    categories={["runtime"]}
                                    colors={["blue"]}
                                    valueFormatter={(num) => `${num.toFixed(2)}ms`}
                                    showYAxis={true}
                                    showLegend={false}
                                    className="h-64"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500">Average Runtime</p>
                                    <p className="text-sm font-medium">
                                        {test.results?.solverMetrics?.computationTime ? 
                                            `${(test.results.solverMetrics.computationTime / 1000).toFixed(2)}ms` : 
                                            'N/A'}
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500">Total Steps</p>
                                    <p className="text-sm font-medium">
                                        {test.results?.solverMetrics?.totalSteps?.toLocaleString() || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

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
                                    onClick={() => handleExport('json')}
                                    className="flex items-center gap-2"
                                >
                                    <RiFileTextLine className="size-4" />
                                    Export JSON
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => handleExport('csv')}
                                    className="flex items-center gap-2"
                                >
                                    <RiFileTextLine className="size-4" />
                                    Export CSV
                                </Button>
                                <PDFDownloadLink
                                    document={
                                        <PDFReport 
                                            test={test} 
                                            fileMetrics={fileMetrics} 
                                            averageMetrics={calculateAverageMetrics()} 
                                        />
                                    }
                                    fileName={`${test.name}_report.pdf`}
                                >
                                    {({ loading }) => (
                                        <Button
                                            variant="secondary"
                                            className="flex items-center gap-2"
                                            disabled={loading}
                                        >
                                            <RiFileTextLine className="size-4" />
                                            {loading ? 'Generating PDF...' : 'Export PDF'}
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
