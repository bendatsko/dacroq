export interface HardwareMetrics {
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

export interface PerformanceMetrics {
    successRate: number;
    solutionCount: number;
    averageRuntime: number;
    runtimeStdDev: number;
    minRuntime: number;
    maxRuntime: number;
    medianRuntime: number;
    runtimePercentiles: number[];
}

export interface ResourceUsage {
    cpuUsage: number[];
    memoryUsage: number[];
    gpuUsage: number[];
    diskIO: number[];
    networkIO: number[];
}

export interface PowerUsage {
    median: number;
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    totalEnergy: number;
}

export interface SystemInfo {
    osVersion: string;
    cpuModel: string;
    cpuCores: number;
    memoryTotal: number;
    gpuModel: string;
    gpuMemory: number;
    diskSpace: number;
    networkSpeed: number;
}

export interface CNFMetrics {
    variables: number;
    clauses: number;
    clauseVarRatio: number;
    avgClauseSize: number;
    maxClauseSize: number;
    minClauseSize: number;
}

export interface BatchStatistics {
    meanLog10TTS: string;
    stdLog10TTS: string;
    medianTTS: string;
    q90TTS: string;
    cdf: {
        ttsValues: string[];
        probabilities: string[];
    };
}

export interface SolverMetrics {
    computationTime: number;
    totalSteps: number;
    restarts: number;
    solutionFound: boolean;
    solutionString: string;
    solverIterations: number;
    hardwareCalls: number;
}

export interface TestRun {
    id: string;
    name: string;
    chipType: string;
    status: string;
    created: any;
    completed?: any;
    runtime?: number;
    solver: string;
    solverParameters: Record<string, any>;
    hardware: string[];
    set: string;
    instanceIdx: number;
    cutoffType: string;
    cutoff: string;
    runsAttempted: number;
    runsSolved: number;
    nUnsatClauses: number[];
    configurations: number[][];
    results?: {
        solverMetrics: SolverMetrics;
        hardwareMetrics: HardwareMetrics;
        performanceMetrics: PerformanceMetrics;
        resourceUsage: ResourceUsage;
        powerUsage: PowerUsage;
        systemInfo: SystemInfo;
        metrics: CNFMetrics;
        batchStatistics: BatchStatistics;
        metadata: {
            problemId: string;
            solutionPresent: boolean;
            isUnsolved: boolean;
            powerMw: number;
            etsNj: number;
            tts: string;
            ttsCiLower: string;
            ttsCiUpper: string;
        };
        inputFiles: string[];
        outputFiles: string[];
        quiccConfig: string;
    };
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