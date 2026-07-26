import { CheckCircle2, Copy, ExternalLink, Minus, Plus, QrCode, ReceiptText, RefreshCw, Search, Trash2, Wallet } from 'lucide-react';
import { formatPoints, money, redeemablePointsFromRaw, shortAddress } from '../utils/format.js';

export default function POSPanel({
  invoiceActive,
  canUsePos = false,
  posLockMessage = '',
  onCreateInvoice,
  cartRows,
  customers,
  customerId,
  setCustomerId,
  productSearch,
  setProductSearch,
  onSearchSubmit,
  changeQty,
  removeItem,
  subtotal,
  taxRate,
  taxAmount,
  grossTotal,
  pointsUsed,
  setPointsUsed,
  pointsDiscount,
  total,
  pointsEarned,
  selectedCustomer,
  onCreateCheckout,
  onConfirmMockPayment,
  checkout,
  checkoutPayment,
  paymentStatus,
  receiverWallet,
}) {
  const checkoutToken = checkout?.checkout_token || checkout?.checkoutToken || '';
  const checkoutLink = checkoutToken ? `${window.location.origin}/checkout/${checkoutToken}` : '';
  const qrImageUrl = checkoutLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkoutLink)}`
    : '';

  async function copyCheckoutLink() {
    if (!checkoutLink) return;
    try {
      await navigator.clipboard.writeText(checkoutLink);
      alert('Checkout link copied.');
    } catch {
      prompt('Copy checkout link:', checkoutLink);
    }
  }

  function openCheckoutPage() {
    if (!checkoutLink) return;
    window.open(checkoutLink, '_blank', 'noopener,noreferrer');
  }

  const canUsePoints = selectedCustomer?.id && Number(selectedCustomer.points || 0) > 0;
  const maxDiscountRaw = Math.floor(grossTotal * 0.2);
  const pointsCap = Math.min(Number(selectedCustomer?.points || 0), redeemablePointsFromRaw(maxDiscountRaw));
  const lockedButtonStyle = !canUsePos ? { opacity: 0.45, cursor: 'not-allowed' } : undefined;
  const isPaid = paymentStatus === 'paid' || checkoutPayment?.paymentStatus === 'paid';
  const isChecking = paymentStatus === 'checking';
  const finalPayable = checkoutPayment?.total ?? total;
  const paidWithWallet = isPaid && checkoutPayment?.paymentMode !== 'manual-cash-payment';

  return (
    <section className="pos-panel panel">
      <div className="panel-head pos-head">
        <div>
          <p className="eyebrow">USDC Checkout</p>
          <h2>POS / Checkout</h2>
        </div>
        <button
          type="button"
          className="primary small"
          disabled={!canUsePos}
          onClick={canUsePos ? onCreateInvoice : undefined}
          title={posLockMessage}
          style={lockedButtonStyle}
        >
          <ReceiptText size={16} /> Create New Invoice
        </button>
      </div>

      {!canUsePos && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 12,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            color: '#9a3412',
            fontWeight: 700,
          }}
        >
          {posLockMessage || 'Connect a whitelisted staff wallet to use POS.'}
        </div>
      )}

      {!invoiceActive ? (
        <div className="empty-invoice">
          <ReceiptText size={40} />
          <h3>No active invoice</h3>
          <p>Create a new invoice first. The checkout QR will let the customer connect wallet, redeem points, and pay.</p>
        </div>
      ) : (
        <div className="pos-workspace">
          <div className="invoice-area">
            <form className="scan-row" onSubmit={onSearchSubmit}>
              <Search size={18} />
              <input
                value={productSearch}
                onChange={event => setProductSearch(event.target.value)}
                placeholder="Scan barcode, enter SKU, QR code, or search product name..."
                disabled={!canUsePos}
              />
              <button type="submit" disabled={!canUsePos} style={lockedButtonStyle}>
                <QrCode size={17} /> Add
              </button>
            </form>

            <div className="invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Product</th>
                    <th>Product Code</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cartRows.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-row">No products in this invoice yet.</td>
                    </tr>
                  ) : cartRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td><span className="product-name-cell">{row.emoji} {row.name}</span></td>
                      <td>{row.sku}</td>
                      <td>
                        <span className="qty-control">
                          <button type="button" disabled={!canUsePos} onClick={() => changeQty(row.id, -1)}><Minus size={13} /></button>
                          <b>{row.qty}</b>
                          <button type="button" disabled={!canUsePos} onClick={() => changeQty(row.id, 1)}><Plus size={13} /></button>
                        </span>
                      </td>
                      <td>{money(row.price)}</td>
                      <td><strong>{money(row.price * row.qty)}</strong></td>
                      <td>
                        <button className="table-icon danger" type="button" disabled={!canUsePos} onClick={() => removeItem(row.id)}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="checkout-summary">
            <label className="field-label">Customer Wallet</label>
            <select value={customerId || ''} onChange={event => setCustomerId(event.target.value)} disabled={!canUsePos}>
              <option value="">Guest checkout</option>
              {customers.map(customer => (
                <option value={customer.id} key={customer.id}>{shortAddress(customer.wallet)} · {formatPoints(customer.points)} pts</option>
              ))}
            </select>

            <div className="summary-lines">
              <p><span>Total Products</span><strong>{cartRows.reduce((sum, row) => sum + row.qty, 0)}</strong></p>
              <p><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
              <p><span>Tax ({taxRate}%)</span><strong>{money(taxAmount)}</strong></p>
              <p><span>Total before points</span><strong>{money(grossTotal)}</strong></p>
              <p><span>Redeemed Points</span><strong>{formatPoints(pointsUsed)} pts</strong></p>
              <p><span>Redeemed Value</span><strong>-{money(pointsDiscount)}</strong></p>
              <p className="total"><span>Payable</span><strong>{money(total)}</strong></p>
              <p><span>Estimated Earn</span><strong>{formatPoints(pointsEarned)} pts</strong></p>
            </div>

            <label className={`check-line ${!canUsePoints || !canUsePos ? 'muted' : ''}`}>
              <input
                type="checkbox"
                disabled={!canUsePos || !canUsePoints}
                checked={pointsUsed > 0}
                onChange={event => setPointsUsed(event.target.checked ? pointsCap : 0)}
              />
              Customer redeems loyalty points before signing
            </label>
            {canUsePoints && <small className="helper-text">Max demo redemption: {formatPoints(pointsCap)} pts, capped at 20% of the invoice total.</small>}

            <div className="payment-method-card">
              <Wallet size={18} />
              <div>
                <strong>Wallet USDC Payment</strong>
                <span>Customer pays with USDC from a wallet</span>
              </div>
            </div>

            {!checkout ? (
              <button
                className="primary full"
                type="button"
                disabled={!canUsePos || !cartRows.length || paymentStatus === 'checking'}
                onClick={canUsePos ? onCreateCheckout : undefined}
                style={lockedButtonStyle}
              >
                {paymentStatus === 'checking' ? <RefreshCw className="spin" size={16} /> : <QrCode size={16} />}
                Generate Checkout QR
              </button>
            ) : (
              <div className="qr-actions">
                {isPaid ? (
                  <button className="success full" type="button" disabled>
                    <CheckCircle2 size={16} /> Payment Confirmed
                  </button>
                ) : (
                  <>
                    <button className="ghost full" type="button" disabled>
                      {isChecking ? <RefreshCw className="spin" size={16} /> : <Wallet size={16} />}
                      {isChecking ? 'Checking wallet payment...' : 'Waiting for customer wallet payment'}
                    </button>
                    <button
                      className="success full"
                      type="button"
                      disabled={!canUsePos || isChecking}
                      onClick={canUsePos ? onConfirmMockPayment : undefined}
                      style={lockedButtonStyle}
                    >
                      {isChecking ? <RefreshCw className="spin" size={16} /> : <CheckCircle2 size={16} />}
                      Manual Confirm Cash Payment
                    </button>
                  </>
                )}
              </div>
            )}

            {checkout && (
              <div className="qr-card">
                <h3>Checkout QR</h3>

                <div
                  className="qr-real-box"
                  style={{
                    width: 260,
                    height: 260,
                    margin: '12px auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 18,
                    padding: 10,
                  }}
                >
                  {qrImageUrl ? (
                    <img
                      src={qrImageUrl}
                      alt="Paynet Loyalty checkout QR"
                      style={{
                        width: 240,
                        height: 240,
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div className="qr-box"><span>A</span></div>
                  )}
                </div>

                <p>Invoice <strong>{checkout.order_code}</strong></p>
                <small>Token: {checkoutToken}</small>
                <small>Checkout page: {checkoutLink}</small>

                <div className="payment-info">
                  <p><span>Network</span><strong>Store payment network</strong></p>
                  <p><span>Receiver</span><strong>{shortAddress(receiverWallet)}</strong></p>
                  <p><span>{isPaid ? 'Paid Amount' : 'Payable'}</span><strong>{money(finalPayable)}</strong></p>
                  {isPaid && <p><span>Payment Type</span><strong>{paidWithWallet ? 'Wallet USDC' : 'Cash'}</strong></p>}
                  {isPaid && checkoutPayment?.pointsUsed > 0 && (
                    <p><span>Points Used</span><strong>{formatPoints(checkoutPayment.pointsUsed)} pts</strong></p>
                  )}
                  {isPaid && checkoutPayment?.pointsEarned > 0 && (
                    <p><span>Points Earned</span><strong>{formatPoints(checkoutPayment.pointsEarned)} pts</strong></p>
                  )}
                  {isPaid && checkoutPayment?.payerWallet && (
                    <p><span>Payer</span><strong>{shortAddress(checkoutPayment.payerWallet)}</strong></p>
                  )}
                </div>

                {isPaid && (
                  <p className="payment-confirmation-note">
                    <CheckCircle2 size={16} /> Payment confirmed. This invoice is marked as paid.
                  </p>
                )}

                {checkoutPayment?.txHash && (
                  <a
                    className="explorer-link"
                    href={checkoutPayment.paymentExplorerUrl || `https://testnet.arcscan.app/tx/${checkoutPayment.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View USDC payment transaction <ExternalLink size={14} />
                  </a>
                )}

                {checkoutPayment?.proofTxHash && (
                  <a
                    className="explorer-link"
                    href={checkoutPayment.proofExplorerUrl || `https://testnet.arcscan.app/tx/${checkoutPayment.proofTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View APoint proof transaction <ExternalLink size={14} />
                  </a>
                )}

                <div className="qr-actions">
                  <button type="button" className="ghost full" onClick={copyCheckoutLink}>
                    <Copy size={15} /> Copy checkout link
                  </button>
                  <button type="button" className="ghost full" onClick={openCheckoutPage}>
                    <ExternalLink size={15} /> Open customer page
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
