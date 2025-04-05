import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { HyperbridgeTeleport, MockERC20 } from "../../typechain-types";

describe("HyperbridgeTeleport Integration Test", function () {
  // Contract instances
  let hyperbridgeTeleport: HyperbridgeTeleport;
  
  // Mock tokens
  let cereToken: MockERC20;
  
  // Mock swapper (not used directly in these tests)
  let mockSwapper: any;
  
  // Test accounts
  let deployer: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  
  // Constants
  const INITIAL_BALANCE = ethers.parseUnits("10000", 18); // 10,000 CERE with 18 decimals
  const TELEPORT_AMOUNT = ethers.parseUnits("1000", 18);  // 1,000 CERE
  const CERE_NETWORK_ADDRESS = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"; // Example Cere address
  
  beforeEach(async function () {
    // Get test accounts
    [deployer, relayer, user] = await ethers.getSigners();
    
    // Deploy mock CERE token with 18 decimals
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    cereToken = await MockERC20Factory.deploy("Cere Token", "CERE", 18);
    
    // Deploy mock swapper (not used directly in these tests)
    mockSwapper = ethers.ZeroAddress;
    
    // Deploy HyperbridgeTeleport
    const HyperbridgeTeleportFactory = await ethers.getContractFactory("HyperbridgeTeleport");
    hyperbridgeTeleport = await HyperbridgeTeleportFactory.deploy(
      mockSwapper,
      await cereToken.getAddress()
    );
    
    // Add relayer
    await hyperbridgeTeleport.setRelayerAuthorization(relayer.address, true);
    
    // Mint CERE tokens to user
    await cereToken.mint(user.address, INITIAL_BALANCE);
  });
  
  describe("HyperbridgeTeleport Functionality", function () {
    it("Should teleport tokens correctly with mock mode off", async function () {
      // Set mock mode to false for this test
      await hyperbridgeTeleport.setMockMode(false);
      
      // Approve HyperbridgeTeleport to spend user's CERE tokens
      await cereToken.connect(user).approve(
        await hyperbridgeTeleport.getAddress(),
        TELEPORT_AMOUNT
      );
      
      // Teleport tokens
      const tx = await hyperbridgeTeleport.connect(user).teleportToCereNetwork(
        TELEPORT_AMOUNT,
        CERE_NETWORK_ADDRESS
      );
      
      const receipt = await tx.wait();
      
      // Get the teleport transaction ID from the event
      const teleportInitiatedEvent = receipt!.logs
        .filter(log => log.topics[0] === ethers.id("TeleportInitiated(bytes32,address,string,uint256,uint256)"))
        .map(log => hyperbridgeTeleport.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        }))[0];
      
      const txId = teleportInitiatedEvent?.args[0];
      expect(txId).to.not.be.undefined;
      
      // Check teleport status - should be Pending since mock mode is off
      const teleportStatus = await hyperbridgeTeleport.checkTeleportStatus(txId);
      expect(teleportStatus).to.equal(1); // Pending
      
      // Check teleport details
      const teleportDetails = await hyperbridgeTeleport.getTeleportDetails(txId);
      expect(teleportDetails[0]).to.equal(user.address); // from
      expect(teleportDetails[1]).to.equal(CERE_NETWORK_ADDRESS); // cereNetworkAddress
      
      // Calculate amount after fee (1% by default)
      const fee = TELEPORT_AMOUNT * 100n / 10000n; // 1% fee
      const amountAfterFee = TELEPORT_AMOUNT - fee;
      expect(teleportDetails[2]).to.equal(amountAfterFee); // amount
      
      // Check balances
      expect(await cereToken.balanceOf(user.address)).to.equal(INITIAL_BALANCE - TELEPORT_AMOUNT);
      expect(await cereToken.balanceOf(await hyperbridgeTeleport.getAddress())).to.equal(amountAfterFee);
      expect(await cereToken.balanceOf(deployer.address)).to.equal(fee); // Fee goes to owner
      
      // Update teleport status as relayer (simulate successful teleport)
      await hyperbridgeTeleport.connect(relayer).updateTeleportStatus(txId, 2); // Completed
      
      // Check status is updated
      expect(await hyperbridgeTeleport.checkTeleportStatus(txId)).to.equal(2); // Completed
    });
    
    it("Should teleport tokens correctly with mock mode on", async function () {
      // Set mock mode to true
      await hyperbridgeTeleport.setMockMode(true);
      
      // Approve HyperbridgeTeleport to spend user's CERE tokens
      await cereToken.connect(user).approve(
        await hyperbridgeTeleport.getAddress(),
        TELEPORT_AMOUNT
      );
      
      // Teleport tokens
      const tx = await hyperbridgeTeleport.connect(user).teleportToCereNetwork(
        TELEPORT_AMOUNT,
        CERE_NETWORK_ADDRESS
      );
      
      const receipt = await tx.wait();
      
      // Get the teleport transaction ID from the event
      const teleportInitiatedEvent = receipt!.logs
        .filter(log => log.topics[0] === ethers.id("TeleportInitiated(bytes32,address,string,uint256,uint256)"))
        .map(log => hyperbridgeTeleport.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        }))[0];
      
      const txId = teleportInitiatedEvent?.args[0];
      expect(txId).to.not.be.undefined;
      
      // Check teleport status - should be Completed immediately since mock mode is on
      const teleportStatus = await hyperbridgeTeleport.checkTeleportStatus(txId);
      expect(teleportStatus).to.equal(2); // Completed
    });
    
    it("Should update teleport status correctly by authorized relayer", async function () {
      // Set mock mode to false
      await hyperbridgeTeleport.setMockMode(false);
      
      // Approve and teleport
      await cereToken.connect(user).approve(
        await hyperbridgeTeleport.getAddress(),
        TELEPORT_AMOUNT
      );
      
      const tx = await hyperbridgeTeleport.connect(user).teleportToCereNetwork(
        TELEPORT_AMOUNT,
        CERE_NETWORK_ADDRESS
      );
      
      const receipt = await tx.wait();
      
      // Get teleport ID
      const teleportInitiatedEvent = receipt!.logs
        .filter(log => log.topics[0] === ethers.id("TeleportInitiated(bytes32,address,string,uint256,uint256)"))
        .map(log => hyperbridgeTeleport.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        }))[0];
      
      const txId = teleportInitiatedEvent?.args[0];
      
      // Update status to Completed
      await hyperbridgeTeleport.connect(relayer).updateTeleportStatus(txId, 2);
      expect(await hyperbridgeTeleport.checkTeleportStatus(txId)).to.equal(2);
      
      // Try to update again should fail
      await expect(
        hyperbridgeTeleport.connect(relayer).updateTeleportStatus(txId, 3)
      ).to.be.revertedWith("Teleport not in Pending state");
    });
    
    it("Should fail if non-relayer tries to update teleport status", async function () {
      // Set mock mode to false
      await hyperbridgeTeleport.setMockMode(false);
      
      // Approve and teleport
      await cereToken.connect(user).approve(
        await hyperbridgeTeleport.getAddress(),
        TELEPORT_AMOUNT
      );
      
      const tx = await hyperbridgeTeleport.connect(user).teleportToCereNetwork(
        TELEPORT_AMOUNT,
        CERE_NETWORK_ADDRESS
      );
      
      const receipt = await tx.wait();
      
      // Get teleport ID
      const teleportInitiatedEvent = receipt!.logs
        .filter(log => log.topics[0] === ethers.id("TeleportInitiated(bytes32,address,string,uint256,uint256)"))
        .map(log => hyperbridgeTeleport.interface.parseLog({
          topics: [...log.topics],
          data: log.data
        }))[0];
      
      const txId = teleportInitiatedEvent?.args[0];
      
      // Try to update status as non-relayer
      await expect(
        hyperbridgeTeleport.connect(user).updateTeleportStatus(txId, 2)
      ).to.be.revertedWith("Not authorized");
    });
    
    it("Should apply teleport fee correctly", async function () {
      // Set teleport fee to 2%
      await hyperbridgeTeleport.setTeleportFee(200); // 200 basis points = 2%
      
      // Approve and teleport
      await cereToken.connect(user).approve(
        await hyperbridgeTeleport.getAddress(),
        TELEPORT_AMOUNT
      );
      
      await hyperbridgeTeleport.connect(user).teleportToCereNetwork(
        TELEPORT_AMOUNT,
        CERE_NETWORK_ADDRESS
      );
      
      // Calculate 2% fee
      const fee = TELEPORT_AMOUNT * 200n / 10000n; // 2% fee
      const amountAfterFee = TELEPORT_AMOUNT - fee;
      
      // Check balances
      expect(await cereToken.balanceOf(user.address)).to.equal(INITIAL_BALANCE - TELEPORT_AMOUNT);
      expect(await cereToken.balanceOf(await hyperbridgeTeleport.getAddress())).to.equal(amountAfterFee);
      expect(await cereToken.balanceOf(deployer.address)).to.equal(fee); // Fee goes to owner
    });
    
    it("Should reject fee setting above maximum", async function () {
      const maxFee = await hyperbridgeTeleport.MAX_FEE_PERCENTAGE();
      
      // Try to set fee above maximum
      await expect(
        hyperbridgeTeleport.setTeleportFee(maxFee + 1n)
      ).to.be.revertedWith("Fee exceeds maximum allowed");
    });
    
    it("Should fail teleport if amount is zero", async function () {
      await expect(
        hyperbridgeTeleport.connect(user).teleportToCereNetwork(
          0,
          CERE_NETWORK_ADDRESS
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });
    
    it("Should fail teleport if CERE network address is empty", async function () {
      await expect(
        hyperbridgeTeleport.connect(user).teleportToCereNetwork(
          TELEPORT_AMOUNT,
          ""
        )
      ).to.be.revertedWith("Invalid Cere network address");
    });
  });
}); 