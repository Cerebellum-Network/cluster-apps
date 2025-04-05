import React, { useState } from 'react';

import { 
  Box, 
  Container, 
  Stepper, 
  Step, 
  StepLabel, 
  Paper, 
  Button, 
  Typography,
  styled,
  useTheme
} from '@mui/material';
import { TopUpForm } from '../TopUpForm';
import { StripePayment } from '../StripePayment';
import { WalletConnector, WalletType } from '../WalletConnector';
import { TransactionStatus, TransactionStep } from '../TransactionStatus';

// Cere brand colors
const cerePurple = '#8e44ef';
const cereDarkPurple = '#6c2ee3';
const cereDarkBackground = '#121212';
const cereAccent = '#a46dff';

// Custom styled components
const CereContainer = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
  color: '#fff',
}));

const CerePaper = styled(Paper)({
  padding: 24,
  background: cereDarkBackground,
  border: `1px solid ${cerePurple}30`,
  borderRadius: 16,
  boxShadow: `0 8px 32px 0 ${cerePurple}20`,
  color: '#fff',
});

const CereButton = styled(Button)({
  background: `linear-gradient(135deg, ${cerePurple} 0%, ${cereDarkPurple} 100%)`,
  color: 'white',
  '&:hover': {
    background: `linear-gradient(135deg, ${cerePurple} 30%, ${cereDarkPurple} 100%)`,
    boxShadow: `0 4px 20px 0 ${cerePurple}60`,
  },
  '&.Mui-disabled': {
    background: '#333',
    color: '#666',
  },
  padding: '10px 24px',
  borderRadius: 8,
  textTransform: 'none',
  fontWeight: 600,
});

const CereSecondaryButton = styled(Button)({
  color: '#fff',
  borderColor: cerePurple,
  '&:hover': {
    borderColor: cereAccent,
    backgroundColor: `${cerePurple}20`,
  },
  padding: '10px 24px',
  borderRadius: 8,
  textTransform: 'none',
});

const CereStepper = styled(Stepper)({
  '& .MuiStepIcon-root': {
    color: '#333',
    '&.Mui-active, &.Mui-completed': {
      color: cerePurple,
    }
  },
  '& .MuiStepLabel-label': {
    color: '#ccc',
    '&.Mui-active': {
      color: '#fff',
    }
  },
  '& .MuiStepConnector-line': {
    borderColor: '#333',
  }
});

const CereTitle = styled(Typography)({
  fontSize: 24,
  fontWeight: 700,
  marginBottom: 16,
  color: '#fff',
  textAlign: 'center',
  '&:after': {
    content: '""',
    display: 'block',
    width: 60,
    height: 3,
    background: `linear-gradient(90deg, ${cerePurple}, transparent)`,
    marginTop: 8,
    marginLeft: 'auto',
    marginRight: 'auto',
  }
});

