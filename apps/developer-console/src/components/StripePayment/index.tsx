import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Stack,
  styled
} from '@mui/material';

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
  '&.Mui-disabled': {
    background: '#333',
    color: '#666',
  },
  padding: '10px 24px',
  borderRadius: 8,
  textTransform: 'none',
  fontWeight: 600,
});

const CereTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': {
      borderColor: '#444',
    },
    '&:hover fieldset': {
      borderColor: cerePurple,
    },
    '&.Mui-focused fieldset': {
      borderColor: cerePurple,
    },
    '& input': {
      color: '#fff',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#aaa',
    '&.Mui-focused': {
      color: cerePurple,
    },
  },
  '& .MuiFormHelperText-root': {
    color: '#f44336',
  },
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
}));

// Nota: Este es un componente simulado que muestra cómo se vería la integración con Stripe
// En una implementación real, necesitarías importar los componentes de Stripe
// y configurar el proveedor adecuadamente

interface StripePaymentProps {
  amount: number;
  currency: string;
  onSubmit: (paymentMethodId: string) => Promise<void>;
  isLoading?: boolean;
}

export const StripePayment: React.FC<StripePaymentProps> = ({
  amount,
  currency,
  onSubmit,
  isLoading = false
}) => {
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState('');
  
  // En una implementación real, estos estados se usarían para guardar
  // los objetos de Stripe y gestionar los errores de validación
  const [cardComplete, setCardComplete] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cardComplete || !cardholderName) {
      setError('Please complete all payment details');
      return;
    }
    
    setError(null);
    
    try {
      // En una implementación real, esto crearía un Payment Method en Stripe
      // y devolvería el ID para procesarlo en el servidor
      const mockPaymentMethodId = 'pm_' + Math.random().toString(36).substring(2, 15);
      
      await onSubmit(mockPaymentMethodId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment processing failed');
    }
  };

  const getCurrencySymbol = (currencyCode: string): string => {
    switch (currencyCode.toUpperCase()) {
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      case 'USDC':
      case 'USDT':
        return 'USDC';
      default:
        return currencyCode;
    }
  };

  const formatAmount = (amt: number, currencyCode: string): string => {
    return `${getCurrencySymbol(currencyCode)} ${amt.toFixed(2)}`;
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }} gutterBottom>
        Payment Details
      </Typography>
      
      <Divider sx={{ mb: 2, opacity: 0.3 }} />
      
      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#aaa', mb: 1 }}>
              Amount: <span style={{ color: '#fff', fontWeight: 500 }}>{formatAmount(amount, currency)}</span>
            </Typography>
          </Box>
          
          <CereTextField
            label="Cardholder Name"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            fullWidth
            required
            disabled={isLoading}
          />
          
          {/* Aquí irían los componentes de Stripe Elements en una implementación real */}
          <Box 
            sx={{ 
              border: `1px solid ${cerePurple}30`, 
              p: 2, 
              borderRadius: 1, 
              bgcolor: cereLightBackground,
              opacity: isLoading ? 0.6 : 1
            }}
          >
            <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>
              Card Information
            </Typography>
            
            {/* Simulación de la interfaz de Stripe */}
            <CereTextField
              label="Card number"
              placeholder="4242 4242 4242 4242"
              fullWidth
              sx={{ mb: 2 }}
              disabled={isLoading}
              onChange={() => setCardComplete(true)}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <CereTextField
                label="Expiration"
                placeholder="MM/YY"
                sx={{ flex: 1 }}
                disabled={isLoading}
              />
              <CereTextField
                label="CVC"
                placeholder="123"
                sx={{ flex: 1 }}
                disabled={isLoading}
              />
            </Box>
          </Box>
          
          {error && (
            <CereAlert severity="error">
              {error}
            </CereAlert>
          )}
          
          <CereButton 
            type="submit" 
            fullWidth
            disabled={isLoading || !cardComplete}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              `Pay ${formatAmount(amount, currency)}`
            )}
          </CereButton>
          
          <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center' }}>
            Your payment is securely processed by Stripe. We do not store your card details.
          </Typography>
        </Stack>
      </form>
    </Box>
  );
}; 