// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/ISecurityManager.sol";

/**
 * @title SecurityManager
 * @notice Contract that implements security measures for the system, including emergency pause,
 * blacklists, and transaction limits.
 * @dev Uses AccessControl roles for permission management and Pausable for emergency stop implementation
 */
contract SecurityManager is ISecurityManager, AccessControl, Pausable, ReentrancyGuard {
    using Math for uint256;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SECURITY_ROLE = keccak256("SECURITY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Blacklist of addresses
    mapping(address => bool) private _blacklist;
    
    // Transaction limits
    struct TransactionLimits {
        uint256 dailyLimit;
        uint256 transactionLimit;
        uint256 dailyUsed;
        uint256 lastResetTime;
    }
    
    // Mapping of addresses to their limits
    mapping(address => TransactionLimits) private _transactionLimits;
    
    // Default limits (adjust as needed)
    uint256 public defaultDailyLimit = 10000 * 10**6; // 10,000 USDC for example (assuming 6 decimals)
    uint256 public defaultTransactionLimit = 5000 * 10**6; // 5,000 USDC per transaction
    
    // Minimum time between transactions from a user (anti-MEV)
    uint256 public minTimeBetweenTxs = 2; // 2 seconds by default
    
    // Map of the last time a user made a transaction
    mapping(address => uint256) private _lastTransactionTime;
    
    // Counters for statistics
    uint256 public suspiciousActivityCount;
    uint256 public totalTransactionsProcessed;
    
    // Protection against front-running attacks
    mapping(bytes32 => bool) private _usedSignatures;
    
    // List of trusted admin addresses
    mapping(address => bool) private _trustedAdmins;
    uint256 public requiredAdminSignatures = 1; // By default, only 1 signature is required
    
    // Detection thresholds for suspicious activities
    struct AnomalyThresholds {
        uint256 highValueThreshold;      // Threshold for high-value transactions
        uint256 rapidTransactionCount;   // Number of transactions in a short period to be suspicious
        uint256 rapidTransactionWindow;  // Time period for rapid transactions (in seconds)
        uint256 dailyVolumeThreshold;    // Threshold for total daily volume
    }
    
    AnomalyThresholds public anomalyThresholds;
    
    // Transaction record by account for anomaly detection
    struct TransactionRecord {
        uint256[] timestamps;
        uint256[] amounts;
        uint256 windowStartIndex;
    }
    
    mapping(address => TransactionRecord) private _transactionRecords;
    
    // New events for enhanced monitoring
    event TransactionRateLimited(address indexed account, uint256 timestamp);
    event AnomalyDetected(address indexed account, string anomalyType, uint256 value, uint256 timestamp);
    event SecurityParametersUpdated(string paramType, uint256 oldValue, uint256 newValue);
    event MultiSigOperationPerformed(address indexed initiator, string operation, uint256 timestamp);
    
    /**
     * @notice Constructor
     * @param admin Address of the initial administrator
     */
    constructor(address admin) {
        require(admin != address(0), "Admin cannot be zero address");
        
        // Configure roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(SECURITY_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        
        // Add the initial admin as a trusted administrator
        _trustedAdmins[admin] = true;
        
        // Configure default anomaly thresholds
        anomalyThresholds = AnomalyThresholds({
            highValueThreshold: 3000 * 10**6,       // 3,000 USDC
            rapidTransactionCount: 5,                // 5 transactions
            rapidTransactionWindow: 5 * 60,         // in a 5-minute period
            dailyVolumeThreshold: 20000 * 10**6     // 20,000 USDC daily volume
        });
    }
    
    /**
     * @notice Checks if an address is blacklisted
     * @param account Address to check
     * @return true if the address is blacklisted
     */
    function isBlacklisted(address account) external view override returns (bool) {
        return _blacklist[account];
    }
    
    /**
     * @notice Checks if the system is paused
     * @return true if the system is paused
     */
    function isPaused() external view override returns (bool) {
        return paused();
    }
    
    /**
     * @notice Checks if an address can perform transactions (limits + security)
     * @param account Address to check
     * @param amount Amount to transfer
     * @return True if the address can transact
     */
    function canTransact(address account, uint256 amount) external view override returns (bool) {
        // If blacklisted, cannot transact
        if (_blacklist[account]) {
            return false;
        }
        
        // If the system is paused, cannot transact
        if (paused()) {
            return false;
        }
        
        // Check anti-MEV protection
        if (block.timestamp - _lastTransactionTime[account] < minTimeBetweenTxs) {
            return false;
        }
        
        // Get limits for this address
        TransactionLimits storage limits = _transactionLimits[account];
        
        // If the address has no special limits, use the default values
        uint256 dailyLimit = limits.dailyLimit > 0 ? limits.dailyLimit : defaultDailyLimit;
        uint256 txLimit = limits.transactionLimit > 0 ? limits.transactionLimit : defaultTransactionLimit;
        
        // If the last reset date is from the previous day, reset the daily counter
        if (block.timestamp >= limits.lastResetTime + 1 days) {
            // In a view function we cannot modify the state, just simulate the reset
            return amount <= txLimit; // Only check the transaction limit
        }
        
        // Verify that it doesn't exceed the limits
        return amount <= txLimit && (limits.dailyUsed + amount) <= dailyLimit;
    }
    
    /**
     * @notice Records a transaction for an address and updates its limits
     * @param account Address making the transaction
     * @param amount Transaction amount
     */
    function recordTransaction(address account, uint256 amount) external override nonReentrant {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Must have operator role");
        require(!_blacklist[account], "Account is blacklisted");
        require(!paused(), "System is paused");
        
        // Anti-MEV/throttling protection
        require(block.timestamp - _lastTransactionTime[account] >= minTimeBetweenTxs, "Rate limited");
        _lastTransactionTime[account] = block.timestamp;
        
        TransactionLimits storage limits = _transactionLimits[account];
        
        // If first use, initialize
        if (limits.lastResetTime == 0) {
            limits.lastResetTime = block.timestamp;
        }
        
        // If a day has passed since the last reset, reset the counter
        if (block.timestamp >= limits.lastResetTime + 1 days) {
            limits.dailyUsed = 0;
            limits.lastResetTime = block.timestamp;
        }
        
        // Get applicable limits
        uint256 dailyLimit = limits.dailyLimit > 0 ? limits.dailyLimit : defaultDailyLimit;
        uint256 txLimit = limits.transactionLimit > 0 ? limits.transactionLimit : defaultTransactionLimit;
        
        // Verify limits
        require(amount <= txLimit, "Transaction exceeds limit");
        require(limits.dailyUsed + amount <= dailyLimit, "Daily limit exceeded");
        
        // Update daily counter
        limits.dailyUsed += amount;
        
        // Increment transaction counter
        totalTransactionsProcessed++;
        
        // Record transaction for anomaly detection
        _recordTransactionForAnomaly(account, amount);
        
        // Enhanced suspicious activity detection
        _detectAnomalies(account, amount);
    }
    
    /**
     * @notice Records a transaction for anomaly analysis
     * @param account Account address
     * @param amount Transaction amount
     */
    function _recordTransactionForAnomaly(address account, uint256 amount) internal {
        TransactionRecord storage record = _transactionRecords[account];
        
        // Ensure arrays are initialized
        if (record.timestamps.length == 0) {
            record.windowStartIndex = 0;
        }
        
        // Add the new transaction to the record
        record.timestamps.push(block.timestamp);
        record.amounts.push(amount);
        
        // Keep only transactions within the relevant time window
        uint256 windowStart = block.timestamp - anomalyThresholds.rapidTransactionWindow;
        while (record.windowStartIndex < record.timestamps.length && 
               record.timestamps[record.windowStartIndex] < windowStart) {
            record.windowStartIndex++;
        }
    }
    
    /**
     * @notice Detects anomalies in transaction patterns
     * @param account Account address
     * @param amount Transaction amount
     */
    function _detectAnomalies(address account, uint256 amount) internal {
        // Check high-value transactions
        if (amount >= anomalyThresholds.highValueThreshold) {
            suspiciousActivityCount++;
            emit AnomalyDetected(account, "HIGH_VALUE_TRANSACTION", amount, block.timestamp);
        }
        
        // Check daily volume
        if (_transactionLimits[account].dailyUsed >= anomalyThresholds.dailyVolumeThreshold) {
            emit AnomalyDetected(account, "HIGH_DAILY_VOLUME", _transactionLimits[account].dailyUsed, block.timestamp);
        }
        
        // Check rapid transactions
        TransactionRecord storage record = _transactionRecords[account];
        uint256 recentCount = record.timestamps.length - record.windowStartIndex;
        
        if (recentCount >= anomalyThresholds.rapidTransactionCount) {
            emit AnomalyDetected(account, "RAPID_TRANSACTIONS", recentCount, block.timestamp);
            suspiciousActivityCount++;
        }
    }
    
    /**
     * @notice Configures anomaly detection thresholds
     * @param highValueThreshold Threshold for high-value transactions
     * @param rapidCount Number of transactions to trigger an alert
     * @param rapidWindow Time window (seconds)
     * @param dailyThreshold Threshold for daily volume
     */
    function setAnomalyThresholds(
        uint256 highValueThreshold,
        uint256 rapidCount,
        uint256 rapidWindow,
        uint256 dailyThreshold
    ) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        
        anomalyThresholds.highValueThreshold = highValueThreshold;
        anomalyThresholds.rapidTransactionCount = rapidCount;
        anomalyThresholds.rapidTransactionWindow = rapidWindow;
        anomalyThresholds.dailyVolumeThreshold = dailyThreshold;
        
        emit SecurityParametersUpdated("ANOMALY_THRESHOLDS", 0, 0);
    }
    
    /**
     * @notice Sets the minimum time between transactions (anti-MEV protection)
     * @param secondsValue Minimum seconds between transactions
     */
    function setMinTimeBetweenTransactions(uint256 secondsValue) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        require(secondsValue <= 60, "Maximum value is 60 seconds");
        
        uint256 oldValue = minTimeBetweenTxs;
        minTimeBetweenTxs = secondsValue;
        
        emit SecurityParametersUpdated("MIN_TIME_BETWEEN_TXS", oldValue, secondsValue);
    }
    
    /**
     * @notice Activates emergency pause mode
     */
    function pauseSystem() external override {
        require(hasRole(SECURITY_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        _pause();
        emit SystemPaused(msg.sender);
    }
    
    /**
     * @notice Deactivates emergency pause mode
     */
    function unpauseSystem() external override {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        _unpause();
        emit SystemUnpaused(msg.sender);
    }
    
    /**
     * @notice Adds an address to the blacklist
     * @param account Address to add
     */
    function blacklistAddress(address account) external override {
        require(hasRole(SECURITY_ROLE, msg.sender), "Must have security role");
        require(account != address(0), "Cannot blacklist zero address");
        _blacklist[account] = true;
    }
    
    /**
     * @notice Removes an address from the blacklist
     * @param account Address to remove
     */
    function unblacklistAddress(address account) external override {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        _blacklist[account] = false;
    }
    
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
    ) external override {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        require(account != address(0), "Invalid address");
        
        TransactionLimits storage limits = _transactionLimits[account];
        limits.dailyLimit = dailyLimit;
        limits.transactionLimit = transactionLimit;
        
        // If this is the first time limits are configured, initialize the time
        if (limits.lastResetTime == 0) {
            limits.lastResetTime = block.timestamp;
        }
    }
    
    /**
     * @notice Sets the default limits
     * @param newDailyLimit New default daily limit
     * @param newTxLimit New default transaction limit
     */
    function setDefaultLimits(uint256 newDailyLimit, uint256 newTxLimit) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        require(newDailyLimit >= newTxLimit, "Daily limit must be >= tx limit");
        
        uint256 oldDailyLimit = defaultDailyLimit;
        defaultDailyLimit = newDailyLimit;
        defaultTransactionLimit = newTxLimit;
        
        emit SecurityParametersUpdated("DEFAULT_LIMITS", oldDailyLimit, newDailyLimit);
    }
    
    /**
     * @notice Adds administrator role to an address
     * @param account Address to add
     */
    function addAdmin(address account) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        grantRole(ADMIN_ROLE, account);
    }
    
    /**
     * @notice Adds security role to an address
     * @param account Address to add
     */
    function addSecurityRole(address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        grantRole(SECURITY_ROLE, account);
    }
    
    /**
     * @notice Adds operator role to an address
     * @param account Address to add
     */
    function addOperator(address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        grantRole(OPERATOR_ROLE, account);
    }
    
    /**
     * @notice Revokes a specific role from an address
     * @param account Address to revoke from
     * @param role Role to revoke
     */
    function revokeRole(address account, bytes32 role) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        _revokeRole(role, account);
    }
    
    /**
     * @notice Adds a trusted admin for operations requiring multiple signatures
     * @param admin Admin address
     */
    function addTrustedAdmin(address admin) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        require(admin != address(0), "Invalid admin address");
        _trustedAdmins[admin] = true;
    }
    
    /**
     * @notice Removes a trusted admin
     * @param admin Admin address
     */
    function removeTrustedAdmin(address admin) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        _trustedAdmins[admin] = false;
    }
    
    /**
     * @notice Sets the number of signatures required for critical operations
     * @param requiredSignatures Number of signatures needed
     */
    function setRequiredSignatures(uint256 requiredSignatures) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Must have admin role");
        require(requiredSignatures > 0, "Must require at least 1 signature");
        
        uint256 oldValue = requiredAdminSignatures;
        requiredAdminSignatures = requiredSignatures;
        
        emit SecurityParametersUpdated("REQUIRED_SIGNATURES", oldValue, requiredSignatures);
    }
} 