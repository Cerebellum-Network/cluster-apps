import { observer } from 'mobx-react-lite';
import { useForm } from 'react-hook-form';
import {
  CheckIcon,
  Divider,
  LoadingButton,
  Paper,
  QRCode,
  Stack,
  TextField,
  Typography,
  useMessages,
} from '@developer-console/ui';

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
    });
  });

  return (
    <Stack spacing={2} component="form" onSubmit={handleSubmit}>
      <Typography variant="h4">Top up your account</Typography>
      <Stack component={Paper} spacing={2} padding={3}>
        <Typography variant="subtitle1">
          Send CERE tokens to your wallet directly to keep your buckets running
        </Typography>

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

        <Typography variant="subtitle1">Transfer funds from Cere Wallet to DDC Account</Typography>
        <Typography variant="body1">Choose how much crypto you want to transfer to your DDC Account</Typography>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Amount"
            placeholder="0.00"
            type="number"
            InputProps={{
              ...form.register('amount', { required: true }),

              endAdornment: <Typography color="text.secondary">CERE</Typography>,
            }}
          />
          <LoadingButton
            type="submit"
            variant="contained"
            loading={form.formState.isSubmitting}
            endIcon={<CheckIcon />}
            sx={{ width: 150 }}
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
