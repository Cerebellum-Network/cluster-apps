import { Router } from 'express';
import authRoutes from './auth.routes';
import paymentRoutes from './payment.routes';
import stripeRoutes from './stripe.routes';
import credentialRoutes from './credential.routes';
import reconciliationRoutes from './reconciliation.routes';

const router = Router();

// Montar rutas de autenticación en /auth
router.use('/auth', authRoutes);

// Montar rutas de pagos en /payments
router.use('/payments', paymentRoutes);

// Montar rutas de Stripe en /stripe
router.use('/stripe', stripeRoutes);

// Rutas de gestión de credenciales (requieren rol de administrador)
router.use('/credentials', credentialRoutes);

// Rutas para la reconciliación de transacciones
router.use('/reconciliation', reconciliationRoutes);

export default router; 