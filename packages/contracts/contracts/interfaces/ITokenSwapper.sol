// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITokenSwapper
 * @dev Interface for the contract that handles token exchanges (stablecoins to CERE)
 */
interface ITokenSwapper {
    /// @notice Swaps one token for another using Uniswap V3
    /// @param tokenIn Address of the input token (e.g., USDC/USDT)
    /// @param tokenOut Address of the output token (e.g., CERE)
    /// @param amountIn Amount of input tokens to swap
    /// @param minAmountOut Minimum amount of output tokens expected
    /// @param recipient Address that will receive the output tokens
    /// @param deadline Timestamp deadline for the transaction to be valid
    /// @return amountOut Amount of output tokens received
    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut);
    
    /// @notice Calculates the expected amount of output tokens for a given amount of input tokens
    /// @param tokenIn Address of the input token (e.g., USDC/USDT)
    /// @param tokenOut Address of the output token (e.g., CERE)
    /// @param amountIn Amount of input tokens
    /// @return Expected amount of output tokens
    function getExpectedAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256);
    
    /// @notice Gets the address of the Uniswap router
    /// @return Address of the Uniswap router
    function getUniswapRouter() external view returns (address);
} 