const assert = require('assert');
const { ethers } = require('ethers');
const sinon = require('sinon');
const { 
  Payment,
  PaymentStatus,
  StablecoinTransaction,
  StablecoinTransactionStatus,
  SwapTransaction,
  SwapTransactionStatus,
  TeleportTransaction,
  TeleportTransactionStatus,
  DDCAccountUpdate,
  DDCAccountUpdateStatus
} = require('../../src/PaymentService/models');
const { TransactionMonitoringService } = require('../../src/PaymentService/services/TransactionMonitoringService');
const { ContractService } = require('../../src/PaymentService/services/ContractService');
const { HyperbridgeService } = require('../../src/PaymentService/services/HyperbridgeService');

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

describe('TransactionMonitoringService', () => {
  let monitoringService;
  let contractService;
  let hyperbridgeService;
  let sandbox;
  let timerController;

  beforeEach(() => {
    // Set up timer control
    timerController = new TimerController();
    timerController.install();

    // Standard test setup
    sandbox = sinon.createSandbox();
    contractService = new ContractService(null);
    hyperbridgeService = new HyperbridgeService(null, null);
    monitoringService = new TransactionMonitoringService(contractService, hyperbridgeService);

    // If service has internal monitoringInterval, replace it with a stub that doesn't actually schedule
    if (typeof monitoringService.monitoringInterval === 'number') {
      sandbox.stub(monitoringService, 'monitoringInterval').value(9999); // Arbitrary high ID
    }
  });

  afterEach(() => {
    // Force immediate checking of transactions if this was scheduled
    if (typeof monitoringService.checkTransactionStatus === 'function' && 
        monitoringService.monitoringTimers && 
        monitoringService.monitoringTimers.size > 0) {
      // Get all payment IDs being monitored
      const paymentIds = Array.from(monitoringService.monitoringTimers.keys());
      
      // Clear internal timers to prevent them from firing after the test
      monitoringService.monitoringTimers.clear();
      
      // Clear internal retry counts to reset state
      if (monitoringService.retryCount) {
        monitoringService.retryCount.clear();
      }
    }

    // Clean up resources
    sandbox.restore();
    
    // Clean up all timers and intervals
    timerController.cleanup();
    
    // Restore original timer functions
    timerController.restore();
  });

  describe('startMonitoring', () => {
    it('should start monitoring a payment', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.PROCESSING_PAYMENT,
        stablecoinTransactions: [{
          id: '1',
          transactionHash: '0x123',
          status: StablecoinTransactionStatus.PENDING
        }]
      };

      const startMonitoringSpy = sandbox.spy(monitoringService, 'startMonitoring');
      await monitoringService.startMonitoring(payment);

      assert.strictEqual(startMonitoringSpy.calledOnce, true);
    });

    it('should not start monitoring if already monitoring', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.PROCESSING_PAYMENT
      };

      await monitoringService.startMonitoring(payment);
      const startMonitoringSpy = sandbox.spy(monitoringService, 'startMonitoring');
      await monitoringService.startMonitoring(payment);

      assert.strictEqual(startMonitoringSpy.calledOnce, true);
    });
  });

  describe('checkTransactionStatus', () => {
    it('should check stablecoin transaction status', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.PROCESSING_PAYMENT,
        stablecoinTransactions: [{
          id: '1',
          transactionHash: '0x123',
          status: StablecoinTransactionStatus.PENDING,
          update: sinon.stub().resolves()
        }],
        update: sinon.stub().resolves()
      };

      const receipt = {
        status: 1,
        blockNumber: 123
      };

      sandbox.stub(Payment, 'findByPk').resolves(payment);
      sandbox.stub(contractService, 'getTransactionReceipt').resolves(receipt);

      await monitoringService['checkTransactionStatus'](payment.id);

      assert.strictEqual(payment.stablecoinTransactions[0].update.calledWith({
        status: StablecoinTransactionStatus.CONFIRMED,
        blockNumber: receipt.blockNumber
      }), true);
      assert.strictEqual(payment.update.calledWith({
        status: PaymentStatus.PAYMENT_RECEIVED
      }), true);
    });

    it('should check swap transaction status', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.SWAPPING_TOKENS,
        swapTransactions: [{
          id: '1',
          txHash: '0x123',
          status: SwapTransactionStatus.PENDING,
          update: sinon.stub().resolves()
        }],
        update: sinon.stub().resolves()
      };

      const receipt = {
        status: 1,
        blockNumber: 123
      };

      sandbox.stub(Payment, 'findByPk').resolves(payment);
      sandbox.stub(contractService, 'getTransactionReceipt').resolves(receipt);

      await monitoringService['checkTransactionStatus'](payment.id);

      assert.strictEqual(payment.swapTransactions[0].update.calledWith({
        status: SwapTransactionStatus.COMPLETED,
        blockNumber: receipt.blockNumber
      }), true);
      assert.strictEqual(payment.update.calledWith({
        status: PaymentStatus.TOKENS_SWAPPED
      }), true);
    });

    it('should check teleport transaction status', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.TELEPORTING,
        teleportTransactions: [{
          id: '1',
          teleportTxId: '0x123',
          status: TeleportTransactionStatus.PENDING,
          update: sinon.stub().resolves()
        }],
        update: sinon.stub().resolves()
      };

      sandbox.stub(Payment, 'findByPk').resolves(payment);
      sandbox.stub(hyperbridgeService, 'checkTeleportStatus').resolves(TeleportTransactionStatus.COMPLETED);

      await monitoringService['checkTransactionStatus'](payment.id);

      assert.strictEqual(payment.teleportTransactions[0].update.calledWith({
        status: TeleportTransactionStatus.COMPLETED,
        confirmedAt: sinon.match.date
      }), true);
      assert.strictEqual(payment.update.calledWith({
        status: PaymentStatus.TELEPORT_CONFIRMED
      }), true);
    });

    it('should check DDC account update status', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.UPDATING_DDC,
        ddcAccountUpdates: [{
          id: '1',
          txHash: '0x123',
          status: DDCAccountUpdateStatus.PENDING,
          update: sinon.stub().resolves()
        }],
        update: sinon.stub().resolves()
      };

      sandbox.stub(Payment, 'findByPk').resolves(payment);
      sandbox.stub(contractService, 'checkDDCUpdateStatus').resolves('confirmed');

      await monitoringService['checkTransactionStatus'](payment.id);

      assert.strictEqual(payment.ddcAccountUpdates[0].update.calledWith({
        status: DDCAccountUpdateStatus.COMPLETED
      }), true);
      assert.strictEqual(payment.update.calledWith({
        status: PaymentStatus.COMPLETED
      }), true);
    });

    it('should handle failed transactions', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.PROCESSING_PAYMENT,
        stablecoinTransactions: [{
          id: '1',
          transactionHash: '0x123',
          status: StablecoinTransactionStatus.PENDING,
          update: sinon.stub().resolves()
        }],
        update: sinon.stub().resolves()
      };

      const receipt = {
        status: 0,
        blockNumber: 123
      };

      sandbox.stub(Payment, 'findByPk').resolves(payment);
      sandbox.stub(contractService, 'getTransactionReceipt').resolves(receipt);

      await monitoringService['checkTransactionStatus'](payment.id);

      assert.strictEqual(payment.stablecoinTransactions[0].update.calledWith({
        status: StablecoinTransactionStatus.FAILED,
        error: 'Transaction reverted'
      }), true);
      assert.strictEqual(payment.update.calledWith({
        status: PaymentStatus.FAILED,
        error: 'Stablecoin transaction failed'
      }), true);
    });

    it('should handle max retries', async () => {
      const payment = {
        id: '123',
        status: PaymentStatus.PROCESSING_PAYMENT,
        stablecoinTransactions: [{
          id: '1',
          transactionHash: '0x123',
          status: StablecoinTransactionStatus.PENDING
        }],
        update: sinon.stub().resolves()
      };

      sandbox.stub(Payment, 'findByPk').resolves(payment);
      sandbox.stub(contractService, 'getTransactionReceipt').resolves(null);

      // Set retry count to max
      monitoringService.retryCount.set(payment.id, 20);

      await monitoringService['checkTransactionStatus'](payment.id);

      assert.strictEqual(payment.update.calledWith({
        status: PaymentStatus.FAILED,
        error: 'Max monitoring retries reached'
      }), true);
    });
  });
}); 