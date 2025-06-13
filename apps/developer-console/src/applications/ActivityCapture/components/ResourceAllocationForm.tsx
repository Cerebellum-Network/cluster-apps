import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@cluster-apps/ui';
import { Slider } from '@mui/material';

// Data source options
const DATA_SOURCES = [
  {
    id: 'timescaledb',
    name: 'TimescaleDB',
    description: 'Time-series database optimized for fast ingest and complex queries',
  },
  {
    id: 'faiss',
    name: 'FAISS',
    description: 'Library for efficient similarity search and clustering of dense vectors',
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'In-memory data structure store used as database, cache, and message broker',
  },
  { id: 'elasticsearch', name: 'ElasticSearch', description: 'Distributed, RESTful search and analytics engine' },
];

const ResourceAllocationForm = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [allocation, setAllocation] = useState({
    indexing: {
      cpu: 10,
      memory: 64,
      storage: 5,
      dataSources: [] as string[],
    },
    aiCompute: {
      cpu: 8,
      memory: 128,
      gpu: 2,
    },
  });
  const [success, setSuccess] = useState(false);

  // Handle next step
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  // Handle back step
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Handle reset
  const handleReset = () => {
    setActiveStep(0);
    setSuccess(false);
  };

  // Handle data source selection
  const handleDataSourceChange = (sourceId: string) => {
    setAllocation((prev) => {
      const currentSources = prev.indexing.dataSources;
      const newSources = currentSources.includes(sourceId)
        ? currentSources.filter((id) => id !== sourceId)
        : [...currentSources, sourceId];

      return {
        ...prev,
        indexing: {
          ...prev.indexing,
          dataSources: newSources,
        },
      };
    });
  };

  // Handle slider changes for resource allocation
  const handleSliderChange =
    (category: 'indexing' | 'aiCompute', resource: string) =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: Event, newValue: number | number[], _activeThumb: number) => {
      setAllocation((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          [resource]: newValue as number,
        },
      }));
    };

  // Handle form submission
  const handleSubmit = () => {
    // Here we would normally make an API call to allocate resources
    // For now, we'll just show a success message
    setSuccess(true);
    setActiveStep(3);
  };

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Resource Allocation
      </Typography>

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Step 1: Indexing Resources */}
            <Step>
              <StepLabel>Allocate Indexing Resources</StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    CPU Allocation
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Slider
                      value={allocation.indexing.cpu}
                      onChange={handleSliderChange('indexing', 'cpu')}
                      min={1}
                      max={100}
                      valueLabelDisplay="auto"
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 80 }}>
                      {allocation.indexing.cpu} Cores
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Memory Allocation
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Slider
                      value={allocation.indexing.memory}
                      onChange={handleSliderChange('indexing', 'memory')}
                      min={4}
                      max={1024}
                      step={4}
                      valueLabelDisplay="auto"
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 80 }}>
                      {allocation.indexing.memory} GB
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Storage Allocation
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Slider
                      value={allocation.indexing.storage}
                      onChange={handleSliderChange('indexing', 'storage')}
                      min={1}
                      max={100}
                      valueLabelDisplay="auto"
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 80 }}>
                      {allocation.indexing.storage} TB
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ mb: 2, mt: 3 }}>
                  <Button onClick={handleNext} variant="contained">
                    Continue
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Step 2: Data Sources */}
            <Step>
              <StepLabel>Select Data Sources</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Select the data sources you want to use for indexing your customer data.
                </Typography>

                <Box sx={{ mb: 3 }}>
                  {DATA_SOURCES.map((source) => (
                    <Box key={source.id} sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={allocation.indexing.dataSources.includes(source.id)}
                            onChange={() => handleDataSourceChange(source.id)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="subtitle1">{source.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {source.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  ))}
                </Box>

                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                  <Button onClick={handleBack}>Back</Button>
                  <Button onClick={handleNext} variant="contained">
                    Continue
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Step 3: AI Compute Resources */}
            <Step>
              <StepLabel>Allocate AI Compute Resources</StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    CPU Allocation
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Slider
                      value={allocation.aiCompute.cpu}
                      onChange={handleSliderChange('aiCompute', 'cpu')}
                      min={1}
                      max={128}
                      valueLabelDisplay="auto"
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 80 }}>
                      {allocation.aiCompute.cpu} Cores
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Memory Allocation
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Slider
                      value={allocation.aiCompute.memory}
                      onChange={handleSliderChange('aiCompute', 'memory')}
                      min={8}
                      max={2048}
                      step={8}
                      valueLabelDisplay="auto"
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 80 }}>
                      {allocation.aiCompute.memory} GB
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    GPU Allocation
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Slider
                      value={allocation.aiCompute.gpu}
                      onChange={handleSliderChange('aiCompute', 'gpu')}
                      min={0}
                      max={56}
                      valueLabelDisplay="auto"
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 80 }}>
                      {allocation.aiCompute.gpu} Units
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ mb: 2, mt: 3, display: 'flex', gap: 1 }}>
                  <Button onClick={handleBack}>Back</Button>
                  <Button onClick={handleSubmit} variant="contained">
                    Allocate Resources
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>

          {success && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Resources have been successfully allocated!
              </Alert>

              <Typography variant="h4" gutterBottom>
                Allocation Summary
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1">Indexing Resources</Typography>
                <Typography variant="body2">CPU: {allocation.indexing.cpu} Cores</Typography>
                <Typography variant="body2">Memory: {allocation.indexing.memory} GB</Typography>
                <Typography variant="body2">Storage: {allocation.indexing.storage} TB</Typography>
                <Typography variant="body2">
                  Data Sources:{' '}
                  {allocation.indexing.dataSources.length > 0
                    ? allocation.indexing.dataSources
                        .map((id) => DATA_SOURCES.find((source) => source.id === id)?.name)
                        .join(', ')
                    : 'None'}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1">AI Compute Resources</Typography>
                <Typography variant="body2">CPU: {allocation.aiCompute.cpu} Cores</Typography>
                <Typography variant="body2">Memory: {allocation.aiCompute.memory} GB</Typography>
                <Typography variant="body2">GPU: {allocation.aiCompute.gpu} Units</Typography>
              </Box>

              <Button onClick={handleReset} variant="outlined">
                Modify Allocation
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ResourceAllocationForm;
