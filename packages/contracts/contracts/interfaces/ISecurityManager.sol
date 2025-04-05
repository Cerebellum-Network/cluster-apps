// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISecurityManager
 * @dev Interface for the contract that manages system security, including emergency pause,
 * transaction limits, and suspicious activity monitoring.
 */
interface ISecurityManager {
    /**
     * @notice Checks if an address is blacklisted
     * @param account Address to check
     * @return true if the address is blacklisted
     */
    function isBlacklisted(address account) external view returns (bool);
    
    /**
     * @notice Checks if the system is paused
     * @return true if the system is paused
     */
    function isPaused() external view returns (bool);
    
    /**
     * @notice Checks if an address has exceeded transaction limits
     * @param account Address to check
     * @param amount Amount to transfer
     * @return true if the address can transact
     */
    function canTransact(address account, uint256 amount) external view returns (bool);
    
    /**
     * @notice Records a transaction for an address
     * @param account Address making the transaction
     * @param amount Transaction amount
     */
    function recordTransaction(address account, uint256 amount) external;
    
    /**
     * @notice Activates emergency pause mode
     */
    function pauseSystem() external;
    
    /**
     * @notice Deactivates emergency pause mode
     */
    function unpauseSystem() external;
    
    /**
     * @notice Adds an address to the blacklist
     * @param account Address to add
     */
    function blacklistAddress(address account) external;
    
    /**
     * @notice Removes an address from the blacklist
     * @param account Address to remove
     */
    function unblacklistAddress(address account) external;
    
    /**
     * @notice Sets transaction limits for an address
     * @param account Address for which limits are defined
     * @param dailyLimit Daily limit
     * @param transactionLimit Limit per transaction
     */
    function setTransactionLimits(address account, uint256 dailyLimit, uint256 transactionLimit) external;
    
    /**
     * @notice Event emitted when suspicious activity is detected
     */
    event SuspiciousActivityDetected(address indexed account, string reason, uint256 timestamp);
    
    /**
     * @notice Event emitted when the system is paused
     */
    event SystemPaused(address indexed by);
    
    /**
     * @notice Event emitted when the system is unpaused
     */
    event SystemUnpaused(address indexed by);
} 