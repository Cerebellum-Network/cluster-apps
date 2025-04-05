import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  AlertTitle,
  CircularProgress,
  Button,
  Stepper,
  Step,
  StepLabel,
  Divider,
  styled
} from '@mui/material';
import { CheckCircle, Error, Info } from '@mui/icons-material';

// Colores de marca Cere
const cerePurple = '#8e44ef';
const cereDarkPurple = '#6c2ee3';
const cereDarkBackground = '#121212';
const cereLightBackground = '#1e1e1e';
const cereAccent = '#a46dff';

// Componentes estilizados
const CerePaper = styled(Paper)({
  padding: 24,
  background: cereDarkBackground,
  border: `1px solid ${cerePurple}30`,
  borderRadius: 16,
  color: '#fff',
});

const CereButton = styled(Button)({
  background: `linear-gradient(135deg, ${cerePurple} 0%, ${cereDarkPurple} 100%)`,
  color: 'white',
  '&:hover': {
    background: `linear-gradient(135deg, ${cerePurple} 30%, ${cereDarkPurple} 100%)`,
    boxShadow: `0 4px 20px 0 ${cerePurple}60`,
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
  padding: '8px 20px',
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

const CereAlert = styled(Alert)(({ severity }) => ({
  backgroundColor: severity === 'error' ? 'rgba(211, 47, 47, 0.2)' : 
                  severity === 'success' ? 'rgba(46, 125, 50, 0.2)' : 
                  'rgba(2, 136, 209, 0.2)',
  color: '#fff',
  border: severity === 'error' ? '1px solid rgba(211, 47, 47, 0.5)' : 
         severity === 'success' ? '1px solid rgba(46, 125, 50, 0.5)' : 
         '1px solid rgba(2, 136, 209, 0.5)',
  '& .MuiAlert-icon': {
    color: severity === 'error' ? '#f44336' : 
          severity === 'success' ? '#4caf50' : 
          '#29b6f6',
  },
  '& .MuiAlert-message': {
    color: '#fff',
  },
  '& .MuiAlertTitle-root': {
    color: severity === 'error' ? '#f44336' : 
          severity === 'success' ? '#4caf50' : 
          '#29b6f6',
    fontWeight: 600,
  }
}));

export type TransactionStep = {
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
};

export type TransactionStatus = 
  | 'idle' 
  | 'pending' 
  | 'processing' 
  | 'success' 
  | 'error';

interface TransactionStatusProps {
  status: TransactionStatus;
  transactionId?: string;
  errorMessage?: string;
  steps?: TransactionStep[];
  onRetry?: () => void;
  onClose?: () => void;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  status,
  transactionId,
  errorMessage,
  steps = [],
  onRetry,
  onClose
}) => {
  const isCompleted = status === 'success';
  const isError = status === 'error';
  const isProcessing = status === 'processing' || status === 'pending';

  const renderStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle sx={{ fontSize: 60, color: '#4caf50' }} />;
      case 'error':
        return <Error sx={{ fontSize: 60, color: '#f44336' }} />;
      case 'processing':
      case 'pending':
        return <CircularProgress size={60} sx={{ color: cerePurple }} />;
      default:
        return <Info sx={{ fontSize: 60, color: '#29b6f6' }} />;
    }
  };

  const renderStatusTitle = () => {
    switch (status) {
      case 'success':
        return 'Transaction Completed';
      case 'error':
        return 'Transaction Failed';
      case 'processing':
        return 'Processing Transaction';
      case 'pending':
        return 'Transaction Pending';
      default:
        return 'Ready to Process';
    }
  };

  const renderStatusMessage = () => {
    switch (status) {
      case 'success':
        return 'Your DDC account has been successfully topped up.';
      case 'error':
        return errorMessage || 'An error occurred during the transaction. Please try again.';
      case 'processing':
        return 'Your transaction is being processed. This may take a few moments.';
      case 'pending':
        return 'Waiting for your payment to be confirmed.';
      default:
        return 'Prepare to process your transaction.';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        {renderStatusIcon()}
        <Typography variant="h5" sx={{ mt: 2, color: '#fff', fontWeight: 600 }}>
          {renderStatusTitle()}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1, textAlign: 'center', color: '#aaa' }}>
          {renderStatusMessage()}
        </Typography>
        
        {transactionId && (
          <Typography variant="body2" sx={{ mt: 2, color: '#aaa', fontFamily: 'monospace', background: cereLightBackground, padding: '4px 8px', borderRadius: '4px' }}>
            Transaction ID: {transactionId}
          </Typography>
        )}
      </Box>

      {isError && (
        <CereAlert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            onRetry && (
              <CereSecondaryButton variant="outlined" size="small" onClick={onRetry}>
                Retry
              </CereSecondaryButton>
            )
          }
        >
          <AlertTitle>Error</AlertTitle>
          {errorMessage || 'An error occurred during the transaction. Please try again.'}
        </CereAlert>
      )}

      {steps.length > 0 && (
        <>
          <Divider sx={{ my: 2, opacity: 0.3 }} />
          <Typography variant="subtitle1" sx={{ mb: 2, color: '#fff', fontWeight: 500 }}>
            Transaction Steps
          </Typography>
          <CereStepper orientation="vertical" activeStep={steps.findIndex(step => step.status === 'active')}>
            {steps.map((step, index) => (
              <Step key={index} completed={step.status === 'completed'}>
                <StepLabel error={step.status === 'error'}>
                  <Typography variant="body2" sx={{ color: step.status === 'active' ? '#fff' : '#aaa' }}>
                    {step.label}
                    {step.message && (
                      <Typography variant="caption" component="div" sx={{ color: step.status === 'error' ? '#f44336' : '#aaa' }}>
                        {step.message}
                      </Typography>
                    )}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </CereStepper>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        {(isCompleted || isError) && onClose && (
          <CereButton 
            onClick={onClose}
            sx={{ minWidth: 120 }}
          >
            {isCompleted ? 'Done' : 'Close'}
          </CereButton>
        )}
      </Box>
    </Box>
  );
}; 