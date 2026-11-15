import type { BaseContract } from "ethers";
import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import deployDailyEarnGateKeeper from "../deploy/daily-earn-gatekeeper";

async function storeDeployedContractAddressList(
  contracts: Array<BaseContract>,
) {
  if (network.name === "hardhat") {
    return;
  }

  const [deployedDailyEarnGateKeeperContract] = contracts;

  const deployedContractAddressList: Object = {
    network: network.name,
    chainId: network.config.chainId,
    DailyEarnGateKeeper: await deployedDailyEarnGateKeeperContract.getAddress(),
  };

  const contractsDir: string = path.join(
    __dirname,
    "/..",
    `deployed-contract-address/${network.name}/gatekeeper`,
  );

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "/", "deployedContractAddressList.json"),
    JSON.stringify(deployedContractAddressList),
  );
}

async function main() {
  let contractDailyEarnLockUpAddr = "";
  if (network.name === "ethereumMainnet") {
    contractDailyEarnLockUpAddr = "0x5CC235Eca665ED2A752802ed784EAe373e6B0Beb";
  } else if (network.name === "iotaEvmTestnet") {
    contractDailyEarnLockUpAddr = "0xd78E4ebE13dE81b05bDfBe2d3468AEb7cFd7ead2";
  } else if (network.name === "hardhat") {
    contractDailyEarnLockUpAddr = "0xd78E4ebE13dE81b05bDfBe2d3468AEb7cFd7ead2";
  } else {
    throw new Error("Unsupported network");
  }

  // Deploy contracts
  const deployedDailyEarnGateKeeperContract = await deployDailyEarnGateKeeper(
    contractDailyEarnLockUpAddr,
  );

  // Store the deployed contract addresses
  await storeDeployedContractAddressList([deployedDailyEarnGateKeeperContract]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
