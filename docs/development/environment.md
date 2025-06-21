---
title: Environment Configuration
description: Environment variables, DDC network settings, and deployment environments
---

# Environment Configuration

This document covers all environment variables, DDC network configurations, feature flags, and deployment environment settings for Cluster Apps.

## Environment Files

The project uses Vite environment variables with different configuration files for each environment:

| File | Purpose | Usage |
|------|---------|-------|
| `.env.dev` | Development environment | Local development |
| `.env.stage` | Staging environment | Pre-production testing |
| `.env.prod` | Production environment | Live production |
| `.env` | Local overrides | Git-ignored local config |

### Setup

```bash
# Copy development environment template
cp .env.dev .env

# Edit local configuration
vim .env
```

## Core Environment Variables

### Application Configuration

```bash
# Application Identity
VITE_APP_ID=developer-console                    # Application identifier
VITE_NODE_PROVIDER_APP_ID=node-provider         # Node provider app ID
VITE_APP_NAME="Developer Console"               # Display name
VITE_NODE_PROVIDER_APP_NAME="Node Provider"     # Node provider display name
VITE_APP_ENV=dev                                # Environment (dev/stage/prod)
VITE_APP_EMAIL=team@cere.network                # Contact email
```

### DDC Network Configuration

```bash
# DDC Cluster Settings
VITE_DDC_NETWORK=devnet                         # Network: devnet/testnet/mainnet
VITE_DDC_CLUSTER_ID=0x7f82864e4f097e63d04cc279e4d8d2eb45a42ffa
VITE_DDC_CLUSTER_NAME="Dragon 1"               # Human-readable cluster name
VITE_DDC_STORAGE_NODE_URL=https://cdn.devnet.ddc-dragon.com
VITE_DDC_SDK_LOG_LEVEL=debug                   # SDK logging: debug/info/warn/error
```

### Blockchain Configuration

```bash
# Cere Network Settings
VITE_CERE_DECIMALS=10                          # Token decimal places
```

### Onboarding Configuration

```bash
# User Onboarding
VITE_ONBOARDIN_REWARD_AMOUNT=50                # Reward tokens for new users
VITE_ONBOARDIN_DEPOSIT_AMOUNT=40               # Required deposit amount
```

### External API Endpoints

```bash
# API Services
VITE_INDEXER_ENDPOINT=https://subsquid.devnet.cere.network/graphql
VITE_FAUCET_ENDPOINT=https://dev-faucet-service.network-dev.aws.cere.io/faucet/distribute-tokens
VITE_STATS_ENDPOINT=https://dac.devnet.ddc-dragon.com
VITE_CLUSTER_MANAGEMENT_ENDPOINT=https://dev-cluster-management.network-dev.aws.cere.io
```

### Observability

```bash
# Error Tracking
VITE_SENTRY_DNS=https://846f641918f97493dfbbf0966392a558@o318183.ingest.us.sentry.io/4507661454671872

# Analytics
VITE_GTM_ID=                                   # Google Tag Manager ID (optional)
```

### Feature Flags

```bash
# Feature Controls
VITE_FEATURE_USER_ONBOARDING=false            # Enable/disable user onboarding flow
```

## DDC Network Configurations

### Development Network (devnet)

```bash
VITE_DDC_NETWORK=devnet
VITE_DDC_CLUSTER_ID=0x7f82864e4f097e63d04cc279e4d8d2eb45a42ffa
VITE_DDC_CLUSTER_NAME="Dragon 1"
VITE_DDC_STORAGE_NODE_URL=https://cdn.devnet.ddc-dragon.com
VITE_INDEXER_ENDPOINT=https://subsquid.devnet.cere.network/graphql
VITE_FAUCET_ENDPOINT=https://dev-faucet-service.network-dev.aws.cere.io/faucet/distribute-tokens
VITE_STATS_ENDPOINT=https://dac.devnet.ddc-dragon.com
```

**Purpose**: Development and testing  
**Features**: 
- Test tokens available via faucet
- Relaxed validation rules
- Debug logging enabled
- Frequent resets

### Test Network (testnet)

```bash
VITE_DDC_NETWORK=testnet
VITE_DDC_CLUSTER_ID=[testnet-cluster-id]
VITE_DDC_CLUSTER_NAME="Testnet Cluster"
VITE_DDC_STORAGE_NODE_URL=https://cdn.testnet.ddc-dragon.com
VITE_INDEXER_ENDPOINT=https://subsquid.testnet.cere.network/graphql
VITE_FAUCET_ENDPOINT=https://testnet-faucet-service.network.aws.cere.io/faucet/distribute-tokens
VITE_STATS_ENDPOINT=https://dac.testnet.ddc-dragon.com
```

