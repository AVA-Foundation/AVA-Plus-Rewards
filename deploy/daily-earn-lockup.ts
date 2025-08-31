import { ethers, network } from "hardhat";
import { DailyEarnLockUp } from "../typechain-types";

async function deployDailyEarnLockUp(
  AVATokenContractAddress: string,
  communityWallet: string,
): Promise<DailyEarnLockUp> {

  const DailyEarnLockUpContract = await ethers.deployContract("DailyEarnLockUp", [
    AVATokenContractAddress,
    communityWallet,
  ]);
  await DailyEarnLockUpContract.waitForDeployment();

  if (network.name !== "hardhat") {
    console.log(
      "Deployed DailyEarnLockUpContract address:",
      await DailyEarnLockUpContract.getAddress()
    );
  }

  if (network.name === "iotaEvmTestnet") {
    // On testnet, set withdraw period to 1 day
    const tx = await DailyEarnLockUpContract.updateCommonWithdrawPeriod(24 * 60 * 60);
    await tx.wait();
    console.log(`updateCommonWithdrawPeriod to 1 day - Tx: ${tx.hash}`);
  }

  return DailyEarnLockUpContract;
}

export default deployDailyEarnLockUp;
