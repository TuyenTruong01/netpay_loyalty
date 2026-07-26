import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Camera, ChevronRight, CircleDollarSign, Copy, Eye, EyeOff, LocateFixed, Lock, MapPin, PackagePlus, Plus, QrCode, Save, Search, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { getPaymentChain } from '../chains/index.js';
import { connectEvmWallet } from '../services/evmWallet.js';
import { runStoreAgent } from '../services/agentService.js';
import { formatLocalCurrency, formatUsdc, getExchangeRate, localToMinor, minorToLocal } from '../services/exchangeRateService.js';
import { buildFullAddress, normalizeSearchText, searchCountries, searchDivisions } from '../services/locationService.js';
import { normalizeWallet } from '../utils/storeNetwork.js';
import { shortAddress } from '../utils/format.js';

const blankProduct = { name: '', sku: '', barcode: '', category: 'Other', localPrice: 0, listedQuantity: 0, description: '', image: '', visible: true };

function storeWallets(store = {}) {
  const staffWallets = (store.staffMembers || []).filter(member => member.active !== false).map(member => member.wallet);
  return [store.ownerWallet, store.receiverWallet, ...staffWallets].filter(Boolean).map(normalizeWallet);
}

function coerceNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function SearchableCombobox({
  label,
  value,
  placeholder,
  disabled = false,
  loadOptions,
  onSelect,
  allowCustom = true,
}) {
  const [input, setInput] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedInput = normalizeSearchText(input);
  const hasExact = options.some(item => normalizeSearchText(item.name) === normalizedInput);
  const visibleOptions = allowCustom && normalizedInput && !hasExact
    ? [...options, { id: '__custom__', name: `Use custom value: ${input}`, customValue: input }]
    : options;

  useEffect(() => {
    setInput(value || '');
  }, [value]);

  useEffect(() => {
    if (!open || disabled) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await loadOptions(input);
        if (!cancelled) {
          setOptions(result || []);
          setActiveIndex(0);
        }
      } catch {
        if (!cancelled) setOptions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [disabled, input, open]);

  function choose(item) {
    if (!item) return;
    const isCustom = item.id === '__custom__';
    const nextName = isCustom ? item.customValue : item.name;
    setInput(nextName);
    setOpen(false);
    onSelect(isCustom ? { name: nextName, isCustom: true } : item);
  }

  function handleKeyDown(event) {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, Math.max(visibleOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(visibleOptions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <label className="combo-field">
      {label}
      <div className="combo-control">
        <Search size={15} />
        <input
          value={input}
          disabled={disabled}
          placeholder={placeholder}
          onChange={event => { setInput(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && !disabled && (
        <div className="combo-menu">
          {visibleOptions.map((item, index) => (
            <button
              className={index === activeIndex ? 'active' : ''}
              type="button"
              key={item.id || item.name}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <span>{item.name}</span>
              {item.divisionType && <small>{item.divisionType}</small>}
              {item.isCustom || item.id === '__custom__' ? <small>Custom value requires review</small> : null}
            </button>
          ))}
          {!visibleOptions.length && <div className="combo-empty">No result</div>}
        </div>
      )}
    </label>
  );
}

export default function StoreMobilePage({ store, stores, onSelectStore, onSaveProduct, onDeleteProduct, onUpdateStore, onConfirmOrder }) {
  const [tab, setTab] = useState('home');
  const [draft, setDraft] = useState(null);
  const [profileDraft, setProfileDraft] = useState(store);
  const [locationIds, setLocationIds] = useState({ countryId: '', stateId: '', cityId: '', districtId: '', wardId: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileWarning, setProfileWarning] = useState('');
  const [ratePreview, setRatePreview] = useState(null);
  const [rateError, setRateError] = useState('');
  const [wallet, setWallet] = useState(null);
  const [walletError, setWalletError] = useState('');
  const [agentText, setAgentText] = useState('');
  const [agentReply, setAgentReply] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState('');

  const todayOrders = useMemo(() => store.orders || [], [store.orders]);
  const usdcSales = todayOrders.filter(order => ['usdc', 'usdc_arc'].includes(order.paymentMethod)).reduce((sum, order) => sum + Number(order.totalUsdc ?? order.total ?? 0), 0);
  const awaitingOrders = todayOrders.filter(order => ['awaiting_confirmation', 'submitted'].includes(String(order.paymentStatus || order.status || '').toLowerCase()));
  const lowStock = (store.products || []).filter(product => Number(product.listedQuantity ?? product.stock ?? 0) <= 5).length;
  const walletAllowed = wallet?.address ? storeWallets(store).includes(normalizeWallet(wallet.address)) : false;
  const canManage = walletAllowed;

  useEffect(() => {
    setProfileDraft(store);
    setLocationIds({ countryId: '', stateId: '', cityId: '', districtId: '', wardId: store.administrativeDivisionId || '' });
    setProfileMessage('');
    setProfileWarning('');
  }, [store]);

  async function connectStoreWallet() {
    setWalletError('');
    try {
      const connected = await connectEvmWallet(getPaymentChain('arc-testnet'));
      setWallet(connected);
      if (!storeWallets(store).includes(normalizeWallet(connected.address))) {
        setWalletError('This wallet is not assigned to the selected store.');
      }
    } catch (error) {
      setWalletError(error.message || 'Cannot connect wallet.');
    }
  }

  function requireWalletAccess() {
    if (!canManage) {
      setWalletError('Connect the owner or assigned staff wallet before changing store data.');
      return false;
    }
    return true;
  }

  function submitProduct(event) {
    event.preventDefault();
    if (!requireWalletAccess()) return;
    if (!draft.name.trim() || Number(draft.localPrice) < 0) return;
    onSaveProduct({
      ...draft,
      localPrice: Number(draft.localPrice),
      localPriceMinor: localToMinor(draft.localPrice, store.currencyDecimals),
      listedQuantity: Number(draft.listedQuantity),
      active: draft.visible,
    });
    setDraft(null);
    setTab('products');
  }

  async function refreshRatePreview() {
    setRateError('');
    try {
      const result = await getExchangeRate({ baseCurrency: 'USDC', quoteCurrency: store.currencyCode || 'VND' });
      setRatePreview(result);
    } catch (error) {
      setRateError(error.message || 'Cannot load exchange rate.');
    }
  }

  function selectCountry(item) {
    setProfileDraft(current => ({
      ...current,
      countryName: item.name,
      countryCode: item.code || '',
      currencyCode: item.currencyCode || current.currencyCode || '',
      currencySymbol: item.currencySymbol || current.currencySymbol || '',
      currencyDecimals: Number(item.currencyDecimals ?? current.currencyDecimals ?? 0),
      stateProvince: '',
      city: '',
      district: '',
      ward: '',
      locationSource: item.isCustom ? 'custom' : 'directory',
      administrativeDivisionId: '',
      latitude: item.isCustom ? null : current.latitude,
      longitude: item.isCustom ? null : current.longitude,
    }));
    setLocationIds({ countryId: item.id || '', stateId: '', cityId: '', districtId: '', wardId: '' });
    setProfileWarning(item.isCustom ? 'Custom country selected. Please verify map coordinates manually.' : '');
  }

  function selectState(item) {
    setProfileDraft(current => ({
      ...current,
      stateProvince: item.name,
      city: item.divisionType === 'municipality' ? item.name : '',
      district: '',
      ward: '',
      timezone: item.timezone || current.timezone,
      locationSource: item.isCustom ? 'custom' : 'directory',
      administrativeDivisionId: item.isCustom ? '' : item.id,
      latitude: item.isCustom ? null : item.latitude ?? current.latitude,
      longitude: item.isCustom ? null : item.longitude ?? current.longitude,
    }));
    setLocationIds(ids => ({ ...ids, stateId: item.isCustom ? '' : item.id, cityId: item.isCustom ? '' : item.id, districtId: '', wardId: '' }));
    setProfileWarning(item.isCustom ? 'Custom state/province selected. Please verify map coordinates manually.' : '');
  }

  function selectCity(item) {
    setProfileDraft(current => ({
      ...current,
      city: item.name,
      district: '',
      ward: '',
      timezone: item.timezone || current.timezone,
      locationSource: item.isCustom ? 'custom' : 'directory',
      administrativeDivisionId: item.isCustom ? '' : item.id,
      latitude: item.isCustom ? null : item.latitude ?? current.latitude,
      longitude: item.isCustom ? null : item.longitude ?? current.longitude,
    }));
    setLocationIds(ids => ({ ...ids, cityId: item.isCustom ? '' : item.id, districtId: '', wardId: '' }));
    setProfileWarning(item.isCustom ? 'Custom city selected. Please verify map coordinates manually.' : '');
  }

  function selectDistrict(item) {
    setProfileDraft(current => ({
      ...current,
      district: item.name,
      ward: '',
      timezone: item.timezone || current.timezone,
      locationSource: item.isCustom ? 'custom' : 'directory',
      administrativeDivisionId: item.isCustom ? '' : item.id,
      latitude: item.isCustom ? null : item.latitude ?? current.latitude,
      longitude: item.isCustom ? null : item.longitude ?? current.longitude,
    }));
    setLocationIds(ids => ({ ...ids, districtId: item.isCustom ? '' : item.id, wardId: '' }));
    setProfileWarning(item.isCustom ? 'Custom district selected. Please verify map coordinates manually.' : '');
  }

  function selectWard(item) {
    setProfileDraft(current => ({
      ...current,
      ward: item.name,
      timezone: item.timezone || current.timezone,
      locationSource: item.isCustom ? 'custom' : 'directory',
      administrativeDivisionId: item.isCustom ? current.administrativeDivisionId || '' : item.id,
      latitude: item.isCustom ? null : item.latitude ?? current.latitude,
      longitude: item.isCustom ? null : item.longitude ?? current.longitude,
    }));
    setLocationIds(ids => ({ ...ids, wardId: item.isCustom ? '' : item.id }));
    setProfileWarning(item.isCustom ? 'Custom ward selected. Please verify map coordinates manually.' : '');
  }

  function validateProfile() {
    const latitude = coerceNumberOrNull(profileDraft.latitude);
    const longitude = coerceNumberOrNull(profileDraft.longitude);
    if (!String(profileDraft.countryName || '').trim()) return 'Country is required.';
    if (!String(profileDraft.currencyCode || '').trim()) return 'Currency is required.';
    if (!String(profileDraft.city || '').trim()) return 'City is required.';
    if (profileDraft.mapVisibility !== false && !String(profileDraft.streetAddress || '').trim()) return 'Street address is required when the store is visible on the public map.';
    if (latitude !== null && (latitude < -90 || latitude > 90)) return 'Latitude must be between -90 and 90.';
    if (longitude !== null && (longitude < -180 || longitude > 180)) return 'Longitude must be between -180 and 180.';
    if (profileDraft.mapVisibility !== false && (latitude === null || longitude === null)) {
      return 'Latitude and longitude are missing. Turn off map visibility or enter coordinates manually before saving.';
    }
    return '';
  }

  async function submitProfile(event) {
    event.preventDefault();
    setProfileMessage('');
    setProfileWarning('');
    if (!requireWalletAccess()) return;
    const validationError = validateProfile();
    if (validationError) {
      setProfileWarning(validationError);
      return;
    }
    const payload = {
      ...profileDraft,
      latitude: coerceNumberOrNull(profileDraft.latitude),
      longitude: coerceNumberOrNull(profileDraft.longitude),
      locationSource: profileDraft.locationSource || 'custom',
      administrativeDivisionId: locationIds.wardId || locationIds.districtId || locationIds.cityId || locationIds.stateId || profileDraft.administrativeDivisionId || '',
    };
    await onUpdateStore?.(payload);
    setProfileMessage('Store address saved.');
  }

  function locateAddress() {
    setProfileWarning('Geocoding backend is not connected yet. Full address is prepared below; enter latitude and longitude manually for now.');
  }

  function copyStoreLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/s/${store.slug}?source=store_qr`);
  }

  function downloadQrPoster() {
    const target = `${window.location.origin}/s/${store.slug}?source=store_qr`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960"><rect width="100%" height="100%" fill="#ffffff"/><text x="48" y="90" font-family="Arial" font-size="42" font-weight="700" fill="#111827">${store.name}</text><rect x="180" y="170" width="360" height="360" fill="#111827"/><rect x="220" y="210" width="92" height="92" fill="#ffffff"/><rect x="408" y="210" width="92" height="92" fill="#ffffff"/><rect x="220" y="398" width="92" height="92" fill="#ffffff"/><text x="48" y="610" font-family="Arial" font-size="26" fill="#374151">Open this NetPay store:</text><text x="48" y="660" font-family="Arial" font-size="20" fill="#5b35f5">${target}</text><text x="48" y="725" font-family="Arial" font-size="18" fill="#64748b">QR poster placeholder. Install a QR generator before printing for production.</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${store.slug || 'store'}-netpay-qr-poster.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function runAgent() {
    const prompt = agentText.trim();
    if (!prompt) return;
    setAgentBusy(true);
    setAgentReply('');
    try {
      const result = await runStoreAgent({ prompt, store, actorWallet: wallet?.address || '' });
      setAgentReply(result.answer);
    } catch (error) {
      setAgentReply(error.message || 'Agent request failed.');
    } finally {
      setAgentBusy(false);
    }
  }

  async function confirmManualOrder(order) {
    if (!requireWalletAccess()) return;
    if (!['cash', 'bank_transfer', 'bank'].includes(order.paymentMethod)) {
      setWalletError('Only cash and bank transfer orders can be confirmed manually.');
      return;
    }
    setConfirmingOrderId(order.id);
    setWalletError('');
    try {
      await onConfirmOrder?.(order.id, wallet.address);
    } catch (error) {
      setWalletError(error.message || 'Cannot confirm payment.');
    } finally {
      setConfirmingOrderId('');
    }
  }

  return (
    <main className="mobile-stage">
      <section className="phone-shell store-phone">
        <header className="phone-top">
          <div>
            <small>{walletAllowed ? 'Store wallet verified' : 'Store wallet required'}</small>
            <strong>{store.name}</strong>
          </div>
          <button className="mobile-icon-button" type="button" onClick={connectStoreWallet} title="Connect store wallet">
            <Wallet size={18} />
          </button>
        </header>

        <label className="store-picker">
          Store
          <select value={store.id} onChange={event => onSelectStore(event.target.value)}>
            {stores.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <div className="mobile-wallet-status">
          <span>{wallet?.address ? shortAddress(wallet.address) : 'No wallet connected'}</span>
          <strong>{walletAllowed ? 'Access granted' : 'Read-only preview'}</strong>
        </div>
        {walletError && <p className="mobile-error">{walletError}</p>}

        <div className="phone-scroll">
          {tab === 'home' && (
            <>
              <section className="store-wallet-card">
                <small>Direct settlement wallet</small>
                <strong>{shortAddress(store.ownerWallet)}</strong>
                <span>USDC goes directly to this wallet on Arc.</span>
              </section>
              <div className="mobile-stats">
                <article><ShoppingBag /><strong>{todayOrders.length}</strong><span>Orders today</span></article>
                <article><CircleDollarSign /><strong>{usdcSales.toFixed(2)}</strong><span>USDC sales</span></article>
                <article><PackagePlus /><strong>{lowStock}</strong><span>Low stock</span></article>
              </div>
              <button className="mobile-action" onClick={() => { if (requireWalletAccess()) { setDraft(blankProduct); setTab('edit'); } }}><Plus />Add product to NetPay<ChevronRight /></button>
              <button className="mobile-action" onClick={() => setTab('products')}><ShoppingBag />Manage listed products<ChevronRight /></button>
              <button className="mobile-action" onClick={() => setTab('orders')}><CircleDollarSign />View orders and payments<ChevronRight /></button>
              <button className="mobile-action" onClick={() => setTab('qr')}><QrCode />Store QR storefront<ChevronRight /></button>
              <button className="mobile-action" onClick={() => { setProfileDraft(store); setTab('profile'); }}><MapPin />Store profile, address and visibility<ChevronRight /></button>
              <button className="mobile-action" onClick={() => setTab('payments')}><Wallet />Payment methods<ChevronRight /></button>
              <button className="mobile-action" onClick={() => { refreshRatePreview(); setTab('rate'); }}><CircleDollarSign />Exchange rate preview<ChevronRight /></button>
            </>
          )}

          {tab === 'products' && (
            <section>
              <div className="mobile-section-head">
                <div><small>NetPay catalog</small><h2>{store.products.length} listed products</h2></div>
                <button onClick={() => { if (requireWalletAccess()) { setDraft(blankProduct); setTab('edit'); } }}><Plus /></button>
              </div>
              {store.products.map(product => (
                <article className="mobile-product-row" key={product.id}>
                  <div className="product-thumb">{product.image ? <img src={product.image} alt="" /> : <Camera />}</div>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatLocalCurrency(product.localPrice ?? minorToLocal(product.localPriceMinor, store.currencyDecimals), store)} - {product.listedQuantity} available</span>
                    <small>{product.sku}</small>
                  </div>
                  <div className="row-actions">
                    <button disabled={!canManage} onClick={() => onSaveProduct({ ...product, visible: !product.visible, active: !product.visible })}>{product.visible ? <Eye /> : <EyeOff />}</button>
                    <button disabled={!canManage} onClick={() => { setDraft(product); setTab('edit'); }}>Edit</button>
                  </div>
                </article>
              ))}
              {!canManage && <div className="mobile-lock-note"><Lock size={14} /> Connect an assigned store wallet to edit products.</div>}
            </section>
          )}

          {tab === 'edit' && draft && (
            <form className="mobile-form" onSubmit={submitProduct}>
              <div className="mobile-section-head"><div><small>Selected inventory only</small><h2>{draft.id ? 'Edit product' : 'Add product'}</h2></div></div>
              <label className="image-drop"><Camera /><span>Upload or take product photo</span><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) setDraft({ ...draft, image: URL.createObjectURL(file) }); }} /></label>
              <label>Product name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
              <div className="form-two"><label>Code / SKU<input value={draft.sku} onChange={event => setDraft({ ...draft, sku: event.target.value })} /></label><label>Barcode<input value={draft.barcode || ''} onChange={event => setDraft({ ...draft, barcode: event.target.value })} /></label></div>
              <div className="form-two"><label>Price ({store.currencyCode})<input type="number" step={store.currencyDecimals ? '0.01' : '1'} value={draft.localPrice ?? minorToLocal(draft.localPriceMinor, store.currencyDecimals)} onChange={event => setDraft({ ...draft, localPrice: event.target.value })} /></label><label>NetPay quantity<input type="number" min="0" value={draft.listedQuantity} onChange={event => setDraft({ ...draft, listedQuantity: event.target.value })} /></label></div>
              <label>Category<input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></label>
              <label>Description<textarea value={draft.description || ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
              <label className="toggle-line"><input type="checkbox" checked={draft.visible} onChange={event => setDraft({ ...draft, visible: event.target.checked })} />Visible in QR storefront</label>
              <button className="primary-mobile" type="submit"><Save />Save product</button>
              {draft.id && <button type="button" className="danger-mobile" onClick={() => { if (requireWalletAccess()) { onDeleteProduct(draft.id); setTab('products'); } }}><Trash2 />Remove from NetPay</button>}
            </form>
          )}

          {tab === 'orders' && (
            <section>
              <div className="mobile-section-head"><div><small>Store operations</small><h2>Orders</h2></div></div>
              <h3>Orders awaiting confirmation</h3>
              {!awaitingOrders.length && <div className="empty-mobile">No cash or bank transfer orders are waiting right now.</div>}
              {awaitingOrders.map(order => (
                <article className="order-card confirm-order-card" key={`await-${order.id}`}>
                  <div><strong>{order.code || order.id}</strong><span>{order.items?.length || 0} items</span></div>
                  <div><strong>{formatLocalCurrency(minorToLocal(order.totalLocal ?? order.total, store.currencyDecimals), store)}</strong><span>{order.paymentMethod} - {order.paymentStatus}</span></div>
                  <button type="button" disabled={!canManage || confirmingOrderId === order.id} onClick={() => confirmManualOrder(order)}>
                    {confirmingOrderId === order.id ? 'Confirming...' : 'Confirm paid'}
                  </button>
                </article>
              ))}
              <h3>All orders</h3>
              {!todayOrders.length && <div className="empty-mobile">No orders yet. Customer orders will appear here.</div>}
              {todayOrders.map(order => <article className="order-card" key={order.id}><div><strong>{order.id}</strong><span>{order.items?.length || 0} items</span></div><div><strong>{order.totalUsdc ? formatUsdc(order.totalUsdc) : formatLocalCurrency(minorToLocal(order.totalLocal ?? order.total, store.currencyDecimals), store)}</strong><span>{order.paymentMethod} - {order.paymentStatus}</span></div></article>)}
            </section>
          )}

          {tab === 'qr' && <section className="qr-mobile"><small>Customer entry point</small><h2>{store.name}</h2><div className="fake-qr"><span>NP</span></div><p>Target: exact store catalog with QR source tracking.</p><code>{window.location.origin}/s/{store.slug}?source=store_qr</code><button className="primary-mobile" type="button" onClick={copyStoreLink}><Copy />Copy link</button><button className="mobile-action" type="button" onClick={downloadQrPoster}><QrCode />Download QR poster SVG<ChevronRight /></button><button className="mobile-action" type="button" onClick={() => window.print()}><QrCode />Print storefront QR<ChevronRight /></button></section>}

          {tab === 'profile' && (
            <form className="mobile-form location-form" onSubmit={submitProfile}>
              <div className="mobile-section-head"><div><small>Store profile</small><h2>Address and map</h2></div></div>
              <label>Slug<input value={profileDraft.slug || ''} onChange={event => setProfileDraft({ ...profileDraft, slug: event.target.value })} /></label>
              <div className="form-two">
                <SearchableCombobox label="Country" value={profileDraft.countryName || ''} placeholder="Search country" loadOptions={searchCountries} onSelect={selectCountry} />
                <label>Currency<input value={profileDraft.currencyCode || ''} onChange={event => setProfileDraft({ ...profileDraft, currencyCode: event.target.value.toUpperCase() })} /></label>
              </div>
              <div className="form-two">
                <SearchableCombobox label="State/Province" value={profileDraft.stateProvince || ''} placeholder="Search state or province" disabled={!profileDraft.countryCode} loadOptions={query => searchDivisions({ countryCode: profileDraft.countryCode, level: 1, query })} onSelect={selectState} />
                <SearchableCombobox label="City" value={profileDraft.city || ''} placeholder="Search city" disabled={!profileDraft.countryCode} loadOptions={query => searchDivisions({ countryCode: profileDraft.countryCode, parentId: locationIds.stateId || null, level: locationIds.stateId ? null : 1, query })} onSelect={selectCity} />
              </div>
              <div className="form-two">
                <SearchableCombobox label="District" value={profileDraft.district || ''} placeholder="Search district" disabled={!profileDraft.countryCode || !(locationIds.cityId || locationIds.stateId)} loadOptions={query => searchDivisions({ countryCode: profileDraft.countryCode, parentId: locationIds.cityId || locationIds.stateId, level: 2, query })} onSelect={selectDistrict} />
                <SearchableCombobox label="Ward" value={profileDraft.ward || ''} placeholder="Search ward" disabled={!profileDraft.countryCode || !locationIds.districtId} loadOptions={query => searchDivisions({ countryCode: profileDraft.countryCode, parentId: locationIds.districtId, level: 3, query })} onSelect={selectWard} />
              </div>
              <label>Street address<input value={profileDraft.streetAddress || ''} onChange={event => setProfileDraft({ ...profileDraft, streetAddress: event.target.value })} /></label>
              <div className="form-two"><label>Postal code<input value={profileDraft.postalCode || ''} onChange={event => setProfileDraft({ ...profileDraft, postalCode: event.target.value })} /></label><label>Timezone<input value={profileDraft.timezone || ''} onChange={event => setProfileDraft({ ...profileDraft, timezone: event.target.value })} /></label></div>
              <div className="form-two"><label>Latitude<input type="number" step="0.000001" value={profileDraft.latitude ?? ''} onChange={event => setProfileDraft({ ...profileDraft, latitude: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Longitude<input type="number" step="0.000001" value={profileDraft.longitude ?? ''} onChange={event => setProfileDraft({ ...profileDraft, longitude: event.target.value === '' ? null : Number(event.target.value) })} /></label></div>
              <label>Phone<input value={profileDraft.phone || ''} onChange={event => setProfileDraft({ ...profileDraft, phone: event.target.value })} /></label>
              <label className="toggle-line"><input type="checkbox" checked={profileDraft.mapVisibility !== false} onChange={event => setProfileDraft({ ...profileDraft, mapVisibility: event.target.checked })} />Visible on public map</label>
              <section className="address-preview">
                <small>Full address</small>
                <strong>{buildFullAddress(profileDraft) || 'Choose location and enter street address'}</strong>
                <span>Source: {profileDraft.locationSource || 'custom'}</span>
              </section>
              {profileWarning && <p className="location-warning"><AlertTriangle size={15} />{profileWarning}</p>}
              {profileMessage && <p className="location-success">{profileMessage}</p>}
              {!canManage && <div className="mobile-lock-note"><Lock size={14} /> Read-only preview. Connect an owner or assigned staff wallet to save.</div>}
              <button className="mobile-action" type="button" onClick={locateAddress}><LocateFixed />Locate address<ChevronRight /></button>
              <button className="mobile-action" type="button" disabled><MapPin />Use map pin<ChevronRight /></button>
              <button className="primary-mobile" type="submit" disabled={!canManage}><Save />{canManage ? 'Save profile' : 'Connect wallet to save'}</button>
            </form>
          )}

          {tab === 'payments' && (
            <section>
              <div className="mobile-section-head"><div><small>Payment methods</small><h2>Store settlement</h2></div></div>
              {(store.paymentMethods || []).map(method => <article className="order-card" key={method.method}><div><strong>{method.method}</strong><span>{method.isEnabled === false ? 'Disabled' : 'Enabled'}</span></div><div><strong>{shortAddress(method.arcWalletAddress || method.bankAccountNumber || store.receiverWallet)}</strong><span>{method.bankName || method.cashInstructions || 'Arc USDC wallet'}</span></div></article>)}
              {!store.paymentMethods?.length && <div className="empty-mobile">No payment methods configured yet.</div>}
            </section>
          )}

          {tab === 'rate' && (
            <section>
              <div className="mobile-section-head"><div><small>Exchange rate preview</small><h2>USDC to {store.currencyCode}</h2></div></div>
              {rateError && <p className="mobile-error">{rateError}</p>}
              {ratePreview ? <div className="store-wallet-card"><small>{ratePreview.provider} - {ratePreview.status}</small><strong>1 USDC = {formatLocalCurrency(ratePreview.rate, store)}</strong><span>Fetched {new Date(ratePreview.fetched_at).toLocaleString()}</span></div> : <div className="empty-mobile">Loading exchange rate from Supabase Edge Function.</div>}
              <button className="primary-mobile" type="button" onClick={refreshRatePreview}>Refresh rate</button>
            </section>
          )}

          {tab === 'agent' && (
            <section>
              <div className="mobile-section-head"><div><small>Store Management Agent</small><h2>Ask NetPay</h2></div><Bot /></div>
              <div className="agent-panel">
                <textarea value={agentText} onChange={event => setAgentText(event.target.value)} placeholder="Example: Which products are low stock?" />
                <button type="button" onClick={runAgent} disabled={agentBusy}>{agentBusy ? 'Thinking...' : 'Run read-only request'}</button>
                {agentReply && <p>{agentReply}</p>}
              </div>
            </section>
          )}
        </div>

        <nav className="mobile-nav">
          <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Home</button>
          <button className={tab === 'products' || tab === 'edit' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
          <button className={tab === 'agent' ? 'active' : ''} onClick={() => setTab('agent')}>Agent</button>
        </nav>
      </section>
    </main>
  );
}
