import { ethers, Provider, Signer, Contract, BigNumberish } from 'ethers';
import { ITokenSwapper } from '../../types/contracts';
import { logger } from '../../utils/logger';

// ABI for TokenSwapper contract
const TOKEN_SWAPPER_ABI = [
  'function swapExactTokensForTokens(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMinimum, address recipient, uint256 deadline) external returns (uint256 amountOut)',
  'function getExpectedAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)',
  'function getPoolFee(address tokenIn, address tokenOut) external view returns (uint24)',
  'function getUniswapRouter() external view returns (address)'
];

export class DexService {
  private tokenSwapperContract: Contract & ITokenSwapper;

  constructor(
    private provider: Provider,
    private tokenSwapperAddress: string
  ) {
    this.tokenSwapperContract = new Contract(
      tokenSwapperAddress,
      TOKEN_SWAPPER_ABI,
      provider
    ) as Contract & ITokenSwapper;
  }

  /**
   * Swaps exact amount of input tokens for output tokens
   * @param amountIn Amount of input tokens to swap (in base units)
   * @param amountOutMin Minimum amount of output tokens to receive (in base units)
   * @param tokenIn Address of input token
   * @param tokenOut Address of output token
   * @param recipient Address that will receive the output tokens
   * @param signer Signer to execute the transaction
   * @returns Transaction response
   */
  async swapExactTokensForTokens(
    amountIn: string,
    amountOutMin: string,
    tokenIn: string,
    tokenOut: string,
    recipient: string,
    signer: Signer
  ): Promise<ethers.ContractTransactionResponse> {
    try {
      // Connect contract with signer
      const swapperWithSigner = this.tokenSwapperContract.connect(signer) as Contract & ITokenSwapper;

      // Calculate deadline (30 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 30 * 60;

      logger.info('Executing token swap', {
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        recipient
      });

      // Execute the swap
      const tx = await swapperWithSigner.swapExactTokensForTokens(
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        recipient,
        deadline
      );

      logger.info('Swap transaction submitted', { txHash: tx.hash });
      return tx;
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to execute token swap', {
        error: error.message,
        tokenIn,
        tokenOut,
        amountIn
      });
      throw error;
    }
  }

  /**
   * Gets the expected amount of output tokens for a given input amount
   * @param tokenIn Address of input token
   * @param tokenOut Address of output token
   * @param amountIn Amount of input tokens (in base units)
   * @returns Expected amount of output tokens (in base units)
   */
  async getExpectedAmountOut(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<string> {
    try {
      const expectedAmount = await this.tokenSwapperContract.getExpectedAmountOut(
        tokenIn,
        tokenOut,
        amountIn
      );
      return expectedAmount.toString();
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to get expected amount out', {
        error: error.message,
        tokenIn,
        tokenOut,
        amountIn
      });
      throw error;
    }
  }

  /**
   * Gets the pool fee for a token pair
   * @param tokenIn Address of input token
   * @param tokenOut Address of output token
   * @returns Pool fee in basis points (e.g., 3000 = 0.3%)
   */
  async getPoolFee(tokenIn: string, tokenOut: string): Promise<number> {
    try {
      const fee = await this.tokenSwapperContract.getPoolFee(tokenIn, tokenOut);
      return Number(fee);
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to get pool fee', {
        error: error.message,
        tokenIn,
        tokenOut
      });
      throw error;
    }
  }

  /**
   * Gets the Uniswap router address used by the swapper
   * @returns Uniswap router address
   */
  async getUniswapRouter(): Promise<string> {
    try {
      return await this.tokenSwapperContract.getUniswapRouter();
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to get Uniswap router address', {
        error: error.message
      });
      throw error;
    }
  }
} 