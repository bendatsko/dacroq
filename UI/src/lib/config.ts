// API configuration for the application
export const API_CONFIG = {
  // Base URL for the API endpoints
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.dacroq.net",
  
  // API endpoints
  ENDPOINTS: {
    TESTS: "/tests",
    SERVO: "/servo",
  },
  
  // Get the full URL for an API endpoint
  getUrl: (endpoint: string) => `${API_CONFIG.BASE_URL}${endpoint}`,
};

export default API_CONFIG;
