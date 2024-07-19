import { CircularProgress, FormControl, Stack, TextField, Button, Typography } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { Terms } from './Login.styled';
import { OnboardingLayout } from '~/components/OnboardingLayout';
import { DiscordIcon, Layout, ArrowRight } from '@developer-console/ui';
import { useAccountStore } from '~/hooks';

const validationSchema = yup
  .object({
    email: yup.string().email('Invalid email format').required('Please set the email'),
  })
  .required();

const Login = observer(() => {
  const account = useAccountStore();

  const isLoading = false;
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue: setFormValue,
    trigger: formTrigger,
  } = useForm({
    resolver: yupResolver(validationSchema),
    mode: 'all',
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    await account.connect(data);
  });

  return (
    <Layout
      headerRight={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="secondary">
            Developer Docs
          </Button>

          <Button startIcon={<DiscordIcon />}>Discord</Button>
        </Stack>
      }
    >
      <OnboardingLayout>
        <Stack justifyContent="center" alignItems="center" flex="1">
          <Typography variant="h2" textAlign="center">
            Welcome to [Cluster Name]
          </Typography>
          <Typography variant="h6" textAlign="center" sx={{ mt: 4, mb: 3 }}>
            Unlock the power of the first Web3 Data Cloud for real-world applications. Get started in just a minutes.
          </Typography>

          <FormControl>
            <TextField
              {...register('email')}
              type="email"
              label="Account Email"
              placeholder="Enter your email"
              variant="outlined"
              error={!!errors?.['email']?.message}
              sx={{ width: 600, mb: 3 }}
              InputProps={{ style: { borderRadius: 12 } }}
              onChange={(value) => {
                setFormValue('email', value.target.value);
                formTrigger(['email']);
              }}
            />
          </FormControl>
          <Button
            onClick={onSubmit}
            id="start-account-btn"
            className="click"
            type="submit"
            disabled={!isValid}
            sx={{
              pointerEvents: isLoading ? 'none' : 'auto',
              width: 600,
              height: 56,
            }}
          >
            {isLoading ? (
              <CircularProgress sx={{ color: '#fff' }} size="20px" />
            ) : (
              <>
                Get Started <ArrowRight />
              </>
            )}
          </Button>
          <Terms textAlign="center" variant="body2">
            By using your Cere wallet you automatically agree to our
            <br /> <a href="#">Terms & Conditions</a> and <a href="#">Privacy Policy</a>
          </Terms>
        </Stack>
      </OnboardingLayout>
    </Layout>
  );
});

export default Login;
