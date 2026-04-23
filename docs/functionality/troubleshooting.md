---
title: Troubleshooting Guide
description: Common issues, debugging procedures, and problem resolution
---

# Troubleshooting Guide

This guide covers common issues, debugging procedures, and solutions for Cluster Apps development and deployment.

## Quick Diagnostic Checklist

When encountering issues, start with this checklist:

- [ ] Check console for error messages
- [ ] Verify environment variables are set correctly
- [ ] Confirm Node.js version matches `.nvmrc`
- [ ] Check network connectivity to DDC services
- [ ] Verify wallet connection status
- [ ] Review recent code changes
- [ ] Check service status pages

## Development Issues

### Build and Setup Issues

#### Issue: `npm install` fails with permission errors

**Symptoms**:
```bash
npm ERR! code EACCES
npm ERR! syscall open
npm ERR! path /Users/username/.npm/_locks
```

**Solutions**:
```bash
# Option 1: Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Option 2: Use nvm (recommended)
nvm use
npm install

# Option 3: Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Issue: TypeScript compilation errors

**Symptoms**:
```bash
error TS2307: Cannot find module '@cluster-apps/ui'
error TS2304: Cannot find name 'process'
```

**Solutions**:
```bash
# Check TypeScript configuration
npm run check-types

# Rebuild packages
npm run build

# Clear TypeScript cache
rm -rf node_modules/.cache
npx tsc --build --clean
npm run check-types

# Verify path mapping
cat tsconfig.json | grep -A 5 "paths"
```

#### Issue: Vite dev server won't start

**Symptoms**:
```bash
Error: Port 5173 is already in use
Internal server error: Failed to resolve import
```

**Solutions**:
```bash
# Kill process using port
lsof -ti:5173 | xargs kill -9

# Start with different port
npm run start -- --port 5174

# Clear Vite cache
rm -rf node_modules/.vite
npm run start

# Check for conflicting dependencies
npm ls
```

#### Issue: Environment variables not loading

**Symptoms**:
- `undefined` values for environment variables
- Features not working as expected
- API calls failing

**Solutions**:
```bash
# Check environment file exists
ls -la .env*

# Verify VITE_ prefix
grep "VITE_" .env

# Restart development server
npm run start

# Debug environment variables
node -e "console.log(Object.keys(process.env).filter(k => k.startsWith('VITE_')))"
```

### Runtime Issues

#### Issue: DDC connection failures

**Symptoms**:
```javascript
Error: Failed to connect to DDC cluster
Error: Network request failed
Error: DDC_CLUSTER_ID is required
```

**Diagnosis**:
```bash
# Test DDC endpoint connectivity
curl -I $VITE_DDC_STORAGE_NODE_URL/health

# Check environment configuration
echo $VITE_DDC_CLUSTER_ID
echo $VITE_DDC_STORAGE_NODE_URL
```

**Solutions**:
```typescript
// Verify DDC configuration
import { DDC_CLUSTER_ID, DDC_STORAGE_NODE_URL } from './constants';

console.log('DDC Config:', {
  clusterId: DDC_CLUSTER_ID,
  storageUrl: DDC_STORAGE_NODE_URL,
});

// Test DDC client initialization
try {
  const ddcClient = new DdcClient({
    clusterId: DDC_CLUSTER_ID,
    storageNodeUrl: DDC_STORAGE_NODE_URL,
    logLevel: 'debug'
  });
  console.log('DDC client initialized successfully');
} catch (error) {
  console.error('DDC client initialization failed:', error);
}
```

#### Issue: Wallet connection problems

**Symptoms**:
```javascript
Error: Wallet not found
Error: User rejected the request
Error: Network mismatch
```

**Solutions**:
```typescript
// Debug wallet connection
const debugWallet = async () => {
  try {
    // Check if wallet is available
    if (!window.ethereum) {
      console.error('No wallet provider found');
      return;
    }

    // Check network
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log('Current chain ID:', chainId);

    // Test connection
    await wallet.connect();
    console.log('Wallet connected successfully');
  } catch (error) {
    console.error('Wallet connection failed:', error);
  }
};

