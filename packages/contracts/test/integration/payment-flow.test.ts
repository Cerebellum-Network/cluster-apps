import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  SecurityManager, 
  StablecoinPaymentHandler, 
  TokenSwapper, 
  HyperbridgeTeleport,
  MockERC20
} from "../../typechain-types";

describe("Payment Flow Integration Test", function () {
  // Contract instances
  let securityManager: SecurityManager;
  let paymentHandler: StablecoinPaymentHandler;
  let tokenSwapper: TokenSwapper;
  let hyperbridgeTeleport: HyperbridgeTeleport;
  
  // Mock tokens
  let usdcToken: MockERC20;
  let cereToken: MockERC20;
  
  // Mock router (would be replaced with actual Uniswap router in testnet)
  let mockUniswapRouter: any;
  
  // Test accounts
  let deployer: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  
  // Constants
  const INITIAL_BALANCE = ethers.parseUnits("10000", 6); // 10,000 USDC with 6 decimals
  const PAYMENT_AMOUNT = ethers.parseUnits("100", 6);    // 100 USDC
  const CERE_EXCHANGE_RATE = 10n;                        // 1 USDC = 10 CERE tokens
  const CERE_AMOUNT = PAYMENT_AMOUNT * CERE_EXCHANGE_RATE / ethers.parseUnits("1", 6);
  const CERE_NETWORK_ADDRESS = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"; // Example Cere address
  
  beforeEach(async function () {
    // Get test accounts
    [deployer, admin, user] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    
    // Deploy USDC with 6 decimals
    usdcToken = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    
    // Deploy CERE with 18 decimals
    cereToken = await MockERC20Factory.deploy("Cere Token", "CERE", 18);
    
    // Deploy mock Uniswap router
    const MockUniswapRouterFactory = await ethers.getContractFactory("MockUniswapRouter");
    mockUniswapRouter = await MockUniswapRouterFactory.deploy();
    
    // Configure mock router with exchange rate
    await mockUniswapRouter.setExchangeRate(
      await usdcToken.getAddress(),
      await cereToken.getAddress(),
      CERE_EXCHANGE_RATE
    );
    
    // Deploy security manager
    const SecurityManagerFactory = await ethers.getContractFactory("SecurityManager");
    securityManager = await SecurityManagerFactory.deploy(deployer.address);
    
    // Deploy token swapper with mock router
    const TokenSwapperFactory = await ethers.getContractFactory("TokenSwapper");
    tokenSwapper = await TokenSwapperFactory.deploy(await mockUniswapRouter.getAddress());
    
    // Deploy Hyperbridge teleport
    const HyperbridgeTeleportFactory = await ethers.getContractFactory("HyperbridgeTeleport");
    hyperbridgeTeleport = await HyperbridgeTeleportFactory.deploy(
      await tokenSwapper.getAddress(),
      await cereToken.getAddress()
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
    
    // Add USDC as supported stablecoin
    await paymentHandler.setStablecoinSupport(await usdcToken.getAddress(), true);
    
    // Setup admin role
    await securityManager.addAdmin(admin.address);
    
    // Mint tokens to user
    await usdcToken.mint(user.address, INITIAL_BALANCE);
    await cereToken.mint(mockUniswapRouter.getAddress(), INITIAL_BALANCE * CERE_EXCHANGE_RATE);
  });
  
  describe("End-to-end Payment Flow", function () {
    it("Should process a payment from stablecoin to CERE teleport", async function () {
      // Check initial balances
      expect(await usdcToken.balanceOf(user.address)).to.equal(INITIAL_BALANCE);
      
      // Approve payment handler to spend user's USDC
      await usdcToken.connect(user).approve(
        await paymentHandler.getAddress(),
        PAYMENT_AMOUNT
      );
      
      // Process payment
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const deadline = blockTimestamp + 3600; // 1 hour from now
      
      const tx = await paymentHandler.connect(user).processPayment(
        await usdcToken.getAddress(),
        PAYMENT_AMOUNT,
        CERE_NETWORK_ADDRESS,
        CERE_AMOUNT, // Min CERE expected
        deadline
      );
      
      const receipt = await tx.wait();
      
      // Get the payment ID from the event
      const paymentProcessedEvent = receipt!.logs
        .filter(log => log.topics[0] === ethers.id("PaymentProcessed(bytes32,address,string,address,uint256)"))
        .map(log => paymentHandler.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        }))[0];
      
      const paymentId = paymentProcessedEvent?.args[0];
      expect(paymentId).to.not.be.undefined;
      
      // Check payment was recorded correctly
      const payment = await paymentHandler.payments(paymentId);
      expect(payment.from).to.equal(user.address);
      expect(payment.stablecoin).to.equal(await usdcToken.getAddress());
      expect(payment.stablecoinAmount).to.equal(PAYMENT_AMOUNT);
      expect(payment.cereAmount).to.equal(CERE_AMOUNT);
      expect(payment.status).to.equal(2); // Teleported
      
      // Check user's USDC balance decreased
      expect(await usdcToken.balanceOf(user.address)).to.equal(INITIAL_BALANCE - PAYMENT_AMOUNT);
      
      // Check the teleport was recorded in HyperbridgeTeleport
      const teleportTxId = payment.teleportTxId;
      expect(teleportTxId).to.not.equal(ethers.ZeroHash);
      
      // Check teleport status (should be completed in mock mode)
      const teleportStatus = await hyperbridgeTeleport.checkTeleportStatus(teleportTxId);
      expect(teleportStatus).to.equal(2); // Completed
      
      // Get teleport details
      const teleportDetails = await hyperbridgeTeleport.getTeleportDetails(teleportTxId);
      expect(teleportDetails[0]).to.equal(await paymentHandler.getAddress()); // from
      expect(teleportDetails[1]).to.equal(CERE_NETWORK_ADDRESS); // cereNetworkAddress
      expect(teleportDetails[2]).to.equal(CERE_AMOUNT); // amount
    });
    
    it("Should fail if stablecoin is not supported", async function () {
      // Deploy another token that is not supported
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const unsupportedToken = await MockERC20Factory.deploy("Unsupported Token", "UNSUP", 6);
      
      // Mint to user
      await unsupportedToken.mint(user.address, INITIAL_BALANCE);
      
      // Approve payment handler
      await unsupportedToken.connect(user).approve(
        await paymentHandler.getAddress(),
        PAYMENT_AMOUNT
      );
      
      // Process payment should fail
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const deadline = blockTimestamp + 3600; // 1 hour from now
      
      await expect(
        paymentHandler.connect(user).processPayment(
          await unsupportedToken.getAddress(),
          PAYMENT_AMOUNT,
          CERE_NETWORK_ADDRESS,
          CERE_AMOUNT,
          deadline
        )
      ).to.be.revertedWith("Stablecoin not supported");
    });
    
    it("Should fail if user has insufficient balance", async function () {
      // Approve payment handler
      await usdcToken.connect(user).approve(
        await paymentHandler.getAddress(),
        INITIAL_BALANCE + PAYMENT_AMOUNT
      );
      
      // Process payment should fail due to insufficient balance
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const deadline = blockTimestamp + 3600; // 1 hour from now
      
      await expect(
        paymentHandler.connect(user).processPayment(
          await usdcToken.getAddress(),
          INITIAL_BALANCE + PAYMENT_AMOUNT,
          CERE_NETWORK_ADDRESS,
          CERE_AMOUNT,
          deadline
        )
      ).to.be.reverted; // ERC20: transfer amount exceeds balance
    });
    
    it("Should fail if deadline has passed", async function () {
      // Approve payment handler
      await usdcToken.connect(user).approve(
        await paymentHandler.getAddress(),
        PAYMENT_AMOUNT
      );
      
      // Set deadline in the past
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const deadline = blockTimestamp - 3600; // 1 hour ago
      
      await expect(
        paymentHandler.connect(user).processPayment(
          await usdcToken.getAddress(),
          PAYMENT_AMOUNT,
          CERE_NETWORK_ADDRESS,
          CERE_AMOUNT,
          deadline
        )
      ).to.be.revertedWith("Transaction deadline expired");
    });
    
    it("Should fail if system is paused", async function () {
      // Pause system
      await securityManager.connect(admin).pauseSystem();
      
      // Approve payment handler
      await usdcToken.connect(user).approve(
        await paymentHandler.getAddress(),
        PAYMENT_AMOUNT
      );
      
      // Process payment should fail
      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const deadline = blockTimestamp + 3600; // 1 hour from now
      
      await expect(
        paymentHandler.connect(user).processPayment(
          await usdcToken.getAddress(),
          PAYMENT_AMOUNT,
          CERE_NETWORK_ADDRESS,
          CERE_AMOUNT,
          deadline
        )
      ).to.be.revertedWith("System is paused by security manager");
    });
  });
}); 