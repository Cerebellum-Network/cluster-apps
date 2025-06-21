---
title: Task 1 - Resource Registration Endpoint
description: Extend Node Provider App with API to register compute resources
estimate: 6 hours
---

# Task 1: Resource Registration Endpoint

**Target**: `apps/node-provider`  
**Estimate**: 6 hours  
**Dependencies**: None (foundational task)

## Objective

Add API endpoint to the Node Provider app that allows registration of compute resources (VM specifications) with GPU/CPU/RAM/HDD details and basic validation.

## Current State Analysis

### What Exists
- ✅ Node Provider app with basic structure
- ✅ Applications system for modular features
- ✅ Store-based state management (MobX)
- ✅ API package with standardized patterns
- ✅ TypeScript configuration

### What's Missing
- ❌ Resource data models and types
- ❌ Resource registration API endpoint
- ❌ Resource store for state management
- ❌ Validation logic for resource specifications
- ❌ Error handling for registration failures

## Technical Analysis

### Architecture Integration
The resource registration system needs to integrate with the existing Node Provider architecture:

```typescript
// Current applications structure
apps/node-provider/src/applications/
├── NetworkTopology/
├── NodeConfigurationSteps/
└── Payouts/

// Will add:
└── ResourceManagement/     # New application for resource operations
```

### Data Model Requirements
Based on the DoD, we need to handle:
- **VM Resources**: Virtual machine specifications
- **GPU**: Graphics processing unit details
- **CPU**: Central processing unit specifications  
- **RAM**: Memory specifications
- **HDD**: Storage specifications

## Implementation Plan

### 1. Create Resource Type Definitions (1 hour)

**File**: `packages/api/src/ResourceManagementApi/types.ts`

```typescript
export interface ResourceSpecification {
  // VM identification
  id: string;
  name: string;
  description?: string;
  nodeProviderId: string;
  
  // Compute specifications
  cpu: CPUSpecification;
  gpu?: GPUSpecification[];
  ram: RAMSpecification;
  storage: StorageSpecification[];
  
  // Operational details
  status: ResourceStatus;
  availability: AvailabilityStatus;
  location?: GeographicLocation;
  pricing?: PricingModel;
  
  // Metadata
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CPUSpecification {
  cores: number;
  threads: number;
  baseFrequency: number; // GHz
  maxFrequency?: number; // GHz
  architecture: string; // x86_64, ARM64, etc.
  manufacturer: string; // Intel, AMD, etc.
  model: string;
}

export interface GPUSpecification {
  id: string;
  manufacturer: string; // NVIDIA, AMD, Intel
  model: string;
  memory: number; // GB
  memoryType: string; // GDDR6, HBM2, etc.
  computeCapability?: string; // CUDA version, etc.
  powerConsumption?: number; // Watts
}

export interface RAMSpecification {
  total: number; // GB
  available: number; // GB
  type: string; // DDR4, DDR5, etc.
  frequency: number; // MHz
  ecc: boolean; // Error-correcting code
}

export interface StorageSpecification {
  id: string;
  type: StorageType;
  capacity: number; // GB
  interface: string; // SATA, NVMe, etc.
  readSpeed?: number; // MB/s
  writeSpeed?: number; // MB/s
}

export enum StorageType {
  HDD = 'hdd',
  SSD = 'ssd',
  NVME = 'nvme',
  NETWORK = 'network'
}

export enum ResourceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  ERROR = 'error'
}

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  IN_USE = 'in_use',
  OFFLINE = 'offline'
}
```

**Why This Structure**:
- **Comprehensive**: Covers all required specifications from DoD
- **Extensible**: Can add more fields without breaking existing code
- **Typed**: Strong TypeScript typing for validation
- **Realistic**: Reflects real VM specifications
- **Future-proof**: Includes fields for reservation system (Task 2)

### 2. Create Resource Validation (1 hour)

**File**: `packages/api/src/ResourceManagementApi/validation.ts`

