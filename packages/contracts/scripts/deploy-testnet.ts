import { ethers, network } from "hardhat";
import * as fs from "fs";

// Mock tokens for testnet deployment
async function deployMockTokens() {
  console.log("\nDeploying mock tokens for testnet...");
  
  // Get the MockERC20 contract factory
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  // Deploy CERE token
  console.log("Deploying mock CERE token...");
  const cereToken = await MockERC20.deploy("Cere Network Token", "CERE", 18);
  await cereToken.waitForDeployment();
  const cereTokenAddress = await cereToken.getAddress();
  console.log(`Mock CERE token deployed at: ${cereTokenAddress}`);
  
  // Deploy USDC token
  console.log("Deploying mock USDC token...");
  const usdcToken = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdcToken.waitForDeployment();
  const usdcTokenAddress = await usdcToken.getAddress();
  console.log(`Mock USDC token deployed at: ${usdcTokenAddress}`);
  
  // Deploy USDT token
  console.log("Deploying mock USDT token...");
  const usdtToken = await MockERC20.deploy("Tether USD", "USDT", 6);
  await usdtToken.waitForDeployment();
  const usdtTokenAddress = await usdtToken.getAddress();
  console.log(`Mock USDT token deployed at: ${usdtTokenAddress}`);
  
  return {
    cereToken,
    cereTokenAddress,
    usdcToken,
    usdcTokenAddress,
    usdtToken,
    usdtTokenAddress
  };
}

// Mock Uniswap for testnet deployment
async function deployMockUniswap() {
  console.log("\nDeploying mock Uniswap for testnet...");
  
  // Get the MockUniswapRouter contract factory
  const MockUniswapRouter = await ethers.getContractFactory("MockUniswapRouter");
  
  // Deploy MockUniswapRouter
  console.log("Deploying MockUniswapRouter...");
  const mockRouter = await MockUniswapRouter.deploy();
  await mockRouter.waitForDeployment();
  const mockRouterAddress = await mockRouter.getAddress();
  console.log(`MockUniswapRouter deployed at: ${mockRouterAddress}`);
  
  return {
    mockRouter,
    mockRouterAddress
  };
}

