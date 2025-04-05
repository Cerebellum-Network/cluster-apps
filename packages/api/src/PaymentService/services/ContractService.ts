import { ethers } from 'ethers';
import { 
  CONTRACT_PAYMENT_HANDLER_ADDRESS, 
  CONTRACT_TOKEN_SWAPPER_ADDRESS, 
  CONTRACT_HYPERBRIDGE_ADDRESS,
  CONTRACT_NETWORK_RPC_URL,
  SUPPORTED_STABLECOINS
} from '../config/env';
import logger, { logError } from '../utils/logger';

// Importar ABIs (cuando los tengamos, por ahora usamos versiones mínimas)
// Estos ABIs tendrían que ser generados a partir de los contratos o importados desde archivos
const PAYMENT_HANDLER_ABI = [
  // Función processPayment
  'function processPayment(address stablecoin, uint256 amount, string cereNetworkAddress, uint256 minCereAmount, uint256 deadline) external returns (bytes32)',
  // Evento PaymentProcessed
  'event PaymentProcessed(bytes32 indexed paymentId, address indexed from, string cereNetworkAddress, address stablecoin, uint256 stablecoinAmount)',
  // Evento PaymentSwapped
  'event PaymentSwapped(bytes32 indexed paymentId, uint256 cereAmount)',
  // Evento PaymentTeleported
  'event PaymentTeleported(bytes32 indexed paymentId, bytes32 teleportTxId)'
];

const TOKEN_SWAPPER_ABI = [
  // Función getExpectedAmountOut
  'function getExpectedAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)',
  // Función para realizar swap
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)'
];

const HYPERBRIDGE_ABI = [
  // Función checkTeleportStatus
  'function checkTeleportStatus(bytes32 txId) external view returns (uint8)',
  // Función para teleportar tokens
  'function teleportTokens(address token, uint256 amount, string calldata destinationAddress) external returns (bytes32 txId)',
  // Evento TokensTeleported
  'event TokensTeleported(bytes32 indexed txId, address indexed token, uint256 amount, string destinationAddress)'
];

const ERC20_ABI = [
  // Función para aprobar tokens
  'function approve(address spender, uint256 amount) external returns (bool)',
  // Función para verificar balance
  'function balanceOf(address account) external view returns (uint256)',
  // Función para transferir tokens
  'function transfer(address to, uint256 amount) external returns (bool)'
];

// Direcciones de tokens CERE
const CERE_TOKEN_ADDRESS = process.env.CERE_TOKEN_ADDRESS || '0xCereTokenAddress';

