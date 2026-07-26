import { useMemo, useState } from 'react';
import { Eye, FileDown, Printer } from 'lucide-react';
import { formatDate, formatPoints, formatTime, money, shortAddress } from '../utils/format.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inRange(value, from, to) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= from.getTime() && time <= to.getTime();
}

function buildReceiptHtml(order, taxRate) {
  const subtotal = order.subtotal || order.items?.reduce((sum, item) => sum + item.total, 0) || order.total;
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const redeemedValue = Number(order.pointsDiscount || 0);
  const finalPaid = order.total;
  return `
    <html><head><title>${order.code}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111827} h1{margin:0 0 6px} table{width:100%;border-collapse:collapse;margin-top:18px} th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left} .right{text-align:right}.muted{color:#64748b}.total{font-size:18px;font-weight:800}.box{border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-top:16px}
    </style></head><body>
      <h1>Paynet Loyalty Receipt</h1>
      <div class="muted">Invoice ${order.code}</div>
      <div class="box">
        <div><b>Status:</b> ${order.paymentStatus}</div>
        <div><b>Customer wallet:</b> ${order.customerWallet || '-'}</div>
        <div><b>Network:</b> ${order.network || 'Store payment network'}</div>
        <div><b>Tx hash:</b> ${order.txHash || '-'}</div>
        <div><b>Paid at:</b> ${formatTime(order.paidAt || order.createdAt)}</div>
      </div>
      <table><thead><tr><th>No.</th><th>Product</th><th>Code</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead><tbody>
        ${(order.items || []).map((item, index) => `<tr><td>${index + 1}</td><td>${item.name}</td><td>${item.sku || '-'}</td><td class="right">${item.qty}</td><td class="right">${money(item.unitPrice)}</td><td class="right">${money(item.total)}</td></tr>`).join('')}
      </tbody></table>
      <div class="box">
        <div class="right">Subtotal: <b>${money(subtotal)}</b></div>
        <div class="right">Tax ${taxRate}%: <b>${money(taxAmount)}</b></div>
        <div class="right">Redeemed Points: <b>${formatPoints(order.pointsUsed)} pts</b></div>
        <div class="right">Redeemed Value: <b>-${money(redeemedValue)}</b></div>
        <div class="right total">Paid Amount: ${money(finalPaid)}</div>
      </div>
    </body></html>`;
}

export default function OrdersPage({ orders, taxRate = 10 }) {
  const [filter, setFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    let from = new Date(0);
    let to = new Date(8640000000000000);

    if (filter === 'today') {
      from = startOfDay(now);
      to = new Date(from);
      to.setDate(to.getDate() + 1);
      to.setMilliseconds(-1);
    }
    if (filter === 'week') {
      from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      to = now;
    }
    if (filter === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
    }
    if (filter === 'custom') {
      from = fromDate ? startOfDay(fromDate) : from;
      to = toDate ? startOfDay(toDate) : to;
      if (toDate) {
        to.setDate(to.getDate() + 1);
        to.setMilliseconds(-1);
      }
    }

    return orders.filter(order => filter === 'all' || inRange(order.createdAt, from, to));
  }, [orders, filter, fromDate, toDate]);

  function printOrder(order) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(buildReceiptHtml(order, taxRate));
    win.document.close();
    win.focus();
    win.print();
  }

  function exportOrder(order) {
    const html = buildReceiptHtml(order, taxRate);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${order.code || 'invoice'}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel full-page-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Sales</p>
          <h2>Orders</h2>
        </div>
      </div>

      <div className="filter-row">
        <button className={filter === 'all' ? 'selected-filter' : ''} type="button" onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'today' ? 'selected-filter' : ''} type="button" onClick={() => setFilter('today')}>Today</button>
        <button className={filter === 'week' ? 'selected-filter' : ''} type="button" onClick={() => setFilter('week')}>This Week</button>
        <button className={filter === 'month' ? 'selected-filter' : ''} type="button" onClick={() => setFilter('month')}>This Month</button>
        <button className={filter === 'custom' ? 'selected-filter' : ''} type="button" onClick={() => setFilter('custom')}>Custom Range</button>
        {filter === 'custom' && (
          <>
            <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} />
            <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} />
          </>
        )}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Invoice</th>
            <th>Customer Wallet</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order, index) => (
            <tr key={order.id}>
              <td>{index + 1}</td>
              <td>{order.code}</td>
              <td>{shortAddress(order.customerWallet || order.customer)}</td>
              <td>{money(order.total)}</td>
              <td>USDC</td>
              <td><span className={`badge ${order.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>{order.paymentStatus}</span></td>
              <td>{formatTime(order.createdAt)}</td>
              <td className="action-cell">
                <button type="button" className="small-action" onClick={() => setSelectedOrder(order)}><Eye size={14} /> View</button>
                <button type="button" className="small-action" onClick={() => printOrder(order)}><Printer size={14} /> Print</button>
                <button type="button" className="small-action" onClick={() => exportOrder(order)}><FileDown size={14} /> Export</button>
              </td>
            </tr>
          ))}
          {!filteredOrders.length && <tr><td colSpan="8" className="empty-row">No orders found.</td></tr>}
        </tbody>
      </table>

      {selectedOrder && (
        <div className="modal-backdrop">
          <div className="modal-card receipt-modal">
            <div className="panel-head">
              <div><p className="eyebrow">Final Receipt</p><h2>{selectedOrder.code}</h2></div>
              <button type="button" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
            <div className="receipt-meta">
              <p><span>Customer Wallet</span><strong>{shortAddress(selectedOrder.customerWallet)}</strong></p>
              <p><span>Created</span><strong>{formatDate(selectedOrder.createdAt)}</strong></p>
              <p><span>Network</span><strong>{selectedOrder.network || 'Store payment network'}</strong></p>
              <p><span>Tx Hash</span><strong>{shortAddress(selectedOrder.txHash)}</strong></p>
            </div>
            <table className="data-table">
              <thead><tr><th>No.</th><th>Product</th><th>Code</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
              <tbody>
                {(selectedOrder.items || []).map((item, index) => (
                  <tr key={item.id}><td>{index + 1}</td><td>{item.name}</td><td>{item.sku}</td><td>{item.qty}</td><td>{money(item.unitPrice)}</td><td>{money(item.total)}</td></tr>
                ))}
                {(!selectedOrder.items || selectedOrder.items.length === 0) && <tr><td colSpan="6" className="empty-row">No item details loaded for this old invoice.</td></tr>}
              </tbody>
            </table>
            <div className="receipt-totals">
              <p><span>Subtotal</span><strong>{money(selectedOrder.subtotal || selectedOrder.total)}</strong></p>
              <p><span>Tax ({taxRate}%)</span><strong>{money(Math.round((selectedOrder.subtotal || 0) * taxRate / 100))}</strong></p>
              <p><span>Redeemed Points</span><strong>{formatPoints(selectedOrder.pointsUsed)} pts</strong></p>
              <p><span>Redeemed Value</span><strong>-{money(selectedOrder.pointsDiscount || 0)}</strong></p>
              <p className="total"><span>Paid Amount</span><strong>{money(selectedOrder.total)}</strong></p>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => printOrder(selectedOrder)}><Printer size={15} /> Print Receipt</button>
              <button type="button" onClick={() => exportOrder(selectedOrder)}><FileDown size={15} /> Export Invoice</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
