import { observer } from 'mobx-react-lite';
import { Typography, TextField, LoadingButton, RightArrowIcon, Stack } from '@cluster-apps/ui';
import { useForm } from 'react-hook-form';

import { useAccountStore } from '~/hooks';

const Login = () => {
  const account = useAccountStore();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
    },
  });

  return (
    <Stack
      component="form"
      margin="auto"
      spacing={2}
      width={600}
      onSubmit={handleSubmit(async ({ email }) => {
        await account.connect({ email });
      })}
    >
      <Typography variant="h2" textAlign="center">
        Global Access Registry
      </Typography>

      <Typography variant="h4" textAlign="center">
        Login to continue
      </Typography>

      <TextField
        {...register('email', { required: 'Please set the email' })}
        fullWidth
        label="Account Email"
        placeholder="Enter your email"
        variant="outlined"
      />

      <LoadingButton
        fullWidth
        loading={isSubmitting}
        type="submit"
        variant="contained"
        size="large"
        endIcon={<RightArrowIcon />}
      >
        Get Started
      </LoadingButton>
    </Stack>
  );
};

export default observer(Login);
