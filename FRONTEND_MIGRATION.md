# Frontend Migration Guide

This guide helps migrate the Dacroq frontend to use the new separated API architecture.

## Quick Migration Checklist

- [x] ✅ Updated `auth.ts` to use `/api/data` routes
- [x] ✅ Created new `api.ts` utility for centralized API calls
- [x] ✅ Updated README with new architecture documentation
- [x] ✅ Created `ApiHealthCheck` component for testing
- [ ] 🔄 Update any remaining components with hardcoded API calls
- [ ] 🔄 Test authentication flow
- [ ] 🔄 Test data operations (tests, users, jobs)
- [ ] 🔄 Test hardware operations (when hardware API is ready)

## Changes Made

### 1. Auth Library (`src/lib/auth.ts`)
- Changed `API_BASE` to use `DATA_API_BASE` for auth endpoints
- All user management calls now route to `/api/data/*`
- Added debug logging for API URLs
- Added hardware API helper methods

### 2. New API Library (`src/lib/api.ts`)
- Centralized API client with proper error handling
- Separated `dataApi` and `hardwareApi` endpoints
- Enhanced fetch wrapper with authentication and timeout
- Type-safe API calls
- Health check utilities

### 3. Health Check Component (`src/components/ApiHealthCheck.tsx`)
- Real-time API health monitoring
- Visual status indicators for both APIs
- Configuration display for debugging
- Manual refresh capability

## Migration Steps for Existing Components

### Step 1: Replace Direct Fetch Calls

**Before:**
```typescript
// OLD - Direct fetch calls
const response = await fetch('/api/tests');
const data = await response.json();

const response2 = await fetch('/api/ldpc/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: 'STATUS' })
});
```

**After:**
```typescript
// NEW - Using centralized API
import { dataApi, hardwareApi } from '@/lib/api';

const tests = await dataApi.tests.list();
const result = await hardwareApi.ldpc.command('STATUS');
```

### Step 2: Update Authentication Usage

Authentication continues to work the same way, but now properly routes through the Data API:

```typescript
import { auth } from '@/lib/auth';

// This now automatically uses /api/data/auth/google
const user = await auth.signInWithGooglePopup();
```

### Step 3: Use the New API Structure

**Data Operations (Database, Auth, Users):**
```typescript
import { dataApi } from '@/lib/api';

// Authentication
const user = await dataApi.auth.google(token);

// User management
const users = await dataApi.users.list();
await dataApi.users.update(userId, { role: 'admin' });

// Test management
const tests = await dataApi.tests.list({ chip_type: 'LDPC' });
const test = await dataApi.tests.create(testData);

// LDPC jobs
const jobs = await dataApi.ldpc.jobs.list();
const job = await dataApi.ldpc.jobs.create(jobConfig);

// SAT operations
const satTests = await dataApi.sat.tests.list();
await dataApi.sat.tests.solve(problemData);
```

**Hardware Operations (Device Control, Firmware):**
```typescript
import { hardwareApi } from '@/lib/api';

// Hardware status
const status = await hardwareApi.status();
const devices = await hardwareApi.devices();

// Device discovery
await hardwareApi.discover();

// Hardware reset
await hardwareApi.reset.device('ldpc');
await hardwareApi.reset.all();

// Firmware management
await hardwareApi.firmware.build('ldpc');
await hardwareApi.firmware.upload('ldpc', '/dev/ttyACM0');
await hardwareApi.firmware.flash('ldpc');

// Live hardware commands
const result = await hardwareApi.ldpc.command('STATUS');
const history = await hardwareApi.ldpc.serialHistory();
```

### Step 4: Add Health Checks

Add the health check component to your admin or debug pages:

```typescript
import ApiHealthCheck from '@/components/ApiHealthCheck';

export default function AdminPage() {
  return (
    <div>
      {/* Other admin content */}
      <ApiHealthCheck />
    </div>
  );
}
```

## Common Patterns to Update

### 1. Test Results Display
```typescript
// OLD
const response = await fetch(`/api/tests/${testId}`);
const test = await response.json();

// NEW
const test = await dataApi.tests.get(testId);
```

### 2. Hardware Commands
```typescript
// OLD
const response = await fetch('/api/ldpc/command', {
  method: 'POST',
  body: JSON.stringify({ command: cmd })
});

// NEW
const result = await hardwareApi.ldpc.command(cmd);
```

### 3. User Management
```typescript
// OLD
const response = await fetch('/api/users', {
  headers: { 'Authorization': `Bearer ${userId}` }
});

// NEW
const users = await dataApi.users.list(); // Auth handled automatically
```

## Environment Variables

Ensure these are set correctly:

```bash
# Required
NEXT_PUBLIC_API_BASE_URL=https://dacroq.eecs.umich.edu
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Optional for development
NEXT_PUBLIC_API_TIMEOUT=10000
```

## Testing the Migration

1. **Check API Configuration:**
   ```javascript
   import { apiConfig } from '@/lib/api';
   console.log('API Config:', apiConfig);
   ```

2. **Test Health Endpoints:**
   ```javascript
   import { api } from '@/lib/api';
   api.getSystemHealth().then(console.log);
   ```

3. **Test Authentication:**
   ```javascript
   import { auth } from '@/lib/auth';
   // Try signing in - should route to /api/data/auth/google
   ```

4. **Test Data Operations:**
   ```javascript
   import { dataApi } from '@/lib/api';
   dataApi.tests.list().then(console.log);
   ```

5. **Test Hardware Operations (when available):**
   ```javascript
   import { hardwareApi } from '@/lib/api';
   hardwareApi.status().then(console.log);
   ```

## Common Issues and Solutions

### Issue: API calls returning 404
**Solution:** Check that nginx routing is configured correctly and the respective API servers are running.

### Issue: Authentication not working
**Solution:** Verify that the Data API is running on port 8001 and accessible via `/api/data/auth/google`.

### Issue: Hardware commands timing out
**Solution:** Check that the Hardware API server is running on the lab server and accessible via `/api/hardware/*`.

### Issue: CORS errors
**Solution:** Ensure nginx is properly configured to handle CORS for both API routes.

## Rollback Plan

If issues arise, you can temporarily revert by:

1. Changing `auth.ts` back to use the original `API_BASE`
2. Updating any new components to use direct fetch calls
3. Disabling the new `api.ts` imports

However, the new architecture provides better separation of concerns and should be the preferred approach.

## Next Steps

1. Test the migration thoroughly in development
2. Update any remaining components to use the new API structure
3. Add hardware API testing once the hardware server is ready
4. Consider adding API caching for better performance
5. Add proper error boundaries for API failures 