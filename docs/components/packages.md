---
title: Shared Packages
description: Documentation for all shared packages in the monorepo
---

# Shared Packages

The Cluster Apps monorepo includes five shared packages that provide common functionality across all applications. These packages promote code reuse, consistency, and maintainability.

## Package Overview

| Package | Purpose | Version | Dependencies |
|---------|---------|---------|--------------|
| [@cluster-apps/ui](#ui-package) | Reusable UI components | 0.0.0 | Material-UI, React |
| [@cluster-apps/api](#api-package) | HTTP client utilities | 0.0.0 | Axios |
| [@cluster-apps/analytics](#analytics-package) | User tracking | 0.0.0 | - |
| [@cluster-apps/reporting](#reporting-package) | Data reporting | 0.0.0 | - |
| [@cluster-apps/eslint-config](#eslint-config-package) | Linting rules | - | ESLint, TypeScript |

## UI Package

**Location**: `packages/ui/`  
**Purpose**: Reusable Material-UI based components for consistent design across applications

### Features

- **Design System**: Consistent theming and styling
- **DDC-specific Components**: Custom components for DDC operations
- **Charts and Visualization**: Data visualization components
- **Form Components**: Advanced form controls
- **Navigation Components**: Menu and routing components

### Key Dependencies

```json
{
  "@mui/material": "^5.16.5",
  "@mui/icons-material": "^5.16.5",
  "@mui/x-charts": "^7.12.0",
  "@emotion/react": "^11.13.0",
  "@emotion/styled": "^11.13.0",
  "react-markdown": "^9.0.1",
  "react-qr-code": "^2.0.15",
  "lottie-react": "^2.4.0"
}
```

### Component Categories

#### Core Components

```typescript
// Basic UI building blocks
export { Button } from './Button';
export { TextField } from './TextField';
export { Card } from './Card';
export { Dialog } from './Dialog';
export { Spinner } from './Spinner';
export { Toast } from './Toast';
```

#### DDC-specific Components

```typescript
// Components tailored for DDC operations
export { WalletConnect } from './WalletConnect';
export { BucketSelector } from './BucketSelector';
export { FileUpload } from './FileUpload';
export { StorageMetrics } from './StorageMetrics';
export { ClusterStatus } from './ClusterStatus';
```

#### Data Visualization

```typescript
// Chart and visualization components
export { ProgressChart } from './charts/ProgressChart';
export { UsageChart } from './charts/UsageChart';
export { MetricsCard } from './charts/MetricsCard';
export { DataTable } from './DataTable';
```

#### Form Components

```typescript
// Advanced form controls
export { FormBuilder } from './forms/FormBuilder';
export { ValidationTextField } from './forms/ValidationTextField';
export { FileUploadZone } from './forms/FileUploadZone';
export { TokenAmountInput } from './forms/TokenAmountInput';
```

### Usage Examples

#### Basic Component Usage

```typescript
import { Button, Card, TextField } from '@cluster-apps/ui';

function MyComponent() {
  return (
    <Card>
      <TextField label="Enter value" />
      <Button variant="contained" color="primary">
        Submit
      </Button>
    </Card>
  );
}
```

#### DDC-specific Component Usage

```typescript
import { WalletConnect, FileUpload } from '@cluster-apps/ui';

function DDCInterface() {
  return (
    <div>
      <WalletConnect onConnect={handleWalletConnect} />
      <FileUpload
        onUpload={handleFileUpload}
        maxSize={100 * 1024 * 1024} // 100MB
        acceptedTypes={['image/*', 'application/pdf']}
      />
    </div>
  );
}
```

#### Chart Usage

```typescript
import { UsageChart, MetricsCard } from '@cluster-apps/ui';

function Dashboard() {
  const data = [
    { name: 'Storage', value: 75 },
    { name: 'Bandwidth', value: 60 },
    { name: 'Requests', value: 90 }
  ];

  return (
    <div>
      <UsageChart data={data} />
      <MetricsCard
        title="Storage Usage"
        value="75%"
        trend="up"
        color="primary"
      />
    </div>
  );
}
```

### Theming

The UI package includes a comprehensive theming system:

```typescript
// Theme configuration
export const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Cere blue
    },
    secondary: {
      main: '#dc004e', // Cere pink
    },
    // ... other colors
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // ... typography settings
  },
  components: {
    // Custom component overrides
  }
});
```

### Responsive Design

All components are designed to be responsive:

```typescript
// Responsive breakpoints
const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

// Usage in components
const useStyles = makeStyles((theme) => ({
  container: {
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1),
    },
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(2),
    },
  },
}));
```

## API Package

**Location**: `packages/api/`  
**Purpose**: HTTP client utilities and API abstractions

### Features

- **Axios-based HTTP Client**: Standardized HTTP operations
- **Request/Response Interceptors**: Automatic error handling and logging
- **API Endpoint Management**: Centralized endpoint configuration
- **Type-safe API Calls**: TypeScript interfaces for all API operations

### Core API Client

```typescript
export class ApiClient {
  private axios: AxiosInstance;

  constructor(baseURL: string, options?: ApiClientOptions) {
    this.axios = axios.create({
      baseURL,
      timeout: options?.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    this.setupInterceptors();
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.post<T>(url, data, config);
    return response.data;
  }

  // ... other HTTP methods
}
```

### Pre-configured API Clients

```typescript
// DDC API client
export const ddcApi = new ApiClient(
  process.env.VITE_DDC_STORAGE_NODE_URL || '',
  {
    timeout: 60000, // Longer timeout for file operations
  }
);

// Indexer API client
export const indexerApi = new ApiClient(
  process.env.VITE_INDEXER_ENDPOINT || '',
  {
    headers: {
      'Accept': 'application/json',
    },
  }
);

// Faucet API client
export const faucetApi = new ApiClient(
  process.env.VITE_FAUCET_ENDPOINT || ''
);
```

### Error Handling

```typescript
// Standardized error handling
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

// Interceptor for error handling
private setupInterceptors() {
  this.axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        throw new ApiError(
          error.response.status,
          error.response.statusText,
          error.response.data
        );
      }
      throw error;
    }
  );
}
```

### Usage Examples

```typescript
import { ddcApi, indexerApi, ApiError } from '@cluster-apps/api';

// Basic API call
try {
  const buckets = await ddcApi.get<Bucket[]>('/buckets');
  console.log('Buckets:', buckets);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error: ${error.status} - ${error.message}`);
  }
}

// POST with data
const newBucket = await ddcApi.post<Bucket>('/buckets', {
  name: 'My Bucket',
  isPublic: false,
});

// GraphQL query to indexer
const query = `
  query GetUserBuckets($address: String!) {
    buckets(where: { owner: $address }) {
      id
      name
      size
    }
  }
`;

const result = await indexerApi.post('/graphql', {
  query,
  variables: { address: userAddress },
});
```

## Analytics Package

**Location**: `packages/analytics/`  
**Purpose**: User tracking and analytics across applications

### Features

- **Event Tracking**: Custom event logging
- **User Journey Analytics**: Track user behavior flows
- **Performance Metrics**: Application performance monitoring
- **A/B Testing Support**: Feature flag analytics

### Core Analytics Interface

```typescript
export interface AnalyticsProvider {
  // Event tracking
  track(event: string, properties?: Record<string, any>): void;
  
  // User identification
  identify(userId: string, traits?: Record<string, any>): void;
  
  // Page tracking
  page(name: string, properties?: Record<string, any>): void;
  
  // Custom properties
  setUserProperties(properties: Record<string, any>): void;
}

export class Analytics implements AnalyticsProvider {
  private providers: AnalyticsProvider[] = [];

  addProvider(provider: AnalyticsProvider) {
    this.providers.push(provider);
  }

  track(event: string, properties?: Record<string, any>) {
    this.providers.forEach(provider => {
      provider.track(event, properties);
    });
  }

  // ... other methods
}
```

### Pre-built Providers

```typescript
// Google Analytics provider
export class GoogleAnalyticsProvider implements AnalyticsProvider {
  constructor(trackingId: string) {
    // Initialize Google Analytics
  }

  track(event: string, properties?: Record<string, any>) {
    gtag('event', event, properties);
  }
}

// Custom analytics provider
export class CustomAnalyticsProvider implements AnalyticsProvider {
  constructor(private apiClient: ApiClient) {}

  track(event: string, properties?: Record<string, any>) {
    this.apiClient.post('/analytics/events', {
      event,
      properties,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### DDC-specific Events

```typescript
// DDC operation events
export const DDC_EVENTS = {
  FILE_UPLOAD_STARTED: 'ddc.file.upload.started',
  FILE_UPLOAD_COMPLETED: 'ddc.file.upload.completed',
  FILE_UPLOAD_FAILED: 'ddc.file.upload.failed',
  BUCKET_CREATED: 'ddc.bucket.created',
  WALLET_CONNECTED: 'ddc.wallet.connected',
  ONBOARDING_COMPLETED: 'ddc.onboarding.completed',
} as const;

// Usage
analytics.track(DDC_EVENTS.FILE_UPLOAD_STARTED, {
  fileSize: file.size,
  fileType: file.type,
  bucketId: bucket.id,
});
```

### Usage Examples

```typescript
import { Analytics, GoogleAnalyticsProvider } from '@cluster-apps/analytics';

// Setup analytics
const analytics = new Analytics();
analytics.addProvider(new GoogleAnalyticsProvider('GA-TRACKING-ID'));

// Track events
analytics.track('button_click', {
  button_name: 'upload_file',
  page: 'storage',
});

// Identify user
analytics.identify(userAddress, {
  wallet_type: 'cere',
  first_login: false,
});

// Track page views
analytics.page('Storage Dashboard', {
  bucket_count: buckets.length,
  total_storage: totalStorage,
});
```

## Reporting Package

**Location**: `packages/reporting/`  
**Purpose**: Data reporting and export utilities

### Features

- **Report Generation**: Create reports from data
- **Multiple Export Formats**: CSV, JSON, PDF support
- **Data Transformation**: Clean and format data for reports
- **Template System**: Reusable report templates

### Core Reporting Classes

```typescript
export class ReportGenerator {
  generateCSV(data: any[], options?: CSVOptions): string {
    // Convert data to CSV format
  }

  generateJSON(data: any[], options?: JSONOptions): string {
    // Convert data to JSON format
  }

  generatePDF(data: any[], template: PDFTemplate): Promise<Buffer> {
    // Generate PDF report
  }

  exportFile(content: string, filename: string, type: 'csv' | 'json' | 'pdf'): void {
    // Trigger file download
  }
}

export class DataTransformer {
  flattenObjects(data: any[]): any[] {
    // Flatten nested objects for CSV export
  }

  filterColumns(data: any[], columns: string[]): any[] {
    // Select specific columns
  }

  aggregateData(data: any[], groupBy: string, aggregations: Aggregation[]): any[] {
    // Group and aggregate data
  }
}
```

### Report Templates

```typescript
// DDC storage report template
export const STORAGE_REPORT_TEMPLATE = {
  title: 'DDC Storage Usage Report',
  columns: [
    { key: 'bucket_name', label: 'Bucket Name' },
    { key: 'file_count', label: 'Files' },
    { key: 'total_size', label: 'Size (MB)' },
    { key: 'last_modified', label: 'Last Modified' },
  ],
  formatters: {
    total_size: (value: number) => (value / 1024 / 1024).toFixed(2),
    last_modified: (value: string) => new Date(value).toLocaleDateString(),
  },
};

// Usage analytics report template
export const ANALYTICS_REPORT_TEMPLATE = {
  title: 'User Analytics Report',
  columns: [
    { key: 'event', label: 'Event' },
    { key: 'count', label: 'Count' },
    { key: 'unique_users', label: 'Unique Users' },
    { key: 'percentage', label: 'Percentage' },
  ],
  aggregations: [
    { field: 'count', type: 'sum' },
    { field: 'unique_users', type: 'count_distinct' },
  ],
};
```

### Usage Examples

```typescript
import { ReportGenerator, DataTransformer, STORAGE_REPORT_TEMPLATE } from '@cluster-apps/reporting';

// Generate storage usage report
const reportGenerator = new ReportGenerator();
const transformer = new DataTransformer();

// Transform raw data
const transformedData = transformer.filterColumns(rawData, [
  'bucket_name', 'file_count', 'total_size', 'last_modified'
]);

// Generate CSV report
const csvContent = reportGenerator.generateCSV(transformedData, {
  headers: true,
  separator: ',',
});

// Export file
reportGenerator.exportFile(csvContent, 'storage-report.csv', 'csv');

// Generate PDF report
const pdfBuffer = await reportGenerator.generatePDF(
  transformedData,
  STORAGE_REPORT_TEMPLATE
);
```

## ESLint Config Package

**Location**: `packages/eslint-config/`  
**Purpose**: Shared linting configuration for consistent code quality

### Features

- **TypeScript Support**: Rules for TypeScript development
- **React Integration**: React-specific linting rules
- **Prettier Integration**: Code formatting consistency
- **Custom DDC Rules**: Domain-specific linting rules

### Configuration

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "plugins": [
    "@typescript-eslint",
    "react",
    "react-hooks"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Custom Rules

```typescript
// Custom ESLint rules for DDC development
const customRules = {
  // Enforce error handling for DDC operations
  'ddc/handle-errors': 'error',
  
  // Require explicit typing for DDC API responses
  'ddc/typed-api-responses': 'error',
  
  // Enforce consistent naming for stores
  'ddc/store-naming': 'error',
  
  // Require proper cleanup for subscriptions
  'ddc/cleanup-subscriptions': 'error',
};
```

### Usage

Projects automatically inherit the ESLint configuration:

```json
// .eslintrc.json in root
{
  "extends": "@cluster-apps/eslint-config",
  "root": true
}
```

Individual packages can extend with additional rules:

```json
// Package-specific .eslintrc.json
{
  "extends": "@cluster-apps/eslint-config",
  "rules": {
    // Package-specific overrides
  }
}
```

## Package Development

### Creating New Packages

1. **Create Package Directory**:
   ```bash
   mkdir packages/new-package
   cd packages/new-package
   ```

2. **Initialize Package**:
   ```json
   {
     "name": "@cluster-apps/new-package",
     "version": "0.0.0",
     "private": true,
     "types": "./src",
     "exports": {
       "import": "./src"
     }
   }
   ```

3. **Add to Workspace**:
   The package is automatically included due to `packages/*` in root workspace configuration.

### Package Dependencies

```bash
# Add dependency to specific package
npm install dependency-name -w packages/package-name

# Add dev dependency
npm install -D dev-dependency -w packages/package-name

# Install dependencies across all packages
npm install
```

### Building and Testing

```bash
# Build all packages
npm run build

# Test specific package
npm test -w packages/package-name

# Lint all packages
npm run lint
```

## Inter-package Dependencies

### Dependency Management

Packages can depend on each other:

```json
// packages/ui/package.json
{
  "dependencies": {
    "@cluster-apps/analytics": "workspace:*"
  }
}
```

### Import Resolution

TypeScript path mapping enables clean imports:

```typescript
// Import from another package
import { ApiClient } from '@cluster-apps/api';
import { Button } from '@cluster-apps/ui';

// Import from same package
import { LocalComponent } from './LocalComponent';
```

### Circular Dependency Prevention

The monorepo structure prevents circular dependencies:
- **Base packages** (eslint-config) have no internal dependencies
- **Utility packages** (api, analytics, reporting) depend only on base packages
- **UI packages** can depend on utility packages
- **Applications** can depend on any packages

## Package Versioning

### Version Strategy

- All packages start at version 0.0.0
- Versions are bumped together for releases
- Breaking changes are coordinated across packages

### Release Process

```bash
# Update all package versions
npm version patch --workspaces

# Build and test
npm run build
npm test

# Commit and tag
git commit -am "Release v0.0.1"
git tag v0.0.1
```

## Contributing to Packages

### Guidelines

1. **Maintain API Consistency**: Keep package APIs stable
2. **Add Tests**: Include unit tests for new functionality
3. **Update Documentation**: Document new features and breaking changes
4. **Follow Conventions**: Use established patterns and naming conventions

### Code Review

All package changes require code review:
- **Breaking Changes**: Require approval from package maintainers
- **New Features**: Should include documentation and tests
- **Bug Fixes**: Include regression tests where applicable

See [Development Guide](../development/guide.md) for detailed development procedures. 