import { FormControl, LoadingButton, RightArrowIcon, Stack, TextField, Typography } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { Terms } from './Login.styled';
import { OnboardingLayout } from '~/components';
import { DDC_CLUSTER_NAME, PRIVACY_POLICY, TERMS_AND_CONDITIONS_LINK } from '~/constants';
import { useAccountStore, useOnboardingStore } from '~/hooks';
import { GoogleAnalyticsId, gtmEvent } from '~/gtm.ts';

const validationSchema = yup
  .object({
    email: yup.string().email('Invalid email format').required('Please set the email'),
  })
  .required();

const Login = observer(() => {
  const account = useAccountStore();
  const onboarding = useOnboardingStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    await account.connect(data);
    const shouldOnboard = await onboarding.shouldOnboard();
    gtmEvent(shouldOnboard ? GoogleAnalyticsId.SignUp : GoogleAnalyticsId.SignIn);
    navigate(shouldOnboard ? '/login/onboarding' : '/');
  });

  return (
    <OnboardingLayout>
      <Stack component="form" justifyContent="center" alignItems="center" flex="1" width={600} onSubmit={onSubmit}>
        <Typography variant="h1" textAlign="center">
          Welcome to {DDC_CLUSTER_NAME}
        </Typography>
        <Typography textAlign="center" sx={{ mt: 4, mb: 3 }}>
          Unlock the power of the first Web3 Data Cloud for real-world applications. Get started in just a minutes.
        </Typography>

        <FormControl>
          <TextField
            {...register('email')}
            fullWidth
            type="email"
            label="Account Email"
            placeholder="Enter your email"
            variant="outlined"
            error={!!errors?.['email']?.message}
            sx={{ width: 600, mb: 3 }}
            InputProps={{ style: { borderRadius: 12 } }}
          />
        </FormControl>
        <LoadingButton
          fullWidth
          type="submit"
          variant="contained"
          size="large"
          disabled={!isValid}
          loading={isSubmitting}
          endIcon={<RightArrowIcon />}
        >
          Get Started
        </LoadingButton>

        <Terms textAlign="center" variant="body2">
          By using your Cere wallet you automatically agree to our
          <br />{' '}
          <a href={TERMS_AND_CONDITIONS_LINK} target="_blank" rel="noopener noreferrer">
            Terms & Conditions
          </a>{' '}
          and{' '}
          <a href={PRIVACY_POLICY} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
        </Terms>
      </Stack>
    </OnboardingLayout>
  );
});

export default Login;
