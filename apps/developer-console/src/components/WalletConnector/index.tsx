import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { AccountBalanceWallet, Check, SwapHoriz } from '@mui/icons-material';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { walletIcons } from '../../config/walletConfig';
import { MobileWalletConnect } from '../MobileWalletConnect';
import { truncateAddress } from '../../utils/stringUtils';
import { WagmiConfig } from 'wagmi';
import { wagmiConfig } from '../../config/walletConfig';

// Tipos de wallets soportadas
export type WalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'cere';

interface WalletOption {
  id: WalletType;
  name: string;
  icon: string;
  description: string;
  connectorId: string;
}

interface WalletConnectorProps {
  onWalletConnect: (wallet: WalletType, address: string) => void;
  supportedWallets?: WalletType[];
  isLoading?: boolean;
  containerStyle?: React.CSSProperties;
}

// Información de los wallets soportados
const walletOptions: Record<WalletType, WalletOption> = {
  metamask: {
    id: 'metamask',
    name: 'MetaMask',
    icon: walletIcons.metamask,
    description: 'Conectar con tu wallet MetaMask',
    connectorId: 'injected'
  },
  walletconnect: {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: walletIcons.walletconnect,
    description: 'Escanea con WalletConnect para conectar',
    connectorId: 'walletConnect'
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: walletIcons.coinbase,
    description: 'Conectar con tu Coinbase Wallet',
    connectorId: 'coinbaseWallet'
  },
  cere: {
    id: 'cere',
    name: 'Cere Wallet',
    icon: walletIcons.cere,
    description: 'Conectar con tu Cere Wallet',
    connectorId: 'cere'
  }
};

