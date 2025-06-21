---
title: Task 4 - Basic Reservation Interface
description: UI for reserving resources in Developer Console
estimate: 4 hours
dependencies: [Task 1, Task 2, Task 3]
---

# Task 4: Basic Reservation Interface

**Target**: `apps/developer-console`  
**Estimate**: 4 hours  
**Dependencies**: All previous tasks

## Objective

Create a user interface in the Developer Console that allows developers to discover available resources and create reservations.

## Current State Analysis

### What Will Exist After Previous Tasks
- ✅ Resource registration and reservation APIs
- ✅ Conflict detection and availability tracking
- ✅ Resource management UI in Node Provider
- ✅ Complete backend foundation

### What's Missing for Developer Console
- ❌ Resource discovery interface
- ❌ Reservation booking forms
- ❌ Availability calendar/timeline
- ❌ Reservation management for developers

## Implementation Plan

### 1. Create Resource Reservation Application (1 hour)

**File**: `apps/developer-console/src/applications/ResourceReservation/index.tsx`

```typescript
import React from 'react';
import { Box, Container, Typography, Tabs, Tab } from '@mui/material';
import { Search, EventNote, History } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { useAppStore } from '~/hooks';
import { ResourceDiscovery } from './components/ResourceDiscovery';
import { MyReservations } from './components/MyReservations';
import { ReservationHistory } from './components/ReservationHistory';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 24 }}>
    {value === index && children}
  </div>
);

export const ResourceReservation: React.FC = observer(() => {
  const { reservationStore } = useAppStore();
  const [tabValue, setTabValue] = useState(0);

  React.useEffect(() => {
    // Load user's reservations on mount
    reservationStore.loadReservations({ userId: 'current-user' });
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Compute Resources
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Discover and reserve compute resources for your projects
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              label="Discover Resources" 
              icon={<Search />} 
              iconPosition="start"
            />
            <Tab 
              label="My Reservations" 
              icon={<EventNote />} 
              iconPosition="start"
            />
            <Tab 
              label="History" 
              icon={<History />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <ResourceDiscovery />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <MyReservations />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <ReservationHistory />
        </TabPanel>
      </Box>
    </Container>
  );
});

export default {
  rootPath: '/resources',
  rootComponent: ResourceReservation,
  title: 'Compute Resources',
  description: 'Discover and reserve compute resources',
  icon: <Search />,
};
```

### 2. Create Resource Discovery Component (1.5 hours)

