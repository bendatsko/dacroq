// API configuration for the application
export const API_CONFIG = {
  // Base URL for the API endpoints
  BASE_URL: "https://dacroq-api.bendatsko.com",
  
  // API endpoints
  ENDPOINTS: {
    TESTS: "/api/tests",
    SERVO: "/api/servo",
  },
  
  // Get the full URL for an API endpoint
  getUrl: (endpoint: string) => `${API_CONFIG.BASE_URL}${endpoint}`,
};

export default API_CONFIG;
