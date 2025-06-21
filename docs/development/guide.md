---
title: Development Guide
description: Development setup, coding standards, and best practices
---

# Development Guide

This guide covers development setup, coding standards, testing practices, and contribution guidelines for the Cluster Apps project.

## Getting Started

### Prerequisites

1. **Node.js**: Version specified in `.nvmrc` (currently Node.js 18+)
2. **npm**: Comes with Node.js
3. **Git**: For version control
4. **Docker**: For Node Provider Console development (optional)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd cluster-apps
   ```

2. **Use correct Node.js version**:
   ```bash
   nvm use
   # or
   nvm install $(cat .nvmrc)
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment**:
   ```bash
   cp .env.dev .env
   # Edit .env with your configuration
   ```

### Development Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Start development server**:
   ```bash
   # For Developer Console
   npm run start -w apps/developer-console
   
   # For Node Provider Console
   npm run start -w apps/node-provider
   
   # For Global Registry
   npm run start -w apps/global-registry
   ```

3. **Make changes and test**:
   ```bash
   npm run lint
   npm run check-types
   npm run build
   ```

4. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

## Project Structure

### Monorepo Organization

```
cluster-apps/
├── .github/workflows/        # CI/CD pipelines
├── apps/                     # Applications
│   ├── developer-console/    # Main developer interface
│   ├── node-provider/       # Node management console
│   └── global-registry/     # Access management
├── packages/                 # Shared packages
│   ├── ui/                  # UI components
│   ├── api/                 # API utilities
│   ├── analytics/           # Analytics
│   ├── reporting/           # Reporting
│   └── eslint-config/       # Linting config
├── docs/                     # Documentation
└── [config files]           # Root configuration
```

### Application Structure

Each application follows a consistent structure:

```
apps/[app-name]/
├── src/
│   ├── components/          # React components
│   ├── stores/             # MobX stores (where applicable)
│   ├── routes/             # Route components
│   ├── hooks/              # Custom hooks
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript types
│   ├── constants.ts        # Configuration constants
│   ├── App.tsx             # Root component
│   └── index.tsx           # Entry point
├── public/                  # Static assets
├── package.json            # Package configuration
├── tsconfig.json           # TypeScript config
└── vite.config.ts          # Vite configuration
```

## Coding Standards

### TypeScript Guidelines

1. **Strict Mode**: Always use strict TypeScript configuration
2. **Explicit Types**: Prefer explicit typing over `any`
3. **Interfaces over Types**: Use interfaces for object shapes
4. **Function Parameters**: Make all parameters explicit

```typescript
// Good
interface User {
  id: string;
  address: string;
  balance: bigint;
}

function processUser(user: User, options: ProcessOptions): ProcessResult {
  // Implementation
}

// Avoid
function processUser(user: any, options?: any): any {
  // Implementation
}
```

### React Component Guidelines

1. **Functional Components**: Use function components with hooks
2. **TypeScript Props**: Always type component props
3. **Default Props**: Use ES6 default parameters
4. **Component Naming**: Use PascalCase for components

```typescript
// Component definition
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  return (
    <button
      className={`button button--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
```

### MobX Store Guidelines

1. **Class-based Stores**: Use classes for MobX stores
2. **Observable State**: Mark state as observable
3. **Actions**: Use actions for state mutations
4. **Computed Values**: Use computed for derived state

```typescript
import { observable, action, computed, makeObservable } from 'mobx';

class UserStore {
  @observable users: User[] = [];
  @observable loading = false;
  @observable error: Error | null = null;

  constructor() {
    makeObservable(this);
  }

  @computed
  get activeUsers(): User[] {
    return this.users.filter(user => user.isActive);
  }

  @action
  async loadUsers(): Promise<void> {
    this.loading = true;
    this.error = null;
    
    try {
      const users = await api.getUsers();
      this.users = users;
    } catch (error) {
      this.error = error as Error;
    } finally {
      this.loading = false;
    }
  }

  @action
  addUser(user: User): void {
    this.users.push(user);
  }
}
```

### API Integration Guidelines

1. **Error Handling**: Always handle API errors explicitly
2. **Type Safety**: Use typed responses
3. **Loading States**: Implement loading indicators
4. **Retry Logic**: Implement appropriate retry mechanisms

```typescript
// API service with error handling
class BucketService {
  async createBucket(name: string): Promise<Bucket> {
    try {
      const bucket = await ddcApi.post<Bucket>('/buckets', { name });
      return bucket;
    } catch (error) {
      if (error instanceof ApiError) {
        // Handle specific API errors
        switch (error.status) {
          case 409:
            throw new Error('Bucket name already exists');
          case 402:
            throw new Error('Insufficient funds');
          default:
            throw new Error(`Failed to create bucket: ${error.message}`);
        }
      }
      throw error;
    }
  }
}
```

### CSS and Styling Guidelines

1. **Material-UI**: Use MUI components and theming
2. **CSS-in-JS**: Prefer styled components or MUI styling
3. **Responsive Design**: Implement mobile-first responsive design
4. **Theming**: Use consistent theme variables

```typescript
// MUI styling approach
import { styled } from '@mui/material/styles';
import { Card } from '@mui/material';

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(1),
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(1),
  },
}));

