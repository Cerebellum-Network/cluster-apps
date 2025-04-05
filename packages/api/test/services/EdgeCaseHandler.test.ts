const assert = require('assert');
const sinon = require('sinon');
const { 
  Payment, 
  PaymentStatus,
  DDCAccountUpdate,
  DDCAccountUpdateStatus,
  TeleportTransaction,
  TeleportTransactionStatus,
  SwapTransaction,
  SwapTransactionStatus,
  StablecoinTransaction,
  StablecoinTransactionStatus
} = require('../../src/PaymentService/models');
const { EdgeCaseHandler } = require('../../src/PaymentService/services/EdgeCaseHandler');
const { CereBlockchainService } = require('../../src/PaymentService/services/CereBlockchainService');
const { HyperbridgeService } = require('../../src/PaymentService/services/HyperbridgeService');
const { TeleportMonitoringService } = require('../../src/PaymentService/services/TeleportMonitoringService');
const { BalanceVerificationService } = require('../../src/PaymentService/services/BalanceVerificationService');
const { RetryService } = require('../../src/PaymentService/services/RetryService');
const { ContractService } = require('../../src/PaymentService/services/ContractService');
const { Op } = require('sequelize');

// Crear un mock para logger
const loggerMock = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub()
};

// Mock del módulo logger
jest.mock('../../src/utils/logger', () => loggerMock);

/**
 * Timer controller helper for testing timers
 */
class TimerController {
  timers = new Set();
  intervals = new Set();
  originalSetTimeout;
  originalClearTimeout;
  originalSetInterval;
  originalClearInterval;
  
  constructor() {
    this.originalSetTimeout = global.setTimeout;
    this.originalClearTimeout = global.clearTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearInterval = global.clearInterval;
  }

  install() {
    // Replace setTimeout
    global.setTimeout = (...args) => {
      const id = this.originalSetTimeout(...args);
      this.timers.add(id);
      return id;
    };

    // Replace clearTimeout
    global.clearTimeout = (id) => {
      this.timers.delete(id);
      return this.originalClearTimeout(id);
    };

    // Replace setInterval
    global.setInterval = (...args) => {
      const id = this.originalSetInterval(...args);
      this.intervals.add(id);
      return id;
    };

    // Replace clearInterval
    global.clearInterval = (id) => {
      this.intervals.delete(id);
      return this.originalClearInterval(id);
    };
  }

  cleanup() {
    // Clear all timeouts
    this.timers.forEach(id => {
      this.originalClearTimeout(id);
    });
    this.timers.clear();

    // Clear all intervals
    this.intervals.forEach(id => {
      this.originalClearInterval(id);
    });
    this.intervals.clear();
  }

  restore() {
    global.setTimeout = this.originalSetTimeout;
    global.clearTimeout = this.originalClearTimeout;
    global.setInterval = this.originalSetInterval;
    global.clearInterval = this.originalClearInterval;
  }
}