// Browser-specific issues
if (navigator.userAgent.includes('Chrome')) {
  // Chrome-specific workarounds
}
```

#### Issue: File upload failures

**Symptoms**:
```javascript
Error: File too large
Error: Upload timeout
Error: Insufficient funds
```

**Diagnosis**:
```typescript
const diagnoseUpload = (file: File) => {
  console.log('File diagnosis:', {
    name: file.name,
    size: file.size,
    type: file.type,
    maxSize: MAX_FILE_SIZE,
    hasBalance: account.balance > 0,
  });
};
```

**Solutions**:
```typescript
// File size validation
const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Max size: ${formatBytes(MAX_FILE_SIZE)}`;
  }
  
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return `File type not allowed: ${file.type}`;
  }
  
  return null;
};

// Upload with retry logic
const uploadWithRetry = async (file: File, retries = 3): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      await ddcClient.store(bucketId, file);
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

## Network and Connectivity Issues

### API Connectivity

#### Issue: API calls timing out

**Symptoms**:
- Long loading times
- Request timeout errors
- Intermittent failures

**Diagnosis**:
```bash
# Test API endpoints
curl -w "Time: %{time_total}s\n" -o /dev/null -s $VITE_INDEXER_ENDPOINT
curl -w "Time: %{time_total}s\n" -o /dev/null -s $VITE_FAUCET_ENDPOINT

# Check DNS resolution
nslookup subsquid.devnet.cere.network
```

**Solutions**:
```typescript
// Increase timeout for specific requests
const longTimeoutApi = new ApiClient(baseURL, {
  timeout: 60000, // 60 seconds
});

// Implement exponential backoff
const apiWithRetry = async (url: string, options = {}, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
};
```

### CORS Issues

#### Issue: Cross-origin request blocked

**Symptoms**:
```javascript
Access to fetch at 'https://api.example.com' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solutions**:
```typescript
// Development proxy configuration
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://api.example.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

// Use relative URLs in development
const getApiUrl = (endpoint: string) => {
  if (process.env.NODE_ENV === 'development') {
    return `/api${endpoint}`;
  }
  return `${API_BASE_URL}${endpoint}`;
};
```

## Performance Issues

### Slow Loading

#### Issue: Application takes too long to load

**Diagnosis**:
```bash
# Analyze bundle size
npm run build
ls -lh dist/assets/

# Check for large dependencies
npx webpack-bundle-analyzer dist/assets/*.js
```

**Solutions**:
```typescript
// Implement code splitting
const LazyComponent = lazy(() => import('./HeavyComponent'));

// Use React.memo for expensive components
const ExpensiveComponent = memo(({ data }) => {
  return <ComplexVisualization data={data} />;
});

// Optimize imports
// ❌ Bad - imports entire library
import _ from 'lodash';

// ✅ Good - imports only needed functions
import { debounce } from 'lodash';
```

### Memory Leaks

#### Issue: Memory usage increases over time

**Diagnosis**:
```typescript
// Monitor component lifecycle
useEffect(() => {
  console.log('Component mounted');
  return () => {
    console.log('Component unmounted');
  };
}, []);

// Check for subscription leaks
useEffect(() => {
  const subscription = observable.subscribe(handler);
  return () => subscription.unsubscribe(); // Important!
}, []);
```

**Solutions**:
```typescript
// Proper cleanup in MobX stores
class MyStore {
  private disposers: (() => void)[] = [];

  constructor() {
    // Track disposers
    this.disposers.push(
      reaction(() => this.someValue, () => {
        // Handle reaction
      })
    );
  }

  destroy() {
    this.disposers.forEach(dispose => dispose());
  }
}

// Cleanup in components
const MyComponent = () => {
  useEffect(() => {
    const timer = setInterval(() => {
      // Do something
    }, 1000);

    return () => clearInterval(timer);
  }, []);
};
```

## UI and State Issues

### State Management Problems

#### Issue: Component not updating when store changes

**Symptoms**:
- UI doesn't reflect state changes
- Stale data displayed
- Inconsistent state

