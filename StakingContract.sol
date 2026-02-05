// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title StakingContract
 * @dev A flexible staking contract with VIP tiers and dynamic rewards
 */
contract StakingContract is ReentrancyGuard, Ownable, Pausable {
    
    // Staking token (USDT or your token)
    IERC20 public stakingToken;
    
    // Base APY in basis points (10000 = 100%)
    uint256 public baseAPY = 1000; // 10% base APY
    
    // VIP tier bonuses in basis points
    uint256 public constant VIP1_BONUS = 250;  // 2.5% bonus
    uint256 public constant VIP2_BONUS = 500;  // 5% bonus
    uint256 public constant VIP3_BONUS = 1000; // 10% bonus
    
    // VIP tier thresholds
    uint256 public constant VIP1_THRESHOLD = 10000 * 1e18;   // 10,000 tokens
    uint256 public constant VIP2_THRESHOLD = 50000 * 1e18;   // 50,000 tokens
    uint256 public constant VIP3_THRESHOLD = 100000 * 1e18;  // 100,000 tokens
    
    // Minimum stake amount
    uint256 public minStakeAmount = 100 * 1e18; // 100 tokens
    
    // Total staked in the contract
    uint256 public totalStaked;
    
    // User staking information
    struct StakeInfo {
        uint256 amount;           // Amount staked
        uint256 rewardDebt;       // Reward debt for calculations
        uint256 lastStakeTime;    // Last time user staked
        uint256 lastClaimTime;    // Last time user claimed rewards
    }
    
    // Mapping from user address to stake info
    mapping(address => StakeInfo) public stakes;
    
    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event APYUpdated(uint256 newAPY);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _stakingToken Address of the token to be staked
     */
    constructor(address _stakingToken) {
        require(_stakingToken != address(0), "Invalid token address");
        stakingToken = IERC20(_stakingToken);
    }
    
    /**
     * @dev Stake tokens
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= minStakeAmount, "Amount below minimum");
        require(stakingToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // If user has existing stake, claim pending rewards first
        if (stakes[msg.sender].amount > 0) {
            _claimRewards(msg.sender);
        }
        
        // Transfer tokens from user to contract
        require(
            stakingToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        // Update stake info
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].lastStakeTime = block.timestamp;
        stakes[msg.sender].rewardDebt = calculateRewards(msg.sender);
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev Unstake tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot unstake 0");
        require(stakes[msg.sender].amount >= amount, "Insufficient staked balance");
        
        // Claim pending rewards first
        _claimRewards(msg.sender);
        
        // Update stake info
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        
        // Transfer tokens back to user
        require(stakingToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev Claim accumulated rewards
     */
    function claimRewards() external nonReentrant {
        _claimRewards(msg.sender);
    }
    
    /**
     * @dev Internal function to claim rewards
     */
    function _claimRewards(address user) internal {
        uint256 rewards = calculateRewards(user);
        
        if (rewards > 0) {
            stakes[user].lastClaimTime = block.timestamp;
            stakes[user].rewardDebt = 0;
            
            // Transfer rewards to user
            require(stakingToken.transfer(user, rewards), "Reward transfer failed");
            
            emit RewardsClaimed(user, rewards);
        }
    }
    
    /**
     * @dev Calculate pending rewards for a user
     * @param user Address of the user
     * @return Pending rewards amount
     */
    function calculateRewards(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        
        if (userStake.amount == 0) {
            return 0;
        }
        
        // Calculate time elapsed since last claim
        uint256 lastClaimTime = userStake.lastClaimTime == 0 
            ? userStake.lastStakeTime 
            : userStake.lastClaimTime;
            
        uint256 timeElapsed = block.timestamp - lastClaimTime;
        
        // Get user's APY based on VIP tier
        uint256 userAPY = getUserAPY(user);
        
        // Calculate rewards: (amount * APY * time) / (365 days * 10000)
        uint256 rewards = (userStake.amount * userAPY * timeElapsed) / (365 days * 10000);
        
        return rewards;
    }
    
    /**
     * @dev Get user's APY including VIP bonuses
     * @param user Address of the user
     * @return APY in basis points
     */
    function getUserAPY(address user) public view returns (uint256) {
        uint256 stakedAmount = stakes[user].amount;
        uint256 apy = baseAPY;
        
        if (stakedAmount >= VIP3_THRESHOLD) {
            apy += VIP3_BONUS;
        } else if (stakedAmount >= VIP2_THRESHOLD) {
            apy += VIP2_BONUS;
        } else if (stakedAmount >= VIP1_THRESHOLD) {
            apy += VIP1_BONUS;
        }
        
        return apy;
    }
    
    /**
     * @dev Get user's VIP level
     * @param user Address of the user
     * @return VIP level (0-3)
     */
    function getVIPLevel(address user) public view returns (uint256) {
        uint256 stakedAmount = stakes[user].amount;
        
        if (stakedAmount >= VIP3_THRESHOLD) {
            return 3;
        } else if (stakedAmount >= VIP2_THRESHOLD) {
            return 2;
        } else if (stakedAmount >= VIP1_THRESHOLD) {
            return 1;
        }
        
        return 0;
    }
    
    /**
     * @dev Get staked balance for a user
     * @param user Address of the user
     * @return Staked amount
     */
    function getStakedBalance(address user) external view returns (uint256) {
        return stakes[user].amount;
    }
    
    /**
     * @dev Get pending rewards for a user
     * @param user Address of the user
     * @return Pending rewards
     */
    function getRewards(address user) external view returns (uint256) {
        return calculateRewards(user);
    }
    
    /**
     * @dev Get current APY (for backwards compatibility)
     * @return Base APY in basis points
     */
    function apy() external view returns (uint256) {
        return baseAPY;
    }
    
    /**
     * @dev Emergency withdraw - withdraw without caring about rewards
     */
    function emergencyWithdraw() external nonReentrant {
        uint256 amount = stakes[msg.sender].amount;
        require(amount > 0, "No stake to withdraw");
        
        stakes[msg.sender].amount = 0;
        stakes[msg.sender].rewardDebt = 0;
        totalStaked -= amount;
        
        require(stakingToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit EmergencyWithdraw(msg.sender, amount);
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @dev Update base APY
     * @param newAPY New APY in basis points
     */
    function setBaseAPY(uint256 newAPY) external onlyOwner {
        require(newAPY <= 50000, "APY too high"); // Max 500% APY
        baseAPY = newAPY;
        emit APYUpdated(newAPY);
    }
    
    /**
     * @dev Update minimum stake amount
     * @param newMinAmount New minimum stake amount
     */
    function setMinStakeAmount(uint256 newMinAmount) external onlyOwner {
        minStakeAmount = newMinAmount;
    }
    
    /**
     * @dev Pause staking
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause staking
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Withdraw tokens from contract (for rewards pool management)
     * @param amount Amount to withdraw
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(
            stakingToken.balanceOf(address(this)) - totalStaked >= amount,
            "Cannot withdraw staked tokens"
        );
        require(stakingToken.transfer(owner(), amount), "Transfer failed");
    }
    
    /**
     * @dev Deposit tokens to contract (for rewards pool)
     * @param amount Amount to deposit
     */
    function depositRewards(uint256 amount) external onlyOwner {
        require(
            stakingToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
    }
    
    /**
     * @dev Get contract token balance
     */
    function getContractBalance() external view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }
    
    /**
     * @dev Get available rewards pool
     */
    function getAvailableRewards() external view returns (uint256) {
        uint256 balance = stakingToken.balanceOf(address(this));
        return balance > totalStaked ? balance - totalStaked : 0;
    }
}
