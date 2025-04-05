const assert = require('assert');
const sinon = require('sinon');
const { 
  Payment, 
  PaymentStatus,
  DDCAccountUpdate,
  DDCAccountUpdateStatus,
  TeleportTransaction,
  TeleportTransactionStatus
} = require('../../src/PaymentService/models');
const { BalanceVerificationService } = require('../../src/PaymentService/services/BalanceVerificationService');
const { CereBlockchainService } = require('../../src/PaymentService/services/CereBlockchainService');
const { RetryService } = require('../../src/PaymentService/services/RetryService');

/**
 * Advanced timer control system to prevent Jest hanging after tests
 */
class TimerController {
  constructor() {
    this.timers = new Set();
    this.intervals = new Set();
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

describe('BalanceVerificationService', () => {
  let verificationService;
  let cereBlockchainService;
  let retryService;
  let sandbox;
  let timerController;
  
  // Mock data
  const paymentId = 'payment-123';
  const teleportTxId = 'teleport-tx-123';
  const cereNetworkAddress = 'cere-address-123';
  const ddcAccountId = 'ddc-account-123';
  const cereAmount = '100';
  const initialBalance = '500';
  const newBalance = '600';
  const ddcUpdateId = 'ddc-update-123';
  
  // Run before each test
  beforeEach(() => {
    // Set up timer control
    timerController = new TimerController();
    timerController.install();
    
    // Create sandbox and stubs
    sandbox = sinon.createSandbox();
    
    // Create mock services
    cereBlockchainService = {
      getAccountBalance: sandbox.stub(),
      createDDCAccountIfNeeded: sandbox.stub(),
      calculateDDCStorage: sandbox.stub(),
      getDDCConversionRate: sandbox.stub(),
      creditDDCAccount: sandbox.stub(),
      checkDDCCreditStatus: sandbox.stub()
    };
    
    retryService = {
      retry: sandbox.stub()
    };
    
    // Create real service with mocks
    verificationService = new BalanceVerificationService(cereBlockchainService, retryService);
    
    // Stub model methods
    sandbox.stub(TeleportTransaction, 'findOne');
    sandbox.stub(Payment, 'findByPk');
    sandbox.stub(DDCAccountUpdate, 'create');
    sandbox.stub(DDCAccountUpdate, 'findByPk');
    sandbox.stub(DDCAccountUpdate, 'findAll');
    
    // Stub setTimeout to execute immediately for testing
    // This is to avoid actual delays but still exercise the code paths
    this.originalSetTimeout = global.setTimeout;
    global.setTimeout = (callback, delay) => {
      return this.originalSetTimeout(callback, 0);
    };
  });
  
  // Run after each test
  afterEach(() => {
    // Clean up all timers and intervals
    timerController.cleanup();
    
    // Restore original timer functions
    timerController.restore();
    
    // Restore the original setTimeout
    global.setTimeout = this.originalSetTimeout;
    
    // Restore all stubs
    sandbox.restore();
  });
  
  describe('startVerification', () => {
    it('should start verification process for a completed teleport', async () => {
      // Mock teleport transaction
      const teleportTx = {
        id: 'teleport-1',
        teleportTxId,
        status: TeleportTransactionStatus.COMPLETED
      };
      
      // Mock payment
      const payment = {
        id: paymentId,
        cereNetworkAddress,
        cereAmount,
        status: PaymentStatus.TELEPORT_CONFIRMED,
        update: sandbox.stub().resolves()
      };
      
      // Mock DDC update
      const ddcUpdate = {
        id: ddcUpdateId,
        update: sandbox.stub().resolves()
      };
      
      // Set up mock responses
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      DDCAccountUpdate.create.resolves(ddcUpdate);
      
      cereBlockchainService.createDDCAccountIfNeeded.resolves(ddcAccountId);
      cereBlockchainService.calculateDDCStorage.resolves('1000');
      cereBlockchainService.getDDCConversionRate.resolves('10');
      cereBlockchainService.getAccountBalance.resolves(initialBalance);
      cereBlockchainService.creditDDCAccount.resolves({
        txHash: 'credit-tx-123',
        newBalance
      });
      
      // Spy on verifyBalanceUpdate
      const verifyBalanceUpdateSpy = sandbox.spy(verificationService, 'verifyBalanceUpdate');
      
      // Execute the method
      await verificationService.startVerification(paymentId, teleportTxId);
      
      // Verify payment status update
      assert.strictEqual(payment.update.calledOnce, true);
      assert.deepStrictEqual(payment.update.firstCall.args[0], {
        status: PaymentStatus.UPDATING_DDC
      });
      
      // Verify DDC update creation
      assert.strictEqual(DDCAccountUpdate.create.calledOnce, true);
      
      // Verify DDC account crediting
      assert.strictEqual(cereBlockchainService.creditDDCAccount.calledOnce, true);
      assert.deepStrictEqual(
        cereBlockchainService.creditDDCAccount.firstCall.args,
        [cereNetworkAddress, ddcAccountId, cereAmount]
      );
      
      // Verify DDC update status update
      assert.strictEqual(ddcUpdate.update.calledOnce, true);
      
      // Verify verification process was scheduled
      assert.strictEqual(verifyBalanceUpdateSpy.called, true);
    });
    
    it('should handle errors during verification start', async () => {
      // Mock teleport transaction
      const teleportTx = {
        id: 'teleport-1',
        teleportTxId,
        status: TeleportTransactionStatus.COMPLETED
      };
      
      // Mock payment
      const payment = {
        id: paymentId,
        update: sandbox.stub().resolves()
      };
      
      // Set up mock responses
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      
      // Simulate error in the process
      cereBlockchainService.createDDCAccountIfNeeded.rejects(new Error('API error'));
      
      // Execute the method
      await verificationService.startVerification(paymentId, teleportTxId);
      
      // Verify payment status update to failed
      assert.strictEqual(payment.update.calledTwice, true);
      assert.deepStrictEqual(payment.update.secondCall.args[0], {
        status: PaymentStatus.FAILED,
        error: 'Failed to update DDC balance: API error'
      });
    });
  });
  
  describe('verifyBalanceUpdate', () => {
    it('should mark update as completed when transaction is completed and balance is correct', async () => {
      // Mock DDC update with payment
      const ddcUpdate = {
        id: ddcUpdateId,
        txHash: 'credit-tx-123',
        status: DDCAccountUpdateStatus.PENDING,
        cereNetworkAddress,
        cereAmount,
        paymentId,
        payment: {
          id: paymentId,
          status: PaymentStatus.UPDATING_DDC,
          update: sandbox.stub().resolves()
        },
        update: sandbox.stub().resolves()
      };
      
      // Set up mock responses
      DDCAccountUpdate.findByPk.resolves(ddcUpdate);
      cereBlockchainService.checkDDCCreditStatus.resolves(DDCAccountUpdateStatus.COMPLETED);
      cereBlockchainService.getAccountBalance.resolves('600');
      
      // Add parseUnits mock to mimic ethers
      global.ethers = {
        parseUnits: (value) => BigInt(value) * BigInt(10**18)
      };
      
      // Execute the method (call it directly)
      await verificationService['verifyBalanceUpdate'](ddcUpdateId, initialBalance, cereAmount);
      
      // Verify update status
      assert.strictEqual(ddcUpdate.update.calledOnce, true);
      assert.deepStrictEqual(ddcUpdate.update.firstCall.args[0], {
        status: DDCAccountUpdateStatus.COMPLETED
      });
      
      // Verify payment status update
      assert.strictEqual(ddcUpdate.payment.update.calledOnce, true);
      assert.deepStrictEqual(ddcUpdate.payment.update.firstCall.args[0], {
        status: PaymentStatus.COMPLETED,
        completedAt: sinon.match.instanceOf(Date)
      });
    });
    
    it('should mark update as failed when transaction fails', async () => {
      // Mock DDC update with payment
      const ddcUpdate = {
        id: ddcUpdateId,
        txHash: 'credit-tx-123',
        status: DDCAccountUpdateStatus.PENDING,
        paymentId,
        payment: {
          id: paymentId,
          status: PaymentStatus.UPDATING_DDC,
          update: sandbox.stub().resolves()
        },
        update: sandbox.stub().resolves()
      };
      
      // Set up mock responses
      DDCAccountUpdate.findByPk.resolves(ddcUpdate);
      cereBlockchainService.checkDDCCreditStatus.resolves(DDCAccountUpdateStatus.FAILED);
      
      // Create spy for handleFailedUpdate
      const handleFailedUpdateSpy = sandbox.spy(verificationService, 'handleFailedUpdate');
      
      // Execute the method (call it directly)
      await verificationService['verifyBalanceUpdate'](ddcUpdateId, initialBalance, cereAmount);
      
      // Verify handleFailedUpdate was called
      assert.strictEqual(handleFailedUpdateSpy.calledOnce, true);
      assert.strictEqual(handleFailedUpdateSpy.firstCall.args[0], ddcUpdate);
      assert.strictEqual(handleFailedUpdateSpy.firstCall.args[1], 'Transaction failed on Cere Network');
    });
    
    it('should schedule another verification if transaction is still pending', async () => {
      // Mock DDC update with payment
      const ddcUpdate = {
        id: ddcUpdateId,
        txHash: 'credit-tx-123',
        status: DDCAccountUpdateStatus.PENDING,
        payment: {
          id: paymentId,
          status: PaymentStatus.UPDATING_DDC
        }
      };
      
      // Set up mock responses
      DDCAccountUpdate.findByPk.resolves(ddcUpdate);
      cereBlockchainService.checkDDCCreditStatus.resolves(DDCAccountUpdateStatus.PENDING);
      
      // Spy on setTimeout to verify it's called with increasing delay
      const setTimeoutSpy = sandbox.spy(global, 'setTimeout');
      
      // Execute the method (call it directly)
      await verificationService['verifyBalanceUpdate'](ddcUpdateId, initialBalance, cereAmount);
      
      // Verify setTimeout was called to schedule next check
      assert.strictEqual(setTimeoutSpy.calledOnce, true);
    });
  });
  
  describe('retryFailedUpdate', () => {
    it('should retry a failed update successfully', async () => {
      // Mock DDC update with payment
      const ddcUpdate = {
        id: ddcUpdateId,
        status: DDCAccountUpdateStatus.FAILED,
        cereNetworkAddress,
        ddcAccountId,
        cereAmount,
        payment: {
          id: paymentId,
          status: PaymentStatus.FAILED,
          update: sandbox.stub().resolves()
        },
        update: sandbox.stub().resolves()
      };
      
      // Set up mock responses
      DDCAccountUpdate.findByPk.resolves(ddcUpdate);
      cereBlockchainService.getAccountBalance.resolves(initialBalance);
      cereBlockchainService.creditDDCAccount.resolves({ txHash: 'new-tx-hash', newBalance });
      
      // Spy on verifyBalanceUpdate
      const verifyBalanceUpdateSpy = sandbox.spy(verificationService, 'verifyBalanceUpdate');
      
      // Execute the method
      const result = await verificationService.retryFailedUpdate(ddcUpdateId);
      
      // Verify result
      assert.strictEqual(result, true);
      
      // Verify update status
      assert.strictEqual(ddcUpdate.update.calledTwice, true);
      
      // First update should reset status to pending
      assert.deepStrictEqual(ddcUpdate.update.firstCall.args[0], {
        status: DDCAccountUpdateStatus.PENDING,
        error: null
      });
      
      // Second update should set txHash and status
      assert.deepStrictEqual(ddcUpdate.update.secondCall.args[0], {
        txHash: 'new-tx-hash',
        status: DDCAccountUpdateStatus.PENDING
      });
      
      // Verify payment status update
      assert.strictEqual(ddcUpdate.payment.update.calledOnce, true);
      assert.deepStrictEqual(ddcUpdate.payment.update.firstCall.args[0], {
        status: PaymentStatus.UPDATING_DDC,
        error: null
      });
      
      // Verify credit DDC account was called
      assert.strictEqual(cereBlockchainService.creditDDCAccount.calledOnce, true);
      
      // Verify verification process was scheduled
      assert.strictEqual(verifyBalanceUpdateSpy.called, true);
    });
    
    it('should return false if DDC update is not found', async () => {
      // Set up mock responses
      DDCAccountUpdate.findByPk.resolves(null);
      
      // Execute the method
      const result = await verificationService.retryFailedUpdate(ddcUpdateId);
      
      // Verify result
      assert.strictEqual(result, false);
    });
    
    it('should return false if DDC update is not in failed status', async () => {
      // Mock DDC update with completed status
      const ddcUpdate = {
        id: ddcUpdateId,
        status: DDCAccountUpdateStatus.COMPLETED
      };
      
      // Set up mock responses
      DDCAccountUpdate.findByPk.resolves(ddcUpdate);
      
      // Execute the method
      const result = await verificationService.retryFailedUpdate(ddcUpdateId);
      
      // Verify result
      assert.strictEqual(result, false);
    });
  });
  
  describe('recoverPendingUpdates', () => {
    it('should recover pending updates', async () => {
      // Mock pending updates
      const pendingUpdates = [
        {
          id: 'update-1',
          cereNetworkAddress,
          cereAmount
        },
        {
          id: 'update-2',
          cereNetworkAddress: 'other-address',
          cereAmount: '200'
        }
      ];
      
      // Set up mock responses
      DDCAccountUpdate.findAll.resolves(pendingUpdates);
      cereBlockchainService.getAccountBalance.resolves(initialBalance);
      
      // Spy on verifyBalanceUpdate
      const verifyBalanceUpdateSpy = sandbox.spy(verificationService, 'verifyBalanceUpdate');
      
      // Execute the method
      await verificationService.recoverPendingUpdates();
      
      // Verify findAll was called with correct parameters
      assert.strictEqual(DDCAccountUpdate.findAll.calledOnce, true);
      assert.deepStrictEqual(DDCAccountUpdate.findAll.firstCall.args[0], {
        where: {
          status: [
            DDCAccountUpdateStatus.PENDING
          ]
        }
      });
      
      // Verify getAccountBalance was called twice (once for each update)
      assert.strictEqual(cereBlockchainService.getAccountBalance.calledTwice, true);
      
      // Verify verifyBalanceUpdate was called twice (once for each update)
      assert.strictEqual(verifyBalanceUpdateSpy.calledTwice, true);
    });
    
    it('should handle errors during recovery', async () => {
      // Simulate error in findAll
      DDCAccountUpdate.findAll.rejects(new Error('Database error'));
      
      // Should not throw error
      await verificationService.recoverPendingUpdates();
    });
  });
  
  describe('handleFailedUpdate', () => {
    it('should mark update and payment as failed', async () => {
      // Mock DDC update with payment
      const ddcUpdate = {
        id: ddcUpdateId,
        paymentId,
        txHash: 'credit-tx-123',
        status: DDCAccountUpdateStatus.PENDING,
        payment: {
          id: paymentId,
          status: PaymentStatus.UPDATING_DDC,
          update: sandbox.stub().resolves()
        },
        update: sandbox.stub().resolves()
      };
      
      const reason = 'Test failure reason';
      
      // Execute the method
      await verificationService['handleFailedUpdate'](ddcUpdate, reason);
      
      // Verify update status
      assert.strictEqual(ddcUpdate.update.calledOnce, true);
      assert.deepStrictEqual(ddcUpdate.update.firstCall.args[0], {
        status: DDCAccountUpdateStatus.FAILED,
        error: reason
      });
      
      // Verify payment status update
      assert.strictEqual(ddcUpdate.payment.update.calledOnce, true);
      assert.deepStrictEqual(ddcUpdate.payment.update.firstCall.args[0], {
        status: PaymentStatus.FAILED,
        error: `DDC balance update failed: ${reason}`
      });
    });
  });
}); 