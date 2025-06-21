---
title: Task 2 - Resource Reservation System
description: Simple resource booking with availability tracking and conflict detection
estimate: 8 hours
dependencies: [Task 1]
---

# Task 2: Resource Reservation System (Basic)

**Target**: `apps/node-provider`  
**Estimate**: 8 hours  
**Dependencies**: Task 1 (Resource Registration Endpoint)

## Objective

Build a simple resource booking system that can reserve/release resources with basic conflict detection and availability tracking.

## Current State Analysis

### What Will Exist After Task 1
- ✅ Resource registration API and data models
- ✅ Resource store with basic CRUD operations
- ✅ Resource validation and error handling
- ✅ Mock API for development

### What's Missing for Reservations
- ❌ Reservation data models and types
- ❌ Time-based availability tracking
- ❌ Conflict detection algorithms
- ❌ Reservation API endpoints
- ❌ Reservation state management
- ❌ Resource availability queries

## Technical Analysis

### Reservation System Requirements
1. **Time-Based Booking**: Resources can be reserved for specific time periods
2. **Conflict Detection**: Prevent overlapping reservations for the same resource
3. **Availability Tracking**: Show resource availability over time
4. **Reservation Management**: Create, update, cancel reservations
5. **Status Tracking**: Monitor reservation states (pending, active, completed, cancelled)

### Integration with Task 1
The reservation system builds on the resource registration foundation:
- Uses `ResourceSpecification` types for resource identification
- Extends the `ResourceStore` with reservation capabilities
- Adds reservation-specific API endpoints to the existing resource API
- Integrates with the established validation and error handling patterns

## Implementation Plan

### 1. Extend Resource Types with Reservation Models (1.5 hours)

**File**: `packages/api/src/ResourceManagementApi/types.ts` (extend existing)

```typescript
// Add to existing types.ts file

export interface ResourceReservation {
  id: string;
  resourceId: string;
  userId: string;
  userEmail?: string;
  
  // Time management
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  timezone: string;
  
  // Reservation details
  purpose: string;
  description?: string;
  requirements?: ReservationRequirements;
  
  // Status tracking
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  
  // Billing/Usage
  estimatedCost?: number;
  actualCost?: number;
  usageMetrics?: UsageMetrics;
}

export interface ReservationRequirements {
  // Specific requirements for the reservation
  minimumGpuMemory?: number;
  requiredSoftware?: string[];
  networkAccess?: boolean;
  storageNeeds?: number; // GB
  customSetupScript?: string;
}

export interface UsageMetrics {
  cpuUtilization?: number;
  gpuUtilization?: number;
  memoryUsage?: number;
  networkTraffic?: number;
  storageUsed?: number;
}

export enum ReservationStatus {
  PENDING = 'pending',       // Waiting for confirmation
  CONFIRMED = 'confirmed',   // Reservation confirmed
  ACTIVE = 'active',        // Currently active
  COMPLETED = 'completed',   // Successfully completed
  CANCELLED = 'cancelled',   // Cancelled by user
  EXPIRED = 'expired',      // Time expired without activation
  FAILED = 'failed'         // Failed to start
}

export interface AvailabilitySlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
  reservationId?: string;
  reason?: string; // Why not available
}

export interface ResourceAvailability {
  resourceId: string;
  queryStart: Date;
  queryEnd: Date;
  slots: AvailabilitySlot[];
  totalAvailableHours: number;
  utilizationRate: number; // percentage
}

export interface ReservationConflict {
  type: ConflictType;
  message: string;
  conflictingReservations: string[]; // Reservation IDs
  suggestion?: string;
}

export enum ConflictType {
  TIME_OVERLAP = 'time_overlap',
  RESOURCE_MAINTENANCE = 'resource_maintenance',
  RESOURCE_OFFLINE = 'resource_offline',
  MAXIMUM_DURATION_EXCEEDED = 'max_duration_exceeded',
  INVALID_TIME_RANGE = 'invalid_time_range'
}

// Extend existing ResourceSpecification
export interface ResourceSpecification {
  // ... existing fields from Task 1
  
  // Add reservation-related fields
  reservationSettings?: ReservationSettings;
  currentReservation?: string; // Current reservation ID if any
  nextAvailableTime?: Date;
  maintenanceSchedule?: MaintenanceWindow[];
}

export interface ReservationSettings {
  allowBooking: boolean;
  minimumReservationDuration: number; // minutes
  maximumReservationDuration: number; // minutes  
  advanceBookingLimit: number; // days
  cancellationPolicy: CancellationPolicy;
  autoConfirm: boolean;
  bufferTime: number; // minutes between reservations
}

export interface MaintenanceWindow {
  id: string;
  startTime: Date;
  endTime: Date;
  type: MaintenanceType;
  description: string;
  recurring: boolean;
}

export enum MaintenanceType {
  SCHEDULED = 'scheduled',
  EMERGENCY = 'emergency',
  UPDATE = 'update',
  REPAIR = 'repair'
}

export interface CancellationPolicy {
  allowCancellation: boolean;
  cancellationDeadline: number; // hours before start
  refundPolicy: RefundPolicy;
}

export enum RefundPolicy {
  FULL_REFUND = 'full_refund',
  PARTIAL_REFUND = 'partial_refund',
  NO_REFUND = 'no_refund'
}
```

