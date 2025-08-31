import { expect, use } from "chai";
import { ethers } from "hardhat";
import { EventLog } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { DailyEarnLockUp } from "../typechain-types";
import deployDailyEarnLockup from "../deploy/daily-earn-lockup";
import deployAVAToken from "../deploy/AVA-token";
import { MockAVA } from "../typechain-types/contracts/test";
import { toWei } from "../utils";

const COMMUNITY_WALLET='0xE234857A497deCf6239911C8190c195a0eaBB638'

describe("Test if daily earnings are correctly calculated for locked tokens", () => {
  let DailyEarnLockUpContract: DailyEarnLockUp;
  let DailyEarnLockUpContractAddress: string;
  let AVATokenContract: MockAVA;
  let AVATokenContractAddress: string;

  let COMMON_MIN_LOCKUP_AMOUNT = BigInt(1 * 10 ** 18); // 1 
  let THIRTY_DAYS = 30 * 24 * 60 * 60; // 30 days in seconds
  let COMMON_MIN_WITHDRAW_PERIOD = BigInt(THIRTY_DAYS); // 30 days in seconds
  let COMMON_APR = BigInt(50); // 50 means 5% or 75 means 7.5%
  let APR_FACTOR = 1000; // APR factor for calculations

  let ONE_DAY = 24 * 60 * 60; // 24 hours in seconds

  let owner: any;
  let auth: any;
  let user1: any;
  let user2: any;

  enum MembershipType {
    Unknown,
    SmartSteel,
    SmartBronze,
    SmartSilver,
    SmartGold,
    SmartPlatinum,
    SmartDiamond
  }

  let USER1_DATA = {
    userId: "user1",
    membershipType: MembershipType.SmartSteel,
    walletAddress: "",
    amountNFTs: 0n,
    lockedTokens: toWei(1_000), // 1000 tokens
    withdrawnTokens: toWei(800) // 800 tokens
  };

  let USER2_DATA = {
    userId: "user2",
    membershipType: MembershipType.SmartGold,
    walletAddress: "",
    amountNFTs: 0n,
    lockedTokens: toWei(5_000), // 5000 tokens
    withdrawnTokens: toWei(1200) // 1200 tokens
  };

  it("Deploy DailyEarnLockUp contracts", async () => {
    [owner, auth, user1, user2] = await ethers.getSigners();
    USER1_DATA.walletAddress = user1.address;
    USER2_DATA.walletAddress = user2.address;

    AVATokenContract = await deployAVAToken();
    AVATokenContractAddress = await AVATokenContract.getAddress();

    await AVATokenContract.transfer(
      user1.address,
      toWei(1_000_000) // 1 million tokens
    );

    await AVATokenContract.transfer(
      user2.address,
      toWei(4_000_000) // 4 million tokens
    );

    DailyEarnLockUpContract = await deployDailyEarnLockup(
      AVATokenContractAddress,
      COMMUNITY_WALLET
    );
    DailyEarnLockUpContractAddress = await DailyEarnLockUpContract.getAddress();

    let maxTotalLockedAmount = await DailyEarnLockUpContract.maxTotalLockedAmount();
    expect(maxTotalLockedAmount).to.equal(toWei(5_000_000));

    let totalLockedAmount = await DailyEarnLockUpContract.totalLockedAmount();
    expect(totalLockedAmount).to.equal(0n);

  });

  it("Verify initialized membershipTypeToCondition", async () => {
    let membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.Unknown
    );
    expect(membershipType.some(el => el !== 0n)).to.equal(false); // apr

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartSteel
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(BigInt(10_000 * 10 ** 18)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartBronze
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(BigInt(20_000 * 10 ** 18)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartSilver
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(50_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartGold
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(80_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartPlatinum
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(100_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartDiamond
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(200_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(60n); // apr
    expect(membershipType[4]).to.equal(3n); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(5n); // maxAllowedAmountNFTs
  });

  it("Verify user wallet not yet registered", async () => {
    const isRegistered = await DailyEarnLockUpContract.isWalletAddressRegistered(
      USER1_DATA.walletAddress
    );
    expect(isRegistered).to.equal(false);
  });

  it("Verify the user data setup including userId, walletAddress, amountNFTs and membershipType", async () => {
    let isRegistered = await DailyEarnLockUpContract.isWalletAddressRegistered(
      USER1_DATA.walletAddress
    );
    expect(isRegistered).to.equal(false);

    await DailyEarnLockUpContract.initUserData(
      USER1_DATA.userId,
      USER1_DATA.membershipType,
      USER1_DATA.walletAddress,
      USER1_DATA.amountNFTs
    );

    isRegistered = await DailyEarnLockUpContract.isWalletAddressRegistered(
      USER1_DATA.walletAddress
    );
    expect(isRegistered).to.equal(true);

    const userIdToWalletAddress = await DailyEarnLockUpContract.userIdToWalletAddress(
      USER1_DATA.userId
    );
    expect(userIdToWalletAddress).to.equal(USER1_DATA.walletAddress);
    const userIdToAmountNFTs = await DailyEarnLockUpContract.userIdToAmountNFTs(
      USER1_DATA.userId
    );
    expect(userIdToAmountNFTs).to.equal(USER1_DATA.amountNFTs);
    const userIdToMembershipType = await DailyEarnLockUpContract.userIdToMembershipType(
      USER1_DATA.userId
    );
    expect(userIdToMembershipType).to.equal(USER1_DATA.membershipType);
    const userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER1_DATA.userId
    );
    // expect(userIdToLockupStats.some((el: any) => el !== 0n || el === true)).to.equal(false);
    expect(userIdToLockupStats[0] === 0n).to.equal(true);
    expect(userIdToLockupStats[1] === 0n).to.equal(true);
    expect(userIdToLockupStats[2] === 0n).to.equal(true);
    expect(userIdToLockupStats[3] === 0n).to.equal(true);
    expect(userIdToLockupStats[4] === 0n).to.equal(true);
    expect(userIdToLockupStats[5] === false).to.equal(true);
  });

  it("Verify lockup stats, earn and claim", async () => {
    await AVATokenContract.connect(user1).approve(
      DailyEarnLockUpContractAddress,
      USER1_DATA.lockedTokens
    );

    await DailyEarnLockUpContract.connect(user1).lockup(
      USER1_DATA.lockedTokens
    );

    const userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER1_DATA.userId
    );
    expect(userIdToLockupStats[0]).to.equal(USER1_DATA.lockedTokens); // lockedAmount
    expect(userIdToLockupStats[1] > 0n).to.equal(true); // lastTimeStamp
    expect(userIdToLockupStats[2] == 0n).to.equal(true); // withdrawReqTimeStamp
    expect(userIdToLockupStats[3] == 0n).to.equal(true); // withdrawReqAmount
    expect(userIdToLockupStats[4] == 0n).to.equal(true); // earnedAmount

    // Not yet one day passed, so no earnings yet
    await time.increase(ONE_DAY - 1);
    let [earn, daysPassedSinceLastClaim] = await DailyEarnLockUpContract.getEarnAmountFromLockupStats(
      USER1_DATA.walletAddress
    );
    expect(earn == 0n).to.equal(true);
    expect(daysPassedSinceLastClaim === 0n).to.equal(true);

    // One day passed, so earnings should be calculated
    await time.increase(1);
    [earn, daysPassedSinceLastClaim] = await DailyEarnLockUpContract.getEarnAmountFromLockupStats(
      USER1_DATA.walletAddress
    );
    expect(earn > 0n).to.equal(true);
    expect(daysPassedSinceLastClaim === 1n).to.equal(true);

    const calculatedEarn = (USER1_DATA.lockedTokens * COMMON_APR * daysPassedSinceLastClaim) / BigInt(365 * APR_FACTOR);
    expect(earn).to.equal(calculatedEarn);

    // Claim the earned amount
    const claimTx = await DailyEarnLockUpContract.connect(user1).claim();
    const claimReceipt = await claimTx.wait();

    [earn, daysPassedSinceLastClaim] = await DailyEarnLockUpContract.getEarnAmountFromLockupStats(
      USER1_DATA.walletAddress
    );
    expect(earn == 0n).to.equal(true);
    expect(daysPassedSinceLastClaim === 0n).to.equal(true);
  });

  it("Verify lockup stats and withdraw flow", async () => {
    await DailyEarnLockUpContract.initUserData(
      USER2_DATA.userId,
      USER2_DATA.membershipType,
      USER2_DATA.walletAddress,
      USER2_DATA.amountNFTs
    );

    await AVATokenContract.connect(user2).approve(
      DailyEarnLockUpContractAddress,
      USER2_DATA.lockedTokens
    );

    await DailyEarnLockUpContract.connect(user2).lockup(
      USER2_DATA.lockedTokens
    );

    let userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER2_DATA.userId
    );
    expect(userIdToLockupStats[0]).to.equal(USER2_DATA.lockedTokens);

    await DailyEarnLockUpContract.connect(user2).withdrawRequestSubmit(
      USER2_DATA.withdrawnTokens
    );

    // Not yet thirty days passed, so no earnings yet
    await time.increase(THIRTY_DAYS);

    await DailyEarnLockUpContract.connect(user2).withdraw(false, 0);

    userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER2_DATA.userId
    );
    expect(userIdToLockupStats[0]).to.equal(USER2_DATA.lockedTokens - USER2_DATA.withdrawnTokens);
  });
});
