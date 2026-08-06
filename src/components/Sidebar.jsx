import {
  BarChart3,
  Building2,
  History,
  Home,
  Package,
  ReceiptText,
  Settings,
  Store,
  Users,
} from 'lucide-react';

function buildNavGroups() {
  return [
    {
      label: 'Main',
      items: [
        { key: 'admin', label: 'System Admin', icon: Building2, tag: 'HQ' },
        { key: 'settings', label: 'Settings', icon: Settings },
      ],
    },
    {
      label: 'Report',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: Home },
        { key: 'orders', label: 'Order History', icon: ReceiptText },
        { key: 'customers', label: 'Customers', icon: Users },
        { key: 'points', label: 'Points History', icon: History },
        { key: 'products', label: 'Products', icon: Package },
        { key: 'best-sellers', label: 'Best Sellers', icon: BarChart3 },
      ],
    },
  ];
}

export default function Sidebar({
  page,
  onPageChange,
  store,
  stores = [],
  selectedStoreId,
  onStoreChange,
  isGuest = false,
}) {
  const navGroups = isGuest ? [] : buildNavGroups();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-mark image-logo">
          <img src="/png/logo/paynet-logo.png" alt="Paynet Loyalty" />
        </div>
        <div>
          <strong>Paynet Loyalty</strong>
          <span>APoint Rewards</span>
        </div>
      </div>

      {!isGuest && stores.length > 0 && (
        <div className="sidebar-store-switcher">
          <span>Active store view</span>
          <select value={selectedStoreId || ''} onChange={event => onStoreChange?.(event.target.value)}>
            {stores.map(item => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="sidebar-nav-scroll">
        {isGuest && (
          <section className="nav-group">
            <p>Access</p>
            <button type="button" className="nav-item active">
              <Users size={17} />
              <span>No store access</span>
            </button>
          </section>
        )}

        {navGroups.map(group => (
          <section className="nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  className={`nav-item ${page === item.key ? 'active' : ''}`}
                  onClick={() => onPageChange(item.key)}
                  key={item.key}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.tag && <em>{item.tag}</em>}
                </button>
              );
            })}
          </section>
        ))}
      </nav>

      <div className="store-fixed-card">
        <Store size={22} />
        <div>
          <strong>{isGuest ? 'Guest wallet' : store?.name || 'Select a store'}</strong>
          <span>{isGuest ? 'No store access' : store?.branch || 'Network view'}</span>
        </div>
      </div>
    </aside>
  );
}
