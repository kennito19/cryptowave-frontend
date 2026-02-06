import './VIPCard.css';

function VIPCard({ currentLevel, stakedAmount, onUpgrade }) {
  const vipTiers = [
    { level: 0, name: 'Standard', min: 0, rate: 1, color: 'standard' },
    { level: 1, name: 'VIP 1', min: 1000, rate: 1.5, color: 'vip1' },
    { level: 2, name: 'VIP 2', min: 5000, rate: 2, color: 'vip2' },
    { level: 3, name: 'VIP 3', min: 10000, rate: 2.5, color: 'vip3' }
  ];

  const currentTier = vipTiers[currentLevel] || vipTiers[0];
  const nextTier = vipTiers[currentLevel + 1];

  const progressToNext = nextTier
    ? Math.min((stakedAmount / nextTier.min) * 100, 100)
    : 100;

  const amountNeeded = nextTier ? Math.max(nextTier.min - stakedAmount, 0) : 0;

  return (
    <div className={`vip-status-card ${currentTier.color}`}>
      <div className="vip-status-header">
        <div className="vip-badge">
          <span className="vip-crown">👑</span>
          <span className="vip-name">{currentTier.name}</span>
        </div>
        <div className="vip-rate">
          <span className="rate-value">{currentTier.rate}%</span>
          <span className="rate-label">Daily</span>
        </div>
      </div>

      {nextTier && (
        <div className="vip-progress-section">
          <div className="progress-header">
            <span className="progress-label">Progress to {nextTier.name}</span>
            <span className="progress-amount">
              ${stakedAmount.toLocaleString()} / ${nextTier.min.toLocaleString()}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressToNext}%` }}
            ></div>
          </div>
          <p className="progress-hint">
            Deposit ${amountNeeded.toLocaleString()} more to unlock {nextTier.rate}% daily
          </p>
        </div>
      )}

      {nextTier && (
        <button className="upgrade-btn" onClick={onUpgrade}>
          Upgrade to {nextTier.name}
        </button>
      )}

      {!nextTier && (
        <div className="max-tier-badge">
          <span>🎉</span>
          <span>Maximum Tier Reached!</span>
        </div>
      )}
    </div>
  );
}

export default VIPCard;
