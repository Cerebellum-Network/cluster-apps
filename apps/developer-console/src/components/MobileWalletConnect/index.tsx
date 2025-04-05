import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import { WalletType } from '../WalletConnector';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { walletIcons } from '../../config/walletConfig';

// URLs de deep link para cada wallet en dispositivos móviles
const DEEP_LINKS = {
  metamask: {
    android: 'metamask://wc?uri=',
    ios: 'metamask://wc?uri='
  },
  walletconnect: {
    android: 'https://walletconnect.org/wc?uri=',
    ios: 'https://walletconnect.org/wc?uri='
  },
  coinbase: {
    android: 'https://go.cb-w.com/wc?uri=',
    ios: 'https://go.cb-w.com/wc?uri='
  },
  trust: {
    android: 'trust://wc?uri=',
    ios: 'trust://wc?uri='
  }
};

interface MobileWalletConnectProps {
  onWalletConnect: (wallet: WalletType, address: string) => void;
  supportedWallets?: WalletType[];
  isLoading?: boolean;
  walletConnectUri?: string;
}

export const MobileWalletConnect: React.FC<MobileWalletConnectProps> = ({
  onWalletConnect,
  supportedWallets = ['metamask', 'walletconnect', 'coinbase'],
  isLoading = false,
  walletConnectUri
}) => {
  const { isMobile, isAndroid, isIOS, triggerDeepLink } = useDeviceDetection();
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Obtener las wallets adecuadas para el dispositivo actual
  const getRelevantWallets = () => {
    // Para dispositivos móviles, mostrar solo las wallets compatibles
    if (isMobile) {
      return supportedWallets.filter(wallet => 
        wallet === 'metamask' || 
        wallet === 'walletconnect' || 
        wallet === 'coinbase'
      );
    }
    
    // Para escritorio, mostrar todas
    return supportedWallets;
  };
  
  // Generar URL de deep link para la wallet seleccionada
  const generateDeepLink = (walletType: WalletType): string | null => {
    if (!walletConnectUri) return null;
    
    const platform = isAndroid ? 'android' : isIOS ? 'ios' : null;
    if (!platform) return null;
    
    // @ts-ignore - TypeScript no puede verificar que walletType exista en DEEP_LINKS
    const baseUrl = DEEP_LINKS[walletType]?.[platform];
    if (!baseUrl) return null;
    
    return `${baseUrl}${encodeURIComponent(walletConnectUri)}`;
  };
  
  // Manejar la conexión de la wallet
  const handleWalletSelect = async (wallet: WalletType) => {
    setSelectedWallet(wallet);
    setError(null);
    
    if (isMobile) {
      // En móvil, abrir el deep link
      const deepLink = generateDeepLink(wallet);
      if (deepLink) {
        triggerDeepLink(deepLink);
      } else {
        setError('No se pudo generar el enlace para la wallet seleccionada.');
      }
    } else {
      // Para escritorio, utilizar el flujo normal (simulado para este componente)
      try {
        // Simulando una conexión exitosa
        setTimeout(() => {
          const mockAddress = '0x1234...5678';
          onWalletConnect(wallet, mockAddress);
        }, 1500);
      } catch (err: any) {
        setError(err.message || 'Error al conectar wallet');
      }
    }
  };
  
  const renderWalletOption = (wallet: WalletType) => {
    const isSelected = selectedWallet === wallet;
    
    return (
      <Card 
        key={wallet}
        variant="outlined"
        sx={{
          mb: 2,
          borderColor: isSelected ? 'primary.main' : 'divider',
          backgroundColor: isSelected ? 'action.selected' : 'background.paper',
          transition: 'all 0.2s',
          cursor: 'pointer',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'action.hover'
          }
        }}
        onClick={() => handleWalletSelect(wallet)}
      >
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={3} sx={{ textAlign: 'center' }}>
              <Box 
                component="img" 
                src={walletIcons[wallet]} 
                alt={wallet} 
                sx={{ 
                  width: 40, 
                  height: 40, 
                  objectFit: 'contain',
                  filter: isSelected ? 'none' : 'grayscale(40%)'
                }} 
              />
            </Grid>
            <Grid item xs={9}>
              <Typography variant="subtitle1" sx={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
                {getWalletName(wallet)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getWalletDescription(wallet, isAndroid, isIOS)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  // Función para obtener el nombre formateado de la wallet
  const getWalletName = (wallet: WalletType): string => {
    switch (wallet) {
      case 'metamask':
        return 'MetaMask';
      case 'walletconnect':
        return 'WalletConnect';
      case 'coinbase':
        return 'Coinbase Wallet';
      case 'cere':
        return 'Cere Wallet';
      default:
        return wallet;
    }
  };
  
  // Función para obtener la descripción adecuada según el dispositivo
  const getWalletDescription = (wallet: WalletType, isAndroid: boolean, isIOS: boolean): string => {
    if (isMobile) {
      if (wallet === 'metamask') {
        return isAndroid 
          ? 'Abre la app MetaMask para conectar'
          : 'Abre MetaMask en tu iPhone para conectar';
      } else if (wallet === 'coinbase') {
        return 'Escanea con Coinbase Wallet para conectar';
      } else if (wallet === 'walletconnect') {
        return 'Conéctate con cualquier wallet compatible';
      }
    }
    
    // Descripción predeterminada para escritorio
    return 'Haz clic para conectar';
  };
  
  return (
    <Box sx={{ mt: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="subtitle1" gutterBottom>
            {isMobile 
              ? 'Selecciona una wallet en tu dispositivo móvil' 
              : 'Selecciona una wallet para conectar'}
          </Typography>
          
          <Divider sx={{ mb: 2 }} />
          
          {getRelevantWallets().map(wallet => renderWalletOption(wallet))}
          
          {isMobile && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Si no tienes una wallet instalada, puedes descargarla desde la tienda de aplicaciones.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}; 