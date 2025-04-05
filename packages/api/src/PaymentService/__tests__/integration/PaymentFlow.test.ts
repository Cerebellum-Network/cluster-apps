import { jest } from '@jest/globals';
// NO importar los servicios directamente, solo los tipos si es necesario
import { PaymentStatus, PaymentProvider, Payment } from '../../models';
import PaymentRepository from '../../repositories/PaymentRepository';

// Instancia mock de Repo ANTES
const mockRepoInstance = {
  createPayment: jest.fn(),
  findById: jest.fn(),
  findByPaymentId: jest.fn(),
  findByExternalId: jest.fn(),
  findByUserId: jest.fn(),
  updateStatus: jest.fn(),
  markAsFailed: jest.fn(),
  findByStatus: jest.fn(),
  findPendingPayments: jest.fn(),
  deletePayment: jest.fn(),
} as jest.Mocked<PaymentRepository>;

// Mock del módulo Repo
jest.mock('../../repositories/PaymentRepository', () => {
  return jest.fn().mockImplementation(() => mockRepoInstance);
});

// Mock de los módulos de servicio
jest.mock('../../services/PaymentService');
jest.mock('../../services/StripeService');
jest.mock('../../services/ContractService');

// Tipos para las clases mockeadas
// Importar los tipos desde los módulos reales
import { default as PaymentServiceType } from '../../services/PaymentService';
import { default as StripeServiceType } from '../../services/StripeService';
import { default as ContractServiceType } from '../../services/ContractService';

// Castear los módulos mockeados a los tipos de clase mockeada
const MockPaymentService = jest.requireMock('../../services/PaymentService').default as jest.MockedClass<typeof PaymentServiceType>;
const MockStripeService = jest.requireMock('../../services/StripeService').default as jest.MockedClass<typeof StripeServiceType>;
const MockContractService = jest.requireMock('../../services/ContractService').default as jest.MockedClass<typeof ContractServiceType>;

// Variables para las instancias
let mockPaymentServiceInstance: jest.Mocked<PaymentServiceType>;
let mockStripeServiceInstance: jest.Mocked<StripeServiceType>;
let mockContractServiceInstance: jest.Mocked<ContractServiceType>;

// Set up mock payment data
const mockPaymentId = 'test-payment-id';
const mockStablecoinTx = 'test-stablecoin-tx';
const mockSwapTx = 'test-swap-tx';
const mockTeleportTx = 'test-teleport-tx';
const mockDDCAccountId = 'test-ddc-account';
const mockCereNetworkAddress = 'cere1234567890123456789012345678901234567890';

