import { useState } from 'react';
import './WalletCard.css';

function WalletCard({ balance, usdtBalance, vipLevel }) {
  const [isHidden, setIsHidden] = useState(false);

  const formatBalance = (amount) => {
    if (isHidden) return '••••••';
    return parseFloat(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getVipGradient = () => {
    switch(vipLevel) {
      case 1: return 'vip-1';
      case 2: return 'vip-2';
      case 3: return 'vip-3';
      default: return 'vip-0';
    }
  };

  return (
    <div className={`wallet-card ${getVipGradient()}`}>
      <div className="wallet-card-header">
        <span className="wallet-label">Total Balance</span>
        <button
          className="hide-balance-btn"
          onClick={() => setIsHidden(!isHidden)}
        >
          {isHidden ? '👁️' : '🙈'}
        </button>
      </div>

      <div className="wallet-balance">
        <span className="currency-symbol">$</span>
        <span className="balance-amount">{formatBalance(balance)}</span>
      </div>

      <div className="wallet-usdt">
        <span className="usdt-icon">₮</span>
        <span className="usdt-amount">{formatBalance(usdtBalance)} USDT</span>
      </div>

      {vipLevel > 0 && (
        <div className="wallet-vip-badge">
          <span className="vip-crown">👑</span>
          <span>VIP {vipLevel}</span>
        </div>
      )}

      <div className="wallet-card-decoration">
        <div className="decoration-circle circle-1"></div>
        <div className="decoration-circle circle-2"></div>
      </div>
    </div>
  );
}

export default WalletCard;
