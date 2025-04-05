const assert = require('assert');
const { ethers, Contract, Wallet } = require('ethers');
const sinon = require('sinon');
const { ContractService } = require('../../src/PaymentService/services/ContractService');
const logger = require('../../src/utils/logger');
const { 
  CONTRACT_TOKEN_SWAPPER_ADDRESS,
  CONTRACT_HYPERBRIDGE_ADDRESS,
  CERE_TOKEN_ADDRESS,
  SUPPORTED_STABLECOINS,
  CONTRACT_NETWORK_RPC_URL
} = require('../../src/config/env');

// Mock logger
sinon.stub(logger, 'info');
sinon.stub(logger, 'error');
sinon.stub(logger, 'warn');

// Mock process.env variables used by ContractService constructor
const MOCK_PRIVATE_KEY = '0x' + '1'.repeat(64);
process.env.WALLET_PRIVATE_KEY = MOCK_PRIVATE_KEY;
process.env.CONTRACT_NETWORK_RPC_URL = CONTRACT_NETWORK_RPC_URL || 'http://mock-rpc.com';
process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS = CONTRACT_TOKEN_SWAPPER_ADDRESS || '0xTokenSwapper';
process.env.CONTRACT_HYPERBRIDGE_ADDRESS = CONTRACT_HYPERBRIDGE_ADDRESS || '0xHyperbridge';
process.env.CERE_TOKEN_ADDRESS = CERE_TOKEN_ADDRESS || '0xCereToken';
process.env.USDC_ADDRESS = SUPPORTED_STABLECOINS.USDC || '0xUSDC';
process.env.USDT_ADDRESS = SUPPORTED_STABLECOINS.USDT || '0xUSDT';

