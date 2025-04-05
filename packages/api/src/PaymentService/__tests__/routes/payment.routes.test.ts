import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import paymentRoutes from '../../routes/payment.routes';
import paymentController from '../../controllers/payment.controller';
import * as auth from '../../middlewares/auth.middleware';

// Mock de express-validator con chain completo y función run
jest.mock('express-validator', () => {
  const actualValidator = jest.requireActual('express-validator');
  const chainable = {
    isString: jest.fn().mockReturnThis(),
    notEmpty: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    matches: jest.fn().mockReturnThis(),
    isEthereumAddress: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isFloat: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    isUUID: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis(),
    toInt: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    // Mockear la función run para que simplemente resuelva
    run: jest.fn().mockResolvedValue(undefined), 
  };
  return {
    ...actualValidator,
    body: jest.fn().mockReturnValue(chainable),
    param: jest.fn().mockReturnValue(chainable),
    query: jest.fn().mockReturnValue(chainable),
    validationResult: jest.fn().mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    })
  }
});

// Mock de autenticación con tipos explícitos
jest.mock('../../middlewares/auth.middleware', () => ({
  authenticate: jest.fn((req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { id: 'test-user-id', isAdmin: false }; // Usar any para extender Request
    next();
  }),
  authenticateApiKey: jest.fn((req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { id: 'api-user-id', isAdmin: false };
    next();
  }),
  requireRoles: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).user?.isAdmin) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied' });
    }
  })
}));

// Mock de controladores con tipos explícitos
jest.mock('../../controllers/payment.controller', () => ({
  initiateDirectPayment: jest.fn((req: Request, res: Response) => {
    res.status(201).json({ 
      success: true, 
      payment: { id: 'test-payment-id' } 
    });
  }),
  processStablecoinTransaction: jest.fn((req: Request, res: Response) => {
    res.status(200).json({ 
      success: true, 
      message: 'Transaction processed' 
    });
  }),
  getPaymentDetails: jest.fn((req: Request, res: Response) => {
    res.status(200).json({ 
      success: true, 
      payment: { id: (req.params as any).id } 
    });
  }),
  getUserPayments: jest.fn((req: Request, res: Response) => {
    res.status(200).json({ 
      success: true, 
      payments: [{ id: 'payment-1' }, { id: 'payment-2' }] 
    });
  }),
  checkPaymentStatus: jest.fn((req: Request, res: Response) => {
    res.status(200).json({ 
      success: true, 
      status: { 
        id: (req.params as any).id, 
        status: 'PAYMENT_RECEIVED' 
      } 
    });
  }),
  checkTeleport: jest.fn((req: Request, res: Response) => {
    res.status(200).json({ 
      success: true, 
      teleportStatus: 2, 
      paymentStatus: 'TELEPORTING' 
    });
  })
}));

// Aplicación de express para testing
const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);

describe('Payment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payments/direct', () => {
    it('debe iniciar un pago directo exitosamente', async () => {
      const response = await request(app)
        .post('/api/payments/direct')
        .send({
          stablecoinSymbol: 'USDC',
          amount: '100',
          cereNetworkAddress: 'cere1234567890123456789012345678901234567890',
          ddcAccountId: 'test-ddc-account'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.payment).toBeDefined();
      expect(auth.authenticate).toHaveBeenCalled();
      expect(paymentController.initiateDirectPayment).toHaveBeenCalled();
    });
  });

  describe('POST /api/payments/webhook/stablecoin', () => {
    it('debe procesar una transacción de stablecoin exitosamente', async () => {
      const response = await request(app)
        .post('/api/payments/webhook/stablecoin')
        .send({
          paymentId: 'test-payment-id',
          txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          fromAddress: '0x1234567890123456789012345678901234567890',
          stablecoinAddress: '0x1234567890123456789012345678901234567890',
          amount: '100'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(auth.authenticateApiKey).toHaveBeenCalled();
      expect(paymentController.processStablecoinTransaction).toHaveBeenCalled();
    });
  });

  describe('GET /api/payments/:id', () => {
    it('debe obtener los detalles de un pago exitosamente', async () => {
      const response = await request(app)
        .get('/api/payments/test-payment-id');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payment).toBeDefined();
      expect(auth.authenticate).toHaveBeenCalled();
      expect(paymentController.getPaymentDetails).toHaveBeenCalled();
    });
  });

  describe('GET /api/payments', () => {
    it('debe obtener los pagos de un usuario exitosamente', async () => {
      const response = await request(app)
        .get('/api/payments')
        .query({ limit: 10, offset: 0 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payments).toBeDefined();
      expect(response.body.payments.length).toBe(2);
      expect(auth.authenticate).toHaveBeenCalled();
      expect(paymentController.getUserPayments).toHaveBeenCalled();
    });
  });

  describe('GET /api/payments/:id/status', () => {
    it('debe verificar el estado de un pago exitosamente', async () => {
      const response = await request(app)
        .get('/api/payments/test-payment-id/status');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(auth.authenticate).toHaveBeenCalled();
      expect(paymentController.checkPaymentStatus).toHaveBeenCalled();
    });
  });

  describe('GET /api/payments/:id/teleport/:teleportTxId', () => {
    it('debe permitir a un admin verificar el estado de teleport', async () => {
      // Hacer que el usuario sea admin
      (auth.authenticate as jest.Mock).mockImplementationOnce((req, res, next) => {
        req.user = { id: 'admin-user-id', isAdmin: true };
        next();
      });

      const response = await request(app)
        .get('/api/payments/test-payment-id/teleport/test-teleport-id');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(auth.authenticate).toHaveBeenCalled();
      expect(paymentController.checkTeleport).toHaveBeenCalled();
    });

    it('debe denegar acceso a un usuario no admin', async () => {
      const response = await request(app)
        .get('/api/payments/test-payment-id/teleport/test-teleport-id');
      
      expect(response.status).toBe(403);
      expect(auth.authenticate).toHaveBeenCalled();
      expect(paymentController.checkTeleport).not.toHaveBeenCalled();
    });
  });
}); 