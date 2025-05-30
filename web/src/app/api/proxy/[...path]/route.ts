import { NextRequest, NextResponse } from 'next/server';

// Auto-detect development vs production
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE = isDevelopment 
  ? "http://localhost:8000" 
  : (process.env.API_URL || "https://api.dacroq.net");

// Extract path from URL to avoid using params.path
function getPathFromURL(req: NextRequest): string {
  // Get the full URL path
  const url = new URL(req.url);
  
  // The pattern will be /api/proxy/ACTUAL_PATH_WE_WANT
  // Split on /api/proxy/ and take everything after it
  const fullPath = url.pathname;
  const parts = fullPath.split('/api/proxy/');
  
  // Return the part after /api/proxy/ or empty string if not found
  const path = parts.length > 1 ? parts[1] : '';
  
  // Preserve query parameters
  const queryString = url.search;
  return path + queryString;
}

// Generic handler for all HTTP methods
async function proxyRequest(req: NextRequest, method: string) {
  try {
    // Extract path from URL instead of using params
    const path = getPathFromURL(req);
    
    console.log(`Proxying ${method} request to: ${path}`);

    // Read body for POST/PUT methods
    let body;
    if (method === 'POST' || method === 'PUT') {
      try {
        body = await req.json();
      } catch (e) {
        body = {};
      }
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE}/${path}`, options);
      clearTimeout(timeoutId);

      // Parse response data
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { 
          status: response.status,
          message: response.ok 
            ? `${method} operation successful` 
            : `${method} operation failed`
        };
      }

      return NextResponse.json(data, {
        status: response.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Re-throw to be caught by outer try/catch
    }
  } catch (error) {
    console.error(`Proxy error for ${method}:`, error);
    
    return NextResponse.json(
      { 
        error: `API request failed: ${error instanceof Error ? error.message : String(error)}`,
        offline: true
      },
      { 
        status: 502, // Bad Gateway
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}

// HTTP method handlers - no params dependency
export async function GET(req: NextRequest) {
  return proxyRequest(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxyRequest(req, 'POST');
}

export async function PUT(req: NextRequest) {
  return proxyRequest(req, 'PUT');
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req, 'DELETE');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
