import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import {
  Box,
  Tabs,
  Tab,
  MenuItem,
  Select,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Memory as MemoryIcon,
  Speed as CpuIcon,
  Storage as StorageIcon,
  Hub as HubIcon,
  Timeline as TimelineIcon,
  Psychology as GpuIcon,
  AutoAwesome as ModelIcon,
} from '@mui/icons-material';

import clusterData from './mockClusterData.json';

// Summary Cards Component
const SummaryCards = ({ data, view, selected }: { data: any; view: string; selected: string }) => {
  const theme = useTheme();

  const getCurrentData = () => {
    if (view === 'overall') return data.overall;
    if (view === 'node' && selected) return data.byNode[selected];
    if (view === 'deployment' && selected) return data.byDeployment[selected];
    return null;
  };

  const currentData = getCurrentData();
  if (!currentData) return null;

  const latestCpu = currentData.cpu[currentData.cpu.length - 1]?.value || 0;
  const latestMemory = currentData.memory[currentData.memory.length - 1]?.value || 0;
  const latestGpu = currentData.gpu?.[currentData.gpu.length - 1]?.value || 0;
  const latestAgents = currentData.agents?.[currentData.agents.length - 1]?.value || 0;
  const latestDeployments = currentData.deployments?.[currentData.deployments.length - 1]?.value || 0;

  const cards = [
    {
      title: 'CPU Usage',
      value: `${latestCpu}%`,
      icon: <CpuIcon />,
      color: theme.palette.error.main,
      trend: currentData.cpu.length > 1 ? latestCpu - currentData.cpu[currentData.cpu.length - 2].value : 0,
    },
    {
      title: 'Memory Usage',
      value: `${latestMemory}%`,
      icon: <MemoryIcon />,
      color: theme.palette.warning.main,
      trend: currentData.memory.length > 1 ? latestMemory - currentData.memory[currentData.memory.length - 2].value : 0,
    },
    {
      title: 'GPU Usage',
      value: `${latestGpu}%`,
      icon: <GpuIcon />,
      color: theme.palette.info.main,
      trend: currentData.gpu?.length > 1 ? latestGpu - currentData.gpu[currentData.gpu.length - 2].value : 0,
    },
    {
      title: 'Active Agents',
      value: latestAgents.toLocaleString(),
      icon: <HubIcon />,
      color: theme.palette.primary.main,
      trend:
        currentData.agents?.length > 1 ? latestAgents - currentData.agents[currentData.agents.length - 2].value : 0,
    },
    {
      title: 'Deployments',
      value: latestDeployments.toLocaleString(),
      icon: <StorageIcon />,
      color: theme.palette.success.main,
      trend:
        currentData.deployments?.length > 1
          ? latestDeployments - currentData.deployments[currentData.deployments.length - 2].value
          : 0,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    backgroundColor: `${card.color}15`,
                    color: card.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography fontWeight="bold">{card.value}</Typography>
                  {card.trend !== 0 && (
                    <Chip
                      size="small"
                      label={`${card.trend > 0 ? '+' : ''}${card.trend.toFixed(1)}%`}
                      color={card.trend > 0 ? 'error' : 'success'}
                      variant="outlined"
                      sx={{ mt: 0.5, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// Model Metrics Component
const ModelMetrics = ({ data }: { data: any }) => {
  const theme = useTheme();

  const models = Object.keys(data.byModel || {});
  if (models.length === 0) return null;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ModelIcon />
          AI Model Performance
        </Typography>
        <Grid container spacing={2}>
          {models.map((modelName) => {
            const model = data.byModel[modelName];
            const latestHotness = model.hotness_score[model.hotness_score.length - 1]?.value || 0;
            const latestRps = model.rps[model.rps.length - 1]?.value || 0;
            const latestLatency = model.latency_p95[model.latency_p95.length - 1]?.value || 0;
            const latestQueueDepth = model.queue_depth[model.queue_depth.length - 1]?.value || 0;

            const getHotnessColor = (score: number) => {
              if (score > 0.8) return theme.palette.error.main;
              if (score > 0.6) return theme.palette.warning.main;
              return theme.palette.success.main;
            };

            const getHotnessLabel = (score: number) => {
              if (score > 0.8) return 'High Load';
              if (score > 0.6) return 'Medium Load';
              return 'Low Load';
            };

            return (
              <Grid item xs={12} md={6} lg={4} key={modelName}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                      <ModelIcon color="primary" />
                      <Typography sx={{ textTransform: 'capitalize' }}>{modelName.replace('-', ' ')}</Typography>
                    </Stack>

                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            Hotness Score
                          </Typography>
                          <Typography color={getHotnessColor(latestHotness)} fontWeight="bold">
                            {latestHotness.toFixed(2)}
                          </Typography>
                          <Chip
                            size="small"
                            label={getHotnessLabel(latestHotness)}
                            color={latestHotness > 0.8 ? 'error' : latestHotness > 0.6 ? 'warning' : 'success'}
                            variant="outlined"
                            sx={{ mt: 0.5, fontSize: '0.7rem' }}
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            RPS
                          </Typography>
                          <Typography fontWeight="bold">{latestRps.toFixed(1)}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            Latency P95
                          </Typography>
                          <Typography fontWeight="bold">{latestLatency}ms</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            Queue Depth
                          </Typography>
                          <Typography fontWeight="bold">{latestQueueDepth}</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};

// Resource Quotas Component
const ResourceQuotas = ({ data }: { data: any }) => {
  console.log('resourceQuotas', data);
  const theme = useTheme();

  const quotas = {
    cpu: { used: 2.5, total: 8.0, unit: 'vCPU' },
    memory: { used: 4.2, total: 16.0, unit: 'GB' },
    gpu: { used: 1.8, total: 4.0, unit: 'GPUs' },
    agents: { used: 1200, total: 5000, unit: 'instances' },
    deployments: { used: 340, total: 1000, unit: 'deployments' },
  };

  const quotaItems = [
    { key: 'cpu', label: 'CPU Quota', ...quotas.cpu },
    { key: 'memory', label: 'Memory Quota', ...quotas.memory },
    { key: 'gpu', label: 'GPU Quota', ...quotas.gpu },
    { key: 'agents', label: 'Agent Instances', ...quotas.agents },
    { key: 'deployments', label: 'Deployments', ...quotas.deployments },
  ];

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon />
          Resource Quotas
        </Typography>
        <Grid container spacing={2}>
          {quotaItems.map((item) => {
            const percentage = (item.used / item.total) * 100;
            const isNearLimit = percentage > 80;
            const isOverLimit = percentage > 100;

            return (
              <Grid item xs={12} sm={6} key={item.key}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {item.used} / {item.total} {item.unit}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      height: 8,
                      backgroundColor: theme.palette.grey[200],
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: isOverLimit
                          ? theme.palette.error.main
                          : isNearLimit
                            ? theme.palette.warning.main
                            : theme.palette.primary.main,
                        transition: 'all 0.3s ease',
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color={isOverLimit ? 'error' : isNearLimit ? 'warning.main' : 'text.secondary'}
                    sx={{ mt: 0.5, display: 'block' }}
                  >
                    {percentage.toFixed(1)}% utilized
                    {isOverLimit && ' (Over limit!)'}
                    {isNearLimit && !isOverLimit && ' (Near limit)'}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};

const ClusterUsageChart = () => {
  const theme = useTheme();
  const [view, setView] = useState<'overall' | 'node' | 'deployment' | 'model'>('overall');
  const [selected, setSelected] = useState<string>('');

  // ⚡ Автовыбор первой ноды/деплоймента/модели
  useEffect(() => {
    if (view === 'node') {
      const firstNode = Object.keys(clusterData.byNode)[0];
      if (firstNode) setSelected(firstNode);
    }
    if (view === 'deployment') {
      const firstDep = Object.keys(clusterData.byDeployment)[0];
      if (firstDep) setSelected(firstDep);
    }
    if (view === 'model') {
      const firstModel = Object.keys(clusterData.byModel)[0];
      if (firstModel) setSelected(firstModel);
    }
  }, [view]);

  const getSeries = () => {
    if (view === 'overall') {
      return [
        {
          data: clusterData.overall.cpu.map((d) => d.value),
          label: 'CPU %',
          color: theme.palette.error.main,
        },
        {
          data: clusterData.overall.memory.map((d) => d.value),
          label: 'Memory %',
          color: theme.palette.warning.main,
        },
        {
          data: clusterData.overall.gpu.map((d) => d.value),
          label: 'GPU %',
          color: theme.palette.info.main,
        },
        ...(clusterData.overall.agents
          ? [
              {
                data: clusterData.overall.agents.map((d) => d.value / 10), // Scale down for visibility
                label: 'Active Agents (×10)',
                color: theme.palette.primary.main,
              },
            ]
          : []),
      ];
    }
    if (view === 'node' && selected) {
      const node = (clusterData as any).byNode[selected];
      if (!node) return [];
      return [
        {
          data: node.cpu.map((d: { value: any }) => d.value),
          label: 'CPU %',
          color: theme.palette.error.main,
        },
        {
          data: node.memory.map((d: { value: any }) => d.value),
          label: 'Memory %',
          color: theme.palette.warning.main,
        },
        {
          data: node.gpu.map((d: { value: any }) => d.value),
          label: 'GPU %',
          color: theme.palette.info.main,
        },
        ...(node.agents
          ? [
              {
                data: node.agents.map((d: { value: number }) => d.value / 10),
                label: 'Active Agents (×10)',
                color: theme.palette.primary.main,
              },
            ]
          : []),
      ];
    }
    if (view === 'deployment' && selected) {
      const dep = (clusterData as any).byDeployment[selected];
      if (!dep) return [];
      return [
        {
          data: dep.cpu.map((d: { value: any }) => d.value),
          label: 'CPU %',
          color: theme.palette.error.main,
        },
        {
          data: dep.memory.map((d: { value: any }) => d.value),
          label: 'Memory %',
          color: theme.palette.warning.main,
        },
        {
          data: dep.gpu.map((d: { value: any }) => d.value),
          label: 'GPU %',
          color: theme.palette.info.main,
        },
        ...(dep.agents
          ? [
              {
                data: dep.agents.map((d: { value: number }) => d.value / 10),
                label: 'Active Agents (×10)',
                color: theme.palette.primary.main,
              },
            ]
          : []),
      ];
    }
    if (view === 'model' && selected) {
      const model = (clusterData as any).byModel[selected];
      if (!model) return [];
      return [
        {
          data: model.gpu_utilization.map((d: { value: any }) => d.value),
          label: 'GPU Utilization %',
          color: theme.palette.info.main,
        },
        {
          data: model.rps.map((d: { value: any }) => d.value),
          label: 'RPS',
          color: theme.palette.primary.main,
        },
        {
          data: model.latency_p95.map((d: { value: number }) => d.value / 100), // Scale down for visibility
          label: 'Latency P95 (×100ms)',
          color: theme.palette.warning.main,
        },
        {
          data: model.hotness_score.map((d: { value: number }) => d.value * 100), // Scale up for visibility
          label: 'Hotness Score (×100)',
          color: theme.palette.error.main,
        },
      ];
    }
    return [];
  };

  const getLabels = () => {
    if (view === 'overall') return clusterData.overall.cpu.map((d) => d.time);
    if (view === 'node' && selected)
      return (clusterData as any).byNode[selected]?.cpu.map((d: { time: any }) => d.time) || [];
    if (view === 'deployment' && selected)
      return (clusterData as any).byDeployment[selected]?.cpu.map((d: { time: any }) => d.time) || [];
    if (view === 'model' && selected)
      return (clusterData as any).byModel[selected]?.gpu_utilization.map((d: { time: any }) => d.time) || [];
    return [];
  };

  const getChartTitle = () => {
    if (view === 'overall') return 'Cluster Resource Utilization';
    if (view === 'node') return `Node: ${selected}`;
    if (view === 'deployment') return `Deployment: ${selected}`;
    if (view === 'model') return `Model: ${selected}`;
    return 'Resource Usage';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TimelineIcon />
        Cluster Usage Analytics
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Monitor resource utilization, active agents, and deployment metrics across your cluster
      </Typography>

      {/* Summary Cards */}
      <SummaryCards data={clusterData} view={view} selected={selected} />

      {/* Resource Quotas */}
      <ResourceQuotas data={clusterData} />

      {/* Model Metrics */}
      <ModelMetrics data={clusterData} />

      {/* Main Chart */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography>{getChartTitle()}</Typography>
            <Tabs value={view} onChange={(_, val) => setView(val)}>
              <Tab value="overall" label="Overall" />
              <Tab value="node" label="By Node" />
              <Tab value="deployment" label="By Deployment" />
              <Tab value="model" label="By Model" />
            </Tabs>
          </Stack>

          {view !== 'overall' && (
            <Box sx={{ mb: 2 }}>
              <Select
                size="small"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                {Object.keys(
                  view === 'node'
                    ? clusterData.byNode
                    : view === 'deployment'
                      ? clusterData.byDeployment
                      : clusterData.byModel,
                ).map((key) => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}

          <Box sx={{ height: 400 }}>
            <LineChart
              height={400}
              xAxis={[
                {
                  scaleType: 'point',
                  data: getLabels(),
                  label: 'Time',
                },
              ]}
              yAxis={[
                {
                  label: 'Percentage (%)',
                },
              ]}
              series={getSeries()}
              grid={{ horizontal: true, vertical: false }}
              margin={{ top: 20, right: 30, left: 50, bottom: 50 }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default observer(ClusterUsageChart);
