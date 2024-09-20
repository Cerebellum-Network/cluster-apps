import { observer } from 'mobx-react-lite';
import { Typography, TextField, LoadingButton, RightArrowIcon, Stack } from '@cluster-apps/ui';
import { useForm } from 'react-hook-form';

import { useAccountStore } from '~/hooks';
import { DDC_CLUSTER_NAME } from '../../constants';

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
      <Stack spacing={2} textAlign="center">
        <Typography variant="h1">Welcome to {DDC_CLUSTER_NAME}</Typography>
        <Typography variant="h2">Global Access Registry</Typography>
      </Stack>

      <Stack spacing={1} textAlign="center" padding={4}>
        <Typography variant="body1">Manage access to your content.</Typography>
        <Typography variant="subtitle1">Get started in just a minute.</Typography>
      </Stack>

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