// Component usage
export const BucketCard: React.FC<BucketCardProps> = ({ bucket }) => {
  return (
    <StyledCard>
      <Typography variant="h6">{bucket.name}</Typography>
      <Typography variant="body2" color="textSecondary">
        {formatBytes(bucket.size)}
      </Typography>
    </StyledCard>
  );
};
```

## State Management

### MobX Best Practices

1. **Store Organization**: Create focused, single-responsibility stores
2. **Store Composition**: Compose stores in a root store
3. **Reactive Components**: Use `observer` HOC for reactive updates
4. **Avoid Direct Mutations**: Always use actions

```typescript
// Root store composition
class RootStore {
  appStore: AppStore;
  accountStore: AccountStore;
  bucketStore: BucketStore;

  constructor() {
    this.appStore = new AppStore(this);
    this.accountStore = new AccountStore(this);
    this.bucketStore = new BucketStore(this);
  }
}

// React context for store access
const StoreContext = createContext<RootStore>(new RootStore());

export const useStore = (): RootStore => {
  return useContext(StoreContext);
};

// Component with store access
import { observer } from 'mobx-react-lite';

export const BucketList = observer(() => {
  const { bucketStore } = useStore();

  useEffect(() => {
    bucketStore.loadBuckets();
  }, [bucketStore]);

  return (
    <div>
      {bucketStore.buckets.map(bucket => (
        <BucketCard key={bucket.id} bucket={bucket} />
      ))}
    </div>
  );
});
```

### State Architecture

```
RootStore
├── AppStore (global app state)
├── AccountStore (user & wallet)
├── BucketStore (DDC buckets)
├── FileStore (file operations)
└── OnboardingStore (user onboarding)
```

## Error Handling

### Error Types

1. **API Errors**: Network and server errors
2. **Validation Errors**: Form and input validation
3. **DDC Errors**: Blockchain and storage errors
4. **Application Errors**: Business logic errors

### Error Handling Patterns

```typescript
// Error boundary for React components
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error reporting service (Sentry)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Async error handling in stores
@action
async uploadFile(file: File, bucketId: number): Promise<void> {
  this.uploading = true;
  this.error = null;

  try {
    await ddcClient.store(bucketId, file);
    this.loadBuckets(); // Refresh data
  } catch (error) {
    this.error = this.formatError(error);
    throw error; // Re-throw for component handling
  } finally {
    this.uploading = false;
  }
}