```typescript
import * as yup from 'yup';
import { ResourceSpecification, StorageType } from './types';

export const resourceSpecificationSchema = yup.object<ResourceSpecification>({
  name: yup.string()
    .required('Resource name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be less than 50 characters'),
    
  description: yup.string()
    .max(500, 'Description must be less than 500 characters'),
    
  nodeProviderId: yup.string()
    .required('Node provider ID is required'),
    
  cpu: yup.object({
    cores: yup.number()
      .required('CPU cores required')
      .min(1, 'Must have at least 1 core')
      .max(256, 'Cannot exceed 256 cores'),
      
    threads: yup.number()
      .required('CPU threads required')
      .min(1, 'Must have at least 1 thread'),
      
    baseFrequency: yup.number()
      .required('Base frequency required')
      .min(0.1, 'Frequency must be positive')
      .max(10, 'Frequency cannot exceed 10 GHz'),
      
    architecture: yup.string()
      .required('Architecture required')
      .oneOf(['x86_64', 'ARM64', 'RISC-V'], 'Invalid architecture'),
      
    manufacturer: yup.string()
      .required('Manufacturer required'),
      
    model: yup.string()
      .required('Model required')
  }).required(),
  
  ram: yup.object({
    total: yup.number()
      .required('Total RAM required')
      .min(1, 'Must have at least 1 GB RAM')
      .max(2048, 'Cannot exceed 2048 GB RAM'),
      
    available: yup.number()
      .required('Available RAM required')
      .min(0, 'Available RAM cannot be negative')
      .max(yup.ref('total'), 'Available cannot exceed total'),
      
    type: yup.string()
      .required('RAM type required')
      .oneOf(['DDR3', 'DDR4', 'DDR5', 'HBM2'], 'Invalid RAM type'),
      
    frequency: yup.number()
      .required('Frequency required')
      .min(800, 'Frequency too low')
      .max(8000, 'Frequency too high'),
      
    ecc: yup.boolean()
      .required('ECC specification required')
  }).required(),
  
  storage: yup.array()
    .of(yup.object({
      type: yup.string()
        .required('Storage type required')
        .oneOf(Object.values(StorageType), 'Invalid storage type'),
        
      capacity: yup.number()
        .required('Capacity required')
        .min(1, 'Must have at least 1 GB')
        .max(100000, 'Cannot exceed 100 TB'),
        
      interface: yup.string()
        .required('Interface required')
    }))
    .min(1, 'Must have at least one storage device')
    .required(),
    
  gpu: yup.array()
    .of(yup.object({
      manufacturer: yup.string()
        .required('GPU manufacturer required'),
        
      model: yup.string()
        .required('GPU model required'),
        
      memory: yup.number()
        .required('GPU memory required')
        .min(1, 'Must have at least 1 GB')
        .max(128, 'Cannot exceed 128 GB'),
        
      memoryType: yup.string()
        .required('Memory type required')
    }))
});

export const validateResourceSpecification = async (resource: Partial<ResourceSpecification>): Promise<ResourceSpecification> => {
  try {
    return await resourceSpecificationSchema.validate(resource, { abortEarly: false });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      throw new ResourceValidationError(error.errors);
    }
    throw error;
  }
};

export class ResourceValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Resource validation failed: ${errors.join(', ')}`);
    this.name = 'ResourceValidationError';
  }
}
```

**Why This Validation**:
- **Comprehensive**: Validates all required fields from DoD
- **Realistic Constraints**: Reasonable limits for real hardware
- **User-Friendly**: Clear error messages for developers
- **Extensible**: Easy to add more validation rules
- **Type-Safe**: Leverages TypeScript for compile-time checking

### 3. Create Resource API Client (1.5 hours)

**File**: `packages/api/src/ResourceManagementApi/ResourceApi.ts`

```typescript
import { ApiClient } from '../ApiClient';
import { ResourceSpecification, validateResourceSpecification } from './';

export class ResourceManagementApi {
  constructor(private apiClient: ApiClient) {}

  async registerResource(resourceData: Partial<ResourceSpecification>): Promise<ResourceSpecification> {
    // Validate before sending
    const validatedResource = await validateResourceSpecification(resourceData);
    
    try {
      const response = await this.apiClient.post<ResourceSpecification>(
        '/api/resources',
        validatedResource
      );
      
      return response;
    } catch (error) {
      throw new ResourceRegistrationError(`Failed to register resource: ${error.message}`);
    }
  }

  async getResources(nodeProviderId?: string): Promise<ResourceSpecification[]> {
    const params = nodeProviderId ? { nodeProviderId } : {};
    
    try {
      return await this.apiClient.get<ResourceSpecification[]>('/api/resources', { params });
    } catch (error) {
      throw new ResourceApiError(`Failed to fetch resources: ${error.message}`);
    }
  }

  async getResource(resourceId: string): Promise<ResourceSpecification> {
    try {
      return await this.apiClient.get<ResourceSpecification>(`/api/resources/${resourceId}`);
    } catch (error) {
      throw new ResourceApiError(`Failed to fetch resource: ${error.message}`);
    }
  }

  async updateResource(resourceId: string, updates: Partial<ResourceSpecification>): Promise<ResourceSpecification> {
    try {
      return await this.apiClient.put<ResourceSpecification>(`/api/resources/${resourceId}`, updates);
    } catch (error) {
      throw new ResourceApiError(`Failed to update resource: ${error.message}`);
    }
  }

