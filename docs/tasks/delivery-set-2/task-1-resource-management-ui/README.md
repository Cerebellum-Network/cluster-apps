---
title: Task 3 - Resource Management UI
description: View and manage compute resources in Node Provider app
estimate: 6 hours
dependencies: [Task 1, Task 2]
---

# Task 3: Resource Management UI

**Target**: `apps/node-provider`  
**Estimate**: 6 hours  
**Dependencies**: Task 1 (Resource Registration), Task 2 (Reservation System)

## Objective

Create a user interface for node providers to view and manage their compute resources, including registration, availability tracking, and reservation management.

## Current State Analysis

### What Will Exist After Tasks 1 & 2
- ✅ Resource registration API and data models
- ✅ Reservation system with conflict detection
- ✅ Resource and Reservation stores for state management
- ✅ Validation and error handling

### What's Missing for UI
- ❌ Resource management application component
- ❌ Resource registration forms
- ❌ Resource list and detail views
- ❌ Availability calendar visualization
- ❌ Reservation management interface

## Implementation Plan

### 1. Create Resource Management Application (1.5 hours)

**File**: `apps/node-provider/src/applications/ResourceManagement/index.tsx`

```typescript
import React from 'react';
import { Box, Container, Typography, Tabs, Tab } from '@mui/material';
import { Computer, EventNote, Analytics } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { useAppStore } from '~/hooks';
import { ResourceList } from './components/ResourceList';
import { ResourceForm } from './components/ResourceForm';
import { ReservationManagement } from './components/ReservationManagement';
import { ResourceAnalytics } from './components/ResourceAnalytics';

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

export const ResourceManagement: React.FC = observer(() => {
  const { resourceStore, reservationStore } = useAppStore();
  const [tabValue, setTabValue] = useState(0);

  React.useEffect(() => {
    // Load resources and reservations on mount
    resourceStore.loadResources();
    reservationStore.loadReservations();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Resource Management
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              label="Resources" 
              icon={<Computer />} 
              iconPosition="start"
            />
            <Tab 
              label="Reservations" 
              icon={<EventNote />} 
              iconPosition="start"
            />
            <Tab 
              label="Analytics" 
              icon={<Analytics />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <ResourceList />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <ReservationManagement />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <ResourceAnalytics />
        </TabPanel>
      </Box>
    </Container>
  );
});

export default {
  rootPath: '/resource-management',
  rootComponent: ResourceManagement,
  title: 'Resource Management',
  description: 'Manage compute resources and reservations',
  icon: <Computer />,
};
```

### 2. Create Resource Registration Form (1.5 hours)

**File**: `apps/node-provider/src/applications/ResourceManagement/components/ResourceForm.tsx`

