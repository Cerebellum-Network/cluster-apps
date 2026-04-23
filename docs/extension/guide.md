---
title: Extension Guide
description: How to add new services, modules, and functionality to Cluster Apps
---

# Extension Guide

This guide covers how to extend Cluster Apps with new applications, packages, DDC integrations, and custom functionality.

## Architecture Overview

Cluster Apps is designed for extensibility through:
- **Modular Applications**: Independent applications within the Developer Console
- **Shared Packages**: Reusable components and utilities
- **Plugin Architecture**: Extensible DDC integrations
- **Standardized Interfaces**: Consistent APIs and patterns

## Adding New Applications

### 1. Create Application Structure

```bash
# Create new application directory
mkdir apps/my-new-app
cd apps/my-new-app

# Initialize package.json
cat > package.json << EOF
{
  "name": "@cluster-apps/my-new-app",
  "private": true,
  "version": "0.17.0",
  "scripts": {
    "start": "vite --open",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "check-types": "tsc --noEmit"
  }
}
EOF
```

### 2. Configure TypeScript

```json
// tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

### 3. Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true }
    })
  ],
  define: {
    global: 'globalThis'
  }
});
```

### 4. Create Application Structure

```bash
mkdir -p src/{components,services,types,hooks}
```

```typescript
// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { theme } from '@cluster-apps/ui';

import { Home } from './components/Home';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
```

```typescript
// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 5. Add to Root Scripts (Optional)

```json
// Root package.json
{
  "scripts": {
    "start:my-new-app": "npm run start -w apps/my-new-app",
    "build:my-new-app": "npm run build -w apps/my-new-app"
  }
}
```

## Adding Modular Applications to Developer Console

### 1. Create Application Module

```bash
mkdir apps/developer-console/src/applications/MyNewApplication
```

```typescript
// apps/developer-console/src/applications/MyNewApplication/index.ts
import { Application } from '../types';
import { MyNewApplicationIcon } from './MyNewApplicationIcon';
import { MyNewApplicationRoute } from './MyNewApplicationRoute';

const myNewApplication: Application = {
  id: 'my-new-application',
  name: 'My New Application',
  description: 'Description of what this application does',
  icon: MyNewApplicationIcon,
  component: MyNewApplicationRoute,
  route: '/app/my-new-application',
  permissions: ['read', 'write'], // Optional permissions
};

export default myNewApplication;
```

### 2. Create Application Components

```typescript
// MyNewApplicationRoute.tsx
import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../../stores';

export const MyNewApplicationRoute: React.FC = observer(() => {
  const { myNewApplicationStore } = useStore();

  React.useEffect(() => {
    myNewApplicationStore.initialize();
  }, [myNewApplicationStore]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          My New Application
        </Typography>
        <Typography variant="body1">
          Application content goes here...
        </Typography>
      </Box>
    </Container>
  );
});
```

### 3. Create Application Store

```typescript
// stores/MyNewApplicationStore/index.ts
import { observable, action, computed, makeObservable } from 'mobx';
import { RootStore } from '../index';

export class MyNewApplicationStore {
  @observable data: any[] = [];
  @observable loading = false;
  @observable error: Error | null = null;

  constructor(private rootStore: RootStore) {
    makeObservable(this);
  }

  @action
  async initialize(): Promise<void> {
    this.loading = true;
    try {
      // Initialize application data
      await this.loadData();
    } catch (error) {
      this.error = error as Error;
    } finally {
      this.loading = false;
    }
  }

  @action
  async loadData(): Promise<void> {
    // Load application-specific data
  }

  @computed
  get hasData(): boolean {
    return this.data.length > 0;
  }
}
```

### 4. Register Application

```typescript
// applications/index.ts
import { Application } from './types';
import contentDelivery from './ContentDelivery';
import activityCapture from './ActivityCapture';
import contentStorage from './ContentStorage';
import myNewApplication from './MyNewApplication'; // Add import

const applications: Application[] = [
  contentStorage,
  contentDelivery,
  activityCapture,
  myNewApplication, // Add to array
];

export default applications;
```

### 5. Add Store to Root Store

```typescript
// stores/index.ts
import { MyNewApplicationStore } from './MyNewApplicationStore';

export class RootStore {
  // ... existing stores
  myNewApplicationStore: MyNewApplicationStore;

  constructor() {
    // ... existing store initialization
    this.myNewApplicationStore = new MyNewApplicationStore(this);
  }
}
```

## Creating New Shared Packages

### 1. Create Package Structure

```bash
mkdir packages/my-new-package
cd packages/my-new-package
```

### 2. Initialize Package

```json
// package.json
{
  "name": "@cluster-apps/my-new-package",
  "version": "0.0.0",
  "private": true,
  "sideEffects": false,
  "types": "./src",
  "exports": {
    "import": "./src"
  },
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    // Add dependencies as needed
  },
  "devDependencies": {
    "typescript": "^5.5.3"
  }
}
```

### 3. Configure TypeScript

```json
// tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### 4. Create Package Index

