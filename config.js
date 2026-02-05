// config.js - Dashboard Configuration File
// Update these values to customize your staking dashboard

export const CONFIG = {
  // ============================================
  // BLOCKCHAIN SETTINGS
  // ============================================
  
  // Your deployed staking contract address
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",
  
  // Supported networks
  NETWORKS: {
    ETHEREUM_MAINNET: {
      chainId: 1,
      name: "Ethereum",
      rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
      blockExplorer: "https://etherscan.io",
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
      }
    },
    POLYGON: {
      chainId: 137,
      name: "Polygon",
      rpcUrl: "https://polygon-rpc.com",
      blockExplorer: "https://polygonscan.com",
      nativeCurrency: {
        name: "MATIC",
        symbol: "MATIC",
        decimals: 18
      }
    },
    BSC: {
      chainId: 56,
      name: "Binance Smart Chain",
      rpcUrl: "https://bsc-dataseed.binance.org",
      blockExplorer: "https://bscscan.com",
      nativeCurrency: {
        name: "BNB",
        symbol: "BNB",
        decimals: 18
      }
    },
    // Add more networks as needed
  },
  
  // Default network (change this to your deployment network)
  DEFAULT_NETWORK: "POLYGON",
  
  // Token symbol (e.g., "USDT", "USDC", "DAI", or your token)
  TOKEN_SYMBOL: "USDT",
  
  // Token decimals (usually 18 for most ERC20 tokens, 6 for USDT on Ethereum)
  TOKEN_DECIMALS: 18,
  
  // ============================================
  // VIP TIER SETTINGS
  // ============================================
  
  VIP_TIERS: [
    {
      level: 0,
      name: "Normal",
      minStake: 0,
      maxStake: 9999,
      apyBonus: 0,
      benefits: [
        "Standard support",
        "Daily compounding"
      ]
    },
    {
      level: 1,
      name: "VIP 1",
      minStake: 10000,
      maxStake: 49999,
      apyBonus: 0.25,
      benefits: [
        "Priority support",
        "+0.25% bonus APY",
        "Advanced analytics"
      ]
    },
    {
      level: 2,
      name: "VIP 2",
      minStake: 50000,
      maxStake: 99999,
      apyBonus: 0.5,
      benefits: [
        "Dedicated manager",
        "+0.5% bonus APY",
        "Early feature access",
        "Lower fees"
      ]
    },
    {
      level: 3,
      name: "VIP 3",
      minStake: 100000,
      maxStake: Infinity,
      apyBonus: 1.0,
      benefits: [
        "All benefits unlocked",
        "+1.0% bonus APY",
        "VIP support 24/7",
        "No withdrawal fees",
        "Exclusive events"
      ]
    }
  ],
  
  // ============================================
  // STAKING SETTINGS
  // ============================================
  
  // Minimum stake amount
  MIN_STAKE_AMOUNT: 100,
  
  // Quick stake amounts (shown as buttons)
  QUICK_STAKE_AMOUNTS: [1000, 5000, 10000, 50000],
  
  // Auto-refresh interval (in milliseconds)
  REFRESH_INTERVAL: 15000, // 15 seconds
  
  // Transaction confirmation blocks to wait
  CONFIRMATION_BLOCKS: 2,
  
  // ============================================
  // UI CUSTOMIZATION
  // ============================================
  
  // Project name
  PROJECT_NAME: "CRYPTOWAVE",
  
  // Project logo (can be emoji or path to image)
  PROJECT_LOGO: "C",
  
  // Theme colors (update in Dashboard.css for full effect)
  COLORS: {
    primary: "#667eea",
    secondary: "#764ba2",
    success: "#10b981",
    danger: "#ef4444",
    warning: "#fbbf24",
    info: "#3b82f6"
  },
  
  // Number formatting
  NUMBER_FORMAT: {
    // Use 'K' for thousands, 'M' for millions
    useShortFormat: true,
    // Decimal places for token amounts
    decimals: 2,
    // Decimal places for percentages
    percentDecimals: 2
  },
  
  // Date format (for transaction history)
  DATE_FORMAT: "YYYY-MM-DD", // or "MM/DD/YYYY" or "DD/MM/YYYY"
  
  // ============================================
  // FEATURE FLAGS
  // ============================================
  
  FEATURES: {
    // Show/hide features
    showEarningsChart: true,
    showTransactionHistory: true,
    showVIPSection: true,
    showQuickActions: true,
    
    // Enable/disable features
    enableStaking: true,
    enableUnstaking: true,
    enableClaiming: true,
    enableEmergencyWithdraw: false, // Set to true to show emergency withdraw
    
    // Analytics
    enableAnalytics: false, // Set to true to track user actions
    analyticsId: "", // Your analytics ID
  },
  
  // ============================================
  // NOTIFICATIONS
  // ============================================
  
  NOTIFICATIONS: {
    // Auto-dismiss time (in milliseconds)
    autoDismissTime: 5000,
    
    // Enable sound notifications
    enableSound: false,
    
    // Custom messages
    messages: {
      stakeSuccess: "Successfully staked {amount} {token}!",
      unstakeSuccess: "Successfully unstaked {amount} {token}!",
      claimSuccess: "Successfully claimed {amount} {token} in rewards!",
      stakeError: "Staking failed. Please try again.",
      unstakeError: "Unstaking failed. Please try again.",
      claimError: "Claim failed. Please try again.",
      insufficientBalance: "Insufficient balance",
      insufficientStake: "Insufficient staked balance",
      noRewards: "No rewards to claim",
      walletNotConnected: "Please connect your wallet",
      wrongNetwork: "Please switch to the correct network",
      transactionPending: "Transaction submitted. Waiting for confirmation...",
      transactionConfirmed: "Transaction confirmed!",
      transactionFailed: "Transaction failed"
    }
  },
  
  // ============================================
  // ADMIN SETTINGS
  // ============================================
  
  ADMIN: {
    // Admin wallet addresses (can manage contract)
    addresses: [
      // "0xYourAdminAddress1",
      // "0xYourAdminAddress2"
    ],
    
    // Enable admin panel
    enableAdminPanel: false,
    
    // Admin features
    features: {
      canPauseContract: true,
      canUpdateAPY: true,
      canWithdrawRewards: true,
      canUpdateMinStake: true
    }
  },
  
  // ============================================
  // STORAGE SETTINGS
  // ============================================
  
  STORAGE: {
    // Use localStorage for transaction history
    useLocalStorage: true,
    
    // Maximum transactions to store
    maxTransactions: 50,
    
    // Maximum earnings history days
    maxEarningsDays: 30,
    
    // Storage key prefix
    storagePrefix: "staking_dashboard_"
  },
  
  // ============================================
  // SOCIAL LINKS
  // ============================================
  
  SOCIAL: {
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
    github: "",
    medium: "",
    docs: ""
  },
  
  // ============================================
  // ADVANCED SETTINGS
  // ============================================
  
  ADVANCED: {
    // Gas price settings (in gwei)
    defaultGasPrice: null, // null = auto
    maxGasPrice: 500,
    
    // Slippage tolerance (for token swaps if implemented)
    slippageTolerance: 0.5, // 0.5%
    
    // Transaction deadline (in minutes)
    transactionDeadline: 20,
    
    // Enable debug mode
    debugMode: false,
    
    // API endpoints (if using backend)
    apiEndpoint: "",
    apiKey: "",
    
    // Rate limiting
    maxRequestsPerMinute: 60
  }
};

