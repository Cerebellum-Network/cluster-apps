import { AnalyticsId, trackEvent } from '@cluster-apps/analytics';
import { FormControl, LoadingButton, RightArrowIcon, Stack, TextField, Typography } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { Terms } from './Login.styled';
import { OnboardingLayout } from '~/components';
import { DDC_CLUSTER_NAME, PRIVACY_POLICY, TERMS_AND_CONDITIONS_LINK } from '~/constants';
import { useAccountStore, useOnboardingStore, useEmailCampaignService } from '~/hooks';
import { styled } from '@mui/material';

const StyledTextField = styled(TextField)(({ theme }) => ({
  borderRadius: '12px',
  width: '100%',
  marginBottom: theme.spacing(2),
}));

const StyledStack = styled(Stack)(() => ({
  justifyContent: 'center',
  alignItems: 'center',
  flex: 1,
  width: '100%',
  maxWidth: 600,
  margin: 'auto',
}));

const validationSchema = yup
  .object({
    email: yup.string().email('Invalid email format').required('Please set the email'),
  })
  .required();

const Login = observer(() => {
  const account = useAccountStore();
  const onboarding = useOnboardingStore();
  const navigate = useNavigate();
  const emailCampaignService = useEmailCampaignService();

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
    const { isNewUser } = await account.connect(data);
    const shouldOnboard = await onboarding.shouldOnboard();
    const shouldSendToMarketingTool = await onboarding.shouldSendToMarketingTool();

    if (shouldSendToMarketingTool) {
      emailCampaignService.addContactToMailjet(data.email).catch(reportError);
    }

    trackEvent(isNewUser ? AnalyticsId.signUp : AnalyticsId.signIn);
    navigate(shouldOnboard ? '/login/onboarding' : '/');
  });

  return (
    <OnboardingLayout>
      <form onSubmit={onSubmit}>
        <StyledStack>
          <Typography variant="h1" textAlign="center">
            Welcome to {DDC_CLUSTER_NAME}
          </Typography>
          <Typography variant="h4" textAlign="center" sx={{ mt: 4, mb: 3 }}>
            Unlock the power of the first Web3 Data Cloud for real-world applications. Get started for free in just a
            minutes, no credit card required.
          </Typography>

          <FormControl fullWidth>
            <StyledTextField
              {...register('email')}
              type="email"
              label="Account Email"
              placeholder="Enter your email"
              variant="outlined"
              error={!!errors?.['email']?.message}
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

          <Terms textAlign="center" variant="caption" color="secondary">
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
        </StyledStack>
      </form>
    </OnboardingLayout>
  );
});

export default Login;
