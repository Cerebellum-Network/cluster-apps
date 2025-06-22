import { Paper, Typography, Button, Stack } from '@cluster-apps/ui';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { Link } from 'react-router-dom';

export const Cancel = () => {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
        <HighlightOffIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Payment Canceled
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Your payment was not processed. You can go back and try again.
        </Typography>
        <Button component={Link} to="/top-up-card" variant="contained" color="primary">
          Try Again
        </Button>
      </Paper>
    </Stack>
  );
};

export default Cancel; 