// Clase para interactuar con los contratos
export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private paymentHandlerContract: ethers.Contract | null = null;
  private tokenSwapperContract: ethers.Contract | null = null;
  private hyperbridgeContract: ethers.Contract | null = null;
  private stablecoinContracts: Record<string, ethers.Contract> = {};
  private signer: ethers.Wallet | null = null;
  
  constructor() {
    // Inicializar provider
    this.provider = new ethers.JsonRpcProvider(CONTRACT_NETWORK_RPC_URL);
    
    try {
      // Inicializar signer si hay una clave privada configurada
      const privateKey = process.env.WALLET_PRIVATE_KEY;
      if (privateKey) {
        this.signer = new ethers.Wallet(privateKey, this.provider);
        logger.info('Wallet signer initialized');
      } else {
        logger.warn('No wallet private key provided, only read operations will be available');
      }
      
      // Inicializar contratos si las direcciones están configuradas
      if (CONTRACT_PAYMENT_HANDLER_ADDRESS) {
        this.paymentHandlerContract = new ethers.Contract(
          CONTRACT_PAYMENT_HANDLER_ADDRESS,
          PAYMENT_HANDLER_ABI,
          this.provider
        );
      }
      
      if (CONTRACT_TOKEN_SWAPPER_ADDRESS) {
        this.tokenSwapperContract = new ethers.Contract(
          CONTRACT_TOKEN_SWAPPER_ADDRESS,
          TOKEN_SWAPPER_ABI,
          this.provider
        );
      }
      
      if (CONTRACT_HYPERBRIDGE_ADDRESS) {
        this.hyperbridgeContract = new ethers.Contract(
          CONTRACT_HYPERBRIDGE_ADDRESS,
          HYPERBRIDGE_ABI,
          this.provider
        );
      }
      
      // Inicializar contratos de stablecoins
      Object.entries(SUPPORTED_STABLECOINS).forEach(([symbol, address]) => {
        if (address) {
          this.stablecoinContracts[symbol] = new ethers.Contract(
            address,
            ERC20_ABI,
            this.provider
          );
        }
      });
      
      logger.info('Contract service initialized successfully');
    } catch (error) {
      logError('Failed to initialize contract service', error);
      throw error;
    }
  }
  
  /**
   * Obtener una estimación de la cantidad de tokens CERE que se recibirán
   * @param stablecoinSymbol Símbolo de la stablecoin (ej: 'USDC')
   * @param amount Cantidad de stablecoin (en unidades completas, ej: '100' para 100 USDC)
   * @returns Cantidad estimada de tokens CERE
   */
  async getExpectedCereAmount(stablecoinSymbol: string, amount: string): Promise<string> {
    try {
      if (!this.tokenSwapperContract) {
        throw new Error('Token swapper contract not initialized');
      }
      
      const stablecoinAddress = SUPPORTED_STABLECOINS[stablecoinSymbol];
      if (!stablecoinAddress) {
        throw new Error(`Unsupported stablecoin: ${stablecoinSymbol}`);
      }
      
      // Convertir cantidad a BigInt con la precisión adecuada
      const decimals = 6; // Asumimos 6 decimales para USDC/USDT
      const amountWithDecimals = ethers.parseUnits(amount, decimals);
      
      // Llamar al contrato para obtener la estimación
      const expectedAmount = await this.tokenSwapperContract.getExpectedAmountOut(
        stablecoinAddress,
        CERE_TOKEN_ADDRESS,
        amountWithDecimals
      );
      
      // Convertir de vuelta a string con la precisión adecuada
      return ethers.formatUnits(expectedAmount, 18); // Tokens CERE tienen 18 decimales
    } catch (error) {
      logError('Failed to get expected CERE amount', error);
      throw error;
    }
  }
  
  /**
   * Verificar el estado de una teleportación
   * @param teleportTxId ID de la transacción de teleportación
   * @returns Estado de la teleportación (0: No existe, 1: Pendiente, 2: Completada, 3: Fallida)
   */
  async checkTeleportStatus(teleportTxId: string): Promise<number> {
    try {
      if (!this.hyperbridgeContract) {
        throw new Error('Hyperbridge contract not initialized');
      }
      
      const status = await this.hyperbridgeContract.checkTeleportStatus(teleportTxId);
      return Number(status);
    } catch (error) {
      logError('Failed to check teleport status', error);
      throw error;
    }
  }

  /**
   * Procesar un pago utilizando el contrato StablecoinPaymentHandler
   * @param stablecoinSymbol Símbolo de la stablecoin (ej: 'USDC')
   * @param amount Cantidad de stablecoin (en unidades completas, ej: '100' para 100 USDC)
   * @param cereNetworkAddress Dirección destino en Cere Network
   * @param slippagePercentage Porcentaje de slippage permitido (por defecto 2%)
   * @returns ID de la transacción de pago
   */
  async processPayment(
    stablecoinSymbol: string,
    amount: string,
    cereNetworkAddress: string,
    slippagePercentage: number = 2
  ): Promise<string> {
    try {
      if (!this.signer) {
        throw new Error('No wallet signer available for transactions');
      }

      if (!this.paymentHandlerContract) {
        throw new Error('Payment handler contract not initialized');
      }

      const stablecoinAddress = SUPPORTED_STABLECOINS[stablecoinSymbol];
      if (!stablecoinAddress) {
        throw new Error(`Unsupported stablecoin: ${stablecoinSymbol}`);
      }

      // Conectar al contrato con el signer
      const paymentHandlerWithSigner = this.paymentHandlerContract.connect(this.signer);

      // Obtener la stablecoin
      const stablecoin = this.stablecoinContracts[stablecoinSymbol];
      if (!stablecoin) {
        throw new Error(`Stablecoin contract not initialized: ${stablecoinSymbol}`);
      }
      
      // Calcular la cantidad con decimales
      const decimals = 6; // Asumimos 6 decimales para USDC/USDT
      const amountWithDecimals = ethers.parseUnits(amount, decimals);

      // Aprobar el gasto de tokens por parte del contrato de pagos
      const stablecoinWithSigner = stablecoin.connect(this.signer);
      logger.info(`Approving ${amount} ${stablecoinSymbol} for payment handler contract`);
      const approveTx = await stablecoinWithSigner.approve(CONTRACT_PAYMENT_HANDLER_ADDRESS, amountWithDecimals);
      await approveTx.wait();
      logger.info(`Approval transaction confirmed: ${approveTx.hash}`);

      // Obtener estimación de CERE a recibir
      const expectedCereAmountString = await this.getExpectedCereAmount(stablecoinSymbol, amount);
      const expectedCereAmount = ethers.parseUnits(expectedCereAmountString, 18);

      // Calcular minCereAmount con slippage
      const slippageFactor = 100 - slippagePercentage;
      const minCereAmount = expectedCereAmount * BigInt(slippageFactor) / BigInt(100);

      // Calcular deadline (30 minutos en el futuro)
      const deadline = Math.floor(Date.now() / 1000) + 30 * 60;

      // Llamar a processPayment
      logger.info(`Processing payment: ${amount} ${stablecoinSymbol} for destination ${cereNetworkAddress}`);
      const tx = await paymentHandlerWithSigner.processPayment(
        stablecoinAddress,
        amountWithDecimals,
        cereNetworkAddress,
        minCereAmount,
        deadline
      );

      // Esperar a que se confirme la transacción
      const receipt = await tx.wait();
      logger.info(`Payment transaction confirmed: ${tx.hash}`);

      // Buscar el evento PaymentProcessed para obtener el paymentId
      const paymentProcessedEvent = receipt.logs
        .filter((log: any) => {
          try {
            const parsedLog = this.paymentHandlerContract!.interface.parseLog(log);
            return parsedLog && parsedLog.name === 'PaymentProcessed';
          } catch (e) {
            return false;
          }
        })
        .map((log: any) => this.paymentHandlerContract!.interface.parseLog(log))[0];

      if (!paymentProcessedEvent) {
        throw new Error('PaymentProcessed event not found in transaction logs');
      }

      const paymentId = paymentProcessedEvent.args[0];
      logger.info(`Payment processed with ID: ${paymentId}`);

      return paymentId;
    } catch (error) {
      logError('Failed to process payment', error);
      throw error;
    }
  }

  /**
   * Realizar un swap de tokens directamente (sin usar el PaymentHandler)
   * @param stablecoinSymbol Símbolo de la stablecoin (ej: 'USDC')
   * @param amount Cantidad de stablecoin (en unidades completas, ej: '100' para 100 USDC)
   * @param slippagePercentage Porcentaje de slippage permitido (por defecto 2%)
   * @returns Cantidad de tokens CERE recibidos
   */
  async swapTokens(
    stablecoinSymbol: string,
    amount: string,
    slippagePercentage: number = 2
  ): Promise<string> {
    try {
      if (!this.signer) {
        throw new Error('No wallet signer available for transactions');
      }

      if (!this.tokenSwapperContract) {
        throw new Error('Token swapper contract not initialized');
      }

      const stablecoinAddress = SUPPORTED_STABLECOINS[stablecoinSymbol];
      if (!stablecoinAddress) {
        throw new Error(`Unsupported stablecoin: ${stablecoinSymbol}`);
      }

      // Conectar al contrato con el signer
      const swapperWithSigner = this.tokenSwapperContract.connect(this.signer);

      // Obtener la stablecoin
      const stablecoin = this.stablecoinContracts[stablecoinSymbol];
      if (!stablecoin) {
        throw new Error(`Stablecoin contract not initialized: ${stablecoinSymbol}`);
      }
      
      // Calcular la cantidad con decimales
      const decimals = 6; // Asumimos 6 decimales para USDC/USDT
      const amountWithDecimals = ethers.parseUnits(amount, decimals);

      // Aprobar el gasto de tokens por parte del swapper
      const stablecoinWithSigner = stablecoin.connect(this.signer);
      logger.info(`Approving ${amount} ${stablecoinSymbol} for token swapper contract`);
      const approveTx = await stablecoinWithSigner.approve(CONTRACT_TOKEN_SWAPPER_ADDRESS, amountWithDecimals);
      await approveTx.wait();
      logger.info(`Approval transaction confirmed: ${approveTx.hash}`);

      // Obtener estimación de CERE a recibir
      const expectedCereAmountString = await this.getExpectedCereAmount(stablecoinSymbol, amount);
      const expectedCereAmount = ethers.parseUnits(expectedCereAmountString, 18);

      // Calcular minCereAmount con slippage
      const slippageFactor = 100 - slippagePercentage;
      const minCereAmount = expectedCereAmount * BigInt(slippageFactor) / BigInt(100);

      // Calcular deadline (30 minutos en el futuro)
      const deadline = Math.floor(Date.now() / 1000) + 30 * 60;

      // Configurar la ruta del swap
      const path = [stablecoinAddress, CERE_TOKEN_ADDRESS];

      // Realizar el swap
      logger.info(`Swapping ${amount} ${stablecoinSymbol} for CERE tokens`);
      const tx = await swapperWithSigner.swapExactTokensForTokens(
        amountWithDecimals,
        minCereAmount,
        path,
        await this.signer.getAddress(),
        deadline
      );

      // Esperar a que se confirme la transacción
      const receipt = await tx.wait();
      logger.info(`Swap transaction confirmed: ${tx.hash}`);

      // Obtener la cantidad recibida
      // Suponemos que el último elemento del array 'amounts' devuelto es la cantidad de CERE
      const amounts = receipt.logs[0].args.amounts;
      const cereAmount = amounts[amounts.length - 1];
      
      // Convertir a string con unidades decimales
      const cereAmountFormatted = ethers.formatUnits(cereAmount, 18);
      logger.info(`Received ${cereAmountFormatted} CERE tokens from swap`);

      return cereAmountFormatted;
    } catch (error) {
      logError('Failed to swap tokens', error);
      throw error;
    }
  }

  /**
   * Teleportar tokens CERE a la red Cere Network
   * @param amount Cantidad de tokens CERE (en unidades completas, ej: '10' para 10 CERE)
   * @param destinationAddress Dirección destino en Cere Network
   * @returns ID de la transacción de teleportación
   */
  async teleportTokens(
    amount: string,
    destinationAddress: string
  ): Promise<string> {
    try {
      if (!this.signer) {
        throw new Error('No wallet signer available for transactions');
      }

      if (!this.hyperbridgeContract) {
        throw new Error('Hyperbridge contract not initialized');
      }

      // Conectar al contrato con el signer
      const hyperbridgeWithSigner = this.hyperbridgeContract.connect(this.signer);

      // Calcular la cantidad con decimales
      const amountWithDecimals = ethers.parseUnits(amount, 18); // CERE tokens tienen 18 decimales

      // Aprobar el gasto de tokens por parte del hyperbridge
      const cereToken = new ethers.Contract(CERE_TOKEN_ADDRESS, ERC20_ABI, this.provider);
      const cereTokenWithSigner = cereToken.connect(this.signer);
      
      logger.info(`Approving ${amount} CERE for hyperbridge contract`);
      const approveTx = await cereTokenWithSigner.approve(CONTRACT_HYPERBRIDGE_ADDRESS, amountWithDecimals);
      await approveTx.wait();
      logger.info(`Approval transaction confirmed: ${approveTx.hash}`);

      // Teleportar tokens
      logger.info(`Teleporting ${amount} CERE to ${destinationAddress} on Cere Network`);
      const tx = await hyperbridgeWithSigner.teleportTokens(
        CERE_TOKEN_ADDRESS,
        amountWithDecimals,
        destinationAddress
      );

      // Esperar a que se confirme la transacción
      const receipt = await tx.wait();
      logger.info(`Teleport transaction confirmed: ${tx.hash}`);

      // Buscar el evento TokensTeleported para obtener el teleportTxId
      const teleportEvent = receipt.logs
        .filter((log: any) => {
          try {
            const parsedLog = this.hyperbridgeContract!.interface.parseLog(log);
            return parsedLog && parsedLog.name === 'TokensTeleported';
          } catch (e) {
            return false;
          }
        })
        .map((log: any) => this.hyperbridgeContract!.interface.parseLog(log))[0];

      if (!teleportEvent) {
        throw new Error('TokensTeleported event not found in transaction logs');
      }

      const teleportTxId = teleportEvent.args[0];
      logger.info(`Tokens teleported with ID: ${teleportTxId}`);

      return teleportTxId;
    } catch (error) {
      logError('Failed to teleport tokens', error);
      throw error;
    }
  }

  /**
   * Verificar el balance de una stablecoin
   * @param stablecoinSymbol Símbolo de la stablecoin (ej: 'USDC')
   * @param address Dirección a consultar
   * @returns Balance en formato string
   */
  async getStablecoinBalance(stablecoinSymbol: string, address: string): Promise<string> {
    try {
      const stablecoin = this.stablecoinContracts[stablecoinSymbol];
      if (!stablecoin) {
        throw new Error(`Stablecoin contract not initialized: ${stablecoinSymbol}`);
      }

      const balance = await stablecoin.balanceOf(address);
      return ethers.formatUnits(balance, 6); // Asumimos 6 decimales para USDC/USDT
    } catch (error) {
      logError(`Failed to get ${stablecoinSymbol} balance for ${address}`, error);
      throw error;
    }
  }

  /**
   * Verificar el balance de tokens CERE
   * @param address Dirección a consultar
   * @returns Balance en formato string
   */
  async getCereBalance(address: string): Promise<string> {
    try {
      const cereToken = new ethers.Contract(CERE_TOKEN_ADDRESS, ERC20_ABI, this.provider);
      const balance = await cereToken.balanceOf(address);
      return ethers.formatUnits(balance, 18); // CERE tokens tienen 18 decimales
    } catch (error) {
      logError(`Failed to get CERE balance for ${address}`, error);
      throw error;
    }
  }

  /**
   * Obtener la dirección de la wallet utilizada para las transacciones
   * @returns Dirección de la wallet
   */
  async getWalletAddress(): Promise<string | null> {
    try {
      if (!this.signer) {
        return null;
      }
      return await this.signer.getAddress();
    } catch (error) {
      logError('Failed to get wallet address', error);
      throw error;
    }
  }

  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      logger.error(`Error getting transaction receipt for ${txHash}:`, error);
      return null;
    }
  }

  async checkDDCUpdateStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    try {
      const receipt = await this.getTransactionReceipt(txHash);
      if (!receipt) {
        return 'pending';
      }
      return receipt.status === 1 ? 'confirmed' : 'failed';
    } catch (error) {
      logger.error(`Error checking DDC update status for ${txHash}:`, error);
      return 'pending';
    }
  }

  async resubmitStablecoinTransaction(paymentId: string, amount: string): Promise<string> {
    try {
      // Get the nonce for the next transaction
      const nonce = await this.provider.getTransactionCount(this.provider.getAddress());

      // Create and sign the transaction
      const tx = await this.stablecoinContract.processPayment(
        paymentId,
        ethers.parseUnits(amount, 6), // Assuming USDC/USDT decimals
        { nonce }
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      return receipt.hash;
    } catch (error) {
      logger.error(`Error resubmitting stablecoin transaction for payment ${paymentId}:`, error);
      throw error;
    }
  }

  async retryDDCUpdate(paymentId: string, amount: string): Promise<string> {
    try {
      // Get the nonce for the next transaction
      const nonce = await this.provider.getTransactionCount(this.provider.getAddress());

      // Create and sign the transaction
      const tx = await this.ddcContract.updateAccount(
        paymentId,
        ethers.parseUnits(amount, 18), // CERE token decimals
        { nonce }
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      return receipt.hash;
    } catch (error) {
      logger.error(`Error retrying DDC update for payment ${paymentId}:`, error);
      throw error;
    }
  }

  private stablecoinContract: ethers.Contract;
  private ddcContract: ethers.Contract;

  setStablecoinContract(contract: ethers.Contract) {
    this.stablecoinContract = contract;
  }

  setDDCContract(contract: ethers.Contract) {
    this.ddcContract = contract;
  }
}

// Exportar singleton
export default new ContractService(); 