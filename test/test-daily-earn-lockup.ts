import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { DailyEarnGateKeeper, DailyEarnLockUp } from "../typechain-types";
import deployDailyEarnLockup from "../deploy/daily-earn-lockup";
import deployAVAToken from "../deploy/AVA-token";
import { MockAVA } from "../typechain-types/contracts/test";
import { toWei } from "../utils";
import deployDailyEarnGateKeeper from "../deploy/daily-earn-gatekeeper";

const COMMUNITY_WALLET = "0xE234857A497deCf6239911C8190c195a0eaBB638";

describe("Test if daily earnings are correctly calculated for locked tokens", () => {
  let DailyEarnLockUpContract: DailyEarnLockUp;
  let DailyEarnGateKeeperContract: DailyEarnGateKeeper;
  let DailyEarnLockUpContractAddress: string;
  let DailyEarnGateKeeperContractAddress: string;
  let AVATokenContract: MockAVA;
  let AVATokenContractAddress: string;

  let COMMON_MIN_LOCKUP_AMOUNT = BigInt(250 * 10 ** 18); // 250 tokens
  let TEN_DAYS = 10 * 24 * 60 * 60; // 10 days in seconds
  let COMMON_MIN_WITHDRAW_PERIOD = BigInt(TEN_DAYS); // 10 days in seconds
  let COMMON_APR = BigInt(50); // 50 means 5% or 75 means 7.5%
  let APR_FACTOR = 1000; // APR factor for calculations

  let ONE_DAY = 24 * 60 * 60; // 24 hours in seconds

  let owner: any;
  let auth: any;
  let user1: any;
  let user2: any;
  let user3: any;
  let user4: any;
  let user5: any;
  let userMultisig: any;

  enum MembershipType {
    Unknown,
    SmartSteel,
    SmartBronze,
    SmartSilver,
    SmartGold,
    SmartPlatinum,
    SmartDiamond,
  }

  let USER1_DATA = {
    userId: "user1",
    membershipType: MembershipType.SmartSteel,
    walletAddress: "",
    amountNFTs: 0n,
    lockedTokens: toWei(1_000), // 1000 tokens
    withdrawnTokens: toWei(800), // 800 tokens
  };

  let USER2_DATA = {
    userId: "user2",
    membershipType: MembershipType.SmartGold,
    walletAddress: "",
    amountNFTs: 0n,
    lockedTokens: toWei(5_000), // 5000 tokens
    withdrawnTokens: toWei(1200), // 1200 tokens
  };

  let USER3_DATA = {
    userId: "user3",
    membershipType: MembershipType.SmartGold,
    walletAddress: "",
    amountNFTs: 0n,
    lockedTokens: toWei(5_000), // 5000 tokens
    withdrawnTokens: toWei(1200), // 1200 tokens
  };

  let USER4_DATA = {
    userId: "user4",
    membershipType: MembershipType.SmartGold,
    walletAddress: "",
    amountNFTs: 0n,
    lockedTokens: toWei(5_000), // 5000 tokens
    withdrawnTokens: toWei(1200), // 1200 tokens
  };

  let USER5_DATA = {
    userId: "user5",
    membershipType: MembershipType.SmartGold,
    walletAddress: "",
    amountNFTs: 0n,
    lockedTokens: toWei(5_000), // 5000 tokens
    withdrawnTokens: toWei(1200), // 1200 tokens
  };

  it("Deploy DailyEarnLockUp contracts", async () => {
    [owner, auth, user1, user2, user3, user4, user5, userMultisig] =
      await ethers.getSigners();
    USER1_DATA.walletAddress = user1.address;
    USER2_DATA.walletAddress = user2.address;
    USER3_DATA.walletAddress = user3.address;
    USER4_DATA.walletAddress = user4.address;
    USER5_DATA.walletAddress = user5.address;

    AVATokenContract = await deployAVAToken();
    AVATokenContractAddress = await AVATokenContract.getAddress();

    await AVATokenContract.transfer(
      user1.address,
      toWei(1_000_000), // 1 million tokens
    );

    await AVATokenContract.transfer(
      user2.address,
      toWei(2_000_000), // 2 million tokens
    );

    await AVATokenContract.transfer(
      user5.address,
      toWei(2_000_000), // 2 million tokens
    );

    DailyEarnLockUpContract = await deployDailyEarnLockup(
      AVATokenContractAddress,
      COMMUNITY_WALLET,
    );
    DailyEarnLockUpContractAddress = await DailyEarnLockUpContract.getAddress();

    let maxTotalLockedAmount =
      await DailyEarnLockUpContract.maxTotalLockedAmount();
    expect(maxTotalLockedAmount).to.equal(toWei(5_000_000));

    let totalLockedAmount = await DailyEarnLockUpContract.totalLockedAmount();
    expect(totalLockedAmount).to.equal(0n);
  });

  it("Verify initialized membershipTypeToCondition", async () => {
    let membershipType =
      await DailyEarnLockUpContract.membershipTypeToCondition(
        MembershipType.Unknown,
      );
    expect(membershipType.some((el) => el !== 0n)).to.equal(false); // apr

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartSteel,
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(BigInt(10_000 * 10 ** 18)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartBronze,
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(BigInt(20_000 * 10 ** 18)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartSilver,
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(50_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartGold,
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(80_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    ////////

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartPlatinum,
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(100_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(COMMON_APR); // apr
    expect(membershipType[4]).to.equal(0); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(0); // maxAllowedAmountNFTs

    membershipType = await DailyEarnLockUpContract.membershipTypeToCondition(
      MembershipType.SmartDiamond,
    );
    expect(membershipType[0]).to.equal(COMMON_MIN_LOCKUP_AMOUNT); // minLockupAmount
    expect(membershipType[1]).to.equal(toWei(200_000)); // maxLockupAmount
    expect(membershipType[2]).to.equal(COMMON_MIN_WITHDRAW_PERIOD); // unlockPeriod
    expect(membershipType[3]).to.equal(60n); // apr
    expect(membershipType[4]).to.equal(3n); // aprExtraPerNFT
    expect(membershipType[5]).to.equal(5n); // maxAllowedAmountNFTs
  });

  it("Verify user wallet not yet registered", async () => {
    const isRegistered =
      await DailyEarnLockUpContract.isWalletAddressRegistered(
        USER1_DATA.walletAddress,
      );
    expect(isRegistered).to.equal(false);
  });

  it("Verify the user data setup including userId, walletAddress, amountNFTs and membershipType", async () => {
    let isRegistered = await DailyEarnLockUpContract.isWalletAddressRegistered(
      USER1_DATA.walletAddress,
    );
    expect(isRegistered).to.equal(false);

    await DailyEarnLockUpContract.initUserData(
      USER1_DATA.userId,
      USER1_DATA.membershipType,
      USER1_DATA.walletAddress,
      USER1_DATA.amountNFTs,
    );

    isRegistered = await DailyEarnLockUpContract.isWalletAddressRegistered(
      USER1_DATA.walletAddress,
    );
    expect(isRegistered).to.equal(true);

    const userIdToWalletAddress =
      await DailyEarnLockUpContract.userIdToWalletAddress(USER1_DATA.userId);
    expect(userIdToWalletAddress).to.equal(USER1_DATA.walletAddress);
    const userIdToAmountNFTs = await DailyEarnLockUpContract.userIdToAmountNFTs(
      USER1_DATA.userId,
    );
    expect(userIdToAmountNFTs).to.equal(USER1_DATA.amountNFTs);
    const userIdToMembershipType =
      await DailyEarnLockUpContract.userIdToMembershipType(USER1_DATA.userId);
    expect(userIdToMembershipType).to.equal(USER1_DATA.membershipType);
    const userIdToLockupStats =
      await DailyEarnLockUpContract.userIdToLockupStats(USER1_DATA.userId);
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
      USER1_DATA.lockedTokens,
    );

    await DailyEarnLockUpContract.connect(user1).lockup(
      USER1_DATA.lockedTokens,
    );

    const userIdToLockupStats =
      await DailyEarnLockUpContract.userIdToLockupStats(USER1_DATA.userId);
    expect(userIdToLockupStats[0]).to.equal(USER1_DATA.lockedTokens); // lockedAmount
    expect(userIdToLockupStats[1] > 0n).to.equal(true); // lastTimeStamp
    expect(userIdToLockupStats[2] == 0n).to.equal(true); // withdrawReqTimeStamp
    expect(userIdToLockupStats[3] == 0n).to.equal(true); // withdrawReqAmount
    expect(userIdToLockupStats[4] == 0n).to.equal(true); // earnedAmount

    // Not yet one day passed, but still earnings as calculated based on seconds elapsed
    await time.increase(ONE_DAY - 1);
    let [earn, timeElapsedSinceLastClaim] =
      await DailyEarnLockUpContract.getEarnAmountFromLockupStats(
        USER1_DATA.walletAddress,
      );
    expect(earn > 0n).to.equal(true);
    expect(timeElapsedSinceLastClaim > 0n).to.equal(true);

    // One day passed, so earnings should be calculated
    await time.increase(1);
    [earn, timeElapsedSinceLastClaim] =
      await DailyEarnLockUpContract.getEarnAmountFromLockupStats(
        USER1_DATA.walletAddress,
      );
    expect(earn > 0n).to.equal(true);
    expect(timeElapsedSinceLastClaim === BigInt(ONE_DAY)).to.equal(true);

    const calculatedEarn =
      (USER1_DATA.lockedTokens * COMMON_APR * timeElapsedSinceLastClaim) /
      BigInt(APR_FACTOR * 365 * ONE_DAY);
    expect(earn).to.equal(calculatedEarn);

    // Claim the earned amount
    const claimTx = await DailyEarnLockUpContract.connect(user1).claim();
    const claimReceipt = await claimTx.wait();

    [earn, timeElapsedSinceLastClaim] =
      await DailyEarnLockUpContract.getEarnAmountFromLockupStats(
        USER1_DATA.walletAddress,
      );
    expect(earn == 0n).to.equal(true);
    expect(timeElapsedSinceLastClaim === 0n).to.equal(true);
  });

  it("Verify lockup stats and withdraw flow", async () => {
    await DailyEarnLockUpContract.initUserData(
      USER2_DATA.userId,
      USER2_DATA.membershipType,
      USER2_DATA.walletAddress,
      USER2_DATA.amountNFTs,
    );

    await AVATokenContract.connect(user2).approve(
      DailyEarnLockUpContractAddress,
      USER2_DATA.lockedTokens,
    );

    await DailyEarnLockUpContract.connect(user2).lockup(
      USER2_DATA.lockedTokens,
    );

    let userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER2_DATA.userId,
    );
    expect(userIdToLockupStats[0]).to.equal(USER2_DATA.lockedTokens);

    await DailyEarnLockUpContract.connect(user2).withdrawRequestSubmit(
      USER2_DATA.withdrawnTokens,
    );

    // Not yet thirty days passed, so no earnings yet
    await time.increase(TEN_DAYS);

    await DailyEarnLockUpContract.connect(user2).withdraw(false, 0);

    userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER2_DATA.userId,
    );
    expect(userIdToLockupStats[0]).to.equal(
      USER2_DATA.lockedTokens - USER2_DATA.withdrawnTokens,
    );
  });

  it("Verify GateKeeper isOwner updateUserIdToWalletAddress", async () => {
    DailyEarnGateKeeperContract = await deployDailyEarnGateKeeper(
      DailyEarnLockUpContractAddress,
    );
    DailyEarnGateKeeperContractAddress =
      await DailyEarnGateKeeperContract.getAddress();

    await DailyEarnGateKeeperContract.transferOwnership(userMultisig.address);

    await expect(
      DailyEarnGateKeeperContract.connect(user2).updateUserIdToWalletAddress(
        USER4_DATA.userId,
        USER4_DATA.walletAddress,
      ),
    ).to.be.revertedWith("OwnPauseAuth: not owner");

    await expect(
      DailyEarnGateKeeperContract.connect(
        userMultisig,
      ).updateUserIdToWalletAddress(
        USER4_DATA.userId,
        USER4_DATA.walletAddress,
      ),
    ).to.be.revertedWith("OwnPauseAuth: unauthorized");

    await DailyEarnLockUpContract.grantAuthorized(
      DailyEarnGateKeeperContractAddress,
    );

    await DailyEarnGateKeeperContract.connect(
      userMultisig,
    ).updateUserIdToWalletAddress(USER4_DATA.userId, USER4_DATA.walletAddress);
  });

  it("Verify GateKeeper isAuthorized deactivateUser activateUser", async () => {
    DailyEarnGateKeeperContract = await deployDailyEarnGateKeeper(
      DailyEarnLockUpContractAddress,
    );
    DailyEarnGateKeeperContractAddress =
      await DailyEarnGateKeeperContract.getAddress();

    await expect(
      DailyEarnGateKeeperContract.deactivateUser(USER2_DATA.userId),
    ).to.be.revertedWith("OwnPauseAuth: unauthorized");

    await DailyEarnLockUpContract.grantAuthorized(
      DailyEarnGateKeeperContractAddress,
    );

    let userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER2_DATA.userId,
    );
    expect(userIdToLockupStats[5]).to.equal(false);

    await DailyEarnGateKeeperContract.deactivateUser(USER2_DATA.userId);

    userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER2_DATA.userId,
    );
    expect(userIdToLockupStats[5]).to.equal(true);

    await DailyEarnGateKeeperContract.activateUser(USER2_DATA.userId);

    userIdToLockupStats = await DailyEarnLockUpContract.userIdToLockupStats(
      USER2_DATA.userId,
    );
    expect(userIdToLockupStats[5]).to.equal(false);

    await expect(
      DailyEarnGateKeeperContract.connect(user2).deactivateUser(
        USER2_DATA.userId,
      ),
    ).to.be.revertedWith("OwnPauseAuth: unauthorized");
  });

  it("Verify GateKeeper isAuthorized initUserData", async () => {
    DailyEarnGateKeeperContract = await deployDailyEarnGateKeeper(
      DailyEarnLockUpContractAddress,
    );
    DailyEarnGateKeeperContractAddress =
      await DailyEarnGateKeeperContract.getAddress();

    await expect(
      DailyEarnGateKeeperContract.initUserData(
        USER3_DATA.userId,
        USER3_DATA.membershipType,
        USER3_DATA.walletAddress,
        USER3_DATA.amountNFTs,
      ),
    ).to.be.revertedWith("OwnPauseAuth: unauthorized");

    await DailyEarnLockUpContract.grantAuthorized(
      DailyEarnGateKeeperContractAddress,
    );

    await DailyEarnGateKeeperContract.initUserData(
      USER3_DATA.userId,
      USER3_DATA.membershipType,
      COMMUNITY_WALLET,
      USER3_DATA.amountNFTs,
    );

    await expect(
      DailyEarnGateKeeperContract.connect(user3).initUserData(
        USER3_DATA.userId,
        USER3_DATA.membershipType,
        USER3_DATA.walletAddress,
        USER3_DATA.amountNFTs,
      ),
    ).to.be.revertedWith("OwnPauseAuth: unauthorized");
  });

  it("Verify GateKeeper isAuthorized updateUserIdToMembershipType updateUserIdToAmountNFTs", async () => {
    DailyEarnGateKeeperContract = await deployDailyEarnGateKeeper(
      DailyEarnLockUpContractAddress,
    );
    DailyEarnGateKeeperContractAddress =
      await DailyEarnGateKeeperContract.getAddress();

    await expect(
      DailyEarnGateKeeperContract.updateUserIdToAmountNFTs(
        USER4_DATA.userId,
        USER4_DATA.walletAddress,
      ),
    ).to.be.revertedWith("OwnPauseAuth: unauthorized");

    await DailyEarnLockUpContract.grantAuthorized(
      DailyEarnGateKeeperContractAddress,
    );

    await DailyEarnGateKeeperContract.initUserData(
      USER5_DATA.userId,
      USER5_DATA.membershipType,
      USER5_DATA.walletAddress,
      USER5_DATA.amountNFTs,
    );

    await DailyEarnGateKeeperContract.updateUserIdToMembershipType(
      USER5_DATA.userId,
      MembershipType.SmartDiamond,
      USER5_DATA.amountNFTs,
    );

    await DailyEarnGateKeeperContract.updateUserIdToAmountNFTs(
      USER5_DATA.userId,
      USER5_DATA.amountNFTs + BigInt(1),
    );

    // Further test if reverted with pending withdrawal req
    await AVATokenContract.connect(user5).approve(
      DailyEarnLockUpContractAddress,
      USER5_DATA.lockedTokens,
    );

    await DailyEarnLockUpContract.connect(user5).lockup(
      USER5_DATA.lockedTokens,
    );

    await DailyEarnLockUpContract.connect(user5).withdrawRequestSubmit(
      USER5_DATA.withdrawnTokens,
    );

    await expect(
      DailyEarnGateKeeperContract.updateUserIdToAmountNFTs(
        USER5_DATA.userId,
        USER5_DATA.amountNFTs + BigInt(1),
      ),
    ).to.be.revertedWith("Pending withdrawal request");

    await DailyEarnLockUpContract.connect(user5).withdrawRequestCancel();

    await DailyEarnGateKeeperContract.updateUserIdToAmountNFTs(
      USER5_DATA.userId,
      USER5_DATA.amountNFTs + BigInt(2),
    );
  });
});
