import './TransactionList.css';

function TransactionList({ transactions, limit = 5 }) {
  const getTypeIcon = (type) => {
    switch(type) {
      case 'deposit':
      case 'stake': return '💰';
      case 'withdraw':
      case 'unstake': return '💸';
      case 'interest':
      case 'claim': return '📈';
      case 'bonus': return '🎁';
      default: return '📋';
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'deposit':
      case 'stake':
      case 'interest':
      case 'claim':
      case 'bonus':
        return 'success';
      case 'withdraw':
      case 'unstake':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed': return { text: 'Completed', class: 'success' };
      case 'pending': return { text: 'Pending', class: 'warning' };
      case 'rejected': return { text: 'Rejected', class: 'danger' };
      default: return { text: status, class: 'neutral' };
    }
  };

  const displayTransactions = transactions.slice(0, limit);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="transaction-list">
        <div className="empty-transactions">
          <span className="empty-icon">📋</span>
          <p>No transactions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      {displayTransactions.map((tx, index) => {
        const statusBadge = getStatusBadge(tx.status);
        return (
          <div key={tx.id || index} className="transaction-item">
            <div className={`tx-icon ${getTypeColor(tx.type)}`}>
              {getTypeIcon(tx.type)}
            </div>

            <div className="tx-details">
              <span className="tx-type">{tx.type}</span>
              <span className="tx-date">{tx.date}</span>
            </div>

            <div className="tx-amount-section">
              <span className={`tx-amount ${getTypeColor(tx.type)}`}>
                {['deposit', 'stake', 'interest', 'claim', 'bonus'].includes(tx.type) ? '+' : '-'}
                ${parseFloat(tx.amount).toLocaleString()}
              </span>
              <span className={`tx-status ${statusBadge.class}`}>
                {statusBadge.text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TransactionList;