  async deleteResource(resourceId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/api/resources/${resourceId}`);
    } catch (error) {
      throw new ResourceApiError(`Failed to delete resource: ${error.message}`);
    }
  }
}

export class ResourceRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceRegistrationError';
  }
}

export class ResourceApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceApiError';
  }
}

// Export configured instance
export const resourceApi = new ResourceManagementApi(
  new ApiClient(process.env.VITE_CLUSTER_MANAGEMENT_ENDPOINT || '')
);
```

**Integration Notes**:
- Uses existing `ApiClient` pattern from `packages/api`
- Follows established error handling patterns
- Provides both instance and class exports for flexibility
- Uses existing environment variables for endpoint configuration

### 4. Create Resource Store (1.5 hours)

**File**: `apps/node-provider/src/stores/ResourceStore/index.ts`

```typescript
import { observable, action, computed, makeObservable, runInAction } from 'mobx';
import { ResourceSpecification, resourceApi, ResourceRegistrationError } from '@cluster-apps/api';

export class ResourceStore {
  @observable resources: ResourceSpecification[] = [];
  @observable loading = false;
  @observable error: string | null = null;
  @observable registering = false;

  constructor() {
    makeObservable(this);
  }

  @computed
  get hasResources(): boolean {
    return this.resources.length > 0;
  }

  @computed
  get availableResources(): ResourceSpecification[] {
    return this.resources.filter(resource => 
      resource.availability === 'available' && resource.status === 'active'
    );
  }

  @computed
  get resourcesByStatus() {
    return this.resources.reduce((acc, resource) => {
      acc[resource.status] = (acc[resource.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  @action
  async loadResources(nodeProviderId?: string): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const resources = await resourceApi.getResources(nodeProviderId);
      
      runInAction(() => {
        this.resources = resources;
        this.loading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load resources';
        this.loading = false;
      });
    }
  }

  @action
  async registerResource(resourceData: Partial<ResourceSpecification>): Promise<ResourceSpecification | null> {
    this.registering = true;
    this.error = null;

    try {
      const newResource = await resourceApi.registerResource(resourceData);
      
      runInAction(() => {
        this.resources.push(newResource);
        this.registering = false;
      });

      return newResource;
    } catch (error) {
      runInAction(() => {
        if (error instanceof ResourceRegistrationError) {
          this.error = error.message;
        } else {
          this.error = 'Failed to register resource';
        }
        this.registering = false;
      });
      
      return null;
    }
  }

  @action
  async updateResource(resourceId: string, updates: Partial<ResourceSpecification>): Promise<boolean> {
    this.error = null;

    try {
      const updatedResource = await resourceApi.updateResource(resourceId, updates);
      
      runInAction(() => {
        const index = this.resources.findIndex(r => r.id === resourceId);
        if (index !== -1) {
          this.resources[index] = updatedResource;
        }
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to update resource';
      });
      
      return false;
    }
  }

  @action
  async deleteResource(resourceId: string): Promise<boolean> {
    this.error = null;

    try {
      await resourceApi.deleteResource(resourceId);
      
      runInAction(() => {
        this.resources = this.resources.filter(r => r.id !== resourceId);
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to delete resource';
      });
      
      return false;
    }
  }

  @action
  clearError(): void {
    this.error = null;
  }
}
```

**Store Integration**:
- Follows existing MobX patterns from other stores
- Provides computed values for common queries
- Handles loading and error states appropriately
- Integrates with the API layer cleanly

### 5. Mock API Implementation (1 hour)

Since this is the initial implementation, we need a mock API that simulates the backend:

**File**: `apps/node-provider/src/api/mockResourceApi.ts`

```typescript
import { ResourceSpecification, ResourceStatus, AvailabilityStatus, StorageType } from '@cluster-apps/api';

// Mock data store
const mockResources: ResourceSpecification[] = [];
let nextId = 1;

export const mockResourceApi = {
  async registerResource(resourceData: Partial<ResourceSpecification>): Promise<ResourceSpecification> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const newResource: ResourceSpecification = {
      id: `resource-${nextId++}`,
      name: resourceData.name!,
      description: resourceData.description,
      nodeProviderId: resourceData.nodeProviderId!,
      cpu: resourceData.cpu!,
      gpu: resourceData.gpu,
      ram: resourceData.ram!,
      storage: resourceData.storage!,
      status: ResourceStatus.ACTIVE,
      availability: AvailabilityStatus.AVAILABLE,
      location: resourceData.location,
      pricing: resourceData.pricing,
      tags: resourceData.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockResources.push(newResource);
    return newResource;
  },

  async getResources(nodeProviderId?: string): Promise<ResourceSpecification[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (nodeProviderId) {
      return mockResources.filter(r => r.nodeProviderId === nodeProviderId);
    }
    
    return [...mockResources];
  },

  async getResource(resourceId: string): Promise<ResourceSpecification> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const resource = mockResources.find(r => r.id === resourceId);
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found`);
    }
    
    return resource;
  },

  async updateResource(resourceId: string, updates: Partial<ResourceSpecification>): Promise<ResourceSpecification> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const index = mockResources.findIndex(r => r.id === resourceId);
    if (index === -1) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    mockResources[index] = {
      ...mockResources[index],
      ...updates,
      updatedAt: new Date(),
    };

    return mockResources[index];
  },

  async deleteResource(resourceId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = mockResources.findIndex(r => r.id === resourceId);
    if (index === -1) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    mockResources.splice(index, 1);
  },
};

