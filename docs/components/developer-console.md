---
title: Developer Console
description: Primary interface for developers to manage DDC resources
---

# Developer Console

The Developer Console is the primary web application for developers to interact with DDC (Decentralized Data Cloud) clusters. It provides a comprehensive interface for managing storage, content delivery, and activity capture.

## Overview

The Developer Console is built as a modular React application with three main applications:

1. **Content Storage** - File and data storage management
2. **Content Delivery** - CDN configuration and management  
3. **Activity Capture** - Event tracking and analytics setup

## Architecture

### Application Structure

```
apps/developer-console/
├── src/
│   ├── applications/          # Modular sub-applications
│   │   ├── ContentStorage/   # Storage management
│   │   ├── ContentDelivery/  # CDN management
│   │   └── ActivityCapture/  # Event tracking
│   ├── stores/               # MobX state management
│   │   ├── AppStore/        # Root application state
│   │   ├── AccountStore/    # Account & wallet management
│   │   ├── OnboardingStore/ # User onboarding flow
│   │   └── QuestsStore/     # Achievement system
│   ├── routes/              # React Router configuration
│   │   ├── Home/           # Dashboard
│   │   ├── Login/          # Authentication
│   │   ├── Onboarding/     # User onboarding
│   │   └── TopUp/          # Account funding
│   ├── components/          # Reusable components
│   ├── hooks/              # Custom React hooks
│   ├── assets/             # Static assets
│   └── constants.ts        # Configuration constants
├── public/                  # Static files
└── [config files]         # Build and type configuration
```

### Modular Application System

The Developer Console uses a modular application architecture where each "application" represents a specific DDC use case:

```typescript
// Application definition interface
interface Application {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType;
  component: React.ComponentType;
  route: string;
  permissions?: string[];
}

// Applications are registered centrally
const applications: Application[] = [
  contentStorage,
  contentDelivery, 
  activityCapture
];
```

## Applications

### Content Storage

**Purpose**: Manage file storage and bucket operations on DDC

**Key Features**:
- Bucket creation and management
- File upload/download operations
- Folder organization
- Sharing and access control
- Storage statistics and analytics

**User Flow**:
1. Create or select bucket
2. Upload files or create folders
3. Manage file permissions
4. Share files via links
5. Monitor storage usage

**Components**:
- `BucketList` - Display user buckets
- `FileManager` - File operations interface
- `UploadProgress` - File upload status
- `ShareDialog` - File sharing configuration

### Content Delivery

**Purpose**: Configure and manage Content Delivery Network (CDN) for faster content access

**Key Features**:
- CDN endpoint configuration
- Cache management
- Geographic distribution settings
- Performance analytics
- Custom domain setup

**User Flow**:
1. Select bucket for CDN
2. Configure CDN settings
3. Set up custom domains (optional)
4. Monitor delivery performance
5. Manage cache policies

**Components**:
- `CDNConfiguration` - CDN setup interface
- `DomainManager` - Custom domain management
- `PerformanceMetrics` - Analytics dashboard
- `CacheSettings` - Cache policy configuration

### Activity Capture

**Purpose**: Set up event tracking and analytics for applications

**Key Features**:
- Event schema definition
- Data collection setup
- Real-time analytics
- Custom event configuration
- Data export capabilities

**User Flow**:
1. Define event schemas
2. Configure tracking endpoints
3. Set up data collection rules
4. Monitor event streams
5. Export analytics data

**Components**:
- `EventSchemaBuilder` - Schema definition interface
- `TrackingSetup` - Configuration wizard
- `EventStream` - Real-time event monitoring
- `AnalyticsDashboard` - Data visualization

## State Management

### MobX Store Architecture

The application uses MobX for reactive state management with the following store hierarchy:

```typescript
// Root store combining all application stores
class RootStore {
  appStore: AppStore;
  accountStore: AccountStore;
  onboardingStore: OnboardingStore;
  questsStore: QuestsStore;
  
  constructor() {
    this.appStore = new AppStore(this);
    this.accountStore = new AccountStore(this);
    this.onboardingStore = new OnboardingStore(this);
    this.questsStore = new QuestsStore(this);
  }
}
```

### AppStore

**Purpose**: Manages global application state