**File**: `apps/developer-console/src/applications/ResourceReservation/components/ResourceDiscovery.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Chip, Button,
  TextField, MenuItem, InputAdornment, Alert
} from '@mui/material';
import { 
  Search, Computer, Memory, Storage, Speed, Schedule 
} from '@mui/icons-material';
import { observer } from 'mobx-react-lite';

import { useAppStore } from '~/hooks';
import { ResourceSpecification } from '@cluster-apps/api';
import { ReservationDialog } from './ReservationDialog';

interface FilterState {
  search: string;
  minCores: number;
  minRam: number;
  hasGpu: boolean;
  availability: string;
}

export const ResourceDiscovery: React.FC = observer(() => {
  const { resourceStore } = useAppStore();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    minCores: 0,
    minRam: 0,
    hasGpu: false,
    availability: 'all',
  });
  const [reservationOpen, setReservationOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceSpecification | null>(null);

  useEffect(() => {
    // Load all available resources
    resourceStore.loadResources();
  }, []);

  const filteredResources = resourceStore.resources.filter(resource => {
    if (filters.search && !resource.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.minCores > 0 && resource.cpu.cores < filters.minCores) {
      return false;
    }
    if (filters.minRam > 0 && resource.ram.total < filters.minRam) {
      return false;
    }
    if (filters.hasGpu && (!resource.gpu || resource.gpu.length === 0)) {
      return false;
    }
    if (filters.availability !== 'all' && resource.availability !== filters.availability) {
      return false;
    }
    return true;
  });

  const handleReserveClick = (resource: ResourceSpecification) => {
    setSelectedResource(resource);
    setReservationOpen(true);
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'success';
      case 'reserved': return 'info';
      case 'in_use': return 'warning';
      case 'offline': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Find Resources
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search resources..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Min CPU Cores"
                value={filters.minCores || ''}
                onChange={(e) => setFilters({ ...filters, minCores: parseInt(e.target.value) || 0 })}
              />
            </Grid>
            
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Min RAM (GB)"
                value={filters.minRam || ''}
                onChange={(e) => setFilters({ ...filters, minRam: parseInt(e.target.value) || 0 })}
              />
            </Grid>
            
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                select
                label="Availability"
                value={filters.availability}
                onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="reserved">Reserved</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Available Resources ({filteredResources.length})
        </Typography>
      </Box>

      {resourceStore.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {resourceStore.error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {filteredResources.map((resource) => (
          <Grid item xs={12} md={6} lg={4} key={resource.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" gutterBottom>
                    {resource.name}
                  </Typography>
                  <Chip 
                    size="small" 
                    label={resource.availability}
                    color={getAvailabilityColor(resource.availability) as any}
                  />
                </Box>

                <Box mb={2}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Computer fontSize="small" />
                    <Typography variant="body2">
                      {resource.cpu.cores} cores / {resource.cpu.threads} threads
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Memory fontSize="small" />
                    <Typography variant="body2">
                      {resource.ram.total}GB {resource.ram.type} RAM
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Storage fontSize="small" />
                    <Typography variant="body2">
                      {resource.storage.reduce((sum, s) => sum + s.capacity, 0)}GB storage
                    </Typography>
                  </Box>

                  {resource.gpu && resource.gpu.length > 0 && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Speed fontSize="small" />
                      <Typography variant="body2">
                        {resource.gpu.length}x {resource.gpu[0].model}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {resource.description && (
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {resource.description.length > 150 
                      ? `${resource.description.substring(0, 150)}...`
                      : resource.description
                    }
                  </Typography>
                )}
              </CardContent>
              
              <Box p={2} pt={0}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Schedule />}
                  onClick={() => handleReserveClick(resource)}
                  disabled={resource.availability !== 'available'}
                >
                  {resource.availability === 'available' ? 'Reserve' : 'Unavailable'}
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredResources.length === 0 && !resourceStore.loading && (
        <Box textAlign="center" py={8}>
          <Search sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Resources Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search criteria or check back later
          </Typography>
        </Box>
      )}

      <ReservationDialog
        open={reservationOpen}
        onClose={() => setReservationOpen(false)}
        resource={selectedResource}
      />
    </Box>
  );
});
```

### 3. Create Reservation Dialog (1 hour)

**File**: `apps/developer-console/src/applications/ResourceReservation/components/ReservationDialog.tsx`

