"use client";

import { useState, useEffect } from 'react';
import { api, apiConfig } from '@/lib/api';

interface HealthStatus {
  data: boolean;
  hardware: boolean;
  overall: boolean;
}

export default function ApiHealthCheck() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const healthStatus = await api.getSystemHealth();
      setHealth(healthStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check API health');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">Checking API health...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-500">❌</span>
            <span className="text-sm text-red-700 dark:text-red-300">API Health Check Failed</span>
          </div>
          <button
            onClick={checkHealth}
            className="text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-100 dark:hover:bg-red-800"
          >
            Retry
          </button>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
      </div>
    );
  }

  if (!health) return null;

  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">API Health Status</h3>
        <button
          onClick={checkHealth}
          className="text-xs px-2 py-1 border border-border rounded hover:bg-accent"
        >
          Refresh
        </button>
      </div>
      
      <div className="space-y-2">
        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Overall System</span>
          <div className="flex items-center gap-2">
            <span className={health.overall ? "text-green-500" : "text-red-500"}>
              {health.overall ? "✅" : "❌"}
            </span>
            <span className={`text-xs ${health.overall ? "text-green-600" : "text-red-600"}`}>
              {health.overall ? "Healthy" : "Issues Detected"}
            </span>
          </div>
        </div>

        {/* Data API Status */}
        <div className="flex items-center justify-between pl-4 border-l-2 border-blue-200">
          <span className="text-sm">Data API</span>
          <div className="flex items-center gap-2">
            <span className={health.data ? "text-green-500" : "text-red-500"}>
              {health.data ? "✅" : "❌"}
            </span>
            <span className={`text-xs ${health.data ? "text-green-600" : "text-red-600"}`}>
              {health.data ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* Hardware API Status */}
        <div className="flex items-center justify-between pl-4 border-l-2 border-orange-200">
          <span className="text-sm">Hardware API</span>
          <div className="flex items-center gap-2">
            <span className={health.hardware ? "text-green-500" : "text-red-500"}>
              {health.hardware ? "✅" : "❌"}
            </span>
            <span className={`text-xs ${health.hardware ? "text-green-600" : "text-red-600"}`}>
              {health.hardware ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* API Configuration Info */}
      <details className="mt-4">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          API Configuration
        </summary>
        <div className="mt-2 text-xs space-y-1 pl-4 border-l border-border">
          <div>
            <span className="text-muted-foreground">Base:</span> 
            <code className="ml-2 px-1 py-0.5 bg-muted rounded">{apiConfig.API_BASE}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Data:</span> 
            <code className="ml-2 px-1 py-0.5 bg-muted rounded">{apiConfig.DATA_API_BASE}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Hardware:</span> 
            <code className="ml-2 px-1 py-0.5 bg-muted rounded">{apiConfig.HARDWARE_API_BASE}</code>
          </div>
        </div>
      </details>
    </div>
  );
} 