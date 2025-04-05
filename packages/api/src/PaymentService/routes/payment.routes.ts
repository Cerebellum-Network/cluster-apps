import { Router } from 'express';
import { body, param, query } from 'express-validator';
import paymentController from '../controllers/payment.controller';
import { authenticate, authenticateApiKey, requireRoles, validate, asyncErrorHandler } from '../middlewares';
import { validationRules } from '../middlewares/validation.middleware';
import { UserRole } from '../models/User';
import PaymentController from '../controllers/PaymentController';

const router = Router();
const paymentControllerInstance = new PaymentController();

// Ruta para iniciar un pago directo con stablecoin
// Requiere autenticación JWT
router.post(
  '/direct', 
  authenticate,
  validate([
    body('stablecoinSymbol')
      .isIn(['USDC', 'USDT'])
      .withMessage('Stablecoin no soportada'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('La cantidad debe ser un número positivo mayor a 0.01'),
    body('cereNetworkAddress')
      .isString()
      .isLength({ min: 42, max: 42 })
      .matches(/^(cere|CERE)[a-zA-Z0-9]{38}$/)
      .withMessage('Dirección de Cere Network inválida'),
    body('ddcAccountId')
      .optional()
      .isString()
      .withMessage('ID de cuenta DDC debe ser una cadena de texto')
  ]),
  asyncErrorHandler(paymentController.initiateDirectPayment)
);

// Ruta para procesar una transacción de stablecoin recibida
// Esta ruta puede ser llamada por un webhook de blockchain, requiere API key
router.post(
  '/webhook/stablecoin',
  authenticateApiKey,
  validate([
    body('paymentId')
      .isString()
      .notEmpty()
      .withMessage('Se requiere ID de pago'),
    body('txHash')
      .isString()
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Hash de transacción inválido'),
    body('fromAddress')
      .isEthereumAddress()
      .withMessage('Dirección Ethereum inválida'),
    body('stablecoinAddress')
      .isEthereumAddress()
      .withMessage('Dirección de contrato de stablecoin inválida'),
    body('amount')
      .isString()
      .matches(/^[0-9]+(\.[0-9]+)?$/)
      .withMessage('Cantidad debe ser un número válido en formato string')
  ]),
  asyncErrorHandler(paymentController.processStablecoinTransaction)
);

// Ruta para obtener los detalles de un pago
// Requiere autenticación JWT
router.get(
  '/:id',
  authenticate,
  validate([
    param('id')
      .isUUID(4)
      .withMessage('ID de pago inválido')
  ]),
  asyncErrorHandler(paymentController.getPaymentDetails)
);

// Ruta para obtener los pagos de un usuario
// Requiere autenticación JWT
router.get(
  '/',
  authenticate,
  validate([
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite debe ser un entero entre 1 y 100')
      .toInt(),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset debe ser un entero positivo')
      .toInt()
  ]),
  asyncErrorHandler(paymentController.getUserPayments)
);

// Ruta para verificar el estado de un pago (para polling desde el frontend)
// Requiere autenticación JWT
router.get(
  '/:id/status',
  authenticate,
  validate([
    param('id')
      .isUUID(4)
      .withMessage('ID de pago inválido')
  ]),
  asyncErrorHandler(paymentController.checkPaymentStatus)
);

// Ruta para verificar el estado de teleport manualmente (solo administradores)
// Requiere autenticación JWT y rol de administrador
router.get(
  '/:id/teleport/:teleportTxId?',
  authenticate,
  requireRoles([UserRole.ADMIN]),
  validate([
    param('id')
      .isUUID(4)
      .withMessage('ID de pago inválido'),
    param('teleportTxId')
      .optional()
      .isString()
      .isLength({ min: 66, max: 66 })
      .withMessage('ID de teleport inválido')
  ]),
  asyncErrorHandler(paymentController.checkTeleport)
);

// Rutas para pagos fiat (stripe, on-ramp)
router.post('/fiat', paymentControllerInstance.initiateFiatPayment);
router.post('/webhook/fiat', paymentControllerInstance.processFiatWebhook);

// Rutas para integración con matrix-demo
router.post('/connect-wallet', paymentControllerInstance.connectWallet);
router.post('/swap-tokens', paymentControllerInstance.swapTokens);
router.post('/teleport', paymentControllerInstance.teleportTokens);
router.post('/verify-ddc', paymentControllerInstance.verifyDDCAccount);

export default router; 