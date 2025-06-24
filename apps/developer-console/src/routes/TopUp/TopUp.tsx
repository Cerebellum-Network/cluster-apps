import { Link } from 'react-router-dom';
import { Paper, Stack, Typography, Grid, Button } from '@cluster-apps/ui';

const PayWithCardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.5 5H3.5C2.67157 5 2 5.67157 2 6.5V17.5C2 18.3284 2.67157 19 3.5 19H20.5C21.3284 19 22 18.3284 22 17.5V6.5C22 5.67157 21.3284 5 20.5 5Z"
      fill="#6577E8"
    />
    <path d="M2 10H22V11H2V10Z" fill="white" fillOpacity={0.5} />
  </svg>
);

const CereIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#6577E8" />
    <path
      d="M15.5 16.5C12.4624 16.5 10 14.0376 10 11C10 7.96243 12.4624 5.5 15.5 5.5"
      stroke="white"
      strokeWidth="2"
    />
    <circle cx="15" cy="11" r="1.5" fill="white" />
  </svg>
);

const AutoTopUpIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
      fill="#6577E8"
    />
  </svg>
);

const TopUp = () => {
  return (
    <Stack spacing={3} sx={{ px: 4 }}>
      <Typography variant="h4">Top Up Your Account</Typography>
      <Grid container spacing={4}>
        {/* Option 1: Pay with Card */}
        <Grid item xs={12} md={4}>
          <Paper
            component={Link}
            to="/top-up-card"
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': {
                boxShadow: 6,
              },
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <PayWithCardIcon />
                <Typography variant="subtitle1">Pay with Card</Typography>
              </Stack>
              <Typography color="text.secondary">
                The easiest way to get started. Instantly top up your balance with a credit or debit card.
              </Typography>
            </Stack>
            <Button variant="contained" size="large" sx={{ mt: 3, '&:hover': { textDecoration: 'none' } }}>
              Top Up Now
            </Button>
          </Paper>
        </Grid>

        {/* Option 2: Deposit CERE */}
        <Grid item xs={12} md={4}>
          <Paper
            component={Link}
            to="/deposit-from-wallet"
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': {
                boxShadow: 6,
              },
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CereIcon />
                <Typography variant="subtitle1">Deposit CERE</Typography>
              </Stack>
              <Typography color="text.secondary">
                Already have CERE tokens? Deposit them directly from your wallet to your DDC account.
              </Typography>
            </Stack>
            <Button variant="contained" size="large" sx={{ mt: 3, '&:hover': { textDecoration: 'none' } }}>
              Deposit Now
            </Button>
          </Paper>
        </Grid>

        {/* Option 3: Auto Top-Up */}
        <Grid item xs={12} md={4}>
          <Paper
            component={Link}
            to="/auto-top-up"
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': {
                boxShadow: 6,
              },
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AutoTopUpIcon />
                <Typography variant="subtitle1">Auto Top-Up</Typography>
              </Stack>
              <Typography color="text.secondary">
                Set up automatic top-ups to ensure your account always has sufficient balance. Charges from your DDC Account.
              </Typography>
            </Stack>
            <Button variant="contained" size="large" sx={{ mt: 3, '&:hover': { textDecoration: 'none' } }}>
              Set Up Auto Top-Up
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default TopUp;