**Key State**:
- Current application/route
- Loading states
- Error handling
- Feature flags
- Theme and UI preferences

```typescript
class AppStore {
  @observable currentApplication: string | null = null;
  @observable isLoading = false;
  @observable error: Error | null = null;
  @observable featureFlags = new Map<string, boolean>();
  
  @action setCurrentApplication(appId: string) {
    this.currentApplication = appId;
  }
  
  @action setError(error: Error | null) {
    this.error = error;
  }
}
```

### AccountStore

**Purpose**: Manages user account and wallet integration

**Key State**:
- Wallet connection status
- Account balance
- DDC cluster connection
- Authentication status

```typescript
class AccountStore {
  @observable wallet: Wallet | null = null;
  @observable account: Account | null = null;
  @observable balance: bigint = 0n;
  @observable isConnected = false;
  
  @action async connectWallet() {
    // Wallet connection logic
  }
  
  @action async loadBalance() {
    // Balance fetching logic
  }
}
```

### OnboardingStore

**Purpose**: Manages user onboarding flow

**Key Features**:
- Step-by-step onboarding process
- Progress tracking
- Reward distribution
- Welcome tutorial

### QuestsStore

**Purpose**: Manages achievement and quest system

**Key Features**:
- Quest progress tracking
- Achievement unlocking
- Reward distribution
- Gamification elements

## Routing

### Route Structure

```typescript
// Route configuration
const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/login', element: <Login /> },
      { path: '/onboarding', element: <Onboarding /> },
      { path: '/app/:appId', element: <ApplicationRoute /> },
      { path: '/topup', element: <TopUp /> }
    ]
  }
];
```

### Navigation Flow

1. **Landing** (`/`) - Dashboard with application overview
2. **Login** (`/login`) - Wallet connection and authentication
3. **Onboarding** (`/onboarding`) - New user setup flow
4. **Applications** (`/app/:appId`) - Individual application interfaces
5. **Top-up** (`/topup`) - Account funding interface

## User Interface

### Design System

The Developer Console uses Material-UI (MUI) with custom theming:

- **Colors**: Cere brand colors with dark/light mode support
- **Typography**: Consistent font hierarchy
- **Components**: Extended MUI components with DDC-specific styling
- **Icons**: Material icons with custom DDC icons

### Key UI Components

```typescript
// Custom components built on MUI
export const WalletButton: React.FC = () => {
  // Wallet connection button with status
};

export const FileUploadZone: React.FC<{
  onUpload: (files: File[]) => void;
}> = ({ onUpload }) => {
  // Drag-and-drop file upload interface
};

export const BucketCard: React.FC<{
  bucket: Bucket;
  onSelect: (bucket: Bucket) => void;
}> = ({ bucket, onSelect }) => {
  // Bucket display card with actions
};
```

### Responsive Design

- **Desktop**: Full-featured interface with sidebars and panels
- **Tablet**: Condensed layout with collapsible navigation
- **Mobile**: Simplified interface with essential features only

## Integration

### DDC SDK Integration

```typescript
// DDC client configuration
const ddcClient = new DdcClient({
  clusterId: DDC_CLUSTER_ID,
  storageNodeUrl: DDC_STORAGE_NODE_URL,
  logLevel: DDC_SDK_LOG_LEVEL
});

// Usage in stores
class ContentStorageStore {
  @action async uploadFile(file: File, bucketId: number) {
    const result = await ddcClient.store(bucketId, file);
    return result;
  }
  
  @action async downloadFile(bucketId: number, cid: string) {
    const data = await ddcClient.read(bucketId, cid);
    return data;
  }
}
```

### Wallet Integration

```typescript
// Cere Wallet integration
import { CereWallet } from '@cere/embed-wallet';

const wallet = new CereWallet({
  appId: APP_ID,
  appName: APP_NAME,
  network: DDC_PRESET
});

// Usage in AccountStore
@action async connectWallet() {
  await wallet.connect();
  this.wallet = wallet;
  this.isConnected = true;
}
```

### External API Integration

