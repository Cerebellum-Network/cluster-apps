import { observer } from 'mobx-react-lite';
import { Box, Grid, Typography, ChartWidget, BytesSize, Paper, styled } from '@cluster-apps/ui';
import { useAccountStore } from '~/hooks/useAccountStore';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  height: '100%',
}));

const Analytics = () => {
  const account = useAccountStore();
  const totalCere = 0; // TODO: get real data
  
  // Mock data for GET/PUT operations - this would be replaced with real data
  const getOperations = {
    total: 1250,
    history: Array.from({ length: 30 }, (_, i) => ({
      value: Math.floor(Math.random() * 100) + 20,
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
    })),
  };
  
  const putOperations = {
    total: 450,
    history: Array.from({ length: 30 }, (_, i) => ({
      value: Math.floor(Math.random() * 50) + 5,
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
    })),
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StyledPaper>
            <ChartWidget
              title="Total Storage"
              value={<BytesSize bytes={account.accountMetrics?.total.storedBytes || 0} />}
              history={account.accountMetrics?.history.map((item: any) => ({
                value: item.storedBytes,
                date: item.recordTime,
              }))}
            />
          </StyledPaper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <StyledPaper>
            <ChartWidget
              title="Network Traffic"
              value={<BytesSize bytes={account.accountMetrics?.total.transferredBytes || 0} />}
              history={account.accountMetrics?.history.map((item: any) => ({
                value: item.transferredBytes,
                date: item.recordTime,
              }))}
            />
          </StyledPaper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <StyledPaper>
            <ChartWidget 
              title="Total CERE Consumption" 
              value={`${totalCere} CERE`} 
              formatValue={(value) => `${value}`} 
            />
          </StyledPaper>
        </Grid>
      </Grid>
      
      <Typography variant="subtitle1" gutterBottom sx={{ mt: 4, fontSize: '1.25rem', fontWeight: 500 }}>
        API Operations
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <StyledPaper>
            <ChartWidget
              title="GET Operations"
              value={`${getOperations.total} ops`}
              history={getOperations.history}
              formatValue={(value) => `${value} ops`}
            />
          </StyledPaper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <StyledPaper>
            <ChartWidget
              title="PUT Operations"
              value={`${putOperations.total} ops`}
              history={putOperations.history}
              formatValue={(value) => `${value} ops`}
            />
          </StyledPaper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default observer(Analytics); 