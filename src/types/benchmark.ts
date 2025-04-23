export interface SATBenchmark {
  // Problem metadata
  problem: {
    id: string;
    name: string;
    source: string;
    variables: number;
    clauses: number;
    category: string;
    tags: string[];
  };

  // Solver configuration
  solver: {
    name: string;
    version: string;
    parameters: Record<string, any>;
    mode: 'hardware-only' | 'hardware-refinement' | 'software';
  };

  // Results
  results: {
    status: 'SAT' | 'UNSAT' | 'UNKNOWN' | 'TIMEOUT' | 'ERROR';
    solution?: {
      assignment: number[];
      verified: boolean;
      verification_time_ms: number;
    };
    statistics: {
      runtime_ms: number;
      cpu_time_ms: number;
      hardware_time_ms: number;
      energy_joules: number;
      cpu_energy_joules: number;
      hardware_energy_joules: number;
      iterations: number;
      hardware_calls: number;
      conflicts: number;
      decisions: number;
      propagations: number;
      restarts: number;
    };
    error?: string;
  };

  // Performance metrics
  performance: {
    success_rate: number;
    average_runtime_ms: number;
    median_runtime_ms: number;
    min_runtime_ms: number;
    max_runtime_ms: number;
    energy_efficiency: number; // Solutions per joule
    hardware_efficiency: number; // Solutions per hardware call
  };

  // Resource usage
  resources: {
    memory_mb: number;
    cpu_usage_percent: number;
    hardware_utilization: number;
  };

  // Validation
  validation: {
    verified: boolean;
    verification_time_ms: number;
    unsatisfied_clauses: number[];
    error?: string;
  };

  // Metadata
  metadata: {
    timestamp: string;
    environment: {
      os: string;
      cpu: string;
      memory: string;
      hardware_version: string;
    };
    benchmark_version: string;
  };
} 