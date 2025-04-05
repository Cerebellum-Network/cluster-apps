import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useNetwork, useSwitchNetwork } from 'wagmi';
import { WalletType } from '../components/WalletConnector';
import { chains } from '../config/walletConfig';

export type WalletConnectionResult = {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  error: Error | null;
  walletType: WalletType | null;
  chainId: number | undefined;
  connectWallet: (connector: any) => Promise<void>;
  disconnectWallet: () => void;
  supportedChains: typeof chains;
  switchNetwork: ((chainId_?: number | undefined) => void) | undefined;
  isSwitchingNetwork: boolean;
  switchNetworkError: Error | null;
};

export const useWalletConnection = (): WalletConnectionResult => {
  // Hooks de wagmi para gestionar la conexión
  const { address, isConnected, isConnecting, isDisconnected } = useAccount();
  const { connect, error: connectError, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { chain } = useNetwork();
  const { switchNetwork, error: switchNetworkError, isLoading: isSwitchingNetwork } = useSwitchNetwork();
  
  // Estado para el tipo de wallet conectada
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  
  // Función para conectar con un wallet específico
  const connectWallet = async (connectorId: string) => {
    try {
      // Buscar el conector correspondiente
      const connector = connectors.find(c => c.id.toLowerCase().includes(connectorId.toLowerCase()));
      
      if (!connector) {
        throw new Error(`Conector no disponible: ${connectorId}`);
      }
      
      // Guardar el tipo de wallet
      let type: WalletType = 'metamask';
      if (connectorId.toLowerCase().includes('metamask')) {
        type = 'metamask';
      } else if (connectorId.toLowerCase().includes('walletconnect')) {
        type = 'walletconnect';
      } else if (connectorId.toLowerCase().includes('coinbase')) {
        type = 'coinbase';
      } else if (connectorId.toLowerCase().includes('cere')) {
        type = 'cere';
      }
      
      setWalletType(type);
      
      // Conectar con el wallet
      connect({ connector });
    } catch (error) {
      console.error('Error al conectar wallet:', error);
      throw error;
    }
  };
  
  // Función para desconectar
  const disconnectWallet = () => {
    disconnect();
    setWalletType(null);
  };
  
  // Efecto para restaurar el tipo de wallet al reconectar
  useEffect(() => {
    if (!isConnected) {
      setWalletType(null);
    }
  }, [isConnected]);
  
  return {
    address,
    isConnected,
    isConnecting,
    isDisconnected,
    error: connectError,
    walletType,
    chainId: chain?.id,
    connectWallet,
    disconnectWallet,
    supportedChains: chains,
    switchNetwork,
    isSwitchingNetwork,
    switchNetworkError,
  };
}; 