**Purpose**: Pre-production testing  
**Features**:
- Production-like environment
- Stable test data
- Performance testing
- Integration testing

### Production Network (mainnet)

```bash
VITE_DDC_NETWORK=mainnet
VITE_DDC_CLUSTER_ID=[mainnet-cluster-id]
VITE_DDC_CLUSTER_NAME="Production Cluster"
VITE_DDC_STORAGE_NODE_URL=https://cdn.mainnet.ddc-dragon.com
VITE_INDEXER_ENDPOINT=https://subsquid.mainnet.cere.network/graphql
VITE_FAUCET_ENDPOINT=                                  # No faucet on mainnet
VITE_STATS_ENDPOINT=https://dac.mainnet.ddc-dragon.com
```

**Purpose**: Live production environment  
**Features**:
- Real tokens and data
- High availability
- Performance monitoring
- Security hardening

## Environment-Specific Settings

### Development Environment

```bash
# Development optimizations
VITE_DDC_SDK_LOG_LEVEL=debug
VITE_FEATURE_USER_ONBOARDING=true
VITE_APP_ENV=dev

# Development services
VITE_SENTRY_DNS=                               # Disabled in dev
VITE_GTM_ID=                                   # Disabled in dev
```

**Characteristics**:
- Detailed logging enabled
- All features enabled for testing
- Local development optimizations
- No production analytics

### Staging Environment

```bash
# Staging configuration
VITE_DDC_SDK_LOG_LEVEL=info
VITE_FEATURE_USER_ONBOARDING=false
VITE_APP_ENV=stage

# Staging services
VITE_SENTRY_DNS=[staging-sentry-dsn]
VITE_GTM_ID=[staging-gtm-id]
```

**Characteristics**:
- Production-like configuration
- Feature flags match production
- Error tracking enabled
- Analytics testing

### Production Environment

```bash
# Production configuration
VITE_DDC_SDK_LOG_LEVEL=warn
VITE_FEATURE_USER_ONBOARDING=false
VITE_APP_ENV=prod

# Production services
VITE_SENTRY_DNS=[production-sentry-dsn]
VITE_GTM_ID=[production-gtm-id]
```

**Characteristics**:
- Minimal logging
- Stable feature set
- Full monitoring
- Performance optimized

## Configuration Management

### TypeScript Constants

Environment variables are accessed through typed constants:

```typescript
// src/constants.ts
import npmPackage from '../package.json';

// DDC presets for different networks
const ddcPresets = {
  testnet: TESTNET,
  devnet: DEVNET,  
  mainnet: MAINNET,
};

// Application configuration
export const APP_ID = import.meta.env.VITE_APP_ID || 'developer-console';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Developer Console';
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'dev';
export const APP_VERSION = npmPackage.version;

// DDC configuration
const ddcPreset = (import.meta.env.VITE_DDC_NETWORK || 'testnet') as keyof typeof ddcPresets;
export const DDC_PRESET = ddcPresets[ddcPreset];
export const DDC_CLUSTER_ID = import.meta.env.VITE_DDC_CLUSTER_ID || '';
export const DDC_STORAGE_NODE_URL = import.meta.env.VITE_DDC_STORAGE_NODE_URL || '';

// Feature flags
export const FEATURE_USER_ONBOARDING = import.meta.env.VITE_FEATURE_USER_ONBOARDING !== 'false';
```

### Runtime Configuration

Some settings can be configured at runtime:

```typescript
// Dynamic configuration based on environment
const getApiTimeout = (): number => {
  switch (APP_ENV) {
    case 'dev':
      return 10000; // 10 seconds for development
    case 'stage':
      return 30000; // 30 seconds for staging
    case 'prod':
      return 60000; // 60 seconds for production
    default:
      return 30000;
  }
};

// Network-specific configuration
const getRetryConfig = (network: string) => {
  const configs = {
    devnet: { retries: 3, delay: 1000 },
    testnet: { retries: 5, delay: 2000 },
    mainnet: { retries: 3, delay: 5000 },
  };
  
  return configs[network] || configs.testnet;
};
```

## Feature Flags

### Current Feature Flags

| Flag | Purpose | Default | Environments |
|------|---------|---------|--------------|
| `VITE_FEATURE_USER_ONBOARDING` | User onboarding flow | `false` | Disabled on all envs |

### Feature Flag Usage

