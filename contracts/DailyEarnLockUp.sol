// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./OwnPauseAuth.sol";

contract DailyEarnLockUp is OwnPauseAuth, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable lockupToken;

    uint256 public constant PERCENT_FACTOR = 1e3;

    uint256 public constant COMMON_MIN_LOCKUP_AMOUNT = 250 * 1e18; // 250 tokens
    uint256 public constant COMMON_MIN_WITHDRAW_PERIOD = 10 days;
    uint256 public constant COMMON_APR = 50; // 50 means 5% or 75 means 7.5%

    uint256 public maxTotalLockedAmount = 5_000_000 * 1e18;
    uint256 public totalLockedAmount = 0;
    uint256 public immediateWithdrawalFee = 20; // 20 means 2% or 25 means 2.5%
    uint256 public immediateWithdrawalFeeCollected = 0; // fee collected on the contract if the "communityWallet" not set
    address public communityWallet;

    enum MembershipType {
        Unknown,
        SmartSteel,
        SmartBronze,
        SmartSilver,
        SmartGold,
        SmartPlatinum,
        SmartDiamond
    }

    struct LockupCondition {
        uint256 minLockupAmountPerTx;
        uint256 maxLockupAmountPerTotal;
        uint256 withdrawPeriod; // in seconds
        uint256 apr; // 50 means 5% or 75 means 7.5%
        // Extra APR per NFT held, scaled by 1000.
        uint256 aprExtraPerNFT; // 3 means 0.3%
        // Maximum number of NFTs allowed for this membership type
        uint256 maxAllowedAmountNFTs; // 5 NFTs for SmartDiamond only
    }

    struct LockupStats {
        // Totally-lockedup amount of tokens
        uint256 lockedAmount;
        // Timestamp of the last action (e.g. claim or lockup adjustment)
        uint256 lastTimeStamp;
        // Timestamp to mark the withdrawal request
        // This is used to check if the withdraw min period has passed.
        uint256 withdrawReqTimeStamp;
        // Amount requested to withdraw
        uint256 withdrawReqAmount;
        // Totally-earned amount of tokens
        uint256 earnedAmount;
        // true if user deactivated
        bool deactivated;
    }

    // Mapping from userId to walletAddress which subjects to be updated.
    // This is used to map a userId to their wallet address to ensure that one userId can only have one wallet address.
    mapping(string => address) public userIdToWalletAddress;

    // Mapping from walletAddress to userId.
    // This is to easily retrieve the userId from a wallet address.
    mapping(address => string) public walletAddressToUserId;

    // Mapping from userId to amount of NFTs owned only for SmartDiamond membership type.
    mapping(string => uint256) public userIdToAmountNFTs;

    // Mapping from userId (via walletAddress) to MembershipType.
    mapping(string => MembershipType) public userIdToMembershipType;

    // Mapping from MembershipType to LockupCondition.
    // This is used to determine the conditions for each membership type.
    mapping(MembershipType => LockupCondition) public membershipTypeToCondition;

    // Mapping from userId (via walletAddress) to LockupStats.
    // This is used to track the lockup status for each walletAddress.
    mapping(string => LockupStats) public userIdToLockupStats;

    event EvtLockup(address indexed walletAddress, uint256 lockedAmount);
    event EvtWithdrawRequestSubmit(
        address indexed walletAddress,
        uint256 requestedAmount
    );
    event EvtWithdrawRequestCancel(address indexed walletAddress);

    // If fee is zero, it is not immediate withdrawal
    event EvtWithdraw(
        address indexed walletAddress,
        uint256 withdrawnAmount,
        uint256 fee,
        bool isImmediate
    );
    event EvtClaim(address indexed walletAddress, uint256 earn);
    event EvtUpdateUserIdToWalletAddress(string userId, address walletAddress);
    event EvtUpdateUserIdToAmountNFTs(string userId, uint256 amountNFTs);
    event EvtUpdateUserIdToMembershipType(
        string userId,
        MembershipType membershipType,
        uint256 amountNFTs
    );
    event EvtBatchSetWalletAddressToMembershipType(
        address[] walletAddresses,
        MembershipType[] membershipTypes
    );
    event EvtSetMembershipTypeToCondition(
        MembershipType membershipType,
        LockupCondition lockupCondition
    );
    event EvtSetMaxTotalLockedAmount(uint256 maxTotalLockedAmount);
    event EvtSetImmediateWithdrawalFee(uint256 immediateWithdrawalFee);
    event EvtSetCommunityWallet(address communityWallet);
    event EvtInitUserData(
        string userId,
        MembershipType membershipType,
        address walletAddress,
        uint256 amountNFTs
    );
    event EvtDeactivateUser(string userId);
    event EvtActivateUser(string userId);
    event EvtWithdrawByAdmin(address indexed recipient, uint256 amount);
    event EvtTakeImmediateWithdrawalFeeCollected(
        address indexed recipient,
        uint256 amount
    );

    constructor(address _lockupToken, address _communityWallet) {
        require(_lockupToken != address(0), "Invalid token address");
        lockupToken = IERC20(_lockupToken);
        communityWallet = _communityWallet;

        _initMembershipTypeToCondition();
    }

    function _initMembershipTypeToCondition() private {
        membershipTypeToCondition[MembershipType.SmartSteel] = LockupCondition({
            minLockupAmountPerTx: COMMON_MIN_LOCKUP_AMOUNT,
            maxLockupAmountPerTotal: 10_000 * 1e18,
            withdrawPeriod: COMMON_MIN_WITHDRAW_PERIOD,
            apr: COMMON_APR,
            aprExtraPerNFT: 0,
            maxAllowedAmountNFTs: 0
        });

        membershipTypeToCondition[
            MembershipType.SmartBronze
        ] = LockupCondition({
            minLockupAmountPerTx: COMMON_MIN_LOCKUP_AMOUNT,
            maxLockupAmountPerTotal: 20_000 * 1e18,
            withdrawPeriod: COMMON_MIN_WITHDRAW_PERIOD,
            apr: COMMON_APR,
            aprExtraPerNFT: 0,
            maxAllowedAmountNFTs: 0
        });

        membershipTypeToCondition[
            MembershipType.SmartSilver
        ] = LockupCondition({
            minLockupAmountPerTx: COMMON_MIN_LOCKUP_AMOUNT,
            maxLockupAmountPerTotal: 50_000 * 1e18,
            withdrawPeriod: COMMON_MIN_WITHDRAW_PERIOD,
            apr: COMMON_APR,
            aprExtraPerNFT: 0,
            maxAllowedAmountNFTs: 0
        });

        membershipTypeToCondition[MembershipType.SmartGold] = LockupCondition({
            minLockupAmountPerTx: COMMON_MIN_LOCKUP_AMOUNT,
            maxLockupAmountPerTotal: 80_000 * 1e18,
            withdrawPeriod: COMMON_MIN_WITHDRAW_PERIOD,
            apr: COMMON_APR,
            aprExtraPerNFT: 0,
            maxAllowedAmountNFTs: 0
        });

        membershipTypeToCondition[
            MembershipType.SmartPlatinum
        ] = LockupCondition({
            minLockupAmountPerTx: COMMON_MIN_LOCKUP_AMOUNT,
            maxLockupAmountPerTotal: 100_000 * 1e18,
            withdrawPeriod: COMMON_MIN_WITHDRAW_PERIOD,
            apr: COMMON_APR,
            aprExtraPerNFT: 0,
            maxAllowedAmountNFTs: 0
        });

        membershipTypeToCondition[
            MembershipType.SmartDiamond
        ] = LockupCondition({
            minLockupAmountPerTx: COMMON_MIN_LOCKUP_AMOUNT,
            maxLockupAmountPerTotal: 200_000 * 1e18,
            withdrawPeriod: COMMON_MIN_WITHDRAW_PERIOD,
            apr: 60, // 6% APR
            aprExtraPerNFT: 3, // 0.3% extra APR per NFT
            maxAllowedAmountNFTs: 5
        });
    }

    function _validateLockupConditions(
        uint256 lockedAmount,
        address walletAddress
    ) private view {
        require(lockedAmount > 0, "Null lockup");
        require(walletAddress != address(0), "Invalid wallet address");
        require(
            totalLockedAmount + lockedAmount <= maxTotalLockedAmount,
            "totalLockedAmount + lockedAmount exceeds maxTotalLockedAmount"
        );

        string memory userId = walletAddressToUserId[walletAddress];
        require(
            bytes(userId).length > 0,
            "walletAddress not have associated userId"
        );

        MembershipType membershipType = userIdToMembershipType[userId];
        require(
            membershipType != MembershipType.Unknown,
            "userId not have associated membership type"
        );

        LockupCondition memory condition = membershipTypeToCondition[
            membershipType
        ];
        require(
            lockedAmount >= condition.minLockupAmountPerTx,
            "lockedAmount less than minLockupAmountPerTx"
        );

        require(
            lockedAmount + userIdToLockupStats[userId].lockedAmount <=
                condition.maxLockupAmountPerTotal,
            "new lockedAmount and currentLockedAmount exceeds maxLockupAmountPerTotal"
        );

        require(
            userIdToLockupStats[userId].withdrawReqAmount == 0,
            "Pending withdrawal request exists"
        );

        require(!userIdToLockupStats[userId].deactivated, "User deactivated");
    }

    function _getUserId(
        address walletAddress
    ) private view returns (string memory) {
        string memory userId = walletAddressToUserId[walletAddress];
        require(
            bytes(userId).length > 0,
            "walletAddress does not have any associated userId"
        );
        return userId;
    }

    /**
     * @notice Lockup a specific amount of tokens.
     * @param lockedAmount The lockedAmount to lockup.
     */
    function lockup(uint256 lockedAmount) external whenNotPaused nonReentrant {
        _validateLockupConditions(lockedAmount, msg.sender);

        // Transfer lockup tokens from the walletAddress to the contract.
        lockupToken.safeTransferFrom(msg.sender, address(this), lockedAmount);

        string memory userId = _getUserId(msg.sender);

        // If the walletAddress already has a lockup, send him his earned tokens
        // before increasing the lockedAmount.
        if (userIdToLockupStats[userId].lockedAmount > 0) {
            _claimReward(userId, msg.sender);
        } else {
            // For a newbie, initialize lastTimeStamp to current time.
            userIdToLockupStats[userId].lastTimeStamp = block.timestamp;
        }

        // Increase the lockedAmount.
        userIdToLockupStats[userId].lockedAmount += lockedAmount;

        // Update the total locked amount.
        totalLockedAmount += lockedAmount;

        emit EvtLockup(msg.sender, lockedAmount);
    }

    function _validateWithdrawRequest(
        uint256 withdrawnAmount,
        string memory userId,
        address walletAddress,
        bool isImmediate
    ) private view {
        require(withdrawnAmount > 0, "Null withdraw");
        require(walletAddress != address(0), "Invalid wallet address");

        MembershipType membershipType = userIdToMembershipType[userId];
        require(
            membershipType != MembershipType.Unknown,
            "userId does not have any associated membership type"
        );

        LockupStats memory stats = userIdToLockupStats[userId];

        if (!isImmediate) {
            require(
                stats.withdrawReqTimeStamp == 0,
                "One withdrawal request already exists"
            );
        }

        // Immediate withdrawal fee is deducted directly from the withdrawnAmount
        // rather than from the principal
        require(
            stats.lockedAmount >= withdrawnAmount,
            "Insufficient lockedAmount"
        );

        // Still allow deactivated user to withdraw

        require(
            totalLockedAmount >= withdrawnAmount,
            "withdrawnAmount exceeds totalLockedAmount"
        );
    }

    /**
     * @notice Request a withdrawal of a specific withdrawnAmount from the locked-up tokens.
     * This is a preliminary step to ensure that the user can withdraw after the minimum period.
     * @param withdrawnAmount The withdrawnAmount to withdraw.
     */
    function withdrawRequestSubmit(
        uint256 withdrawnAmount
    ) external whenNotPaused nonReentrant {
        string memory userId = _getUserId(msg.sender);

        _validateWithdrawRequest(withdrawnAmount, userId, msg.sender, false);

        // Claim any accrued rewards.
        _claimReward(userId, msg.sender);

        // Update the lockup stats to mark the withdrawal request.
        LockupStats storage stats = userIdToLockupStats[userId];
        stats.lockedAmount -= withdrawnAmount;
        stats.withdrawReqTimeStamp = block.timestamp;
        stats.withdrawReqAmount = withdrawnAmount;

        emit EvtWithdrawRequestSubmit(msg.sender, withdrawnAmount);
    }

    function _claimRewardFromWithdrawRequest(
        address walletAddress
    ) private returns (uint256) {
        string memory userId = _getUserId(walletAddress);

        LockupStats storage stats = userIdToLockupStats[userId];

        (
            uint256 earn,
            uint256 daysPassedSinceLastClaim
        ) = getEarnAmountFromWithdrawRequest(walletAddress);

        if (earn > 0) {
            stats.lastTimeStamp += daysPassedSinceLastClaim * 1 days;
            stats.earnedAmount += earn;

            lockupToken.safeTransfer(walletAddress, earn);
            emit EvtClaim(walletAddress, earn);
        }

        return earn;
    }

    /**
     * @notice Cancel the submitted withdrawal request.
     */
    function withdrawRequestCancel() external whenNotPaused nonReentrant {
        string memory userId = _getUserId(msg.sender);

        LockupStats storage stats = userIdToLockupStats[userId];
        require(stats.withdrawReqTimeStamp > 0, "No withdrawal request exists");

        // De-activated user cannot get any earn
        if (!userIdToLockupStats[userId].deactivated) {
            _claimRewardFromWithdrawRequest(msg.sender);
        }

        stats.lockedAmount += stats.withdrawReqAmount;
        stats.withdrawReqTimeStamp = 0;
        stats.withdrawReqAmount = 0;

        emit EvtWithdrawRequestCancel(msg.sender);
    }

    /**
     * @notice Execute the submitted withdraw request.
     * This function allows the user to withdraw the requested amount after the minimum withdrawal period has passed
     * Any rewards up to the withdrawal point are claimed based on the current locked amount.
     */
    function withdraw(
        bool isImmediate,
        uint256 amountToWithdraw
    ) external whenNotPaused nonReentrant {
        string memory userId = _getUserId(msg.sender);
        uint256 withdrawAmount = 0;
        LockupStats storage stats = userIdToLockupStats[userId];
        uint256 fee = 0;

        if (!isImmediate) {
            withdrawAmount = stats.withdrawReqAmount;

            require(
                stats.withdrawReqAmount > 0,
                "Null withdrawal request amount"
            );
            require(
                stats.withdrawReqTimeStamp > 0,
                "No withdrawal request exists"
            );

            LockupCondition memory condition = getLockupCondition(msg.sender);
            require(
                block.timestamp >
                    stats.withdrawReqTimeStamp + condition.withdrawPeriod,
                "Minimum withdraw period not met"
            );

            stats.withdrawReqTimeStamp = 0;
            stats.withdrawReqAmount = 0;
        } else {
            withdrawAmount = amountToWithdraw;

            _validateWithdrawRequest(withdrawAmount, userId, msg.sender, true);

            fee = (withdrawAmount * immediateWithdrawalFee) / PERCENT_FACTOR;
        }

        // Claim any accrued rewards.
        _claimReward(userId, msg.sender);
        totalLockedAmount -= withdrawAmount;

        if (!isImmediate) {
            lockupToken.safeTransfer(msg.sender, withdrawAmount);
        } else {
            stats.lockedAmount -= withdrawAmount;

            // Immediate withdrawal fee is deducted directly from the withdrawnAmount
            // rather than from the principal
            lockupToken.safeTransfer(msg.sender, withdrawAmount - fee);

            // Transfer fee to the community wallet if any. Otherwise, keep it on the contract.
            if (fee > 0) {
                if (communityWallet != address(0)) {
                    lockupToken.safeTransfer(communityWallet, fee);
                } else {
                    // Keep the fee on the contract
                    immediateWithdrawalFeeCollected += fee;
                }
            }
        }

        emit EvtWithdraw(msg.sender, withdrawAmount, fee, isImmediate);
    }

    /**
     * @notice Claim all accumulated rewards.
     */
    function claim() external whenNotPaused nonReentrant {
        string memory userId = _getUserId(msg.sender);
        require(!userIdToLockupStats[userId].deactivated, "User deactivated");
        uint256 earn = _claimReward(userId, msg.sender);
        require(earn > 0, "Not yet time to earn. Retry later.");
    }

    /**
     * @notice Based on the current LockupStats, get earn amount and the number of elapsed days since last time for a given walletAddress.
     */
    function getEarnAmountFromLockupStats(
        address walletAddress
    ) public view returns (uint256, uint256) {
        string memory userId = _getUserId(walletAddress);
        LockupStats memory stats = userIdToLockupStats[userId];

        return
            _getEarnAmount(
                walletAddress,
                stats.lockedAmount,
                stats.lastTimeStamp
            );
    }

    /**
     * @notice Based on the current withdraw request, get earn amount and the number of elapsed days since withdraw request time for a given walletAddress.
     */
    function getEarnAmountFromWithdrawRequest(
        address walletAddress
    ) public view returns (uint256, uint256) {
        string memory userId = _getUserId(walletAddress);
        LockupStats memory stats = userIdToLockupStats[userId];

        return
            _getEarnAmount(
                walletAddress,
                stats.withdrawReqAmount,
                stats.withdrawReqTimeStamp
            );
    }

    function _getLockedAmountChecked(
        address walletAddress,
        uint256 lockedAmount
    ) private view returns (uint256) {
        string memory userId = _getUserId(walletAddress);
        MembershipType membershipType = userIdToMembershipType[userId];
        LockupCondition
            memory membershipTypeCondition = membershipTypeToCondition[
                membershipType
            ];

        if (lockedAmount > membershipTypeCondition.maxLockupAmountPerTotal) {
            return membershipTypeCondition.maxLockupAmountPerTotal;
        } else {
            return lockedAmount;
        }
    }

    /**
     * @notice Get claimable amount and the number of elapsed days since last time for a given walletAddress.
     */
    function _getEarnAmount(
        address walletAddress,
        uint256 lockedAmount,
        uint256 lastTimeStamp
    ) private view returns (uint256, uint256) {
        if (lockedAmount == 0) {
            return (0, 0);
        }

        // If the lastTimeStamp is in the future, return 0.
        if (block.timestamp <= lastTimeStamp) {
            return (0, 0);
        }

        uint256 lockedAmountChecked = _getLockedAmountChecked(
            walletAddress,
            lockedAmount
        );

        // Determine the time elapsed since the last claim.
        uint256 timeElapsedSinceLastClaim = block.timestamp - lastTimeStamp;
        // Calculate the number of full days that have passed.
        uint256 daysPassedSinceLastClaim = timeElapsedSinceLastClaim / 1 days;

        if (daysPassedSinceLastClaim > 0) {
            uint256 earn = (lockedAmountChecked *
                getTotalApr(walletAddress) *
                daysPassedSinceLastClaim) / (PERCENT_FACTOR * 365);

            if (earn > 0) {
                return (earn, daysPassedSinceLastClaim);
            }
        }

        return (0, 0);
    }

    /**
     * @dev Private function to claim rewards for a given walletAddress.
     * It calculates how many full days have passed since the last claim,
     * computes the earn, transfers the earn tokens, and updates lastTimeStamp.
     * @param walletAddress The walletAddress whose rewards are being claimed.
     */
    function _claimReward(
        string memory userId,
        address walletAddress
    ) private returns (uint256) {
        // De-activated user cannot get any earn
        if (userIdToLockupStats[userId].deactivated) {
            return 0;
        }

        (
            uint256 earn,
            uint256 daysPassedSinceLastClaim
        ) = getEarnAmountFromLockupStats(walletAddress);
        if (earn > 0) {
            // Update lastTimeStamp to the timestamp rounded up to the last full day.
            LockupStats storage stats = userIdToLockupStats[userId];
            stats.lastTimeStamp += daysPassedSinceLastClaim * 1 days;
            stats.earnedAmount += earn;

            lockupToken.safeTransfer(walletAddress, earn);
            emit EvtClaim(walletAddress, earn);
            return earn;
        } else {
            // If no earn, return 0.
            return 0;
        }
    }

    ///////////////////// Setter ///////////////////////

    /**
     * @notice Deactivate user, but still keep the user data.
     */
    function deactivateUser(string memory userId) external isAuthorized {
        require(bytes(userId).length > 0, "Invalid userId");
        require(
            userIdToLockupStats[userId].deactivated == false,
            "userId already deactivated"
        );

        // Auto send any accrued rewards before deactivation.
        address walletAddress = userIdToWalletAddress[userId];
        _claimReward(userId, walletAddress);

        _claimRewardFromWithdrawRequest(walletAddress);

        userIdToLockupStats[userId].deactivated = true;

        emit EvtDeactivateUser(userId);
    }

    /**
     * @notice Activate user after having deactivated him.
     */
    function activateUser(string memory userId) external isAuthorized {
        require(bytes(userId).length > 0, "Invalid userId");
        require(
            userIdToLockupStats[userId].deactivated == true,
            "userId already activated"
        );

        userIdToLockupStats[userId].deactivated = false;

        // This ensures that, after being re-activated from the previous deactivation,
        // the "lastTimeStamp" (i.e. start time for accrued rewards) is updated to the time-being.
        userIdToLockupStats[userId].lastTimeStamp = block.timestamp;

        emit EvtActivateUser(userId);
    }

    /**
     * @notice Set user data including userId, membershipType, walletAddress, and amountNFTs. This is prerequisite for lockup for rewards.
     */
    function initUserData(
        string memory userId,
        MembershipType membershipType,
        address walletAddress,
        uint256 amountNFTs
    ) external isAuthorized {
        require(bytes(userId).length > 0, "Invalid userId");
        require(walletAddress != address(0), "Invalid wallet address");

        // If userId already has a wallet address, we need to clear it first.
        if (userIdToWalletAddress[userId] != address(0)) {
            walletAddressToUserId[userIdToWalletAddress[userId]] = "";
        }

        // If wallet address already has a userId, we need to clear it first.
        if (bytes(walletAddressToUserId[walletAddress]).length > 0) {
            userIdToWalletAddress[
                walletAddressToUserId[walletAddress]
            ] = address(0);
        }

        userIdToWalletAddress[userId] = walletAddress;
        walletAddressToUserId[walletAddress] = userId;

        userIdToAmountNFTs[userId] = amountNFTs;

        userIdToMembershipType[userId] = membershipType;

        emit EvtInitUserData(userId, membershipType, walletAddress, amountNFTs);
    }

    /**
     * @notice Update the wallet address for a specific user ID.
     */
    function updateUserIdToWalletAddress(
        string calldata userId,
        address walletAddress
    ) external isAuthorized {
        require(walletAddress != address(0), "Invalid wallet address");
        require(bytes(userId).length > 0, "Invalid userId");

        // If userId already has a wallet address, we need to clear it first.
        if (userIdToWalletAddress[userId] != address(0)) {
            walletAddressToUserId[userIdToWalletAddress[userId]] = "";
        }

        userIdToWalletAddress[userId] = walletAddress;
        walletAddressToUserId[walletAddress] = userId;

        emit EvtUpdateUserIdToWalletAddress(userId, walletAddress);
    }

    /**
     * @notice Update amount NFTs only for SmartDiamond membership type.
     */
    function updateUserIdToAmountNFTs(
        string calldata userId,
        uint256 amountNFTs
    ) external isAuthorized {
        require(bytes(userId).length > 0, "Invalid userId");
        require(
            userIdToMembershipType[userId] == MembershipType.SmartDiamond,
            "Not SmartDiamond membership type"
        );

        userIdToAmountNFTs[userId] = amountNFTs;

        emit EvtUpdateUserIdToAmountNFTs(userId, amountNFTs);
    }

    /**
     * @notice Update the membership type for a specific user ID upon detecting user membership change. The param "amountNFTs" is only needed for SmartDiamond membership type.
     */
    function updateUserIdToMembershipType(
        string memory userId,
        MembershipType membershipType,
        uint256 amountNFTs
    ) external isAuthorized {
        require(bytes(userId).length > 0, "Invalid userId");
        require(
            userIdToMembershipType[userId] != MembershipType.Unknown,
            "User data not yet set. Pls use the function initUserData"
        );
        require(
            userIdToMembershipType[userId] != membershipType,
            "UserId already has this membership type"
        );

        // In case the userId is updated with a new membership type, claimReward first with the current membership type.
        // This ensures that any rewards accrued under the current membership type are claimed before changing it.
        address walletAddress = userIdToWalletAddress[userId];
        _claimReward(userId, walletAddress);

        // If the currently-locked amount > max lockup cap, user will need to manually submit withdrawal req

        userIdToMembershipType[userId] = membershipType;

        if (membershipType == MembershipType.SmartDiamond) {
            // If the membership type is SmartDiamond, set the amountNFTs.
            userIdToAmountNFTs[userId] = amountNFTs;
        }

        emit EvtUpdateUserIdToMembershipType(
            userId,
            membershipType,
            amountNFTs
        );
    }

    function withdrawByAdmin(
        address recipient,
        uint256 amount
    ) external isOwner {
        require(amount > 0, "Invalid amount");
        require(totalLockedAmount >= amount, "Insufficient locked amount");

        totalLockedAmount -= amount;
        lockupToken.safeTransfer(recipient, amount);

        emit EvtWithdrawByAdmin(recipient, amount);
    }

    function takeImmediateWithdrawalFeeCollected(
        address recipient,
        uint256 amount
    ) external isOwner {
        require(amount > 0, "Invalid amount");
        require(
            immediateWithdrawalFeeCollected >= amount,
            "Insufficient fee collected"
        );

        immediateWithdrawalFeeCollected -= amount;
        lockupToken.safeTransfer(recipient, amount);

        emit EvtTakeImmediateWithdrawalFeeCollected(recipient, amount);
    }

    /**
     * @notice Set the membership type for a specific wallet address.
     */
    function setMembershipTypeToCondition(
        MembershipType membershipType,
        LockupCondition memory lockupCondition
    ) external isOwner {
        membershipTypeToCondition[membershipType] = lockupCondition;

        emit EvtSetMembershipTypeToCondition(membershipType, lockupCondition);
    }

    /**
     * @notice Set the immediate withdrawal fee
     */
    function setImmediateWithdrawalFee(
        uint256 _immediateWithdrawalFee
    ) external isOwner {
        // can be zero
        immediateWithdrawalFee = _immediateWithdrawalFee;

        emit EvtSetImmediateWithdrawalFee(_immediateWithdrawalFee);
    }

    /**
     * @notice Set the community wallet address
     */
    function setCommunityWallet(address _communityWallet) external isOwner {
        // communityWallet can be address(0)
        communityWallet = _communityWallet;

        emit EvtSetCommunityWallet(_communityWallet);
    }

    /**
     * @notice Set the maximum total locked amount.
     */
    function setMaxTotalLockedAmount(
        uint256 _maxTotalLockedAmount
    ) external isOwner {
        require(
            _maxTotalLockedAmount >= totalLockedAmount,
            "New maxTotalLockedAmount cannot be less than totalLockedAmount"
        );
        maxTotalLockedAmount = _maxTotalLockedAmount;

        emit EvtSetMaxTotalLockedAmount(_maxTotalLockedAmount);
    }

    function updateCommonMinLockupAmount(
        uint256 newMinLockupAmount
    ) external isOwner {
        membershipTypeToCondition[MembershipType.SmartSteel]
            .minLockupAmountPerTx = newMinLockupAmount;

        membershipTypeToCondition[MembershipType.SmartBronze]
            .minLockupAmountPerTx = newMinLockupAmount;

        membershipTypeToCondition[MembershipType.SmartSilver]
            .minLockupAmountPerTx = newMinLockupAmount;

        membershipTypeToCondition[MembershipType.SmartGold]
            .minLockupAmountPerTx = newMinLockupAmount;

        membershipTypeToCondition[MembershipType.SmartPlatinum]
            .minLockupAmountPerTx = newMinLockupAmount;

        membershipTypeToCondition[MembershipType.SmartDiamond]
            .minLockupAmountPerTx = newMinLockupAmount;
    }

    function updateCommonWithdrawPeriod(
        uint256 newWithdrawPeriodInSeconds
    ) external isOwner {
        membershipTypeToCondition[MembershipType.SmartSteel]
            .withdrawPeriod = newWithdrawPeriodInSeconds;

        membershipTypeToCondition[MembershipType.SmartBronze]
            .withdrawPeriod = newWithdrawPeriodInSeconds;

        membershipTypeToCondition[MembershipType.SmartSilver]
            .withdrawPeriod = newWithdrawPeriodInSeconds;

        membershipTypeToCondition[MembershipType.SmartGold]
            .withdrawPeriod = newWithdrawPeriodInSeconds;

        membershipTypeToCondition[MembershipType.SmartPlatinum]
            .withdrawPeriod = newWithdrawPeriodInSeconds;

        membershipTypeToCondition[MembershipType.SmartDiamond]
            .withdrawPeriod = newWithdrawPeriodInSeconds;
    }

    ///////////////////// Getter ///////////////////////

    function getTotalApr(address walletAddress) public view returns (uint256) {
        string memory userId = _getUserId(walletAddress);

        MembershipType membershipType = userIdToMembershipType[userId];
        LockupCondition
            memory membershipTypeCondition = membershipTypeToCondition[
                membershipType
            ];

        // Extra APR for SmartDiamond membership type.
        uint256 extraEarnRate = 0;
        if (membershipType == MembershipType.SmartDiamond) {
            uint256 amountNFTs = userIdToAmountNFTs[userId];
            if (amountNFTs > membershipTypeCondition.maxAllowedAmountNFTs) {
                amountNFTs = membershipTypeCondition.maxAllowedAmountNFTs;
            }
            extraEarnRate = (membershipTypeCondition.aprExtraPerNFT *
                amountNFTs);
        }

        return (membershipTypeCondition.apr + extraEarnRate);
    }

    function getEarnedAmount(
        address walletAddress
    ) external view returns (uint256) {
        string memory userId = walletAddressToUserId[walletAddress];
        if (bytes(userId).length == 0) {
            return 0;
        } else {
            LockupStats memory stats = userIdToLockupStats[userId];
            return stats.earnedAmount;
        }
    }

    function getLockupCondition(
        address walletAddress
    ) public view returns (LockupCondition memory) {
        string memory userId = walletAddressToUserId[walletAddress];
        if (bytes(userId).length == 0) {
            return
                LockupCondition({
                    minLockupAmountPerTx: 0,
                    maxLockupAmountPerTotal: 0,
                    withdrawPeriod: 0,
                    apr: 0,
                    aprExtraPerNFT: 0,
                    maxAllowedAmountNFTs: 0
                });
        } else {
            MembershipType membershipType = userIdToMembershipType[userId];
            LockupCondition
                memory membershipTypeCondition = membershipTypeToCondition[
                    membershipType
                ];
            return membershipTypeCondition;
        }
    }

    function getLockupStats(
        address walletAddress
    ) external view returns (LockupStats memory) {
        string memory userId = walletAddressToUserId[walletAddress];
        if (bytes(userId).length == 0) {
            return
                LockupStats({
                    lockedAmount: 0,
                    lastTimeStamp: 0,
                    withdrawReqTimeStamp: 0,
                    withdrawReqAmount: 0,
                    earnedAmount: 0,
                    deactivated: false
                });
        } else {
            return userIdToLockupStats[userId];
        }
    }

    function getMembershipType(
        address walletAddress
    ) external view returns (MembershipType) {
        string memory userId = walletAddressToUserId[walletAddress];
        if (bytes(userId).length == 0) {
            return MembershipType.Unknown;
        } else {
            return userIdToMembershipType[userId];
        }
    }

    function getAmountNFTs(
        address walletAddress
    ) external view returns (uint256) {
        string memory userId = walletAddressToUserId[walletAddress];
        if (bytes(userId).length == 0) {
            return 0;
        } else {
            return userIdToAmountNFTs[userId];
        }
    }

    function isWalletAddressRegistered(
        address walletAddress
    ) external view returns (bool) {
        string memory userId = walletAddressToUserId[walletAddress];
        return bytes(userId).length > 0;
    }

    function isUserIdRegistered(
        string memory userId
    ) external view returns (bool) {
        address walletAddress = userIdToWalletAddress[userId];
        return walletAddress != address(0);
    }
}
