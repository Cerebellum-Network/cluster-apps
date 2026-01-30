import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  DialogActions,
  Button,
} from '@cluster-apps/ui';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useActivityStore, useAccount } from '~/hooks';
import CloseIcon from '@mui/icons-material/Close';
import { CustomerActivity } from '~/stores/ActivityStore/ActivityStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CARD_MIN_HEIGHT = 140;

type EraDetailType = CustomerActivity['eraDetails'][number];

function ActivityCapture() {
  const activityStore = useActivityStore();
  const account = useAccount();
  const [selectedEra, setSelectedEra] = useState<EraDetailType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState('7days');
  const [eraFilter, setEraFilter] = useState<string>('all');

  const timeFilterOptions = [
    { value: '15min', label: 'Last 15 minutes' },
    { value: '1hour', label: 'Last 1 hour' },
    { value: '2hours', label: 'Last 2 hours' },
    { value: '6hours', label: 'Last 6 hours' },
    { value: '12hours', label: 'Last 12 hours' },
    { value: '24hours', label: 'Last 24 hours' },
    { value: '2days', label: 'Last 2 days' },
    { value: '7days', label: 'Last 7 days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '1year', label: 'Last 1 year' },
  ];

  const getTimeRangeInMs = (filter: string) => {
    const now = Date.now();
    switch (filter) {
      case '15min':
        return now - 15 * 60 * 1000;
      case '1hour':
        return now - 60 * 60 * 1000;
      case '2hours':
        return now - 2 * 60 * 60 * 1000;
      case '6hours':
        return now - 6 * 60 * 60 * 1000;
      case '12hours':
        return now - 12 * 60 * 60 * 1000;
      case '24hours':
        return now - 24 * 60 * 60 * 1000;
      case '2days':
        return now - 2 * 24 * 60 * 60 * 1000;
      case '7days':
        return now - 7 * 24 * 60 * 60 * 1000;
      case '30days':
        return now - 30 * 24 * 60 * 60 * 1000;
      case '90days':
        return now - 90 * 24 * 60 * 60 * 1000;
      case '6months':
        return now - 182 * 24 * 60 * 60 * 1000; // Approximate 6 months as 182 days
      case '1year':
        return now - 365 * 24 * 60 * 60 * 1000;
      default:
        return now - 7 * 24 * 60 * 60 * 1000;
    }
  };

  const filteredEraDetails =
    activityStore.activity?.eraDetails.filter((era) => {
      // Filter by time range
      const eraTimestamp = era.eraId * 3600000;
      const cutoffTime = getTimeRangeInMs(timeFilter);
      const timeMatch = eraTimestamp >= cutoffTime;
      
      // Filter by era if specific era is selected
      if (eraFilter !== 'all') {
        return timeMatch && era.eraId.toString() === eraFilter;
      }
      
      return timeMatch;
    }) || [];

  // Get unique eras for the era selector
  const availableEras = activityStore.activity?.eraDetails.map((era) => era.eraId) || [];
  const uniqueEras = Array.from(new Set(availableEras)).sort((a, b) => b - a);

  const graphData = filteredEraDetails.map((era) => ({
    eraId: era.eraId,
    timestamp: new Date(era.eraId * 3600000).toLocaleString(),
    gets: era.gets,
    puts: era.puts,
    transferredBytes: era.transferredBytes,
    storedBytes: era.storedBytes,
    computes: era.computes,
    cpuUnits: era.cpuUnits,
    gpuUnits: era.gpuUnits,
    ramUnits: era.ramUnits,
    eraData: era, // Store full era data for click handling
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: 1,
            p: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold', color: '#495057' }}>
            Usage Metrics:
          </Typography>
          <Typography variant="body2" sx={{ color: '#8884d8' }}>
            Gets: {data.gets?.toLocaleString() || 0}
          </Typography>
          <Typography variant="body2" sx={{ color: '#82ca9d' }}>
            Puts: {data.puts?.toLocaleString() || 0}
          </Typography>
          <Typography variant="body2" sx={{ color: '#ffc658' }}>
            Transferred Bytes: {data.transferredBytes?.toLocaleString() || 0}
          </Typography>
          <Typography variant="body2" sx={{ color: '#9c27b0' }}>
            Stored Bytes: {data.storedBytes?.toLocaleString() || 0}
          </Typography>
          <Typography variant="body2" sx={{ color: '#f44336' }}>
            Computes: {data.computes?.toLocaleString() || 0}
          </Typography>
          <Typography variant="body2" sx={{ color: '#2196f3' }}>
            CPU Units: {data.cpuUnits?.toLocaleString() || 0}
          </Typography>
          <Typography variant="body2" sx={{ color: '#4caf50' }}>
            GPU Units: {data.gpuUnits?.toLocaleString() || 0}
          </Typography>
          <Typography variant="body2" sx={{ color: '#ff9800' }}>
            RAM Units: {data.ramUnits?.toLocaleString() || 0}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  useEffect(() => {
    if (account.address) {
      activityStore.fetchCustomerActivity(account.address);
    } else {
      activityStore.reset();
    }
  }, [account.address, activityStore]);

  const handleRefresh = () => {
    if (account.address) {
      activityStore.refreshCustomerActivity(account.address);
    }
  };

  const activity = activityStore.activity;

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedEra(null);
  };

  const allZero =
    filteredEraDetails.length === 0 ||
    filteredEraDetails.every(
      (era) =>
        era.gets === 0 &&
        era.puts === 0 &&
        era.transferredBytes === 0 &&
        era.storedBytes === 0 &&
        era.computes === 0 &&
        era.cpuUnits === 0 &&
        era.gpuUnits === 0 &&
        era.ramUnits === 0,
    );

  if (activityStore.isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (activityStore.hasError) {
    return (
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Activity Dashboard</Typography>
          <Button variant="outlined" onClick={handleRefresh} disabled={activityStore.isLoading}>
            {activityStore.isLoading ? 'Loading...' : 'Retry'}
          </Button>
        </Box>
        <Alert severity="error">
          Failed to load activity data. Please try refreshing the page or contact support if the problem persists.
        </Alert>
      </Box>
    );
  }

  if (!activity) {
    return (
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Activity Dashboard</Typography>
          <Button variant="outlined" onClick={handleRefresh} disabled={activityStore.isLoading}>
            {activityStore.isLoading ? 'Loading...' : 'Load Data'}
          </Button>
        </Box>
        <Alert severity="info">No activity data found for your account</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={4}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 2,
          p: 3,
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
        }}
      >
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
          Usage Analytics Dashboard
        </Typography>
        <Button 
          variant="contained" 
          onClick={handleRefresh} 
          disabled={activityStore.isLoading}
          sx={{
            backgroundColor: 'white',
            color: '#667eea',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#f0f0f0',
            },
          }}
        >
          {activityStore.isLoading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </Box>

      {/* Account Balance Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 32px rgba(102, 126, 234, 0.35)',
              },
            }}
          >
            <CardContent sx={{ minHeight: CARD_MIN_HEIGHT }}>
              <Typography variant="subtitle1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 1 }}>
                DDC Wallet
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'white', mb: 0.5 }}>
                {account.deposit === undefined ? '-' : `${account.deposit} CERE`}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Active Balance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: 'white',
              boxShadow: '0 8px 24px rgba(245, 87, 108, 0.25)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 32px rgba(245, 87, 108, 0.35)',
              },
            }}
          >
            <CardContent sx={{ minHeight: CARD_MIN_HEIGHT }}>
              <Typography variant="subtitle1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 1 }}>
                Cere Wallet
              </Typography>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'white' }}>
                {account.balance === undefined ? '-' : `${account.balance} CERE`}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card
        sx={{
          mb: 4,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
          borderRadius: 2,
        }}
      >
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 3,
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#6c757d', fontWeight: 600 }}>
                Time Range
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  sx={{
                    backgroundColor: 'white',
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#667eea',
                    },
                  }}
                >
                  {timeFilterOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#6c757d', fontWeight: 600 }}>
                Era Selection
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={eraFilter}
                  onChange={(e) => setEraFilter(e.target.value)}
                  sx={{
                    backgroundColor: 'white',
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#667eea',
                    },
                  }}
                >
                  <MenuItem value="all">All Eras</MenuItem>
                  {uniqueEras.map((eraId) => (
                    <MenuItem key={eraId} value={eraId.toString()}>
                      Era {eraId} ({new Date(eraId * 3600000).toLocaleDateString()})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Activity Summary and Trend */}
      {allZero ? (
        <Alert severity="info" sx={{ my: 4, fontSize: 18, fontWeight: 500 }}>
          No activity data for the selected time range.
        </Alert>
      ) : (
        <>
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              mb: 3, 
              fontWeight: 600, 
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            Usage Summary
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    Total Gets
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#1976d2' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.gets, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    Total Puts
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#82ca9d' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.puts, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    Transferred Bytes
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#ff9800' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.transferredBytes, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    Stored Bytes
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#9c27b0' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.storedBytes, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    Computes
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#f44336' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.computes, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    CPU Units
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#2196f3' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.cpuUnits, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    GPU Units
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#4caf50' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.gpuUnits, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card
                sx={{
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500 }}>
                    RAM Units
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#ff9800' }}>
                    {filteredEraDetails.reduce((sum, era) => sum + era.ramUnits, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {activity.totalTokensCharged > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                    },
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 1, fontWeight: 500 }}>
                      Tokens Charged
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: 'white' }}>
                      {(activity.totalTokensCharged / 10000000000).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}{' '}
                      CERE
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
          {/* Activity Graph */}
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              mb: 3, 
              fontWeight: 600, 
              color: '#2d3748',
            }}
          >
            Usage Trend
          </Typography>
          <Card 
            sx={{ 
              mb: 4, 
              borderRadius: 2,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e0e0e0',
            }}
          >
            <CardContent>
              <Box sx={{ height: 480, p: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graphData} margin={{ top: 30, right: 60, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="timestamp"
                      angle={-25}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fontSize: 13, fill: '#495057', fontWeight: 500 }}
                      minTickGap={20}
                    />
                    {/* Left Y-axis for Gets and Puts */}
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 13, fill: '#8884d8', fontWeight: 500 }}
                      allowDecimals={false}
                      label={{ value: 'Gets / Puts', angle: -90, position: 'insideLeft', fill: '#8884d8' }}
                    />
                    {/* Right Y-axis for Bytes and Units */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 13, fill: '#ff9800', fontWeight: 700 }}
                      allowDecimals={false}
                      label={{
                        value: 'Bytes / Units',
                        angle: 90,
                        position: 'insideRight',
                        fill: '#ff9800',
                        fontWeight: 700,
                        dx: 30,
                      }}
                      axisLine={{ stroke: '#ff9800', strokeWidth: 2 }}
                      tickLine={{ stroke: '#ff9800', strokeWidth: 2 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Bar yAxisId="left" dataKey="gets" fill="#1976d2" name="Gets" />
                    <Bar yAxisId="left" dataKey="puts" fill="#82ca9d" name="Puts" />
                    <Bar yAxisId="left" dataKey="computes" fill="#f44336" name="Computes" />
                    <Bar yAxisId="right" dataKey="transferredBytes" fill="#ffc658" name="Transferred Bytes" />
                    <Bar yAxisId="right" dataKey="storedBytes" fill="#9c27b0" name="Stored Bytes" />
                    <Bar yAxisId="right" dataKey="cpuUnits" fill="#2196f3" name="CPU Units" />
                    <Bar yAxisId="right" dataKey="gpuUnits" fill="#4caf50" name="GPU Units" />
                    <Bar yAxisId="right" dataKey="ramUnits" fill="#ff9800" name="RAM Units" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal for Era Details */}
      <Dialog open={modalOpen} onClose={handleModalClose} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              Era {selectedEra?.eraId} Details
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={handleModalClose}
            sx={{
              color: '#666',
              '&:hover': {
                backgroundColor: '#e0e0e0',
                color: '#333',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedEra && (
            <Box>
              <Typography variant="h4" gutterBottom sx={{ color: '#1976d2', mb: 2 }}>
                Usage Summary
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Gets
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {selectedEra.gets.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.gets >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.gets >= 0 ? '+' : ''}
                        {selectedEra.changes.gets.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Puts
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {selectedEra.puts.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.puts >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.puts >= 0 ? '+' : ''}
                        {selectedEra.changes.puts.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Transferred Bytes
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {selectedEra.transferredBytes.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.transferredBytes >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.transferredBytes >= 0 ? '+' : ''}
                        {selectedEra.changes.transferredBytes.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Stored Bytes
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {selectedEra.storedBytes.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.storedBytes >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.storedBytes >= 0 ? '+' : ''}
                        {selectedEra.changes.storedBytes.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#fafafa',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Computes
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {selectedEra.computes.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.computes >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.computes >= 0 ? '+' : ''}
                        {selectedEra.changes.computes.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #2196f3',
                      borderRadius: 1,
                      backgroundColor: '#e3f2fd',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      CPU Units
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                      {selectedEra.cpuUnits.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.cpuUnits >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.cpuUnits >= 0 ? '+' : ''}
                        {selectedEra.changes.cpuUnits.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #4caf50',
                      borderRadius: 1,
                      backgroundColor: '#f1f8e9',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      GPU Units
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                      {selectedEra.gpuUnits.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.gpuUnits >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.gpuUnits >= 0 ? '+' : ''}
                        {selectedEra.changes.gpuUnits.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #ff9800',
                      borderRadius: 1,
                      backgroundColor: '#fff3e0',
                    }}
                  >
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      RAM Units
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#e65100' }}>
                      {selectedEra.ramUnits.toLocaleString()}
                    </Typography>
                    {selectedEra.changes && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: selectedEra.changes.ramUnits >= 0 ? '#4caf50' : '#f44336',
                          mt: 0.5,
                        }}
                      >
                        {selectedEra.changes.ramUnits >= 0 ? '+' : ''}
                        {selectedEra.changes.ramUnits.toLocaleString()} from previous era
                      </Typography>
                    )}
                  </Box>
                </Grid>

                {selectedEra.tokensCharged && (
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        p: 2,
                        border: '1px solid #9c27b0',
                        borderRadius: 1,
                        backgroundColor: '#f3e5f5',
                      }}
                    >
                      <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                        Tokens Charged
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#7b1fa2' }}>
                        {(selectedEra.tokensCharged / 10000000000).toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}{' '}
                        CERE
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
          <Button
            onClick={handleModalClose}
            variant="contained"
            sx={{
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#1565c0' },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default observer(ActivityCapture);
