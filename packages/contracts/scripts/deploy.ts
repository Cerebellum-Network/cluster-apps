import { ethers, network } from "hardhat";
import { StablecoinPaymentHandler, TokenSwapper, HyperbridgeTeleport } from "../typechain-types";

async function main() {
  console.log(`Deploying contracts to ${network.name}...`);

  // 1. Deploy the stablecoin payment handler
  const StablecoinPaymentHandlerFactory = await ethers.getContractFactory("StablecoinPaymentHandler");
  console.log("Deploying StablecoinPaymentHandler...");
  const stablecoinPaymentHandler = await StablecoinPaymentHandlerFactory.deploy();
  await stablecoinPaymentHandler.waitForDeployment();
  console.log(`StablecoinPaymentHandler deployed to: ${await stablecoinPaymentHandler.getAddress()}`);
  
  // 2. Deploy the token exchanger (DEX)
  const TokenSwapperFactory = await ethers.getContractFactory("TokenSwapper");
  console.log("Deploying TokenSwapper...");
  const tokenSwapper = await TokenSwapperFactory.deploy(
    process.env.UNISWAP_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564"
  );
  await tokenSwapper.waitForDeployment();
  console.log(`TokenSwapper deployed to: ${await tokenSwapper.getAddress()}`);
  
  // 3. Deploy the contract to teleport tokens through Hyperbridge
  const HyperbridgeTeleportFactory = await ethers.getContractFactory("HyperbridgeTeleport");
  console.log("Deploying HyperbridgeTeleport...");
  const hyperbridgeTeleport = await HyperbridgeTeleportFactory.deploy(
    await tokenSwapper.getAddress(),
    process.env.CERE_ADDRESS || "0x2da719db753dfa10a62e140f436e1d67f2ddb0d6"
  );
  await hyperbridgeTeleport.waitForDeployment();
  console.log(`HyperbridgeTeleport deployed to: ${await hyperbridgeTeleport.getAddress()}`);
  
  // 4. Configure the payment handler to use swap and teleport
  console.log("Configuring StablecoinPaymentHandler...");
  const setTokenSwapperTx = await stablecoinPaymentHandler.setTokenSwapper(
    await tokenSwapper.getAddress()
  );
  await setTokenSwapperTx.wait();
  
  const setHyperbridgeTeleportTx = await stablecoinPaymentHandler.setHyperbridgeTeleport(
    await hyperbridgeTeleport.getAddress()
  );
  await setHyperbridgeTeleportTx.wait();
  
  console.log("Deployment completed successfully!");
  
  // Log addresses to facilitate verification
  console.log("Contract addresses:");
  console.log("-".repeat(50));
  console.log(`StablecoinPaymentHandler: ${await stablecoinPaymentHandler.getAddress()}`);
  console.log(`TokenSwapper: ${await tokenSwapper.getAddress()}`);
  console.log(`HyperbridgeTeleport: ${await hyperbridgeTeleport.getAddress()}`);
  console.log("-".repeat(50));
  console.log("Verify contracts:");
  console.log(`npx hardhat verify --network ${network.name} ${await stablecoinPaymentHandler.getAddress()}`);
  console.log(`npx hardhat verify --network ${network.name} ${await tokenSwapper.getAddress()} "${process.env.UNISWAP_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564"}"`);
  console.log(`npx hardhat verify --network ${network.name} ${await hyperbridgeTeleport.getAddress()} "${await tokenSwapper.getAddress()}" "${process.env.CERE_ADDRESS || "0x2da719db753dfa10a62e140f436e1d67f2ddb0d6"}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 