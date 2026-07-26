import {
  Activity,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  ExternalLink,
  FileText,
  Search,
  ShieldCheck,
  Star,
  Store,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { money, shortAddress } from '../../utils/format.js';

function pageHeader(eyebrow, title, description, action) {
  return (
    <div className="admin-page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function statusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  const cls = ['paid', 'verified', 'active', 'success', 'completed'].includes(normalized)
    ? 'ok'
    : ['failed', 'disabled', 'rejected', 'flagged'].includes(normalized)
      ? 'bad'
      : 'warn';
  return <span className={`badge ${cls}`}>{status || 'Pending'}</span>;
}

function allOrders(stores) {
  return stores.flatMap(store => (store.orders || []).map(order => ({ ...order, store })));
}

export function AdminStoresPage({ stores, onSelectStore, onToggleStoreStatus }) {
  const [query, setQuery] = useState('');
  const filtered = stores.filter(store => `${store.name} ${store.branch} ${store.type} ${store.ownerWallet}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="page-stack admin-subpage">
      {pageHeader('Merchant Network', 'Stores', 'Review participating merchants, their wallets, product listings, and operating status.', <span className="badge ok"><Store size={14}/> {stores.length} stores</span>)}
      <div className="admin-toolbar">
        <label className="admin-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search stores, wallet, location" /></label>
        <span>{filtered.length} results</span>
      </div>
      <section className="panel full-page-panel">
        <div className="table-scroll">
          <table className="data-table admin-modern-table">
            <thead><tr><th>Store</th><th>Owner Wallet</th><th>Products</th><th>Orders</th><th>USDC Volume</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map(store => {
                const revenue = (store.orders || []).filter(order => order.paymentMethod === 'usdc').reduce((sum, order) => sum + Number(order.total || 0), 0);
                return <tr key={store.id}>
                  <td><button className="table-store-link" onClick={() => onSelectStore?.(store.id)}><span className="table-store-icon"><Store size={17}/></span><span><strong>{store.name}</strong><small>{store.branch} · {store.type}</small></span></button></td>
                  <td><code>{shortAddress(store.ownerWallet)}</code></td>
                  <td>{(store.products || []).filter(product => product.visible !== false).length}</td>
                  <td>{(store.orders || []).length}</td>
                  <td><strong>{money(revenue)}</strong></td>
                  <td>{statusBadge(store.status === 'disabled' ? 'Disabled' : 'Active')}</td>
                  <td><button className={store.status === 'disabled' ? 'success compact' : 'ghost compact'} onClick={() => onToggleStoreStatus?.(store.id)}>{store.status === 'disabled' ? 'Reactivate' : 'Disable'}</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export function AdminPaymentsPage({ stores }) {
  const orders = useMemo(() => allOrders(stores).filter(order => order.paymentMethod === 'usdc'), [stores]);
  const paidVolume = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  return (
    <section className="page-stack admin-subpage">
      {pageHeader('Arc Settlement', 'USDC Payments', 'Track direct customer-to-store USDC settlements and their verification status.', <span className="badge ok"><CircleDollarSign size={14}/> Arc Testnet</span>)}
      <div className="stats-grid three admin-kpis">
        <article className="stat-card"><span className="blue">USDC Orders</span><strong>{orders.length}</strong><small>Submitted through NetPay</small></article>
        <article className="stat-card"><span className="green">Settled Volume</span><strong>{money(paidVolume)}</strong><small>Direct to store wallets</small></article>
        <article className="stat-card"><span className="orange">Pending Verification</span><strong>{orders.filter(order => order.paymentStatus !== 'paid').length}</strong><small>Awaiting on-chain confirmation</small></article>
      </div>
      <section className="panel full-page-panel"><div className="table-scroll"><table className="data-table admin-modern-table">
        <thead><tr><th>Order</th><th>Store</th><th>Customer</th><th>Amount</th><th>Transaction</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>{orders.length ? orders.map(order => <tr key={`${order.store.id}-${order.id}`}>
          <td><strong>{order.id}</strong></td><td>{order.store.name}</td><td><code>{shortAddress(order.customerWallet || '0x7B9f00000000000000000000000000000000B123')}</code></td><td><strong>{money(order.total)}</strong></td>
          <td><span className="tx-cell"><code>{shortAddress(order.txHash || `0x${String(order.id).replace(/\W/g,'').padEnd(40,'0')}`)}</code><ExternalLink size={14}/></span></td><td>{statusBadge(order.paymentStatus === 'paid' ? 'Verified' : 'Pending')}</td><td>{new Date(order.createdAt).toLocaleString()}</td>
        </tr>) : <tr><td colSpan="7"><div className="admin-empty"><WalletCards/><strong>No USDC payments yet</strong><span>Customer payments will appear here after checkout.</span></div></td></tr>}</tbody>
      </table></div></section>
    </section>
  );
}

export function AdminAPointPage({ stores }) {
  const orders = useMemo(() => allOrders(stores).filter(order => order.paymentMethod === 'usdc'), [stores]);
  const events = orders.flatMap(order => {
    const earned = Math.floor(Number(order.total || 0));
    const list = [];
    if (Number(order.pointsUsed || 0) > 0) list.push({ id: `${order.id}-redeem`, type: 'Redeem', points: Number(order.pointsUsed), order });
    if (earned > 0) list.push({ id: `${order.id}-credit`, type: 'Credit', points: earned, order });
    return list;
  });
  const issued = events.filter(event => event.type === 'Credit').reduce((sum, event) => sum + event.points, 0);
  const redeemed = events.filter(event => event.type === 'Redeem').reduce((sum, event) => sum + event.points, 0);
  return (
    <section className="page-stack admin-subpage">
      {pageHeader('Universal Loyalty', 'APoint Ledger', 'Monitor non-expiring on-chain points issued and redeemed across the merchant network.', <span className="badge ok"><ShieldCheck size={14}/> On-chain source of truth</span>)}
      <div className="stats-grid three admin-kpis"><article className="stat-card"><span className="green">Total Issued</span><strong>{issued}</strong><small>APoint credited</small></article><article className="stat-card"><span className="orange">Total Redeemed</span><strong>{redeemed}</strong><small>APoint used at checkout</small></article><article className="stat-card"><span className="blue">Outstanding</span><strong>{Math.max(0, issued - redeemed)}</strong><small>Network balance</small></article></div>
      <section className="panel full-page-panel"><div className="table-scroll"><table className="data-table admin-modern-table"><thead><tr><th>Event</th><th>Wallet</th><th>Points</th><th>Store</th><th>Order</th><th>Reference</th><th>Time</th></tr></thead><tbody>
        {events.length ? events.map(event => <tr key={event.id}><td>{statusBadge(event.type)}</td><td><code>{shortAddress(event.order.customerWallet || '0x7B9f00000000000000000000000000000000B123')}</code></td><td><strong className={event.type === 'Credit' ? 'green' : 'orange'}>{event.type === 'Credit' ? '+' : '-'}{event.points}</strong></td><td>{event.order.store.name}</td><td>{event.order.id}</td><td><code>{shortAddress(`0x${event.id.replace(/\W/g,'').padEnd(40,'0')}`)}</code></td><td>{new Date(event.order.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan="7"><div className="admin-empty"><Star/><strong>No APoint events yet</strong><span>Credits and redemptions will be listed after USDC orders.</span></div></td></tr>}
      </tbody></table></div></section>
    </section>
  );
}

const reviewSeed = [
  { id: 'REV-1042', store: 'Minh Chau Grocery', customer: '0x72a1...981c', rating: 5, text: 'Clear prices and quick pickup.', status: 'Published', order: 'ORD-821042' },
  { id: 'REV-1038', store: 'Morning Cafe', customer: '0xa821...c18f', rating: 4, text: 'Good drinks, payment was easy.', status: 'Published', order: 'ORD-821038' },
  { id: 'REV-1029', store: 'Golden Bowl Noodles', customer: '0x119f...a662', rating: 2, text: 'Order preparation took longer than expected.', status: 'Flagged', order: 'ORD-821029' },
];

export function AdminReviewsPage() {
  const [reviews, setReviews] = useState(reviewSeed);
  return <section className="page-stack admin-subpage">
    {pageHeader('Merchant Reputation', 'Reviews', 'Moderate verified customer feedback linked to completed orders.', <span className="badge warn"><Star size={14}/> {reviews.filter(review => review.status === 'Flagged').length} flagged</span>)}
    <section className="review-admin-grid">{reviews.map(review => <article className="review-admin-card" key={review.id}><div className="review-card-top"><div><strong>{review.store}</strong><small>{review.order} · {review.customer}</small></div>{statusBadge(review.status)}</div><div className="review-stars">{'★'.repeat(review.rating)}<span>{'★'.repeat(5-review.rating)}</span></div><p>{review.text}</p><div className="review-actions"><button className="ghost compact" onClick={() => setReviews(current => current.map(item => item.id === review.id ? {...item, status: item.status === 'Hidden' ? 'Published' : 'Hidden'} : item))}>{review.status === 'Hidden' ? 'Restore' : 'Hide'}</button><button className="ghost compact">View order</button></div></article>)}</section>
  </section>;
}

const agentSeed = [
  { id: 'AG-301', agent: 'Store Management Agent', store: 'Minh Chau Grocery', command: 'Show products with fewer than 5 units.', tool: 'list_low_stock', result: '3 products found', status: 'Success', risk: 'Read only' },
  { id: 'AG-300', agent: 'Shopping Assistant', store: 'Morning Cafe', command: 'Build a snack cart under 10 USDC.', tool: 'recommend_products', result: 'Cart draft created', status: 'Success', risk: 'Customer confirmation' },
  { id: 'AG-299', agent: 'Network Operations Agent', store: 'Network', command: 'Review failed payment verifications.', tool: 'review_transactions', result: 'No critical anomaly', status: 'Success', risk: 'Read only' },
];

export function AdminAgentActivityPage() {
  return <section className="page-stack admin-subpage">
    {pageHeader('Controlled Automation', 'Agent Activity', 'Audit every agent command, tool call, confirmation requirement, and result.', <span className="badge ok"><Bot size={14}/> Audited actions</span>)}
    <section className="panel full-page-panel"><div className="table-scroll"><table className="data-table admin-modern-table"><thead><tr><th>Agent</th><th>Store</th><th>User Command</th><th>Tool</th><th>Result</th><th>Risk Control</th><th>Status</th></tr></thead><tbody>{agentSeed.map(row => <tr key={row.id}><td><span className="agent-name"><Bot size={17}/><strong>{row.agent}</strong></span></td><td>{row.store}</td><td className="wide-cell">{row.command}</td><td><code>{row.tool}</code></td><td>{row.result}</td><td>{row.risk}</td><td>{statusBadge(row.status)}</td></tr>)}</tbody></table></div></section>
  </section>;
}

export function AdminContractsPage() {
  const contracts = [
    { name: 'NetPayStoreRegistry', env: 'VITE_NETPAY_STORE_REGISTRY_ADDRESS', purpose: 'Store and wallet registry' },
    { name: 'NetPayPaymentRegistry', env: 'VITE_NETPAY_PAYMENT_REGISTRY_ADDRESS', purpose: 'USDC settlement records' },
    { name: 'APointLedger', env: 'VITE_APOINT_LEDGER_ADDRESS', purpose: 'Non-transferable loyalty ledger' },
  ];
  return <section className="page-stack admin-subpage">
    {pageHeader('Protocol Infrastructure', 'Contracts', 'Review the new NetPay V1 contracts, configured addresses, and network status.', <span className="badge warn"><Activity size={14}/> Not deployed</span>)}
    <section className="contract-admin-grid">{contracts.map(contract => <article className="contract-admin-card" key={contract.name}><div className="contract-icon"><FileText/></div><div><small>Arc Testnet</small><h2>{contract.name}</h2><p>{contract.purpose}</p></div><div className="contract-address"><span>Contract address</span><code>Not configured</code><button title="Copy address" disabled><Copy size={15}/></button></div><div className="contract-meta"><span>{statusBadge('Pending')}</span><code>{contract.env}</code></div></article>)}</section>
    <section className="panel protocol-note"><ShieldCheck size={23}/><div><strong>Fresh deployment required</strong><p>Legacy APoint and payment-proof addresses are intentionally excluded from this console.</p></div></section>
  </section>;
}
