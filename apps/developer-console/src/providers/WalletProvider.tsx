import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { WagmiConfig } from 'wagmi';
import { wagmiConfig } from '../config/walletConfig';
import { useWalletConnection, WalletConnectionResult } from '../hooks/useWalletConnection';
import { WalletType } from '../components/WalletConnector';

// Interfaz del contexto
interface WalletContextType extends WalletConnectionResult {
  walletName: string | null;
}

// Crear el contexto
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Props del proveedor
interface WalletProviderProps {
  children: ReactNode;
}

// Componente proveedor de wallet
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  // Componente interno que usa los hooks de wagmi
  const InnerProvider: React.FC = () => {
    // Usar el hook de conexión de wallet
    const walletConnection = useWalletConnection();
    const { walletType } = walletConnection;
    
    // Estado para almacenar el nombre del wallet
    const [walletName, setWalletName] = useState<string | null>(null);
    
    // Efecto para actualizar el nombre del wallet cuando cambia el tipo
    useEffect(() => {
      if (walletType) {
        switch (walletType) {
          case 'metamask':
            setWalletName('MetaMask');
            break;
          case 'walletconnect':
            setWalletName('WalletConnect');
            break;
          case 'coinbase':
            setWalletName('Coinbase Wallet');
            break;
          case 'cere':
            setWalletName('Cere Wallet');
            break;
          default:
            setWalletName('Wallet');
        }
      } else {
        setWalletName(null);
      }
    }, [walletType]);
    
    // Valor del contexto
    const contextValue: WalletContextType = {
      ...walletConnection,
      walletName,
    };
    
    return (
      <WalletContext.Provider value={contextValue}>
        {children}
      </WalletContext.Provider>
    );
  };
  
  return (
    <WagmiConfig config={wagmiConfig}>
      <InnerProvider />
    </WagmiConfig>
  );
};

// Hook para usar el contexto de wallet
export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  
  if (context === undefined) {
    throw new Error('useWallet debe ser usado dentro de un WalletProvider');
  }
  
  return context;
}; 