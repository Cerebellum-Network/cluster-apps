// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IERC20Extended
 * @dev Extended interface for ERC20 tokens with decimals function
 * This extends the standard OpenZeppelin IERC20 interface
 */
interface IERC20Extended is IERC20 {
    /// @notice Get the number of decimals for the token
    function decimals() external view returns (uint8);
} 