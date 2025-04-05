import { jest } from '@jest/globals';
import { Model } from 'sequelize';
import PaymentRepository from '../../repositories/PaymentRepository';
import { default as ContractServiceInstanceType } from '../../services/ContractService';
import { PaymentStatus, PaymentProvider, Payment, StablecoinTransaction, SwapTransaction, TeleportTransaction, DDCAccountUpdate } from '../../models';
import * as envConfig from '../../config/env'; 

// 1. Mock de Constantes de Entorno (ANTES de importar servicios)
jest.mock('../../config/env', () => ({
  ...jest.requireActual('../../config/env'),
  SUPPORTED_STABLECOINS: {
    'USDC': '0xMockUSDCAddress',
    'USDT': '0xMockUSDTAddress'
  }
}));

// 2. Mock del Repositorio (Instancia definida ANTES)
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
jest.mock('../../repositories/PaymentRepository', () => {
  return jest.fn().mockImplementation(() => mockRepoInstance);
});

// 3. Mock explicit de ContractService usando una factory function
jest.mock('../../services/ContractService', () => {
  // Devolver un objeto que simula la *instancia* del servicio
  // con todos sus métodos como jest.fn()
  return {
    // Simula la exportación 'default' si es una clase o un objeto
    default: {
      getExpectedCereAmount: jest.fn(),
      processStablecoinTransaction: jest.fn(), // Asegúrate de que este método exista en la clase real
      swapTokens: jest.fn(),
      teleportTokens: jest.fn(),
      checkTeleportStatus: jest.fn(),
      getCereBalance: jest.fn(), // Asegúrate de que este método exista
      updateDDCAccountBalance: jest.fn(), // Asegúrate de que este método exista
      // Agrega cualquier otro método público de ContractService aquí
    }
    // Si ContractService se exporta como un objeto directamente (no una clase)
    // podrías necesitar ajustar esto para que coincida con la estructura de exportación.
  };
});

// 4. Mock de Sequelize Model.init y transaction
jest.mock('sequelize', () => {
  const actualSequelize = jest.requireActual('sequelize');
  return {
    ...actualSequelize,
    Model: class MockModel extends actualSequelize.Model {
      static init = jest.fn();
      static associate = jest.fn();
      static create = jest.fn();
      static findByPk = jest.fn();
      static findOne = jest.fn();
      static findAll = jest.fn();
      save = jest.fn().mockResolvedValue(this);
      destroy = jest.fn().mockResolvedValue(undefined);
      update = jest.fn().mockResolvedValue(this);
    },
    Sequelize: jest.fn(() => ({
      transaction: jest.fn().mockResolvedValue({
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      }),
    })),
  };
});

// 5. Mock explícito para ethers.JsonRpcProvider para evitar llamadas reales
jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers');
  return {
    ...actualEthers,
    ethers: {
      ...actualEthers.ethers,
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
          getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
          getGasPrice: jest.fn().mockResolvedValue('20000000000'),
      })),
      Wallet: actualEthers.ethers.Wallet,
      Contract: actualEthers.ethers.Contract,
      parseUnits: actualEthers.ethers.parseUnits,
      formatUnits: actualEthers.ethers.formatUnits,
    }
  };
});

// Tipos necesarios para ContractService mockeado
type MockedContractServiceInstance = jest.Mocked<typeof ContractServiceInstanceType>;