**Why This Structure**:
- **Time-Centric**: Built around time-based reservations
- **Conflict-Aware**: Explicit conflict detection types
- **Flexible**: Supports various reservation scenarios
- **Extensible**: Easy to add more reservation features
- **Real-World**: Includes practical considerations like maintenance windows

### 2. Create Reservation Validation (1 hour)

**File**: `packages/api/src/ResourceManagementApi/reservationValidation.ts`

```typescript
import * as yup from 'yup';
import { ResourceReservation, ReservationStatus } from './types';

export const reservationSchema = yup.object<ResourceReservation>({
  resourceId: yup.string()
    .required('Resource ID is required'),
    
  userId: yup.string()
    .required('User ID is required'),
    
  userEmail: yup.string()
    .email('Invalid email format'),
    
  startTime: yup.date()
    .required('Start time is required')
    .min(new Date(), 'Start time must be in the future'),
    
  endTime: yup.date()
    .required('End time is required')
    .min(yup.ref('startTime'), 'End time must be after start time'),
    
  duration: yup.number()
    .required('Duration is required')
    .min(15, 'Minimum reservation is 15 minutes')
    .max(7 * 24 * 60, 'Maximum reservation is 7 days'),
    
  timezone: yup.string()
    .required('Timezone is required'),
    
  purpose: yup.string()
    .required('Purpose is required')
    .min(10, 'Purpose must be at least 10 characters')
    .max(200, 'Purpose must be less than 200 characters'),
    
  description: yup.string()
    .max(1000, 'Description must be less than 1000 characters'),
    
  status: yup.string()
    .oneOf(Object.values(ReservationStatus), 'Invalid reservation status')
    .required('Status is required'),
});

export const validateReservation = async (reservation: Partial<ResourceReservation>): Promise<ResourceReservation> => {
  try {
    return await reservationSchema.validate(reservation, { abortEarly: false });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      throw new ReservationValidationError(error.errors);
    }
    throw error;
  }
};

export class ReservationValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Reservation validation failed: ${errors.join(', ')}`);
    this.name = 'ReservationValidationError';
  }
}

