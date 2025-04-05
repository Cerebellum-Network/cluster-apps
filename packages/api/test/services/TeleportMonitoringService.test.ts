const assert = require('assert');
const sinon = require('sinon');
const { 
  Payment, 
  PaymentStatus,
  TeleportTransaction,
  TeleportTransactionStatus
} = require('../../src/PaymentService/models');
const { TeleportMonitoringService } = require('../../src/PaymentService/services/TeleportMonitoringService');
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

describe('TeleportMonitoringService', () => {
  let monitoringService;
  let hyperbridgeService;
  let sandbox;
  let timerController;

  beforeEach(() => {
    // Set up timer control
    timerController = new TimerController();
    timerController.install();

    // Create sandbox and stubs
    sandbox = sinon.createSandbox();
    hyperbridgeService = new HyperbridgeService();
    monitoringService = new TeleportMonitoringService(hyperbridgeService);

    // Stub the database models
    sandbox.stub(TeleportTransaction, 'findOne');
    sandbox.stub(TeleportTransaction, 'findAll');
    sandbox.stub(Payment, 'findByPk');
  });

  afterEach(() => {
    // Clean up all timers and intervals
    timerController.cleanup();
    
    // Restore original timer functions
    timerController.restore();
    
    // Restore all stubs
    sandbox.restore();
  });

  describe('startMonitoring', () => {
    it('should start monitoring a teleport transaction', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';

      // Spy on setInterval
      const setIntervalSpy = sandbox.spy(global, 'setInterval');

      await monitoringService.startMonitoring(teleportTxId, paymentId);

      assert.strictEqual(setIntervalSpy.calledOnce, true);
      assert.strictEqual(monitoringService.monitoringJobs.has(teleportTxId), true);
    });

    it('should not start monitoring if already monitoring', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';

      // First call
      await monitoringService.startMonitoring(teleportTxId, paymentId);

      // Spy on setInterval after first call
      const setIntervalSpy = sandbox.spy(global, 'setInterval');

      // Second call
      await monitoringService.startMonitoring(teleportTxId, paymentId);

      assert.strictEqual(setIntervalSpy.called, false);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring a teleport transaction', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';

      // Start monitoring
      await monitoringService.startMonitoring(teleportTxId, paymentId);

      // Spy on clearInterval
      const clearIntervalSpy = sandbox.spy(global, 'clearInterval');

      // Stop monitoring
      monitoringService.stopMonitoring(teleportTxId);

      assert.strictEqual(clearIntervalSpy.calledOnce, true);
      assert.strictEqual(monitoringService.monitoringJobs.has(teleportTxId), false);
    });
  });

  describe('checkTeleportStatus', () => {
    it('should update status to COMPLETED when teleport is complete', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';
      const teleportTx = {
        teleportTxId,
        paymentId,
        status: TeleportTransactionStatus.PENDING,
        update: sandbox.stub().resolves()
      };
      const payment = {
        id: paymentId,
        status: PaymentStatus.TELEPORT_INITIATED,
        update: sandbox.stub().resolves()
      };

      // Setup stubs
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      sandbox.stub(hyperbridgeService, 'checkTeleportStatus').resolves(TeleportTransactionStatus.COMPLETED);
      
      // Call the method directly since it's private
      await monitoringService['checkTeleportStatus'](teleportTxId, paymentId);

      assert.strictEqual(teleportTx.update.calledOnce, true);
      assert.deepStrictEqual(teleportTx.update.firstCall.args[0], {
        status: TeleportTransactionStatus.COMPLETED,
        confirmedAt: sinon.match.instanceOf(Date)
      });
      assert.strictEqual(payment.update.calledOnce, true);
      assert.deepStrictEqual(payment.update.firstCall.args[0], {
        status: PaymentStatus.TELEPORT_CONFIRMED
      });
    });

    it('should update status to FAILED when teleport fails', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';
      const teleportTx = {
        teleportTxId,
        paymentId,
        status: TeleportTransactionStatus.PENDING,
        update: sandbox.stub().resolves()
      };
      const payment = {
        id: paymentId,
        status: PaymentStatus.TELEPORT_INITIATED,
        update: sandbox.stub().resolves()
      };

      // Setup stubs
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      sandbox.stub(hyperbridgeService, 'checkTeleportStatus').resolves(TeleportTransactionStatus.FAILED);
      
      // Call the method directly
      await monitoringService['checkTeleportStatus'](teleportTxId, paymentId);

      assert.strictEqual(teleportTx.update.calledOnce, true);
      assert.deepStrictEqual(teleportTx.update.firstCall.args[0], {
        status: TeleportTransactionStatus.FAILED,
        error: 'Teleport failed on Hyperbridge'
      });
      assert.strictEqual(payment.update.calledOnce, true);
      assert.deepStrictEqual(payment.update.firstCall.args[0], {
        status: PaymentStatus.FAILED,
        error: 'Teleport failed: Teleport failed on Hyperbridge'
      });
    });

    it('should update payment status to TELEPORT_INITIATED when teleport is still pending', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';
      const teleportTx = {
        teleportTxId,
        paymentId,
        status: TeleportTransactionStatus.PENDING,
        update: sandbox.stub().resolves()
      };
      const payment = {
        id: paymentId,
        status: PaymentStatus.TELEPORTING, // Not yet updated to TELEPORT_INITIATED
        update: sandbox.stub().resolves()
      };

      // Setup stubs
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      sandbox.stub(hyperbridgeService, 'checkTeleportStatus').resolves(TeleportTransactionStatus.PENDING);
      
      // Call the method directly
      await monitoringService['checkTeleportStatus'](teleportTxId, paymentId);

      assert.strictEqual(payment.update.calledOnce, true);
      assert.deepStrictEqual(payment.update.firstCall.args[0], {
        status: PaymentStatus.TELEPORT_INITIATED
      });
    });

    it('should stop monitoring if teleport transaction not found', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';

      // Start monitoring
      await monitoringService.startMonitoring(teleportTxId, paymentId);

      // Setup stubs
      TeleportTransaction.findOne.resolves(null);
      
      // Spy on stopMonitoring
      const stopMonitoringSpy = sandbox.spy(monitoringService, 'stopMonitoring');
      
      // Call the method directly
      await monitoringService['checkTeleportStatus'](teleportTxId, paymentId);

      assert.strictEqual(stopMonitoringSpy.calledOnce, true);
      assert.strictEqual(stopMonitoringSpy.firstCall.args[0], teleportTxId);
    });

    it('should stop monitoring if payment not found', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';
      const teleportTx = {
        teleportTxId,
        paymentId,
        status: TeleportTransactionStatus.PENDING
      };

      // Start monitoring
      await monitoringService.startMonitoring(teleportTxId, paymentId);

      // Setup stubs
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(null);
      
      // Spy on stopMonitoring
      const stopMonitoringSpy = sandbox.spy(monitoringService, 'stopMonitoring');
      
      // Call the method directly
      await monitoringService['checkTeleportStatus'](teleportTxId, paymentId);

      assert.strictEqual(stopMonitoringSpy.calledOnce, true);
      assert.strictEqual(stopMonitoringSpy.firstCall.args[0], teleportTxId);
    });

    it('should retry when hyperbridge service throws error', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';
      const teleportTx = {
        teleportTxId,
        paymentId,
        status: TeleportTransactionStatus.PENDING,
        update: sandbox.stub().resolves()
      };
      const payment = {
        id: paymentId,
        status: PaymentStatus.TELEPORT_INITIATED,
        update: sandbox.stub().resolves()
      };

      // Setup stubs
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      
      const checkTeleportStatusStub = sandbox.stub(hyperbridgeService, 'checkTeleportStatus');
      // First call fails, second succeeds
      checkTeleportStatusStub.onCall(0).rejects(new Error('Network error'));
      checkTeleportStatusStub.onCall(1).resolves(TeleportTransactionStatus.COMPLETED);
      
      // Stub setTimeout to execute immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (callback) => {
        callback();
        return 999; // Return a dummy timer ID
      };
      
      // Call the method directly
      await monitoringService['checkTeleportStatus'](teleportTxId, paymentId);

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;

      assert.strictEqual(checkTeleportStatusStub.callCount, 2);
      assert.strictEqual(teleportTx.update.calledOnce, true);
      assert.deepStrictEqual(teleportTx.update.firstCall.args[0], {
        status: TeleportTransactionStatus.COMPLETED,
        confirmedAt: sinon.match.instanceOf(Date)
      });
    });
  });

  describe('recoverPendingTeleports', () => {
    it('should recover monitoring for pending teleports', async () => {
      const pendingTeleports = [
        { 
          teleportTxId: '0x123', 
          paymentId: 'payment-123', 
          status: TeleportTransactionStatus.PENDING 
        },
        { 
          teleportTxId: '0x456', 
          paymentId: 'payment-456', 
          status: TeleportTransactionStatus.PENDING 
        }
      ];

      // Setup stubs
      TeleportTransaction.findAll.resolves(pendingTeleports);
      
      // Spy on startMonitoring
      const startMonitoringSpy = sandbox.spy(monitoringService, 'startMonitoring');
      
      await monitoringService.recoverPendingTeleports();

      assert.strictEqual(startMonitoringSpy.callCount, 2);
      assert.strictEqual(startMonitoringSpy.firstCall.args[0], '0x123');
      assert.strictEqual(startMonitoringSpy.firstCall.args[1], 'payment-123');
      assert.strictEqual(startMonitoringSpy.secondCall.args[0], '0x456');
      assert.strictEqual(startMonitoringSpy.secondCall.args[1], 'payment-456');
    });

    it('should handle errors during recovery', async () => {
      // Setup stubs
      TeleportTransaction.findAll.rejects(new Error('Database error'));
      
      // Should not throw
      await monitoringService.recoverPendingTeleports();
    });
  });

  describe('handleTeleportTimeout', () => {
    it('should mark teleport as failed after timeout', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';
      const teleportTx = {
        teleportTxId,
        paymentId,
        status: TeleportTransactionStatus.PENDING,
        update: sandbox.stub().resolves()
      };
      const payment = {
        id: paymentId,
        status: PaymentStatus.TELEPORT_INITIATED,
        update: sandbox.stub().resolves()
      };

      // Setup stubs
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      sandbox.stub(hyperbridgeService, 'checkTeleportStatus').resolves(TeleportTransactionStatus.PENDING);
      
      // Spy on stopMonitoring
      const stopMonitoringSpy = sandbox.spy(monitoringService, 'stopMonitoring');
      
      // Call the method directly
      await monitoringService['handleTeleportTimeout'](teleportTxId, paymentId);

      assert.strictEqual(teleportTx.update.calledOnce, true);
      assert.deepStrictEqual(teleportTx.update.firstCall.args[0], {
        status: TeleportTransactionStatus.FAILED,
        error: 'Teleport monitoring timed out'
      });
      assert.strictEqual(payment.update.calledOnce, true);
      assert.deepStrictEqual(payment.update.firstCall.args[0], {
        status: PaymentStatus.FAILED,
        error: 'Teleport monitoring timed out without confirmation'
      });
      assert.strictEqual(stopMonitoringSpy.calledOnce, true);
    });

    it('should complete teleport if final check returns COMPLETED', async () => {
      const teleportTxId = '0x123';
      const paymentId = 'payment-123';
      const teleportTx = {
        teleportTxId,
        paymentId,
        status: TeleportTransactionStatus.PENDING,
        update: sandbox.stub().resolves()
      };
      const payment = {
        id: paymentId,
        status: PaymentStatus.TELEPORT_INITIATED,
        update: sandbox.stub().resolves()
      };

      // Setup stubs
      TeleportTransaction.findOne.resolves(teleportTx);
      Payment.findByPk.resolves(payment);
      sandbox.stub(hyperbridgeService, 'checkTeleportStatus').resolves(TeleportTransactionStatus.COMPLETED);
      
      // Spy on handleTeleportCompleted
      const handleCompletedSpy = sandbox.spy(monitoringService, 'handleTeleportCompleted');
      
      // Call the method directly
      await monitoringService['handleTeleportTimeout'](teleportTxId, paymentId);

      assert.strictEqual(handleCompletedSpy.calledOnce, true);
      assert.strictEqual(handleCompletedSpy.firstCall.args[0], teleportTx);
      assert.strictEqual(handleCompletedSpy.firstCall.args[1], payment);
    });
  });
}); 