import { Paper, Typography, Button, Stack } from '@cluster-apps/ui';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Link } from 'react-router-dom';

export const Success = () => {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
        <CheckCircleOutlineIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Payment Successful!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Thank you for your payment. Your balance has been updated.
        </Typography>
        <Button component={Link} to="/top-up" variant="contained" color="primary">
          Make Another Top-Up
        </Button>
      </Paper>
    </Stack>
  );
};

export default Success; 