// Business logic validation
export const validateReservationBusinessRules = (
  reservation: ResourceReservation,
  resourceSettings: ReservationSettings
): ReservationConflict[] => {
  const conflicts: ReservationConflict[] = [];
  
  // Check if resource allows booking
  if (!resourceSettings.allowBooking) {
    conflicts.push({
      type: ConflictType.RESOURCE_OFFLINE,
      message: 'Resource is not accepting reservations',
      conflictingReservations: [],
      suggestion: 'Contact resource owner for availability'
    });
  }
  
  // Check duration limits
  if (reservation.duration < resourceSettings.minimumReservationDuration) {
    conflicts.push({
      type: ConflictType.INVALID_TIME_RANGE,
      message: `Reservation too short. Minimum: ${resourceSettings.minimumReservationDuration} minutes`,
      conflictingReservations: [],
    });
  }
  
  if (reservation.duration > resourceSettings.maximumReservationDuration) {
    conflicts.push({
      type: ConflictType.MAXIMUM_DURATION_EXCEEDED,
      message: `Reservation too long. Maximum: ${resourceSettings.maximumReservationDuration} minutes`,
      conflictingReservations: [],
    });
  }
  
  // Check advance booking limit
  const advanceBookingMs = resourceSettings.advanceBookingLimit * 24 * 60 * 60 * 1000;
  const maxAdvanceTime = new Date(Date.now() + advanceBookingMs);
  
  if (reservation.startTime > maxAdvanceTime) {
    conflicts.push({
      type: ConflictType.INVALID_TIME_RANGE,
      message: `Cannot book more than ${resourceSettings.advanceBookingLimit} days in advance`,
      conflictingReservations: [],
    });
  }
  
  return conflicts;
};
```

### 3. Create Conflict Detection Logic (2 hours)

**File**: `packages/api/src/ResourceManagementApi/conflictDetection.ts`

```typescript
import { ResourceReservation, ReservationConflict, ConflictType, MaintenanceWindow, ReservationSettings } from './types';

export class ConflictDetector {
  /**
   * Check for conflicts between a new reservation and existing reservations
   */
  static detectTimeConflicts(
    newReservation: Partial<ResourceReservation>,
    existingReservations: ResourceReservation[]
  ): ReservationConflict[] {
    const conflicts: ReservationConflict[] = [];
    
    if (!newReservation.startTime || !newReservation.endTime) {
      return conflicts;
    }
    
    const newStart = new Date(newReservation.startTime);
    const newEnd = new Date(newReservation.endTime);
    
    for (const existing of existingReservations) {
      // Skip cancelled, expired, or failed reservations
      if (['cancelled', 'expired', 'failed'].includes(existing.status)) {
        continue;
      }
      
      const existingStart = new Date(existing.startTime);
      const existingEnd = new Date(existing.endTime);
      
      // Check for overlap
      if (this.hasTimeOverlap(newStart, newEnd, existingStart, existingEnd)) {
        conflicts.push({
          type: ConflictType.TIME_OVERLAP,
          message: `Time conflicts with existing reservation ${existing.id}`,
          conflictingReservations: [existing.id],
          suggestion: this.suggestAlternativeTime(newStart, newEnd, existingStart, existingEnd)
        });
      }
    }
    
    return conflicts;
  }
  
  /**
   * Check for conflicts with maintenance windows
   */
  static detectMaintenanceConflicts(
    newReservation: Partial<ResourceReservation>,
    maintenanceWindows: MaintenanceWindow[]
  ): ReservationConflict[] {
    const conflicts: ReservationConflict[] = [];
    
    if (!newReservation.startTime || !newReservation.endTime) {
      return conflicts;
    }
    
    const newStart = new Date(newReservation.startTime);
    const newEnd = new Date(newReservation.endTime);
    
    for (const maintenance of maintenanceWindows) {
      const maintStart = new Date(maintenance.startTime);
      const maintEnd = new Date(maintenance.endTime);
      
      if (this.hasTimeOverlap(newStart, newEnd, maintStart, maintEnd)) {
        conflicts.push({
          type: ConflictType.RESOURCE_MAINTENANCE,
          message: `Conflicts with scheduled maintenance: ${maintenance.description}`,
          conflictingReservations: [],
          suggestion: `Avoid time slot from ${maintStart.toISOString()} to ${maintEnd.toISOString()}`
        });
      }
    }
    
    return conflicts;
  }
  
  /**
   * Check if two time ranges overlap
   */
  private static hasTimeOverlap(
    start1: Date, end1: Date,
    start2: Date, end2: Date
  ): boolean {
    return start1 < end2 && end1 > start2;
  }
  
