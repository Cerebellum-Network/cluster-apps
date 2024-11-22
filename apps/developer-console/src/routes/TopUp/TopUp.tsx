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

const TopUp = () => {
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
    <Stack spacing={2} component="form" onSubmit={handleSubmit}>
      <Typography variant="h4">Top up your account</Typography>
      <Stack component={Paper} spacing={2} padding={3}>
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

        <Stack direction="row" spacing={2}>
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
          />
          <LoadingButton
            type="submit"
            variant="contained"
            loading={form.formState.isSubmitting}
            endIcon={<CheckIcon />}
            sx={{ width: 150 }}
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
        <Typography variant="body2" color="text.secondary">
          Funds sent to this account can't be withdrawn
        </Typography>
      </Stack>
    </Stack>
  );
};

export default observer(TopUp);