```typescript
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, MenuItem, IconButton,
  Box, Typography, Chip, Alert
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { useFormik } from 'formik';
import * as yup from 'yup';

import { useAppStore } from '~/hooks';
import { ResourceSpecification, StorageType } from '@cluster-apps/api';

interface ResourceFormProps {
  open: boolean;
  onClose: () => void;
  resource?: ResourceSpecification;
}

const validationSchema = yup.object({
  name: yup.string().required('Name is required').min(3, 'Name too short'),
  description: yup.string().max(500, 'Description too long'),
  cpu: yup.object({
    cores: yup.number().required('CPU cores required').min(1),
    threads: yup.number().required('CPU threads required').min(1),
    baseFrequency: yup.number().required('Base frequency required'),
    architecture: yup.string().required('Architecture required'),
    manufacturer: yup.string().required('Manufacturer required'),
    model: yup.string().required('Model required'),
  }),
  ram: yup.object({
    total: yup.number().required('Total RAM required').min(1),
    type: yup.string().required('RAM type required'),
    frequency: yup.number().required('Frequency required'),
  }),
});

export const ResourceForm: React.FC<ResourceFormProps> = observer(({ 
  open, 
  onClose, 
  resource 
}) => {
  const { resourceStore } = useAppStore();
  const [gpus, setGpus] = useState(resource?.gpu || []);
  const [storage, setStorage] = useState(resource?.storage || []);

  const formik = useFormik({
    initialValues: {
      name: resource?.name || '',
      description: resource?.description || '',
      cpu: {
        cores: resource?.cpu.cores || 4,
        threads: resource?.cpu.threads || 8,
        baseFrequency: resource?.cpu.baseFrequency || 3.0,
        architecture: resource?.cpu.architecture || 'x86_64',
        manufacturer: resource?.cpu.manufacturer || '',
        model: resource?.cpu.model || '',
      },
      ram: {
        total: resource?.ram.total || 16,
        type: resource?.ram.type || 'DDR4',
        frequency: resource?.ram.frequency || 3200,
        ecc: resource?.ram.ecc || false,
      },
    },
    validationSchema,
    onSubmit: async (values) => {
      const resourceData = {
        ...values,
        gpu: gpus,
        storage,
        nodeProviderId: 'current-user', // This would come from auth
      };

      const success = resource 
        ? await resourceStore.updateResource(resource.id, resourceData)
        : await resourceStore.registerResource(resourceData);

      if (success) {
        onClose();
      }
    },
  });

  const addGpu = () => {
    setGpus([...gpus, {
      id: `gpu-${Date.now()}`,
      manufacturer: 'NVIDIA',
      model: '',
      memory: 8,
      memoryType: 'GDDR6',
    }]);
  };

  const removeGpu = (index: number) => {
    setGpus(gpus.filter((_, i) => i !== index));
  };

  const addStorage = () => {
    setStorage([...storage, {
      id: `storage-${Date.now()}`,
      type: StorageType.SSD,
      capacity: 500,
      interface: 'SATA',
    }]);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={formik.handleSubmit}>
        <DialogTitle>
          {resource ? 'Edit Resource' : 'Register New Resource'}
        </DialogTitle>
        
        <DialogContent>
          {resourceStore.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {resourceStore.error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Basic Info */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Basic Information</Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="name"
                label="Resource Name"
                value={formik.values.name}
                onChange={formik.handleChange}
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={formik.touched.name && formik.errors.name}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                name="description"
                label="Description"
                value={formik.values.description}
                onChange={formik.handleChange}
              />
            </Grid>

            {/* CPU Specs */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>CPU Specifications</Typography>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                type="number"
                name="cpu.cores"
                label="Cores"
                value={formik.values.cpu.cores}
                onChange={formik.handleChange}
              />
            </Grid>
            
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                type="number"
                name="cpu.threads"
                label="Threads"
                value={formik.values.cpu.threads}
                onChange={formik.handleChange}
              />
            </Grid>
            
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                type="number"
                name="cpu.baseFrequency"
                label="Base Frequency (GHz)"
                value={formik.values.cpu.baseFrequency}
                onChange={formik.handleChange}
              />
            </Grid>
            
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                select
                name="cpu.architecture"
                label="Architecture"
                value={formik.values.cpu.architecture}
                onChange={formik.handleChange}
              >
                <MenuItem value="x86_64">x86_64</MenuItem>
                <MenuItem value="ARM64">ARM64</MenuItem>
              </TextField>
            </Grid>

            {/* RAM Specs */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>RAM Specifications</Typography>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                type="number"
                name="ram.total"
                label="Total RAM (GB)"
                value={formik.values.ram.total}
                onChange={formik.handleChange}
              />
            </Grid>
            
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                select
                name="ram.type"
                label="RAM Type"
                value={formik.values.ram.type}
                onChange={formik.handleChange}
              >
                <MenuItem value="DDR4">DDR4</MenuItem>
                <MenuItem value="DDR5">DDR5</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained"
            disabled={resourceStore.registering}
          >
            {resource ? 'Update' : 'Register'} Resource
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
});
```

### 3. Create Resource List Component (2 hours)

**File**: `apps/node-provider/src/applications/ResourceManagement/components/ResourceList.tsx`