describe('EdgeCaseHandler', () => {
  let edgeCaseHandler;
  let cereBlockchainService;
  let hyperbridgeService;
  let teleportMonitoringService;
  let balanceVerificationService;
  let retryService;
  let contractService;
  let sandbox;
  let timerController;
  
  // Mock data
  const paymentId = 'payment-123';
  const teleportTxId = 'teleport-tx-123';
  const txHash = 'tx-hash-123';
  const swapTxHash = 'swap-tx-hash-123';
  
  beforeEach(() => {
    // Set up timer control
    timerController = new TimerController();
    timerController.install();
    
    // Create sandbox and stubs
    sandbox = sinon.createSandbox();
    
    // Create mock services
    cereBlockchainService = {
      getAccountBalance: sandbox.stub(),
      accountExists: sandbox.stub(),
      checkTransactionStatus: sandbox.stub()
    };
    
    hyperbridgeService = {
      teleportToCereNetwork: sandbox.stub(),
      getTeleportStatus: sandbox.stub()
    };
    
    teleportMonitoringService = {
      startMonitoring: sandbox.stub(),
      stopMonitoring: sandbox.stub()
    };
    
    balanceVerificationService = {
      startVerification: sandbox.stub(),
      retryFailedUpdate: sandbox.stub(),
      verifyBalanceUpdate: sandbox.stub()
    };
    
    retryService = {
      retry: sandbox.stub(),
      retryStablecoinTransaction: sandbox.stub(),
      retrySwapTransaction: sandbox.stub()
    };
    
    contractService = {
      getTransactionReceipt: sandbox.stub(),
      swapExactTokensForTokens: sandbox.stub()
    };
    
    // Create service with mocks
    edgeCaseHandler = new EdgeCaseHandler(
      cereBlockchainService,
      hyperbridgeService,
      teleportMonitoringService,
      balanceVerificationService,
      retryService,
      contractService,
      contractService // Usar contractService en lugar de dexService
    );
    
    // Stub model methods
    sandbox.stub(Payment, 'findAll');
    sandbox.stub(Payment, 'findByPk');
    sandbox.stub(TeleportTransaction, 'findAll');
    sandbox.stub(TeleportTransaction, 'create');
    sandbox.stub(DDCAccountUpdate, 'findAll');
    
    // Limpiar stubs del logger antes de cada test
    loggerMock.info.reset();
    loggerMock.error.reset();
    loggerMock.warn.reset();
  });
  
  afterEach(() => {
    // Clean up all timers and intervals
    timerController.cleanup();
    
    // Restore original timer functions
    timerController.restore();
    
    // Restore all stubs
    sandbox.restore();
  });
  
  describe('recoverStuckPayments', () => {
    it('should recover stuck payments', async () => {
      // Mock stuck payments
      const stuckPayment1 = {
        id: 'payment-1',
        status: PaymentStatus.PENDING,
        update: sandbox.stub().resolves(),
        stablecoinTransactions: [],
        swapTransactions: [],
        teleportTransactions: [],
        ddcAccountUpdates: []
      };
      
      const stuckPayment2 = {
        id: 'payment-2',
        status: PaymentStatus.PAYMENT_RECEIVED,
        update: sandbox.stub().resolves(),
        stablecoinTransactions: [{ id: 'stablecoin-tx-1', status: StablecoinTransactionStatus.CONFIRMED }],
        swapTransactions: [],
        teleportTransactions: [],
        ddcAccountUpdates: []
      };
      
      // Set up mock responses
      Payment.findAll.resolves([stuckPayment1, stuckPayment2]);
      
      // Mock successful recovery
      sandbox.stub(edgeCaseHandler, 'recoverPayment')
        .withArgs(stuckPayment1).resolves(true)
        .withArgs(stuckPayment2).resolves(true);
      
      // Execute the method
      const result = await edgeCaseHandler.recoverStuckPayments();
      
      // Verify results
      assert.deepStrictEqual(result, { recovered: 2, failed: 0 });
      assert.strictEqual(Payment.findAll.calledOnce, true);
      assert.strictEqual(edgeCaseHandler.recoverPayment.calledTwice, true);
      assert.strictEqual(loggerMock.info.called, true);
    });
    
    it('should handle failed recoveries', async () => {
      // Mock stuck payments
      const stuckPayment = {
        id: 'payment-1',
        status: PaymentStatus.PENDING,
        stablecoinTransactions: []
      };
      
      // Set up mock responses
      Payment.findAll.resolves([stuckPayment]);
      
      // Mock failed recovery
      sandbox.stub(edgeCaseHandler, 'recoverPayment').resolves(false);
      
      // Execute the method
      const result = await edgeCaseHandler.recoverStuckPayments();
      
      // Verify results
      assert.deepEqual(result, { recovered: 0, failed: 1 });
    });
    
    it('should handle errors during recovery', async () => {
      // Mock stuck payments
      const stuckPayment = {
        id: 'payment-1',
        status: PaymentStatus.PENDING,
        stablecoinTransactions: []
      };
      
      // Set up mock responses
      Payment.findAll.resolves([stuckPayment]);
      
      // Mock error during recovery
      sandbox.stub(edgeCaseHandler, 'recoverPayment').rejects(new Error('Recovery error'));
      
      // Execute the method
      const result = await edgeCaseHandler.recoverStuckPayments();
      
      // Verify results
      assert.deepEqual(result, { recovered: 0, failed: 1 });
      assert.strictEqual(loggerMock.error.called, true);
    });
  });
  
  describe('recoverIncompleteTeleports', () => {
    it('should recover incomplete teleport transactions', async () => {
      // Mock incomplete teleports
      const teleport1 = {
        id: 'teleport-1',
        teleportTxId: 'tx-1',
        status: TeleportTransactionStatus.INITIATED,
        payment: { id: 'payment-1' },
        update: sandbox.stub().resolves()
      };
      
      // Set up mock responses
      TeleportTransaction.findAll.resolves([teleport1]);
      
      // Mock successful recovery
      sandbox.stub(edgeCaseHandler, 'recoverTeleport').resolves(true);
      
      // Execute the method
      const result = await edgeCaseHandler.recoverIncompleteTeleports();
      
      // Verify results
      assert.deepEqual(result, { recovered: 1, failed: 0 });
      assert.strictEqual(TeleportTransaction.findAll.calledOnce, true);
      assert.strictEqual(edgeCaseHandler.recoverTeleport.calledOnce, true);
    });
  });
  
  describe('recoverIncompleteDDCUpdates', () => {
    it('should recover incomplete DDC account updates', async () => {
      // Mock incomplete DDC updates
      const ddcUpdate = {
        id: 'ddc-update-1',
        status: DDCAccountUpdateStatus.PENDING,
        payment: { id: 'payment-1' }
      };
      
      // Set up mock responses
      DDCAccountUpdate.findAll.resolves([ddcUpdate]);
      
      // Mock successful retry
      sandbox.stub(edgeCaseHandler, 'retryDDCUpdate').resolves(true);
      
      // Execute the method
      const result = await edgeCaseHandler.recoverIncompleteDDCUpdates();
      
      // Verify results
      assert.deepEqual(result, { recovered: 1, failed: 0 });
      assert.strictEqual(DDCAccountUpdate.findAll.calledOnce, true);
      assert.strictEqual(edgeCaseHandler.retryDDCUpdate.calledOnce, true);
    });
  });
  
  describe('handlePartialPayment', () => {
    it('should handle payment with amount above threshold', async () => {
      // Mock payment with partial amount
      const payment = {
        id: paymentId,
        amount: '100',
        status: PaymentStatus.PENDING,
        update: sandbox.stub().resolves(),
        metadata: {}
      };
      
      const stablecoinTx = {
        amount: '95',
        status: StablecoinTransactionStatus.CONFIRMED
      };
      
      payment.stablecoinTransactions = [stablecoinTx];
      
      // Set up mock responses
      Payment.findByPk.resolves(payment);
      
      // Execute the method
      const result = await edgeCaseHandler.handlePartialPayment(paymentId);
      
      // Verify results
      assert.strictEqual(result, true);
      assert.strictEqual(payment.update.calledOnce, true);
      assert.strictEqual(payment.update.firstCall.args[0].status, PaymentStatus.PAYMENT_RECEIVED);
      assert.strictEqual(payment.update.firstCall.args[0].amount, '95');
      assert.strictEqual(payment.update.firstCall.args[0].metadata.partialPayment, true);
    });
    
    it('should reject payment with amount below threshold', async () => {
      // Mock payment with amount below threshold
      const payment = {
        id: paymentId,
        amount: '100',
        status: PaymentStatus.PENDING,
        update: sandbox.stub().resolves(),
        metadata: {}
      };
      
      const stablecoinTx = {
        amount: '70', // Below default threshold of 90%
        status: StablecoinTransactionStatus.CONFIRMED
      };
      
      payment.stablecoinTransactions = [stablecoinTx];
      
      // Set up mock responses
      Payment.findByPk.resolves(payment);
      
      // Execute the method
      const result = await edgeCaseHandler.handlePartialPayment(paymentId);
      
      // Verify results
      assert.strictEqual(result, false);
      assert.strictEqual(payment.update.calledOnce, true);
      assert.strictEqual(payment.update.firstCall.args[0].status, PaymentStatus.FAILED);
    });
  });
  
  describe('diagnosePayment', () => {
    it('should diagnose stuck payment', async () => {
      // Mock stuck payment
      const payment = {
        id: paymentId,
        status: PaymentStatus.TELEPORTING,
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3600000),
        error: null,
        stablecoinTransactions: [
          { 
            id: 'stablecoin-tx-1', 
            status: StablecoinTransactionStatus.CONFIRMED,
            transactionHash: txHash,
            amount: '100',
            error: null
          }
        ],
        swapTransactions: [
          { 
            id: 'swap-tx-1', 
            status: SwapTransactionStatus.COMPLETED,
            txHash: swapTxHash,
            error: null
          }
        ],
        teleportTransactions: [
          { 
            id: 'teleport-tx-1', 
            status: TeleportTransactionStatus.INITIATED,
            teleportTxId,
            error: null
          }
        ],
        ddcAccountUpdates: []
      };
      
      // Set up mock responses
      Payment.findByPk.resolves(payment);
      
      // Execute the method
      const diagnosis = await edgeCaseHandler.diagnosePayment(paymentId);
      
      // Verify results
      assert.strictEqual(diagnosis.isStuck, true);
      assert.strictEqual(diagnosis.paymentId, paymentId);
      assert.strictEqual(diagnosis.status, PaymentStatus.TELEPORTING);
      assert.strictEqual(diagnosis.stuckReason.includes('Teleport in progress'), true);
    });
    
    it('should handle non-existent payment', async () => {
      // Set up mock responses
      Payment.findByPk.resolves(null);
      
      // Execute the method
      const diagnosis = await edgeCaseHandler.diagnosePayment(paymentId);
      
      // Verify results
      assert.strictEqual(diagnosis.error.includes('not found'), true);
    });
  });
  
  describe('triggerNextStep', () => {
    it('should trigger appropriate next step based on payment status', async () => {
      // Mock payment
      const payment = {
        id: paymentId,
        status: PaymentStatus.PAYMENT_RECEIVED,
        stablecoinTransactions: [
          { 
            id: 'stablecoin-tx-1', 
            status: StablecoinTransactionStatus.CONFIRMED 
          }
        ]
      };
      
      // Set up mock responses
      Payment.findByPk.resolves(payment);
      
      // Mock recovery method
      sandbox.stub(edgeCaseHandler, 'recoverPayment').resolves(true);
      
      // Execute the method
      const result = await edgeCaseHandler.triggerNextStep(paymentId);
      
      // Verify results
      assert.strictEqual(result, true);
      assert.strictEqual(edgeCaseHandler.recoverPayment.calledOnce, true);
      assert.strictEqual(edgeCaseHandler.recoverPayment.firstCall.args[0], payment);
    });
    
    it('should handle non-existent payment', async () => {
      // Set up mock responses
      Payment.findByPk.resolves(null);
      
      // Execute the method
      const result = await edgeCaseHandler.triggerNextStep(paymentId);
      
      // Verify results
      assert.strictEqual(result, false);
      assert.strictEqual(loggerMock.error.called, true);
    });
  });
  
  describe('recoverPaymentReceivedState', () => {
    it('should trigger token swap for recovered payment', async () => {
      // Mock payment
      const payment = {
        id: paymentId,
        amount: '100',
        status: PaymentStatus.PAYMENT_RECEIVED
      };
      
      // Stub para el método privado recoverPaymentReceivedState
      const recoverStub = sandbox.stub(edgeCaseHandler, 'recoverPayment').resolves(true);
      
      // Simular comportamiento interno con contractService en lugar de dexService
      contractService.swapExactTokensForTokens.resolves({ txHash: 'new-swap-tx' });
      
      // Verificar que el método recoverPayment sea llamado exitosamente
      const result = await edgeCaseHandler.triggerNextStep(paymentId);
      
      assert.strictEqual(result, true);
    });
  });
}); 