  /**
   * Suggest alternative time slots
   */
  private static suggestAlternativeTime(
    newStart: Date, newEnd: Date,
    existingStart: Date, existingEnd: Date
  ): string {
    const duration = newEnd.getTime() - newStart.getTime();
    
    // Suggest before existing reservation
    const beforeSlot = new Date(existingStart.getTime() - duration);
    if (beforeSlot > new Date()) {
      return `Try booking from ${beforeSlot.toISOString()} to ${existingStart.toISOString()}`;
    }
    
    // Suggest after existing reservation
    const afterStart = new Date(existingEnd.getTime());
    const afterEnd = new Date(afterStart.getTime() + duration);
    return `Try booking from ${afterStart.toISOString()} to ${afterEnd.toISOString()}`;
  }
  
  /**
   * Apply buffer time between reservations
   */
  static applyBufferTime(
    reservations: ResourceReservation[],
    bufferMinutes: number
  ): ResourceReservation[] {
    return reservations.map(reservation => ({
      ...reservation,
      startTime: new Date(new Date(reservation.startTime).getTime() - bufferMinutes * 60 * 1000),
      endTime: new Date(new Date(reservation.endTime).getTime() + bufferMinutes * 60 * 1000),
    }));
  }
}

/**
 * Calculate resource availability for a given time period
 */
export class AvailabilityCalculator {
  static calculateAvailability(
    resourceId: string,
    queryStart: Date,
    queryEnd: Date,
    reservations: ResourceReservation[],
    maintenanceWindows: MaintenanceWindow[] = [],
    settings: ReservationSettings
  ): ResourceAvailability {
    const slots: AvailabilitySlot[] = [];
    const timeStep = 60 * 60 * 1000; // 1 hour intervals
    
    // Create hourly slots
    for (let time = queryStart.getTime(); time < queryEnd.getTime(); time += timeStep) {
      const slotStart = new Date(time);
      const slotEnd = new Date(time + timeStep);
      
      const slot: AvailabilitySlot = {
        startTime: slotStart,
        endTime: slotEnd,
        available: true,
      };
      
      // Check against reservations
      for (const reservation of reservations) {
        if (['cancelled', 'expired', 'failed'].includes(reservation.status)) {
          continue;
        }
        
        if (ConflictDetector.hasTimeOverlap(slotStart, slotEnd, 
            new Date(reservation.startTime), new Date(reservation.endTime))) {
          slot.available = false;
          slot.reservationId = reservation.id;
          slot.reason = `Reserved by ${reservation.userId}`;
          break;
        }
      }
      
      // Check against maintenance
      if (slot.available) {
        for (const maintenance of maintenanceWindows) {
          if (ConflictDetector.hasTimeOverlap(slotStart, slotEnd,
              new Date(maintenance.startTime), new Date(maintenance.endTime))) {
            slot.available = false;
            slot.reason = `Maintenance: ${maintenance.description}`;
            break;
          }
        }
      }
      
      slots.push(slot);
    }
    
    // Calculate metrics
    const availableSlots = slots.filter(s => s.available);
    const totalAvailableHours = availableSlots.length;
    const utilizationRate = ((slots.length - availableSlots.length) / slots.length) * 100;
    
    return {
      resourceId,
      queryStart,
      queryEnd,
      slots,
      totalAvailableHours,
      utilizationRate,
    };
  }
  
  /**
   * Find next available time slot of given duration
   */
  static findNextAvailableSlot(
    availability: ResourceAvailability,
    durationMinutes: number
  ): AvailabilitySlot | null {
    const requiredSlots = Math.ceil(durationMinutes / 60); // Convert to hours
    
    for (let i = 0; i <= availability.slots.length - requiredSlots; i++) {
      const consecutiveSlots = availability.slots.slice(i, i + requiredSlots);
      
      if (consecutiveSlots.every(slot => slot.available)) {
        return {
          startTime: consecutiveSlots[0].startTime,
          endTime: consecutiveSlots[consecutiveSlots.length - 1].endTime,
          available: true,
        };
      }
    }
    
    return null;
  }
}
```

### 4. Extend Resource API with Reservation Endpoints (2 hours)

**File**: `packages/api/src/ResourceManagementApi/ReservationApi.ts`

```typescript
import { ApiClient } from '../ApiClient';
import { 
  ResourceReservation, 
  ResourceAvailability, 
  ReservationConflict,
  ConflictDetector,
  AvailabilityCalculator,
  validateReservation,
  validateReservationBusinessRules
} from './';