```typescript
// Feature flag checking
import { FEATURE_USER_ONBOARDING } from '../constants';

// Conditional rendering
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        {FEATURE_USER_ONBOARDING && (
          <Route path="/onboarding" element={<Onboarding />} />
        )}
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
};

// Store behavior
class OnboardingStore {
  @computed
  get shouldShowOnboarding(): boolean {
    return FEATURE_USER_ONBOARDING && !this.hasCompletedOnboarding;
  }
}
```

### Adding New Feature Flags

1. **Add Environment Variable**:
   ```bash
   # In .env files
   VITE_FEATURE_NEW_FEATURE=false
   ```

2. **Add Constant**:
   ```typescript
   // In constants.ts
   export const FEATURE_NEW_FEATURE = import.meta.env.VITE_FEATURE_NEW_FEATURE === 'true';
   ```

3. **Use in Components**:
   ```typescript
   import { FEATURE_NEW_FEATURE } from '../constants';
   
   {FEATURE_NEW_FEATURE && <NewFeatureComponent />}
   ```

## Validation and Debugging

### Environment Validation

```typescript
// Validate required environment variables
const requiredEnvVars = [
  'VITE_DDC_CLUSTER_ID',
  'VITE_DDC_STORAGE_NODE_URL',
  'VITE_INDEXER_ENDPOINT',
];

const validateEnvironment = (): void => {
  const missing = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Call during app initialization
validateEnvironment();
```

### Debug Configuration

```typescript
// Debug environment information
const debugConfig = (): void => {
  if (APP_ENV === 'dev') {
    console.log('Environment Configuration:', {
      APP_ID,
      APP_ENV,
      DDC_NETWORK: import.meta.env.VITE_DDC_NETWORK,
      DDC_CLUSTER_ID,
      FEATURE_FLAGS: {
        USER_ONBOARDING: FEATURE_USER_ONBOARDING,
      },
    });
  }
};
```

## Security Considerations

### Sensitive Variables

**Never commit to repository**:
- Private keys
- API secrets
- Production endpoints
- Authentication tokens

**Use `.env` file for local secrets**:
```bash
# .env (git-ignored)
VITE_PRIVATE_KEY=your-private-key-here
VITE_API_SECRET=your-api-secret
```

### Environment Variable Naming

**Vite Requirements**:
- Must start with `VITE_` to be included in build
- Available in browser (not secure for secrets)
- Replaced at build time

**Naming Convention**:
```bash
VITE_[CATEGORY]_[SPECIFIC_NAME]=[value]

# Examples:
VITE_DDC_CLUSTER_ID=...         # DDC-related
VITE_APP_VERSION=...            # App-related  
VITE_FEATURE_ONBOARDING=...     # Feature flags
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**:
   ```bash
   # Check file exists and naming
   ls -la .env*
   
   # Verify Vite prefix
   grep "VITE_" .env
   
   # Restart development server
   npm run start
   ```

2. **Network Connection Issues**:
   ```typescript
   // Test DDC connection
   const testConnection = async () => {
     try {
       const response = await fetch(`${DDC_STORAGE_NODE_URL}/health`);
       console.log('DDC connection:', response.ok ? 'OK' : 'Failed');
     } catch (error) {
       console.error('DDC connection failed:', error);
     }
   };
   ```

3. **Feature Flags Not Working**:
   ```typescript
   // Debug feature flag values
   console.log('Feature flags:', {
     USER_ONBOARDING: FEATURE_USER_ONBOARDING,
     RAW_VALUE: import.meta.env.VITE_FEATURE_USER_ONBOARDING,
   });
   ```

### Environment Debugging

```bash
# Check all Vite environment variables
npm run dev -- --debug

# Verify environment file loading
node -e "console.log(process.env)" | grep VITE_

# Test specific configuration
curl -s $VITE_DDC_STORAGE_NODE_URL/health
```

## Best Practices

### Development

1. **Use Environment Templates**: Start with `.env.dev` template
2. **Validate Configuration**: Check required variables on startup
3. **Document Changes**: Update this file when adding new variables
4. **Test Environments**: Verify configuration in all environments

### Production

1. **Secure Secrets**: Use environment-specific secret management
2. **Validate Values**: Implement runtime validation
3. **Monitor Configuration**: Alert on configuration issues
4. **Document Dependencies**: Track external service dependencies

### Maintenance

1. **Regular Review**: Audit environment variables quarterly
2. **Clean Up**: Remove unused variables
3. **Version Control**: Track changes in environment files
4. **Backup Configuration**: Store secure backups of production config

See [Development Guide](guide.md) for development setup and [Deployment Guide](../functionality/deployment.md) for environment-specific deployment procedures. 