import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  Divider,
  Button,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material';
import { AccountBalanceWallet, SwapHoriz } from '@mui/icons-material';
import { formatCurrency } from '../../utils/stringUtils';
import { NetworkSelector } from '../NetworkSelector';
import { useWallet } from '../../providers/WalletProvider';
import { SUPPORTED_STABLECOINS, PAYMENT_CONTRACT_ADDRESS } from '../../config/walletConfig';
import { tokenService, TokenInfo } from '../../services/TokenService';

interface TokenInfoCardProps {
  tokenSymbol: string;
  onSelectNetwork?: () => void;
  onUpdateAllowance?: (amount: string) => void;
}

export const TokenInfoCard: React.FC<TokenInfoCardProps> = ({
  tokenSymbol,
  onSelectNetwork,
  onUpdateAllowance
}) => {
  const { address, isConnected, chainId } = useWallet();
  
  // Estados para la información del token
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isUpdatingAllowance, setIsUpdatingAllowance] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState('1000');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Efecto para cargar la información del token cuando cambia la dirección o la red
  useEffect(() => {
    const loadTokenInfo = async () => {
      if (isConnected && address && chainId) {
        try {
          setIsLoadingInfo(true);
          setErrorMessage(null);
          
          // Verificar si el token está disponible en la cadena
          const tokenAddress = tokenService.isTokenAvailableOnChain(tokenSymbol, chainId);
          if (!tokenAddress) {
            setErrorMessage(`${tokenSymbol} no está disponible en la red actual.`);
            setTokenInfo(null);
            return;
          }
          
          // Obtener la información del token
          const info = await tokenService.getTokenInfo(tokenSymbol, chainId);
          setTokenInfo(info);
        } catch (error: any) {
          console.error('Error al cargar información del token:', error);
          setErrorMessage(error.message || 'Error al cargar información del token');
          setTokenInfo(null);
        } finally {
          setIsLoadingInfo(false);
        }
      } else {
        setTokenInfo(null);
        setErrorMessage(null);
      }
    };
    
    loadTokenInfo();
  }, [isConnected, address, chainId, tokenSymbol]);
  
  const handleApproveAllowance = async () => {
    if (!isConnected || !address || !chainId) return;
    
    try {
      setIsUpdatingAllowance(true);
      setErrorMessage(null);
      
      // Verificar si el token está disponible en la cadena
      const tokenAddress = tokenService.isTokenAvailableOnChain(tokenSymbol, chainId);
      if (!tokenAddress) {
        throw new Error(`${tokenSymbol} no está disponible en la red actual.`);
      }
      
      // Verificar si hay contrato de pago disponible
      const spenderAddress = tokenService.getSpenderContract(chainId);
      if (!spenderAddress) {
        throw new Error('Contrato de pago no disponible en la red actual.');
      }
      
      // Aprobar el gasto
      await tokenService.approveTokenSpending(
        tokenAddress,
        spenderAddress,
        approvalAmount,
        chainId
      );
      
      // Recargar la información del token
      const updatedInfo = await tokenService.getTokenInfo(tokenSymbol, chainId);
      setTokenInfo(updatedInfo);
      
      // Notificar al componente padre
      if (onUpdateAllowance && updatedInfo) {
        onUpdateAllowance(updatedInfo.allowanceFormatted);
      }
    } catch (error: any) {
      console.error('Error al aprobar allowance:', error);
      setErrorMessage(error.message || 'Error al aprobar el uso de tokens');
    } finally {
      setIsUpdatingAllowance(false);
    }
  };
  
  const getTokenAddress = (): string => {
    if (!chainId) return 'No conectado';
    
    const addresses = SUPPORTED_STABLECOINS[tokenSymbol];
    if (!addresses || !addresses[chainId]) {
      return 'No disponible en esta red';
    }
    
    return addresses[chainId];
  };
  
  // Verificar si la cantidad de allowance es suficiente
  const isAllowanceSufficient = (): boolean => {
    if (!tokenInfo) return false;
    
    const allowance = parseFloat(tokenInfo.allowanceFormatted);
    const minRequiredAllowance = 10; // Allowance mínimo requerido
    
    return allowance >= minRequiredAllowance;
  };
  
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" component="div">
            Información de {tokenSymbol}
          </Typography>
          
          <NetworkSelector variant="chip" size="small" />
        </Box>
        
        {errorMessage && (
          <Box sx={{ mb: 2 }}>
            <Typography color="error" variant="body2">
              {errorMessage}
            </Typography>
          </Box>
        )}
        
        {!isConnected ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Conecta tu wallet para ver la información del token
            </Typography>
          </Box>
        ) : !chainId ? (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Selecciona una red compatible
            </Typography>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<SwapHoriz />}
              onClick={onSelectNetwork}
              sx={{ mt: 1 }}
            >
              Cambiar red
            </Button>
          </Box>
        ) : (
          <>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Dirección del contrato:
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {getTokenAddress()}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Tu balance:
              </Typography>
              
              {isLoadingInfo ? (
                <Skeleton width={100} height={24} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccountBalanceWallet sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="body1">
                    {tokenInfo 
                      ? formatCurrency(parseFloat(tokenInfo.balanceFormatted), tokenSymbol) 
                      : '0 ' + tokenSymbol}
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Permiso de gasto (Allowance):
              </Typography>
              
              {isLoadingInfo ? (
                <Skeleton width={100} height={24} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ mr: 1 }}>
                    {tokenInfo 
                      ? formatCurrency(parseFloat(tokenInfo.allowanceFormatted), tokenSymbol) 
                      : '0 ' + tokenSymbol}
                  </Typography>
                  
                  <Chip 
                    label={isAllowanceSufficient() ? 'Aprobado' : 'No aprobado'} 
                    color={isAllowanceSufficient() ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              )}
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Cantidad a aprobar"
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
                type="number"
                size="small"
                fullWidth
                disabled={isUpdatingAllowance || isLoadingInfo}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{tokenSymbol}</InputAdornment>,
                }}
              />
            </Box>
            
            <Button
              variant="contained"
              color="primary"
              onClick={handleApproveAllowance}
              disabled={isUpdatingAllowance || isLoadingInfo || isAllowanceSufficient()}
              fullWidth
            >
              {isUpdatingAllowance ? (
                <CircularProgress size={24} color="inherit" />
              ) : isAllowanceSufficient() ? (
                'Permiso aprobado'
              ) : (
                'Aprobar uso de ' + tokenSymbol
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}; 