```typescript
// src/index.ts
export * from './MyNewUtility';
export * from './MyNewComponent';
export { default as MyNewService } from './MyNewService';
```

### 5. Use Package in Applications

```typescript
// In any application
import { MyNewUtility, MyNewComponent } from '@cluster-apps/my-new-package';

// Usage
const utility = new MyNewUtility();
<MyNewComponent />
```

## DDC Integration Extensions

### 1. Create DDC Service Extension

```typescript
// services/DDCExtensionService.ts
import { DdcClient } from '@cere-ddc-sdk/ddc-client';

export class DDCExtensionService {
  constructor(private ddcClient: DdcClient) {}

  async customOperation(bucketId: number, data: any): Promise<any> {
    try {
      // Custom DDC operation
      const result = await this.ddcClient.customMethod(bucketId, data);
      return result;
    } catch (error) {
      throw new Error(`Custom DDC operation failed: ${error.message}`);
    }
  }

  async batchOperation(operations: Array<{ bucketId: number; data: any }>): Promise<any[]> {
    const results = await Promise.allSettled(
      operations.map(op => this.customOperation(op.bucketId, op.data))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    );
  }
}
```

### 2. Create DDC Hook

```typescript
// hooks/useDDCExtension.ts
import { useState, useCallback } from 'react';
import { DDCExtensionService } from '../services/DDCExtensionService';

export const useDDCExtension = (ddcClient: DdcClient) => {
  const [service] = useState(() => new DDCExtensionService(ddcClient));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeCustomOperation = useCallback(async (bucketId: number, data: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await service.customOperation(bucketId, data);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [service]);

  return {
    executeCustomOperation,
    loading,
    error,
  };
};
```

### 3. Create DDC Component

```typescript
// components/DDCExtensionComponent.tsx
import React, { useState } from 'react';
import { Button, TextField, Box, Alert } from '@mui/material';
import { useDDCExtension } from '../hooks/useDDCExtension';

interface DDCExtensionComponentProps {
  ddcClient: DdcClient;
  bucketId: number;
}

export const DDCExtensionComponent: React.FC<DDCExtensionComponentProps> = ({
  ddcClient,
  bucketId,
}) => {
  const [data, setData] = useState('');
  const { executeCustomOperation, loading, error } = useDDCExtension(ddcClient);

  const handleSubmit = async () => {
    try {
      await executeCustomOperation(bucketId, data);
      setData(''); // Clear form
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Box>
      <TextField
        label="Data"
        value={data}
        onChange={(e) => setData(e.target.value)}
        fullWidth
        margin="normal"
      />
      <Button
        onClick={handleSubmit}
        disabled={loading || !data}
        variant="contained"
        sx={{ mt: 2 }}
      >
        {loading ? 'Processing...' : 'Execute Custom Operation'}
      </Button>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error.message}
        </Alert>
      )}
    </Box>
  );
};
```

## Custom UI Components

### 1. Create Component Package

```typescript
// packages/ui/src/MyCustomComponent.tsx
import React from 'react';
import { Box, Typography, styled } from '@mui/material';

const StyledContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

export interface MyCustomComponentProps {
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'highlighted';
}

export const MyCustomComponent: React.FC<MyCustomComponentProps> = ({
  title,
  children,
  variant = 'default',
}) => {
  return (
    <StyledContainer
      sx={{
        backgroundColor: variant === 'highlighted' ? 'primary.light' : 'background.paper',
      }}
    >
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {children}
    </StyledContainer>
  );
};
```

### 2. Add to Package Exports

```typescript
// packages/ui/src/index.ts
export * from './MyCustomComponent';
```

### 3. Use in Applications

```typescript
import { MyCustomComponent } from '@cluster-apps/ui';

<MyCustomComponent title="Custom Section" variant="highlighted">
  <p>Custom content here</p>
</MyCustomComponent>
```

## API Service Extensions

### 1. Create Service Extension

```typescript
// packages/api/src/MyCustomApiService.ts
import { ApiClient } from './ApiClient';

export class MyCustomApiService {
  constructor(private apiClient: ApiClient) {}

  async getCustomData(id: string): Promise<any> {
    return this.apiClient.get(`/custom-endpoint/${id}`);
  }

  async createCustomRecord(data: any): Promise<any> {
    return this.apiClient.post('/custom-endpoint', data);
  }

  async updateCustomRecord(id: string, data: any): Promise<any> {
    return this.apiClient.put(`/custom-endpoint/${id}`, data);
  }

  async deleteCustomRecord(id: string): Promise<void> {
    return this.apiClient.delete(`/custom-endpoint/${id}`);
  }
}
```

### 2. Create Typed Interfaces

```typescript
// packages/api/src/types/CustomTypes.ts
export interface CustomRecord {
  id: string;
  name: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomRecordRequest {
  name: string;
  data: any;
}

export interface UpdateCustomRecordRequest {
  name?: string;
  data?: any;
}
```

### 3. Export from Package

```typescript
// packages/api/src/index.ts
export * from './MyCustomApiService';
export * from './types/CustomTypes';
```

## Testing Extensions

### 1. Component Testing

