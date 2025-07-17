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
      const eraTimestamp = era.eraId * 3600000;
      const cutoffTime = getTimeRangeInMs(timeFilter);
      return eraTimestamp >= cutoffTime;
    }) || [];

  const graphData = filteredEraDetails.map((era) => ({
    timestamp: new Date(era.eraId * 3600000).toLocaleString(),
    gets: era.gets,
    puts: era.puts,
    transferredBytes: era.transferredBytes,
    getsValue: (era.getsValue / 10000000000).toFixed(10),
    putsValue: (era.putsValue / 10000000000).toFixed(10),
    trafficValue: (era.trafficValue / 10000000000).toFixed(10),
    totalValue: (era.totalValue / 10000000000).toFixed(10),
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
            Activity Metrics:
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
          <Typography variant="body2" sx={{ mt: 2, mb: 1, fontWeight: 'bold', color: '#495057' }}>
            Cost Breakdown (CERE):
          </Typography>
          <Typography variant="body2" sx={{ color: '#ff7300' }}>
            Gets Value: {data.getsValue || '0.0000000000'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#00ff00' }}>
            Puts Value: {data.putsValue || '0.0000000000'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#ff0000' }}>
            Traffic Value: {data.trafficValue || '0.0000000000'}
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
      (era) => era.gets === 0 && era.puts === 0 && era.transferredBytes === 0 && era.totalValue === 0,
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
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Activity Dashboard</Typography>
        <Button variant="outlined" onClick={handleRefresh} disabled={activityStore.isLoading}>
          {activityStore.isLoading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </Box>

      {/* Account Balance Cards - 2 per row, same size as summary cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ minHeight: CARD_MIN_HEIGHT }}>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                DDC Wallet
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {account.deposit === undefined ? '-' : `${account.deposit} CERE`}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Active Balance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ minHeight: CARD_MIN_HEIGHT }}>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                Cere Wallet
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {account.balance === undefined ? '-' : `${account.balance} CERE`}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Time Filter */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          p: 2,
          backgroundColor: '#f8f9fa',
          borderRadius: 1,
          border: '1px solid #e9ecef',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#495057' }}>
          Filter Activity Data
        </Typography>
        <FormControl sx={{ minWidth: 250 }}>
          <InputLabel sx={{ color: '#6c757d' }}>Select Time Range</InputLabel>
          <Select
            value={timeFilter}
            label="Select Time Range"
            onChange={(e) => setTimeFilter(e.target.value)}
            sx={{
              backgroundColor: 'white',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#dee2e6',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#adb5bd',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#1976d2',
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

      {/* Activity Summary and Trend */}
      {allZero ? (
        <Alert severity="info" sx={{ my: 4, fontSize: 18, fontWeight: 500 }}>
          No activity data for the selected time range.
        </Alert>
      ) : (
        <>
          <Typography variant="h4" gutterBottom>
            Activity Summary
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="primary" gutterBottom>
                    Total Gets
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {filteredEraDetails.reduce((sum, era) => sum + era.gets, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="primary" gutterBottom>
                    Total Puts
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {filteredEraDetails.reduce((sum, era) => sum + era.puts, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="primary" gutterBottom>
                    Total Data Transferred (Bytes)
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {filteredEraDetails.reduce((sum, era) => sum + era.transferredBytes, 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="primary" gutterBottom>
                    Total Amount (Charged in CERE)
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {(filteredEraDetails.reduce((sum, era) => sum + era.totalValue, 0) / 10000000000).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 6 },
                    )}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          {/* Activity Graph */}
          <Typography variant="h4" gutterBottom>
            Activity Trend
          </Typography>
          <Card sx={{ mb: 4, border: '3px solid #1976d2', boxShadow: '0 4px 24px rgba(25, 118, 210, 0.08)' }}>
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
                    {/* Right Y-axis for Transferred Bytes */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 13, fill: '#ff9800', fontWeight: 700 }}
                      allowDecimals={false}
                      label={{
                        value: 'Transferred Bytes',
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
                    <Bar yAxisId="right" dataKey="transferredBytes" fill="#ffc658" name="Transferred Bytes" />
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
                Activity Summary
              </Typography>

              <Box sx={{ display: 'grid', gap: 2, mb: 3 }}>
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
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {selectedEra.gets.toLocaleString()}
                  </Typography>
                </Box>

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
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {selectedEra.puts.toLocaleString()}
                  </Typography>
                </Box>

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
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {selectedEra.transferredBytes.toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h4" gutterBottom sx={{ color: '#1976d2', mb: 2 }}>
                Cost Breakdown (CERE)
              </Typography>

              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #4caf50',
                    borderRadius: 1,
                    backgroundColor: '#f1f8e9',
                  }}
                >
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Gets Value
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                    {(selectedEra.getsValue / 10000000000).toFixed(10)}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #ff9800',
                    borderRadius: 1,
                    backgroundColor: '#fff3e0',
                  }}
                >
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Puts Value
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#e65100' }}>
                    {(selectedEra.putsValue / 10000000000).toFixed(10)}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    border: '1px solid #2196f3',
                    borderRadius: 1,
                    backgroundColor: '#e3f2fd',
                  }}
                >
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Traffic Value
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                    {(selectedEra.trafficValue / 10000000000).toFixed(10)}
                  </Typography>
                </Box>
              </Box>
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
