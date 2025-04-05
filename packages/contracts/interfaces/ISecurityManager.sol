// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISecurityManager
 * @notice Interface for the security manager contract
 */
interface ISecurityManager {
    /**
     * @notice Checks if an address is blacklisted
     * @param account Address to check
     * @return True if the address is blacklisted
     */
    function isBlacklisted(address account) external view returns (bool);
    
    /**
     * @notice Checks if the system is paused
     * @return True if the system is paused
     */
    function isPaused() external view returns (bool);
    
    /**
     * @notice Checks if an address can make a transaction
     * @param account Address to check
     * @param amount Amount to transfer
     * @return True if the address can transact
     */
    function canTransact(address account, uint256 amount) external view returns (bool);
    
    /**
     * @notice Records a transaction for an address and updates its limits
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
    function setTransactionLimits(
        address account, 
        uint256 dailyLimit, 
        uint256 transactionLimit
    ) external;
    
    // Events
    event SystemPaused(address indexed by);
    event SystemUnpaused(address indexed by);
    event TransactionLimitExceeded(address indexed account, uint256 amount, uint256 limit);
    event DailyLimitExceeded(address indexed account, uint256 amount, uint256 limit);
    event SuspiciousActivityDetected(address indexed account, string reason, uint256 timestamp);
    
    /**
     * @notice Sets the minimum time between transactions (anti-MEV protection)
     * @param secondsValue Minimum seconds between transactions
     */
    function setMinTimeBetweenTransactions(uint256 secondsValue) external;
    
    /**
     * @notice Configures detection thresholds for anomalies
     * @param highValueThreshold Threshold for high-value transactions
     * @param rapidCount Number of transactions to trigger rapid transaction alert
     * @param rapidWindow Time window in seconds for rapid transactions
     * @param dailyThreshold Threshold for daily volume
     */
    function setAnomalyThresholds(
        uint256 highValueThreshold,
        uint256 rapidCount,
        uint256 rapidWindow,
        uint256 dailyThreshold
    ) external;
    
    /**
     * @notice Adds a trusted admin for multi-signature operations
     * @param admin Admin address to add
     */
    function addTrustedAdmin(address admin) external;
    
    /**
     * @notice Removes a trusted admin
     * @param admin Admin address to remove
     */
    function removeTrustedAdmin(address admin) external;
    
    /**
     * @notice Sets the number of required signatures for critical operations
     * @param requiredSignatures Number of signatures needed
     */
    function setRequiredSignatures(uint256 requiredSignatures) external;
    
    // Additional events for enhanced security monitoring
    event TransactionRateLimited(address indexed account, uint256 timestamp);
    event AnomalyDetected(address indexed account, string anomalyType, uint256 value, uint256 timestamp);
    event SecurityParametersUpdated(string paramType, uint256 oldValue, uint256 newValue);
    event MultiSigOperationPerformed(address indexed initiator, string operation, uint256 timestamp);
} 