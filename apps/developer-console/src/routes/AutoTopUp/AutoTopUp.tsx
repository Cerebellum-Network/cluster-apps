import { useState } from 'react';
import { 
  Divider, 
  Paper, 
  Stack, 
  Typography, 
  Card, 
  CardContent, 
  Grid,
  Alert,
  Box,
  Chip,
  Button,
  CircularProgress
} from '@mui/material';
import { FormControlLabel, Checkbox } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export const AutoTopUp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe');

  const handleSetupAutoTopUp = async () => {
    if (!acceptedTerms) {
      setError('Please accept the terms and conditions to continue.');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/enable-pay-as-you-go', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: 'developer-console-account', // Placeholder for developer console
          origin: window.location.origin,
        }),
      });

      if (!response.ok) {
        throw new Error('Auto top-up setup failed');
      }

      const data = await response.json();
      window.location.href = data.setup_url;
    } catch (error) {
      console.error('Auto top-up setup failed:', error);
      setError('An error occurred during setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Auto Top-Up Setup</Typography>
      
      <Alert severity="info">
        <Typography variant="body2">
          Set up automatic top-ups to ensure your account always has sufficient balance. When your balance falls below
          the threshold, we'll automatically charge from your DDC Account.
        </Typography>
      </Alert>

      <Stack component={Paper} spacing={3} padding={3}>
        <Typography variant="h4">Payment Method</Typography>

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

        <Divider />

        <Typography variant="h4">Terms and Conditions</Typography>
        
        <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
{`AUTO TOP-UP SERVICE TERMS AND CONDITIONS

1. SERVICE DESCRIPTION
This Auto Top-Up service automatically charges your DDC Account when your account balance falls below the specified threshold.

2. AUTHORIZATION
By enabling this service, you authorize us to charge your DDC Account for the specified top-up amount whenever your balance drops below the threshold.

3. PAYMENT PROCESSING
- Charges will be processed from your DDC Account
- All charges are in USD
- You will receive email confirmation for each automatic charge
- Failed payments may result in service suspension

4. THRESHOLD AND AMOUNT SETTINGS
- Minimum threshold: $5.00 USD
- Minimum top-up amount: $10.00 USD
- Maximum top-up amount: $1,000.00 USD
- You can modify these settings at any time

5. CANCELLATION
You may cancel auto top-up at any time through your account settings. Cancellation takes effect immediately.

6. LIABILITY
- We are not responsible for insufficient funds in your DDC Account
- Ensure your DDC Account has sufficient balance
- Monitor your account regularly

7. PRIVACY
Your account information is processed securely and subject to our privacy policy.

8. CHANGES TO SERVICE
We reserve the right to modify these terms with 30 days notice.

By accepting these terms, you agree to the automatic charging of your DDC Account as described above.`}
          </Typography>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={isLoading}
            />
          }
          label="I accept the terms and conditions for auto top-up service"
        />

        {error && (
          <Alert severity="error">
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}

        {success && (
          <Alert severity="success">
            <Typography variant="body2">{success}</Typography>
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleSetupAutoTopUp}
          disabled={!acceptedTerms || isLoading}
          sx={{ mt: 2 }}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isLoading ? 'Setting Up...' : 'Set Up Auto Top-Up'}
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
          <Chip label="Secure" color="success" size="small" />
          <Chip label="PCI Compliant" color="success" size="small" />
          <Chip label="256-bit SSL" color="success" size="small" />
        </Box>
      </Stack>
    </Stack>
  );
};

export default AutoTopUp; 