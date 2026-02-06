import { useState, useEffect } from 'react';
import './InterestCard.css';

function InterestCard({ totalEarned, dailyRate, stakedAmount }) {
  const [displayEarned, setDisplayEarned] = useState(totalEarned);

  // Simulate real-time counter (visual effect)
  useEffect(() => {
    if (stakedAmount <= 0) return;

    const dailyInterest = stakedAmount * (dailyRate / 100);
    const perSecond = dailyInterest / 86400; // 86400 seconds in a day

    const interval = setInterval(() => {
      setDisplayEarned(prev => prev + perSecond);
    }, 1000);

    return () => clearInterval(interval);
  }, [stakedAmount, dailyRate]);

  // Reset when totalEarned changes from backend
  useEffect(() => {
    setDisplayEarned(totalEarned);
  }, [totalEarned]);

  const todayEarning = stakedAmount * (dailyRate / 100);

  return (
    <div className="interest-card">
      <div className="interest-header">
        <div className="interest-icon">📈</div>
        <span className="interest-label">Interest Earned</span>
      </div>

      <div className="interest-amount">
        <span className="interest-currency">$</span>
        <span className="interest-value">
          {displayEarned.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
          })}
        </span>
      </div>

      <div className="interest-today">
        <span className="today-icon">⚡</span>
        <span className="today-label">Today</span>
        <span className="today-value">
          +${todayEarning.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </span>
      </div>

      <div className="interest-rate">
        <span>{dailyRate}% daily</span>
      </div>
    </div>
  );
}

export default InterestCard;
