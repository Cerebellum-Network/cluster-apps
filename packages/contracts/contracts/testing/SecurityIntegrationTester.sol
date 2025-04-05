// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IERC20Extended.sol";
import "../interfaces/ITokenSwapper.sol";
import "../interfaces/IHyperbridgeTeleport.sol";
import "../interfaces/ISecurityManager.sol";
import "../payment/StablecoinPaymentHandler.sol";
import "../payment/SecurityManager.sol";

/**
 * @title SecurityIntegrationTester
 * @notice Test contract for verifying security integrations with the payment system
 * @dev This is used for internal testing only and should not be deployed to production
 */
contract SecurityIntegrationTester is Ownable {
    // Components to test
    StablecoinPaymentHandler public paymentHandler;
    SecurityManager public securityManager;
    ITokenSwapper public tokenSwapper;
    IHyperbridgeTeleport public hyperbridgeTeleport;
    
    // Supported stablecoins for testing
    mapping(string => address) public testStablecoins;
    
    // Test user roles
    address public testAdmin;
    address public testOperator;
    address public testBlacklistedUser;
    
    // Test states
    bool public securityPauseTestPassed;
    bool public blacklistTestPassed;
    bool public transactionLimitTestPassed;
    bool public integrationTestPassed;
    
    // Events for test results
    event TestResult(string testName, bool passed, string details);
    
    /**
     * @notice Constructor
     * @param _paymentHandler Address of the StablecoinPaymentHandler contract
     * @param _securityManager Address of the SecurityManager contract
     */
    constructor(
        address _paymentHandler,
        address _securityManager
    ) Ownable() {
        require(_paymentHandler != address(0), "Invalid payment handler address");
        require(_securityManager != address(0), "Invalid security manager address");
        
        paymentHandler = StablecoinPaymentHandler(_paymentHandler);
        securityManager = SecurityManager(_securityManager);
        
        // Initialize test state
        securityPauseTestPassed = false;
        blacklistTestPassed = false;
        transactionLimitTestPassed = false;
        integrationTestPassed = false;
        
        // Get components from payment handler
        tokenSwapper = paymentHandler.tokenSwapper();
        hyperbridgeTeleport = paymentHandler.hyperbridgeTeleport();
        
        // Transferring ownership to deployer in init
        _transferOwnership(msg.sender);
    }
    
    /**
     * @notice Sets test stablecoin addresses
     * @param name Stablecoin name (e.g., "USDC", "USDT")
     * @param tokenAddress Stablecoin token address
     */
    function setTestStablecoin(string calldata name, address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        testStablecoins[name] = tokenAddress;
    }
    
    /**
     * @notice Sets test users for role-based testing
     * @param admin Admin address
     * @param operator Operator address
     * @param blacklistedUser Address to blacklist for testing
     */
    function setTestUsers(
        address admin,
        address operator,
        address blacklistedUser
    ) external onlyOwner {
        require(admin != address(0) && operator != address(0) && blacklistedUser != address(0), "Invalid addresses");
        testAdmin = admin;
        testOperator = operator;
        testBlacklistedUser = blacklistedUser;
    }
    
    /**
     * @notice Tests if the security pause mechanism works correctly
     * @return True if the test passes
     */
    function testSecurityPause() public returns (bool) {
        // Verify the system is not paused initially
        require(!securityManager.isPaused(), "System is already paused");
        
        // Pause the system
        securityManager.pauseSystem();
        
        // Verify the system is now paused
        bool isPaused = securityManager.isPaused();
        
        // Unpause for further testing
        securityManager.unpauseSystem();
        
        // Set test result
        securityPauseTestPassed = isPaused;
        emit TestResult("SecurityPauseTest", isPaused, isPaused ? "Success" : "Failed to pause system");
        
        return isPaused;
    }
    
    /**
     * @notice Tests if the blacklist mechanism works correctly
     * @return True if the test passes
     */
    function testBlacklist() public returns (bool) {
        require(testBlacklistedUser != address(0), "Set test users first");
        
        // Verify user is not blacklisted initially
        require(!securityManager.isBlacklisted(testBlacklistedUser), "User is already blacklisted");
        
        // Blacklist the user
        securityManager.blacklistAddress(testBlacklistedUser);
        
        // Verify the user is now blacklisted
        bool isBlacklisted = securityManager.isBlacklisted(testBlacklistedUser);
        
        // Remove from blacklist for further testing
        securityManager.unblacklistAddress(testBlacklistedUser);
        
        // Set test result
        blacklistTestPassed = isBlacklisted;
        emit TestResult("BlacklistTest", isBlacklisted, isBlacklisted ? "Success" : "Failed to blacklist user");
        
        return isBlacklisted;
    }
    
    /**
     * @notice Tests if the transaction limits mechanism works correctly
     * @return True if the test passes
     */
    function testTransactionLimits() public returns (bool) {
        require(testAdmin != address(0), "Set test users first");
        
        // Set custom transaction limits
        uint256 dailyLimit = 1000 * 10**6; // 1,000 USDC
        uint256 transactionLimit = 100 * 10**6; // 100 USDC
        securityManager.setTransactionLimits(testAdmin, dailyLimit, transactionLimit);
        
        // Verify transaction within limits is allowed
        bool withinLimits = securityManager.canTransact(testAdmin, transactionLimit);
        
        // Verify transaction exceeding limits is rejected
        bool exceedsLimits = !securityManager.canTransact(testAdmin, transactionLimit + 1);
        
        // Reset limits to defaults
        securityManager.setTransactionLimits(testAdmin, 0, 0);
        
        // Both checks must pass
        bool testPassed = withinLimits && exceedsLimits;
        
        // Set test result
        transactionLimitTestPassed = testPassed;
        emit TestResult("TransactionLimitTest", testPassed, 
            testPassed ? "Success" : "Failed to enforce transaction limits");
        
        return testPassed;
    }
    
    /**
     * @notice Tests if the integration between security manager and payment handler works correctly
     * @return True if the test passes
     */
    function testSecurityIntegration() public returns (bool) {
        // Step 1: Verify the security manager is configured in payment handler
        require(address(paymentHandler.securityManager()) == address(securityManager), 
            "Security manager not set in payment handler");
        
        // Step 2: Verify pause functionality is integrated
        securityManager.pauseSystem();
        bool pauseRespected = !paymentHandler.canTransact(msg.sender, 100);
        securityManager.unpauseSystem();
        
        // Step 3: Verify blacklist functionality is integrated
        securityManager.blacklistAddress(testBlacklistedUser);
        bool blacklistRespected = !paymentHandler.canTransact(testBlacklistedUser, 100);
        securityManager.unblacklistAddress(testBlacklistedUser);
        
        // Step 4: Verify transaction limits are respected
        uint256 dailyLimit = 500 * 10**6; // 500 USDC
        uint256 transactionLimit = 100 * 10**6; // 100 USDC
        securityManager.setTransactionLimits(testAdmin, dailyLimit, transactionLimit);
        
        bool limitsRespected = paymentHandler.canTransact(testAdmin, transactionLimit) && 
                              !paymentHandler.canTransact(testAdmin, transactionLimit + 1);
        
        // Reset limits
        securityManager.setTransactionLimits(testAdmin, 0, 0);
        
        // All checks must pass
        bool testPassed = pauseRespected && blacklistRespected && limitsRespected;
        
        // Set test result
        integrationTestPassed = testPassed;
        emit TestResult("SecurityIntegrationTest", testPassed, 
            testPassed ? "Success" : "Security integration failed");
        
        return testPassed;
    }
    
    /**
     * @notice Runs all security tests in sequence
     * @return True if all tests pass
     */
    function runAllTests() external returns (bool) {
        bool pauseTest = testSecurityPause();
        bool blacklistTest = testBlacklist();
        bool limitsTest = testTransactionLimits();
        bool integrationTest = testSecurityIntegration();
        
        bool allPassed = pauseTest && blacklistTest && limitsTest && integrationTest;
        
        emit TestResult("AllSecurityTests", allPassed, 
            allPassed ? "All security tests passed" : "Some security tests failed");
        
        return allPassed;
    }
} 