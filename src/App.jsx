import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './App.css';
import Dashboard from './Dashboard';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cryptowave-backend-pq3e.onrender.com';

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('disconnected'); // disconnected, pending, approved
  const [loading, setLoading] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [provider, setProvider] = useState(null);

  // Check approval status with backend
  const checkApproval = useCallback(async (address) => {
    try {
      const response = await fetch(`${API_BASE}/api/check-approval/${address}`);
      const data = await response.json();
      if (data.approved) {
        setApprovalStatus('approved');
        localStorage.setItem('approvalStatus', 'approved');
      } else {
        setApprovalStatus('pending');
        localStorage.setItem('approvalStatus', 'pending');
      }
    } catch (error) {
      console.error('Error checking approval:', error);
      // On network error, use cached status so user isn't kicked out
      const cached = localStorage.getItem('approvalStatus');
      if (cached === 'approved') setApprovalStatus('approved');
      else if (cached === 'pending') setApprovalStatus('pending');
    }
  }, []);

  // On mount: restore wallet from localStorage and verify with backend
  useEffect(() => {
    const savedWallet = localStorage.getItem('connectedWallet');
    if (savedWallet) {
      setWalletAddress(savedWallet);
      // Optimistically set cached status while we verify
      const cached = localStorage.getItem('approvalStatus');
      if (cached === 'approved') setApprovalStatus('approved');
      else if (cached === 'pending') setApprovalStatus('pending');
      // Verify with backend
      checkApproval(savedWallet).finally(() => setCheckingApproval(false));
    } else {
      setCheckingApproval(false);
    }
  }, [checkApproval]);

  // Poll for approval every 5 seconds when pending
  useEffect(() => {
    if (walletAddress && approvalStatus === 'pending') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE}/api/check-approval/${walletAddress}`);
          const data = await response.json();
          if (data.approved) {
            setApprovalStatus('approved');
            localStorage.setItem('approvalStatus', 'approved');
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [walletAddress, approvalStatus]);

  // Request approval from backend
  const requestApproval = async (address) => {
    try {
      const response = await fetch(`${API_BASE}/api/request-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          ipAddress: 'localhost',
          userAgent: navigator.userAgent
        })
      });
      const data = await response.json();
      if (data.approved) {
        setApprovalStatus('approved');
        localStorage.setItem('approvalStatus', 'approved');
      } else {
        setApprovalStatus('pending');
        localStorage.setItem('approvalStatus', 'pending');
      }
    } catch (error) {
      console.error('Error requesting approval:', error);
      setApprovalStatus('pending');
      localStorage.setItem('approvalStatus', 'pending');
    }
  };

  // Wallet connection handlers
  const connectMetaMask = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install MetaMask extension.');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      setLoading(true);
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const address = accounts[0];

      setWalletAddress(address);
      setProvider(web3Provider);
      setWalletModalOpen(false);
      localStorage.setItem('connectedWallet', address);
      await requestApproval(address);
    } catch (error) {
      console.error('MetaMask connection error:', error);
      alert('Failed to connect MetaMask. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const connectWalletConnect = async () => {
    alert('WalletConnect integration coming soon! For now, please use MetaMask or Coinbase Wallet.');
  };

  const connectCoinbase = async () => {
    if (!window.coinbaseWalletExtension && !window.ethereum?.isCoinbaseWallet) {
      alert('Coinbase Wallet is not installed.');
      window.open('https://www.coinbase.com/wallet/downloads', '_blank');
      return;
    }

    try {
      setLoading(true);
      const web3Provider = new ethers.providers.Web3Provider(
        window.coinbaseWalletExtension || window.ethereum
      );
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const address = accounts[0];

      setWalletAddress(address);
      setProvider(web3Provider);
      setWalletModalOpen(false);
      localStorage.setItem('connectedWallet', address);
      await requestApproval(address);
    } catch (error) {
      console.error('Coinbase Wallet connection error:', error);
      alert('Failed to connect Coinbase Wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const connectTrustWallet = async () => {
    if (!window.ethereum?.isTrust) {
      alert('Trust Wallet is not detected. Please use Trust Wallet browser or install the extension.');
      window.open('https://trustwallet.com/', '_blank');
      return;
    }

    try {
      setLoading(true);
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const address = accounts[0];

      setWalletAddress(address);
      setProvider(web3Provider);
      setWalletModalOpen(false);
      localStorage.setItem('connectedWallet', address);
      await requestApproval(address);
    } catch (error) {
      console.error('Trust Wallet connection error:', error);
      alert('Failed to connect Trust Wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setWalletAddress('');
    setApprovalStatus('disconnected');
    setProvider(null);
    localStorage.removeItem('connectedWallet');
    localStorage.removeItem('approvalStatus');
    localStorage.removeItem('approvalRequested');
    window.location.href = '/';
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileMenuOpen && !e.target.closest('.nav')) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu or wallet modal is open
  useEffect(() => {
    if (mobileMenuOpen || walletModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [mobileMenuOpen, walletModalOpen]);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const openWalletModal = () => {
    if (!walletAddress) {
      setWalletModalOpen(true);
    }
  };

  const closeWalletModal = () => {
    setWalletModalOpen(false);
  };

  // Show loading while checking approval on mount
  if (checkingApproval && walletAddress) {
    return (
      <div className="App pending-page">
        <div className="grain-overlay"></div>
        <div className="bg-gradient"></div>
        <div className="bg-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <div className="pending-container">
          <div className="pending-card">
            <div className="pending-icon"><div className="spinner"></div></div>
            <h1>Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  // If wallet is approved, show dashboard
  if (approvalStatus === 'approved' && walletAddress) {
    return <Dashboard walletAddress={walletAddress} onDisconnect={handleDisconnect} />;
  }

  // If wallet is pending approval, show waiting page
  if (approvalStatus === 'pending' && walletAddress) {
    return (
      <div className="App pending-page">
        <div className="grain-overlay"></div>
        <div className="bg-gradient"></div>
        <div className="bg-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>

        <nav className="nav">
          <div className="nav-logo">
            <div className="logo-icon">E</div>
            <span className="logo-text">CRYPTOWAVE</span>
          </div>
          <button className="nav-connect" onClick={handleDisconnect}>
            Disconnect
          </button>
        </nav>

        <div className="pending-container">
          <div className="pending-card">
            <div className="pending-icon">
              <div className="spinner"></div>
            </div>
            <h1>Awaiting Approval</h1>
            <p className="pending-description">
              Your wallet connection request has been submitted and is pending admin approval.
            </p>

            <div className="pending-wallet-info">
              <span className="pending-label">Connected Wallet</span>
              <span className="pending-address">{walletAddress}</span>
            </div>

            <div className="pending-status">
              <div className="status-dot pending"></div>
              <span>Checking approval status...</span>
            </div>

            <div className="pending-info">
              <div className="info-item">
                <span className="info-icon">1</span>
                <span>Your request has been submitted</span>
              </div>
              <div className="info-item">
                <span className="info-icon">2</span>
                <span>Admin will review your wallet</span>
              </div>
              <div className="info-item">
                <span className="info-icon">3</span>
                <span>Once approved, you'll be redirected automatically</span>
              </div>
            </div>

            <p className="pending-note">
              This page will automatically update once your wallet is approved.
            </p>

            <button className="disconnect-btn-pending" onClick={handleDisconnect}>
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show landing page
  return (
    <div className="App">
      {/* Grain Texture Overlay */}
      <div className="grain-overlay"></div>

      {/* Animated Background */}
      <div className="bg-gradient"></div>
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Navigation */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="logo-icon">E</div>
          <span className="logo-text">CRYPTOWAVE</span>
        </div>

        <div className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
          <a href="#about" onClick={handleNavClick}>About</a>
          <a href="#tiers" onClick={handleNavClick}>Tiers</a>
          <a href="#vip" onClick={handleNavClick}>VIP</a>
          <a href="#security" onClick={handleNavClick}>Security</a>
        </div>

        <button
          className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <button className="nav-connect" onClick={openWalletModal} disabled={loading}>
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </nav>

      {/* Wallet Selection Modal */}
      {walletModalOpen && (
        <div className="wallet-modal-overlay" onClick={closeWalletModal}>
          <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-modal-header">
              <h2>Connect Wallet</h2>
              <button className="wallet-modal-close" onClick={closeWalletModal}>
                X
              </button>
            </div>

            <p className="wallet-modal-description">
              Choose your preferred wallet to connect to CRYPTOWAVE
            </p>

            <div className="wallet-options">
              <button className="wallet-option" onClick={connectMetaMask}>
                <div className="wallet-option-icon">
                  <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJZaVpfhv3kgZA46GoqfVNIFhR6pXIdX4_Rg&s" alt="MetaMask" />
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">MetaMask</div>
                  <div className="wallet-option-description">Connect using MetaMask wallet</div>
                </div>
                <div className="wallet-option-arrow">→</div>
              </button>

              <button className="wallet-option" onClick={connectCoinbase}>
                <div className="wallet-option-icon">
                  <img src="https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8e/22/05/8e22052d-d1e6-e39a-1c13-3630317e438e/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/1200x630wa.png" alt="Coinbase Wallet" />
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">Coinbase Wallet</div>
                  <div className="wallet-option-description">Connect with Coinbase</div>
                </div>
                <div className="wallet-option-arrow">→</div>
              </button>

              <button className="wallet-option" onClick={connectWalletConnect}>
                <div className="wallet-option-icon">
                  <img src="https://cwallet.com/blog/content/images/2023/10/WalletConnect-Symbol.png" alt="WalletConnect" />
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">WalletConnect</div>
                  <div className="wallet-option-description">Scan with mobile wallet</div>
                </div>
                <div className="wallet-option-arrow">→</div>
              </button>

              <button className="wallet-option" onClick={connectTrustWallet}>
                <div className="wallet-option-icon">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Trust_Wallet_logo_%282026%29.png" alt="Trust Wallet" />
                </div>
                <div className="wallet-option-info">
                  <div className="wallet-option-name">Trust Wallet</div>
                  <div className="wallet-option-description">Connect using Trust Wallet</div>
                </div>
                <div className="wallet-option-arrow">→</div>
              </button>
            </div>

            <div className="wallet-modal-footer">
              <p>
                New to Ethereum wallets? <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer">Learn more</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <main className="hero">
        <div className="hero-content">
          <div className="badge">
            <span className="badge-dot"></span>
            Live on Ethereum Mainnet
          </div>

          <h1 className="hero-title">
            <span className="title-line">Compound Your</span>
            <span className="title-line gradient-text">USDT Holdings</span>
            <span className="title-line">On-Chain</span>
          </h1>

          <p className="hero-subtitle">
            Tiered daily dividends up to 2% with automatic compounding.<br/>
            Fully decentralized. Transparent rewards. Premium VIP benefits.
          </p>

          <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">$12.4M</div>
              <div className="stat-label">Total Value Locked</div>
            </div>
            <div className="stat">
              <div className="stat-value">2,847</div>
              <div className="stat-label">Active Stakers</div>
            </div>
            <div className="stat">
              <div className="stat-value">98.2%</div>
              <div className="stat-label">Uptime</div>
            </div>
          </div>

          <div className="hero-cta">
            <button className="cta-button" onClick={openWalletModal} disabled={loading}>
              <span className="button-text">
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </span>
              <div className="button-shine"></div>
              <svg className="button-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <a href="#docs" className="cta-secondary">
              <span>View Documentation</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="card-3d">
            <div className="card-front">
              <div className="card-header">
                <span className="card-badge">VIP 3</span>
                <span className="card-apy">2.0% Daily</span>
              </div>
              <div className="card-body">
                <div className="card-balance">
                  <span className="balance-label">Staked Balance</span>
                  <span className="balance-value">125,000 USDT</span>
                </div>
                <div className="card-earnings">
                  <span className="earnings-label">Daily Earnings</span>
                  <span className="earnings-value">+3,437.50 USDT</span>
                </div>
              </div>
              <div className="card-footer">
                <div className="card-chips"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="features" id="about">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L4 10L16 16L28 10L16 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 22L16 28L28 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 16L16 22L28 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Tiered Rewards</h3>
            <p>Unlock higher APY as your stake grows. From 1% to 2% daily compounded returns.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 8V16L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Auto-Compound</h3>
            <p>Set it and forget it. Earnings automatically compound to maximize your returns.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L19.5 12.5L30 16L19.5 19.5L16 30L12.5 19.5L2 16L12.5 12.5L16 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>VIP Levels</h3>
            <p>Automatic upgrades with exclusive bonus rates and priority support.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M4 14H28" stroke="currentColor" strokeWidth="2"/>
                <circle cx="10" cy="20" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <h3>Flexible Withdrawal</h3>
            <p>Access your earnings or full balance anytime. No lock-up periods.</p>
          </div>
        </div>
      </section>

      {/* Tiers Section */}
      <section className="tiers" id="tiers">
        <h2 className="section-title">
          <span>Staking Tiers</span>
          <div className="title-underline"></div>
        </h2>

        <div className="tiers-grid">
          <div className="tier-card tier-starter">
            <div className="tier-header">
              <h3>Starter</h3>
              <div className="tier-apy">1.0% Daily</div>
            </div>
            <div className="tier-range">1 - 10,000 USDT</div>
            <ul className="tier-features">
              <li>Daily compounding</li>
              <li>Standard support</li>
              <li>Withdraw anytime</li>
            </ul>
          </div>

          <div className="tier-card tier-growth">
            <div className="tier-badge">Popular</div>
            <div className="tier-header">
              <h3>Growth</h3>
              <div className="tier-apy">1.5% Daily</div>
            </div>
            <div className="tier-range">10,001 - 50,000 USDT</div>
            <ul className="tier-features">
              <li>Enhanced returns</li>
              <li>Priority support</li>
              <li>VIP eligibility</li>
              <li>Analytics dashboard</li>
            </ul>
          </div>

          <div className="tier-card tier-premium">
            <div className="tier-badge">Premium</div>
            <div className="tier-header">
              <h3>Premium</h3>
              <div className="tier-apy">2.0% Daily</div>
            </div>
            <div className="tier-range">50,001+ USDT</div>
            <ul className="tier-features">
              <li>Maximum APY</li>
              <li>VIP 2 & 3 access</li>
              <li>Dedicated support</li>
              <li>Advanced analytics</li>
              <li>Early feature access</li>
            </ul>
          </div>
        </div>
      </section>

      {/* VIP Section */}
      <section className="vip-section" id="vip">
        <div className="vip-content">
          <h2 className="section-title">
            <span>VIP Benefits</span>
            <div className="title-underline"></div>
          </h2>
          <p className="vip-description">
            Automatic tier upgrades based on your staked balance.
            Higher tiers unlock enhanced daily rates and exclusive perks.
          </p>

          <div className="vip-table">
            <div className="vip-row vip-header">
              <div className="vip-cell">Level</div>
              <div className="vip-cell">Requirement</div>
              <div className="vip-cell">Bonus Rate</div>
              <div className="vip-cell">Perks</div>
            </div>
            <div className="vip-row">
              <div className="vip-cell" data-label="Level"><strong>Normal</strong></div>
              <div className="vip-cell" data-label="Requirement">0+ USDT</div>
              <div className="vip-cell" data-label="Bonus Rate">+0%</div>
              <div className="vip-cell" data-label="Perks">Standard support</div>
            </div>
            <div className="vip-row highlight">
              <div className="vip-cell" data-label="Level"><strong>VIP 1</strong></div>
              <div className="vip-cell" data-label="Requirement">10,000+ USDT</div>
              <div className="vip-cell" data-label="Bonus Rate">+0.25%</div>
              <div className="vip-cell" data-label="Perks">Priority support</div>
            </div>
            <div className="vip-row highlight">
              <div className="vip-cell" data-label="Level"><strong>VIP 2</strong></div>
              <div className="vip-cell" data-label="Requirement">50,000+ USDT</div>
              <div className="vip-cell" data-label="Bonus Rate">+0.5%</div>
              <div className="vip-cell" data-label="Perks">Dedicated manager</div>
            </div>
            <div className="vip-row highlight">
              <div className="vip-cell" data-label="Level"><strong>VIP 3</strong></div>
              <div className="vip-cell" data-label="Requirement">100,000+ USDT</div>
              <div className="vip-cell" data-label="Bonus Rate">+1.0%</div>
              <div className="vip-cell" data-label="Perks">All features unlocked</div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="security-section" id="security">
        <h2 className="section-title">
          <span>Security First</span>
          <div className="title-underline"></div>
        </h2>

        <div className="security-grid">
          <div className="security-card">
            <div className="security-icon">🔒</div>
            <h4>Audited Smart Contracts</h4>
            <p>Professionally audited by CertiK. OpenZeppelin security standards.</p>
          </div>
          <div className="security-card">
            <div className="security-icon">⚡</div>
            <h4>Non-Custodial</h4>
            <p>You control your funds. Withdraw anytime without permission.</p>
          </div>
          <div className="security-card">
            <div className="security-icon">🛡️</div>
            <h4>Emergency Pause</h4>
            <p>Circuit breaker protection for unexpected situations.</p>
          </div>
          <div className="security-card">
            <div className="security-icon">📊</div>
            <h4>Transparent</h4>
            <p>All transactions visible on-chain. Fully verifiable.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon">E</div>
            <span>CRYPTOWAVE</span>
          </div>
          <div className="footer-links">
            <a href="#docs">Documentation</a>
            <a href="#audit">Security Audit</a>
            <a href="#terms">Terms</a>
            <a href="#privacy">Privacy</a>
          </div>
          <div className="footer-social">
            <a href="#twitter" aria-label="Twitter">X</a>
            <a href="#telegram" aria-label="Telegram">T</a>
            <a href="#discord" aria-label="Discord">D</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 CRYPTOWAVE. Audited by CertiK. Built on Ethereum.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
