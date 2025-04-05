/**
 * Rutas para la reconciliación de transacciones de Stripe
 * Parte de la implementación de la subtarea #4.4 - Implement Transaction Record Mapping and Reconciliation
 */

import { Router } from 'express';
import { param, query, body } from 'express-validator';
import reconciliationController from '../controllers/reconciliation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { isAdmin } from '../middlewares/role.middleware';
import { validate, asyncErrorHandler } from '../middlewares';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Ruta para obtener transacciones que necesitan reconciliación
// Requiere rol de administrador
router.get(
  '/pending',
  isAdmin,
  validate([
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]),
  asyncErrorHandler(reconciliationController.getTransactionsNeedingReconciliation)
);

// Ruta para reconciliar una transacción específica
// Requiere rol de administrador
router.post(
  '/reconcile/:transactionId',
  isAdmin,
  validate([
    param('transactionId')
      .isString()
      .notEmpty()
      .withMessage('Transaction ID is required')
  ]),
  asyncErrorHandler(reconciliationController.reconcileTransaction)
);

// Ruta para sincronizar transacciones con Stripe
// Requiere rol de administrador
router.post(
  '/sync',
  isAdmin,
  validate([
    body('startDate')
      .isISO8601()
      .withMessage('Start date must be in ISO 8601 format'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO 8601 format')
  ]),
  asyncErrorHandler(reconciliationController.syncTransactions)
);

// Ruta para obtener transacciones de un usuario
// Los usuarios pueden ver sus propias transacciones
router.get(
  '/user/:userId',
  validate([
    param('userId')
      .isString()
      .notEmpty()
      .withMessage('User ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
  ]),
  asyncErrorHandler(reconciliationController.getUserTransactions)
);

// Ruta para obtener detalles de una transacción específica
router.get(
  '/transaction/:transactionId',
  validate([
    param('transactionId')
      .isString()
      .notEmpty()
      .withMessage('Transaction ID is required')
  ]),
  asyncErrorHandler(reconciliationController.getTransactionDetails)
);

export default router; 