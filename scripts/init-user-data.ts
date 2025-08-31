import { ethers, network } from "hardhat";
import fs from "fs";

enum MembershipType {
  Unknown,
  SmartSteel,
  SmartBronze,
  SmartSilver,
  SmartGold,
  SmartPlatinum,
  SmartDiamond
}

const membershipType = MembershipType.SmartGold;
const walletAddress = "0xD25cAb437306b53e7517C789423606BfF08fc3d4";
const userId = "user_123"; // Example userId based on wallet address
const amountNFTs = 0;

async function initUserData() {

  // Read DailyEarnLockupContractAddress depending on the network
  const filePath = `${__dirname}/../deployed-contract-address/${network.name}/deployedContractAddressList.json`;
  const rawData = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(rawData)
  const DailyEarnLockupContractAddress = data.DailyEarnLockup;
  console.log(`DailyEarnLockupContractAddress: ${DailyEarnLockupContractAddress}`);

  const signer = await ethers.provider.getSigner()
  const DailyEarnLockupContract = await ethers.getContractAt("DailyEarnLockUp", DailyEarnLockupContractAddress, signer)

  const tx = await DailyEarnLockupContract.initUserData(
    userId,
    membershipType,
    walletAddress,
    amountNFTs
  );
  await tx.wait();

  console.log(`User data set successfully - Tx: ${tx.hash}`);
}

initUserData().catch((error) => {
  console.error(error);
  process.exit(1);
});
