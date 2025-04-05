import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import { authenticate } from '../middlewares';

const router = Router();

// Ruta de login
router.post('/login', AuthController.login);

// Ruta de registro
router.post('/register', AuthController.register);

// Ruta para obtener perfil del usuario actual (requiere autenticación)
router.get('/me', authenticate, AuthController.getProfile);

export default router; 