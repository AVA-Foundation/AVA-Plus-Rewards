import type { BaseContract } from "ethers";
import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import deployDailyEarnLockup from "../deploy/daily-earn-lockup";
import deployAVAToken from "../deploy/AVA-token";

async function storeDeployedContractAddressList(
  contracts: Array<BaseContract>
) {
  if (network.name === "hardhat") {
    return;
  }

  const [
    deployedAVAContract,
    deployedDailyEarnLockupContract,
  ] = contracts;

  const deployedContractAddressList: Object = {
    network: network.name,
    chainId: network.config.chainId,
    AVA: await deployedAVAContract.getAddress(),
    DailyEarnLockup: await deployedDailyEarnLockupContract.getAddress(),
  };

  const contractsDir: string = path.join(
    __dirname,
    "/..",
    `deployed-contract-address/${network.name}`
  );

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "/", "deployedContractAddressList.json"),
    JSON.stringify(deployedContractAddressList)
  );
}

async function main() {
  // Deploy contracts
  const deployedAVAContract = await deployAVAToken();
  const deployedAVAContractAddress = await deployedAVAContract.getAddress();
  const deployedDailyEarnLockupContract = await deployDailyEarnLockup(
    deployedAVAContractAddress,
    process.env.COMMUNITY_WALLET as string,
  );

  // Store the deployed contract addresses
  await storeDeployedContractAddressList([
    deployedAVAContract,
    deployedDailyEarnLockupContract,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