The console integrates with several external services:

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Indexer | Blockchain data queries | `VITE_INDEXER_ENDPOINT` |
| Faucet | Token distribution | `VITE_FAUCET_ENDPOINT` |
| Stats | Cluster statistics | `VITE_STATS_ENDPOINT` |
| Cluster Management | Node operations | `VITE_CLUSTER_MANAGEMENT_ENDPOINT` |

## Features

### User Onboarding

**Flow**:
1. Wallet connection
2. Account verification  
3. Initial funding (via faucet)
4. First bucket creation
5. Welcome tutorial

**Configuration**:
```typescript
// Onboarding constants
export const ONBOARDIN_REWARD_AMOUNT = 50; // CERE tokens
export const ONBOARDIN_DEPOSIT_AMOUNT = 40; // Required deposit
export const FEATURE_USER_ONBOARDING = true; // Feature flag
```

### Quest System

**Purpose**: Gamify the user experience with achievements

**Quest Types**:
- First file upload
- Bucket creation
- CDN setup
- Sharing files
- Activity tracking setup

**Implementation**:
```typescript
interface Quest {
  id: string;
  name: string;
  description: string;
  reward: number;
  completed: boolean;
  progress: number;
  maxProgress: number;
}
```

### File Management

**Features**:
- Drag-and-drop upload
- Folder creation and organization
- File preview and download
- Sharing via public links
- Batch operations

**File Types Supported**:
- Documents (PDF, DOC, TXT)
- Images (JPG, PNG, GIF, SVG)
- Videos (MP4, WebM)
- Code files (JS, TS, JSON, etc.)

### Analytics and Monitoring

**Metrics Tracked**:
- Storage usage by bucket
- File upload/download statistics
- CDN performance metrics
- User engagement analytics
- Error rates and types

**Integration**:
- Sentry for error tracking
- Google Analytics for user behavior
- Custom analytics for DDC-specific metrics

## Configuration

### Environment Variables

All configuration is managed through Vite environment variables:

```typescript
// Core application config
export const APP_ID = import.meta.env.VITE_APP_ID;
export const APP_NAME = import.meta.env.VITE_APP_NAME;
export const APP_ENV = import.meta.env.VITE_APP_ENV;

// DDC configuration
export const DDC_CLUSTER_ID = import.meta.env.VITE_DDC_CLUSTER_ID;
export const DDC_STORAGE_NODE_URL = import.meta.env.VITE_DDC_STORAGE_NODE_URL;

// Feature flags
export const FEATURE_USER_ONBOARDING = 
  import.meta.env.VITE_FEATURE_USER_ONBOARDING !== 'false';
```

### Build Configuration

**Vite Config Features**:
- Node.js polyfills for DDC SDK compatibility
- TypeScript path mapping
- Hot module replacement
- Production optimizations

```typescript
// vite.config.ts highlights
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Required for DDC SDK
      globals: { Buffer: true, global: true, process: true }
    })
  ],
  define: {
    global: 'globalThis'
  }
});
```

## Development

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.dev .env
   ```

3. **Start development server**:
   ```bash
   npm run start -w apps/developer-console
   ```

4. **Open application**:
   http://localhost:5173/

### Code Structure Guidelines

- **Components**: One component per file, named exports
- **Stores**: MobX stores with clear responsibilities
- **Types**: TypeScript interfaces in dedicated files
- **Constants**: Centralized configuration
- **Utils**: Pure utility functions

### Testing Strategy

[TODO: Add testing documentation when test files are implemented]

## Deployment

The Developer Console is deployed as a static site to AWS CloudFront:

1. **Build**: `npm run build`
2. **Deploy**: GitHub Actions pipeline
3. **Environments**: Dev, Stage, Production
4. **CDN**: CloudFront distribution
5. **Monitoring**: CloudWatch and Sentry

See [Deployment Guide](../functionality/deployment.md) for detailed deployment information.

## Troubleshooting

### Common Issues

1. **Wallet Connection Failures**
   - Check browser compatibility
   - Verify network configuration
   - Clear browser cache

2. **File Upload Errors**
   - Check file size limits
   - Verify DDC cluster connectivity
   - Check account balance

3. **Build Issues**
   - Verify Node.js version (.nvmrc)
   - Clear node_modules and reinstall
   - Check TypeScript errors

See [Troubleshooting Guide](../functionality/troubleshooting.md) for detailed solutions. 