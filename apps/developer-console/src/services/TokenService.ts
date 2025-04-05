import { getAccount, getPublicClient, getWalletClient, getContract } from '@wagmi/core';
import { formatUnits, parseUnits } from 'viem';
import { erc20ABI } from 'wagmi';
import { SUPPORTED_STABLECOINS, PAYMENT_CONTRACT_ADDRESS } from '../config/walletConfig';

// Interfaz para la información de tokens
export interface TokenInfo {
  balance: string;
  balanceFormatted: string;
  allowance: string;
  allowanceFormatted: string;
  decimals: number;
  symbol: string;
}

/**
 * Servicio para interactuar con tokens ERC20 (stablecoins)
 */
export class TokenService {
  
  /**
   * Obtiene el balance de un token para una dirección
   * @param tokenAddress Dirección del contrato del token
   * @param address Dirección del wallet
   * @param chainId ID de la cadena
   * @returns Balance del token en formato bruto y formateado
   */
  public async getTokenBalance(
    tokenAddress: string,
    address: string,
    chainId: number
  ): Promise<{ raw: bigint; formatted: string }> {
    try {
      // Obtener el cliente público para la cadena especificada
      const publicClient = getPublicClient({ chainId });
      if (!publicClient) {
        throw new Error(`No hay cliente disponible para la cadena ${chainId}`);
      }
      
      // Obtener el contrato del token
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20ABI,
        publicClient
      });
      
      // Obtener el balance y los decimales del token
      const balance = await tokenContract.read.balanceOf([address as `0x${string}`]);
      const decimals = await tokenContract.read.decimals();
      
      // Formatear el balance
      const formatted = formatUnits(balance, decimals);
      
      return {
        raw: balance,
        formatted
      };
    } catch (error) {
      console.error('Error al obtener el balance del token:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene el allowance de un token para una dirección y un contrato de gasto
   * @param tokenAddress Dirección del contrato del token
   * @param ownerAddress Dirección del propietario de los tokens
   * @param spenderAddress Dirección del contrato que puede gastar los tokens
   * @param chainId ID de la cadena
   * @returns Allowance del token en formato bruto y formateado
   */
  public async getTokenAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    chainId: number
  ): Promise<{ raw: bigint; formatted: string }> {
    try {
      // Obtener el cliente público para la cadena especificada
      const publicClient = getPublicClient({ chainId });
      if (!publicClient) {
        throw new Error(`No hay cliente disponible para la cadena ${chainId}`);
      }
      
      // Obtener el contrato del token
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20ABI,
        publicClient
      });
      
      // Obtener el allowance y los decimales del token
      const allowance = await tokenContract.read.allowance([
        ownerAddress as `0x${string}`, 
        spenderAddress as `0x${string}`
      ]);
      const decimals = await tokenContract.read.decimals();
      
      // Formatear el allowance
      const formatted = formatUnits(allowance, decimals);
      
      return {
        raw: allowance,
        formatted
      };
    } catch (error) {
      console.error('Error al obtener el allowance del token:', error);
      throw error;
    }
  }
  
  /**
   * Aprueba un gasto de tokens para un contrato
   * @param tokenAddress Dirección del contrato del token
   * @param spenderAddress Dirección del contrato que puede gastar los tokens
   * @param amount Cantidad a aprobar
   * @param chainId ID de la cadena
   * @returns Hash de la transacción
   */
  public async approveTokenSpending(
    tokenAddress: string,
    spenderAddress: string,
    amount: string, // En unidades (ej: "100.5")
    chainId: number
  ): Promise<string> {
    try {
      // Obtener el cliente de wallet
      const walletClient = await getWalletClient({ chainId });
      if (!walletClient) {
        throw new Error('Wallet no conectado');
      }
      
      // Obtener el cliente público para la cadena especificada
      const publicClient = getPublicClient({ chainId });
      if (!publicClient) {
        throw new Error(`No hay cliente disponible para la cadena ${chainId}`);
      }
      
      // Obtener el contrato del token
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20ABI,
        publicClient,
        walletClient
      });
      
      // Obtener los decimales del token
      const decimals = await tokenContract.read.decimals();
      
      // Convertir la cantidad a unidades del token
      const amountInWei = parseUnits(amount, decimals);
      
      // Aprobar el gasto
      const hash = await tokenContract.write.approve([
        spenderAddress as `0x${string}`, 
        amountInWei
      ]);
      
      return hash;
    } catch (error) {
      console.error('Error al aprobar el gasto de tokens:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene información completa de un token (balance, allowance, etc.)
   * @param tokenSymbol Símbolo del token (ej: "USDC")
   * @param chainId ID de la cadena
   * @returns Información del token
   */
  public async getTokenInfo(tokenSymbol: string, chainId: number): Promise<TokenInfo | null> {
    try {
      // Verificar que el token esté soportado en la cadena
      const tokenAddresses = SUPPORTED_STABLECOINS[tokenSymbol];
      if (!tokenAddresses || !tokenAddresses[chainId]) {
        console.warn(`Token ${tokenSymbol} no soportado en la cadena ${chainId}`);
        return null;
      }
      
      const tokenAddress = tokenAddresses[chainId];
      const spenderAddress = PAYMENT_CONTRACT_ADDRESS[chainId];
      
      if (!spenderAddress) {
        console.warn(`Contrato de pago no disponible en la cadena ${chainId}`);
        return null;
      }
      
      // Obtener la dirección del usuario
      const account = getAccount();
      if (!account || !account.address) {
        throw new Error('Wallet no conectado');
      }
      
      // Obtener el cliente público para la cadena especificada
      const publicClient = getPublicClient({ chainId });
      if (!publicClient) {
        throw new Error(`No hay cliente disponible para la cadena ${chainId}`);
      }
      
      // Obtener el contrato del token
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20ABI,
        publicClient
      });
      
      // Obtener el balance, allowance y decimales del token en paralelo
      const [balance, allowance, decimals] = await Promise.all([
        tokenContract.read.balanceOf([account.address]),
        tokenContract.read.allowance([account.address, spenderAddress as `0x${string}`]),
        tokenContract.read.decimals()
      ]);
      
      // Formatear los valores
      const balanceFormatted = formatUnits(balance, decimals);
      const allowanceFormatted = formatUnits(allowance, decimals);
      
      return {
        balance: balance.toString(),
        balanceFormatted,
        allowance: allowance.toString(),
        allowanceFormatted,
        decimals,
        symbol: tokenSymbol
      };
    } catch (error) {
      console.error(`Error al obtener información del token ${tokenSymbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Verifica si un token está disponible en una cadena específica
   * @param tokenSymbol Símbolo del token (ej: "USDC")
   * @param chainId ID de la cadena
   * @returns Dirección del token si está disponible, null en caso contrario
   */
  public isTokenAvailableOnChain(tokenSymbol: string, chainId: number): string | null {
    const tokenAddresses = SUPPORTED_STABLECOINS[tokenSymbol];
    if (!tokenAddresses || !tokenAddresses[chainId]) {
      return null;
    }
    
    return tokenAddresses[chainId];
  }
  
  /**
   * Obtiene el contrato de spender para una cadena específica
   * @param chainId ID de la cadena
   * @returns Dirección del contrato de spender
   */
  public getSpenderContract(chainId: number): string | null {
    return PAYMENT_CONTRACT_ADDRESS[chainId] || null;
  }
}

// Exportar una instancia por defecto del servicio
export const tokenService = new TokenService(); 