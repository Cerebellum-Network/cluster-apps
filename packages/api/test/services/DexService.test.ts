// Ensure devDependencies include: @types/sinon, @types/sinon-chai
const assert = require('assert');
const { ethers, Contract, Wallet, Provider, Signer, ContractTransactionResponse, BigNumberish } = require('ethers');
const sinon = require('sinon');
const { DexService } = require('../../src/services/DexService'); // Adjust path if needed
const logger = require('../../src/utils/logger'); // Adjust path if needed

// Mock logger
sinon.stub(logger, 'info');
sinon.stub(logger, 'error');
sinon.stub(logger, 'warn');

const MOCK_TOKEN_SWAPPER_ADDRESS = '0xMockTokenSwapper123';
const TOKEN_IN_ADDRESS = '0xTokenInAddress';
const TOKEN_OUT_ADDRESS = '0xTokenOutAddress';
const RECIPIENT_ADDRESS = '0xRecipientAddress';
const TX_HASH = '0xTransactionHash123';

describe('DexService', () => {
  let dexService;
  let sandbox;
  let mockProvider;
  let mockSigner;
  let mockTokenSwapperContract;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup mock provider and signer
    mockProvider = sandbox.createStubInstance(ethers.JsonRpcProvider);
    mockSigner = sandbox.createStubInstance(Wallet);
    mockSigner.connect.returns(mockSigner);
    
    // Set up mock token swapper contract
    mockTokenSwapperContract = sandbox.createStubInstance(Contract);
    sandbox.stub(ethers, 'Contract').returns(mockTokenSwapperContract);
    
    // Create the service with the mocked provider
    dexService = new DexService(mockProvider, MOCK_TOKEN_SWAPPER_ADDRESS);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize with provider and contract address', () => {
      assert.strictEqual(dexService.provider, mockProvider);
      assert.strictEqual(ethers.Contract.calledOnce, true);
    });

    it('should throw if provider is not provided', () => {
      assert.throws(() => {
        new DexService(null, MOCK_TOKEN_SWAPPER_ADDRESS);
      }, /Provider is required/);
    });

    it('should throw if swapper address is not provided', () => {
      assert.throws(() => {
        new DexService(mockProvider, null);
      }, /Token swapper address is required/);
    });
  });

  describe('getExpectedAmountOut', () => {
    it('should return the expected amount out from the swap', async () => {
      const amountIn = ethers.parseUnits('100', 6); // 100 USDC (6 decimals)
      const expectedAmountOut = ethers.parseUnits('50', 18); // 50 CERE (18 decimals)
      
      mockTokenSwapperContract.getExpectedAmountOut.resolves(expectedAmountOut);
      
      const result = await dexService.getExpectedAmountOut(
        TOKEN_IN_ADDRESS,
        TOKEN_OUT_ADDRESS,
        amountIn
      );
      
      assert.strictEqual(result.toString(), expectedAmountOut.toString());
      assert.strictEqual(mockTokenSwapperContract.getExpectedAmountOut.calledOnceWith(
        TOKEN_IN_ADDRESS,
        TOKEN_OUT_ADDRESS,
        amountIn
      ), true);
    });

    it('should handle errors from the contract call', async () => {
      const amountIn = ethers.parseUnits('100', 6);
      const errorMessage = 'Insufficient liquidity';
      
      mockTokenSwapperContract.getExpectedAmountOut.rejects(new Error(errorMessage));
      
      try {
        await dexService.getExpectedAmountOut(TOKEN_IN_ADDRESS, TOKEN_OUT_ADDRESS, amountIn);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, errorMessage);
      }
    });
  });

  describe('swapExactTokensForTokens', () => {
    it('should swap tokens and return transaction receipt', async () => {
      const amountIn = ethers.parseUnits('100', 6); // 100 USDC
      const minAmountOut = ethers.parseUnits('45', 18); // Minimum 45 CERE expected
      const mockTxResponse = {
        hash: TX_HASH,
        wait: sinon.stub().resolves({
          status: 1,
          logs: [{
            args: {
              amountOut: ethers.parseUnits('50', 18) // Actually got 50 CERE
            }
          }]
        })
      };
      
      mockTokenSwapperContract.swapExactTokensForTokens.resolves(mockTxResponse);
      dexService.setSigner(mockSigner);
      
      const result = await dexService.swapExactTokensForTokens(
        TOKEN_IN_ADDRESS,
        TOKEN_OUT_ADDRESS,
        amountIn,
        minAmountOut,
        RECIPIENT_ADDRESS
      );
      
      assert.strictEqual(result.transactionHash, TX_HASH);
      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.amountOut, ethers.parseUnits('50', 18).toString());
      assert.strictEqual(mockTokenSwapperContract.swapExactTokensForTokens.calledOnceWith(
        TOKEN_IN_ADDRESS,
        TOKEN_OUT_ADDRESS,
        amountIn,
        minAmountOut,
        RECIPIENT_ADDRESS
      ), true);
    });

    it('should throw if no signer is set', async () => {
      const amountIn = ethers.parseUnits('100', 6);
      const minAmountOut = ethers.parseUnits('45', 18);
      
      try {
        await dexService.swapExactTokensForTokens(
          TOKEN_IN_ADDRESS,
          TOKEN_OUT_ADDRESS,
          amountIn,
          minAmountOut,
          RECIPIENT_ADDRESS
        );
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Signer is required for this operation');
      }
    });

    it('should handle failed transactions', async () => {
      const amountIn = ethers.parseUnits('100', 6);
      const minAmountOut = ethers.parseUnits('45', 18);
      const mockTxResponse = {
        hash: TX_HASH,
        wait: sinon.stub().resolves({
          status: 0 // Failed transaction
        })
      };
      
      mockTokenSwapperContract.swapExactTokensForTokens.resolves(mockTxResponse);
      dexService.setSigner(mockSigner);
      
      try {
        await dexService.swapExactTokensForTokens(
          TOKEN_IN_ADDRESS,
          TOKEN_OUT_ADDRESS,
          amountIn,
          minAmountOut,
          RECIPIENT_ADDRESS
        );
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Transaction failed');
      }
    });
  });

  describe('setSigner', () => {
    it('should set the signer and connect the contract to it', () => {
      dexService.setSigner(mockSigner);
      
      assert.strictEqual(dexService.signer, mockSigner);
      assert.strictEqual(mockTokenSwapperContract.connect.calledOnceWith(mockSigner), true);
    });
  });

  describe('getPoolFee', () => {
    const poolFee = 3000; 
    it('should return pool fee from contract', async () => {
      mockTokenSwapperContract.getPoolFee.resolves(poolFee);
      const result = await dexService.getPoolFee(TOKEN_IN_ADDRESS, TOKEN_OUT_ADDRESS);
      assert.strictEqual(result, poolFee);
      assert.strictEqual(mockTokenSwapperContract.getPoolFee.calledOnceWith(TOKEN_IN_ADDRESS, TOKEN_OUT_ADDRESS), true);
    });

    it('should throw and log error if contract call fails', async () => {
      const contractError = new Error('Fee query failed');
      mockTokenSwapperContract.getPoolFee.rejects(contractError);
      
      try {
        await dexService.getPoolFee(TOKEN_IN_ADDRESS, TOKEN_OUT_ADDRESS);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Fee query failed');
        assert.strictEqual(logger.error.calledWith('Failed to get pool fee', sinon.match.has('error', contractError.message)), true);
      }
    });
  });

  describe('getUniswapRouter', () => {
    const routerAddress = '0xUniswapRouterAddress';
    it('should return router address from contract', async () => {
      mockTokenSwapperContract.getUniswapRouter.resolves(routerAddress);
      const result = await dexService.getUniswapRouter();
      assert.strictEqual(result, routerAddress);
      assert.strictEqual(mockTokenSwapperContract.getUniswapRouter.calledOnce, true);
    });

    it('should throw and log error if contract call fails', async () => {
      const contractError = new Error('Router query failed');
      mockTokenSwapperContract.getUniswapRouter.rejects(contractError);
      
      try {
        await dexService.getUniswapRouter();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Router query failed');
        assert.strictEqual(logger.error.calledWith('Failed to get Uniswap router address', sinon.match.has('error', contractError.message)), true);
      }
    });
  });
}); 