import { useState } from 'react';
import { Box, Typography } from '@cluster-apps/ui';
import { Tabs, Tab } from '@mui/material';
import { observer } from 'mobx-react-lite';
import ResourceUsageOverview from './components/ResourceUsageOverview';
import ResourceAllocationForm from './components/ResourceAllocationForm';

// Mock data for resource usage
const mockResourceData = {
  indexing: {
    cpu: { total: 100, used: 65 },
    memory: { total: 1024, used: 768 }, // GB
    storage: { total: 100, used: 42 }, // TB
  },
  aiCompute: {
    cpu: { total: 128, used: 96 },
    memory: { total: 2048, used: 1536 }, // GB
    gpu: { total: 56, used: 32 },
  },
};

const ActivityCapture = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Customer Data Platform
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Manage your cluster resources and data sources for customer data processing
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Resource Overview" />
          <Tab label="Resource Allocation" />
        </Tabs>
      </Box>

      {activeTab === 0 && <ResourceUsageOverview resourceData={mockResourceData} />}

      {activeTab === 1 && <ResourceAllocationForm />}
    </Box>
  );
};

export default observer(ActivityCapture);
