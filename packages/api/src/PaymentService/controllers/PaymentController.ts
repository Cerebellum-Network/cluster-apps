import { Request, Response } from 'express';
import PaymentService from '../services/PaymentService';
import ContractService from '../services/ContractService';
import TeleportService from '../services/TeleportService';
import DDCService from '../services/DDCService';
import { PaymentStatus } from '../models';

class PaymentController {
  private paymentService: PaymentService;
  private contractService: ContractService;
  private teleportService: TeleportService; 
  private ddcService: DDCService;

  constructor() {
    this.paymentService = new PaymentService();
    this.contractService = new ContractService();
    this.teleportService = new TeleportService();
    this.ddcService = new DDCService();
  }

  /**
   * Inicia un pago directo con stablecoin
   */
  initiateDirectPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, stablecoinSymbol, amount, cereNetworkAddress, ddcAccountId } = req.body;
      
      const payment = await this.paymentService.initiateDirectPayment(
        userId,
        stablecoinSymbol,
        amount,
        cereNetworkAddress,
        ddcAccountId
      );
      
      res.status(201).json({
        success: true,
        payment
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Procesa webhook para pagos con stablecoin
   */
  processStablecoinWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId, txHash, fromAddress, stablecoinAddress, amount } = req.body;
      
      const payment = await this.paymentService.processStablecoinTransaction(
        paymentId,
        txHash,
        fromAddress,
        stablecoinAddress,
        amount
      );
      
      res.status(200).json({
        success: true,
        payment
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Obtiene el estado actual de un pago
   */
  getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId } = req.params;
      
      const payment = await this.paymentService.getPaymentByPaymentId(paymentId);
      
      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'Pago no encontrado'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        payment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Inicia un pago con fiat usando on-ramp provider (Stripe, etc)
   */
  initiateFiatPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        userId, 
        amount,
        currency,
        stablecoinSymbol,
        cereNetworkAddress,
        ddcAccountId
      } = req.body;
      
      // Aquí se implementaría la conexión con Stripe u otro proveedor
      const paymentSession = await this.paymentService.initiateFiatPayment(
        userId,
        amount,
        currency,
        stablecoinSymbol,
        cereNetworkAddress,
        ddcAccountId
      );
      
      res.status(201).json({
        success: true,
        paymentSession
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Procesa webhook para pagos con fiat (Stripe, etc)
   */
  processFiatWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const { externalId, status } = req.body;
      
      const payment = await this.paymentService.processFiatWebhook(
        externalId,
        status
      );
      
      res.status(200).json({
        success: true,
        payment
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Endpoint para conectar wallet (integración con matrix-demo)
   */
  connectWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { walletAddress, network } = req.body;
      
      // Validamos la dirección de la wallet
      if (!walletAddress || walletAddress.length < 10) {
        throw new Error('Dirección de wallet inválida');
      }
      
      // Simulamos el balance para la demo (en producción vendríamos blockchain)
      const balance = {
        USDT: '1234.56',
        USDC: '987.65',
        ETH: '1.234'
      };
      
      res.status(200).json({
        success: true,
        wallet: {
          address: walletAddress,
          network,
          balance
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Endpoint para realizar swap de tokens (integración con matrix-demo)
   */
  swapTokens = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        userId, 
        walletAddress, 
        stablecoinSymbol, 
        amount, 
        cereNetworkAddress, 
        ddcAccountId 
      } = req.body;
      
      // Iniciamos el pago en la base de datos
      const payment = await this.paymentService.initiateDirectPayment(
        userId,
        stablecoinSymbol,
        amount,
        cereNetworkAddress,
        ddcAccountId
      );
      
      // Simulamos una transacción de stablecoin recibida (en producción esto vendría de un webhook)
      const mockTxHash = `0xswap${Date.now()}`;
      
      await this.paymentService.processStablecoinTransaction(
        payment.paymentId,
        mockTxHash,
        walletAddress,
        payment.stablecoinAddress,
        amount
      );
      
      // Obtenemos el monto de CERE estimado
      const expectedCereAmount = await this.contractService.getExpectedCereAmount(
        stablecoinSymbol,
        amount
      );
      
      // Procesamos el swap (en producción esto podría ser asíncrono)
      await this.paymentService.processPaymentSwap(payment.id);
      
      // Obtenemos el pago actualizado
      const updatedPayment = await this.paymentService.getPaymentById(payment.id);
      
      res.status(200).json({
        success: true,
        payment: updatedPayment,
        swapDetails: {
          stablecoinAmount: amount,
          stablecoinSymbol,
          cereAmount: expectedCereAmount,
          txHash: mockTxHash
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Endpoint para teleportar tokens a Cere Network (integración con matrix-demo)
   */
  teleportTokens = async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId } = req.body;
      
      // Obtenemos el pago
      const payment = await this.paymentService.getPaymentById(paymentId);
      
      if (!payment) {
        throw new Error('Pago no encontrado');
      }
      
      if (payment.status !== PaymentStatus.TOKENS_SWAPPED) {
        throw new Error(`Estado incorrecto para teleport: ${payment.status}`);
      }
      
      // Procesamos el teleport
      await this.paymentService.processTeleport(payment.id);
      
      // Simulamos que el teleport se ha completado (en producción sería asíncrono)
      await this.teleportService.confirmTeleport(payment.id);
      
      // Obtenemos el pago actualizado
      const updatedPayment = await this.paymentService.getPaymentById(payment.id);
      
      res.status(200).json({
        success: true,
        payment: updatedPayment,
        teleportDetails: {
          cereAmount: payment.cereAmount,
          teleportTxId: updatedPayment.teleportTxId,
          sourceNetwork: 'Ethereum',
          destinationNetwork: 'Cere Mainnet'
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Endpoint para verificar balance de cuenta DDC (integración con matrix-demo)
   */
  verifyDDCAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId } = req.body;
      
      // Obtenemos el pago
      const payment = await this.paymentService.getPaymentById(paymentId);
      
      if (!payment) {
        throw new Error('Pago no encontrado');
      }
      
      if (payment.status !== PaymentStatus.TELEPORTED) {
        throw new Error(`Estado incorrecto para verificación: ${payment.status}`);
      }
      
      // Simulamos información previa de la cuenta DDC
      const previousBalance = '50.25';
      
      // Actualizamos la cuenta DDC
      await this.paymentService.updateDDCAccount(payment.id);
      
      // Obtenemos el pago actualizado
      const updatedPayment = await this.paymentService.getPaymentById(payment.id);
      
      res.status(200).json({
        success: true,
        payment: updatedPayment,
        ddcDetails: {
          accountId: payment.metadata.ddcAccountId,
          previousBalance,
          newTokens: payment.cereAmount,
          currentBalance: (parseFloat(previousBalance) + parseFloat(payment.cereAmount)).toString(),
          network: 'Cere Mainnet'
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };
}

export default PaymentController; 