/**
 * Controlador para la reconciliación de transacciones de Stripe
 * Parte de la implementación de la subtarea #4.4 - Implement Transaction Record Mapping and Reconciliation
 */

import { Request, Response } from 'express';
import StripeReconciliationService from '../services/StripeReconciliationService';
import StripeTransactionRepository from '../repositories/StripeTransactionRepository';
import logger from '../../utils/logger';

class ReconciliationController {
  /**
   * Obtener una lista de transacciones que necesitan reconciliación
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async getTransactionsNeedingReconciliation(req: Request, res: Response): Promise<void> {
    try {
      // Obtener el límite opcional
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      
      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          message: 'Limit must be a positive number'
        });
        return;
      }
      
      // Obtener transacciones
      const transactions = await StripeReconciliationService.findTransactionsNeedingReconciliation(limit);
      
      res.status(200).json({
        success: true,
        count: transactions.length,
        data: transactions
      });
    } catch (error) {
      logger.error('Error getting transactions needing reconciliation', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Reconciliar una transacción específica
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async reconcileTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      
      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required'
        });
        return;
      }
      
      // Intentar reconciliar la transacción
      const result = await StripeReconciliationService.reconcileTransaction(transactionId);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('Error reconciling transaction', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Sincronizar transacciones con Stripe
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async syncTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.body;
      
      // Validar fecha de inicio
      if (!startDate) {
        res.status(400).json({
          success: false,
          message: 'Start date is required'
        });
        return;
      }
      
      // Convertir a objetos Date
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date();
      
      if (isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid start date'
        });
        return;
      }
      
      if (isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid end date'
        });
        return;
      }
      
      // Realizar la sincronización
      const result = await StripeReconciliationService.syncTransactions(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error syncing transactions', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obtener todas las transacciones para un usuario
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async getUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }
      
      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          message: 'Limit must be a positive number'
        });
        return;
      }
      
      if (isNaN(page) || page <= 0) {
        res.status(400).json({
          success: false,
          message: 'Page must be a positive number'
        });
        return;
      }
      
      // Obtener transacciones
      const transactions = await StripeTransactionRepository.findByUserId(userId, limit, page);
      
      res.status(200).json({
        success: true,
        count: transactions.length,
        page,
        limit,
        data: transactions
      });
    } catch (error) {
      logger.error('Error getting user transactions', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obtener detalles de una transacción específica
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async getTransactionDetails(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      
      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required'
        });
        return;
      }
      
      // Obtener la transacción
      const transaction = await StripeTransactionRepository.findById(transactionId);
      
      if (!transaction) {
        res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: transaction
      });
    } catch (error) {
      logger.error('Error getting transaction details', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new ReconciliationController(); 