**Solutions**:
```typescript
// Ensure component is wrapped with observer
import { observer } from 'mobx-react-lite';

const MyComponent = observer(() => {
  const { myStore } = useStore();
  
  // This will now react to store changes
  return <div>{myStore.data}</div>;
});

// Check observable decorators
class MyStore {
  @observable data = ''; // Ensure @observable is present
  
  @action updateData(newData: string) { // Ensure @action is present
    this.data = newData;
  }
}

// Debug store updates
import { trace } from 'mobx';

const MyComponent = observer(() => {
  trace(); // Add this to see what MobX is tracking
  return <div>{store.value}</div>;
});
```

#### Issue: Form validation not working

**Symptoms**:
- Form submits with invalid data
- Validation errors not showing
- Inconsistent validation behavior

**Solutions**:
```typescript
// Ensure validation schema is correct
const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email required'),
  name: yup.string().min(2, 'Name too short').required('Name required'),
});

// Debug validation
const { control, handleSubmit, formState: { errors } } = useForm({
  resolver: yupResolver(schema),
  mode: 'onChange', // Validate on change
});

// Log validation errors
console.log('Form errors:', errors);

// Ensure proper error display
<TextField
  {...field}
  error={!!fieldState.error}
  helperText={fieldState.error?.message}
/>
```

## Error Tracking and Debugging

### Sentry Integration

#### Issue: Errors not appearing in Sentry

**Diagnosis**:
```typescript
// Test Sentry connection
import * as Sentry from '@sentry/react';

const testSentry = () => {
  console.log('Testing Sentry...');
  Sentry.captureMessage('Test message from development');
  
  try {
    throw new Error('Test error');
  } catch (error) {
    Sentry.captureException(error);
  }
};
```

**Solutions**:
```typescript
// Verify Sentry configuration
const initSentry = () => {
  if (!process.env.VITE_SENTRY_DNS) {
    console.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn: process.env.VITE_SENTRY_DNS,
    environment: process.env.VITE_APP_ENV,
    beforeSend(event) {
      // Filter out development errors
      if (process.env.NODE_ENV === 'development') {
        console.log('Sentry event:', event);
      }
      return event;
    },
  });
};
```

### Debug Logging

#### Effective logging strategies

```typescript
// Structured logging utility
const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
  
  info: (message: string, data?: any) => {
    console.info(`[INFO] ${message}`, data);
  },
  
  error: (message: string, error?: Error, context?: any) => {
    console.error(`[ERROR] ${message}`, { error, context });
    
    // Send to error tracking
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error || new Error(message), {
        extra: context,
      });
    }
  },
};

// DDC operation logging
const ddcLogger = {
  uploadStart: (fileName: string, size: number) => {
    logger.debug('File upload started', { fileName, size });
  },
  
  uploadSuccess: (fileName: string, cid: string) => {
    logger.info('File upload successful', { fileName, cid });
  },
  
  uploadError: (fileName: string, error: Error) => {
    logger.error('File upload failed', error, { fileName });
  },
};
```

## Browser-Specific Issues

### Chrome/Chromium Issues

#### Issue: Wallet connection fails in Chrome

**Solutions**:
```typescript
// Chrome-specific wallet detection
const detectChromeWallet = async () => {
  if (window.chrome && window.chrome.webstore) {
    // Running in Chrome
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for wallet injection
  }
  
  return window.ethereum;
};
```

### Safari Issues

#### Issue: LocalStorage or IndexedDB not working

**Solutions**:
```typescript
// Safari compatibility checks
const checkStorageSupport = () => {
  try {
    const test = 'test';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.warn('LocalStorage not available, using fallback');
    return false;
  }
};

// Fallback storage implementation
const storage = {
  getItem: (key: string) => {
    if (checkStorageSupport()) {
      return localStorage.getItem(key);
    }
    // Use in-memory storage or cookie fallback
    return memoryStorage[key] || null;
  },
  
  setItem: (key: string, value: string) => {
    if (checkStorageSupport()) {
      localStorage.setItem(key, value);
    } else {
      memoryStorage[key] = value;
    }
  },
};
```

