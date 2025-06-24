import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Typography, Box, Card, CardContent, Grid, CircularProgress, Alert } from '@cluster-apps/ui';
import { useActivityStore, useAccount } from '~/hooks';

const ActivityCapture = observer(() => {
  const activityStore = useActivityStore();
  const account = useAccount();
  const [customerId, setCustomerId] = useState('');

  useEffect(() => {
    if (account.address) {
      setCustomerId(account.address);
      activityStore.fetchCustomerActivity(account.address);
    }
  }, [account.address, activityStore]);

  const activity = activityStore.activity;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Activity Dashboard
      </Typography>
      
      {/* Account Balance Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                Cere Wallet
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {account.balance === undefined ? '-' : `${account.balance} CERE`}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Address: {account.address}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
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
      </Grid>

      {activityStore.isLoading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      )}

      {!activityStore.isLoading && !activity && (
        <Box p={3}>
          <Alert severity="info">
            No activity data found for your account
          </Alert>
        </Box>
      )}

      {!activityStore.isLoading && activity && (
        <>
          <Typography variant="h4" gutterBottom>
            Activity Summary
          </Typography>

          {/* Activity Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="primary">
                    Total Gets
                  </Typography>
                  <Typography variant="h4">
                    {activity.totalGets.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="primary">
                    Total Puts
                  </Typography>
                  <Typography variant="h4">
                    {activity.totalPuts.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" color="primary">
                    Total Data Transferred
                  </Typography>
                  <Typography variant="h4">
                    {formatBytes(activity.totalTransferredBytes)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Era Details */}
          <Typography variant="h4" gutterBottom>
            Era Details
          </Typography>
          
          {activity.eraDetails.length > 0 ? (
            <Grid container spacing={2}>
              {activity.eraDetails.map((era) => (
                <Grid item xs={12} sm={6} md={4} key={era.eraId}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" color="primary">
                        Era {era.eraId}
                      </Typography>
                      <Typography variant="body2">
                        Gets: {era.gets.toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        Puts: {era.puts.toLocaleString()}
                      </Typography>
                      <Typography variant="body2">
                        Data: {formatBytes(era.transferredBytes)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info">
              No era details available for your account
            </Alert>
          )}
        </>
      )}
    </Box>
  );
});

export default ActivityCapture;
