import { ethers, network } from "hardhat";
import AVAContractABI from "../abi/AVA.json";
import { MockAVA } from "../typechain-types/contracts/test";

const AVA_TOKEN_ADDRESS_ETH_MAINNET = "0xa6C0c097741D55ECd9a3A7DeF3A8253fD022ceB9";

async function deployAVAToken(): Promise<MockAVA> {
  let AVATokenContract: MockAVA;

  // On Ethereum Mainnet, reference the existing AVA
  if (
    network.name === "ethereumMainnet"
  ) {
    AVATokenContract = new ethers.Contract(
      AVA_TOKEN_ADDRESS_ETH_MAINNET,
      AVAContractABI,
      ethers.provider
    );
    console.log(
      "Existing AVATokenContract address:",
      await AVATokenContract.getAddress()
    );
  } else {
    // On testnet, deploy a mock AVA token
    AVATokenContract = await ethers.deployContract("MockAVA", []);
    await AVATokenContract.waitForDeployment();

    if (network.name !== "hardhat") {
      console.log(
        "Deployed mock AVATokenContract address:",
        await AVATokenContract.getAddress()
      );
    }
  }

  return AVATokenContract;
}

export default deployAVAToken;
