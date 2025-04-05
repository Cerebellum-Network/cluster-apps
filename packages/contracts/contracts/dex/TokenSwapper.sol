// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../interfaces/IERC20Extended.sol";
import "../interfaces/ITokenSwapper.sol";

/**
 * @title TokenSwapper
 * @notice Contract that handles the exchange of stablecoin tokens for CERE using Uniswap V3
 * @dev Implements the ITokenSwapper interface and uses the Uniswap V3 SwapRouter
 */
contract TokenSwapper is ITokenSwapper, Ownable {
    using SafeERC20 for IERC20Extended;
    
    // Uniswap V3 Router address - marked as immutable to save gas
    ISwapRouter public immutable swapRouter;
    
    // Uniswap V3 Factory address - constant for frequent references
    address private constant UNISWAP_V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    
    // Mapping of token pairs to pool fees
    // tokenIn => tokenOut => poolFee
    mapping(address => mapping(address => uint24)) public poolFees;
    
    // Default pool fee if not specified (0.3%)
    uint24 public constant DEFAULT_POOL_FEE = 3000;
    
    // Constants for precision calculations
    uint256 private constant PRECISION_MULTIPLIER = 1e6;
    
    // Events
    event TokensSwapped(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );
    
    event PoolFeeSet(
        address indexed tokenIn,
        address indexed tokenOut,
        uint24 fee
    );
    
    /**
     * @notice Constructor
     * @param _swapRouter Address of the Uniswap V3 SwapRouter
     */
    constructor(address _swapRouter) {
        require(_swapRouter != address(0), "Invalid swap router address");
        swapRouter = ISwapRouter(_swapRouter);
    }
    
    /**
     * @notice Sets the pool fee for a token pair
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param fee Pool fee in hundredths of a bip (e.g. 3000 = 0.3%)
     */
    function setPoolFee(address tokenIn, address tokenOut, uint24 fee) external onlyOwner {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token address");
        require(fee > 0, "Fee must be greater than 0");
        
        poolFees[tokenIn][tokenOut] = fee;
        emit PoolFeeSet(tokenIn, tokenOut, fee);
    }
    
    /**
     * @notice Gets the pool fee for a token pair
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @return Fee for the token pair
     */
    function getPoolFee(address tokenIn, address tokenOut) public view returns (uint24) {
        uint24 fee = poolFees[tokenIn][tokenOut];
        return fee > 0 ? fee : DEFAULT_POOL_FEE;
    }
    
    /**
     * @notice Swaps tokens using Uniswap V3
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param amountIn Amount of input tokens to swap
     * @param amountOutMinimum Minimum amount of output tokens expected
     * @param recipient Address that will receive the output tokens
     * @param deadline Timestamp deadline for the transaction to be valid
     * @return amountOut Amount of output tokens received
     */
    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient,
        uint256 deadline
    ) external override returns (uint256 amountOut) {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token address");
        require(recipient != address(0), "Invalid recipient");
        require(amountIn > 0, "Amount must be greater than 0");
        require(block.timestamp <= deadline, "Transaction deadline expired");
        
        // Transfer tokens from sender to this contract
        IERC20Extended(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve the router to spend the tokens
        IERC20Extended(tokenIn).safeApprove(address(swapRouter), amountIn);
        
        // Get the pool fee
        uint24 poolFee = getPoolFee(tokenIn, tokenOut);
        
        // Set up the parameters for the swap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: poolFee,
            recipient: recipient,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });
        
        // Execute the swap
        amountOut = swapRouter.exactInputSingle(params);
        
        // Emit event
        emit TokensSwapped(tokenIn, tokenOut, amountIn, amountOut, recipient);
        
        return amountOut;
    }
    
    /**
     * @notice Gets the expected amount out for a token swap
     * @param tokenIn Address of the input token
     * @param tokenOut Address of the output token
     * @param amountIn Amount of input tokens
     * @return expectedAmountOut Expected amount of output tokens
     */
    function getExpectedAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 expectedAmountOut) {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token address");
        require(amountIn > 0, "Amount must be greater than 0");
        
        // Optimization: Use the defined constant instead of hardcoding the address
        IUniswapV3Factory factory = IUniswapV3Factory(UNISWAP_V3_FACTORY);
        
        // Get the pool fee
        uint24 poolFee = getPoolFee(tokenIn, tokenOut);
        
        // Get the pool address
        address poolAddress = factory.getPool(tokenIn, tokenOut, poolFee);
        
        // If the pool doesn't exist, return 0
        if (poolAddress == address(0)) {
            return 0;
        }
        
        // Get the pool
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        
        try pool.slot0() returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        ) {
            // Use temporary variables for price calculation
            uint256 price;
            uint8 decimalsIn;
            uint8 decimalsOut;
            
            // Cache sqrtPriceX96 to avoid multiple reads of the stack value
            uint160 sqrtPrice = sqrtPriceX96;
            
            // If sqrtPrice is 0, avoid division by zero
            if (sqrtPrice == 0) return 0;
            
            // Convert tick to price - calculation optimization
            unchecked {
                // Using unchecked for safe math operations that cannot exceed limits
                price = uint256(1 << 96);
                price = price * price / uint256(sqrtPrice) / uint256(sqrtPrice);
            }
            
            try IERC20Extended(tokenIn).decimals() returns (uint8 _decimalsIn) {
                decimalsIn = _decimalsIn;
            } catch {
                // Default to 18 if the call to decimals() fails
                decimalsIn = 18;
            }
            
            try IERC20Extended(tokenOut).decimals() returns (uint8 _decimalsOut) {
                decimalsOut = _decimalsOut;
            } catch {
                // Default to 18 if the call to decimals() fails
                decimalsOut = 18;
            }
            
            // Decimal adjustment - optimized to avoid complex logic
            if (decimalsIn > decimalsOut) {
                unchecked {
                    price = price * (10 ** (decimalsIn - decimalsOut));
                }
            } else if (decimalsOut > decimalsIn) {
                unchecked {
                    price = price / (10 ** (decimalsOut - decimalsIn));
                }
            }
            
            // Calculate the expected output amount - optimization to avoid precision loss
            unchecked {
                // First multiply by the price and then adjust precision to avoid rounding to 0
                expectedAmountOut = (amountIn * price) / (1 << 192);
                
                // Adjust for pool fee
                expectedAmountOut = expectedAmountOut * (PRECISION_MULTIPLIER - poolFee) / PRECISION_MULTIPLIER;
            }
            
            return expectedAmountOut;
        } catch {
            // If the call to slot0 fails, return 0
            return 0;
        }
    }
    
    /**
     * @notice Get the address of the Uniswap router
     * @return Address of the Uniswap router
     */
    function getUniswapRouter() external view override returns (address) {
        return address(swapRouter);
    }
    
    /**
     * @notice Recover ERC20 tokens sent by error to the contract
     * @param token Address of the token to recover
     * @return Success of the operation
     */
    function recoverERC20(address token) external onlyOwner returns (bool) {
        uint256 balance = IERC20Extended(token).balanceOf(address(this));
        IERC20Extended(token).safeTransfer(owner(), balance);
        return true;
    }
} 