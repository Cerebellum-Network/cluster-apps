import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  SecurityManager, 
  StablecoinPaymentHandler, 
  TokenSwapper, 
  HyperbridgeTeleport,
  SecurityIntegrationTester
} from "../typechain-types";

describe("Security Integration", function () {
  // Contract instances
  let securityManager: SecurityManager;
  let paymentHandler: StablecoinPaymentHandler;
  let tokenSwapper: TokenSwapper;
  let hyperbridgeTeleport: HyperbridgeTeleport;
  let tester: SecurityIntegrationTester;
  
  // Mock token addresses
  const cereTokenAddress = "0x2da719db753dfa10a62e140f436e1d67f2ddb0d6";
  const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const uniswapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  // Test accounts
  let deployer: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let blacklistedUser: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  
  // Constants
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const SECURITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECURITY_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  
  beforeEach(async function () {
    // Get test accounts
    [deployer, admin, operator, blacklistedUser, user] = await ethers.getSigners();
    
    // Deploy security manager
    const SecurityManagerFactory = await ethers.getContractFactory("SecurityManager");
    securityManager = await SecurityManagerFactory.deploy(deployer.address);
    
    // Deploy token swapper
    const TokenSwapperFactory = await ethers.getContractFactory("TokenSwapper");
    tokenSwapper = await TokenSwapperFactory.deploy(uniswapRouterAddress);
    
    // Deploy hyperbridge teleport
    const HyperbridgeTeleportFactory = await ethers.getContractFactory("HyperbridgeTeleport");
    hyperbridgeTeleport = await HyperbridgeTeleportFactory.deploy(
      await tokenSwapper.getAddress(),
      cereTokenAddress
    );
    
    // Enable mock mode for testing
    await hyperbridgeTeleport.setMockMode(true);
    
    // Deploy payment handler
    const PaymentHandlerFactory = await ethers.getContractFactory("StablecoinPaymentHandler");
    paymentHandler = await PaymentHandlerFactory.deploy();
    
    // Configure payment handler
    await paymentHandler.setTokenSwapper(await tokenSwapper.getAddress());
    await paymentHandler.setHyperbridgeTeleport(await hyperbridgeTeleport.getAddress());
    await paymentHandler.setSecurityManager(await securityManager.getAddress());
    
    // Add supported stablecoins
    await paymentHandler.setStablecoinSupport(usdcAddress, true);
    await paymentHandler.setStablecoinSupport(usdtAddress, true);
    
    // Deploy integration tester
    const TesterFactory = await ethers.getContractFactory("SecurityIntegrationTester");
    tester = await TesterFactory.deploy(
      await paymentHandler.getAddress(),
      await securityManager.getAddress()
    );
    
    // Configure test users in tester
    await tester.setTestUsers(admin.address, operator.address, blacklistedUser.address);
    
    // Add roles to test users
    await securityManager.addAdmin(admin.address);
    await securityManager.addOperator(operator.address);
    await securityManager.connect(admin).addSecurityRole(admin.address);
    
    // Set test stablecoins
    await tester.setTestStablecoin("USDC", usdcAddress);
    await tester.setTestStablecoin("USDT", usdtAddress);
  });
  
  describe("Security Manager", function () {
    it("Should grant roles correctly", async function () {
      expect(await securityManager.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await securityManager.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
      expect(await securityManager.hasRole(SECURITY_ROLE, admin.address)).to.be.true;
    });
    
    it("Should pause and unpause the system", async function () {
      // Initial state
      expect(await securityManager.isPaused()).to.be.false;
      
      // Pause (as admin)
      await securityManager.connect(admin).pauseSystem();
      expect(await securityManager.isPaused()).to.be.true;
      
      // Unpause (as admin)
      await securityManager.connect(admin).unpauseSystem();
      expect(await securityManager.isPaused()).to.be.false;
    });
    
    it("Should add and remove addresses from blacklist", async function () {
      // Initial state
      expect(await securityManager.isBlacklisted(blacklistedUser.address)).to.be.false;
      
      // Blacklist (as admin with security role)
      await securityManager.connect(admin).blacklistAddress(blacklistedUser.address);
      expect(await securityManager.isBlacklisted(blacklistedUser.address)).to.be.true;
      
      // Unblacklist (as admin)
      await securityManager.connect(admin).unblacklistAddress(blacklistedUser.address);
      expect(await securityManager.isBlacklisted(blacklistedUser.address)).to.be.false;
    });
    
    it("Should enforce transaction limits", async function () {
      const dailyLimit = ethers.parseUnits("1000", 6); // 1,000 USDC
      const txLimit = ethers.parseUnits("100", 6); // 100 USDC
      
      // Set limits for user
      await securityManager.connect(admin).setTransactionLimits(
        user.address,
        dailyLimit,
        txLimit
      );
      
      // Check transaction within limits
      expect(await securityManager.canTransact(user.address, txLimit)).to.be.true;
      
      // Check transaction exceeding limits
      expect(await securityManager.canTransact(user.address, txLimit + 1n)).to.be.false;
    });
  });
  
  describe("Payment Handler Security Integration", function () {
    it("Should respect security manager pause state", async function () {
      // Initial state
      expect(await paymentHandler.canTransact(user.address, 100)).to.be.true;
      
      // Pause security manager
      await securityManager.connect(admin).pauseSystem();
      
      // Payment handler should respect system pause
      expect(await paymentHandler.canTransact(user.address, 100)).to.be.false;
      
      // Unpause security manager
      await securityManager.connect(admin).unpauseSystem();
      
      // Payment handler should respect system unpause
      expect(await paymentHandler.canTransact(user.address, 100)).to.be.true;
    });
    
    it("Should respect local pause state", async function () {
      // Initial state
      expect(await paymentHandler.canTransact(user.address, 100)).to.be.true;
      
      // Pause payment handler
      await paymentHandler.pause();
      
      // Should be paused
      expect(await paymentHandler.paused()).to.be.true;
      expect(await paymentHandler.canTransact(user.address, 100)).to.be.false;
      
      // Unpause payment handler
      await paymentHandler.unpause();
      
      // Should be unpaused
      expect(await paymentHandler.paused()).to.be.false;
      expect(await paymentHandler.canTransact(user.address, 100)).to.be.true;
    });
    
    it("Should respect blacklist", async function () {
      // Initial state
      expect(await paymentHandler.canTransact(blacklistedUser.address, 100)).to.be.true;
      
      // Blacklist user
      await securityManager.connect(admin).blacklistAddress(blacklistedUser.address);
      
      // Payment handler should respect blacklist
      expect(await paymentHandler.canTransact(blacklistedUser.address, 100)).to.be.false;
      
      // Unblacklist user
      await securityManager.connect(admin).unblacklistAddress(blacklistedUser.address);
      
      // Payment handler should respect unblacklist
      expect(await paymentHandler.canTransact(blacklistedUser.address, 100)).to.be.true;
    });
    
    it("Should respect transaction limits", async function () {
      const dailyLimit = ethers.parseUnits("1000", 6); // 1,000 USDC
      const txLimit = ethers.parseUnits("100", 6); // 100 USDC
      
      // Set limits for user
      await securityManager.connect(admin).setTransactionLimits(
        user.address,
        dailyLimit,
        txLimit
      );
      
      // Check transaction within limits
      expect(await paymentHandler.canTransact(user.address, txLimit)).to.be.true;
      
      // Check transaction exceeding limits
      expect(await paymentHandler.canTransact(user.address, txLimit + 1n)).to.be.false;
    });
  });
  
  describe("Integration Tester", function () {
    it("Should run all security tests successfully", async function () {
      // Run all tests
      const allTestsPassed = await tester.runAllTests();
      
      // Check results
      expect(allTestsPassed).to.be.true;
      expect(await tester.securityPauseTestPassed()).to.be.true;
      expect(await tester.blacklistTestPassed()).to.be.true;
      expect(await tester.transactionLimitTestPassed()).to.be.true;
      expect(await tester.integrationTestPassed()).to.be.true;
    });
    
    it("Should run individual security tests successfully", async function () {
      // Run tests individually
      await tester.testSecurityPause();
      await tester.testBlacklist();
      await tester.testTransactionLimits();
      await tester.testSecurityIntegration();
      
      // Check results
      expect(await tester.securityPauseTestPassed()).to.be.true;
      expect(await tester.blacklistTestPassed()).to.be.true;
      expect(await tester.transactionLimitTestPassed()).to.be.true;
      expect(await tester.integrationTestPassed()).to.be.true;
    });
  });
  
  describe("Emergency Operations", function () {
    it("Should handle emergency stop correctly", async function () {
      // Initial state
      expect(await paymentHandler.paused()).to.be.false;
      expect(await securityManager.isPaused()).to.be.false;
      
      // Emergency stop
      await paymentHandler.emergencyStop();
      
      // Both should be paused
      expect(await paymentHandler.paused()).to.be.true;
      expect(await securityManager.isPaused()).to.be.true;
      
      // Resume operations
      await paymentHandler.resumeOperations();
      
      // Both should be unpaused
      expect(await paymentHandler.paused()).to.be.false;
      expect(await securityManager.isPaused()).to.be.false;
    });
  });
}); 