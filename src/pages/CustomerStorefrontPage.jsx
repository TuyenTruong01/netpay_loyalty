import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, CreditCard, Landmark, Minus, Plus, ShoppingCart, Star, WalletCards, X } from 'lucide-react';
import { getPaymentChain } from '../chains/index.js';
import { connectEvmWallet } from '../services/evmWallet.js';
import { loadCustomerByWallet, runShoppingAgent } from '../services/agentService.js';
import { apointUnitsFromUsdc, convertLocalToUsdc, formatApointUnits, formatLocalCurrency, formatUsdc, getExchangeRate, minorToLocal } from '../services/exchangeRateService.js';
import { recordStoreVisit } from '../services/storeVisitService.js';
import { shortAddress } from '../utils/format.js';

export default function CustomerStorefrontPage({ store, stores, onSelectStore, cart, setCart, onPlaceOrder }) {
  const [view, setView] = useState('shop');
  const [payment, setPayment] = useState('usdc_arc');
  const [wallet, setWallet] = useState(null);
  const [walletError, setWalletError] = useState('');
  const [points, setPoints] = useState(12000);
  const [usePoints, setUsePoints] = useState(0);
  const [lastOrder, setLastOrder] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [rate, setRate] = useState(null);
  const [rateError, setRateError] = useState('');
  const [agentText, setAgentText] = useState('');
  const [agentReply, setAgentReply] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);

  const currencyDecimals = Number(store.currencyDecimals ?? 0);
  const products = (store.products || []).filter(product => product.visible !== false && product.active !== false && Number(product.listedQuantity) > 0);
  const subtotalLocalMinor = useMemo(() => cart.reduce((sum, line) => sum + Number(line.localPriceMinor ?? line.price ?? 0) * Number(line.quantity || 0), 0), [cart]);
  const subtotalLocal = minorToLocal(subtotalLocalMinor, currencyDecimals);
  const subtotalUsdc = rate ? convertLocalToUsdc(subtotalLocal, rate.rate) : null;
  const maxRedeem = Math.min(points, subtotalUsdc === null ? 0 : apointUnitsFromUsdc(subtotalUsdc));
  const safeUsePoints = Math.min(usePoints, maxRedeem);
  const discountUsdc = payment === 'usdc_arc' ? Math.min(safeUsePoints / 100, subtotalUsdc || 0) : 0;
  const totalUsdc = subtotalUsdc === null ? null : Math.max(0, subtotalUsdc - discountUsdc);
  const requiresRateNow = payment === 'usdc_arc';
  const eligibleUnits = apointUnitsFromUsdc(totalUsdc || 0);
  const enabledMethods = store.paymentMethods?.filter(method => method.isEnabled !== false) || [];
  const bankMethod = enabledMethods.find(method => method.method === 'bank_transfer');

  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get('source') || (window.location.pathname.startsWith('/s/') ? 'direct' : 'shop');
    recordStoreVisit({ storeId: store.id, visitorWallet: wallet?.address || '', source });
  }, [store.id, wallet?.address]);

  useEffect(() => {
    let cancelled = false;
    setRate(null);
    setRateError('');
    getExchangeRate({ baseCurrency: 'USDC', quoteCurrency: store.currencyCode || 'VND' })
      .then(result => { if (!cancelled) setRate(result); })
      .catch(error => { if (!cancelled) setRateError(error.message || 'Exchange rate unavailable.'); });
    return () => { cancelled = true; };
  }, [store.currencyCode]);

  async function connectCustomerWallet() {
    setWalletError('');
    try {
      const connected = await connectEvmWallet(getPaymentChain('arc-testnet'));
      setWallet(connected);
      const customer = await loadCustomerByWallet(connected.address);
      if (customer) setPoints(Math.floor(Number(customer.apoint_units ?? customer.point_balance ?? 0)));
    } catch (error) {
      setWalletError(error.message || 'Cannot connect wallet.');
    }
  }

  function add(product) {
    const line = cart.find(item => item.id === product.id);
    setCart(line
      ? cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...cart, { ...product, quantity: 1 }]
    );
  }

  function change(id, delta) {
    setCart(cart.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0));
  }

  async function checkout() {
    if (payment === 'usdc_arc' && !wallet?.address) {
      setWalletError('Connect a wallet before creating a USDC order.');
      setView('cart');
      return;
    }
    if (requiresRateNow && (!rate || totalUsdc === null)) {
      setWalletError('Exchange rate is unavailable. Paynet Loyalty cannot create a payable USDC snapshot yet.');
      setView('cart');
      return;
    }

    setCheckoutBusy(true);
    setWalletError('');
    try {
      const order = await onPlaceOrder(payment, safeUsePoints, {
      local_currency: store.currencyCode,
      subtotal_local: subtotalLocalMinor,
      discount_local: 0,
      tax_local: 0,
      total_local: subtotalLocalMinor,
      exchange_rate: rate?.rate || null,
      exchange_rate_base: rate?.base_currency || 'USDC',
      exchange_rate_quote: rate?.quote_currency || store.currencyCode,
      exchange_rate_provider: rate?.provider || '',
      exchange_rate_fetched_at: rate?.fetched_at || null,
      exchange_rate_expires_at: rate?.expires_at || null,
      total_usdc: totalUsdc ?? 0,
      apoint_units: eligibleUnits,
      apoint_eligible: Boolean(rate),
      customer_wallet: wallet?.address || '',
    });
      setLastOrder({ ...order, customerWallet: wallet?.address || '' });
      if (payment === 'usdc_arc') setPoints(points - safeUsePoints);
      setView('success');
    } catch (error) {
      setWalletError(error.message || 'Cannot create order.');
      setView('cart');
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function runAgent() {
    const prompt = agentText.trim();
    if (!prompt) return;
    setAgentBusy(true);
    setAgentReply('');
    try {
      const result = await runShoppingAgent({ prompt, store, cart, actorWallet: wallet?.address || '' });
      setAgentReply(result.answer);
    } catch (error) {
      setAgentReply(error.message || 'Agent request failed.');
    } finally {
      setAgentBusy(false);
    }
  }

  return (
    <main className="mobile-stage customer-stage">
      <section className="phone-shell customer-phone">
        <header className="storefront-head">
          <div className="store-avatar">{store.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <small>{store.type} - {store.branch}</small>
            <strong>{store.name}</strong>
            <span><Star size={13} fill="currentColor" />4.8 - Open now</span>
          </div>
          <button className="mobile-icon-button" type="button" onClick={connectCustomerWallet} title="Connect wallet">
            <WalletCards size={18} />
          </button>
        </header>

        <label className="store-picker">
          Storefront
          <select value={store.id} onChange={event => onSelectStore(event.target.value)}>
            {stores.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <div className="mobile-wallet-status">
          <span>{wallet?.address ? shortAddress(wallet.address) : 'No wallet connected'}</span>
          <strong>{wallet?.address ? 'Wallet ready' : 'Connect for USDC payment/APoint identity'}</strong>
        </div>
        {walletError && <p className="mobile-error">{walletError}</p>}

        <div className="phone-scroll">
          {view === 'shop' && (
            <>
              <section className="customer-hero">
                <p>{store.city}, {store.countryName}</p>
                <h1>{store.name}</h1>
                <span>{store.streetAddress || store.branch}</span>
              </section>
              <div className="customer-toolbar">
                <div><strong>{formatApointUnits(points)}</strong><small>{rate ? `1 USDC = ${formatLocalCurrency(rate.rate, store)}` : rateError || 'Loading rate'}</small></div>
                <button onClick={() => setView('agent')}><Bot />Ask agent</button>
              </div>
              <section className="storefront-grid">
                {products.map(product => (
                  <article className="storefront-product" key={product.id}>
                    <div className="storefront-image">{product.image ? <img src={product.image} alt="" /> : <span>{product.name.slice(0, 1)}</span>}</div>
                    <small>{product.category}</small>
                    <strong>{product.name}</strong>
                    <p>{formatLocalCurrency(product.localPrice ?? minorToLocal(product.localPriceMinor, currencyDecimals), store)}</p>
                    {rate && <em className="converted-price">~{formatUsdc(convertLocalToUsdc(product.localPrice ?? minorToLocal(product.localPriceMinor, currencyDecimals), rate.rate), 4)}</em>}
                    <button onClick={() => add(product)}><Plus />Add</button>
                  </article>
                ))}
              </section>
            </>
          )}

          {view === 'cart' && (
            <section>
              <div className="mobile-section-head"><div><small>Checkout</small><h2>Your cart</h2></div><button onClick={() => setView('shop')}><X /></button></div>
              {cart.map(line => (
                <article className="cart-line" key={line.id}>
                  <div><strong>{line.name}</strong><span>{formatLocalCurrency(line.localPrice ?? minorToLocal(line.localPriceMinor, currencyDecimals), store)} each</span></div>
                  <div className="cart-qty"><button onClick={() => change(line.id, -1)}><Minus /></button><b>{line.quantity}</b><button onClick={() => change(line.id, 1)}><Plus /></button></div>
                </article>
              ))}
              <section className="payment-options">
                <h3>Payment method</h3>
                {[['cash', 'Cash', 'Store confirms after receiving cash'], ['bank_transfer', 'Bank transfer', 'Customer submits transfer, store confirms paid'], ['usdc_arc', 'USDC on Arc', 'Wallet signs and payment is valid only after tx confirmation']].map(([id, label, note]) => (
                  <label className={payment === id ? 'selected' : ''} key={id}>
                    <input type="radio" name="payment" value={id} checked={payment === id} onChange={() => { setPayment(id); if (id !== 'usdc_arc') setUsePoints(0); }} />
                    <span>{label}</span>
                    <small>{note}. APoint is awarded only after store/payment confirmation.</small>
                  </label>
                ))}
              </section>
              {payment === 'bank_transfer' && bankMethod && (
                <section className="bank-box">
                  <Landmark size={18} />
                  <div><strong>{bankMethod.bankName || 'Store bank'}</strong><span>{bankMethod.bankAccountName || store.name}</span><code>{bankMethod.bankAccountNumber || 'Bank account not configured yet'}</code></div>
                </section>
              )}
              {payment === 'usdc_arc' && (
                <section className="points-box">
                  <div><strong>Use APoint</strong><span>Balance: {formatApointUnits(points)}</span></div>
                  <input type="range" min="0" max={maxRedeem} step="1" value={safeUsePoints} onChange={event => setUsePoints(Number(event.target.value))} />
                  <p>{formatApointUnits(safeUsePoints)} = {formatUsdc(discountUsdc)} discount</p>
                </section>
              )}
              <div className="checkout-total">
                <p><span>Subtotal</span><strong>{formatLocalCurrency(subtotalLocal, store)}</strong></p>
                <p><span>USDC snapshot</span><strong>{totalUsdc === null ? 'Rate unavailable' : formatUsdc(totalUsdc)}</strong></p>
                <p><span>APoint after paid</span><strong>{rate ? formatApointUnits(eligibleUnits) : 'Pending rate'}</strong></p>
                <p className="grand"><span>Pay</span><strong>{payment === 'usdc_arc' ? (totalUsdc === null ? 'Wait for rate' : formatUsdc(totalUsdc)) : formatLocalCurrency(subtotalLocal, store)}</strong></p>
              </div>
              {!rate && payment === 'usdc_arc' && <p className="mobile-error">{rateError || 'Exchange rate is loading. Deploy or retry the exchange-rate function if this stays blocked.'}</p>}
              {!rate && payment !== 'usdc_arc' && <p className="mobile-hint">Cash/bank order can be created now. APoint will not be awarded until a valid exchange-rate snapshot is available.</p>}
              <button className="primary-mobile" disabled={!cart.length || (requiresRateNow && !rate) || checkoutBusy} onClick={checkout}>{payment === 'usdc_arc' ? <WalletCards /> : <CreditCard />}{checkoutBusy ? 'Creating order...' : 'Confirm order'}</button>
            </section>
          )}

          {view === 'agent' && (
            <section>
              <div className="mobile-section-head"><div><small>Shopping Assistant Agent</small><h2>Ask Paynet Loyalty</h2></div><Bot /></div>
              <div className="agent-panel">
                <textarea value={agentText} onChange={event => setAgentText(event.target.value)} placeholder="Example: Recommend popular products under 5 USDC" />
                <button type="button" onClick={runAgent} disabled={agentBusy}>{agentBusy ? 'Thinking...' : 'Ask shopping agent'}</button>
                {agentReply && <p>{agentReply}</p>}
              </div>
            </section>
          )}

          {view === 'success' && (
            <section className="success-screen">
              <CheckCircle2 />
              <small>Order created</small>
              <h2>{lastOrder?.id}</h2>
              <p>{lastOrder?.paymentMethod === 'usdc_arc' ? 'Wallet order created. Complete the Arc checkout flow; APoint is awarded only after tx confirmation.' : 'Order is awaiting store confirmation. APoint is awarded only after the store marks it paid.'}</p>
              {lastOrder?.customerWallet && <code>{shortAddress(lastOrder.customerWallet)}</code>}
              {lastOrder?.paymentMethod === 'usdc_arc' && lastOrder?.checkoutToken && <a className="primary-mobile" href={`/checkout?token=${lastOrder.checkoutToken}`}>Pay USDC on Arc</a>}
              <button className="primary-mobile" onClick={() => setView('shop')}>Continue shopping</button>
            </section>
          )}
        </div>

        <nav className="customer-bottom">
          <button className={view === 'shop' ? 'active' : ''} onClick={() => setView('shop')}>Store</button>
          <button onClick={connectCustomerWallet}>APoint</button>
          <button className={view === 'agent' ? 'active' : ''} onClick={() => setView('agent')}><Bot />Agent</button>
          <button className={view === 'cart' ? 'active' : ''} onClick={() => setView('cart')}><ShoppingCart />Cart <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></button>
        </nav>
      </section>
    </main>
  );
}
