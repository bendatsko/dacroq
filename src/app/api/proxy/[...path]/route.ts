import { NextRequest, NextResponse } from 'next/server';

// The port where your Flask API is running
const API_BASE_URL = 'https://medusa.bendatsko.com';

export async function GET(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const path = pathname.replace(/^\/api\/proxy\//, '');
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/${path}${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    // Check if response is successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `API returned status ${response.status}` },
        { status: response.status }
      );
    }
    
    // Check content type to ensure we're getting JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // Handle non-JSON responses
      const textData = await response.text();
      console.warn('API returned non-JSON content:', textData.substring(0, 100));
      return new NextResponse(textData, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      });
    }
  } catch (error) {
    console.error(`Error proxying to /${path}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch from API' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api\/proxy\//, '');
  
  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE_URL}/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // Check if response is successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `API returned status ${response.status}` },
        { status: response.status }
      );
    }
    
    // Check content type to ensure we're getting JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // Handle non-JSON responses
      const textData = await response.text();
      console.warn('API returned non-JSON content:', textData.substring(0, 100));
      return new NextResponse(textData, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      });
    }
  } catch (error) {
    console.error(`Error proxying to /${path}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch from API' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api\/proxy\//, '');
  
  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE_URL}/api/${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // Check if response is successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `API returned status ${response.status}` },
        { status: response.status }
      );
    }
    
    // Check content type to ensure we're getting JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // Handle non-JSON responses
      const textData = await response.text();
      console.warn('API returned non-JSON content:', textData.substring(0, 100));
      return new NextResponse(textData, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      });
    }
  } catch (error) {
    console.error(`Error proxying to /${path}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch from API' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api\/proxy\//, '');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/${path}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    
    // Check if response is successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `API returned status ${response.status}` },
        { status: response.status }
      );
    }
    
    // Check content type to ensure we're getting JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // Handle non-JSON responses
      const textData = await response.text();
      console.warn('API returned non-JSON content:', textData.substring(0, 100));
      return new NextResponse(textData, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      });
    }
  } catch (error) {
    console.error(`Error proxying to /${path}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch from API' },
      { status: 500 }
    );
  }
}
