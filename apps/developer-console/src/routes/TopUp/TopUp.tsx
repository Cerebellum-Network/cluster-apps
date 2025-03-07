import { observer } from 'mobx-react-lite';
import { useForm } from 'react-hook-form';
import {
  CheckIcon,
  Divider,
  Button,
  LoadingButton,
  Paper,
  QRCode,
  Stack,
  TextField,
  Typography,
  useMessages,
  Box,
  styled,
} from '@cluster-apps/ui';
import { useState } from 'react';

import { useAccount } from '~/hooks';

// Payment method logos
const CereLogo = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z" fill="#2D2D2D"/>
    <path d="M20.0001 6.66675L13.3334 10.0001V16.6667L20.0001 20.0001L26.6667 16.6667V10.0001L20.0001 6.66675Z" fill="#7A9FFF"/>
    <path d="M13.3334 23.3333V16.6667L20.0001 20.0001V26.6667L13.3334 23.3333Z" fill="#7A9FFF"/>
    <path d="M20 26.6667V20.0001L26.6667 16.6667V23.3333L20 26.6667Z" fill="#7A9FFF"/>
    <path d="M13.3334 23.3333L20.0001 26.6667L26.6667 23.3333L20.0001 33.3333L13.3334 23.3333Z" fill="#7A9FFF"/>
  </svg>
);

const MetamaskLogo = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34.7234 3.33325L22.1484 13.9999L24.6484 8.09992L34.7234 3.33325Z" fill="#E17726"/>
    <path d="M5.27344 3.33325L17.7484 14.0999L15.3484 8.09992L5.27344 3.33325Z" fill="#E27625"/>
    <path d="M30.0984 27.4999L26.6484 33.0999L34.1984 35.2999L36.3984 27.5999L30.0984 27.4999Z" fill="#E27625"/>
    <path d="M3.62344 27.5999L5.80844 35.2999L13.3484 33.0999L9.91344 27.4999L3.62344 27.5999Z" fill="#E27625"/>
    <path d="M12.9234 17.7999L10.7734 21.0999L18.2234 21.4999L17.9734 13.3999L12.9234 17.7999Z" fill="#E27625"/>
    <path d="M27.0734 17.7999L21.9234 13.2999L21.7734 21.4999L29.2234 21.0999L27.0734 17.7999Z" fill="#E27625"/>
    <path d="M13.3484 33.0999L17.7484 30.7999L13.9734 27.6499L13.3484 33.0999Z" fill="#E27625"/>
    <path d="M22.2484 30.7999L26.6484 33.0999L26.0234 27.6499L22.2484 30.7999Z" fill="#E27625"/>
    <path d="M26.6484 33.1L22.2484 30.8L22.6484 33.9L22.5984 35.2L26.6484 33.1Z" fill="#D5BFB2"/>
    <path d="M13.3484 33.1L17.3984 35.2L17.3484 33.9L17.7484 30.8L13.3484 33.1Z" fill="#D5BFB2"/>
    <path d="M17.4984 25.5999L13.8984 24.4999L16.4984 23.1999L17.4984 25.5999Z" fill="#233447"/>
    <path d="M22.4984 25.5999L23.4984 23.1999L26.0984 24.4999L22.4984 25.5999Z" fill="#233447"/>
    <path d="M13.3484 33.0999L13.9984 27.4999L9.91344 27.5999L13.3484 33.0999Z" fill="#CC6228"/>
    <path d="M26.0234 27.4999L26.6484 33.0999L30.0984 27.5999L26.0234 27.4999Z" fill="#CC6228"/>
    <path d="M29.2234 21.0999L21.7734 21.4999L22.4984 25.5999L23.4984 23.1999L26.0984 24.4999L29.2234 21.0999Z" fill="#CC6228"/>
    <path d="M13.8984 24.4999L16.4984 23.1999L17.4984 25.5999L18.2234 21.4999L10.7734 21.0999L13.8984 24.4999Z" fill="#CC6228"/>
    <path d="M10.7734 21.0999L13.9734 27.6499L13.8984 24.4999L10.7734 21.0999Z" fill="#E27525"/>
    <path d="M26.0984 24.4999L26.0234 27.6499L29.2234 21.0999L26.0984 24.4999Z" fill="#E27525"/>
    <path d="M18.2234 21.4999L17.4984 25.5999L18.3984 30.0999L18.5734 23.9999L18.2234 21.4999Z" fill="#E27525"/>
    <path d="M21.7734 21.4999L21.4234 23.9999L21.5984 30.0999L22.4984 25.5999L21.7734 21.4999Z" fill="#E27525"/>
    <path d="M22.4984 25.5999L21.5984 30.0999L22.2484 30.7999L26.0234 27.6499L26.0984 24.4999L22.4984 25.5999Z" fill="#F5841F"/>
    <path d="M13.8984 24.4999L13.9734 27.6499L17.7484 30.7999L18.3984 30.0999L17.4984 25.5999L13.8984 24.4999Z" fill="#F5841F"/>
    <path d="M22.5984 35.1999L22.6484 33.8999L22.2484 33.5999H17.7484L17.3484 33.8999L17.3984 35.1999L13.3484 33.0999L14.9984 34.4999L17.6984 36.3999H22.2984L24.9984 34.4999L26.6484 33.0999L22.5984 35.1999Z" fill="#C0AC9D"/>
    <path d="M22.2484 30.7999L21.5984 30.0999H18.3984L17.7484 30.7999L17.3484 33.8999L17.7484 33.5999H22.2484L22.6484 33.8999L22.2484 30.7999Z" fill="#161616"/>
    <path d="M35.5234 14.1999L36.6484 8.59992L34.7234 3.33325L22.2484 13.3999L27.0734 17.7999L34.0234 19.8999L35.5734 17.9999L34.9234 17.5499L35.9734 16.5999L35.1734 16.0499L36.2234 15.2499L35.5234 14.1999Z" fill="#763E1A"/>
    <path d="M3.34844 8.59992L4.47344 14.1999L3.74844 15.2499L4.82344 16.0499L4.02344 16.5999L5.07344 17.5499L4.42344 17.9999L5.97344 19.8999L12.9234 17.7999L17.7484 13.3999L5.27344 3.33325L3.34844 8.59992Z" fill="#763E1A"/>
    <path d="M34.0234 19.8999L27.0734 17.7999L29.2234 21.0999L26.0234 27.6499L30.0984 27.5999H36.3984L34.0234 19.8999Z" fill="#F5841F"/>
    <path d="M12.9234 17.7999L5.97344 19.8999L3.62344 27.5999H9.91344L13.9734 27.6499L10.7734 21.0999L12.9234 17.7999Z" fill="#F5841F"/>
    <path d="M21.7734 21.4999L22.2484 13.3999L24.6484 8.09992H15.3484L17.7484 13.3999L18.2234 21.4999L18.3734 23.9999L18.3984 30.0999H21.5984L21.6234 23.9999L21.7734 21.4999Z" fill="#F5841F"/>
  </svg>
);

