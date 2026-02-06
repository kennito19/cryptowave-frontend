import './QuickActions.css';

function QuickActions({ onAction }) {
  const actions = [
    { id: 'deposit', label: 'Deposit', icon: '💰', color: 'primary' },
    { id: 'withdraw', label: 'Withdraw', icon: '💸', color: 'warning' },
    { id: 'convert', label: 'Convert', icon: '🔄', color: 'secondary' },
    { id: 'history', label: 'History', icon: '📋', color: 'secondary' }
  ];

  return (
    <div className="quick-actions">
      {actions.map(action => (
        <button
          key={action.id}
          className={`quick-action-btn ${action.color}`}
          onClick={() => onAction(action.id)}
        >
          <div className="quick-action-icon">{action.icon}</div>
          <span className="quick-action-label">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
