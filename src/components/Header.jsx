import { Bell, LogOut, Menu, Search, Wallet } from 'lucide-react';
import { shortAddress } from '../utils/format.js';
import { paymentChains } from '../chains/index.js';

function getRoleLabel(roleLabel) {
  switch (roleLabel) {
    case 'system_admin':
      return 'System Admin';
    case 'store_owner':
      return 'Store Owner';
    default:
      return 'Guest';
  }
}

export default function Header({
  query,
  setQuery,
  connected,
  onConnect,
  onDemo,
  onSignOut,
  staff,
  currentWallet,
  isManager,
  network,
  roleLabel,
}) {
  const displayWallet = currentWallet || staff?.wallet || '';
  const accountName = staff?.name || getRoleLabel(roleLabel);
  const selectedNetwork = paymentChains.some(chain => chain.label === network) ? network : 'Arc Testnet';

  return (
    <header className="topbar">
      <button className="icon-button" type="button" aria-label="Open menu">
        <Menu size={22} />
      </button>

      <label className="global-search">
        <Search size={18} />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search products, orders, customers"
        />
        <kbd>Ctrl + K</kbd>
      </label>

      <div className="topbar-spacer" />

      <div className="mobile-view-links" aria-label="Mobile interfaces">
        <a href="/store-mobile">Store Mobile</a>
        <a href="/shop">Customer</a>
      </div>

      {!connected ? (
        <div className="connected-area">
          <button className="connect-wallet" type="button" onClick={onConnect}>
            <Wallet size={17} /> Connect Wallet
          </button>
          <button className="demo-wallet" type="button" onClick={onDemo}>
            Demo
          </button>
        </div>
      ) : (
        <div className="connected-area">
          <select className="network-select" value={selectedNetwork} onChange={() => {}}>
            {paymentChains.map(chain => (
              <option key={chain.code}>{chain.label}</option>
            ))}
          </select>

          <Bell className="bell-icon" size={21} />

          <div
            className="user-menu"
            title={`${getRoleLabel(roleLabel)}\nWallet: ${displayWallet}`}
          >
            <div className="mini-avatar">{staff?.avatar || 'U'}</div>
            <div>
              <strong>{accountName}</strong>
              <span>{shortAddress(displayWallet)}</span>
            </div>
          </div>

          <button className="signout-topbar-button" type="button" onClick={onSignOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
