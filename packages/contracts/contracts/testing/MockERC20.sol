// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token contract for testing purposes
 * @dev Allows minting tokens for testing
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;
    
    /**
     * @notice Constructor
     * @param name Name of the token
     * @param symbol Symbol of the token
     * @param decimals_ Number of decimals for the token
     */
    constructor(
        string memory name, 
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) Ownable() {
        _decimals = decimals_;
        // Transferring ownership to deployer in init
        _transferOwnership(msg.sender);
    }
    
    /**
     * @notice Override decimals from ERC20
     * @return Number of decimals for the token
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @notice Mint tokens to an address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Burn tokens from an address
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
} 