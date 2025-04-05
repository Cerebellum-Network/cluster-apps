import { ethers, network } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log(`Deploying contracts with security measures to ${network.name}...`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
  
  // 1. Deploy security manager
  console.log("\n[1/4] Deploying SecurityManager...");
  const SecurityManager = await ethers.getContractFactory("SecurityManager");
  const securityManager = await SecurityManager.deploy(deployer.address);
  await securityManager.waitForDeployment();
  const securityManagerAddress = await securityManager.getAddress();
  console.log(`SecurityManager deployed at: ${securityManagerAddress}`);
  
  // 2. Deploy and set up token swapper
  console.log("\n[2/4] Deploying TokenSwapper...");
  const TokenSwapper = await ethers.getContractFactory("TokenSwapper");
  const uniswapRouterAddress = process.env.UNISWAP_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Mainnet router
  const tokenSwapper = await TokenSwapper.deploy(uniswapRouterAddress);
  await tokenSwapper.waitForDeployment();
  const tokenSwapperAddress = await tokenSwapper.getAddress();
  console.log(`TokenSwapper deployed at: ${tokenSwapperAddress}`);
  
  // 3. Deploy hyperbridge teleport
  console.log("\n[3/4] Deploying HyperbridgeTeleport...");
  const HyperbridgeTeleport = await ethers.getContractFactory("HyperbridgeTeleport");
  const cereTokenAddress = process.env.CERE_TOKEN || "0x2da719db753dfa10a62e140f436e1d67f2ddb0d6"; // Replace with actual token
  const hyperbridgeTeleport = await HyperbridgeTeleport.deploy(tokenSwapperAddress, cereTokenAddress);
  await hyperbridgeTeleport.waitForDeployment();
  const hyperbridgeTeleportAddress = await hyperbridgeTeleport.getAddress();
  console.log(`HyperbridgeTeleport deployed at: ${hyperbridgeTeleportAddress}`);
  
  // Enable mock mode for testing
  console.log("Enabling mock mode for HyperbridgeTeleport...");
  await hyperbridgeTeleport.setMockMode(true);
  
  // 4. Deploy payment handler
  console.log("\n[4/4] Deploying StablecoinPaymentHandler...");
  const StablecoinPaymentHandler = await ethers.getContractFactory("StablecoinPaymentHandler");
  const paymentHandler = await StablecoinPaymentHandler.deploy();
  await paymentHandler.waitForDeployment();
  const paymentHandlerAddress = await paymentHandler.getAddress();
  console.log(`StablecoinPaymentHandler deployed at: ${paymentHandlerAddress}`);
  
  // 5. Configure contracts
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
  const usdcAddress = process.env.USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC
  const usdtAddress = process.env.USDT_ADDRESS || "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // Mainnet USDT
  const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  
  console.log("Adding supported stablecoins...");
  await paymentHandler.setStablecoinSupport(usdcAddress, true);
  await paymentHandler.setStablecoinSupport(usdtAddress, true);
  await paymentHandler.setStablecoinSupport(daiAddress, true);
  
  console.log("Setting pool fees in TokenSwapper...");
  // 0.05% fee for USDC/CERE pool
  await tokenSwapper.setPoolFee(usdcAddress, cereTokenAddress, 500);
  // 0.3% fee for USDT/CERE pool
  await tokenSwapper.setPoolFee(usdtAddress, cereTokenAddress, 3000);
  
  // Configure enhanced security settings
  console.log("Setting up enhanced security...");
  
  // 1. Configurar umbrales de detección de anomalías
  await securityManager.setAnomalyThresholds(
    ethers.parseUnits("3000", 6),  // 3000 USDC high value threshold
    5,                            // 5 txs rapid transaction alert
    5 * 60,                       // 5 minute window
    ethers.parseUnits("20000", 6)  // 20,000 USDC daily volume threshold
  );
  console.log("Anomaly detection thresholds configured");
  
  // 2. Configurar protección anti-MEV
  await securityManager.setMinTimeBetweenTransactions(2); // 2 seconds minimum between txs
  console.log("Anti-MEV protection configured");
  
  // 3. Configurar administradores de confianza
  // En un despliegue real, esto sería más de una dirección para multi-firma
  await securityManager.addTrustedAdmin(deployer.address);
  console.log("Trusted admin configured");
  
  // 4. Configurar requisito de firmas para operaciones críticas (para despliegue inicial, 1 es suficiente)
  await securityManager.setRequiredSignatures(1);
  console.log("Required signatures configured");
  
  // 5. Configurar roles adicionales (en un despliegue real, se usarían direcciones diferentes)
  const securityAdmin = deployer.address; // En un despliegue real, usar dirección específica para rol de seguridad
  const operator = deployer.address; // En un despliegue real, usar dirección específica para operador
  
  await securityManager.addSecurityRole(securityAdmin);
  await securityManager.addOperator(operator);
  console.log("Security roles configured");
  
  // 6. Deploy test integration contract
  console.log("\nDeploying SecurityIntegrationTester...");
  const SecurityIntegrationTester = await ethers.getContractFactory("SecurityIntegrationTester");
  const tester = await SecurityIntegrationTester.deploy(paymentHandlerAddress, securityManagerAddress);
  await tester.waitForDeployment();
  const testerAddress = await tester.getAddress();
  console.log(`SecurityIntegrationTester deployed at: ${testerAddress}`);
  
  // 7. Configure test users and tokens
  console.log("\nConfiguring test environment...");
  
  // Create test users
  const [, admin, blacklistedUser] = await ethers.getSigners();
  
  // Set test users in tester
  await tester.setTestUsers(admin.address, operator.address, blacklistedUser.address);
  console.log(`Test users configured: Admin=${admin.address}, Operator=${operator.address}, Blacklisted=${blacklistedUser.address}`);
  
  // 8. Write deployment info to file
  const deploymentInfo = {
    network: network.name,
    contracts: {
      SecurityManager: securityManagerAddress,
      TokenSwapper: tokenSwapperAddress,
      HyperbridgeTeleport: hyperbridgeTeleportAddress,
      StablecoinPaymentHandler: paymentHandlerAddress,
      SecurityIntegrationTester: testerAddress
    },
    tokens: {
      CERE: cereTokenAddress,
      USDC: usdcAddress,
      USDT: usdtAddress,
      DAI: daiAddress
    },
    testUsers: {
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
    `${deploymentDir}/deployment-${network.name}-${deploymentInfo.deploymentTime.split('T')[0]}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\nDeployment information saved to file");
  
  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network ${network.name} ${securityManagerAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network ${network.name} ${tokenSwapperAddress} "${uniswapRouterAddress}"`);
  console.log(`npx hardhat verify --network ${network.name} ${hyperbridgeTeleportAddress} "${tokenSwapperAddress}" "${cereTokenAddress}"`);
  console.log(`npx hardhat verify --network ${network.name} ${paymentHandlerAddress}`);
  console.log(`npx hardhat verify --network ${network.name} ${testerAddress} "${paymentHandlerAddress}" "${securityManagerAddress}"`);
  
  console.log("\nDeployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 