export const WalletConnector: React.FC<WalletConnectorProps> = ({
  onWalletConnect,
  supportedWallets = ['metamask', 'walletconnect', 'coinbase', 'cere'],
  isLoading = false,
  containerStyle
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isMobile } = useDeviceDetection();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  const handleOpenDialog = () => {
    setIsDialogOpen(true);
    setError(null);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setError(null);
  };

  return (
    <WagmiConfig config={wagmiConfig}>
      <WalletConnectorInner 
        onWalletConnect={onWalletConnect}
        supportedWallets={supportedWallets}
        isLoading={isLoading}
        isDialogOpen={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
        error={error}
        setError={setError}
        handleOpenDialog={handleOpenDialog}
        handleCloseDialog={handleCloseDialog}
        containerStyle={containerStyle}
        isMobile={isMobile}
        isSmallScreen={isSmallScreen}
      />
    </WagmiConfig>
  );
};

// Componente interno que usa los hooks de wagmi
const WalletConnectorInner: React.FC<WalletConnectorProps & {
  isDialogOpen: boolean;
  setIsDialogOpen: (isOpen: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  handleOpenDialog: () => void;
  handleCloseDialog: () => void;
  isMobile: boolean;
  isSmallScreen: boolean;
}> = ({
  onWalletConnect,
  supportedWallets,
  isLoading,
  isDialogOpen,
  setIsDialogOpen,
  error,
  setError,
  handleOpenDialog,
  handleCloseDialog,
  containerStyle,
  isMobile,
  isSmallScreen
}) => {
  // Usar el hook personalizado para la conexión del wallet
  const {
    address,
    isConnected,
    isConnecting,
    chainId,
    error: connectionError,
    walletType,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    isSwitchingNetwork
  } = useWalletConnection();

  // Efecto para notificar la conexión exitosa
  useEffect(() => {
    if (isConnected && address && walletType) {
      onWalletConnect(walletType, address);
      handleCloseDialog();
    }
  }, [isConnected, address, walletType, onWalletConnect]);

  // Efecto para manejar errores de conexión
  useEffect(() => {
    if (connectionError) {
      setError(connectionError.message);
    }
  }, [connectionError, setError]);

  const handleWalletSelect = async (wallet: WalletType) => {
    setError(null);
    
    try {
      const option = walletOptions[wallet];
      await connectWallet(option.connectorId);
    } catch (err: any) {
      setError(err.message || 'Error al conectar wallet');
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  // Renderizar el botón adaptado a la conexión actual
  const renderConnectButton = () => {
    if (isConnected && address) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...containerStyle }}>
          <Chip 
            icon={<AccountBalanceWallet />}
            label={truncateAddress(address, isSmallScreen ? 4 : 6, isSmallScreen ? 4 : 4)}
            color="primary"
            variant="outlined"
            onClick={handleOpenDialog}
            sx={{ 
              maxWidth: isSmallScreen ? 140 : 'none',
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }
            }}
          />
          {!isSmallScreen && (
            <Button 
              size="small" 
              variant="outlined" 
              color="error" 
              onClick={handleDisconnect}
            >
              Desconectar
            </Button>
          )}
          {chainId && !isSmallScreen && (
            <Chip
              icon={<SwapHoriz />}
              label={`Red: ${getNetworkName(chainId)}`}
              color="secondary"
              variant="outlined"
              onClick={() => setIsDialogOpen(true)}
              sx={{ 
                maxWidth: isSmallScreen ? 120 : 'none',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }
              }}
            />
          )}
        </Box>
      );
    } else {
      return (
        <Button
          variant="contained"
          color="primary"
          startIcon={<AccountBalanceWallet />}
          onClick={handleOpenDialog}
          disabled={isLoading}
          fullWidth={isSmallScreen}
          size={isSmallScreen ? 'small' : 'medium'}
          sx={containerStyle}
        >
          {isLoading ? 
            <CircularProgress size={24} /> : 
            isSmallScreen ? 'Conectar' : 'Conectar Wallet'
          }
        </Button>
      );
    }
  };

  return (
    <>
      {renderConnectButton()}

      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        aria-labelledby="wallet-dialog-title"
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle id="wallet-dialog-title">
          {isConnected ? 'Administrar conexión' : 'Conectar tu wallet'}
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {!isConnected ? (
            isMobile ? (
              <MobileWalletConnect 
                onWalletConnect={onWalletConnect}
                supportedWallets={supportedWallets}
                isLoading={isConnecting}
                walletConnectUri="wc:a7420069-d23b-487e-84ba-ea7dc3c7ece3@1?bridge=https%3A%2F%2Fbridge.walletconnect.org"
              />
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Conecta tu wallet preferida para continuar con el proceso de pago.
                </Typography>
                
                <List>
                  {supportedWallets.map((walletType) => {
                    const wallet = walletOptions[walletType];
                    const isSelected = isConnecting && walletType === walletType;
                    
                    return (
                      <React.Fragment key={wallet.id}>
                        <ListItem disablePadding>
                          <ListItemButton 
                            onClick={() => handleWalletSelect(wallet.id)}
                            disabled={isConnecting}
                            selected={isSelected}
                          >
                            <ListItemIcon>
                              {wallet.icon ? (
                                <img 
                                  src={wallet.icon} 
                                  alt={wallet.name} 
                                  width={24} 
                                  height={24} 
                                />
                              ) : (
                                <AccountBalanceWallet />
                              )}
                            </ListItemIcon>
                            <ListItemText 
                              primary={wallet.name} 
                              secondary={wallet.description}
                            />
                            {isConnecting && isSelected && <CircularProgress size={24} />}
                            {isConnected && walletType === wallet.id && <Check color="success" />}
                          </ListItemButton>
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    );
                  })}
                </List>
              </>
            )
          ) : (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Wallet conectada
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalanceWallet sx={{ mr: 1 }} />
                <Typography variant="body1">{address}</Typography>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>
                Red actual
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1">{getNetworkName(chainId || 0)}</Typography>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>
                Cambiar red
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {switchNetwork && (
                  ['1', '137', '42161', '10', '11155111'].map(id => {
                    const networkId = parseInt(id);
                    return (
                      <Button 
                        key={id}
                        variant={chainId === networkId ? "contained" : "outlined"}
                        size="small"
                        onClick={() => switchNetwork(networkId)}
                        disabled={isSwitchingNetwork || chainId === networkId}
                      >
                        {getNetworkName(networkId)}
                        {isSwitchingNetwork && chainId !== networkId && <CircularProgress size={16} sx={{ ml: 1 }} />}
                      </Button>
                    );
                  })
                )}
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Para interactuar con diferentes redes, debes cambiar a la red correspondiente.
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cerrar</Button>
          {isConnected && (
            <Button 
              onClick={handleDisconnect} 
              color="error"
            >
              Desconectar Wallet
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

// Función para obtener el nombre de la red a partir del ID de cadena
function getNetworkName(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'Ethereum';
    case 137:
      return 'Polygon';
    case 42161:
      return 'Arbitrum';
    case 10:
      return 'Optimism';
    case 11155111:
      return 'Sepolia';
    default:
      return `Red desconocida (${chainId})`;
  }
} 