import { ethers, network } from "hardhat";
import { DailyEarnLockUp } from "../typechain-types";

// Only for testnet
// 10 minutes
const NEW_WITHDRAW_PERIOD = 10 * 60;

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
    // On testnet, set withdraw period to 10 minutes
    const tx = await DailyEarnLockUpContract.updateCommonWithdrawPeriod(NEW_WITHDRAW_PERIOD);
    await tx.wait();
    console.log(`updateCommonWithdrawPeriod to 10 minutes - Tx: ${tx.hash}`);
  }

  return DailyEarnLockUpContract;
}

export default deployDailyEarnLockUp;