```typescript
// __tests__/MyCustomComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@cluster-apps/ui';
import { MyCustomComponent } from '../MyCustomComponent';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('MyCustomComponent', () => {
  it('renders title and children', () => {
    renderWithTheme(
      <MyCustomComponent title="Test Title">
        <div>Test Content</div>
      </MyCustomComponent>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies highlighted variant styling', () => {
    renderWithTheme(
      <MyCustomComponent title="Test" variant="highlighted">
        <div>Content</div>
      </MyCustomComponent>
    );

    // Test styling applied correctly
  });
});
```

### 2. Service Testing

```typescript
// __tests__/MyCustomApiService.test.ts
import { MyCustomApiService } from '../MyCustomApiService';
import { ApiClient } from '../ApiClient';

// Mock ApiClient
jest.mock('../ApiClient');

describe('MyCustomApiService', () => {
  let service: MyCustomApiService;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    mockApiClient = new ApiClient('http://test') as jest.Mocked<ApiClient>;
    service = new MyCustomApiService(mockApiClient);
  });

  it('calls correct endpoint for getCustomData', async () => {
    const mockData = { id: '1', name: 'test' };
    mockApiClient.get.mockResolvedValue(mockData);

    const result = await service.getCustomData('1');

    expect(mockApiClient.get).toHaveBeenCalledWith('/custom-endpoint/1');
    expect(result).toEqual(mockData);
  });
});
```

## Documentation for Extensions

### 1. Component Documentation

```typescript
/**
 * MyCustomComponent - A reusable component for displaying custom content
 * 
 * @example
 * ```tsx
 * <MyCustomComponent title="Example" variant="highlighted">
 *   <p>Content goes here</p>
 * </MyCustomComponent>
 * ```
 */
export const MyCustomComponent: React.FC<MyCustomComponentProps> = ({ ... }) => {
  // Implementation
};
```

### 2. API Documentation

```typescript
/**
 * Service for managing custom records
 * 
 * @example
 * ```typescript
 * const service = new MyCustomApiService(apiClient);
 * const record = await service.getCustomData('123');
 * ```
 */
export class MyCustomApiService {
  /**
   * Retrieves a custom record by ID
   * @param id - The record ID
   * @returns Promise resolving to the custom record
   */
  async getCustomData(id: string): Promise<CustomRecord> {
    // Implementation
  }
}
```

### 3. Update Documentation

Add new extensions to the relevant documentation files:

```markdown
# docs/components/packages.md
## My New Package

**Purpose**: Description of the new package

**Features**:
- Feature 1
- Feature 2

**Usage**:
```typescript
import { MyNewComponent } from '@cluster-apps/my-new-package';
```
```

## Best Practices for Extensions

### 1. Follow Existing Patterns

- Use established coding standards
- Follow naming conventions
- Implement consistent error handling
- Add proper TypeScript types

### 2. Maintain Backward Compatibility

- Don't break existing APIs
- Deprecate features properly
- Provide migration guides
- Version changes appropriately

### 3. Add Comprehensive Tests

- Unit tests for logic
- Component tests for UI
- Integration tests for services
- End-to-end tests for workflows

### 4. Update Documentation

- Add inline code documentation
- Update README files
- Add usage examples
- Update architecture diagrams

### 5. Consider Performance

- Implement code splitting for large features
- Use lazy loading where appropriate
- Optimize bundle size
- Monitor performance impact

## Extension Checklist

### Before Development

- [ ] Review existing functionality to avoid duplication
- [ ] Plan integration with existing architecture
- [ ] Consider backward compatibility
- [ ] Design extension interfaces

### During Development

- [ ] Follow coding standards and patterns
- [ ] Add comprehensive TypeScript types
- [ ] Implement proper error handling
- [ ] Add unit and integration tests
- [ ] Document code with JSDoc comments

### After Development

- [ ] Update relevant documentation
- [ ] Add usage examples
- [ ] Test in all environments
- [ ] Review performance impact
- [ ] Create migration guide (if needed)

### Code Review

- [ ] Functionality works as expected
- [ ] Follows established patterns
- [ ] Includes proper tests
- [ ] Documentation is complete
- [ ] No breaking changes (or properly documented)

## Getting Help

### Resources

- [Development Guide](../development/guide.md) - Development setup and practices
- [Architecture Documentation](../architecture/) - System architecture
- [Component Documentation](../components/) - Existing components and packages

### Community

- GitHub Issues - Bug reports and feature requests
- Discord - Real-time community support
- Code Reviews - Peer review and feedback

### Contribution Process

1. **Fork Repository**: Create your own fork
2. **Create Branch**: Feature branch from `dev`
3. **Implement Extension**: Follow this guide
4. **Add Tests**: Comprehensive test coverage
5. **Update Documentation**: Keep docs current
6. **Submit PR**: Target `dev` branch
7. **Address Feedback**: Respond to review comments
8. **Merge**: Once approved and tests pass

See [Development Guide](../development/guide.md) for detailed development procedures and [Contributing Guidelines](../../CONTRIBUTING.md) for the contribution process. 