async function main() {
  console.log(`Deploying contracts to ${network.name} testnet...`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
  
  // 1. Deploy mock tokens (CERE, USDC, USDT)
  const { 
    cereToken, 
    cereTokenAddress, 
    usdcToken, 
    usdcTokenAddress, 
    usdtToken, 
    usdtTokenAddress 
  } = await deployMockTokens();
  
  // 2. Deploy mock Uniswap router
  const { mockRouter, mockRouterAddress } = await deployMockUniswap();
  
  // 3. Deploy security manager
  console.log("\n[1/4] Deploying SecurityManager...");
  const SecurityManager = await ethers.getContractFactory("SecurityManager");
  const securityManager = await SecurityManager.deploy(deployer.address);
  await securityManager.waitForDeployment();
  const securityManagerAddress = await securityManager.getAddress();
  console.log(`SecurityManager deployed at: ${securityManagerAddress}`);
  
  // 4. Deploy token swapper with mock router
  console.log("\n[2/4] Deploying TokenSwapper...");
  const TokenSwapper = await ethers.getContractFactory("TokenSwapper");
  const tokenSwapper = await TokenSwapper.deploy(mockRouterAddress);
  await tokenSwapper.waitForDeployment();
  const tokenSwapperAddress = await tokenSwapper.getAddress();
  console.log(`TokenSwapper deployed at: ${tokenSwapperAddress}`);
  
  // 5. Deploy hyperbridge teleport
  console.log("\n[3/4] Deploying HyperbridgeTeleport...");
  const HyperbridgeTeleport = await ethers.getContractFactory("HyperbridgeTeleport");
  const hyperbridgeTeleport = await HyperbridgeTeleport.deploy(tokenSwapperAddress, cereTokenAddress);
  await hyperbridgeTeleport.waitForDeployment();
  const hyperbridgeTeleportAddress = await hyperbridgeTeleport.getAddress();
  console.log(`HyperbridgeTeleport deployed at: ${hyperbridgeTeleportAddress}`);
  
  // Enable mock mode for testing
  console.log("Enabling mock mode for HyperbridgeTeleport...");
  await hyperbridgeTeleport.setMockMode(true);
  
  // 6. Deploy payment handler
  console.log("\n[4/4] Deploying StablecoinPaymentHandler...");
  const StablecoinPaymentHandler = await ethers.getContractFactory("StablecoinPaymentHandler");
  const paymentHandler = await StablecoinPaymentHandler.deploy();
  await paymentHandler.waitForDeployment();
  const paymentHandlerAddress = await paymentHandler.getAddress();
  console.log(`StablecoinPaymentHandler deployed at: ${paymentHandlerAddress}`);
  
  // 7. Configure contracts
  console.log("\nConfiguring contracts...");
  
  // Set token swapper in payment handler
  console.log("Setting TokenSwapper in payment handler...");
  await paymentHandler.setTokenSwapper(tokenSwapperAddress);
  
  // Set hyperbridge teleport in payment handler
  console.log("Setting HyperbridgeTeleport in payment handler...");
  await paymentHandler.setHyperbridgeTeleport(hyperbridgeTeleportAddress);
  
  // Set security manager in payment handler
  console.log("Setting SecurityManager in payment handler...");
  await paymentHandler.setSecurityManager(securityManagerAddress);
  
  // Add supported stablecoins
  console.log("Adding supported stablecoins...");
  await paymentHandler.setStablecoinSupport(usdcTokenAddress, true);
  await paymentHandler.setStablecoinSupport(usdtTokenAddress, true);
  
  console.log("Setting pool fees in TokenSwapper...");
  // 0.05% fee for USDC/CERE pool
  await tokenSwapper.setPoolFee(usdcTokenAddress, cereTokenAddress, 500);
  // 0.3% fee for USDT/CERE pool
  await tokenSwapper.setPoolFee(usdtTokenAddress, cereTokenAddress, 3000);
  
  // 8. Configure mock router for testing
  console.log("\nConfiguring MockUniswapRouter...");
  await mockRouter.setExchangeRate(usdcTokenAddress, cereTokenAddress, ethers.parseUnits("0.5", 12)); // 1 USDC = 0.5 CERE
  await mockRouter.setExchangeRate(usdtTokenAddress, cereTokenAddress, ethers.parseUnits("0.48", 12)); // 1 USDT = 0.48 CERE
  
  // 9. Mint some tokens to deployer for testing
  console.log("\nMinting tokens to deployer for testing...");
  await cereToken.mint(deployer.address, ethers.parseUnits("1000000", 18)); // 1 million CERE
  await usdcToken.mint(deployer.address, ethers.parseUnits("1000000", 6)); // 1 million USDC
  await usdtToken.mint(deployer.address, ethers.parseUnits("1000000", 6)); // 1 million USDT
  
  // 10. Deploy test integration contract
  console.log("\nDeploying SecurityIntegrationTester...");
  const SecurityIntegrationTester = await ethers.getContractFactory("SecurityIntegrationTester");
  const tester = await SecurityIntegrationTester.deploy(paymentHandlerAddress, securityManagerAddress);
  await tester.waitForDeployment();
  const testerAddress = await tester.getAddress();
  console.log(`SecurityIntegrationTester deployed at: ${testerAddress}`);
  
  // 11. Configure test users
  console.log("\nConfiguring test environment...");
  
  // Create test users
  const [, admin, operator, blacklistedUser] = await ethers.getSigners();
  
  // Set test users in tester
  await tester.setTestUsers(admin.address, operator.address, blacklistedUser.address);
  console.log(`Test users configured: Admin=${admin.address}, Operator=${operator.address}, Blacklisted=${blacklistedUser.address}`);
  
  // Add operator role to test operator
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  await securityManager.addOperator(operator.address);
  console.log(`Added OPERATOR_ROLE to ${operator.address}`);
  
  // Set test stablecoins
  await tester.setTestStablecoin("USDC", usdcTokenAddress);
  await tester.setTestStablecoin("USDT", usdtTokenAddress);
  console.log("Test stablecoins configured");
  
  // 12. Mint some tokens to test users
  await cereToken.mint(admin.address, ethers.parseUnits("100000", 18)); // 100k CERE
  await cereToken.mint(operator.address, ethers.parseUnits("100000", 18)); // 100k CERE
  await cereToken.mint(blacklistedUser.address, ethers.parseUnits("100000", 18)); // 100k CERE
  
  await usdcToken.mint(admin.address, ethers.parseUnits("100000", 6)); // 100k USDC
  await usdcToken.mint(operator.address, ethers.parseUnits("100000", 6)); // 100k USDC
  await usdcToken.mint(blacklistedUser.address, ethers.parseUnits("100000", 6)); // 100k USDC
  
  await usdtToken.mint(admin.address, ethers.parseUnits("100000", 6)); // 100k USDT
  await usdtToken.mint(operator.address, ethers.parseUnits("100000", 6)); // 100k USDT
  await usdtToken.mint(blacklistedUser.address, ethers.parseUnits("100000", 6)); // 100k USDT
  
  console.log("\nTokens minted to test users");
  
  // 13. Write deployment info to file
  const deploymentInfo = {
    network: network.name,
    contracts: {
      MockERC20_CERE: cereTokenAddress,
      MockERC20_USDC: usdcTokenAddress,
      MockERC20_USDT: usdtTokenAddress,
      MockUniswapRouter: mockRouterAddress,
      SecurityManager: securityManagerAddress,
      TokenSwapper: tokenSwapperAddress,
      HyperbridgeTeleport: hyperbridgeTeleportAddress,
      StablecoinPaymentHandler: paymentHandlerAddress,
      SecurityIntegrationTester: testerAddress
    },
    testUsers: {
      deployer: deployer.address,
      admin: admin.address,
      operator: operator.address,
      blacklistedUser: blacklistedUser.address
    },
    deploymentTime: new Date().toISOString()
  };
  
  const deploymentDir = "./deployments";
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }
  
  fs.writeFileSync(
    `${deploymentDir}/testnet-deployment-${network.name}-${deploymentInfo.deploymentTime.split('T')[0]}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\nTestnet deployment information saved to file");
  
  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network ${network.name} ${cereTokenAddress} "Cere Network Token" "CERE" 18`);
  console.log(`npx hardhat verify --network ${network.name} ${usdcTokenAddress} "USD Coin" "USDC" 6`);
  console.log(`npx hardhat verify --network ${network.name} ${usdtTokenAddress} "Tether USD" "USDT" 6`);
  console.log(`npx hardhat verify --network ${network.name} ${mockRouterAddress}`);
  console.log(`npx hardhat verify --network ${network.name} ${securityManagerAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network ${network.name} ${tokenSwapperAddress} "${mockRouterAddress}"`);
  console.log(`npx hardhat verify --network ${network.name} ${hyperbridgeTeleportAddress} "${tokenSwapperAddress}" "${cereTokenAddress}"`);
  console.log(`npx hardhat verify --network ${network.name} ${paymentHandlerAddress}`);
  console.log(`npx hardhat verify --network ${network.name} ${testerAddress} "${paymentHandlerAddress}" "${securityManagerAddress}"`);
  
  console.log("\nTestnet deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 