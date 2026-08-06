import { Building2, CheckCircle2, Edit3, Plus, Power, ShieldCheck, Store, Wallet, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { money, shortAddress } from '../utils/format.js';

const emptyStore = {
  name: '',
  branch: '',
  type: 'Grocery',
  ownerWallet: '',
};

const storeTypes = ['Grocery', 'Coffee', 'Noodle Restaurant', 'Restaurant', 'Retail'];

function storeRevenue(store) {
  return (store.orders || []).filter(order => order.paymentStatus === 'paid').reduce((sum, order) => sum + Number(order.total || 0), 0);
}

export default function SystemAdminPage({
  stores = [],
  selectedStoreId,
  onSelectStore,
  onAddStore,
  onUpdateStore,
  onToggleStoreStatus,
  onUpdateStoreOwner,
  currentWallet,
}) {
  const [draft, setDraft] = useState(emptyStore);
  const [ownerDrafts, setOwnerDrafts] = useState({});
  const [editingStore, setEditingStore] = useState(null);

  const activeStores = stores.filter(store => store.status !== 'disabled');
  const disabledStores = stores.filter(store => store.status === 'disabled');
  const totalRevenue = stores.reduce((sum, store) => sum + storeRevenue(store), 0);

  const selectedStore = useMemo(
    () => stores.find(store => store.id === selectedStoreId) || stores[0],
    [stores, selectedStoreId]
  );

  function submitStore(event) {
    event.preventDefault();
    if (!draft.name.trim()) return alert('Store name is required.');
    if (!draft.ownerWallet.trim()) return alert('Owner wallet is required.');

    onAddStore?.({
      ...draft,
      receiverWallet: draft.ownerWallet.trim(),
    });
    setDraft(emptyStore);
  }

  function saveOwner(store) {
    const wallet = ownerDrafts[store.id]?.trim();
    if (!wallet) return alert('Owner wallet is required.');
    onUpdateStoreOwner?.(store.id, wallet);
    setOwnerDrafts(current => ({ ...current, [store.id]: '' }));
  }

  function submitEditStore(event) {
    event.preventDefault();
    if (!editingStore?.name?.trim()) return alert('Store name is required.');
    if (!editingStore?.ownerWallet?.trim()) return alert('Owner wallet is required.');
    onUpdateStore?.(editingStore.id, editingStore);
    setEditingStore(null);
  }

  return (
    <section className="page-stack">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Paynet Loyalty Network Console</p>
          <h1>Multi-store loyalty operations</h1>
          <p>
            Manage every participating store, owner wallet, operating status, and shared APoint rules from one admin view.
          </p>
        </div>
        <div className="admin-hero-card">
          <ShieldCheck size={24} />
          <span>Signed in as</span>
          <strong>System Admin</strong>
          <code>{shortAddress(currentWallet)}</code>
        </div>
      </section>

      <div className="stats-grid four">
        <article className="stat-card"><span className="green">Active Stores</span><strong>{activeStores.length}</strong><small>{disabledStores.length} disabled</small></article>
        <article className="stat-card"><span className="blue">Store Wallets</span><strong>{stores.length}</strong><small>Owner wallets under admin control</small></article>
        <article className="stat-card"><span className="orange">Single-wallet Model</span><strong>1</strong><small>Primary wallet per store</small></article>
        <article className="stat-card"><span className="green">Network Revenue</span><strong>{money(totalRevenue)}</strong><small>Paid USDC volume</small></article>
      </div>

      <section className="admin-store-grid">
        {stores.map(store => {
          const isSelected = selectedStore?.id === store.id;
          const isDisabled = store.status === 'disabled';
          return (
            <article
              className={`admin-store-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              key={store.id}
              style={{ '--store-accent': store.accent || '#5b35f5' }}
            >
              <button type="button" className="admin-store-select" onClick={() => onSelectStore?.(store.id)}>
                <span className="store-type-mark"><Store size={22} /></span>
                <span>
                  <small>{store.type}</small>
                  <strong>{store.name}</strong>
                  <em>{store.branch}</em>
                </span>
              </button>

              <div className="admin-store-metrics">
                <p><span>Status</span><strong className={isDisabled ? 'red' : 'green'}>{isDisabled ? 'Disabled' : 'Active'}</strong></p>
                <p><span>Wallets</span><strong>1</strong></p>
                <p><span>Products</span><strong>{(store.products || []).filter(product => product.active !== false).length}</strong></p>
              </div>

              <div className="admin-wallet-box">
                <Wallet size={16} />
                <div>
                  <span>Owner wallet</span>
                  <strong>{shortAddress(store.ownerWallet)}</strong>
                </div>
              </div>

              <div className="owner-edit-row">
                <input
                  value={ownerDrafts[store.id] || ''}
                  onChange={event => setOwnerDrafts(current => ({ ...current, [store.id]: event.target.value }))}
                  placeholder="New owner wallet"
                />
                <button type="button" onClick={() => saveOwner(store)}>Save</button>
              </div>

              <button type="button" className="ghost full" onClick={() => setEditingStore(store)}>
                <Edit3 size={16} /> Edit store
              </button>

              <button
                type="button"
                className={isDisabled ? 'success full' : 'danger-action full'}
                onClick={() => onToggleStoreStatus?.(store.id)}
              >
                {isDisabled ? <CheckCircle2 size={16} /> : <Power size={16} />}
                {isDisabled ? 'Reactivate store' : 'Disable store'}
              </button>
            </article>
          );
        })}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Network Enrollment</p>
            <h2>Add participating store</h2>
          </div>
          <span className="badge ok"><Building2 size={14} /> Admin only</span>
        </div>

        <form className="admin-add-store-form" onSubmit={submitStore}>
          <label>
            Store Name
            <input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Store name" />
          </label>
          <label>
            Branch / Location
            <input value={draft.branch} onChange={event => setDraft({ ...draft, branch: event.target.value })} placeholder="Branch name" />
          </label>
          <label>
            Store Type
            <select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}>
              {storeTypes.map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Main Owner Wallet
            <input value={draft.ownerWallet} onChange={event => setDraft({ ...draft, ownerWallet: event.target.value })} placeholder="0x..." />
          </label>
          <p className="admin-form-note">The owner wallet is also the store payment receiver wallet.</p>
          <button className="primary" type="submit"><Plus size={16} /> Add Store</button>
        </form>
      </section>

      <section className="panel full-page-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Store Directory</p>
            <h2>Store wallets</h2>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Store</th>
              <th>Type</th>
              <th>Owner Wallet</th>
              
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store, index) => (
              <tr key={store.id}>
                <td>{index + 1}</td>
                <td><strong>{store.name}</strong><br /><span className="muted-cell">{store.branch}</span></td>
                <td>{store.type}</td>
                <td><code>{shortAddress(store.ownerWallet)}</code></td>
                <td><span className={`badge ${store.status === 'disabled' ? 'bad' : 'ok'}`}>{store.status === 'disabled' ? 'Disabled' : 'Active'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editingStore && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={submitEditStore}>
            <div className="panel-head">
              <div>
                <p className="eyebrow">Store Setup</p>
                <h2>Edit Store</h2>
              </div>
              <button type="button" onClick={() => setEditingStore(null)}><X size={18} /></button>
            </div>
            <div className="form-grid">
              <label>Store Name<input value={editingStore.name || ''} onChange={event => setEditingStore({ ...editingStore, name: event.target.value })} /></label>
              <label>Branch / Location<input value={editingStore.branch || ''} onChange={event => setEditingStore({ ...editingStore, branch: event.target.value })} /></label>
              <label>Store Type<select value={editingStore.type || 'Grocery'} onChange={event => setEditingStore({ ...editingStore, type: event.target.value })}>{storeTypes.map(type => <option key={type}>{type}</option>)}</select></label>
              <label>Status<select value={editingStore.status || 'active'} onChange={event => setEditingStore({ ...editingStore, status: event.target.value })}><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
              <label>Main Owner Wallet<input value={editingStore.ownerWallet || ''} onChange={event => setEditingStore({ ...editingStore, ownerWallet: event.target.value, receiverWallet: event.target.value })} /></label>
              <p className="admin-form-note">Payment receiver follows the owner wallet.</p>
            </div>
            <button className="primary full" type="submit">Save Store</button>
          </form>
        </div>
      )}
    </section>
  );
}
