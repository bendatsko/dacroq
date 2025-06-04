// lib/test-labels.ts

import {
  RiCheckLine,
  RiTimeLine,
  RiCloseLine,
  RiLoader4Line
} from "@remixicon/react";

export function generateTestLabel(test: any): string {
  const { chipType, results, config } = test;
  
  if (chipType === "LDPC") {
    // LDPC test label
    const parts = [];
    
    // Algorithm type
    if (results?.algorithm_type) {
      parts.push(results.algorithm_type === "analog_hardware" ? "Analog HW" : "Digital BP");
    }
    
    // SNR range or single SNR
    if (config?.start_snr && config?.end_snr) {
      if (config.start_snr === config.end_snr) {
        parts.push(`${config.start_snr}dB`);
      } else {
        parts.push(`${config.start_snr}-${config.end_snr}dB`);
      }
    } else if (config?.snr_db) {
      parts.push(`${config.snr_db}dB`);
    } else if (results?.noise_level !== undefined) {
      parts.push(`${results.noise_level}dB`);
    }
    
    // Test mode
    if (results?.test_mode) {
      const modeMap: Record<string, string> = {
        "custom_message": "Custom",
        "random_string": "Random",
        "ber_test": "BER",
        "pre_written": "Preset"
      };
      parts.push(modeMap[results.test_mode] || results.test_mode);
    }
    
    // Runs and vectors
    if (config?.runs_per_snr) {
      const vectorsPerRun = config.vectors_per_run || 76800;
      if (config.runs_per_snr === 1) {
        parts.push(`${vectorsPerRun.toLocaleString()} vectors`);
      } else {
        parts.push(`${config.runs_per_snr}×${vectorsPerRun.toLocaleString()}`);
      }
    }
    
    // Code parameters
    if (config?.code_parameters) {
      const { n, k } = config.code_parameters;
      parts.push(`(${n},${k})`);
    } else {
      parts.push("(96,48)"); // Default LDPC code
    }
    
    return parts.length > 0 ? parts.join(" • ") : "LDPC Test";
    
  } else if (chipType === "3SAT" || chipType === "KSAT") {
    // SAT test label
    const parts = [];
    
    // Solver type
    if (config?.solver_type) {
      const solverMap: Record<string, string> = {
        "minisat": "MiniSAT",
        "walksat": "WalkSAT", 
        "daedalus": "Daedalus HW"
      };
      parts.push(solverMap[config.solver_type] || config.solver_type.toUpperCase());
    }
    
    // Problem size
    if (config?.num_variables && config?.num_clauses) {
      parts.push(`${config.num_variables}v/${config.num_clauses}c`);
    }
    
    // Satisfiability result
    if (results?.satisfiable !== undefined) {
      parts.push(results.satisfiable ? "SAT" : "UNSAT");
    }
    
    // Test type
    parts.push(chipType);
    
    return parts.length > 0 ? parts.join(" • ") : `${chipType} Test`;
  }
  
  return test.testType || test.name || "Test";
}

export function generateTestDescription(test: any): string {
  const { chipType, results, config } = test;
  
  if (chipType === "LDPC") {
    const parts = [];
    
    // Performance metrics
    if (results?.convergence_rate !== undefined) {
      parts.push(`${(results.convergence_rate * 100).toFixed(1)}% convergence`);
    } else if (results?.success_rate !== undefined) {
      parts.push(`${(results.success_rate * 100).toFixed(1)}% success`);
    }
    
    // Error rates
    if (results?.bit_error_rate !== undefined) {
      parts.push(`BER: ${results.bit_error_rate.toExponential(2)}`);
    }
    
    if (results?.frame_error_rate !== undefined) {
      parts.push(`FER: ${results.frame_error_rate.toExponential(2)}`);
    }
    
    // Timing and energy
    if (results?.avg_execution_time_us !== undefined) {
      if (results.avg_execution_time_us < 1000) {
        parts.push(`${results.avg_execution_time_us.toFixed(1)}μs`);
      } else {
        parts.push(`${(results.avg_execution_time_us / 1000).toFixed(1)}ms`);
      }
    }
    
    if (results?.energy_efficiency_pj_per_bit !== undefined) {
      parts.push(`${results.energy_efficiency_pj_per_bit.toFixed(1)}pJ/bit`);
    }
    
    // Throughput
    if (results?.throughput_mbps !== undefined) {
      parts.push(`${results.throughput_mbps.toFixed(1)}Mbps`);
    }
    
    return parts.join(" • ");
    
  } else if (chipType === "3SAT" || chipType === "KSAT") {
    const parts = [];
    
    // Solve time
    if (results?.solve_time_ms !== undefined) {
      if (results.solve_time_ms < 1) {
        parts.push(`${(results.solve_time_ms * 1000).toFixed(0)}μs`);
      } else {
        parts.push(`${results.solve_time_ms.toFixed(1)}ms`);
      }
    }
    
    // Energy
    if (results?.total_energy_nj !== undefined) {
      parts.push(`${results.total_energy_nj.toFixed(1)}nJ`);
    }
    
    // Energy per variable
    if (results?.energy_per_variable_pj !== undefined) {
      parts.push(`${results.energy_per_variable_pj.toFixed(1)}pJ/var`);
    }
    
    // Power
    if (results?.power_consumption_mw !== undefined) {
      parts.push(`${results.power_consumption_mw.toFixed(1)}mW`);
    }
    
    return parts.join(" • ");
  }
  
  return "";
}

export function getTestStatusInfo(test: any) {
  const { status, results } = test;
  
  const statusConfig = {
    completed: {
      variant: "default",
      iconName: "check",
      color: "text-green-500",
      bg: "bg-green-500/10",
      label: "Completed"
    },
    running: {
      variant: "secondary",
      iconName: "loader",
      color: "text-blue-500", 
      bg: "bg-blue-500/10",
      label: "Running"
    },
    failed: {
      variant: "destructive",
      iconName: "close",
      color: "text-red-500",
      bg: "bg-red-500/10", 
      label: "Failed"
    },
    error: {
      variant: "destructive",
      iconName: "close",
      color: "text-red-500",
      bg: "bg-red-500/10", 
      label: "Error"
    },
    queued: {
      variant: "outline",
      iconName: "time",
      color: "text-gray-500",
      bg: "bg-gray-500/10",
      label: "Queued"
    }
  } as const;
  
  return statusConfig[status as keyof typeof statusConfig] || statusConfig.completed;
}

export function formatTestCreatedDate(dateString: string, currentTime?: Date): string {
  const date = new Date(dateString);
  const now = currentTime || new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric", 
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    });
  }
} 