```typescript
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, Alert, Box, Typography,
  FormControlLabel, Checkbox
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { observer } from 'mobx-react-lite';
import { useFormik } from 'formik';
import * as yup from 'yup';

import { useAppStore } from '~/hooks';
import { ResourceSpecification } from '@cluster-apps/api';

interface ReservationDialogProps {
  open: boolean;
  onClose: () => void;
  resource: ResourceSpecification | null;
}

const validationSchema = yup.object({
  startTime: yup.date().required('Start time is required').min(new Date(), 'Start time must be in the future'),
  endTime: yup.date().required('End time is required').min(yup.ref('startTime'), 'End time must be after start time'),
  purpose: yup.string().required('Purpose is required').min(10, 'Please provide more details'),
});

export const ReservationDialog: React.FC<ReservationDialogProps> = observer(({ 
  open, 
  onClose, 
  resource 
}) => {
  const { reservationStore } = useAppStore();

  const formik = useFormik({
    initialValues: {
      startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      purpose: '',
      description: '',
      requiresGpu: false,
      networkAccess: true,
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!resource) return;

      const duration = Math.floor((values.endTime.getTime() - values.startTime.getTime()) / (1000 * 60));
      
      const reservationData = {
        resourceId: resource.id,
        userId: 'current-user', // This would come from auth
        userEmail: 'user@example.com', // This would come from auth
        startTime: values.startTime,
        endTime: values.endTime,
        duration,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        purpose: values.purpose,
        description: values.description,
        requirements: {
          minimumGpuMemory: values.requiresGpu ? 8 : undefined,
          networkAccess: values.networkAccess,
        },
        status: 'pending' as const,
      };

      const success = await reservationStore.createReservation(reservationData);
      
      if (success) {
        onClose();
        formik.resetForm();
      }
    },
  });

  const calculateDuration = () => {
    if (formik.values.startTime && formik.values.endTime) {
      const duration = formik.values.endTime.getTime() - formik.values.startTime.getTime();
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    }
    return '';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={formik.handleSubmit}>
        <DialogTitle>
          Reserve Resource: {resource?.name}
        </DialogTitle>
        
        <DialogContent>
          {reservationStore.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {reservationStore.error}
            </Alert>
          )}

          {reservationStore.conflicts.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Reservation Conflicts:
              </Typography>
              {reservationStore.conflicts.map((conflict, index) => (
                <Typography key={index} variant="body2">
                  • {conflict.message}
                  {conflict.suggestion && ` - ${conflict.suggestion}`}
                </Typography>
              ))}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Reservation Details
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <DateTimePicker
                label="Start Time"
                value={formik.values.startTime}
                onChange={(value) => formik.setFieldValue('startTime', value)}
                renderInput={(props) => (
                  <TextField
                    {...props}
                    fullWidth
                    error={formik.touched.startTime && Boolean(formik.errors.startTime)}
                    helperText={formik.touched.startTime && formik.errors.startTime}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={6}>
              <DateTimePicker
                label="End Time"
                value={formik.values.endTime}
                onChange={(value) => formik.setFieldValue('endTime', value)}
                renderInput={(props) => (
                  <TextField
                    {...props}
                    fullWidth
                    error={formik.touched.endTime && Boolean(formik.errors.endTime)}
                    helperText={formik.touched.endTime && formik.errors.endTime}
                  />
                )}
              />
            </Grid>

            {calculateDuration() && (
              <Grid item xs={12}>
                <Typography variant="body2" color="primary">
                  Duration: {calculateDuration()}
                </Typography>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="purpose"
                label="Purpose"
                placeholder="Describe what you'll use this resource for..."
                value={formik.values.purpose}
                onChange={formik.handleChange}
                error={formik.touched.purpose && Boolean(formik.errors.purpose)}
                helperText={formik.touched.purpose && formik.errors.purpose}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                name="description"
                label="Additional Details (Optional)"
                placeholder="Any additional information about your requirements..."
                value={formik.values.description}
                onChange={formik.handleChange}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Requirements
              </Typography>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formik.values.requiresGpu}
                    onChange={formik.handleChange}
                    name="requiresGpu"
                  />
                }
                label="Requires GPU access"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formik.values.networkAccess}
                    onChange={formik.handleChange}
                    name="networkAccess"
                  />
                }
                label="Requires network access"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained"
            disabled={reservationStore.creating}
          >
            Create Reservation
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
});
```

### 4. Add to Developer Console Applications (0.5 hours)

**File**: `apps/developer-console/src/applications/index.ts` (extend existing)

```typescript
// Add the ResourceReservation import and include in applications array
import resourceReservation from './ResourceReservation';

const applications: Application[] = [
  // ... existing applications
  resourceReservation, // Add to the end
];
```

**File**: `apps/developer-console/src/stores/AppStore/index.ts` (extend existing)

```typescript
// Add ReservationStore to Developer Console AppStore
import { ReservationStore, ResourceStore } from '@cluster-apps/api';

export class AppStore {
  // ... existing stores
  resourceStore: ResourceStore;
  reservationStore: ReservationStore;

  constructor() {
    // ... existing initialization
    this.resourceStore = new ResourceStore();
    this.reservationStore = new ReservationStore();
  }
}
```

## Definition of Done Verification

### ✅ Can create reservations
- Reservation dialog allows time selection
- Form validation prevents invalid reservations
- Integration with reservation API

### ✅ View current bookings
- My Reservations tab shows user's reservations
- Displays reservation status and details
- Allows cancellation of future reservations

### ✅ Resource discovery
- Search and filter available resources
- Display resource specifications
- Show availability status

## Complete System Integration

After completing all four tasks, the system provides:

1. **Node Providers** can:
   - Register compute resources with detailed specs
   - View resource utilization and reservations
   - Manage availability and settings

2. **Developers** can:
   - Discover available compute resources
   - Create time-based reservations
   - Manage their bookings

3. **System** provides:
   - Conflict detection and prevention
   - Real-time availability tracking
   - Resource utilization analytics

This creates a complete end-to-end resource management system built on the existing cluster-apps infrastructure. 