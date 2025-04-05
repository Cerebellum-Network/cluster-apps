import { Router } from 'express';
import { body } from 'express-validator';
import stripeController from '../controllers/stripe.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, asyncErrorHandler } from '../middlewares';
import express from 'express';

const router = Router();

// Ruta para crear un payment intent (iniciar pago)
// Requiere autenticación JWT
router.post(
  '/create-payment-intent',
  authenticate,
  validate([
    body('amountUsd')
      .isFloat({ min: 1 })
      .withMessage('La cantidad en USD debe ser un número positivo mayor a 1'),
    body('stablecoinSymbol')
      .isIn(['USDC', 'USDT'])
      .withMessage('Stablecoin no soportada'),
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
  asyncErrorHandler(stripeController.createPaymentIntent)
);

// Ruta para el webhook de Stripe
// No requiere autenticación, usa la firma de Stripe para validar
// Necesitamos el raw body para verificar la firma
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncErrorHandler(stripeController.webhook)
);

export default router; 