describe('ContractService', () => {
  let contractService;
  let sandbox;
  let mockProvider;
  let mockSigner;
  let mockTokenSwapperContract;
  let mockHyperbridgeContract;
  let mockUsdcContract;
  let mockUsdtContract;
  let mockCereContract;

  // Keep track of mocked contract instances created by the constructor
  const mockContracts = {};

  const TEST_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';
  const TX_HASH = '0xabcdef123456';

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Stub ethers components
    mockProvider = sandbox.createStubInstance(ethers.JsonRpcProvider);
    mockSigner = sandbox.createStubInstance(Wallet);
    sandbox.stub(mockSigner, 'address').get(() => TEST_WALLET_ADDRESS);
    mockSigner.connect.returns(mockSigner);

    // --- Intercept Contract Instantiation --- 
    // Store original
    const originalContract = ethers.Contract;
    // Stub the constructor
    const contractStub = sandbox.stub(ethers, 'Contract').callsFake(
      (address, abi, providerOrSigner) => {
        // Create a stubbed instance for this contract address if not already created
        if (!mockContracts[address]) {
            const specificMock = sandbox.createStubInstance(originalContract);
            // Mock the connect method for contracts too
            specificMock.connect.returns(specificMock);
            mockContracts[address] = specificMock;
            
            // Assign to named mocks based on address for easier access in tests
            if (address === process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS) mockTokenSwapperContract = specificMock;
            if (address === process.env.CONTRACT_HYPERBRIDGE_ADDRESS) mockHyperbridgeContract = specificMock;
            if (address === process.env.USDC_ADDRESS) mockUsdcContract = specificMock;
            if (address === process.env.USDT_ADDRESS) mockUsdtContract = specificMock;
            if (address === process.env.CERE_TOKEN_ADDRESS) mockCereContract = specificMock;
        }
        // Return the stubbed instance for this address
        return mockContracts[address];
    });

    // --- Intercept Provider and Wallet Instantiation ---
    sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider);
    sandbox.stub(ethers, 'Wallet').returns(mockSigner);

    // Instantiate the service - this will trigger the mocked constructors
    contractService = new ContractService();
  });

  afterEach(() => {
    sandbox.restore();
    // Clear mocked contracts cache
    Object.keys(mockContracts).forEach(key => delete mockContracts[key]);
    // Reset potentially modified process.env
    delete process.env.WALLET_PRIVATE_KEY;
  });

  describe('Constructor & Initialization', () => {
    it('should initialize provider and signer', () => {
      assert.strictEqual(ethers.JsonRpcProvider.calledOnceWith(process.env.CONTRACT_NETWORK_RPC_URL), true);
      assert.strictEqual(ethers.Wallet.calledOnceWith(MOCK_PRIVATE_KEY, mockProvider), true);
      assert.strictEqual(contractService.provider, mockProvider);
      assert.strictEqual(contractService.signer, mockSigner);
    });

    it('should initialize contracts with correct addresses and signer/provider', () => {
      // Check that ethers.Contract was called for each expected contract
      assert.strictEqual(ethers.Contract.calledWith(process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS, sinon.match.array, mockProvider), true);
      assert.strictEqual(ethers.Contract.calledWith(process.env.CONTRACT_HYPERBRIDGE_ADDRESS, sinon.match.array, mockProvider), true);
      assert.strictEqual(ethers.Contract.calledWith(process.env.USDC_ADDRESS, sinon.match.array, mockProvider), true);
      assert.strictEqual(ethers.Contract.calledWith(process.env.USDT_ADDRESS, sinon.match.array, mockProvider), true);
      // Check internal references
      assert.strictEqual(contractService.tokenSwapperContract, mockTokenSwapperContract);
      assert.strictEqual(contractService.hyperbridgeContract, mockHyperbridgeContract);
      assert.strictEqual(contractService.stablecoinContracts['USDC'], mockUsdcContract);
      assert.strictEqual(contractService.stablecoinContracts['USDT'], mockUsdtContract);
    });

    it('should handle missing optional contract addresses', () => {
      sandbox.restore(); // Clean slate
      sandbox = sinon.createSandbox();
      // Redo basic setup
      mockProvider = sandbox.createStubInstance(ethers.JsonRpcProvider);
      mockSigner = sandbox.createStubInstance(Wallet);
      sandbox.stub(ethers, 'JsonRpcProvider').returns(mockProvider);
      sandbox.stub(ethers, 'Wallet').returns(mockSigner);
      const contractStub = sandbox.stub(ethers, 'Contract').returns(sandbox.createStubInstance(Contract));
      
      // Unset an optional address
      const originalHyperbridgeAddress = process.env.CONTRACT_HYPERBRIDGE_ADDRESS;
      delete process.env.CONTRACT_HYPERBRIDGE_ADDRESS; 

      new ContractService(); // Re-instantiate

      // Check that Contract constructor was NOT called for the missing address
      assert.strictEqual(contractStub.calledWith(originalHyperbridgeAddress, sinon.match.any, sinon.match.any), false);
      assert.strictEqual(contractStub.calledWith(process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS, sinon.match.any, sinon.match.any), true);

      process.env.CONTRACT_HYPERBRIDGE_ADDRESS = originalHyperbridgeAddress; // Restore env
    });
  });

  describe('getExpectedCereAmount', () => {
    const amount = '100';
    const amountInWei = ethers.parseUnits(amount, 6);
    const expectedOutWei = ethers.parseUnits('950', 18);

    it('should return expected CERE amount for USDC', async () => {
      mockTokenSwapperContract.getExpectedAmountOut.resolves(expectedOutWei);

      const result = await contractService.getExpectedCereAmount('USDC', amount);

      assert.strictEqual(result, '950.0');
      assert.strictEqual(mockTokenSwapperContract.getExpectedAmountOut.calledOnceWith(
        process.env.USDC_ADDRESS,
        process.env.CERE_TOKEN_ADDRESS,
        amountInWei
      ), true);
    });

    it('should throw if swapper contract not initialized', async () => {
      contractService.tokenSwapperContract = null; // Simulate missing contract
      
      try {
        await contractService.getExpectedCereAmount('USDC', amount);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Token swapper contract not initialized');
      }
    });

    it('should throw for unsupported stablecoin', async () => {
      try {
        await contractService.getExpectedCereAmount('DAI', amount);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Unsupported stablecoin: DAI');
      }
    });
  });

  describe('checkTeleportStatus', () => {
    const txId = '0xteleport123';

    it('should return status from hyperbridge contract', async () => {
      mockHyperbridgeContract.checkTeleportStatus.resolves(2); // Simulate COMPLETED status
      const result = await contractService.checkTeleportStatus(txId);
      assert.strictEqual(result, 2);
      assert.strictEqual(mockHyperbridgeContract.checkTeleportStatus.calledOnceWith(txId), true);
    });

    it('should throw if hyperbridge contract not initialized', async () => {
      contractService.hyperbridgeContract = null;
      
      try {
        await contractService.checkTeleportStatus(txId);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.message, 'Hyperbridge contract not initialized');
      }
    });
  });
  
  describe('processPayment', () => {
    it('should approve and process payment', async () => {
      // Setup
      const stablecoinSymbol = 'USDC';
      const amount = '100';
      const destinationAddress = 'cere1234567890123456789012345678901234567890';
      const amountInWei = ethers.parseUnits(amount, 6);

      // Mock contract calls
      mockUsdcContract.approve.resolves({ hash: '0xtransactionhash_approve', wait: sinon.stub().resolves({ status: 1 }) });
      
      // This would be a call to your payment handler contract - adjust based on actual implementation
      mockTokenSwapperContract.processPayment = sinon.stub().resolves({
        hash: '0xtransactionhash_payment',
        wait: sinon.stub().resolves({
          status: 1,
          logs: [{
            topics: ['0xPaymentEvent'],
            args: { paymentId: 'payment-id-from-event' }
          }]
        })
      });

      const result = await contractService.processPayment(stablecoinSymbol, amount, destinationAddress);

      // Verify approve was called with correct parameters
      assert.strictEqual(mockUsdcContract.approve.calledWith(
        process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS,
        amountInWei
      ), true);
      
      // Verify payment processing was called with correct parameters
      assert.strictEqual(mockTokenSwapperContract.processPayment.calledWith(
        process.env.USDC_ADDRESS,
        amountInWei,
        destinationAddress
      ), true);
      
      // Verify result contains expected properties
      assert.strictEqual(result.txHash, '0xtransactionhash_payment');
      assert.strictEqual(result.paymentId, 'payment-id-from-event');
    });
  });

  describe('swapTokens', () => {
    it('should approve and swap tokens', async () => {
      // Setup
      const stablecoinSymbol = 'USDC';
      const amount = '100';
      const amountInWei = ethers.parseUnits(amount, 6);
      const expectedCereAmount = ethers.parseUnits('10', 18);

      // Mock contract calls
      mockUsdcContract.approve.resolves({ hash: '0xtransactionhash_approve', wait: sinon.stub().resolves({ status: 1 }) });
      mockTokenSwapperContract.getExpectedAmountOut.resolves(expectedCereAmount);
      mockTokenSwapperContract.swapExactTokensForTokens.resolves({
        hash: '0xtransactionhash_swap',
        wait: sinon.stub().resolves({
          status: 1,
          logs: [{
            topics: ['0xSwapEvent'],
            args: { amountOut: expectedCereAmount }
          }]
        })
      });

      const result = await contractService.swapTokens(stablecoinSymbol, amount);

      // Verify approve was called
      assert.strictEqual(mockUsdcContract.approve.calledWith(
        process.env.CONTRACT_TOKEN_SWAPPER_ADDRESS,
        amountInWei
      ), true);
      
      // Verify swap was called
      assert.strictEqual(mockTokenSwapperContract.swapExactTokensForTokens.calledWith(
        process.env.USDC_ADDRESS,
        process.env.CERE_TOKEN_ADDRESS,
        amountInWei,
        sinon.match.any // Minimum amount out
      ), true);
      
      // Verify result
      assert.strictEqual(result.txHash, '0xtransactionhash_swap');
      assert.strictEqual(result.cereAmount, '10.0');
    });
  });

  describe('teleportTokens', () => {
    it('should approve and teleport tokens', async () => {
      // Setup
      const cereAmount = '10';
      const cereAmountWei = ethers.parseUnits(cereAmount, 18);
      const destinationAddress = 'cere1234567890123456789012345678901234567890';

      // Mock contract calls
      mockCereContract.approve.resolves({ hash: '0xtransactionhash_approve', wait: sinon.stub().resolves({ status: 1 }) });
      mockHyperbridgeContract.teleportToCereNetwork.resolves({
        hash: '0xtransactionhash_teleport',
        wait: sinon.stub().resolves({
          status: 1,
          logs: [{
            topics: ['0xTeleportEvent'],
            args: { teleportId: 'teleport-id-from-event' }
          }]
        })
      });

      const result = await contractService.teleportTokens(cereAmount, destinationAddress);

      // Verify approve was called
      assert.strictEqual(mockCereContract.approve.calledWith(
        process.env.CONTRACT_HYPERBRIDGE_ADDRESS,
        cereAmountWei
      ), true);
      
      // Verify teleport was called
      assert.strictEqual(mockHyperbridgeContract.teleportToCereNetwork.calledWith(
        cereAmountWei,
        destinationAddress
      ), true);
      
      // Verify result
      assert.strictEqual(result.txHash, '0xtransactionhash_teleport');
      assert.strictEqual(result.teleportId, 'teleport-id-from-event');
    });
  });
}); 