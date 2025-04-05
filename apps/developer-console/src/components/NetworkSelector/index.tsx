import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Menu,
  MenuItem,
  CircularProgress,
  Chip,
  Tooltip,
  Alert
} from '@mui/material';
import { SwapHoriz, CheckCircle, Info } from '@mui/icons-material';
import { chains } from '../../config/walletConfig';
import { useWallet } from '../../providers/WalletProvider';
import { Chain } from 'wagmi';

interface NetworkSelectorProps {
  variant?: 'button' | 'chip';
  size?: 'small' | 'medium';
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  variant = 'button',
  size = 'medium'
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  
  // Usar el hook de wallet que expone la funcionalidad de cambio de red
  const { chainId, switchNetwork, isSwitchingNetwork, switchNetworkError } = useWallet();
  
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleNetworkSwitch = (networkId: number) => {
    if (switchNetwork) {
      switchNetwork(networkId);
      handleClose();
    }
  };
  
  const getNetworkName = (id: number): string => {
    const network = chains.find((chain: Chain) => chain.id === id);
    return network?.name || `Red desconocida (${id})`;
  };
  
  const getNetworkColor = (id: number): string => {
    switch (id) {
      case 1:
        return '#627EEA'; // Ethereum color
      case 137:
        return '#8247E5'; // Polygon color
      case 42161:
        return '#28A0F0'; // Arbitrum color
      case 10:
        return '#FF0420'; // Optimism color
      case 11155111:
        return '#F6C343'; // Sepolia testnet color
      default:
        return '#888888';
    }
  };
  
  // Renderizar el componente según la variante seleccionada
  if (variant === 'chip') {
    return (
      <Box>
        <Tooltip title="Cambiar red">
          <Chip
            icon={<SwapHoriz />}
            label={chainId ? getNetworkName(chainId) : 'Seleccionar red'}
            color="secondary"
            variant="outlined"
            onClick={handleClick}
            size={size}
            sx={{
              borderColor: chainId ? getNetworkColor(chainId) : undefined,
              '& .MuiChip-label': {
                color: chainId ? getNetworkColor(chainId) : undefined,
              }
            }}
          />
        </Tooltip>
        
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          MenuListProps={{
            'aria-labelledby': 'network-selector',
          }}
        >
          {switchNetworkError && (
            <MenuItem sx={{ display: 'block', p: 1 }}>
              <Alert severity="error" sx={{ mb: 1 }}>
                Error: {switchNetworkError.message}
              </Alert>
            </MenuItem>
          )}
          
          {chains.map((chain: Chain) => (
            <MenuItem
              key={chain.id}
              onClick={() => handleNetworkSwitch(chain.id)}
              selected={chainId === chain.id}
              disabled={isSwitchingNetwork || chainId === chain.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: getNetworkColor(chain.id)
                  }}
                />
                <Typography variant="body1">
                  {chain.name}
                </Typography>
              </Box>
              
              {chainId === chain.id && (
                <CheckCircle color="success" fontSize="small" />
              )}
              
              {isSwitchingNetwork && chainId !== chain.id && (
                <CircularProgress size={16} />
              )}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    );
  }
  
  // Variante por defecto: botón
  return (
    <Box>
      <Button
        variant="outlined"
        color="secondary"
        onClick={handleClick}
        startIcon={<SwapHoriz />}
        endIcon={isSwitchingNetwork ? <CircularProgress size={16} /> : null}
        size={size}
        sx={{
          borderColor: chainId ? getNetworkColor(chainId) : undefined,
          color: chainId ? getNetworkColor(chainId) : undefined
        }}
      >
        {chainId ? getNetworkName(chainId) : 'Seleccionar red'}
      </Button>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'network-selector',
        }}
      >
        {switchNetworkError && (
          <MenuItem sx={{ display: 'block', p: 1 }}>
            <Alert severity="error" sx={{ mb: 1 }}>
              Error: {switchNetworkError.message}
            </Alert>
          </MenuItem>
        )}
        
        {chains.map((chain: Chain) => (
          <MenuItem
            key={chain.id}
            onClick={() => handleNetworkSwitch(chain.id)}
            selected={chainId === chain.id}
            disabled={isSwitchingNetwork || chainId === chain.id}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: getNetworkColor(chain.id)
                }}
              />
              <Typography variant="body1">
                {chain.name}
              </Typography>
              
              {chain.testnet && (
                <Tooltip title="Red de prueba">
                  <Info fontSize="small" color="warning" />
                </Tooltip>
              )}
            </Box>
            
            {chainId === chain.id && (
              <CheckCircle color="success" fontSize="small" />
            )}
            
            {isSwitchingNetwork && chainId !== chain.id && (
              <CircularProgress size={16} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}; 