import { expect } from "chai";
import { ethers } from "hardhat";

describe("Simple Test", function () {
  it("Should pass a basic test", async function () {
    expect(true).to.be.true;
  });

  it("Should work with ethers", async function () {
    const [signer] = await ethers.getSigners();
    expect(signer.address).to.be.a('string');
  });
}); 