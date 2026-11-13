// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./OwnPauseAuth.sol";

interface IDailyEarnLockUp {
    enum MembershipType {
        Unknown,
        SmartSteel,
        SmartBronze,
        SmartSilver,
        SmartGold,
        SmartPlatinum,
        SmartDiamond
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

    function userIdToLockupStats(
        string memory userId
    ) external view returns (LockupStats memory);
    function isUserIdRegistered(
        string memory userId
    ) external view returns (bool);

    function deactivateUser(string memory userId) external;
    function activateUser(string memory userId) external;
    function initUserData(
        string memory userId,
        MembershipType membershipType,
        address walletAddress,
        uint256 amountNFTs
    ) external;
    function updateUserIdToWalletAddress(
        string calldata userId,
        address walletAddress
    ) external;
    function updateUserIdToAmountNFTs(
        string calldata userId,
        uint256 amountNFTs
    ) external;
    function updateUserIdToMembershipType(
        string memory userId,
        MembershipType membershipType,
        uint256 amountNFTs
    ) external;
}

contract DailyEarnGateKeeper is OwnPauseAuth {
    IDailyEarnLockUp public immutable contractDailyEarnLockUp;

    constructor(address dailyEarnLockUpContractAddr) {
        require(
            dailyEarnLockUpContractAddr != address(0),
            "Invalid contract address"
        );
        contractDailyEarnLockUp = IDailyEarnLockUp(dailyEarnLockUpContractAddr);
    }

    function _revertIfPendingWithdrawalReq(string memory userId) private view {
        require(
            hasPendingWithdrawalReq(userId) == false,
            "Pending withdrawal request"
        );
    }

    function hasPendingWithdrawalReq(
        string memory userId
    ) public view returns (bool) {
        require(
            contractDailyEarnLockUp.isUserIdRegistered(userId),
            "User ID not registered"
        );
        IDailyEarnLockUp.LockupStats memory stats = contractDailyEarnLockUp
            .userIdToLockupStats(userId);
        return (stats.withdrawReqTimeStamp > 0);
    }

    /**
     * @notice Deactivate user, but still keep the user data.
     */
    function deactivateUser(string memory userId) external isAuthorized {
        contractDailyEarnLockUp.deactivateUser(userId);
    }

    /**
     * @notice Activate user after having deactivated him.
     */
    function activateUser(string memory userId) external isAuthorized {
        _revertIfPendingWithdrawalReq(userId);
        contractDailyEarnLockUp.activateUser(userId);
    }

    /**
     * @notice Set user data including userId, membershipType, walletAddress, and amountNFTs. This is prerequisite for lockup for rewards.
     */
    function initUserData(
        string memory userId,
        IDailyEarnLockUp.MembershipType membershipType,
        address walletAddress,
        uint256 amountNFTs
    ) external isAuthorized {
        contractDailyEarnLockUp.initUserData(
            userId,
            membershipType,
            walletAddress,
            amountNFTs
        );
    }

    /**
     * @notice Update the wallet address for a specific user ID.
     */
    function updateUserIdToWalletAddress(
        string calldata userId,
        address walletAddress
    ) external isOwner {
        contractDailyEarnLockUp.updateUserIdToWalletAddress(
            userId,
            walletAddress
        );
    }

    /**
     * @notice Update amount NFTs only for SmartDiamond membership type.
     */
    function updateUserIdToAmountNFTs(
        string calldata userId,
        uint256 amountNFTs
    ) external isAuthorized {
        _revertIfPendingWithdrawalReq(userId);
        contractDailyEarnLockUp.updateUserIdToAmountNFTs(userId, amountNFTs);
    }

    /**
     * @notice Update the membership type for a specific user ID upon detecting user membership change. The param "amountNFTs" is only needed for SmartDiamond membership type.
     */
    function updateUserIdToMembershipType(
        string memory userId,
        IDailyEarnLockUp.MembershipType membershipType,
        uint256 amountNFTs
    ) external isAuthorized {
        _revertIfPendingWithdrawalReq(userId);
        contractDailyEarnLockUp.updateUserIdToMembershipType(
            userId,
            membershipType,
            amountNFTs
        );
    }
}
