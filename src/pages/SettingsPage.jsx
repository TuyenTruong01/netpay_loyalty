import { shortAddress } from '../utils/format.js';

export default function SettingsPage({ store, receiverWallet, settings, canViewWallet = true }) {
  return (
    <section className="panel full-page-panel">
      <div className="panel-head"><div><p className="eyebrow">Configuration</p><h2>Settings</h2></div></div>
      <div className="settings-grid">
        <article className="setting-card"><span>Store</span><strong>{store?.name || 'Minh Chau Grocery'}</strong><small>{store?.branch || 'Da Nang Branch'}</small></article>
        <article className="setting-card"><span>Network</span><strong>{store?.network || 'Store payment network'}</strong><small>Crypto checkout network</small></article>
        <article className="setting-card"><span>Currency</span><strong>USDC</strong><small>All POS prices are displayed in USDC</small></article>
        <article className="setting-card"><span>Default Tax</span><strong>{settings?.taxRate || 10}%</strong><small>Configurable invoice tax rate</small></article>
        <article className="setting-card"><span>Earn Rate</span><strong>1 USDC = 1 point</strong><small>Earned after redemption based on paid amount</small></article>
        <article className="setting-card"><span>Redeem Rate</span><strong>1 point = 0.01 USDC</strong><small>Customer chooses on checkout page</small></article>
        <article className="setting-card wide">
          <span>Store Wallet</span>
          <strong>{canViewWallet ? shortAddress(receiverWallet) : 'Hidden'}</strong>
          <small>{canViewWallet ? receiverWallet : 'Only the store owner can view store wallet details.'}</small>
        </article>
      </div>
    </section>
  );
}
