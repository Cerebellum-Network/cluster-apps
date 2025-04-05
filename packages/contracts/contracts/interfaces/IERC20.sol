// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// No es necesario importar OpenZeppelin IERC20 porque lo estamos redefiniendo
// con nuestras propias funciones

/**
 * @title IERC20 Interface
 * @dev Basic interface for ERC20 tokens that we need for our operations
 */
interface IERC20 {
    /// @notice Get the balance of an address
    function balanceOf(address account) external view returns (uint256);
    
    /// @notice Get the total supply of the token
    function totalSupply() external view returns (uint256);
    
    /// @notice Get the allowance of an address for a spender
    function allowance(address owner, address spender) external view returns (uint256);
    
    /// @notice Transfer tokens to an address
    function transfer(address to, uint256 amount) external returns (bool);
    
    /// @notice Transfer tokens from one address to another (requires approval)
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    /// @notice Approve a spender to spend tokens
    function approve(address spender, uint256 amount) external returns (bool);
    
    /// @notice Event emitted when tokens are transferred
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    /// @notice Event emitted when a spender is approved
    event Approval(address indexed owner, address indexed spender, uint256 value);
} 