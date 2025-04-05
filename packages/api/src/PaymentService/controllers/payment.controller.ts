import { Request, Response } from 'express';
import paymentService from '../services/PaymentService';
import contractService from '../services/ContractService';
import logger, { logError } from '../utils/logger';
import { PaymentStatus } from '../models';

class PaymentController {
  /**
   * Iniciar un nuevo pago directo con stablecoin
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async initiateDirectPayment(req: Request, res: Response): Promise<void> {
    try {
      const { stablecoinSymbol, amount, cereNetworkAddress, ddcAccountId } = req.body;
      
      // Validar parámetros requeridos
      if (!stablecoinSymbol || !amount || !cereNetworkAddress) {
        res.status(400).json({
          success: false,
          message: 'Se requieren stablecoinSymbol, amount y cereNetworkAddress'
        });
        return;
      }
      
      // Obtener el ID del usuario de la solicitud autenticada
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
        return;
      }
      
      // Iniciar el pago
      const payment = await paymentService.initiateDirectPayment(
        userId,
        stablecoinSymbol,
        amount,
        cereNetworkAddress,
        ddcAccountId
      );
      
      // Devolver detalles del pago iniciado
      res.status(201).json({
        success: true,
        payment: {
          id: payment.id,
          paymentId: payment.paymentId,
          stablecoinAddress: payment.stablecoinAddress,
          stablecoinAmount: payment.stablecoinAmount,
          cereNetworkAddress: payment.cereNetworkAddress,
          status: payment.status,
          expectedCompletionTime: payment.getEstimatedTimeRemaining(),
          createdAt: payment.createdAt
        }
      });
    } catch (error) {
      logError('Error en initiateDirectPayment', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al iniciar el pago'
      });
    }
  }

  /**
   * Procesar una transacción de stablecoin recibida (webhook para eventos de blockchain)
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async processStablecoinTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId, txHash, fromAddress, stablecoinAddress, amount } = req.body;
      
      // Validar parámetros requeridos
      if (!paymentId || !txHash || !fromAddress || !stablecoinAddress || !amount) {
        res.status(400).json({
          success: false,
          message: 'Se requieren paymentId, txHash, fromAddress, stablecoinAddress y amount'
        });
        return;
      }
      
      // Procesar la transacción
      const payment = await paymentService.processStablecoinTransaction(
        paymentId,
        txHash,
        fromAddress,
        stablecoinAddress,
        amount
      );
      
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Pago no encontrado o inválido'
        });
        return;
      }
      
      // Devolver confirmación
      res.status(200).json({
        success: true,
        message: 'Transacción procesada correctamente',
        status: payment.status
      });
    } catch (error) {
      logError('Error en processStablecoinTransaction', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al procesar la transacción'
      });
    }
  }

  /**
   * Obtener los detalles de un pago
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async getPaymentDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Se requiere el ID del pago'
        });
        return;
      }
      
      // Obtener el pago
      const payment = await paymentService.getPaymentDetails(id);
      
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Pago no encontrado'
        });
        return;
      }
      
      // Verificar que el usuario tiene acceso al pago
      const userId = req.user?.id;
      if (!userId || (payment.userId !== userId && !req.user?.isAdmin)) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este pago'
        });
        return;
      }
      
      // Devolver detalles del pago
      res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          userId: payment.userId,
          paymentId: payment.paymentId,
          externalId: payment.externalId,
          stablecoinAddress: payment.stablecoinAddress,
          stablecoinAmount: payment.stablecoinAmount,
          cereAmount: payment.cereAmount,
          cereNetworkAddress: payment.cereNetworkAddress,
          ddcAccountId: payment.ddcAccountId,
          teleportTxId: payment.teleportTxId,
          status: payment.status,
          provider: payment.provider,
          errorStep: payment.errorStep,
          errorMessage: payment.errorMessage,
          completedAt: payment.completedAt,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          estimatedTimeRemaining: payment.getEstimatedTimeRemaining(),
          metadata: payment.metadata
        }
      });
    } catch (error) {
      logError('Error en getPaymentDetails', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al obtener detalles del pago'
      });
    }
  }

  /**
   * Obtener los pagos de un usuario
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async getUserPayments(req: Request, res: Response): Promise<void> {
    try {
      // Obtener parámetros de paginación
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Obtener el ID del usuario de la solicitud autenticada
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
        return;
      }
      
      // Obtener los pagos
      const payments = await paymentService.getUserPayments(userId, limit, offset);
      
      // Formatear la respuesta
      const formattedPayments = payments.map(payment => ({
        id: payment.id,
        paymentId: payment.paymentId,
        stablecoinAmount: payment.stablecoinAmount,
        cereAmount: payment.cereAmount,
        status: payment.status,
        provider: payment.provider,
        errorMessage: payment.errorMessage,
        completedAt: payment.completedAt,
        createdAt: payment.createdAt,
        estimatedTimeRemaining: payment.getEstimatedTimeRemaining()
      }));
      
      // Devolver la lista de pagos
      res.status(200).json({
        success: true,
        count: formattedPayments.length,
        payments: formattedPayments
      });
    } catch (error) {
      logError('Error en getUserPayments', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al obtener pagos del usuario'
      });
    }
  }

  /**
   * Verificar el estado de un pago (para sondeo desde el frontend)
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async checkPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Se requiere el ID del pago'
        });
        return;
      }
      
      // Obtener el pago
      const payment = await paymentService.getPaymentDetails(id);
      
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Pago no encontrado'
        });
        return;
      }
      
      // Verificar que el usuario tiene acceso al pago
      const userId = req.user?.id;
      if (!userId || (payment.userId !== userId && !req.user?.isAdmin)) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este pago'
        });
        return;
      }
      
      // Devolver estado del pago
      res.status(200).json({
        success: true,
        status: {
          id: payment.id,
          paymentId: payment.paymentId,
          status: payment.status,
          errorStep: payment.errorStep,
          errorMessage: payment.errorMessage,
          estimatedTimeRemaining: payment.getEstimatedTimeRemaining(),
          completedAt: payment.completedAt,
          updatedAt: payment.updatedAt,
          cereAmount: payment.cereAmount,
          stablecoinAmount: payment.stablecoinAmount
        }
      });
    } catch (error) {
      logError('Error en checkPaymentStatus', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al verificar estado del pago'
      });
    }
  }

  /**
   * Iniciar proceso de verificación de teleport manualmente (para administradores)
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async checkTeleport(req: Request, res: Response): Promise<void> {
    try {
      const { id, teleportTxId } = req.params;
      
      // Verificar que el usuario es administrador
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Se requieren permisos de administrador'
        });
        return;
      }
      
      // Obtener el pago
      const payment = await paymentService.getPaymentDetails(id);
      
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Pago no encontrado'
        });
        return;
      }
      
      // Verificar estado del teleport
      const status = await contractService.checkTeleportStatus(teleportTxId || payment.teleportTxId || '');
      
      // Devolver estado
      res.status(200).json({
        success: true,
        teleportStatus: status,
        paymentStatus: payment.status
      });
    } catch (error) {
      logError('Error en checkTeleport', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error al verificar teleport'
      });
    }
  }
}

export default new PaymentController(); 