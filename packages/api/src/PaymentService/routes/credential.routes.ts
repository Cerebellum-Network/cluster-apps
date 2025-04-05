/**
 * Rutas para la gestión de credenciales de servicios externos
 * Parte de la subtarea #4.2 - Implement Secure Credential Management for Stripe
 */

import { Router } from 'express';
import { body } from 'express-validator';
import credentialController from '../controllers/credential.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, asyncErrorHandler } from '../middlewares';
import { isAdmin } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas de credenciales requieren autenticación y rol de administrador
router.use(authenticate);
router.use(isAdmin);

// Ruta para verificar el estado de las credenciales de Stripe
router.get(
  '/stripe/verify',
  asyncErrorHandler(credentialController.verifyStripeCredentials)
);

// Ruta para actualizar las credenciales de Stripe
router.post(
  '/stripe/update',
  validate([
    body('secretKey')
      .optional()
      .isString()
      .withMessage('secretKey debe ser una cadena de texto'),
    body('webhookSecret')
      .optional()
      .isString()
      .withMessage('webhookSecret debe ser una cadena de texto')
  ]),
  asyncErrorHandler(credentialController.updateStripeCredentials)
);

// Ruta para obtener información de las credenciales
router.get(
  '/info',
  asyncErrorHandler(credentialController.getCredentialInfo)
);

export default router; 