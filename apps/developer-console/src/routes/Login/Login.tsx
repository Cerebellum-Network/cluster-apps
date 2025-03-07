import { AnalyticsId, trackEvent } from '@cluster-apps/analytics';
import { FormControl, LoadingButton, RightArrowIcon, TextField, Typography } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Snackbar } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { Terms, VideoBackground, LoginContainer, LoginBox } from './Login.styled';
import { DDC_CLUSTER_NAME, PRIVACY_POLICY, TERMS_AND_CONDITIONS_LINK } from '~/constants';
import { useAccountStore, useOnboardingStore, useEmailCampaignService } from '~/hooks';
import { styled } from '@mui/material';

const StyledTextField = styled(TextField)(({ theme }) => ({
  borderRadius: '12px',
  width: '100%',
  marginBottom: theme.spacing(2),
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.5)',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  '& .MuiOutlinedInput-input': {
    color: 'white',
  },
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
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    watch,
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: '',
    },
  });

  // Log email changes for debugging
  React.useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'email') {
        console.log('Email input changed:', value.email);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const onSubmit = handleSubmit(async (data) => {
    console.log('Starting login process for email:', data.email);
    setError(null);
    
    try {
      console.log('Attempting to connect account...');
      const { isNewUser } = await account.connect(data);
      console.log('Account connected successfully, isNewUser:', isNewUser);

      console.log('Checking onboarding status...');
      const shouldOnboard = await onboarding.shouldOnboard();
      const shouldSendToMarketingTool = await onboarding.shouldSendToMarketingTool();
      console.log('Onboarding checks complete:', { shouldOnboard, shouldSendToMarketingTool });

      if (shouldSendToMarketingTool) {
        console.log('Adding contact to marketing tool...');
        try {
          await emailCampaignService.addContactToMailjet(data.email);
          console.log('Contact added to marketing tool successfully');
        } catch (error) {
          console.error('Failed to add contact to marketing tool:', error);
          // Don't block the login process for marketing tool errors
        }
      }

      console.log('Tracking analytics event...');
      trackEvent(isNewUser ? AnalyticsId.signUp : AnalyticsId.signIn);
      
      console.log('Navigating to next page...');
      navigate(shouldOnboard ? '/login/onboarding' : '/');
    } catch (error) {
      console.error('Login process failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect. Please check your email for the OTP code and try again.');
    }
  });

  return (
    <>
      <VideoBackground autoPlay muted loop>
        <source src="https://cdn.pixabay.com/video/2023/10/17/185365-875417518.mp4" type="video/mp4" />
      </VideoBackground>
      <LoginContainer>
        <LoginBox>
          <form onSubmit={onSubmit}>
            <Typography variant="h3" textAlign="center" color="common.white" gutterBottom>
              Welcome to {DDC_CLUSTER_NAME}
            </Typography>
            <Typography variant="subtitle1" textAlign="center" color="common.white" sx={{ mb: 4 }}>
              Unlock the power of the first Web3 Data Cloud for real-world applications. Get started for free in just a
              minute, no credit card required.
            </Typography>

            <FormControl fullWidth>
              <StyledTextField
                {...register('email')}
                type="email"
                label="Account Email"
                placeholder="Enter your email"
                variant="outlined"
                error={!!errors?.['email']?.message}
                helperText={errors?.['email']?.message}
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
              sx={{
                height: 48,
                fontSize: '1.1rem',
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1976D2 30%, #00BCD4 90%)',
                },
              }}
            >
              Get Started
            </LoadingButton>

            <Terms textAlign="center" variant="caption">
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
          </form>
        </LoginBox>
      </LoginContainer>

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" variant="filled">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
});

export default Login;