private formatError(error: unknown): string {
  if (error instanceof DDCError) {
    return `DDC Error: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
```

### Error Reporting

All errors are reported to Sentry:

```typescript
import * as Sentry from '@sentry/react';

// Initialize Sentry
Sentry.init({
  dsn: process.env.VITE_SENTRY_DNS,
  environment: process.env.VITE_APP_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
});

// Report errors with context
function reportError(error: Error, context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      scope.setContext('additional_info', context);
    }
    Sentry.captureException(error);
  });
}
```

## Testing

### Testing Strategy

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete user workflows
4. **Visual Regression Tests**: Test UI consistency

### Testing Tools

- **Jest**: Testing framework
- **React Testing Library**: Component testing
- **MSW**: API mocking
- **Playwright**: E2E testing

### Component Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BucketList } from './BucketList';
import { StoreProvider } from '../providers/StoreProvider';

// Mock store
const mockBucketStore = {
  buckets: [
    { id: 1, name: 'Test Bucket', size: 1024 }
  ],
  loading: false,
  loadBuckets: jest.fn(),
};

describe('BucketList', () => {
  it('displays buckets correctly', () => {
    render(
      <StoreProvider bucketStore={mockBucketStore}>
        <BucketList />
      </StoreProvider>
    );

    expect(screen.getByText('Test Bucket')).toBeInTheDocument();
  });

  it('calls loadBuckets on mount', () => {
    render(
      <StoreProvider bucketStore={mockBucketStore}>
        <BucketList />
      </StoreProvider>
    );

    expect(mockBucketStore.loadBuckets).toHaveBeenCalled();
  });
});
```

### API Testing

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { BucketService } from './BucketService';

// Setup MSW server
const server = setupServer(
  rest.get('/api/buckets', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, name: 'Test Bucket', size: 1024 }
    ]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('BucketService', () => {
  it('fetches buckets successfully', async () => {
    const service = new BucketService();
    const buckets = await service.getBuckets();
    
    expect(buckets).toHaveLength(1);
    expect(buckets[0].name).toBe('Test Bucket');
  });
});
```

## Code Quality

### Linting and Formatting

1. **ESLint**: Code linting with custom rules
2. **Prettier**: Code formatting
3. **TypeScript**: Type checking
4. **Husky**: Git hooks for quality checks

```bash
# Run quality checks
npm run lint          # ESLint
npm run lint:fix      # Fix ESLint issues
npm run check-types   # TypeScript checking
npm run format        # Prettier formatting
```

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

### Commit Message Format

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/config changes

**Examples**:
```
feat(storage): add file upload progress indicator
fix(wallet): resolve connection timeout issue
docs(api): update authentication documentation
```

## Performance

### Optimization Guidelines

1. **Code Splitting**: Use dynamic imports for large components
2. **Lazy Loading**: Load components on demand
3. **Memoization**: Use React.memo and useMemo appropriately
4. **Bundle Analysis**: Monitor bundle size

```typescript
// Code splitting with React.lazy
const ContentStorage = lazy(() => import('./applications/ContentStorage'));
const ContentDelivery = lazy(() => import('./applications/ContentDelivery'));

// Component with Suspense
function App() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/storage" element={<ContentStorage />} />
          <Route path="/delivery" element={<ContentDelivery />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

// Memoized component
const BucketCard = React.memo<BucketCardProps>(({ bucket, onSelect }) => {
  return (
    <Card onClick={() => onSelect(bucket)}>
      <Typography>{bucket.name}</Typography>
    </Card>
  );
});

// Memoized expensive computation
const ExpensiveComponent: React.FC<Props> = ({ data }) => {
  const processedData = useMemo(() => {
    return processLargeDataset(data);
  }, [data]);

  return <DataVisualization data={processedData} />;
};
```

### Bundle Optimization

```typescript
// vite.config.ts optimization
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          ddc: ['@cere-ddc-sdk/ddc-client', '@cere-ddc-sdk/blockchain'],
        },
      },
    },
  },
});
```

## Security

### Security Best Practices

1. **Environment Variables**: Never commit secrets
2. **Input Validation**: Validate all user inputs
3. **XSS Prevention**: Sanitize dynamic content
4. **CSRF Protection**: Implement appropriate protections

```typescript
// Input validation
import * as yup from 'yup';

const bucketSchema = yup.object({
  name: yup.string()
    .required('Bucket name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be less than 50 characters')
    .matches(/^[a-zA-Z0-9-_]+$/, 'Name can only contain letters, numbers, hyphens, and underscores'),
  isPublic: yup.boolean(),
});

// Component with validation
const CreateBucketForm: React.FC = () => {
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(bucketSchema),
  });

  const onSubmit = async (data: BucketFormData) => {
    try {
      await bucketService.createBucket(data);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        )}
      />
    </form>
  );
};
```

### Wallet Security

```typescript
// Secure wallet interaction
class WalletService {
  async signTransaction(transaction: Transaction): Promise<string> {
    // Validate transaction before signing
    this.validateTransaction(transaction);
    
    try {
      const signature = await this.wallet.signTransaction(transaction);
      return signature;
    } catch (error) {
      // Log security-related errors
      this.logSecurityEvent('transaction_signing_failed', {
        error: error.message,
        transaction_type: transaction.type,
      });
      throw error;
    }
  }

  private validateTransaction(transaction: Transaction): void {
    if (!transaction.to || !transaction.value) {
      throw new Error('Invalid transaction parameters');
    }
    
    if (transaction.value > this.maxTransactionValue) {
      throw new Error('Transaction value exceeds maximum allowed');
    }
  }
}
```

## Debugging

### Development Tools

1. **React DevTools**: Component debugging
2. **MobX DevTools**: State management debugging
3. **Network Tab**: API debugging
4. **Console Logging**: Strategic logging

```typescript
// Debug logging utility
class Logger {
  static debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data);
    }
  }

  static error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`, error);
    // Send to error reporting in production
    if (process.env.NODE_ENV === 'production') {
      reportError(error || new Error(message));
    }
  }
}

// Usage in components
const FileUpload: React.FC = () => {
  const handleUpload = async (file: File) => {
    Logger.debug('Starting file upload', { fileName: file.name, size: file.size });
    
    try {
      await uploadService.upload(file);
      Logger.debug('File upload successful');
    } catch (error) {
      Logger.error('File upload failed', error as Error);
    }
  };
};
```

### Common Issues and Solutions

1. **Build Failures**: Check TypeScript errors and missing dependencies
2. **Runtime Errors**: Use error boundaries and proper error handling
3. **Performance Issues**: Use React DevTools Profiler
4. **State Management Issues**: Use MobX DevTools

## Contributing

### Pull Request Process

1. **Fork and Branch**: Create feature branch from `dev`
2. **Implement Changes**: Follow coding standards
3. **Add Tests**: Include tests for new functionality
4. **Update Documentation**: Update relevant documentation
5. **Submit PR**: Target `dev` branch with detailed description

### Code Review Guidelines

**For Authors**:
- Keep PRs focused and small
- Include clear descriptions
- Add tests and documentation
- Respond to feedback promptly

**For Reviewers**:
- Check functionality and code quality
- Verify tests and documentation
- Provide constructive feedback
- Approve when ready

### Release Process

1. **Feature Complete**: All features tested and documented
2. **Version Bump**: Update version numbers
3. **Update Changelog**: Document changes
4. **Create Release**: Tag and deploy to environments

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed contribution guidelines and [Extension Guide](../extension/guide.md) for adding new features. 