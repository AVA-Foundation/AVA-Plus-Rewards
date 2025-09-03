import { ethers, network } from "hardhat";
import fs from "fs";

// 10 minutes
const NEW_WITHDRAW_PERIOD = 10 * 60;

async function updateCommonWithdrawPeriod() {

  // Read DailyEarnLockupContractAddress depending on the network
  const filePath = `${__dirname}/../deployed-contract-address/${network.name}/deployedContractAddressList.json`;
  const rawData = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(rawData)
  const DailyEarnLockupContractAddress = data.DailyEarnLockup;
  console.log(`DailyEarnLockupContractAddress: ${DailyEarnLockupContractAddress}`);

  const signer = await ethers.provider.getSigner()
  const DailyEarnLockupContract = await ethers.getContractAt("DailyEarnLockUp", DailyEarnLockupContractAddress, signer)

  const tx = await DailyEarnLockupContract.updateCommonWithdrawPeriod(
    NEW_WITHDRAW_PERIOD
  );
  await tx.wait();

  console.log(`updateCommonWithdrawPeriod - Tx: ${tx.hash}`);
}

updateCommonWithdrawPeriod().catch((error) => {
  console.error(error);
  process.exit(1);
});