export class ReservationApi {
  constructor(private apiClient: ApiClient) {}

  async createReservation(reservationData: Partial<ResourceReservation>): Promise<{
    reservation?: ResourceReservation;
    conflicts: ReservationConflict[];
  }> {
    try {
      // Validate reservation data
      const validatedReservation = await validateReservation(reservationData);
      
      // Check for conflicts
      const conflicts = await this.checkConflicts(validatedReservation);
      
      if (conflicts.length > 0) {
        return { conflicts };
      }
      
      // Create reservation
      const reservation = await this.apiClient.post<ResourceReservation>(
        '/api/reservations',
        validatedReservation
      );
      
      return { reservation, conflicts: [] };
    } catch (error) {
      throw new ReservationError(`Failed to create reservation: ${error.message}`);
    }
  }

  async getReservations(filters?: {
    resourceId?: string;
    userId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ResourceReservation[]> {
    try {
      return await this.apiClient.get<ResourceReservation[]>('/api/reservations', { 
        params: filters 
      });
    } catch (error) {
      throw new ReservationError(`Failed to fetch reservations: ${error.message}`);
    }
  }

  async getReservation(reservationId: string): Promise<ResourceReservation> {
    try {
      return await this.apiClient.get<ResourceReservation>(`/api/reservations/${reservationId}`);
    } catch (error) {
      throw new ReservationError(`Failed to fetch reservation: ${error.message}`);
    }
  }

  async updateReservation(
    reservationId: string, 
    updates: Partial<ResourceReservation>
  ): Promise<ResourceReservation> {
    try {
      return await this.apiClient.put<ResourceReservation>(
        `/api/reservations/${reservationId}`,
        updates
      );
    } catch (error) {
      throw new ReservationError(`Failed to update reservation: ${error.message}`);
    }
  }

  async cancelReservation(reservationId: string, reason?: string): Promise<void> {
    try {
      await this.apiClient.delete(`/api/reservations/${reservationId}`, {
        data: { reason }
      });
    } catch (error) {
      throw new ReservationError(`Failed to cancel reservation: ${error.message}`);
    }
  }

  async getResourceAvailability(
    resourceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ResourceAvailability> {
    try {
      return await this.apiClient.get<ResourceAvailability>(
        `/api/resources/${resourceId}/availability`,
        {
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          }
        }
      );
    } catch (error) {
      throw new ReservationError(`Failed to fetch availability: ${error.message}`);
    }
  }

  async checkConflicts(reservation: ResourceReservation): Promise<ReservationConflict[]> {
    try {
      // Get existing reservations for the resource
      const existingReservations = await this.getReservations({
        resourceId: reservation.resourceId,
        startDate: new Date(reservation.startTime.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        endDate: new Date(reservation.endTime.getTime() + 24 * 60 * 60 * 1000), // 1 day after
      });

      // Get resource settings (this would come from the resource API)
      const resourceSettings = await this.getResourceSettings(reservation.resourceId);
      
      const conflicts: ReservationConflict[] = [];
      
      // Time conflicts
      conflicts.push(...ConflictDetector.detectTimeConflicts(reservation, existingReservations));
      
      // Business rule conflicts  
      conflicts.push(...validateReservationBusinessRules(reservation, resourceSettings));
      
      return conflicts;
    } catch (error) {
      throw new ReservationError(`Failed to check conflicts: ${error.message}`);
    }
  }

  private async getResourceSettings(resourceId: string): Promise<ReservationSettings> {
    // This would be implemented to fetch resource settings
    // For now, return default settings
    return {
      allowBooking: true,
      minimumReservationDuration: 60, // 1 hour
      maximumReservationDuration: 7 * 24 * 60, // 7 days
      advanceBookingLimit: 30, // 30 days
      cancellationPolicy: {
        allowCancellation: true,
        cancellationDeadline: 24, // 24 hours
        refundPolicy: 'full_refund' as RefundPolicy,
      },
      autoConfirm: true,
      bufferTime: 15, // 15 minutes
    };
  }
}

export class ReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReservationError';
  }
}

// Export configured instance
export const reservationApi = new ReservationApi(
  new ApiClient(process.env.VITE_CLUSTER_MANAGEMENT_ENDPOINT || '')
);
```

### 5. Create Reservation Store (1.5 hours)

**File**: `apps/node-provider/src/stores/ReservationStore/index.ts`

```typescript
import { observable, action, computed, makeObservable, runInAction } from 'mobx';
import { 
  ResourceReservation, 
  ResourceAvailability, 
  ReservationConflict,
  reservationApi,
  ReservationError 
} from '@cluster-apps/api';

export class ReservationStore {
  @observable reservations: ResourceReservation[] = [];
  @observable availability: Map<string, ResourceAvailability> = new Map();
  @observable loading = false;
  @observable creating = false;
  @observable error: string | null = null;
  @observable conflicts: ReservationConflict[] = [];