export const TopUpDemo: React.FC = () => {
  // Payment flow states
  const [activeStep, setActiveStep] = useState(0);
  const [amount, setAmount] = useState(100);
  const [currency, setCurrency] = useState('USDC');
  const [paymentMethod, setPaymentMethod] = useState<'creditCard' | 'crypto'>('creditCard');
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'processing' | 'success' | 'error'>('idle');
  const [transactionId, setTransactionId] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [connectedWallet, setConnectedWallet] = useState<{ type: WalletType; address: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Flow steps
  const steps = ['Enter amount', 'Payment details', 'Confirmation'];
  
  // Transaction steps to display in the status component
  const [transactionSteps, setTransactionSteps] = useState<TransactionStep[]>([
    { label: 'Initiate payment', status: 'pending' },
    { label: 'Process payment', status: 'pending' },
    { label: 'Update DDC account', status: 'pending' }
  ]);
  
  // Handle initial form submission
  const handleTopUpFormSubmit = async (amount: number, currency: string, method: string) => {
    setAmount(amount);
    setCurrency(currency);
    setPaymentMethod(method as 'creditCard' | 'crypto');
    setActiveStep(1);
  };
  
  // Handle wallet connection
  const handleWalletConnect = (wallet: WalletType, address: string) => {
    setConnectedWallet({ type: wallet, address });
  };
  
  // Handle credit card payment
  const handleStripePayment = async (paymentMethodId: string) => {
    await processPayment(paymentMethodId);
  };
  
  // Handle crypto payment
  const handleCryptoPayment = async () => {
    if (!connectedWallet) {
      setErrorMessage('Please connect your wallet first');
      return;
    }
    
    await processPayment(connectedWallet.address);
  };
  
  // Process payment (simulated)
  const processPayment = async (paymentIdOrAddress: string) => {
    setIsProcessing(true);
    setTransactionStatus('processing');
    setActiveStep(2);
    
    // Update transaction steps
    setTransactionSteps(prev => [
      { ...prev[0], status: 'active' },
      { ...prev[1], status: 'pending' },
      { ...prev[2], status: 'pending' }
    ]);
    
    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update first step as completed
      setTransactionSteps(prev => [
        { ...prev[0], status: 'completed' },
        { ...prev[1], status: 'active' },
        { ...prev[2], status: 'pending' }
      ]);
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate simulated transaction ID
      const mockTransactionId = 'tx_' + Math.random().toString(36).substring(2, 15);
      setTransactionId(mockTransactionId);
      
      // Update second step as completed
      setTransactionSteps(prev => [
        { ...prev[0], status: 'completed' },
        { ...prev[1], status: 'completed' },
        { ...prev[2], status: 'active' }
      ]);
      
      // Simulate DDC account update
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update third step as completed
      setTransactionSteps(prev => [
        { ...prev[0], status: 'completed' },
        { ...prev[1], status: 'completed' },
        { ...prev[2], status: 'completed' }
      ]);
      
      // Successfully complete
      setTransactionStatus('success');
    } catch (error) {
      setTransactionStatus('error');
      setErrorMessage('Transaction failed. Please try again.');
      
      // Mark current step as error
      const failedStepIndex = transactionSteps.findIndex(step => step.status === 'active');
      if (failedStepIndex >= 0) {
        const updatedSteps = [...transactionSteps];
        updatedSteps[failedStepIndex] = {
          ...updatedSteps[failedStepIndex],
          status: 'error',
          message: 'Failed to process this step'
        };
        setTransactionSteps(updatedSteps);
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Reset the flow
  const handleReset = () => {
    setActiveStep(0);
    setTransactionStatus('idle');
    setTransactionId(undefined);
    setErrorMessage(undefined);
    setConnectedWallet(null);
    setTransactionSteps([
      { label: 'Initiate payment', status: 'pending' },
      { label: 'Process payment', status: 'pending' },
      { label: 'Update DDC account', status: 'pending' }
    ]);
  };
  
  // Retry transaction in case of error
  const handleRetry = () => {
    setTransactionStatus('idle');
    setActiveStep(1);
    setErrorMessage(undefined);
  };
  
  return (
    <CereContainer maxWidth="md">
      <CereTitle variant="h4">
        Cere Network DDC Top-Up
      </CereTitle>
      <CerePaper elevation={10}>
        <Box sx={{ mb: 5, mt: 2 }}>
          <CereStepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </CereStepper>
        </Box>
        
        <Box sx={{ mt: 2 }}>
          {activeStep === 0 && (
            <TopUpForm 
              onSubmit={handleTopUpFormSubmit}
              isLoading={isProcessing}
            />
          )}
          
          {activeStep === 1 && (
            <>
              {paymentMethod === 'creditCard' ? (
                <StripePayment
                  amount={amount}
                  currency={currency}
                  onSubmit={handleStripePayment}
                  isLoading={isProcessing}
                />
              ) : (
                <Box sx={{ mt: 2 }}>
                  <WalletConnector
                    onWalletConnect={handleWalletConnect}
                    isLoading={isProcessing}
                  />
                  
                  {connectedWallet && (
                    <CereButton
                      fullWidth
                      sx={{ mt: 2 }}
                      onClick={handleCryptoPayment}
                      disabled={isProcessing}
                    >
                      Pay {amount} {currency} with {connectedWallet.type}
                    </CereButton>
                  )}
                </Box>
              )}
              
              <CereSecondaryButton
                variant="outlined"
                sx={{ mt: 3 }}
                onClick={() => setActiveStep(0)}
                disabled={isProcessing}
              >
                Back
              </CereSecondaryButton>
            </>
          )}
          
          {activeStep === 2 && (
            <TransactionStatus
              status={transactionStatus}
              transactionId={transactionId}
              errorMessage={errorMessage}
              steps={transactionSteps}
              onRetry={handleRetry}
              onClose={handleReset}
            />
          )}
        </Box>
      </CerePaper>
      
      <Box sx={{ textAlign: 'center', mt: 2, opacity: 0.7 }}>
        <Typography variant="caption" color="white">
          © {new Date().getFullYear()} Cere Network • Decentralized Data Cloud
        </Typography>
      </Box>
    </CereContainer>
  );
}; 