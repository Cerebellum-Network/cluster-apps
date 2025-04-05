import { getAccount, getPublicClient, getWalletClient, getContract } from '@wagmi/core';
import { formatUnits, parseUnits } from 'viem';
import { TransactionReceipt } from 'viem';
import { PAYMENT_CONTRACT_ADDRESS } from '../config/walletConfig';
import { tokenService } from './TokenService';

// ABI del contrato de pago
const PAYMENT_ABI = [
  {
    inputs: [
      { name: 'stablecoin', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'cereNetworkAddress', type: 'string' },
      { name: 'minCereAmount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'processPayment',
    outputs: [{ name: 'paymentId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'paymentId', type: 'bytes32' }],
    name: 'getPaymentStatus',
    outputs: [{ name: 'status', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Estados de la transacción
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

// Información de la transacción
export interface TransactionInfo {
  hash: string;
  status: TransactionStatus;
  receipt?: TransactionReceipt;
  error?: Error;
}

/**
 * Servicio para manejar transacciones de pago
 */
export class PaymentService {
  
  // Mapa para almacenar las transacciones
  private transactions: Map<string, TransactionInfo> = new Map();
  
  /**
   * Procesa un pago con stablecoin
   * @param tokenSymbol Símbolo del token (ej: "USDC")
   * @param amount Cantidad a pagar en unidades del token (ej: "100.5")
   * @param cereNetworkAddress Dirección en la red Cere para recibir los tokens
   * @param chainId ID de la cadena donde se realizará el pago
   * @param minSlippagePercentage Porcentaje mínimo de slippage aceptable (por defecto 5%)
   * @returns Hash de la transacción
   */
  public async processStablecoinPayment(
    tokenSymbol: string,
    amount: string,
    cereNetworkAddress: string,
    chainId: number,
    minSlippagePercentage: number = 5
  ): Promise<string> {
    try {
      // Verificar que el token está disponible en la cadena
      const tokenAddress = tokenService.isTokenAvailableOnChain(tokenSymbol, chainId);
      if (!tokenAddress) {
        throw new Error(`${tokenSymbol} no está disponible en la red actual.`);
      }
      
      // Verificar si hay contrato de pago disponible
      const paymentContractAddress = PAYMENT_CONTRACT_ADDRESS[chainId];
      if (!paymentContractAddress) {
        throw new Error('Contrato de pago no disponible en la red actual.');
      }
      
      // Obtener la información del token
      const tokenInfo = await tokenService.getTokenInfo(tokenSymbol, chainId);
      if (!tokenInfo) {
        throw new Error(`No se pudo obtener información del token ${tokenSymbol}.`);
      }
      
      // Verificar si la allowance es suficiente
      const allowance = parseFloat(tokenInfo.allowanceFormatted);
      const amountValue = parseFloat(amount);
      if (allowance < amountValue) {
        throw new Error(`Allowance insuficiente. Apruebe el uso de al menos ${amount} ${tokenSymbol}.`);
      }
      
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
      
      // Obtener el contrato de pago
      const paymentContract = getContract({
        address: paymentContractAddress as `0x${string}`,
        abi: PAYMENT_ABI,
        publicClient,
        walletClient
      });
      
      // Convertir la cantidad a unidades del token
      const amountInWei = parseUnits(amount, tokenInfo.decimals);
      
      // Calcular slippage para minCereAmount (simulado)
      // En una implementación real, esto se obtendría consultando un precio estimado
      const estimatedCereAmount = BigInt(100 * 10**18); // 100 CERE en wei (simulado)
      const slippageFactor = 100 - minSlippagePercentage;
      const minCereAmount = (estimatedCereAmount * BigInt(slippageFactor)) / BigInt(100);
      
      // Deadline: 20 minutos en el futuro
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      // Enviar la transacción
      const hash = await paymentContract.write.processPayment([
        tokenAddress as `0x${string}`,
        amountInWei,
        cereNetworkAddress,
        minCereAmount,
        deadline
      ]);
      
      // Registrar la transacción
      this.transactions.set(hash, {
        hash,
        status: TransactionStatus.PENDING
      });
      
      // Monitorear la transacción
      this.monitorTransaction(hash, chainId);
      
      return hash;
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      throw error;
    }
  }
  
  /**
   * Monitorea el estado de una transacción
   * @param hash Hash de la transacción
   * @param chainId ID de la cadena
   */
  private async monitorTransaction(hash: string, chainId: number): Promise<void> {
    try {
      // Obtener el cliente público para la cadena especificada
      const publicClient = getPublicClient({ chainId });
      if (!publicClient) {
        this.updateTransactionStatus(hash, TransactionStatus.FAILED, undefined, new Error(`No hay cliente disponible para la cadena ${chainId}`));
        return;
      }
      
      // Actualizar el estado a "confirmando"
      this.updateTransactionStatus(hash, TransactionStatus.CONFIRMING);
      
      // Esperar el recibo de la transacción
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`
      });
      
      // Verificar si la transacción fue exitosa
      if (receipt.status === 'success') {
        this.updateTransactionStatus(hash, TransactionStatus.CONFIRMED, receipt);
      } else {
        this.updateTransactionStatus(hash, TransactionStatus.FAILED, receipt, new Error('La transacción falló en la blockchain'));
      }
    } catch (error: any) {
      this.updateTransactionStatus(hash, TransactionStatus.FAILED, undefined, error);
    }
  }
  
  /**
   * Actualiza el estado de una transacción
   * @param hash Hash de la transacción
   * @param status Nuevo estado
   * @param receipt Recibo de la transacción (opcional)
   * @param error Error (opcional)
   */
  private updateTransactionStatus(
    hash: string,
    status: TransactionStatus,
    receipt?: TransactionReceipt,
    error?: Error
  ): void {
    const transaction = this.transactions.get(hash);
    if (transaction) {
      transaction.status = status;
      if (receipt) {
        transaction.receipt = receipt;
      }
      if (error) {
        transaction.error = error;
      }
      this.transactions.set(hash, transaction);
      
      // Aquí se podría emitir un evento o llamar a un callback
      console.log(`Transacción ${hash} actualizada a ${status}`);
    }
  }
  
  /**
   * Obtiene información de una transacción
   * @param hash Hash de la transacción
   * @returns Información de la transacción
   */
  public getTransactionInfo(hash: string): TransactionInfo | undefined {
    return this.transactions.get(hash);
  }
  
  /**
   * Verifica el estado de un pago en el contrato
   * @param paymentId ID del pago
   * @param chainId ID de la cadena
   * @returns Estado del pago (0: No existe, 1: Pendiente, 2: Completado, 3: Fallido)
   */
  public async checkPaymentStatus(paymentId: string, chainId: number): Promise<number> {
    try {
      // Verificar si hay contrato de pago disponible
      const paymentContractAddress = PAYMENT_CONTRACT_ADDRESS[chainId];
      if (!paymentContractAddress) {
        throw new Error('Contrato de pago no disponible en la red actual.');
      }
      
      // Obtener el cliente público para la cadena especificada
      const publicClient = getPublicClient({ chainId });
      if (!publicClient) {
        throw new Error(`No hay cliente disponible para la cadena ${chainId}`);
      }
      
      // Obtener el contrato de pago
      const paymentContract = getContract({
        address: paymentContractAddress as `0x${string}`,
        abi: PAYMENT_ABI,
        publicClient
      });
      
      // Consultar el estado del pago
      const status = await paymentContract.read.getPaymentStatus([paymentId as `0x${string}`]);
      
      return Number(status);
    } catch (error) {
      console.error('Error al verificar el estado del pago:', error);
      throw error;
    }
  }
}

// Exportar una instancia por defecto del servicio
export const paymentService = new PaymentService(); 