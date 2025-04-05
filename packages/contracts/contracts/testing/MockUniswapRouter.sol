// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IERC20Extended.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/**
 * @title MockUniswapRouter
 * @notice Mock version of Uniswap V3 router for testing purposes
 * @dev Simulates token swaps with configurable exchange rates
 */
contract MockUniswapRouter is Ownable {
    using SafeERC20 for IERC20Extended;
    
    // Mapping of token pairs to exchange rates (scaled by 1e18)
    // tokenIn => tokenOut => exchangeRate
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    // Event emitted when an exchange rate is set
    event ExchangeRateSet(address tokenIn, address tokenOut, uint256 rate);
    
    // Event emitted when a swap occurs
    event SwapExecuted(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );
    
    /**
     * @notice Constructor
     */
    constructor() Ownable() {
        // Transferring ownership to deployer in init
        _transferOwnership(msg.sender);
    }
    
    /**
     * @notice Sets the exchange rate between two tokens
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param rate Exchange rate (scaled by 1e18)
     */
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external onlyOwner {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token address");
        require(rate > 0, "Rate must be greater than 0");
        
        exchangeRates[tokenIn][tokenOut] = rate;
        emit ExchangeRateSet(tokenIn, tokenOut, rate);
    }
    
    /**
     * @notice Gets the exchange rate between two tokens
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @return Exchange rate (scaled by 1e18)
     */
    function getExchangeRate(address tokenIn, address tokenOut) external view returns (uint256) {
        return exchangeRates[tokenIn][tokenOut];
    }
    
    /**
     * @notice Mock implementation of Uniswap's exactInputSingle function
     * @param params Swap parameters
     * @return amountOut Amount of output tokens
     */
    function exactInputSingle(
        ISwapRouter.ExactInputSingleParams calldata params
    ) external returns (uint256 amountOut) {
        // Check exchange rate exists
        uint256 rate = exchangeRates[params.tokenIn][params.tokenOut];
        require(rate > 0, "Exchange rate not set");
        
        // Calculate output amount based on exchange rate and decimals difference
        uint8 decimalsIn = IERC20Extended(params.tokenIn).decimals();
        uint8 decimalsOut = IERC20Extended(params.tokenOut).decimals();
        
        // Adjust for decimal difference and apply exchange rate
        if (decimalsIn > decimalsOut) {
            uint256 decimalsDiff = decimalsIn - decimalsOut;
            amountOut = (params.amountIn * rate) / (10 ** (18 + decimalsDiff));
        } else if (decimalsOut > decimalsIn) {
            uint256 decimalsDiff = decimalsOut - decimalsIn;
            amountOut = (params.amountIn * rate * (10 ** decimalsDiff)) / (10 ** 18);
        } else {
            amountOut = (params.amountIn * rate) / (10 ** 18);
        }
        
        // Ensure minimum amount out is respected
        require(amountOut >= params.amountOutMinimum, "Insufficient output amount");
        
        // Transfer input tokens from sender to this contract
        IERC20Extended(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        
        // Transfer output tokens from this contract to recipient
        IERC20Extended(params.tokenOut).safeTransfer(params.recipient, amountOut);
        
        // Emit event
        emit SwapExecuted(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            params.recipient
        );
        
        return amountOut;
    }
    
    /**
     * @notice Mock implementation of Uniswap's exactInput function
     * @param params Swap parameters
     * @return amountOut Amount of output tokens
     */
    function exactInput(
        ISwapRouter.ExactInputParams calldata params
    ) external returns (uint256 amountOut) {
        // This is a simplified implementation that only supports direct swaps
        // For multi-hop paths, would need to decode the path and execute multiple swaps
        
        // For simplicity, we'll just revert for multi-hop paths
        revert("Multi-hop swaps not supported in mock");
    }
    
    /**
     * @notice Withdraw tokens from the contract (for testing purposes)
     * @param token Address of the token to withdraw
     * @param amount Amount to withdraw
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20Extended(token).safeTransfer(owner(), amount);
    }
} 