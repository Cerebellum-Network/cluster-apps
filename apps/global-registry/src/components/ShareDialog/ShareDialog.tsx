import { observer } from 'mobx-react-lite';
import { useForm, Controller } from 'react-hook-form';
import { format, parse, addMonths } from 'date-fns';
import { AuthToken, AuthTokenOperation } from '@cere-ddc-sdk/ddc-client';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  DialogTitle,
  LoadingButton,
  Stack,
  ShareIcon,
  BucketSelect,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
} from '@cluster-apps/ui';

import { useAccountStore } from '../../hooks';
import { useRegistryStore } from '../../hooks/useRegistryStore';
import { AccessRegistryEntity } from '@cluster-apps/api';
import { useEffect } from 'react';

export type ShareDialogProps = Pick<DialogProps, 'open' | 'onClose'> & {
  access?: AccessRegistryEntity;
  onSave?: (access: AccessRegistryEntity) => void;
  onExited?: () => void;
};

const DATE_FORMAT = "yyyy-MM-dd'T'HH:mm";

const defaultValues = {
  account: '',
  bucketId: 0n,
  canDelegate: false,
  opRead: true,
  opWrite: false,
  expirationDate: format(addMonths(new Date(), 1), DATE_FORMAT),
};

const ShareDialog = ({ open, onClose, onSave, onExited, access }: ShareDialogProps) => {
  const accountStore = useAccountStore();
  const registryStore = useRegistryStore();
  const form = useForm({ defaultValues });

  useEffect(() => {
    if (!access) {
      return form.reset(defaultValues);
    }

    const accessToken = AuthToken.maybeToken(access.accessToken)!;

    form.reset({
      account: access.accountId,
      bucketId: access.bucketId,
      canDelegate: accessToken.canDelegate,
      opRead: accessToken.operations.includes(AuthTokenOperation.GET),
      opWrite: accessToken.operations.includes(AuthTokenOperation.PUT),
      expirationDate: format(accessToken.expiresAt, DATE_FORMAT),
    });
  }, [open, access, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    const operations: AuthTokenOperation[] = [];

    if (data.opRead) {
      operations.push(AuthTokenOperation.GET);
    }

    if (data.opWrite) {
      operations.push(AuthTokenOperation.PUT);
    }

    const token = new AuthToken({
      operations,
      subject: data.account,
      bucketId: data.bucketId,
      canDelegate: data.canDelegate,
      expiresAt: parse(data.expirationDate, DATE_FORMAT, new Date()).getTime(),
    });

    await token.sign(accountStore.signer);
    const access = await registryStore.saveAccess({ accessToken: token.toString() });

    onSave?.(access);
  });

  return (
    <Dialog open={open} onClose={onClose} TransitionProps={{ onExited }}>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center" paddingTop={1}>
          <Typography variant="h4">Bucket access</Typography>

          <Controller
            control={form.control}
            name="bucketId"
            render={({ field }) => <BucketSelect disabled={!!access} {...field} options={accountStore.buckets} />}
          />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack width={450} marginBottom={2} spacing={3} alignItems="flex-start">
          <TextField
            {...form.register('account', { required: true })}
            fullWidth
            disabled={!!access}
            label="Account address or public key"
          />

          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              Access details
            </Typography>

            <Stack direction="row" alignItems="center">
              <Box width={130}>
                <Typography>Can delegate</Typography>
              </Box>
              <Box flex={1}>
                <Controller
                  control={form.control}
                  name="canDelegate"
                  render={({ field }) => <Checkbox {...field} checked={field.value} />}
                />
              </Box>
            </Stack>

            <Stack direction="row" alignItems="center">
              <Box width={130}>
                <Typography>Operations</Typography>
              </Box>
              <Stack flex={1} direction="row" spacing={1}>
                <FormControlLabel
                  label="Read"
                  control={
                    <Controller
                      control={form.control}
                      name="opRead"
                      render={({ field }) => <Checkbox {...field} checked={field.value} />}
                    />
                  }
                />

                <FormControlLabel
                  label="Write"
                  control={
                    <Controller
                      control={form.control}
                      name="opWrite"
                      render={({ field }) => <Checkbox {...field} checked={field.value} />}
                    />
                  }
                />
              </Stack>
            </Stack>

            <Stack direction="row" alignItems="center">
              <Box width={130}>
                <Typography>Expiration date</Typography>
              </Box>
              <Box marginLeft={1}>
                <TextField
                  {...form.register('expirationDate', { required: true })}
                  size="small"
                  type="datetime-local"
                />
              </Box>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Stack padding={1} flex={1} direction="row" justifyContent="space-between">
          <Button variant="text" size="large" onClick={(event) => onClose?.(event, 'escapeKeyDown')}>
            Cancel
          </Button>

          <LoadingButton
            loading={form.formState.isSubmitting}
            variant="contained"
            size="large"
            startIcon={<ShareIcon />}
            onClick={handleSubmit}
          >
            {access ? 'Update access' : 'Share access'}
          </LoadingButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default observer(ShareDialog);
