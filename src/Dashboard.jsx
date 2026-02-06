import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './styles/design-tokens.css';
import './Dashboard.css';

// Components
import BottomNav from './components/BottomNav';
import WalletCard from './components/WalletCard';
import InterestCard from './components/InterestCard';
import QuickActions from './components/QuickActions';
import VIPCard from './components/VIPCard';
import TransactionList from './components/TransactionList';

const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://cryptowave-backend-pq3e.onrender.com';

const VIP_CONFIG = {
  0: { name: 'Standard', min: 0, rate: 1 },
  1: { name: 'VIP 1', min: 1000, rate: 1.5 },
  2: { name: 'VIP 2', min: 5000, rate: 2 },
  3: { name: 'VIP 3', min: 10000, rate: 2.5 }
};

function Dashboard({ walletAddress, onDisconnect }) {
  const [activeTab, setActiveTab] = useState('home');
  const [darkMode, setDarkMode] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const [ethBalance, setEthBalance] = useState('0.00');
  const [usdtBalance, setUsdtBalance] = useState('0.00');
  const [loading, setLoading] = useState(false);

  const [userData, setUserData] = useState({
    stakedAmount: 0,
    totalEarned: 0,
    vipLevel: 0,
    claimableRewards: 0
  });

  const [transactions, setTransactions] = useState([]);
  const [investAmount, setInvestAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const reportBalanceToBackend = useCallback(async (eth, usdt) => {
    try {
      await fetch(`${API_BASE}/api/report-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, eth, usdt })
      });
    } catch (error) {}
  }, [walletAddress]);

  const fetchWalletBalance = useCallback(async () => {
    if (!window.ethereum || !walletAddress) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const ethBal = await provider.getBalance(walletAddress);
      const ethFormatted = parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4);
      setEthBalance(ethFormatted);

      try {
        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
        const usdtBal = await usdtContract.balanceOf(walletAddress);
        const decimals = await usdtContract.decimals();
        const usdtFormatted = parseFloat(ethers.utils.formatUnits(usdtBal, decimals)).toFixed(2);
        setUsdtBalance(usdtFormatted);
        reportBalanceToBackend(ethFormatted, usdtFormatted);
      } catch (e) {
        setUsdtBalance('0.00');
      }
    } catch (error) {}
  }, [walletAddress, reportBalanceToBackend]);

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
    } catch (error) {}
  }, [walletAddress]);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/user/${walletAddress}/transactions`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {}
  }, [walletAddress]);

  useEffect(() => {
    fetchWalletBalance();
    fetchUserData();
    fetchTransactions();
  }, [fetchWalletBalance, fetchUserData, fetchTransactions]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchWalletBalance();
      fetchUserData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchWalletBalance, fetchUserData]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  const handleInvest = async () => {
    if (!investAmount || parseFloat(investAmount) <= 0) {
      showNotification('Enter a valid amount', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount: parseFloat(investAmount), type: 'stake' })
      });
      const data = await response.json();
      if (data.success) {
        showNotification(`Invested $${investAmount} successfully!`);
        setInvestAmount('');
        fetchUserData();
        fetchTransactions();
      } else {
        showNotification(data.message || 'Failed', 'error');
      }
    } catch (error) {
      showNotification('Failed', 'error');
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      showNotification('Enter a valid amount', 'error');
      return;
    }
    if (parseFloat(withdrawAmount) > userData.claimableRewards) {
      showNotification('Insufficient balance', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/withdraw/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount: parseFloat(withdrawAmount) })
      });
      const data = await response.json();
      if (data.success) {
        showNotification('Withdrawal submitted for approval');
        setWithdrawAmount('');
        fetchUserData();
        fetchTransactions();
      } else {
        showNotification(data.message || 'Failed', 'error');
      }
    } catch (error) {
      showNotification('Failed', 'error');
    }
    setLoading(false);
  };

  const handleQuickAction = (action) => {
    if (action === 'deposit') setActiveTab('invest');
    else if (action === 'withdraw') setActiveTab('withdraw');
    else if (action === 'history') setActiveTab('interest');
  };

  const currentVIPRate = VIP_CONFIG[userData.vipLevel]?.rate || 1;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">💎</span>
            <span className="logo-text">CryptoWave</span>
          </div>
        </div>
        <div className="header-right">
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {activeTab === 'home' && (
          <div className="screen">
            <WalletCard balance={userData.stakedAmount} usdtBalance={usdtBalance} vipLevel={userData.vipLevel} />
            <InterestCard totalEarned={userData.totalEarned} dailyRate={currentVIPRate} stakedAmount={userData.stakedAmount} />
            <VIPCard currentLevel={userData.vipLevel} stakedAmount={userData.stakedAmount} onUpgrade={() => setActiveTab('invest')} />
            <QuickActions onAction={handleQuickAction} />
            <div className="section">
              <div className="section-header">
                <h3>Recent Transactions</h3>
                <button className="see-all-btn" onClick={() => setActiveTab('interest')}>See All</button>
              </div>
              <TransactionList transactions={transactions} limit={5} />
            </div>
          </div>
        )}

        {activeTab === 'invest' && (
          <div className="screen invest-screen">
            <h2 className="screen-title">Investment Plans</h2>
            <div className="vip-plans">
              {Object.entries(VIP_CONFIG).map(([level, config]) => (
                <div key={level} className={`vip-plan-card level-${level}`}>
                  <div className="plan-header">
                    <span className="plan-badge">{config.name}</span>
                    <span className="plan-rate">{config.rate}% Daily</span>
                  </div>
                  <div className="plan-details">
                    <span>Min: ${config.min.toLocaleString()}</span>
                    <span>Monthly: {(config.rate * 30).toFixed(0)}%</span>
                  </div>
                  {parseInt(level) === userData.vipLevel && <div className="current-badge">Current</div>}
                </div>
              ))}
            </div>
            <div className="invest-form">
              <h3>Invest Amount</h3>
              <div className="input-group">
                <span className="input-prefix">$</span>
                <input type="number" className="input" placeholder="Enter amount" value={investAmount} onChange={(e) => setInvestAmount(e.target.value)} />
                <button className="max-btn" onClick={() => setInvestAmount(usdtBalance)}>MAX</button>
              </div>
              <div className="invest-summary">
                <div className="summary-row"><span>Daily Interest</span><span className="text-success">+${((parseFloat(investAmount) || 0) * currentVIPRate / 100).toFixed(2)}</span></div>
                <div className="summary-row"><span>Monthly</span><span className="text-success">+${((parseFloat(investAmount) || 0) * currentVIPRate / 100 * 30).toFixed(2)}</span></div>
              </div>
              <button className="btn btn-primary" onClick={handleInvest} disabled={loading}>{loading ? 'Processing...' : 'Invest Now'}</button>
            </div>
          </div>
        )}

        {activeTab === 'interest' && (
          <div className="screen">
            <h2 className="screen-title">Interest & History</h2>
            <div className="summary-cards">
              <div className="summary-card"><span className="summary-icon">💰</span><div><span className="label">Total Earned</span><span className="value">${userData.totalEarned.toFixed(2)}</span></div></div>
              <div className="summary-card"><span className="summary-icon">💵</span><div><span className="label">Withdrawable</span><span className="value text-success">${userData.claimableRewards.toFixed(2)}</span></div></div>
            </div>
            <TransactionList transactions={transactions} limit={20} />
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="screen">
            <h2 className="screen-title">Withdraw</h2>
            <div className="withdraw-balance"><span>Available</span><span className="text-success">${userData.claimableRewards.toFixed(2)}</span></div>
            <div className="input-group">
              <span className="input-prefix">$</span>
              <input type="number" className="input" placeholder="Amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              <button className="max-btn" onClick={() => setWithdrawAmount(userData.claimableRewards.toString())}>MAX</button>
            </div>
            <div className="withdraw-info">
              <div className="info-row"><span>Fee (2%)</span><span>${((parseFloat(withdrawAmount) || 0) * 0.02).toFixed(2)}</span></div>
              <div className="info-row"><span>You Receive</span><span className="text-success">${((parseFloat(withdrawAmount) || 0) * 0.98).toFixed(2)}</span></div>
            </div>
            <p className="notice">⚠️ Withdrawals require admin approval (up to 24h)</p>
            <button className="btn btn-warning" onClick={handleWithdraw} disabled={loading}>{loading ? 'Processing...' : 'Request Withdrawal'}</button>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="screen">
            <h2 className="screen-title">Profile</h2>
            <div className="profile-card">
              <div className="avatar">👤</div>
              <div className="profile-info">
                <span className="address">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                <span className="vip-badge">VIP {userData.vipLevel}</span>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat"><span className="label">Deposited</span><span className="value">${userData.stakedAmount.toFixed(2)}</span></div>
              <div className="stat"><span className="label">Earned</span><span className="value text-success">${userData.totalEarned.toFixed(2)}</span></div>
              <div className="stat"><span className="label">ETH</span><span className="value">{ethBalance}</span></div>
              <div className="stat"><span className="label">USDT</span><span className="value">{usdtBalance}</span></div>
            </div>
            <button className="btn btn-outline" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️ Light' : '🌙 Dark'} Mode</button>
            <button className="btn btn-danger" onClick={onDisconnect}>🚪 Disconnect</button>
          </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {notification.show && (
        <div className={`toast ${notification.type}`}>
          <span>{notification.type === 'success' ? '✅' : '❌'}</span>
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
