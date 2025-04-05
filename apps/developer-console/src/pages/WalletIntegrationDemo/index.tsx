import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Grid,
  Button,
  Stepper,
  Step,
  StepLabel,
  Alert
} from '@mui/material';
import { WalletConnector } from '../../components/WalletConnector';
import { NetworkSelector } from '../../components/NetworkSelector';
import { TokenInfoCard } from '../../components/TokenInfoCard';
import { useWallet } from '../../providers/WalletProvider';
import { truncateAddress } from '../../utils/stringUtils';

const WalletIntegrationDemo: React.FC = () => {
  const { 
    address, 
    isConnected, 
    walletType, 
    walletName, 
    chainId, 
    error 
  } = useWallet();
  
  // Estados para el flujo de pago
  const [activeStep, setActiveStep] = useState(0);
  const [selectedToken, setSelectedToken] = useState<string>('USDC');
  
  // Pasos del flujo de pago
  const steps = [
    'Conectar wallet',
    'Seleccionar red',
    'Aprobar tokens',
    'Realizar pago'
  ];
  
  // Manejar la conexión del wallet
  const handleWalletConnect = (walletType: any, address: string) => {
    // Avanzar al siguiente paso automáticamente
    setActiveStep(1);
  };
  
  // Manejar selección de red
  const handleNetworkChange = () => {
    // Cuando la red cambia, avanzamos al siguiente paso
    if (isConnected && chainId) {
      setActiveStep(2);
    }
  };
  
  // Manejar la actualización de allowance
  const handleAllowanceUpdated = (amount: string) => {
    // Cuando se aprueba el allowance, avanzamos al siguiente paso
    setActiveStep(3);
  };
  
  // Renderizar el paso actual
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom>
              Conecta tu wallet para comenzar
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Necesitas conectar un wallet compatible con EVM para interactuar con la aplicación.
            </Typography>
            <Box sx={{ maxWidth: 300, mx: 'auto', mt: 2 }}>
              <WalletConnector
                onWalletConnect={handleWalletConnect}
                supportedWallets={['metamask', 'walletconnect', 'coinbase']}
              />
            </Box>
          </Box>
        );
      
      case 1:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom>
              Selecciona una red compatible
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Necesitas conectarte a una red donde estén desplegados nuestros contratos.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => handleNetworkChange()}
              >
                Ethereum Mainnet
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => handleNetworkChange()}
              >
                Polygon
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => handleNetworkChange()}
              >
                Sepolia (Testnet)
              </Button>
            </Box>
            <Box sx={{ mt: 4, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                O selecciona una red manualmente:
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                <NetworkSelector />
              </Box>
            </Box>
          </Box>
        );
      
      case 2:
        return (
          <Box sx={{ py: 3 }}>
            <Typography variant="h5" gutterBottom>
              Selecciona un token y aprueba su uso
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Necesitas aprobar que nuestro contrato utilice tus tokens.
            </Typography>
            
            <Box sx={{ mt: 3, mb: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TokenInfoCard 
                    tokenSymbol="USDC" 
                    onUpdateAllowance={handleAllowanceUpdated}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TokenInfoCard 
                    tokenSymbol="USDT" 
                    onUpdateAllowance={handleAllowanceUpdated}
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>
        );
      
      case 3:
        return (
          <Box sx={{ py: 3 }}>
            <Typography variant="h5" gutterBottom>
              Realizar pago
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Has completado todos los pasos previos. ¡Ahora puedes realizar el pago!
            </Typography>
            
            <Alert severity="success" sx={{ mt: 2, mb: 3 }}>
              Tu wallet está conectado, la red seleccionada es compatible y has aprobado el uso de tokens.
            </Alert>
            
            <Paper variant="outlined" sx={{ p: 3, mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Resumen de la transacción
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Wallet:
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {walletName} ({truncateAddress(address)})
                  </Typography>
                </Grid>
                
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Red:
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {chainId === 1 ? 'Ethereum Mainnet' : 
                     chainId === 137 ? 'Polygon' : 
                     chainId === 11155111 ? 'Sepolia (Testnet)' : 
                     chainId?.toString() || 'Desconocida'}
                  </Typography>
                </Grid>
                
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Token:
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {selectedToken}
                  </Typography>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  size="large"
                  fullWidth
                >
                  Confirmar Pago
                </Button>
              </Box>
            </Paper>
          </Box>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Demostración de Integración EVM Wallet
        </Typography>
        <Typography variant="body1" paragraph>
          Esta demostración muestra cómo conectar wallets EVM, seleccionar redes y gestionar tokens para pagos.
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Error: {error.message}
          </Alert>
        )}
        
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <Divider sx={{ mb: 3 }} />
        
        {renderStepContent()}
      </Paper>
      
      {isConnected && (
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Estado del Wallet
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Typography variant="body2" color="text.secondary">
                Conectado:
              </Typography>
            </Grid>
            <Grid item xs={9}>
              <Typography variant="body2">
                {isConnected ? 'Sí' : 'No'}
              </Typography>
            </Grid>
            
            <Grid item xs={3}>
              <Typography variant="body2" color="text.secondary">
                Wallet:
              </Typography>
            </Grid>
            <Grid item xs={9}>
              <Typography variant="body2">
                {walletName || 'No conectado'}
              </Typography>
            </Grid>
            
            <Grid item xs={3}>
              <Typography variant="body2" color="text.secondary">
                Dirección:
              </Typography>
            </Grid>
            <Grid item xs={9}>
              <Typography variant="body2">
                {address || 'No disponible'}
              </Typography>
            </Grid>
            
            <Grid item xs={3}>
              <Typography variant="body2" color="text.secondary">
                Red:
              </Typography>
            </Grid>
            <Grid item xs={9}>
              <Typography variant="body2">
                {chainId === 1 ? 'Ethereum Mainnet' : 
                 chainId === 137 ? 'Polygon' : 
                 chainId === 11155111 ? 'Sepolia (Testnet)' : 
                 chainId?.toString() || 'No conectado'}
              </Typography>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={() => setActiveStep(0)}>
              Reiniciar Demostración
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default WalletIntegrationDemo; 