```typescript
import React, { useState } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Chip, Button,
  IconButton, Menu, MenuItem, Alert, CircularProgress
} from '@mui/material';
import { 
  Add, MoreVert, Edit, Delete, Computer, Memory, 
  Storage, Speed, Visibility 
} from '@mui/icons-material';
import { observer } from 'mobx-react-lite';

import { useAppStore } from '~/hooks';
import { ResourceSpecification } from '@cluster-apps/api';
import { ResourceForm } from './ResourceForm';
import { ResourceDetails } from './ResourceDetails';

export const ResourceList: React.FC = observer(() => {
  const { resourceStore } = useAppStore();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceSpecification | undefined>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuResource, setMenuResource] = useState<ResourceSpecification | null>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, resource: ResourceSpecification) => {
    setAnchorEl(event.currentTarget);
    setMenuResource(resource);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuResource(null);
  };

  const handleEdit = () => {
    setSelectedResource(menuResource || undefined);
    setFormOpen(true);
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (menuResource) {
      await resourceStore.deleteResource(menuResource.id);
    }
    handleMenuClose();
  };

  const handleViewDetails = () => {
    setSelectedResource(menuResource || undefined);
    setDetailsOpen(true);
    handleMenuClose();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'maintenance': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
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

  if (resourceStore.loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Your Resources ({resourceStore.resources.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setSelectedResource(undefined);
            setFormOpen(true);
          }}
        >
          Register Resource
        </Button>
      </Box>

      {resourceStore.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {resourceStore.error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {resourceStore.resources.map((resource) => (
          <Grid item xs={12} md={6} lg={4} key={resource.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom>
                      {resource.name}
                    </Typography>
                    
                    <Box display="flex" gap={1} mb={2}>
                      <Chip 
                        size="small" 
                        label={resource.status} 
                        color={getStatusColor(resource.status) as any}
                      />
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
                          {resource.cpu.cores} cores, {resource.cpu.threads} threads
                        </Typography>
                      </Box>
                      
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Memory fontSize="small" />
                        <Typography variant="body2">
                          {resource.ram.total}GB {resource.ram.type}
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
                            {resource.gpu.length}x GPU ({resource.gpu[0].model})
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {resource.description && (
                      <Typography variant="body2" color="text.secondary">
                        {resource.description.length > 100 
                          ? `${resource.description.substring(0, 100)}...`
                          : resource.description
                        }
                      </Typography>
                    )}
                  </Box>
                  
                  <IconButton
                    onClick={(e) => handleMenuClick(e, resource)}
                    size="small"
                  >
                    <MoreVert />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {resourceStore.resources.length === 0 && !resourceStore.loading && (
        <Box textAlign="center" py={8}>
          <Computer sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Resources Registered
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Register your first compute resource to start accepting reservations
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setFormOpen(true)}
          >
            Register Your First Resource
          </Button>
        </Box>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      <ResourceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        resource={selectedResource}
      />

      <ResourceDetails
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        resource={selectedResource}
      />
    </Box>
  );
});
```

### 4. Add to Applications Index (1 hour)

**File**: `apps/node-provider/src/applications/index.ts` (extend existing)

```typescript
import { Application } from './types';

import networkTopology from './NetworkTopology';
import configureNode from './NodeConfigurationSteps/ConfigureNode';
import validationAndStaking from './NodeConfigurationSteps/ValidationAndStaking';
import congratulation from './NodeConfigurationSteps/Congratulation';
import payouts from './Payouts';
import resourceManagement from './ResourceManagement'; // Add new import

const applications: Application[] = [
  networkTopology, 
  configureNode, 
  validationAndStaking, 
  congratulation, 
  payouts,
  resourceManagement // Add to applications array
];

export * from './types';
export default applications;
```

## Definition of Done Verification

### ✅ List resources
- Resource list displays all registered resources
- Shows key specifications (CPU, RAM, storage, GPU)
- Displays status and availability

### ✅ Register new ones  
- Resource registration form with validation
- Supports all resource types from API
- Integrates with resource store

### ✅ View availability
- Shows current resource status
- Displays availability state
- Provides resource details view

## Next Steps

This UI provides the foundation for Task 4 (Basic Reservation Interface) by:
- Establishing UI patterns and components
- Providing resource discovery interface
- Setting up the visual framework for reservations 