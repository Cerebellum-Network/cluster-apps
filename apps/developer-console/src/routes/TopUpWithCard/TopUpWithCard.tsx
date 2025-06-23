import { useState, useEffect } from 'react';
import { Divider, LoadingButton, Paper, Stack, TextField, Typography, Card, CardContent, Grid } from '@cluster-apps/ui';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { useAccount } from '~/hooks';

const CERE_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=cere-network&vs_currencies=usd';

export const TopUpWithCard = () => {
  const account = useAccount();
  const [usdAmount, setUsdAmount] = useState('');
  const [cereAmount, setCereAmount] = useState('');
  const [cerePrice, setCerePrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('stripe');

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(CERE_API_URL);
        const data = await response.json();
        setCerePrice(data['cere-network'].usd);
      } catch (error) {
        console.error('Failed to fetch CERE price:', error);
      } finally {
        setIsPriceLoading(false);
      }
    };

    fetchPrice();
  }, []);

  const handleUsdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const usd = event.target.value;
    setUsdAmount(usd);
    if (cerePrice && usd) {
      setCereAmount((parseFloat(usd) / cerePrice).toFixed(2));
    } else {
      setCereAmount('');
    }
  };

  const handleCereChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const cere = event.target.value;
    setCereAmount(cere);
    if (cerePrice && cere) {
      setUsdAmount((parseFloat(cere) * cerePrice).toFixed(2));
    } else {
      setUsdAmount('');
    }
  };

  const handleTopUp = async () => {
    if (!usdAmount || parseFloat(usdAmount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/top-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(parseFloat(usdAmount) * 100), // Convert to cents
          account_id: account.address,
          origin: window.location.origin, // Send the origin to determine redirect URLs
        }),
      });

      if (!response.ok) {
        throw new Error('Payment initiation failed');
      }

      const data = await response.json();
      window.location.href = data.payment_url;
    } catch (error) {
      console.error('Top-up failed:', error);
      setError('An error occurred during top-up. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Top up with Credit/Debit Card</Typography>
      <Stack component={Paper} spacing={2} padding={3}>
        <Typography variant="subtitle1">Enter the amount you wish to add to your balance.</Typography>

        <TextField
          label="Amount (USD)"
          placeholder="10.00"
          type="number"
          value={usdAmount}
          onChange={handleUsdChange}
          disabled={isLoading || isPriceLoading}
          error={!!error}
          helperText={error}
        />

        <Divider>
          <Typography variant="caption" color="text.secondary">
            {isPriceLoading
              ? 'Fetching live rate...'
              : cerePrice
                ? `1 CERE ≈ $${cerePrice.toFixed(4)} USD`
                : 'Rate unavailable'}
          </Typography>
        </Divider>

        <TextField
          label="Amount (CERE)"
          placeholder="100.00"
          type="number"
          value={cereAmount}
          onChange={handleCereChange}
          disabled={isLoading || isPriceLoading || !cerePrice}
        />

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Select Payment Method
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Card
              variant="outlined"
              sx={{
                borderColor: paymentMethod === 'stripe' ? 'primary.main' : 'grey.300',
                position: 'relative',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: paymentMethod === 'stripe' ? 'primary.main' : 'grey.400',
                },
              }}
              onClick={() => setPaymentMethod('stripe')}
            >
              {paymentMethod === 'stripe' && (
                <CheckCircleIcon color="primary" sx={{ position: 'absolute', top: 8, right: 8 }} />
              )}
              <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <img src="/stripe.png" alt="Stripe" height="24" />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Credit/Debit Cards
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6}>
            <Card
              variant="outlined"
              sx={{
                borderColor: 'grey.300',
                cursor: 'not-allowed',
                opacity: 0.6,
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <img src="/paypal.png" alt="PayPal" height="24" />
                <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                  Coming soon
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <LoadingButton
          variant="contained"
          size="large"
          loading={isLoading}
          onClick={handleTopUp}
          disabled={isPriceLoading || !usdAmount || parseFloat(usdAmount) <= 0}
          sx={{ mt: 2 }}
        >
          Top Up
        </LoadingButton>
      </Stack>
    </Stack>
  );
};

export default TopUpWithCard;
