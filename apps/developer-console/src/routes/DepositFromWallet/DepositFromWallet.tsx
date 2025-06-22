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
} from '@cluster-apps/ui';

import { useAccount } from '~/hooks';

const DepositFromWallet = () => {
  const account = useAccount();
  const { showMessage } = useMessages();
  const form = useForm({
    defaultValues: {
      amount: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await account.topUp(Number(data.amount));
    } catch (err) {
      showMessage({
        appearance: 'error',
        message: 'Not enough tokens',
        placement: { vertical: 'top', horizontal: 'right' },
      });
      return;
    }

    form.reset();
    showMessage({
      appearance: 'success',
      message: `Congrats! You topped up your DDC Account with ${data.amount} tokens`,
      placement: { vertical: 'top', horizontal: 'right' },
    });
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
      <Typography color="text.secondary">CERE</Typography>
    </>
  );

  return (
    <Stack spacing={3} component={Paper} padding={3}>
      <Typography variant="h4">Deposit CERE from Wallet</Typography>

      <Stack spacing={1}>
        <Typography variant="body1">Your Cere Wallet Address:</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <QRCode value={account.address} size={60} />
          <Typography variant="subtitle2" sx={{ wordBreak: 'break-all' }}>
            {account.address}
          </Typography>
        </Stack>
      </Stack>

      <Divider sx={{ my: 1 }} />
      <Stack component="form" onSubmit={handleSubmit} spacing={1.5} flexGrow={1}>
        <Typography variant="subtitle1">
          Transfer funds from Cere Wallet to DDC Account to keep your buckets running.
        </Typography>

        <Stack direction="row" spacing={2} alignItems="flex-start">
          <TextField
            label="Amount"
            placeholder="0.00"
            type="number"
            {...form.register('amount', {
              required: 'Amount is required',
              valueAsNumber: true,
              validate: (value) => {
                if (Number(value) <= 0) return 'Amount must be greater than 0';
                if (Number(value) > maxValue) return `Amount must not exceed ${maxValue} CERE`;
              },
            })}
            value={form.watch('amount')}
            onChange={(e) => form.setValue('amount', e.target.value, { shouldTouch: true, shouldValidate: true })}
            InputProps={{ endAdornment }}
            error={!!form.formState.errors.amount}
            helperText={form.formState.errors.amount?.message}
            sx={{ flexGrow: 1 }}
          />
          <LoadingButton
            type="submit"
            variant="contained"
            loading={form.formState.isSubmitting}
            endIcon={<CheckIcon />}
            sx={{ width: 150, mt: '24px !important' }}
            disabled={!form.formState.isValid}
          >
            Confirm
          </LoadingButton>
        </Stack>
        {maxValue === 0 && (
          <Typography variant="subtitle1" color="error">
            You don't have enough funds in your Cere Wallet. Please top up your Cere Wallet first.
          </Typography>
        )}
        <Stack flexGrow={1} />
        <Typography variant="body2" color="text.secondary">
          Funds sent to this account can't be withdrawn.
        </Typography>
      </Stack>
    </Stack>
  );
};

export default observer(DepositFromWallet); 