## Mobile Issues

### Responsive Design Problems

#### Issue: Layout broken on mobile devices

**Solutions**:
```typescript
// Mobile detection and adaptation
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

// Responsive component design
const ResponsiveComponent = () => {
  const isMobile = useIsMobile();
  
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: 2,
    }}>
      {/* Content */}
    </Box>
  );
};
```

## Production Issues

### Deployment Problems

#### Issue: Application not loading after deployment

**Diagnosis**:
```bash
# Check deployment status
curl -I https://cluster-apps-prod.cere.network

# Check for 404s on assets
curl -I https://cluster-apps-prod.cere.network/assets/index.js

# Check CloudFront cache
aws cloudfront get-distribution --id DISTRIBUTION_ID
```

**Solutions**:
```bash
# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"

# Check S3 bucket contents
aws s3 ls s3://cluster-apps-prod.cere.network --recursive

# Verify HTML file
curl https://cluster-apps-prod.cere.network/index.html
```

### Performance in Production

#### Issue: Slow performance in production

**Diagnosis**:
```bash
# Check bundle size
du -h dist/assets/*

# Analyze network timing
curl -w "@curl-format.txt" -o /dev/null -s https://cluster-apps-prod.cere.network
```

**Solutions**:
```typescript
// Production-specific optimizations
if (process.env.NODE_ENV === 'production') {
  // Disable console logs
  console.log = () => {};
  console.debug = () => {};
  
  // Enable service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}
```

## Debugging Tools and Techniques

### Browser DevTools

#### Console Debugging

```typescript
// Debug store state
const debugStore = () => {
  console.log('Current store state:', {
    account: accountStore.toJSON(),
    buckets: bucketStore.buckets.map(b => ({ id: b.id, name: b.name })),
    app: { loading: appStore.loading, error: appStore.error },
  });
};

// Debug component props
const MyComponent = (props) => {
  console.log('Component props:', props);
  return <div>...</div>;
};
```

#### Network Tab Analysis

1. **Check request timing**: Look for slow API calls
2. **Verify response status**: Check for 4xx/5xx errors
3. **Inspect headers**: Verify CORS and caching headers
4. **Monitor payload size**: Check for large responses

### React DevTools

#### Component Tree Analysis

1. **Select component**: View props and state
2. **Track updates**: See what causes re-renders
3. **Profile performance**: Identify expensive renders

### MobX DevTools

#### State Management Debugging

1. **Track actions**: See when and why state changes
2. **Monitor observables**: View observable value changes
3. **Analyze reactions**: Debug computed values and reactions

## Getting Help

### Internal Resources

1. **Documentation**: Check relevant docs sections
2. **Code Comments**: Review inline documentation
3. **Git History**: Check recent changes and commit messages
4. **Team Knowledge**: Ask team members familiar with the codebase

### External Resources

1. **GitHub Issues**: Search for similar problems
2. **Stack Overflow**: Community solutions
3. **Official Documentation**: Framework and library docs
4. **Discord Community**: Real-time help

### Creating Support Requests

When asking for help, include:

1. **Problem Description**: Clear description of the issue
2. **Steps to Reproduce**: Exact steps that cause the problem
3. **Expected vs Actual**: What should happen vs what happens
4. **Environment Info**: Browser, OS, Node.js version
5. **Error Messages**: Full error messages and stack traces
6. **Screenshots**: Visual representation of the problem

```bash
# Gather environment info
node --version
npm --version
git rev-parse HEAD
echo $VITE_APP_ENV
```

### Emergency Procedures

For critical production issues:

1. **Immediate Response**: Alert team via designated channels
2. **Incident Assessment**: Determine severity and impact
3. **Quick Fix**: Implement hotfix if possible
4. **Rollback**: Revert to previous working version if needed
5. **Post-Mortem**: Analyze root cause and prevent recurrence

See [Development Guide](../development/guide.md) for development best practices and [Deployment Guide](deployment.md) for deployment troubleshooting. 