describe('PaymentService', () => {
  let paymentServiceInstance: import('../../services/PaymentService').default;
  let mockContractService: MockedContractServiceInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.values(mockRepoInstance).forEach(mockFn => {
      if (jest.isMockFunction(mockFn)) { mockFn.mockReset(); }
    });

    const PaymentServiceModule = await import('../../services/PaymentService');
    const contractServiceModule = await import('../../services/ContractService');
    paymentServiceInstance = PaymentServiceModule.default;
    mockContractService = contractServiceModule.default as MockedContractServiceInstance;

    if (mockContractService && typeof mockContractService === 'object') {
      mockContractService.getExpectedCereAmount = jest.fn();
      mockContractService.processStablecoinTransaction = jest.fn();
      mockContractService.swapTokens = jest.fn();
      mockContractService.teleportTokens = jest.fn();
      mockContractService.checkTeleportStatus = jest.fn();
      mockContractService.getCereBalance = jest.fn();
      mockContractService.updateDDCAccountBalance = jest.fn();

      Object.keys(mockContractService).forEach(key => {
         const method = mockContractService[key as keyof MockedContractServiceInstance];
         if (jest.isMockFunction(method)) { method.mockReset(); }
      });
    } else {
       console.warn('mockContractService is not an object, initializing manually. Check ContractService export.');
       mockContractService = {
         getExpectedCereAmount: jest.fn(),
         processStablecoinTransaction: jest.fn(),
         swapTokens: jest.fn(),
         teleportTokens: jest.fn(),
         checkTeleportStatus: jest.fn(),
         getCereBalance: jest.fn(),
         updateDDCAccountBalance: jest.fn(),
       } as unknown as MockedContractServiceInstance;
    }
    
    (Payment.init as jest.Mock).mockClear();
    (Payment.create as jest.Mock).mockClear();
    (Payment.findByPk as jest.Mock).mockClear();
    (Payment.findOne as jest.Mock).mockClear();
    (Payment.findAll as jest.Mock).mockClear();
    (StablecoinTransaction.create as jest.Mock).mockClear();
    (SwapTransaction.create as jest.Mock).mockClear();
    (TeleportTransaction.create as jest.Mock).mockClear();
    (TeleportTransaction.findOne as jest.Mock).mockClear(); 
    (DDCAccountUpdate.create as jest.Mock).mockClear();
  });

  describe('initiateDirectPayment', () => {
    it('should initiate a stablecoin payment correctly', async () => {
      const mockPaymentData = {
        id: 'test-payment-id',
        status: PaymentStatus.INITIATED,
        paymentId: 'test-blockchain-id',
        userId: 'test-user-id',
        stablecoinAddress: '0xUSDCAddress',
        stablecoinAmount: '100',
        cereNetworkAddress: 'cereNetworkAddress',
        provider: 'DIRECT',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepoInstance.createPayment.mockResolvedValue(mockPaymentData as Payment);
      if (mockContractService?.getExpectedCereAmount) {
         (mockContractService.getExpectedCereAmount as jest.Mock).mockResolvedValue('10');
      } else {
         console.warn("mockContractService.getExpectedCereAmount no está disponible para mockear");
      }

      const result = await paymentServiceInstance.initiateDirectPayment(
        'test-user-id',
        'USDC',
        '100',
        'cereNetworkAddress'
      );

      expect(mockRepoInstance.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          stablecoinAddress: '0xMockUSDCAddress',
          stablecoinAmount: '100',
          cereNetworkAddress: 'cereNetworkAddress'
        })
      );
      expect(mockContractService.getExpectedCereAmount).toHaveBeenCalledWith('USDC', '100');
      expect(result).toMatchObject({
        id: 'test-payment-id',
        status: PaymentStatus.INITIATED,
        userId: 'test-user-id',
      });
    });

    it('should throw an error if stablecoin is not supported', async () => {
      await expect(
        paymentServiceInstance.initiateDirectPayment(
          'test-user-id',
          'INVALID',
          '100',
          'cereNetworkAddress'
        )
      ).rejects.toThrow('Stablecoin INVALID no soportada');
    });
  });

  describe('processStablecoinTransaction', () => {
    it('should process a stablecoin transaction correctly', async () => {
      const mockPaymentData = { 
        id: 'test-payment-id', 
        status: PaymentStatus.INITIATED,
        stablecoinAddress: '0xMockUSDCAddress', 
      } as Payment;
      
      mockRepoInstance.findByPaymentId.mockResolvedValue(mockPaymentData);
      (StablecoinTransaction.create as jest.Mock).mockResolvedValue({ id: 'stable-tx-id' });

      await paymentServiceInstance.processStablecoinTransaction('payment-id', 'hash', 'from', '0xMockUSDCAddress', '100');

      expect(mockRepoInstance.findByPaymentId).toHaveBeenCalledWith('payment-id', true);
      expect(StablecoinTransaction.create).toHaveBeenCalled();
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.PAYMENT_RECEIVED, expect.any(Object), expect.any(Object)); 
    });

    it('should warn if payment is not found', async () => {
        mockRepoInstance.findByPaymentId.mockResolvedValue(null);
        await paymentServiceInstance.processStablecoinTransaction('non-existent', 'hash', 'from', 'token', '100');
        expect(mockRepoInstance.findByPaymentId).toHaveBeenCalledWith('non-existent', true);
        expect(StablecoinTransaction.create).not.toHaveBeenCalled();
        expect(mockRepoInstance.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('processPaymentSwap', () => {
    it('should process a token swap correctly (USDC to CERE)', async () => {
      const mockPaymentData = { 
         id: 'test-payment-id', 
         status: PaymentStatus.PAYMENT_RECEIVED, 
         stablecoinSymbol: 'USDC', 
         stablecoinAmount: '100',
         metadata: {
           stablecoinSymbol: 'USDC'
         }
      } as Payment; 

      mockRepoInstance.findById.mockResolvedValue(mockPaymentData);
      (mockContractService.swapTokens as jest.Mock).mockResolvedValue('10'); 
      (SwapTransaction.create as jest.Mock).mockResolvedValue({ id: 'swap-tx-id' });
      
      await paymentServiceInstance.processPaymentSwap('test-payment-id');

      expect(mockRepoInstance.findById).toHaveBeenCalledWith('test-payment-id');
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.SWAPPING_TOKENS, {}, expect.any(Object));
      expect(mockContractService.swapTokens).toHaveBeenCalledWith('USDC', '100'); 
      expect(SwapTransaction.create).toHaveBeenCalled();
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.TOKENS_SWAPPED, expect.objectContaining({ swapTxHash: expect.any(String), cereAmount: '10' }), expect.any(Object));
    });

    it('should reject if payment is not in PAYMENT_RECEIVED state', async () => {
      const mockPaymentData = { 
         id: 'test-payment-id', 
         status: PaymentStatus.INITIATED,
         stablecoinSymbol: 'USDC', 
         stablecoinAmount: '100',
      } as Payment;
      mockRepoInstance.findById.mockResolvedValue(mockPaymentData);

      await expect(paymentServiceInstance.processPaymentSwap('test-payment-id'))
        .rejects.toThrow(/Estado incorrecto para swap/);
      expect(mockContractService.swapTokens).not.toHaveBeenCalled();
      expect(mockRepoInstance.updateStatus).not.toHaveBeenCalledWith(expect.anything(), PaymentStatus.SWAPPING_TOKENS, expect.anything(), expect.anything());
      expect(mockRepoInstance.updateStatus).not.toHaveBeenCalledWith(expect.anything(), PaymentStatus.TOKENS_SWAPPED, expect.anything(), expect.anything());
    });
  });

  describe('processTeleport', () => {
    it('should process a token teleportation to Cere Network correctly', async () => {
      const mockPaymentData = { 
        id: 'test-payment-id', 
        status: PaymentStatus.TOKENS_SWAPPED, 
        cereAmount: '10',
        cereNetworkAddress: 'cere123',
      } as Payment;

      mockRepoInstance.findById.mockResolvedValue(mockPaymentData);
      (mockContractService.teleportTokens as jest.Mock).mockResolvedValue('teleport-tx-id');
      (TeleportTransaction.create as jest.Mock).mockResolvedValue({ id: 'teleport-record-id' });

      await paymentServiceInstance.processTeleport('test-payment-id');

      expect(mockRepoInstance.findById).toHaveBeenCalledWith('test-payment-id');
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.TELEPORTING, {}, expect.any(Object));
      expect(mockContractService.teleportTokens).toHaveBeenCalledWith('10', 'cere123');
      expect(TeleportTransaction.create).toHaveBeenCalled();
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.TELEPORT_INITIATED, expect.objectContaining({ teleportTxId: 'teleport-tx-id' }), expect.any(Object));
    });
  });

  describe('confirmTeleport', () => {
    const mockTeleportTxInstance = {
      id: 'teleport-record-id',
      status: 'PENDING',
      save: jest.fn().mockResolvedValue(this),
    } as unknown as TeleportTransaction;

    it('should confirm successful teleportation of CERE tokens', async () => {
      mockRepoInstance.findById.mockResolvedValue({ 
        id: 'test-payment-id',
        status: PaymentStatus.TELEPORT_INITIATED 
      } as Payment);
      (TeleportTransaction.findOne as jest.Mock).mockResolvedValue(mockTeleportTxInstance);
      (mockContractService.checkTeleportStatus as jest.Mock).mockResolvedValue(2);

      await paymentServiceInstance.confirmTeleport('test-payment-id', 'teleport-tx-id', '0xdestinationTxHash');

      expect(mockRepoInstance.findById).toHaveBeenCalledWith('test-payment-id');
      expect(TeleportTransaction.findOne).toHaveBeenCalledWith({ 
        where: { paymentId: 'test-payment-id', teleportTxId: 'teleport-tx-id' },
        transaction: expect.anything() 
      });
      expect(mockTeleportTxInstance.save).toHaveBeenCalled();
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith('test-payment-id', PaymentStatus.TELEPORT_CONFIRMED, expect.objectContaining({ destinationTxHash: '0xdestinationTxHash' }), expect.any(Object));
    });
  });

  describe('updateDDCAccount', () => {
    it('should update DDC account balance correctly with teleported CERE tokens', async () => {
       const mockPaymentData = { 
         id: 'test-payment-id', 
         status: PaymentStatus.TELEPORT_CONFIRMED, 
         cereAmount: '10',
         cereNetworkAddress: '5EXAMPLEADDRESS'
       } as Payment;

      mockRepoInstance.findById.mockResolvedValue(mockPaymentData);
      (mockContractService.getCereBalance as jest.Mock).mockResolvedValue('15');
      (mockContractService.updateDDCAccountBalance as jest.Mock).mockResolvedValue('15');
      (DDCAccountUpdate.create as jest.Mock).mockResolvedValue({ id: 'ddc-update-id' });

      await paymentServiceInstance.updateDDCAccount('test-payment-id');

      expect(mockRepoInstance.findById).toHaveBeenCalledWith('test-payment-id');
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.UPDATING_DDC, {}, expect.any(Object));
      expect(mockContractService.getCereBalance).toHaveBeenCalledWith('5EXAMPLEADDRESS');
      expect(mockContractService.updateDDCAccountBalance).toHaveBeenCalledWith('5EXAMPLEADDRESS', '10');
      expect(DDCAccountUpdate.create).toHaveBeenCalled();
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.COMPLETED, expect.objectContaining({ finalCereBalance: '15' }), expect.any(Object));
    });

    it('should fail if no DDC account ID is provided', async () => {
      const mockPaymentData = { 
        id: 'test-payment-id', 
        status: PaymentStatus.TELEPORT_CONFIRMED, 
        cereAmount: '10',
        cereNetworkAddress: null
      } as Payment;
      mockRepoInstance.findById.mockResolvedValue(mockPaymentData);

      await expect(paymentServiceInstance.updateDDCAccount('test-payment-id'))
        .rejects.toThrow('DDC Account ID (cereNetworkAddress) no encontrado');
      expect(mockRepoInstance.updateStatus).not.toHaveBeenCalledWith(mockPaymentData.id, PaymentStatus.UPDATING_DDC, expect.anything(), expect.anything());
    });
  });

  describe('initiateStripePayment', () => {
    const mockStripeInstance = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({ id: 'pi_test_stripe', client_secret: 'cs_test' }),
      },
    };
    
    beforeEach(() => {
      // Reset Stripe mock
      mockStripeInstance.paymentIntents.create.mockClear();
    });

    it('should initiate a fiat payment via Stripe correctly', async () => {
      const mockPayment = {
        id: 'stripe-payment-id',
        userId: 'user-stripe',
        provider: PaymentProvider.STRIPE,
        externalPaymentId: 'pi_test_stripe',
        status: PaymentStatus.INITIATED,
        metadata: { 
          client_secret: 'cs_test',
          stablecoinSymbol: 'USDC' 
        },
        stablecoinSymbol: 'USDC',
        stablecoinAmount: '50',
        cereNetworkAddress: 'cere1stripe'
      } as Payment;
      
      mockRepoInstance.createPayment.mockResolvedValue(mockPayment);
      (mockContractService.getExpectedCereAmount as jest.Mock).mockResolvedValue('10');

      const result = await paymentServiceInstance.initiateStripePayment(
        'user-stripe',        // userId
        'pi_test_stripe',     // externalId
        'USDC',               // stablecoinSymbol
        '50',                 // amount
        'cere1stripe',        // cereNetworkAddress
        undefined,            // ddcAccountId (opcional)
        { payment_method: 'pm_card_visa' } // metadata
      );

      expect(mockRepoInstance.createPayment).toHaveBeenCalledWith(expect.objectContaining({ 
        userId: 'user-stripe', 
        externalId: 'pi_test_stripe',
        stablecoinAmount: '50',
        cereNetworkAddress: 'cere1stripe',
        provider: PaymentProvider.STRIPE,
        metadata: expect.objectContaining({ 
          stablecoinSymbol: 'USDC',
          payment_method: 'pm_card_visa' 
        })
      }));
      
      expect(result).toMatchObject({ 
        id: 'stripe-payment-id', 
        status: PaymentStatus.INITIATED
      });
    });
  });

  describe('findPaymentByExternalId', () => {
    it('should find a payment by external ID (e.g., Stripe payment)', async () => {
      const mockPayment = { id: 'found-payment' } as Payment;
      mockRepoInstance.findByExternalId.mockResolvedValue(mockPayment);

      const result = await paymentServiceInstance.findPaymentByExternalId('pi_123');

      expect(mockRepoInstance.findByExternalId).toHaveBeenCalledWith('pi_123');
      expect(result).toEqual(mockPayment);
    });
  });

  describe('end-to-end payment flow', () => {
    it('should process a complete payment flow from fiat to DDC account update', async () => {
      // Simulate Stripe Initiation
      const initialPaymentData = { 
        id: 'e2e-payment', 
        status: PaymentStatus.INITIATED, 
        externalPaymentId: 'pi_e2e', 
        userId: 'e2e-user', 
        cereNetworkAddress: 'cere1e2e',
        metadata: {
          stablecoinSymbol: 'USDC'
        }
      } as Payment;
      
      mockRepoInstance.createPayment.mockResolvedValue(initialPaymentData);
      (mockContractService.getExpectedCereAmount as jest.Mock).mockResolvedValue('50');
      const stripeResult = await paymentServiceInstance.initiateStripePayment(
        'e2e-user',
        'pi_e2e',
        'USDC',
        '50',
        'cere1e2e'
      );

      // Simulate Stripe Webhook confirmation -> processStablecoinTransaction equivalent
      const paymentAfterStripe = { 
        ...initialPaymentData, 
        status: PaymentStatus.PAYMENT_RECEIVED, 
        stablecoinSymbol: 'USDC', 
        stablecoinAmount: '50',
        metadata: {
          ...initialPaymentData.metadata,
          stablecoinSymbol: 'USDC'
        }
      };
      
      // Reset mocks to ensure proper chaining
      mockRepoInstance.findByExternalId.mockReset();
      mockRepoInstance.findById.mockReset();
      
      mockRepoInstance.findByExternalId.mockResolvedValue(paymentAfterStripe);
      mockRepoInstance.findById.mockResolvedValue(paymentAfterStripe);
      
      await paymentServiceInstance.processStablecoinTransaction('pi_e2e', 'stripe_tx_confirm', 'stripe_gw', '0xMockUSDCAddress', '50');

      // Setup for processPaymentSwap
      const paymentAfterStablecoin = { 
        ...paymentAfterStripe, 
        status: PaymentStatus.PAYMENT_RECEIVED,
        metadata: {
          ...paymentAfterStripe.metadata,
          stablecoinSymbol: 'USDC'
        }
      };
      
      mockRepoInstance.findById.mockReset();
      mockRepoInstance.findById.mockResolvedValue(paymentAfterStablecoin);
      
      (mockContractService.swapTokens as jest.Mock).mockResolvedValue('50');
      (SwapTransaction.create as jest.Mock).mockResolvedValue({ id: 'e2e-swap-tx' });
      
      await paymentServiceInstance.processPaymentSwap('e2e-payment');

      // Setup for processTeleport
      const paymentAfterSwap = { 
        ...paymentAfterStablecoin, 
        status: PaymentStatus.TOKENS_SWAPPED, 
        cereAmount: '50',
        metadata: {
          ...paymentAfterStablecoin.metadata,
          stablecoinSymbol: 'USDC'
        }
      };
      
      mockRepoInstance.findById.mockReset();
      mockRepoInstance.findById.mockResolvedValue(paymentAfterSwap);
      
      (mockContractService.teleportTokens as jest.Mock).mockResolvedValue('e2e-teleport-tx');
      (TeleportTransaction.create as jest.Mock).mockResolvedValue({ id: 'e2e-teleport-record' });
      
      await paymentServiceInstance.processTeleport('e2e-payment');

      // Setup for confirmTeleport
      const paymentAfterTeleportInit = { 
        ...paymentAfterSwap, 
        status: PaymentStatus.TELEPORT_INITIATED,
        metadata: {
          ...paymentAfterSwap.metadata,
          stablecoinSymbol: 'USDC'
        }
      };
      
      mockRepoInstance.findById.mockReset();
      mockRepoInstance.findById.mockResolvedValue(paymentAfterTeleportInit);
      
      (TeleportTransaction.findOne as jest.Mock).mockResolvedValue({ 
        teleportTxId: 'e2e-teleport-tx',
        save: jest.fn().mockResolvedValue({})
      });
      
      await paymentServiceInstance.confirmTeleport('e2e-payment', 'e2e-teleport-tx', '0xdestHash');

      // Setup for updateDDCAccount
      const paymentAfterTeleportConfirm = { 
        ...paymentAfterTeleportInit, 
        status: PaymentStatus.TELEPORT_CONFIRMED,
        metadata: {
          ...paymentAfterTeleportInit.metadata,
          stablecoinSymbol: 'USDC'
        }
      };
      
      mockRepoInstance.findById.mockReset();
      mockRepoInstance.findById.mockResolvedValue(paymentAfterTeleportConfirm);
      
      (mockContractService.getCereBalance as jest.Mock).mockResolvedValue('50');
      (mockContractService.updateDDCAccountBalance as jest.Mock).mockResolvedValue('50');
      (DDCAccountUpdate.create as jest.Mock).mockResolvedValue({ id: 'e2e-ddc-update' });
      
      await paymentServiceInstance.updateDDCAccount('e2e-payment');

      // Assert Final State
      expect(mockRepoInstance.updateStatus).toHaveBeenCalledWith('e2e-payment', PaymentStatus.COMPLETED, expect.objectContaining({ finalCereBalance: '50' }), expect.anything());
    });
  });
});