// Smart contract ABI
// Replace this with your actual contract ABI after deployment
export const CONTRACT_ABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function claimRewards() external",
  "function getStakedBalance(address user) external view returns (uint256)",
  "function getRewards(address user) external view returns (uint256)",
  "function getUserAPY(address user) external view returns (uint256)",
  "function getVIPLevel(address user) external view returns (uint256)",
  "function apy() external view returns (uint256)",
  "function totalStaked() external view returns (uint256)",
  "function emergencyWithdraw() external"
];

// Helper functions
export const getNetworkConfig = () => {
  return CONFIG.NETWORKS[CONFIG.DEFAULT_NETWORK];
};

export const getVIPTierByStake = (stakedAmount) => {
  for (let i = CONFIG.VIP_TIERS.length - 1; i >= 0; i--) {
    const tier = CONFIG.VIP_TIERS[i];
    if (stakedAmount >= tier.minStake) {
      return tier;
    }
  }
  return CONFIG.VIP_TIERS[0];
};

export const formatTokenAmount = (amount, useShortFormat = CONFIG.NUMBER_FORMAT.useShortFormat) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  
  if (useShortFormat) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(CONFIG.NUMBER_FORMAT.decimals) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(CONFIG.NUMBER_FORMAT.decimals) + 'K';
    }
  }
  
  return num.toFixed(CONFIG.NUMBER_FORMAT.decimals);
};

export const isAdmin = (address) => {
  return CONFIG.ADMIN.addresses.includes(address.toLowerCase());
};

// Validation functions
export const validateConfig = () => {
  const errors = [];
  
  if (CONFIG.CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    errors.push("CONTRACT_ADDRESS not set. Please update config.js with your deployed contract address.");
  }
  
  if (!CONFIG.NETWORKS[CONFIG.DEFAULT_NETWORK]) {
    errors.push("DEFAULT_NETWORK configuration is invalid.");
  }
  
  if (CONFIG.MIN_STAKE_AMOUNT <= 0) {
    errors.push("MIN_STAKE_AMOUNT must be greater than 0.");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Export validation result for startup check
export const configValidation = validateConfig();

export default CONFIG;