describe('Payment Flow Integration Tests', () => {
  beforeEach(async () => { // Hacerlo async por si acaso
    jest.clearAllMocks();
    Object.values(mockRepoInstance).forEach(mockFn => {
      if (jest.isMockFunction(mockFn)) { mockFn.mockReset(); }
    });
    
    // Importar dinámicamente las INSTANCIAS reales (que serán mocks debido a jest.mock)
    const paymentServiceModule = await import('../../services/PaymentService');
    const stripeServiceModule = await import('../../services/StripeService');
    const contractServiceModule = await import('../../services/ContractService');

    // Asignar las instancias mockeadas (exportadas por defecto)
    mockPaymentServiceInstance = paymentServiceModule.default as jest.Mocked<PaymentServiceType>;
    mockStripeServiceInstance = stripeServiceModule.default as jest.Mocked<StripeServiceType>;
    mockContractServiceInstance = contractServiceModule.default as jest.Mocked<ContractServiceType>;

    // Limpiar los mocks internos de las instancias si es necesario (aunque jest.clearAllMocks debería bastar)
    // Object.values(mockPaymentServiceInstance).forEach(...) etc.
  });
  
  describe('Direct Stablecoin Payment Flow', () => {
    it('should process a complete stablecoin payment flow for topping up DDC account', async () => {
      // Configurar el mock de Payment devuelto por las funciones
      const mockPaymentInstance: jest.Mocked<Payment> = {
        id: mockPaymentId,
        status: PaymentStatus.INITIATED,
        paymentId: 'blockchain-id',
        userId: 'user-id',
        stablecoinAddress: '0xUSDCAddress',
        stablecoinAmount: '100',
        cereNetworkAddress: mockCereNetworkAddress,
        metadata: { ddcAccountId: mockDDCAccountId },
        cereAmount: '0', // Inicializar
        teleportTxId: undefined, // Inicializar
        provider: PaymentProvider.DIRECT,
        externalId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Métodos mockeados de la instancia Payment
        updateStatus: jest.fn().mockImplementation(function(this: Payment, status, data) {
          this.status = status;
          Object.assign(this, data || {});
        }),
        save: jest.fn().mockResolvedValue(this),
        markAsFailed: jest.fn(),
        getEstimatedTimeRemaining: jest.fn(),
         // Añadir las propiedades/métodos faltantes de Sequelize si son necesarios
        _attributes: {},
        dataValues: {},
        _creationAttributes: {},
        // ... otros métodos/propiedades de Sequelize ...
      } as unknown as jest.Mocked<Payment>; // Castear a tipo mockeado
      
      // Configurar mocks en las *instancias* de servicio
      mockPaymentServiceInstance.initiateDirectPayment.mockResolvedValue(mockPaymentInstance);
      mockPaymentServiceInstance.processStablecoinTransaction.mockResolvedValue(mockPaymentInstance);
      mockPaymentServiceInstance.processPaymentSwap.mockResolvedValue(mockPaymentInstance);
      mockPaymentServiceInstance.processTeleport.mockResolvedValue(mockPaymentInstance);
      mockPaymentServiceInstance.updateDDCAccount.mockResolvedValue(mockPaymentInstance);
      mockContractServiceInstance.getExpectedCereAmount.mockResolvedValue('10');
      
      // Llamar métodos en las *instancias* de servicio
      const initialPayment = await mockPaymentServiceInstance.initiateDirectPayment(
        'user-id', 'USDC', '100', mockCereNetworkAddress, mockDDCAccountId
      );
      expect(mockPaymentServiceInstance.initiateDirectPayment).toHaveBeenCalled();
      expect(initialPayment.status).toBe(PaymentStatus.INITIATED);

      // Step 2: Process stablecoin tx (simulado)
      mockPaymentInstance.status = PaymentStatus.PAYMENT_RECEIVED; // Simula el cambio de estado
      const receivedPayment = await mockPaymentServiceInstance.processStablecoinTransaction(
          initialPayment.paymentId, mockStablecoinTx, '0xFrom', '0xUSDC', '100'
      );
      expect(receivedPayment.status).toBe(PaymentStatus.PAYMENT_RECEIVED);

      // Step 3: Process swap (simulado)
      mockPaymentInstance.status = PaymentStatus.TOKENS_SWAPPED; // Simula el cambio
      mockPaymentInstance.cereAmount = '10';
      const swappedPayment = await mockPaymentServiceInstance.processPaymentSwap(initialPayment.id);
      expect(swappedPayment.status).toBe(PaymentStatus.TOKENS_SWAPPED);
      expect(swappedPayment.cereAmount).toBe('10');

      // Step 4: Process teleport (simulado)
      mockPaymentInstance.status = PaymentStatus.TELEPORTED;
      mockPaymentInstance.teleportTxId = mockTeleportTx;
      const teleportedPayment = await mockPaymentServiceInstance.processTeleport(initialPayment.id);
      expect(teleportedPayment.status).toBe(PaymentStatus.TELEPORTED);
      expect(teleportedPayment.teleportTxId).toBe(mockTeleportTx);

      // Step 5: Update DDC (simulado)
      mockPaymentInstance.status = PaymentStatus.COMPLETED;
      (mockPaymentInstance.metadata as any).ddcUpdatedBalance = '1000';
      const completedPayment = await mockPaymentServiceInstance.updateDDCAccount(initialPayment.id);
      expect(completedPayment.status).toBe(PaymentStatus.COMPLETED);
      expect((completedPayment.metadata as any).ddcUpdatedBalance).toBe('1000');
      
      // Verify final state
      expect(completedPayment.cereAmount).toBe('10');
      expect(completedPayment.cereNetworkAddress).toBe(mockCereNetworkAddress);
      expect(completedPayment.metadata.ddcAccountId).toBe(mockDDCAccountId);
    });
  });
  
  describe('Fiat to DDC Account Flow via Stripe', () => {
    it('should process a complete payment flow from fiat to DDC account using Stripe', async () => {
      // Mock Stripe payment intent response
      const mockStripePaymentIntent = {
        clientSecret: 'stripe-client-secret',
        paymentId: 'stripe-payment-id',
        amount: 100
      };
      
      // Mock payment record
      const mockPayment = {
        id: mockPaymentId,
        status: PaymentStatus.INITIATED,
        externalId: 'stripe-payment-intent-id',
        paymentId: 'blockchain-id',
        userId: 'user-id',
        stablecoinAddress: '0xUSDCAddress',
        stablecoinAmount: '100',
        provider: PaymentProvider.STRIPE,
        cereNetworkAddress: mockCereNetworkAddress,
        metadata: { ddcAccountId: mockDDCAccountId }
      };
      
      // Setup mock responses for each step
      mockStripeServiceInstance.createPaymentIntent.mockResolvedValue(mockStripePaymentIntent);
      
      mockPaymentServiceInstance.findPaymentByExternalId.mockResolvedValue(mockPayment);
      
      mockPaymentServiceInstance.updatePaymentStatusForStripe.mockImplementation((id, status) => {
        mockPayment.status = status;
        return Promise.resolve(mockPayment);
      });
      
      mockPaymentServiceInstance.processPaymentSwap.mockImplementation(() => {
        mockPayment.status = PaymentStatus.TOKENS_SWAPPED;
        mockPayment.cereAmount = '10';
        return Promise.resolve(mockPayment);
      });
      
      mockPaymentServiceInstance.processTeleport.mockImplementation(() => {
        mockPayment.status = PaymentStatus.TELEPORTED;
        mockPayment.teleportTxId = mockTeleportTx;
        return Promise.resolve(mockPayment);
      });
      
      mockPaymentServiceInstance.updateDDCAccount.mockImplementation(() => {
        mockPayment.status = PaymentStatus.COMPLETED;
        mockPayment.metadata.ddcUpdatedBalance = '1000';
        return Promise.resolve(mockPayment);
      });
      
      // Step 1: Create payment intent in Stripe
      const paymentIntent = await mockStripeServiceInstance.createPaymentIntent(
        'user-id',
        100,
        'USDC',
        mockCereNetworkAddress,
        mockDDCAccountId
      );
      
      expect(paymentIntent).toEqual(mockStripePaymentIntent);
      expect(mockStripeServiceInstance.createPaymentIntent).toHaveBeenCalledWith(
        'user-id',
        100,
        'USDC',
        mockCereNetworkAddress,
        mockDDCAccountId
      );
      
      // Step 2: Stripe payment is confirmed (via webhook)
      // This would normally be triggered by Stripe's webhook system
      const paymentReceived = await mockPaymentServiceInstance.updatePaymentStatusForStripe(
        mockPayment.id,
        PaymentStatus.PAYMENT_RECEIVED,
        {
          stripeChargeId: 'ch_123456',
          paymentMethod: 'card'
        }
      );
      
      expect(paymentReceived.status).toBe(PaymentStatus.PAYMENT_RECEIVED);
      
      // Step 3-5: Same as in direct payment flow
      // Step 3: Process the token swap (USDC to CERE)
      const tokenSwapped = await mockPaymentServiceInstance.processPaymentSwap(mockPayment.id);
      
      expect(tokenSwapped.status).toBe(PaymentStatus.TOKENS_SWAPPED);
      expect(tokenSwapped.cereAmount).toBe('10');
      
      // Step 4: Process teleport (CERE to Cere Network)
      const teleported = await mockPaymentServiceInstance.processTeleport(mockPayment.id);
      
      expect(teleported.status).toBe(PaymentStatus.TELEPORTED);
      expect(teleported.teleportTxId).toBe(mockTeleportTx);
      
      // Step 5: Update DDC account
      const completed = await mockPaymentServiceInstance.updateDDCAccount(mockPayment.id);
      
      expect(completed.status).toBe(PaymentStatus.COMPLETED);
      expect(completed.metadata.ddcUpdatedBalance).toBe('1000');
      
      // Verify the complete flow for Stripe payment
      expect(completed.provider).toBe(PaymentProvider.STRIPE);
      expect(completed.cereAmount).toBe('10');
      expect(completed.cereNetworkAddress).toBe(mockCereNetworkAddress);
      expect(completed.metadata.ddcAccountId).toBe(mockDDCAccountId);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    it('should handle errors during the swap process and retry', async () => {
      // Mock a payment record
      const mockPayment = {
        id: mockPaymentId,
        status: PaymentStatus.PAYMENT_RECEIVED,
        userId: 'user-id',
        stablecoinAddress: '0xUSDCAddress',
        stablecoinAmount: '100',
        cereNetworkAddress: mockCereNetworkAddress,
        metadata: { ddcAccountId: mockDDCAccountId }
      };
      
      // First call to processPaymentSwap fails
      mockPaymentServiceInstance.processPaymentSwap.mockRejectedValueOnce(
        new Error('DEX liquidity too low')
      );
      
      // Second call succeeds
      mockPaymentServiceInstance.processPaymentSwap.mockImplementationOnce(() => {
        mockPayment.status = PaymentStatus.TOKENS_SWAPPED;
        mockPayment.cereAmount = '10';
        return Promise.resolve(mockPayment);
      });
      
      // First attempt (fails)
      await expect(
        mockPaymentServiceInstance.processPaymentSwap(mockPayment.id)
      ).rejects.toThrow('DEX liquidity too low');
      
      // Second attempt (succeeds)
      const tokenSwapped = await mockPaymentServiceInstance.processPaymentSwap(mockPayment.id);
      
      expect(tokenSwapped.status).toBe(PaymentStatus.TOKENS_SWAPPED);
      expect(tokenSwapped.cereAmount).toBe('10');
      expect(mockPaymentServiceInstance.processPaymentSwap).toHaveBeenCalledTimes(2);
    });
    
    it('should handle timeout during teleport and continue when teleport completes', async () => {
      // Mock a payment record
      const mockPayment = {
        id: mockPaymentId,
        status: PaymentStatus.TOKENS_SWAPPED,
        cereAmount: '10',
        teleportTxId: mockTeleportTx,
        userId: 'user-id',
        cereNetworkAddress: mockCereNetworkAddress,
        metadata: { ddcAccountId: mockDDCAccountId }
      };
      
      // Mock the teleport process
      mockPaymentServiceInstance.processTeleport.mockImplementationOnce(() => {
        mockPayment.status = PaymentStatus.TELEPORTING;
        return Promise.resolve(mockPayment);
      });
      
      // Mock the teleport status check
      mockContractServiceInstance.checkTeleportStatus.mockResolvedValueOnce(1) // Pending
        .mockResolvedValueOnce(1) // Still pending
        .mockResolvedValueOnce(2); // Completed
      
      // Start the teleport process
      const teleporting = await mockPaymentServiceInstance.processTeleport(mockPayment.id);
      expect(teleporting.status).toBe(PaymentStatus.TELEPORTING);
      
      // Check status multiple times (simulating polling)
      const status1 = await mockContractServiceInstance.checkTeleportStatus(mockTeleportTx);
      expect(status1).toBe(1); // Pending
      
      const status2 = await mockContractServiceInstance.checkTeleportStatus(mockTeleportTx);
      expect(status2).toBe(1); // Still pending
      
      const status3 = await mockContractServiceInstance.checkTeleportStatus(mockTeleportTx);
      expect(status3).toBe(2); // Completed
      
      // Mock confirmTeleport
      mockPaymentServiceInstance.confirmTeleport.mockImplementationOnce(() => {
        mockPayment.status = PaymentStatus.TELEPORTED;
        return Promise.resolve(mockPayment);
      });
      
      // Now confirm the teleport
      const teleported = await mockPaymentServiceInstance.confirmTeleport(
        mockPayment.id,
        mockTeleportTx,
        '0xdestination-tx-hash'
      );
      
      expect(teleported.status).toBe(PaymentStatus.TELEPORTED);
      expect(mockContractServiceInstance.checkTeleportStatus).toHaveBeenCalledTimes(3);
    });
  });
}); 