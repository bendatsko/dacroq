/**
 * API utility for Dacroq platform
 * Handles routing between Data API (database/auth) and Hardware API (lab server)
 */

// API Configuration
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const DATA_API_BASE = `${API_BASE}/api/data`;  // nginx routes to :8001
const HARDWARE_API_BASE = `${API_BASE}/api/hardware`;  // nginx routes to lab-server:8000

interface APIRequestOptions extends RequestInit {
  requireAuth?: boolean;
  timeout?: number;
}

/**
 * Enhanced fetch with error handling, authentication, and timeout
 */
async function apiRequest(url: string, options: APIRequestOptions = {}): Promise<any> {
  const { requireAuth = false, timeout = 15000, ...fetchOptions } = options;
  
  // Add authentication header if required
  if (requireAuth) {
    const user = getCurrentAuthUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': `Bearer ${user.id}`,
    };
  }
  
  // Add Content-Type for POST/PUT requests with body
  if (fetchOptions.body) {
    const headers = fetchOptions.headers as Record<string, string> || {};
    if (!headers['Content-Type']) {
      fetchOptions.headers = {
        ...headers,
        'Content-Type': 'application/json',
      };
    }
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch {
        error = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }
    
    // Handle empty responses
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
    
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// Helper to get current authenticated user (needs to be implemented by auth system)
function getCurrentAuthUser() {
  // This will be implemented to get current user from auth system
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
}

// =============================================================================
// DATA API ENDPOINTS (Database operations, authentication, user management)
// =============================================================================

export const dataApi = {
  // Authentication
  auth: {
    google: (token: string) => 
      apiRequest(`${DATA_API_BASE}/auth/google`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  },
  
  // User management
  users: {
    list: () => 
      apiRequest(`${DATA_API_BASE}/users`, { requireAuth: true }),
      
    get: (userId: string) => 
      apiRequest(`${DATA_API_BASE}/users/${userId}`, { requireAuth: true }),
      
    update: (userId: string, data: any) => 
      apiRequest(`${DATA_API_BASE}/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        requireAuth: true,
      }),
      
    delete: (userId: string) => 
      apiRequest(`${DATA_API_BASE}/users/${userId}`, {
        method: 'DELETE',
        requireAuth: true,
      }),
      
    stats: () => 
      apiRequest(`${DATA_API_BASE}/users/stats`, { requireAuth: true }),
  },
  
  // Tests and results
  tests: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiRequest(`${DATA_API_BASE}/tests${query}`, { requireAuth: true });
    },
    
    create: (testData: any) => 
      apiRequest(`${DATA_API_BASE}/tests`, {
        method: 'POST',
        body: JSON.stringify(testData),
        requireAuth: true,
      }),
      
    get: (testId: string) => 
      apiRequest(`${DATA_API_BASE}/tests/${testId}`, { requireAuth: true }),
      
    delete: (testId: string) => 
      apiRequest(`${DATA_API_BASE}/tests/${testId}`, {
        method: 'DELETE',
        requireAuth: true,
      }),
  },
  
  // LDPC jobs
  ldpc: {
    jobs: {
      list: () => 
        apiRequest(`${DATA_API_BASE}/ldpc/jobs`, { requireAuth: true }),
        
      create: (jobData: any) => 
        apiRequest(`${DATA_API_BASE}/ldpc/jobs`, {
          method: 'POST',
          body: JSON.stringify(jobData),
          requireAuth: true,
        }),
        
      get: (jobId: string) => 
        apiRequest(`${DATA_API_BASE}/ldpc/jobs/${jobId}`, { requireAuth: true }),
        
      delete: (jobId: string) => 
        apiRequest(`${DATA_API_BASE}/ldpc/jobs/${jobId}`, {
          method: 'DELETE',
          requireAuth: true,
        }),
    },
    
    testSummaries: () => 
      apiRequest(`${DATA_API_BASE}/ldpc/test-summaries`, { requireAuth: true }),
  },
  
  // SAT solver results
  sat: {
    tests: {
      list: () => 
        apiRequest(`${DATA_API_BASE}/sat/tests`, { requireAuth: true }),
        
      get: (testId: string) => 
        apiRequest(`${DATA_API_BASE}/sat/tests/${testId}`, { requireAuth: true }),
        
      solve: (problemData: any) => 
        apiRequest(`${DATA_API_BASE}/sat/solve`, {
          method: 'POST',
          body: JSON.stringify(problemData),
          requireAuth: true,
        }),
    },
    
    testSummaries: () => 
      apiRequest(`${DATA_API_BASE}/sat/test-summaries`, { requireAuth: true }),
  },
  
  // System settings and announcements
  system: {
    settings: {
      update: (settings: Record<string, any>) => 
        apiRequest(`${DATA_API_BASE}/system/settings`, {
          method: 'POST',
          body: JSON.stringify(settings),
          requireAuth: true,
        }),
    },
    
    announcements: {
      list: () => 
        apiRequest(`${DATA_API_BASE}/announcements`),
        
      create: (announcement: any) => 
        apiRequest(`${DATA_API_BASE}/announcements`, {
          method: 'POST',
          body: JSON.stringify(announcement),
          requireAuth: true,
        }),
    },
  },
  
  // Health check
  health: () => 
    apiRequest(`${DATA_API_BASE}/health`),
};

// =============================================================================
// HARDWARE API ENDPOINTS (Physical hardware operations on lab server)
// =============================================================================

export const hardwareApi = {
  // Hardware status and discovery
  status: () => 
    apiRequest(`${HARDWARE_API_BASE}/status`, { requireAuth: true }),
    
  discover: () => 
    apiRequest(`${HARDWARE_API_BASE}/discover`, {
      method: 'POST',
      requireAuth: true,
    }),
    
  devices: () => 
    apiRequest(`${HARDWARE_API_BASE}/devices`, { requireAuth: true }),
  
  // Hardware reset control
  reset: {
    device: (deviceType: string) => 
      apiRequest(`${HARDWARE_API_BASE}/reset/${deviceType}`, {
        method: 'POST',
        requireAuth: true,
      }),
      
    all: () => 
      apiRequest(`${HARDWARE_API_BASE}/reset/all`, {
        method: 'POST',
        requireAuth: true,
      }),
  },
  
  // GPIO status
  gpio: {
    status: () => 
      apiRequest(`${HARDWARE_API_BASE}/gpio/status`, { requireAuth: true }),
  },
  
  // Firmware management
  firmware: {
    status: () => 
      apiRequest(`${HARDWARE_API_BASE}/firmware/status`, { requireAuth: true }),
      
    build: (deviceType: string) => 
      apiRequest(`${HARDWARE_API_BASE}/firmware/build/${deviceType}`, {
        method: 'POST',
        requireAuth: true,
      }),
      
    upload: (deviceType: string, port?: string) => 
      apiRequest(`${HARDWARE_API_BASE}/firmware/upload/${deviceType}`, {
        method: 'POST',
        body: JSON.stringify({ port }),
        requireAuth: true,
      }),
      
    flash: (deviceType: string, options?: { port?: string; build?: boolean }) => 
      apiRequest(`${HARDWARE_API_BASE}/firmware/flash/${deviceType}`, {
        method: 'POST',
        body: JSON.stringify(options || {}),
        requireAuth: true,
      }),
  },
  
  // LDPC hardware operations
  ldpc: {
    deploy: (batchConfig: any) => 
      apiRequest(`${HARDWARE_API_BASE}/ldpc/deploy`, {
        method: 'POST',
        body: JSON.stringify(batchConfig),
        requireAuth: true,
      }),
      
    command: (command: string) => 
      apiRequest(`${HARDWARE_API_BASE}/ldpc/command`, {
        method: 'POST',
        body: JSON.stringify({ command }),
        requireAuth: true,
      }),
      
    serialHistory: () => 
      apiRequest(`${HARDWARE_API_BASE}/ldpc/serial-history`, { requireAuth: true }),
  },
  
  // SAT hardware operations
  sat: {
    command: (command: string) => 
      apiRequest(`${HARDWARE_API_BASE}/sat/command`, {
        method: 'POST',
        body: JSON.stringify({ command }),
        requireAuth: true,
      }),
      
    serialHistory: () => 
      apiRequest(`${HARDWARE_API_BASE}/sat/serial-history`, { requireAuth: true }),
  },
  
  // Session management
  sessionBreak: (text?: string) => 
    apiRequest(`${HARDWARE_API_BASE}/session-break`, {
      method: 'POST',
      body: JSON.stringify({ text: text || 'SESSION BREAK' }),
      requireAuth: true,
    }),
  
  // Health check
  health: () => 
    apiRequest(`${HARDWARE_API_BASE}/health`),
};

// =============================================================================
// UNIFIED API FOR BACKWARD COMPATIBILITY
// =============================================================================

export const api = {
  // Combine both APIs
  data: dataApi,
  hardware: hardwareApi,
  
  // Helper methods
  isDataApiHealthy: async () => {
    try {
      await dataApi.health();
      return true;
    } catch {
      return false;
    }
  },
  
  isHardwareApiHealthy: async () => {
    try {
      await hardwareApi.health();
      return true;
    } catch {
      return false;
    }
  },
  
  // Get overall system health
  getSystemHealth: async () => {
    const [dataHealthy, hardwareHealthy] = await Promise.all([
      api.isDataApiHealthy(),
      api.isHardwareApiHealthy(),
    ]);
    
    return {
      data: dataHealthy,
      hardware: hardwareHealthy,
      overall: dataHealthy && hardwareHealthy,
    };
  },
};

export default api;

// Export configuration for debugging
export const apiConfig = {
  API_BASE,
  DATA_API_BASE,
  HARDWARE_API_BASE,
}; 