  constructor() {
    makeObservable(this);
  }

  @computed
  get activeReservations(): ResourceReservation[] {
    return this.reservations.filter(r => r.status === 'active');
  }

  @computed
  get upcomingReservations(): ResourceReservation[] {
    const now = new Date();
    return this.reservations.filter(r => 
      r.status === 'confirmed' && new Date(r.startTime) > now
    );
  }

  @computed
  get reservationsByResource(): Map<string, ResourceReservation[]> {
    const map = new Map<string, ResourceReservation[]>();
    
    this.reservations.forEach(reservation => {
      const resourceReservations = map.get(reservation.resourceId) || [];
      resourceReservations.push(reservation);
      map.set(reservation.resourceId, resourceReservations);
    });
    
    return map;
  }

  @action
  async loadReservations(filters?: {
    resourceId?: string;
    userId?: string;
    status?: string;
  }): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const reservations = await reservationApi.getReservations(filters);
      
      runInAction(() => {
        this.reservations = reservations;
        this.loading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load reservations';
        this.loading = false;
      });
    }
  }

  @action
  async createReservation(reservationData: Partial<ResourceReservation>): Promise<ResourceReservation | null> {
    this.creating = true;
    this.error = null;
    this.conflicts = [];

    try {
      const result = await reservationApi.createReservation(reservationData);
      
      runInAction(() => {
        this.conflicts = result.conflicts;
        
        if (result.reservation) {
          this.reservations.push(result.reservation);
          this.creating = false;
          return result.reservation;
        } else {
          this.error = 'Reservation conflicts detected';
          this.creating = false;
          return null;
        }
      });
      
      return result.reservation || null;
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof ReservationError ? error.message : 'Failed to create reservation';
        this.creating = false;
      });
      
      return null;
    }
  }

  @action
  async updateReservation(
    reservationId: string, 
    updates: Partial<ResourceReservation>
  ): Promise<boolean> {
    this.error = null;

    try {
      const updatedReservation = await reservationApi.updateReservation(reservationId, updates);
      
      runInAction(() => {
        const index = this.reservations.findIndex(r => r.id === reservationId);
        if (index !== -1) {
          this.reservations[index] = updatedReservation;
        }
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to update reservation';
      });
      
      return false;
    }
  }

  @action
  async cancelReservation(reservationId: string, reason?: string): Promise<boolean> {
    this.error = null;

    try {
      await reservationApi.cancelReservation(reservationId, reason);
      
      runInAction(() => {
        const index = this.reservations.findIndex(r => r.id === reservationId);
        if (index !== -1) {
          this.reservations[index].status = 'cancelled';
          this.reservations[index].cancelledAt = new Date();
        }
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to cancel reservation';
      });
      
      return false;
    }
  }

  @action
  async loadResourceAvailability(
    resourceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const availability = await reservationApi.getResourceAvailability(resourceId, startDate, endDate);
      
      runInAction(() => {
        this.availability.set(resourceId, availability);
        this.loading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load availability';
        this.loading = false;
      });
    }
  }

  @computed
  getResourceAvailability(resourceId: string): ResourceAvailability | undefined {
    return this.availability.get(resourceId);
  }

  @action
  clearError(): void {
    this.error = null;
  }

  @action
  clearConflicts(): void {
    this.conflicts = [];
  }
}
```

### Integration with AppStore

**File**: `apps/node-provider/src/stores/AppStore/index.ts` (extend existing)

```typescript
// Add to existing AppStore
import { ReservationStore } from '../ReservationStore';