// Add some sample data for development
if (process.env.NODE_ENV === 'development') {
  mockResourceApi.registerResource({
    name: 'GPU Workstation 1',
    description: 'High-performance GPU workstation for ML training',
    nodeProviderId: 'node-provider-1',
    cpu: {
      cores: 16,
      threads: 32,
      baseFrequency: 3.2,
      maxFrequency: 4.8,
      architecture: 'x86_64',
      manufacturer: 'AMD',
      model: 'Ryzen 9 5950X',
    },
    gpu: [{
      id: 'gpu-1',
      manufacturer: 'NVIDIA',
      model: 'RTX 4090',
      memory: 24,
      memoryType: 'GDDR6X',
      computeCapability: '8.9',
      powerConsumption: 450,
    }],
    ram: {
      total: 64,
      available: 64,
      type: 'DDR4',
      frequency: 3200,
      ecc: false,
    },
    storage: [{
      id: 'storage-1',
      type: StorageType.NVME,
      capacity: 2000,
      interface: 'PCIe 4.0',
      readSpeed: 7000,
      writeSpeed: 6500,
    }],
  });
}
```

### Integration with Node Provider App

**File**: `apps/node-provider/src/stores/index.ts`

```typescript
export * from './AppStore';
export * from './AccountStore';
export * from './QuestsStore';
export * from './DdcBlockchainStore';
export * from './NodeConfigurationStore';
export * from './ResourceStore'; // Add new store
```

**File**: `apps/node-provider/src/stores/AppStore/index.ts`

```typescript
// Add to existing AppStore constructor
import { ResourceStore } from '../ResourceStore';

export class AppStore {
  // ... existing stores
  resourceStore: ResourceStore;

  constructor() {
    // ... existing initialization
    this.resourceStore = new ResourceStore();
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
// ResourceStore.test.ts
describe('ResourceStore', () => {
  it('should register resource successfully', async () => {
    const store = new ResourceStore();
    const resourceData = { /* valid resource data */ };
    
    const result = await store.registerResource(resourceData);
    
    expect(result).toBeTruthy();
    expect(store.resources).toHaveLength(1);
    expect(store.error).toBeNull();
  });

  it('should handle validation errors', async () => {
    const store = new ResourceStore();
    const invalidData = { name: '' }; // Invalid data
    
    const result = await store.registerResource(invalidData);
    
    expect(result).toBeNull();
    expect(store.error).toBeTruthy();
  });
});
```

### Integration Tests
```typescript
// ResourceApi.test.ts
describe('ResourceManagementApi', () => {
  it('should register resource with valid data', async () => {
    const api = new ResourceManagementApi(mockApiClient);
    const resourceData = { /* valid data */ };
    
    const result = await api.registerResource(resourceData);
    
    expect(result).toMatchObject(resourceData);
  });
});
```

## Definition of Done Verification

### ✅ Can register VM resources with GPU/CPU/RAM/HDD specs
- Resource registration API accepts all required specifications
- Type definitions cover GPU, CPU, RAM, and storage details
- Mock API simulates successful registration

### ✅ Basic validation
- Yup validation schema validates all resource fields
- Error messages provide clear feedback
- Type safety prevents invalid data structure

### ✅ API Integration
- Follows existing API patterns from `packages/api`
- Integrates with Node Provider store architecture
- Provides proper error handling and loading states

## Next Steps

This task provides the foundation for Task 2 (Resource Reservation System) by establishing:
1. **Data Models**: Resource specifications that can be reserved
2. **API Layer**: Endpoints that the reservation system can build upon
3. **State Management**: Store patterns for managing resource state
4. **Validation**: Ensures data integrity for reservation operations

The reservation system (Task 2) will extend this foundation by adding:
- Availability tracking over time
- Conflict detection for overlapping reservations
- Booking status management
- Time-based resource allocation 