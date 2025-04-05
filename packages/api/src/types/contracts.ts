import { BaseContract, ContractTransactionResponse, BigNumberish } from 'ethers';

export interface IERC20 extends BaseContract {
  approve(spender: string, amount: BigNumberish): Promise<ContractTransactionResponse>;
  allowance(owner: string, spender: string): Promise<BigNumberish>;
  balanceOf(account: string): Promise<BigNumberish>;
  decimals(): Promise<number>;
}

export interface IHyperbridgeTeleport extends BaseContract {
  teleportToCereNetwork(
    amount: BigNumberish,
    cereNetworkAddress: string
  ): Promise<ContractTransactionResponse>;

  checkTeleportStatus(txId: string): Promise<number>;

  getCereTokenAddress(): Promise<string>;
}

export interface ITokenSwapper extends BaseContract {
  swapExactTokensForTokens(
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumberish,
    amountOutMin: BigNumberish,
    to: string,
    deadline: BigNumberish
  ): Promise<ContractTransactionResponse>;

  getExpectedAmountOut(
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumberish
  ): Promise<BigNumberish>;

  getPoolFee(
    tokenIn: string,
    tokenOut: string
  ): Promise<BigNumberish>;

  getUniswapRouter(): Promise<string>;
} 