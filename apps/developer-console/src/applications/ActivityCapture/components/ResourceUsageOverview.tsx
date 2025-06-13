import React from 'react';
import { Box, Card, CardContent, ChartWidget, Grid, Typography } from '@cluster-apps/ui';
import { subDays } from 'date-fns';

// Types for resource data
interface ResourceMetric {
  total: number;
  used: number;
}

interface ResourceCategory {
  cpu: ResourceMetric;
  memory: ResourceMetric;
  storage?: ResourceMetric;
  gpu?: ResourceMetric;
}

interface ResourceData {
  indexing: ResourceCategory;
  aiCompute: ResourceCategory;
}

interface ResourceUsageOverviewProps {
  resourceData: ResourceData;
}

// Generate mock history data for charts
const generateMockHistory = (current: number, total: number, days = 30) => {
  return Array.from({ length: days }).map((_, index) => {
    // Create a random usage pattern that trends toward the current value
    const daysFactor = (days - index) / days;
    const randomFactor = Math.random() * 0.2 - 0.1; // -10% to +10% random variation
    const value = Math.max(0, Math.min(total, current * (0.7 + daysFactor * 0.3) * (1 + randomFactor)));

    return {
      date: subDays(new Date(), days - index - 1),
      value,
    };
  });
};

// Format functions for different metrics
const formatCPU = (value: number) => `${Math.round(value)} Cores`;
const formatMemory = (value: number) => `${Math.round(value)} GB`;
const formatStorage = (value: number) => `${Math.round(value)} TB`;
const formatGPU = (value: number) => `${Math.round(value)} Units`;

const ResourceUsageOverview: React.FC<ResourceUsageOverviewProps> = ({ resourceData }) => {
  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Cluster Resources Usage
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Indexing Resources
        </Typography>
        <Grid container spacing={3} direction="column">
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <ChartWidget
                  title="CPU Usage"
                  value={`${resourceData.indexing.cpu.used} / ${resourceData.indexing.cpu.total} Cores`}
                  history={generateMockHistory(resourceData.indexing.cpu.used, resourceData.indexing.cpu.total)}
                  formatValue={formatCPU}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <ChartWidget
                  title="Memory Usage"
                  value={`${resourceData.indexing.memory.used} / ${resourceData.indexing.memory.total} GB`}
                  history={generateMockHistory(resourceData.indexing.memory.used, resourceData.indexing.memory.total)}
                  formatValue={formatMemory}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <ChartWidget
                  title="Storage Usage"
                  value={`${resourceData.indexing.storage?.used ?? 0} / ${resourceData.indexing.storage?.total ?? 0} TB`}
                  history={generateMockHistory(
                    resourceData.indexing.storage?.used ?? 0,
                    resourceData.indexing.storage?.total ?? 0,
                  )}
                  formatValue={formatStorage}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Box>
        <Typography variant="h4" gutterBottom>
          AI Compute Resources
        </Typography>
        <Grid container spacing={3} direction="column">
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <ChartWidget
                  title="CPU Usage"
                  value={`${resourceData.aiCompute.cpu.used} / ${resourceData.aiCompute.cpu.total} Cores`}
                  history={generateMockHistory(resourceData.aiCompute.cpu.used, resourceData.aiCompute.cpu.total)}
                  formatValue={formatCPU}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <ChartWidget
                  title="Memory Usage"
                  value={`${resourceData.aiCompute.memory.used} / ${resourceData.aiCompute.memory.total} GB`}
                  history={generateMockHistory(resourceData.aiCompute.memory.used, resourceData.aiCompute.memory.total)}
                  formatValue={formatMemory}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <ChartWidget
                  title="GPU Usage"
                  value={`${resourceData.aiCompute.gpu?.used ?? 0} / ${resourceData.aiCompute.gpu?.total ?? 0} Units`}
                  history={generateMockHistory(
                    resourceData.aiCompute.gpu?.used ?? 0,
                    resourceData.aiCompute.gpu?.total ?? 0,
                  )}
                  formatValue={formatGPU}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default ResourceUsageOverview;
