import { useState, useEffect, useCallback } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface DeviceDetection {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isMobileWallet: boolean;
  triggerDeepLink: (url: string) => void;
}

export function useDeviceDetection(): DeviceDetection {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isMobileWallet, setIsMobileWallet] = useState(false);
  
  // Función para determinar el tipo de dispositivo
  const detectDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Detectar navegador
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    
    // Detectar si estamos dentro de un wallet móvil
    const isTrustWallet = userAgent.includes('trust');
    const isMetaMaskMobile = userAgent.includes('metamask');
    const isCoinbaseMobile = userAgent.includes('coinbase');
    const isWalletConnect = window.location.href.includes('wc?uri=');
    const isMobileWallet = isTrustWallet || isMetaMaskMobile || isCoinbaseMobile || isWalletConnect;
    
    // Actualizar estados
    setIsIOS(isIOS);
    setIsAndroid(isAndroid);
    setIsSafari(isSafari);
    setIsMobileWallet(isMobileWallet);
    
    // Detectar tamaño de pantalla
    const width = window.innerWidth;
    
    // Definir puntos de quiebre
    const mobileBreakpoint = 480;
    const tabletBreakpoint = 768;
    
    if (width <= mobileBreakpoint) {
      setDeviceType('mobile');
      setIsMobile(true);
      setIsTablet(false);
      setIsDesktop(false);
    } else if (width <= tabletBreakpoint) {
      setDeviceType('tablet');
      setIsMobile(false);
      setIsTablet(true);
      setIsDesktop(false);
    } else {
      setDeviceType('desktop');
      setIsMobile(false);
      setIsTablet(false);
      setIsDesktop(true);
    }
  }, []);
  
  // Ejecutar la detección al montar el componente y cuando cambia el tamaño de la ventana
  useEffect(() => {
    detectDevice();
    
    const handleResize = () => {
      detectDevice();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [detectDevice]);
  
  // Función para generar y abrir deep links para wallets móviles
  const triggerDeepLink = useCallback((url: string) => {
    if (isIOS || isAndroid) {
      // Intentar abrir el deep link
      window.location.href = url;
      
      // Establecer un timeout para redirigir a la tienda de apps si el deep link no funciona
      const timeout = setTimeout(() => {
        if (isIOS) {
          window.location.href = 'https://apps.apple.com/app/metamask/id1438144202';
        } else if (isAndroid) {
          window.location.href = 'https://play.google.com/store/apps/details?id=io.metamask';
        }
      }, 3000);
      
      // Limpiar el timeout si el usuario cambia de página
      window.addEventListener('blur', () => {
        clearTimeout(timeout);
      }, { once: true });
    }
  }, [isIOS, isAndroid]);
  
  return {
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    isIOS,
    isAndroid,
    isSafari,
    isMobileWallet,
    triggerDeepLink
  };
} 