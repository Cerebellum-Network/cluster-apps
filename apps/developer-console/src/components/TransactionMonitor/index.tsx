import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  CircularProgress,
  Alert,
  Link,
  Chip
} from '@mui/material';
import { CheckCircle, ErrorOutline, HourglassEmpty, PendingActions } from '@mui/icons-material';
import { paymentService, TransactionStatus, TransactionInfo } from '../../services/PaymentService';
import { truncateAddress } from '../../utils/stringUtils';
import { useWallet } from '../../providers/WalletProvider';

interface TransactionMonitorProps {
  transactionHash: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export const TransactionMonitor: React.FC<TransactionMonitorProps> = ({
  transactionHash,
  onComplete,
  onError
}) => {
  const { chainId } = useWallet();
  const [transaction, setTransaction] = useState<TransactionInfo | undefined>(
    paymentService.getTransactionInfo(transactionHash)
  );
  const [activeStep, setActiveStep] = useState<number>(0);
  
  // Actualizar la transacción periódicamente
  useEffect(() => {
    if (!transactionHash) return;
    
    // Función para actualizar la información de la transacción
    const updateTransactionInfo = () => {
      const txInfo = paymentService.getTransactionInfo(transactionHash);
      setTransaction(txInfo);
      
      // Actualizar el paso activo
      if (txInfo) {
        switch (txInfo.status) {
          case TransactionStatus.PENDING:
            setActiveStep(0);
            break;
          case TransactionStatus.CONFIRMING:
            setActiveStep(1);
            break;
          case TransactionStatus.CONFIRMED:
            setActiveStep(2);
            if (onComplete) onComplete();
            break;
          case TransactionStatus.FAILED:
            setActiveStep(1); // Mantenemos el paso 1 pero mostramos el error
            if (onError && txInfo.error) onError(txInfo.error);
            break;
        }
      }
    };
    
    // Hacer la primera actualización
    updateTransactionInfo();
    
    // Configurar un intervalo para actualizar la información
    const intervalId = setInterval(updateTransactionInfo, 2000);
    
    // Limpiar el intervalo cuando el componente se desmonte
    return () => clearInterval(intervalId);
  }, [transactionHash, onComplete, onError]);
  
  // Obtener un enlace al explorador de bloques
  const getExplorerLink = (): string => {
    if (!chainId) return '#';
    
    let baseUrl = '';
    switch (chainId) {
      case 1: // Ethereum Mainnet
        baseUrl = 'https://etherscan.io/tx/';
        break;
      case 137: // Polygon
        baseUrl = 'https://polygonscan.com/tx/';
        break;
      case 42161: // Arbitrum
        baseUrl = 'https://arbiscan.io/tx/';
        break;
      case 10: // Optimism
        baseUrl = 'https://optimistic.etherscan.io/tx/';
        break;
      case 11155111: // Sepolia
        baseUrl = 'https://sepolia.etherscan.io/tx/';
        break;
      default:
        return '#';
    }
    
    return `${baseUrl}${transactionHash}`;
  };
  
  // Renderizar mensaje según el estado
  const renderStatusMessage = () => {
    if (!transaction) {
      return (
        <Alert severity="warning">
          No se encontró información de la transacción.
        </Alert>
      );
    }
    
    switch (transaction.status) {
      case TransactionStatus.PENDING:
        return (
          <Alert severity="info" icon={<PendingActions />}>
            Transacción enviada. Esperando confirmación...
          </Alert>
        );
      case TransactionStatus.CONFIRMING:
        return (
          <Alert severity="info" icon={<HourglassEmpty />}>
            Transacción en proceso de confirmación...
          </Alert>
        );
      case TransactionStatus.CONFIRMED:
        return (
          <Alert severity="success" icon={<CheckCircle />}>
            Transacción confirmada exitosamente.
          </Alert>
        );
      case TransactionStatus.FAILED:
        return (
          <Alert severity="error" icon={<ErrorOutline />}>
            La transacción ha fallado: {transaction.error?.message || 'Error desconocido.'}
          </Alert>
        );
      default:
        return null;
    }
  };
  
  // Obtener el nombre del estado
  const getStatusLabel = (status: TransactionStatus): string => {
    switch (status) {
      case TransactionStatus.PENDING:
        return 'Pendiente';
      case TransactionStatus.CONFIRMING:
        return 'Confirmando';
      case TransactionStatus.CONFIRMED:
        return 'Confirmada';
      case TransactionStatus.FAILED:
        return 'Fallida';
      default:
        return 'Desconocido';
    }
  };
  
  return (
    <Paper variant="outlined" sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Monitoreo de Transacción
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Hash: {truncateAddress(transactionHash)}
        </Typography>
        
        <Link
          href={getExplorerLink()}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
        >
          Ver en explorador
        </Link>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        {renderStatusMessage()}
      </Box>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Estado:
        </Typography>
        <Chip
          label={transaction ? getStatusLabel(transaction.status) : 'Desconocido'}
          color={
            transaction?.status === TransactionStatus.CONFIRMED
              ? 'success'
              : transaction?.status === TransactionStatus.FAILED
              ? 'error'
              : 'primary'
          }
          variant="outlined"
          size="small"
          sx={{ mr: 1 }}
        />
      </Box>
      
      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>Transacción enviada</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              La transacción ha sido firmada y enviada a la red blockchain.
            </Typography>
            <Box sx={{ mb: 2 }} />
          </StepContent>
        </Step>
        
        <Step>
          <StepLabel>Procesando en blockchain</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              La transacción está siendo procesada por la red. Esto puede tardar dependiendo de la congestión de la red.
            </Typography>
            <Box sx={{ mb: 2 }}>
              {transaction?.status === TransactionStatus.CONFIRMING && (
                <CircularProgress size={20} sx={{ mt: 1 }} />
              )}
            </Box>
          </StepContent>
        </Step>
        
        <Step>
          <StepLabel>Transacción completada</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              La transacción ha sido confirmada y el pago ha sido procesado exitosamente.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={onComplete}
              >
                Continuar
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>
      
      {transaction?.status === TransactionStatus.FAILED && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              if (onError && transaction.error) {
                onError(transaction.error);
              }
            }}
          >
            Reintentar
          </Button>
        </Box>
      )}
    </Paper>
  );
}; 