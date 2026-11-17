import { ethers, network } from "hardhat";
import { DailyEarnGateKeeper } from "../typechain-types";

async function deployDailyEarnGateKeeper(
  contractDailyEarnLockUpAddr: string,
): Promise<DailyEarnGateKeeper> {
  const DailyEarnGateKeeperContract = await ethers.deployContract(
    "DailyEarnGateKeeper",
    [contractDailyEarnLockUpAddr],
  );
  await DailyEarnGateKeeperContract.waitForDeployment();

  if (network.name !== "hardhat") {
    console.log(
      "Deployed DailyEarnGateKeeperContract address:",
      await DailyEarnGateKeeperContract.getAddress(),
    );
  }

  return DailyEarnGateKeeperContract;
}

export default deployDailyEarnGateKeeper;
