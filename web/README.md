# Dacroq Web Frontend

React/Next.js frontend for the Dacroq platform.

## API Architecture

The frontend now uses a separated API architecture:

### Data API (`/api/data/*`)
- **Purpose**: Database operations, authentication, user management
- **Server**: Data API server (port 8001)
- **Routes**: Handled by nginx routing to `localhost:8001`
- **Endpoints**: 
  - `/api/data/auth/google` - Authentication
  - `/api/data/users/*` - User management  
  - `/api/data/tests/*` - Test results and metadata
  - `/api/data/ldpc/jobs/*` - LDPC job management
  - `/api/data/sat/tests/*` - SAT test results
  - `/api/data/health` - Data API health check

### Hardware API (`/api/hardware/*`)
- **Purpose**: Physical hardware operations and control
- **Server**: Lab server (port 8000)
- **Routes**: Handled by nginx routing to `lab-server:8000`
- **Endpoints**:
  - `/api/hardware/status` - Hardware status
  - `/api/hardware/discover` - Device discovery
  - `/api/hardware/reset/*` - Hardware reset control
  - `/api/hardware/firmware/*` - Firmware management
  - `/api/hardware/ldpc/command` - LDPC hardware commands
  - `/api/hardware/sat/command` - SAT hardware commands
  - `/api/hardware/health` - Hardware API health check

## Usage

### New API Library

Use the new centralized API library:

```typescript
import { api, dataApi, hardwareApi } from '@/lib/api';

// Data operations (authentication, user management, test results)
const user = await dataApi.auth.google(token);
const tests = await dataApi.tests.list();
const ldpcJobs = await dataApi.ldpc.jobs.list();

// Hardware operations (device control, firmware, live commands) 
const hwStatus = await hardwareApi.status();
const discovery = await hardwareApi.discover();
const resetResult = await hardwareApi.reset.device('ldpc');

// Health checks
const systemHealth = await api.getSystemHealth();
```

### Authentication

Authentication continues to work the same way but now routes to the Data API:

```typescript
import { auth } from '@/lib/auth';

const user = await auth.signInWithGooglePopup();
```

### Migration from Old API Calls

Replace direct fetch calls with the new API methods:

```typescript
// OLD - Direct fetch
const response = await fetch('/api/tests');

// NEW - Using dataApi
const tests = await dataApi.tests.list();

// OLD - Hardware commands  
const response = await fetch('/api/ldpc/command', { method: 'POST', body: JSON.stringify({command}) });

// NEW - Using hardwareApi
const result = await hardwareApi.ldpc.command(command);
```

## Environment Variables

Make sure you have the correct API base URL configured:

```bash
NEXT_PUBLIC_API_BASE_URL=https://dacroq.eecs.umich.edu
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

## Development

```bash
npm run dev
```

The frontend will run on port 3000 and proxy API requests through nginx routing.

## Architecture Benefits

1. **Separation of Concerns**: Database operations separate from hardware control
2. **Better Performance**: Data API can be optimized for database queries, Hardware API for real-time control
3. **Reliability**: Database operations don't block on hardware availability
4. **Security**: Fine-grained control over what operations require hardware access
5. **Scalability**: Can independently scale or move each API service

## Debugging

Use the browser console to see API routing:

```javascript
// Check API configuration
import { apiConfig } from '@/lib/api';
console.log(apiConfig);

// Test health endpoints
import { api } from '@/lib/api';
api.getSystemHealth().then(console.log);
``` 