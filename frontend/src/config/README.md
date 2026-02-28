# Frontend Configuration Guide

This guide explains how to use the centralized API configuration system.

## Files Created:

### 1. `src/config/api.ts`
- **Purpose**: Centralized API configuration
- **Contains**: Base URL, timeouts, default headers
- **Environment handling**: Automatic dev/production switching

### 2. `src/services/httpClient.ts`
- **Purpose**: HTTP client wrapper with error handling
- **Features**: Timeout management, automatic JSON parsing, FormData support
- **Methods**: `get()`, `post()`, `put()`, `delete()`, `uploadFile()`

### 3. Updated `src/services/boatApi.ts`
- **Changes**: Removed hardcoded URL, now uses HttpClient
- **Benefits**: Consistent error handling, centralized configuration

## Usage Examples:

### Basic API Call:
```typescript
import { BoatApiService } from './services';

// Identify boat (uses HttpClient internally)
const result = await BoatApiService.identifyBoat(imageUri);
```

### Custom Service:
```typescript
import { HttpClient } from './services/httpClient';

export class MyService {
  static async getData() {
    return await HttpClient.get('my-endpoint');
  }
}
```

### Configuration Changes:
```typescript
// Edit src/config/api.ts to change URLs:
const getApiConfig = (): ApiConfig => {
  return {
    baseUrl: 'https://my-new-api.com',
    timeout: 60000,
    headers: { ... }
  };
};
```

## Environment Switching:

The system automatically detects development vs production:
- **Development**: `http://localhost:8000`
- **Production**: `https://api.boatid.com`

To add staging environment, edit `Environment` object in `api.ts`.

## Benefits:

1. **Single source of truth** for API configuration
2. **Automatic environment switching**
3. **Consistent error handling** across all services
4. **Timeout management** for all requests
5. **Easy to add new services** using the same pattern
6. **TypeScript support** with full type safety