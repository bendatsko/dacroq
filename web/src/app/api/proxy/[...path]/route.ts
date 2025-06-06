// app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.HARDWARE_API_URL || 'http://localhost:8000';

// Extended timeout for hardware operations
const TIMEOUTS = {
  default: 10000,      // 10 seconds for most operations
  hardware: 120000,    // 2 minutes for hardware tests
  ldpcJobs: 300000,    // 5 minutes for LDPC jobs
};

async function proxyRequest(
  request: NextRequest,
  method: string,
  params: { path: string[] }
) {
  try {
    const path = params.path.join('/');
    console.log(`Proxying ${method} request to: ${path}`);

    // Determine timeout based on path
    let timeout = TIMEOUTS.default;
    if (path.includes('ldpc/jobs') && method === 'POST') {
      timeout = TIMEOUTS.ldpcJobs;
    } else if (path.includes('ldpc/command') || path.includes('ldpc/deploy')) {
      timeout = TIMEOUTS.hardware;
    }

    // Build options for the fetch request
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Handle request body
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const body = await request.json();
        options.body = JSON.stringify(body);
      } catch (e) {
        // No JSON body
      }
    }

    // Set up timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(`${API_BASE}/${path}`, options);
      clearTimeout(timeoutId);

      // Parse response data
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return NextResponse.json(data, { 
        status: response.status,
        headers: {
          'Content-Type': contentType || 'application/json',
        }
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error(`Request to ${path} timed out after ${timeout}ms`);
        return NextResponse.json(
          { 
            error: 'Request timed out. This may be normal for long-running hardware tests. Please check the dashboard for results.',
            timeout: timeout 
          },
          { status: 504 } // Gateway Timeout
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error(`Proxy error for ${method}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal proxy error' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'GET', params);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'POST', params);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'PUT', params);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'DELETE', params);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}