export class AppStore {
  // ... existing stores
  reservationStore: ReservationStore;

  constructor() {
    // ... existing initialization
    this.reservationStore = new ReservationStore();
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// ConflictDetector.test.ts
describe('ConflictDetector', () => {
  it('should detect time overlap conflicts', () => {
    const newReservation = {
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T12:00:00Z'),
    };
    
    const existingReservations = [{
      id: '1',
      startTime: new Date('2024-01-01T11:00:00Z'),
      endTime: new Date('2024-01-01T13:00:00Z'),
      status: 'confirmed',
    }];
    
    const conflicts = ConflictDetector.detectTimeConflicts(newReservation, existingReservations);
    
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('time_overlap');
  });

  it('should not detect conflicts for cancelled reservations', () => {
    const newReservation = {
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T12:00:00Z'),
    };
    
    const existingReservations = [{
      id: '1',
      startTime: new Date('2024-01-01T11:00:00Z'),
      endTime: new Date('2024-01-01T13:00:00Z'),
      status: 'cancelled',
    }];
    
    const conflicts = ConflictDetector.detectTimeConflicts(newReservation, existingReservations);
    
    expect(conflicts).toHaveLength(0);
  });
});

// ReservationStore.test.ts
describe('ReservationStore', () => {
  it('should create reservation successfully', async () => {
    const store = new ReservationStore();
    const reservationData = { /* valid data */ };
    
    const result = await store.createReservation(reservationData);
    
    expect(result).toBeTruthy();
    expect(store.reservations).toHaveLength(1);
    expect(store.conflicts).toHaveLength(0);
  });

  it('should handle conflicts during creation', async () => {
    const store = new ReservationStore();
    const conflictingData = { /* data that causes conflicts */ };
    
    const result = await store.createReservation(conflictingData);
    
    expect(result).toBeNull();
    expect(store.conflicts.length).toBeGreaterThan(0);
  });
});
```

## Definition of Done Verification

### ✅ Can reserve/release resources
- Reservation API provides create, update, cancel operations
- Store manages reservation state properly
- Mock API simulates reservation lifecycle

### ✅ Basic conflict detection
- Time overlap detection prevents double-booking
- Maintenance window conflicts are identified
- Business rule validation ensures valid reservations

### ✅ Availability tracking
- Resource availability calculated over time periods
- Real-time availability updates based on reservations
- Next available slot suggestions provided

### ✅ Integration with Task 1
- Builds on existing resource registration system
- Uses established API and store patterns
- Extends resource types with reservation capabilities

## Architecture Benefits

This implementation provides:

1. **Robust Conflict Detection**: Prevents double-booking and invalid reservations
2. **Flexible Time Management**: Supports various reservation durations and scheduling
3. **Extensible Design**: Easy to add more advanced features (recurring reservations, etc.)
4. **Real-time Availability**: Dynamic availability calculation based on current reservations
5. **Business Rule Support**: Configurable reservation policies per resource

## Next Steps for UI Tasks

The reservation system provides the foundation for Delivery Set 2:

**Task 3 (Resource Management UI)** will build on this by:
- Displaying resource availability calendars
- Showing current and upcoming reservations
- Providing reservation management interfaces

**Task 4 (Reservation Interface)** will use this by:
- Offering reservation booking forms
- Showing availability selection
- Handling conflict resolution workflows

Both UI tasks will consume the stores and APIs created in this task, providing a complete end-to-end resource management system. 