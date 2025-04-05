const assert = require('assert');
const sinon = require('sinon');
const axios = require('axios');
const { 
  CereBlockchainService 
} = require('../../src/PaymentService/services/CereBlockchainService');
const { DDCAccountUpdateStatus } = require('../../src/PaymentService/models');

describe('CereBlockchainService', () => {
  let cereBlockchainService;
  let sandbox;
  let axiosGetStub;
  let axiosPostStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock axios
    axiosGetStub = sandbox.stub(axios, 'get');
    axiosPostStub = sandbox.stub(axios, 'post');
    
    // Create service instance
    cereBlockchainService = new CereBlockchainService(
      'https://api.test.cere.network',
      'test-api-key'
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getAccountBalance', () => {
    it('should return account balance', async () => {
      // Setup mock
      axiosGetStub.resolves({
        status: 200,
        data: {
          balance: '1000.5'
        }
      });

      const balance = await cereBlockchainService.getAccountBalance('cere123address');
      
      assert.strictEqual(balance, '1000.5');
      assert.strictEqual(axiosGetStub.calledOnce, true);
      assert.strictEqual(
        axiosGetStub.firstCall.args[0], 
        'https://api.test.cere.network/accounts/cere123address/balance'
      );
    });

    it('should throw error when API returns non-200 status', async () => {
      // Setup mock
      axiosGetStub.resolves({
        status: 400,
        statusText: 'Bad Request'
      });

      try {
        await cereBlockchainService.getAccountBalance('cere123address');
        assert.fail('Expected error was not thrown');
      } catch (error) {
        assert.strictEqual(error.message, 'Failed to get account balance: Bad Request');
      }
    });

    it('should propagate API errors', async () => {
      // Setup mock
      axiosGetStub.rejects(new Error('Network error'));

      try {
        await cereBlockchainService.getAccountBalance('cere123address');
        assert.fail('Expected error was not thrown');
      } catch (error) {
        assert.strictEqual(error.message, 'Network error');
      }
    });
  });

  describe('accountExists', () => {
    it('should return true when account exists', async () => {
      // Setup mock
      axiosGetStub.resolves({
        status: 200,
        data: {
          address: 'cere123address'
        }
      });

      const exists = await cereBlockchainService.accountExists('cere123address');
      
      assert.strictEqual(exists, true);
      assert.strictEqual(axiosGetStub.calledOnce, true);
      assert.strictEqual(
        axiosGetStub.firstCall.args[0], 
        'https://api.test.cere.network/accounts/cere123address'
      );
    });

    it('should return false when account does not exist (404)', async () => {
      // Setup mock to simulate 404 response
      const error = new Error('Not Found');
      error.response = { status: 404 };
      axiosGetStub.rejects(error);

      const exists = await cereBlockchainService.accountExists('nonexistent');
      
      assert.strictEqual(exists, false);
    });
  });

  describe('getDDCAccountDetails', () => {
    it('should return DDC account details', async () => {
      // Setup mock
      const mockResponse = {
        status: 200,
        data: {
          ddcAccountId: 'ddc123',
          owner: 'cere123address',
          storage: {
            used: '50',
            total: '1000'
          }
        }
      };
      axiosGetStub.resolves(mockResponse);

      const details = await cereBlockchainService.getDDCAccountDetails('ddc123');
      
      assert.deepStrictEqual(details, mockResponse.data);
      assert.strictEqual(axiosGetStub.calledOnce, true);
      assert.strictEqual(
        axiosGetStub.firstCall.args[0], 
        'https://api.test.cere.network/ddc/accounts/ddc123'
      );
    });
  });

  describe('creditDDCAccount', () => {
    it('should credit DDC account and return transaction hash and new balance', async () => {
      // Setup account exists check
      axiosGetStub.resolves({
        status: 200,
        data: {
          address: 'cere123address'
        }
      });

      // Setup credit API response
      axiosPostStub.resolves({
        status: 201,
        data: {
          txHash: '0x123creditTx',
          newBalance: '1100.5'
        }
      });

      const result = await cereBlockchainService.creditDDCAccount(
        'cere123address',
        'ddc123',
        '100'
      );
      
      assert.deepStrictEqual(result, {
        txHash: '0x123creditTx',
        newBalance: '1100.5'
      });
      
      assert.strictEqual(axiosGetStub.calledOnce, true);
      assert.strictEqual(axiosPostStub.calledOnce, true);
      assert.strictEqual(
        axiosPostStub.firstCall.args[0], 
        'https://api.test.cere.network/ddc/accounts/ddc123/credit'
      );
      assert.deepStrictEqual(
        axiosPostStub.firstCall.args[1], 
        {
          amount: '100',
          senderAddress: 'cere123address'
        }
      );
    });

    it('should throw error when account does not exist', async () => {
      // Setup account exists check to return false
      const error = new Error('Not Found');
      error.response = { status: 404 };
      axiosGetStub.rejects(error);

      try {
        await cereBlockchainService.creditDDCAccount(
          'nonexistent',
          'ddc123',
          '100'
        );
        assert.fail('Expected error was not thrown');
      } catch (error) {
        assert.strictEqual(error.message, 'Account nonexistent does not exist on Cere Network');
      }
      
      // Verify post was not called
      assert.strictEqual(axiosPostStub.called, false);
    });
  });

  describe('checkDDCCreditStatus', () => {
    it('should return COMPLETED status for finalized transactions', async () => {
      // Setup mock
      axiosGetStub.resolves({
        status: 200,
        data: {
          status: 'finalized'
        }
      });

      const status = await cereBlockchainService.checkDDCCreditStatus('0x123creditTx');
      
      assert.strictEqual(status, DDCAccountUpdateStatus.COMPLETED);
      assert.strictEqual(axiosGetStub.calledOnce, true);
      assert.strictEqual(
        axiosGetStub.firstCall.args[0], 
        'https://api.test.cere.network/transactions/0x123creditTx'
      );
    });

    it('should return FAILED status for failed transactions', async () => {
      // Setup mock
      axiosGetStub.resolves({
        status: 200,
        data: {
          status: 'failed'
        }
      });

      const status = await cereBlockchainService.checkDDCCreditStatus('0x123creditTx');
      
      assert.strictEqual(status, DDCAccountUpdateStatus.FAILED);
    });

    it('should return PENDING status for unknown states', async () => {
      // Setup mock
      axiosGetStub.resolves({
        status: 200,
        data: {
          status: 'pending'
        }
      });

      const status = await cereBlockchainService.checkDDCCreditStatus('0x123creditTx');
      
      assert.strictEqual(status, DDCAccountUpdateStatus.PENDING);
    });
  });

  describe('calculateDDCStorage', () => {
    it('should convert CERE tokens to GB of storage', () => {
      const storage = cereBlockchainService.calculateDDCStorage('5.5');
      assert.strictEqual(storage, '55');
    });
  });

  describe('getDDCConversionRate', () => {
    it('should return conversion rate from API', async () => {
      // Setup mock
      axiosGetStub.resolves({
        status: 200,
        data: {
          rate: '12.5'
        }
      });

      const rate = await cereBlockchainService.getDDCConversionRate();
      
      assert.strictEqual(rate, '12.5');
      assert.strictEqual(axiosGetStub.calledOnce, true);
      assert.strictEqual(
        axiosGetStub.firstCall.args[0], 
        'https://api.test.cere.network/ddc/conversion-rate'
      );
    });

    it('should return default rate on error', async () => {
      // Setup mock
      axiosGetStub.rejects(new Error('Network error'));

      const rate = await cereBlockchainService.getDDCConversionRate();
      
      assert.strictEqual(rate, '10');
    });
  });

  describe('createDDCAccountIfNeeded', () => {
    it('should return existing account ID if account exists', async () => {
      // Setup account exists check
      axiosGetStub.onFirstCall().resolves({
        status: 200,
        data: {
          address: 'cere123address'
        }
      });
      
      // Setup account details response
      axiosGetStub.onSecondCall().resolves({
        status: 200,
        data: {
          ddcAccountId: 'existing-ddc-123'
        }
      });

      const ddcAccountId = await cereBlockchainService.createDDCAccountIfNeeded('cere123address');
      
      assert.strictEqual(ddcAccountId, 'existing-ddc-123');
      assert.strictEqual(axiosGetStub.callCount, 2);
      assert.strictEqual(axiosPostStub.called, false);
    });

    it('should create new DDC account if none exists', async () => {
      // Setup account exists check to return false
      const error = new Error('Not Found');
      error.response = { status: 404 };
      axiosGetStub.rejects(error);
      
      // Setup create account response
      axiosPostStub.resolves({
        status: 201,
        data: {
          ddcAccountId: 'new-ddc-456'
        }
      });

      const ddcAccountId = await cereBlockchainService.createDDCAccountIfNeeded('cere123address');
      
      assert.strictEqual(ddcAccountId, 'new-ddc-456');
      assert.strictEqual(axiosPostStub.calledOnce, true);
      assert.strictEqual(
        axiosPostStub.firstCall.args[0], 
        'https://api.test.cere.network/ddc/accounts'
      );
      assert.deepStrictEqual(
        axiosPostStub.firstCall.args[1], 
        {
          ownerAddress: 'cere123address'
        }
      );
    });
  });
}); 