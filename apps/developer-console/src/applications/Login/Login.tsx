import React from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from '~/hooks';

interface LoginFormData {
  email: string;
}

export const Login = observer(() => {
  const accountStore = useAccountStore();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginFormData) => {
    console.log('Starting login process for email:', data.email);

    try {
      console.log('Attempting to connect account...');
      const userInfo = await accountStore.connect({ email: data.email });
      console.log('Account connected successfully, userInfo:', userInfo);

      // Skip onboarding and go directly to console
      navigate('/console');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  return (
    // ... existing JSX ...
  );
}); 