const StripeLogo = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#635BFF"/>
    <path d="M19.2 20.8C19.2 19.6 20.2 18.8 22 18.8C23.3 18.8 24.3 19.3 25 19.9V16.7C24.2 16.2 23.2 16 22 16C18.7 16 16.3 18.1 16.3 20.9C16.3 25 21.4 24.3 21.4 26.2C21.4 27.5 20.2 28.2 18.5 28.2C17 28.2 15.8 27.6 15 26.9V30.1C15.9 30.7 17.2 31 18.5 31C21.9 31 24.4 29 24.4 26.1C24.3 21.7 19.2 22.5 19.2 20.8Z" fill="white"/>
  </svg>
);

// Styled components for payment method cards
const PaymentMethodCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  border: `1px solid ${theme.palette.divider}`,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

const SelectedCard = styled(PaymentMethodCard)(({ theme }) => ({
  borderColor: theme.palette.primary.main,
  borderWidth: 2,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(122, 159, 255, 0.1)' 
    : 'rgba(122, 159, 255, 0.05)',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

// Payment method types
type PaymentMethod = 'cere' | 'metamask' | 'stripe';

const TopUp = () => {
  const account = useAccount();
  const { showMessage } = useMessages();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cere');
  
  const form = useForm({
    defaultValues: {
      amount: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      if (paymentMethod === 'cere') {
        await account.topUp(Number(data.amount));
        form.reset();
        showMessage({
          appearance: 'success',
          message: `Congrats! You topped up your DDC Account with ${data.amount} tokens`,
          placement: { vertical: 'top', horizontal: 'right' },
        });
      } else if (paymentMethod === 'metamask') {
        // This would be implemented with Metamask integration
        showMessage({
          appearance: 'info',
          message: 'Metamask payment integration coming soon',
          placement: { vertical: 'top', horizontal: 'right' },
        });
      } else if (paymentMethod === 'stripe') {
        // This would be implemented with Stripe integration
        showMessage({
          appearance: 'info',
          message: 'Stripe payment integration coming soon',
          placement: { vertical: 'top', horizontal: 'right' },
        });
      }
    } catch (err) {
      showMessage({
        appearance: 'error',
        message: 'Not enough tokens',
        placement: { vertical: 'top', horizontal: 'right' },
      });
    }
  });

  const maxValue = Math.max(account.balance - 2, 0);

  const endAdornment = (
    <>
      <Button
        variant="contained"
        sx={{ marginRight: '8px', marginLeft: '10px' }}
        onClick={() => form.setValue('amount', `${maxValue}`, { shouldTouch: true, shouldValidate: true })}
      >
        Max
      </Button>
      <Typography color="text.secondary">
        {paymentMethod === 'cere' ? 'CERE' : paymentMethod === 'metamask' ? 'USDC' : 'USD'}
      </Typography>
    </>
  );

  // Render different content based on selected payment method
  const renderPaymentContent = () => {
    switch (paymentMethod) {
      case 'cere':
        return (
          <>
            <Typography variant="subtitle1">Send Cere tokens to your Cere wallet.</Typography>

            <Stack direction="row" spacing={3} alignItems="center" padding={1}>
              <QRCode value={account.address} size={100} />
              <Stack>
                <Typography variant="body1" color="text.secondary">
                  Your Cere Wallet Address:
                </Typography>
                <Typography variant="subtitle2">{account.address}</Typography>
              </Stack>
            </Stack>

            <Divider />

            <Typography variant="subtitle1">
              Transfer funds from Cere Wallet to DDC Account to keep your buckets running.
            </Typography>
            <Typography variant="body1">Funds will be charged from the DDC account directly.</Typography>

            {maxValue === 0 && (
              <Typography variant="subtitle1" color="error">
                You don't have enough funds in your Cere Wallet. Please top up your Cere Wallet first.
              </Typography>
            )}
          </>
        );
      case 'metamask':
        return (
          <>
            <Typography variant="subtitle1">Pay with USDC using Metamask</Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Connect your Metamask wallet to pay with USDC. Your funds will be converted to CERE tokens automatically.
            </Typography>
            <Button 
              variant="contained" 
              sx={{ mt: 3, mb: 2 }}
              onClick={() => {
                showMessage({
                  appearance: 'info',
                  message: 'Metamask connection coming soon',
                  placement: { vertical: 'top', horizontal: 'right' },
                });
              }}
            >
              Connect Metamask
            </Button>
            <Typography variant="body2" color="text.secondary">
              Make sure you have USDC in your Metamask wallet.
            </Typography>
          </>
        );
      case 'stripe':
        return (
          <>
            <Typography variant="subtitle1">Pay with Credit Card via Stripe</Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Use your credit card to purchase CERE tokens. Your funds will be added to your DDC account immediately.
            </Typography>
            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                We accept all major credit cards:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box component="img" src="https://cdn.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" alt="Visa" height={24} />
                <Box component="img" src="https://cdn.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" alt="Mastercard" height={24} />
                <Box component="img" src="https://cdn.stripe.com/v3/fingerprinted/img/amex-a49b82f46273df39311967e9a26a8b85.svg" alt="Amex" height={24} />
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Secure payment processing by Stripe.
            </Typography>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit}>
      <Typography variant="h4">Top up your account</Typography>
      
      {/* Payment method selection */}
      <Typography variant="subtitle1">Select payment method</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        {paymentMethod === 'cere' ? (
          <SelectedCard onClick={() => setPaymentMethod('cere')}>
            <CereLogo />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>CERE</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Pay with CERE tokens
            </Typography>
          </SelectedCard>
        ) : (
          <PaymentMethodCard onClick={() => setPaymentMethod('cere')}>
            <CereLogo />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>CERE</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Pay with CERE tokens
            </Typography>
          </PaymentMethodCard>
        )}
        
        {paymentMethod === 'metamask' ? (
          <SelectedCard onClick={() => setPaymentMethod('metamask')}>
            <MetamaskLogo />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>Metamask</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Pay with USDC
            </Typography>
          </SelectedCard>
        ) : (
          <PaymentMethodCard onClick={() => setPaymentMethod('metamask')}>
            <MetamaskLogo />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>Metamask</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Pay with USDC
            </Typography>
          </PaymentMethodCard>
        )}
        
        {paymentMethod === 'stripe' ? (
          <SelectedCard onClick={() => setPaymentMethod('stripe')}>
            <StripeLogo />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>Credit Card</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Pay with USD
            </Typography>
          </SelectedCard>
        ) : (
          <PaymentMethodCard onClick={() => setPaymentMethod('stripe')}>
            <StripeLogo />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>Credit Card</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Pay with USD
            </Typography>
          </PaymentMethodCard>
        )}
      </Box>
      
      {/* Payment details */}
      <Stack component={Paper} spacing={2} padding={3}>
        {renderPaymentContent()}
        
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Amount"
            placeholder="0.00"
            type="number"
            {...form.register('amount', {
              required: 'Amount is required',
              valueAsNumber: true,
              validate: (value) => {
                if (Number(value) <= 0) return 'Amount must be greater than 0';
                if (paymentMethod === 'cere' && Number(value) > maxValue) 
                  return `Amount must not exceed ${maxValue} CERE`;
              },
            })}
            value={form.watch('amount')}
            onChange={(e) => form.setValue('amount', e.target.value, { shouldTouch: true, shouldValidate: true })}
            InputProps={{ endAdornment }}
            error={!!form.formState.errors.amount}
            helperText={form.formState.errors.amount?.message}
            fullWidth
          />
          <LoadingButton
            type="submit"
            variant="contained"
            loading={form.formState.isSubmitting}
            endIcon={<CheckIcon />}
            sx={{ width: { xs: '100%', sm: 150 } }}
            disabled={!form.formState.isValid}
          >
            Confirm
          </LoadingButton>
        </Stack>
        
        <Typography variant="body2" color="text.secondary">
          Funds sent to this account can't be withdrawn
        </Typography>
      </Stack>
    </Stack>
  );
};

export default observer(TopUp);
