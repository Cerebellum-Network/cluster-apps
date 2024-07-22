import { Button, CircularProgress, FormControl, Stack, TextField } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { SubmitButton, Terms, SubTitle, Title } from './Login.styled';
import { OnboardingLayout } from '~/components/layouts/onboarding/OnboardingLayout';
import { DiscordIcon, Layout, ArrowRight } from '@developer-console/ui';
import { useAccountStore } from '~/hooks';
import { useNavigate } from 'react-router-dom';

const validationSchema = yup
  .object({
    email: yup.string().email('Invalid email format').required('Please set the email'),
  })
  .required();

const Login = observer(() => {
  const account = useAccountStore();
  const navigate = useNavigate();

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

    navigate('/');
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
        <Stack component="form" onSubmit={onSubmit} justifyContent={'center'} alignItems={'center'} flex="1">
          <Title>Welcome to [Cluster Name]</Title>
          <SubTitle sx={{ mt: 4, mb: 3 }}>
            Unlock the power of the first Web3 Data Cloud for real-world applications. Get started in just a minutes.
          </SubTitle>

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
          <SubmitButton
            className="click"
            type="submit"
            disabled={!isValid}
            sx={{
              pointerEvents: isLoading ? 'none' : 'auto',
              width: 600,
            }}
          >
            {isLoading ? (
              <CircularProgress sx={{ color: '#fff' }} size="20px" />
            ) : (
              <>
                Get Started <ArrowRight />
              </>
            )}
          </SubmitButton>
          <Terms>
            By using your Cere wallet you automatically agree to our
            <br /> <a href="#">Terms & Conditions</a> and <a href="#">Privacy Policy</a>
          </Terms>
        </Stack>
      </OnboardingLayout>
    </Layout>
  );
});

export default Login;
