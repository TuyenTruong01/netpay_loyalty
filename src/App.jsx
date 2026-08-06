import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import ProductModal from './components/ProductModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import BestSellersPage from './pages/BestSellersPage.jsx';
import CustomerCheckoutPage from './pages/CustomerCheckoutPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import POSPage from './pages/POSPage.jsx';
import PointsHistoryPage from './pages/PointsHistoryPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage.jsx';
import RewardsPage from './pages/RewardsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SystemAdminPage from './pages/SystemAdminPage.jsx';
import WarehousePage from './pages/WarehousePage.jsx';
import StoreMobilePage from './pages/StoreMobilePage.jsx';
import CustomerStorefrontPage from './pages/CustomerStorefrontPage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';
import StoreMapPage from './pages/StoreMapPage.jsx';
import { connectEvmWallet } from './services/evmWallet.js';
import { getPaymentChain } from './chains/index.js';
import {
  addWarehouseRecord,
  confirmCheckoutPayment,
  confirmStorefrontManualPayment,
  createCheckoutOrder,
  createStorefrontOrder,
  createStoreRecord,
  loadCheckoutPaymentStatus,
  loadPaynetNetwork,
  saveProductRecord,
  updateProductStatusRecord,
  updateStoreOwnerRecord,
  updateStoreRecord,
  updateStoreLocationRecord,
  updateStoreStatusRecord,
  updateWarehouseStatusRecord,
} from './services/paynetService.js';
import { hasSupabaseConfig } from './lib/supabaseClient.js';
import { pointsFromRaw, rawFromPoints, rawFromUSDC, toUSDC } from './utils/format.js';
import { apointUnitsFromUsdc, convertLocalToUsdc, localToMinor, minorToLocal } from './services/exchangeRateService.js';
import {
  buildStoreState,
  initialNetworkStores,
  normalizeWallet,
  resolveNetworkRole,
} from './utils/storeNetwork.js';

function firstActiveStore(stores = []) {
  return stores.find(store => store.status !== 'disabled') || stores[0] || null;
}

function titleCaseRole(role = 'cashier') {
  return role === 'owner' ? 'Owner' : role.charAt(0).toUpperCase() + role.slice(1);
}

function isStoreOwnerRole(roleKey = '') {
  return ['store_owner', 'owner'].includes(roleKey);
}

function connectChainCode(store = {}) {
  const code = String(store?.networkCode || '').toLowerCase();
  if (code.includes('arc')) return 'arc-testnet';
  if (code.includes('avalanche') || code.includes('fuji') || code.includes('avax')) return 'avalanche';
  return code || 'arc-testnet';
}

function ensureStoreProducts(store) {
  return Array.isArray(store?.products) ? store.products : [];
}

function uniqueText(values = []) {
  return values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function slugifyStoreName(name = '') {
  return String(name || 'new-store')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-store';
}

function defaultCountryFields(store = {}) {
  return {
    slug: store.slug || slugifyStoreName(store.name || store.id || 'store'),
    countryCode: store.countryCode || store.country_code || 'VN',
    countryName: store.countryName || store.country_name || 'Vietnam',
    currencyCode: store.currencyCode || store.currency_code || 'VND',
    currencySymbol: store.currencySymbol || store.currency_symbol || 'd',
    currencyDecimals: Number(store.currencyDecimals ?? store.currency_decimals ?? 0),
    stateProvince: store.stateProvince || store.state_province || '',
    city: store.city || 'Da Nang',
    district: store.district || '',
    ward: store.ward || '',
    streetAddress: store.streetAddress || store.street_address || store.branch || '',
    postalCode: store.postalCode || store.postal_code || '',
    latitude: store.latitude ?? null,
    longitude: store.longitude ?? null,
    timezone: store.timezone || 'Asia/Ho_Chi_Minh',
    phone: store.phone || '',
    openingHours: store.openingHours || store.opening_hours || {},
    mapVisibility: store.mapVisibility ?? store.map_visibility ?? true,
    isActive: store.isActive ?? store.is_active ?? store.status !== 'disabled',
    locationSource: store.locationSource || store.location_source || 'custom',
    administrativeDivisionId: store.administrativeDivisionId || store.administrative_division_id || '',
  };
}

const OWNER_ALLOWED_PAGES = [
  'dashboard',
  'pos',
  'orders',
  'customers',
  'products',
  'inventory',
  'points',
  'rewards',
  'warehouse',
  'receiving',
  'best-sellers',
  'settings',
];
const SYSTEM_ADMIN_ALLOWED_PAGES = [
  'admin',
  'dashboard',
  'settings',
  'orders',
  'customers',
  'points',
  'products',
  'best-sellers',
];
const CHECKOUT_STORAGE_KEY = 'paynet.pendingCheckouts';
const DEMO_WALLET_LABEL = 'demo-session';

function readStoredCheckouts() {
  try {
    return JSON.parse(window.localStorage.getItem(CHECKOUT_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredCheckout(order) {
  const current = readStoredCheckouts().filter(item => item.checkoutToken !== order.checkoutToken);
  window.localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify([order, ...current].slice(0, 80)));
}

function encodeDemoCheckout(order) {
  const payload = {
    ...order,
    checkoutToken: '',
  };
  const json = JSON.stringify(payload);
  const encoded = window.btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `demo-${encoded}`;
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [stores, setStores] = useState(initialNetworkStores);
  const [networkCustomers, setNetworkCustomers] = useState([]);
  const [networkPointsHistory, setNetworkPointsHistory] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(initialNetworkStores[0]?.id || '');
  const [connected, setConnected] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [currentWallet, setCurrentWallet] = useState('');
  const [dbMessage, setDbMessage] = useState('Frontend multi-store mode. Supabase schema can be connected after the UI is approved.');

  const [invoiceActive, setInvoiceActive] = useState(false);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('C001');
  const [activeCategory, setActiveCategory] = useState('All');
  const [productSearch, setProductSearch] = useState('');
  const [pointsUsed, setPointsUsed] = useState(0);
  const [checkout, setCheckout] = useState(null);
  const [checkoutPayment, setCheckoutPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [editingProduct, setEditingProduct] = useState(null);
  const [mobileCart, setMobileCart] = useState([]);

  async function reloadNetwork() {
    if (!hasSupabaseConfig) {
      setDbMessage('Supabase is not configured. Using local demo data.');
      return;
    }

    try {
      const result = await loadPaynetNetwork();
      if (result?.stores?.length) {
        const accessStores = result.stores;
        setStores(accessStores);
        setNetworkCustomers(result.customers || []);
        setNetworkPointsHistory(result.pointsHistory || []);
        setSelectedStoreId(current => accessStores.some(store => store.id === current) ? current : accessStores[0].id);
        setDbMessage(`Connected to Supabase. Loaded ${accessStores.length} stores.`);
      }
    } catch (error) {
      console.error(error);
      setDbMessage(`Supabase error: ${error.message || error}. Using local fallback data.`);
    }
  }

  useEffect(() => {
    reloadNetwork();
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !checkout?.order_id) {
      return undefined;
    }

    let cancelled = false;
    let timer = null;

    async function refreshCheckoutPayment() {
      try {
        const status = await loadCheckoutPaymentStatus(checkout.order_id);
        if (cancelled || !status) return;

        setCheckoutPayment(status);

        if (status.paymentStatus === 'paid' || status.status === 'paid') {
          setPaymentStatus('paid');
          if (timer) window.clearInterval(timer);
          await reloadNetwork();
          return;
        }

        setPaymentStatus('pending');
      } catch (error) {
        console.warn('Cannot refresh checkout payment status:', error.message || error);
        if (!cancelled) setPaymentStatus('pending');
      }
    }

    setPaymentStatus('checking');
    refreshCheckoutPayment();
    timer = window.setInterval(refreshCheckoutPayment, 2500);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [checkout?.order_id]);

  const roleContext = useMemo(
    () => resolveNetworkRole(
      stores,
      currentWallet,
    ),
    [stores, currentWallet]
  );

  const isSystemAdmin = connected && !demoMode && roleContext.roleKey === 'system_admin';
  const isGuest = connected && !demoMode && roleContext.roleKey === 'guest';
  const roleStore = roleContext.store;
  const allowedPages = useMemo(() => {
    if (demoMode) return ['dashboard', 'pos', 'orders', 'customers'];
    if (isSystemAdmin) return SYSTEM_ADMIN_ALLOWED_PAGES;
    if (isGuest || !connected) return [];
    if (isStoreOwnerRole(roleContext.roleKey)) return OWNER_ALLOWED_PAGES;
    return [];
  }, [connected, demoMode, isGuest, isSystemAdmin, roleContext.roleKey]);

  useEffect(() => {
    if (demoMode) {
      setPage(current => ['dashboard', 'pos', 'orders', 'customers'].includes(current) ? current : 'pos');
      setSelectedStoreId(current => current || firstActiveStore(stores)?.id || '');
      return;
    }

    if (!connected || !currentWallet) return;

    if (roleContext.roleKey === 'system_admin') {
      setPage(current => current === 'dashboard' ? 'admin' : current || 'admin');
      setSelectedStoreId(current => current || firstActiveStore(stores)?.id || '');
      return;
    }

    if (roleStore?.id) {
      setSelectedStoreId(roleStore.id);
      setPage(current => {
        return OWNER_ALLOWED_PAGES.includes(current) ? current : 'dashboard';
      });
      return;
    }

    if (roleContext.roleKey === 'guest') {
      setPage('dashboard');
    }
  }, [connected, currentWallet, demoMode, roleContext.roleKey, roleStore?.id, stores]);

  useEffect(() => {
    if (!connected || demoMode || isGuest || !allowedPages.length) return;
    if (!allowedPages.includes(page)) {
      setPage(allowedPages[0]);
    }
  }, [allowedPages, connected, demoMode, isGuest, page]);

  const activeStore = useMemo(() => {
    if (!stores.length) return null;
    if (isGuest) return null;
    return stores.find(store => store.id === selectedStoreId) || firstActiveStore(stores);
  }, [stores, selectedStoreId, isGuest]);

  const data = useMemo(
    () => activeStore ? buildStoreState(activeStore) : buildStoreState(firstActiveStore(initialNetworkStores)),
    [activeStore]
  );

  const activeStaff = roleContext.member;
  const displayStaff = demoMode
    ? { name: 'Demo Mode', role: 'Demo', roleKey: 'demo', wallet: 'Local demo session', avatar: 'DM' }
    : activeStaff || { name: 'Not connected', role: 'Guest', roleKey: 'guest', wallet: currentWallet, avatar: 'U' };
  const isStoreOwner = isStoreOwnerRole(roleContext.roleKey);
  const canManageStore = isSystemAdmin || isStoreOwner;
  const canUsePos = demoMode || (connected && Boolean(activeStore) && activeStore.status !== 'disabled' && roleContext.roleKey !== 'guest');
  const isManager = canManageStore;
  const posLockMessage = demoMode
    ? ''
    : !connected
    ? 'Connect or preview an approved wallet to create invoices.'
    : activeStore?.status === 'disabled'
      ? 'This store is disabled by the system admin.'
      : roleContext.roleKey === 'guest'
        ? 'This wallet is not assigned to any participating store.'
        : '';

  const customers = networkCustomers.length ? networkCustomers : data.customers;
  const visibleStores = isSystemAdmin ? stores : activeStore ? [activeStore] : [];
  const safeReceiverWallet = isGuest ? '' : data.receiverWallet;
  const selectedCustomer = customers.find(customer => customer.id === customerId) || customers[0] || null;
  const cartRows = useMemo(() => cart.map(item => {
    const product = ensureStoreProducts(activeStore).find(row => row.id === item.id);
    return product ? { ...product, qty: item.qty } : null;
  }).filter(Boolean), [cart, activeStore]);

  const taxRate = Number(data.settings?.taxRate || 10);
  const subtotal = cartRows.reduce((sum, row) => sum + row.price * row.qty, 0);
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const grossTotal = subtotal + taxAmount;
  const pointsDiscount = rawFromPoints(pointsUsed);
  const total = Math.max(grossTotal - pointsDiscount, 0);
  const pointsEarned = pointsFromRaw(total);

  function updateActiveStore(updater) {
    setStores(current => current.map(store => {
      if (store.id !== activeStore?.id) return store;
      return updater(store);
    }));
  }

  function requireStoreAccess(actionName = 'perform this action') {
    if (!canUsePos) {
      alert(posLockMessage || `Cannot ${actionName}.`);
      return false;
    }
    return true;
  }

  function createNewInvoice() {
    if (!requireStoreAccess('create an invoice')) return;
    setInvoiceActive(true);
    setCart([]);
    setCheckout(null);
    setCheckoutPayment(null);
    setPaymentStatus('idle');
    setPointsUsed(0);
    setProductSearch('');
  }

  function addToCart(product) {
    if (!requireStoreAccess('add products to an invoice')) return;
    if (!invoiceActive) setInvoiceActive(true);
    setCheckout(null);
    setCheckoutPayment(null);
    setPaymentStatus('idle');
    setCart(current => {
      const exists = current.find(item => item.id === product.id);
      if (exists) return current.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...current, { id: product.id, qty: 1 }];
    });
  }

  function changeQty(productId, delta) {
    if (!requireStoreAccess('edit invoice quantity')) return;
    setCart(current => current.map(item => item.id === productId ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  }

  function removeItem(productId) {
    if (!requireStoreAccess('remove products from an invoice')) return;
    setCart(current => current.filter(item => item.id !== productId));
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return;
    const product = data.products.find(item => [item.name, item.sku, item.barcode].join(' ').toLowerCase().includes(keyword));
    if (product) {
      addToCart(product);
      setProductSearch('');
    }
  }

  async function handleCreateCheckout() {
    if (!requireStoreAccess('create a checkout order')) return;
    if (!cartRows.length) return;

    let order = null;

    if (hasSupabaseConfig && !demoMode) {
      try {
        order = await createCheckoutOrder({
          store: activeStore,
          staff: activeStaff,
          customer: selectedCustomer,
          cartRows,
          subtotal,
          taxRate,
          taxAmount,
          pointsUsed,
          pointsDiscount,
          total,
        });
      } catch (error) {
        console.error(error);
        alert(error.message || 'Cannot create checkout in Supabase.');
        return;
      }
    } else {
      const token = `${activeStore.id}-${Date.now().toString(16)}`;
      order = {
        order_id: `demo-${token}`,
        order_code: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`,
        checkout_token: token,
      };
    }

    let pendingOrder = {
      id: order.order_id,
      code: order.order_code,
      checkoutToken: order.checkout_token,
      isDemo: demoMode || String(order.order_id).startsWith('demo'),
      storeId: activeStore.id,
      storeName: activeStore.name,
      storeBranch: activeStore.branch,
      receiverWallet: activeStore.ownerWallet,
      customer: selectedCustomer?.name || 'Guest',
      customerWallet: selectedCustomer?.wallet || '',
      subtotal,
      taxAmount,
      taxRate,
      pointsUsed,
      pointsDiscount,
      total,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'usdc',
      createdAt: new Date().toISOString(),
      items: cartRows.map(row => ({
        id: row.id,
        productId: row.id,
        name: row.name,
        sku: row.sku,
        qty: row.qty,
        unitPrice: row.price,
        total: row.price * row.qty,
      })),
    };

    if (demoMode) {
      const demoToken = encodeDemoCheckout(pendingOrder);
      order = {
        ...order,
        checkout_token: demoToken,
      };
      pendingOrder = {
        ...pendingOrder,
        id: order.order_id,
        checkoutToken: demoToken,
        checkout_token: demoToken,
      };
    }

    saveStoredCheckout(pendingOrder);
    setCheckout(order);
    setCheckoutPayment(null);
    setPaymentStatus('pending');
    if (hasSupabaseConfig) await reloadNetwork();
  }

  async function handleConfirmMockPayment() {
    if (!requireStoreAccess('confirm payment')) return;
    if (!checkout) return;
    setPaymentStatus('checking');

    if (hasSupabaseConfig && !demoMode && checkout.order_id && !String(checkout.order_id).startsWith('demo')) {
      try {
        await confirmCheckoutPayment({
          orderId: checkout.order_id,
          payerWallet: selectedCustomer?.wallet || '',
          txHash: '',
          rawResponse: {
            mode: 'manual-cash-payment',
            receiver_wallet: activeStore?.ownerWallet || '',
            payable_raw: total,
            redeemed_points: pointsUsed,
            redeemed_value_raw: pointsDiscount,
            earned_points: pointsEarned,
            wallet_customer_id: selectedCustomer?.id || null,
            wallet_address: selectedCustomer?.wallet || '',
          },
        });

        const status = await loadCheckoutPaymentStatus(checkout.order_id);
        setCheckoutPayment(status);
        setPaymentStatus('paid');
        await reloadNetwork();
        setCart([]);
        setInvoiceActive(false);
        return;
      } catch (error) {
        console.error(error);
        setPaymentStatus('pending');
        alert(error.message || 'Cannot confirm cash payment.');
        return;
      }
    }

    const paidOrder = {
      id: checkout.order_id,
      code: checkout.order_code,
      checkoutToken: checkout.checkout_token,
      storeId: activeStore.id,
      customer: selectedCustomer?.name || 'Guest',
      customerWallet: selectedCustomer?.wallet || '',
      subtotal,
      pointsUsed,
      pointsDiscount,
      total,
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: 'arc',
      isDemo: demoMode,
      txHash: `0xmock${Date.now().toString(16)}`,
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      items: cartRows.map(row => ({ id: row.id, productId: row.id, name: row.name, sku: row.sku, qty: row.qty, unitPrice: row.price, total: row.price * row.qty })),
    };

    if (!demoMode) {
      updateActiveStore(store => ({
        ...store,
        orders: [paidOrder, ...(store.orders || [])],
        products: store.products.map(product => {
          const cartItem = cartRows.find(item => item.id === product.id);
          return cartItem ? { ...product, stock: Math.max(0, Number(product.stock || 0) - Number(cartItem.qty || 0)) } : product;
        }),
      }));
    }

    saveStoredCheckout(paidOrder);

    setPaymentStatus('paid');
    setCart([]);
    setInvoiceActive(false);
  }

  async function deleteProduct(productId) {
    if (!canManageStore) return alert('Only the system admin or store owner can edit products.');
    if (!confirm('Disable this product from POS?')) return;
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === productId ? { ...product, active: false } : product),
    }));
    if (hasSupabaseConfig) {
      updateProductStatusRecord(productId, 'inactive').then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  async function saveProduct(product) {
    if (!canManageStore) return alert('Only the system admin or store owner can edit products.');

    const isNew = product === 'new' || !product.id;
    const id = isNew ? `${activeStore.id.slice(-3).toUpperCase()}-${Date.now().toString().slice(-5)}` : product.id;
    const normalized = {
      ...product,
      id,
      stock: Number(product.stock || 0),
      min: Number(product.min || 0),
      price: Number(product.price || 0),
      costPrice: Number(product.costPrice || 0),
      active: product.active !== false,
      status: product.status || (product.active === false ? 'inactive' : 'active'),
    };

    updateActiveStore(store => {
      const exists = store.products.some(item => item.id === id);
      const nextProducts = exists
        ? store.products.map(item => item.id === id ? normalized : item)
        : [normalized, ...store.products];

      return {
        ...store,
        categories: uniqueText(['All', ...(store.categories || []), normalized.category]),
        products: nextProducts,
      };
    });
    setEditingProduct(null);
    if (hasSupabaseConfig) {
      try {
        await saveProductRecord(activeStore.id, normalized);
        await reloadNetwork();
      } catch (error) {
        alert(error.message || error);
      }
    }
  }


  async function handleConnectWallet() {
    try {
      const wallet = await connectEvmWallet(getPaymentChain(connectChainCode(activeStore)));
      setDemoMode(false);
      setCurrentWallet(wallet.address);
      setConnected(true);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Cannot connect wallet.');
    }
  }

  function handleStartDemo() {
    setDemoMode(true);
    setConnected(true);
    setCurrentWallet(DEMO_WALLET_LABEL);
    setPage('pos');
    setSelectedStoreId(current => current || firstActiveStore(stores)?.id || '');
    setInvoiceActive(false);
    setCart([]);
    setCheckout(null);
    setCheckoutPayment(null);
    setPaymentStatus('idle');
    setPointsUsed(0);
  }

  function handleSignOut() {
    setConnected(false);
    setDemoMode(false);
    setCurrentWallet('');
    setPage('admin');
    setInvoiceActive(false);
    setCart([]);
    setCheckout(null);
    setCheckoutPayment(null);
    setPaymentStatus('idle');
    setPointsUsed(0);
  }

  function handleAddStore(draft) {
    const id = `store-${Date.now().toString(16)}`;
    const storeSlug = slugifyStoreName(draft.name);
    const newStore = {
      id,
      name: draft.name.trim(),
      branch: draft.branch.trim() || 'Main Branch',
      type: draft.type,
      status: 'active',
      accent: '#2563eb',
      imageFolder: `/png/stores/${storeSlug}/products`,
      ownerWallet: draft.ownerWallet.trim(),
      receiverWallet: draft.ownerWallet.trim(),
      categories: ['All', 'Popular', 'Food', 'Drinks'],
      warehouses: [{ id: `${id}-main`, name: 'Main Store', address: draft.branch.trim() || 'Main Branch', status: 'active', active: true }],
      products: [],
      orders: [],
    };
    setStores(current => [newStore, ...current]);
    setSelectedStoreId(id);
    if (hasSupabaseConfig) {
      createStoreRecord(draft).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateStore(storeId, draft) {
    setStores(current => current.map(store => {
      if (store.id !== storeId) return store;

      return {
        ...store,
        name: draft.name,
        branch: draft.branch,
        type: draft.type,
        status: draft.status,
        ownerWallet: draft.ownerWallet,
        receiverWallet: draft.ownerWallet,
        imageFolder: store.imageFolder || `/png/stores/${slugifyStoreName(draft.name)}/products`,
      };
    }));
    if (hasSupabaseConfig) {
      updateStoreRecord(storeId, draft).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleToggleStoreStatus(storeId) {
    const store = stores.find(item => item.id === storeId);
    const nextStatus = store?.status === 'disabled' ? 'active' : 'disabled';
    setStores(current => current.map(store => store.id === storeId
      ? { ...store, status: nextStatus }
      : store));
    if (hasSupabaseConfig) {
      updateStoreStatusRecord(storeId, nextStatus).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateStoreOwner(storeId, wallet) {
    setStores(current => current.map(store => {
      if (store.id !== storeId) return store;
      return {
        ...store,
        ownerWallet: wallet,
        receiverWallet: wallet,
      };
    }));
    if (hasSupabaseConfig) {
      updateStoreOwnerRecord(storeId, wallet).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateProductStatus(productId, status) {
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === productId
        ? { ...product, status, active: status === 'active' }
        : product),
    }));
    if (hasSupabaseConfig) {
      updateProductStatusRecord(productId, status).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleAddWarehouse(draft) {
    updateActiveStore(store => ({
      ...store,
      warehouses: [
        {
          id: `${store.id}-warehouse-${Date.now().toString(16)}`,
          name: draft.name.trim(),
          address: draft.address.trim(),
          status: draft.status || 'active',
          active: draft.status === 'active',
        },
        ...(store.warehouses || []),
      ],
    }));
    if (hasSupabaseConfig) {
      addWarehouseRecord(activeStore.id, draft).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleUpdateWarehouseStatus(warehouseId, status) {
    updateActiveStore(store => ({
      ...store,
      warehouses: (store.warehouses || []).map(warehouse => warehouse.id === warehouseId
        ? { ...warehouse, status, active: status === 'active' }
        : warehouse),
    }));
    if (hasSupabaseConfig) {
      updateWarehouseStatusRecord(warehouseId, status).then(reloadNetwork).catch(error => alert(error.message || error));
    }
  }

  function handleAddInventoryProduct(draft) {
    const warehouse = (activeStore.warehouses || []).find(item => item.id === draft.warehouseId);
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === draft.productId
        ? {
            ...product,
            stock: Number(draft.quantity || 0),
            min: Number(draft.min || 0),
            warehouseId: draft.warehouseId,
            warehouse: warehouse?.name || product.warehouse,
          }
        : product),
    }));
  }

  function handleUpdateInventoryWarehouse(productId, warehouseId) {
    const warehouse = (activeStore.warehouses || []).find(item => item.id === warehouseId);
    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === productId
        ? { ...product, warehouseId, warehouse: warehouse?.name || product.warehouse }
        : product),
    }));
  }

  function handleDeleteInventoryItem(productId) {
    if (!canManageStore) return alert('Only the system admin or store owner can delete inventory items.');
    if (!confirm('Delete this inventory row from the current view? The product catalog record will be kept.')) return;

    updateActiveStore(store => ({
      ...store,
      products: store.products.map(product => product.id === productId
        ? { ...product, inventoryHidden: true, stock: 0, min: 0, warehouseId: '', warehouse: '' }
        : product),
    }));
  }

  function mobileStoreView(store) {
    if (!store) return null;
    const geo = defaultCountryFields(store);
    return {
      ...store,
      ...geo,
      paymentMethods: store.paymentMethods?.length ? store.paymentMethods : [
        { method: 'usdc_arc', isEnabled: true, arcWalletAddress: store.ownerWallet || '' },
        { method: 'bank_transfer', isEnabled: true, bankName: 'Store bank', bankAccountName: store.name || '', bankAccountNumber: '' },
        { method: 'cash', isEnabled: true, cashInstructions: 'Pay at counter. Store owner confirms after receiving cash.' },
      ],
      products: ensureStoreProducts(store).map(product => ({
        ...product,
        localPriceMinor: Number(product.localPriceMinor ?? product.price ?? 0),
        localPrice: Number(product.localPrice ?? minorToLocal(product.localPriceMinor ?? product.price ?? 0, geo.currencyDecimals)),
        currencyCode: product.currencyCode || geo.currencyCode,
        priceUsdc: product.priceUsdc === null || product.priceUsdc === undefined ? null : Number(product.priceUsdc),
        listedQuantity: Number(product.listedQuantity ?? product.stock ?? 0),
        visible: product.visible ?? product.active !== false,
      })),
      orders: store.orders || [],
    };
  }

  function saveMobileProduct(product) {
    if (!activeStore) return;
    const geo = defaultCountryFields(activeStore);
    const id = product.id || `${activeStore.id}-mobile-${Date.now()}`;
    const localPriceMinor = Number(product.localPriceMinor ?? localToMinor(product.localPrice ?? 0, geo.currencyDecimals));
    const normalized = {
      ...product,
      id,
      price: localPriceMinor,
      localPriceMinor,
      localPrice: minorToLocal(localPriceMinor, geo.currencyDecimals),
      currencyCode: geo.currencyCode,
      priceUsdc: product.priceUsdc === null || product.priceUsdc === undefined ? null : Number(product.priceUsdc || 0),
      stock: Number(product.listedQuantity || 0),
      listedQuantity: Number(product.listedQuantity || 0),
      active: product.visible !== false,
      visible: product.visible !== false,
      status: product.visible === false ? 'inactive' : 'active',
    };
    updateActiveStore(store => {
      const exists = ensureStoreProducts(store).some(item => item.id === id);
      return {
        ...store,
        products: exists
          ? ensureStoreProducts(store).map(item => item.id === id ? { ...item, ...normalized } : item)
          : [normalized, ...ensureStoreProducts(store)],
      };
    });
  }

  function deleteMobileProduct(productId) {
    if (!activeStore) return;
    updateActiveStore(store => ({
      ...store,
      products: ensureStoreProducts(store).filter(item => item.id !== productId),
    }));
  }

  async function updateMobileStore(patch) {
    if (!activeStore) return;
    updateActiveStore(store => ({ ...store, ...patch }));
    if (hasSupabaseConfig && patch?.id) {
      try {
        await updateStoreLocationRecord(patch.id, patch);
        await reloadNetwork();
      } catch (error) {
        alert(error.message || 'Cannot save store location.');
      }
    }
  }

  async function placeMobileOrder(storeForOrder, paymentMethod, pointAmount = 0, snapshot = {}) {
    const orderStore = storeForOrder || activeStore;
    if (!orderStore || !mobileCart.length) return null;
    const geo = defaultCountryFields(orderStore);
    const normalizedMethod = paymentMethod === 'usdc' ? 'usdc_arc' : paymentMethod === 'bank' ? 'bank_transfer' : paymentMethod;
    const subtotalLocal = Number(snapshot.subtotal_local ?? mobileCart.reduce((sum, line) => sum + Number(line.localPriceMinor ?? line.price ?? 0) * Number(line.quantity || 0), 0));
    const discountLocal = Number(snapshot.discount_local ?? 0);
    const taxLocal = Number(snapshot.tax_local ?? 0);
    const totalLocal = Number(snapshot.total_local ?? Math.max(0, subtotalLocal + taxLocal - discountLocal));
    const rate = Number(snapshot.exchange_rate || 0);
    const totalUsdc = Number(snapshot.total_usdc ?? (rate > 0 ? convertLocalToUsdc(minorToLocal(totalLocal, geo.currencyDecimals), rate) : 0));
    const apointUnits = Number(snapshot.apoint_units ?? apointUnitsFromUsdc(totalUsdc));
    const apointEligible = snapshot.apoint_eligible !== false && totalUsdc > 0;
    const pointDiscount = normalizedMethod === 'usdc_arc' ? Number(pointAmount || 0) : 0;
    if (hasSupabaseConfig) {
      const created = await createStorefrontOrder({
        store: orderStore,
        cartRows: mobileCart,
        paymentMethod: normalizedMethod,
        customerWallet: snapshot.customer_wallet || '',
        pointsUsed: pointDiscount,
        snapshot: {
          ...snapshot,
          local_currency: geo.currencyCode,
          subtotal_local: subtotalLocal,
          discount_local: discountLocal,
          tax_local: taxLocal,
          total_local: totalLocal,
          total_usdc: totalUsdc,
          apoint_units: apointUnits,
          apoint_eligible: apointEligible,
        },
      });
      const order = {
        id: created.order_id,
        code: created.order_code,
        checkoutToken: created.checkout_token,
        createdAt: new Date().toISOString(),
        items: mobileCart,
        paymentMethod: normalizedMethod,
        localCurrency: geo.currencyCode,
        subtotalLocal,
        discountLocal,
        taxLocal,
        totalLocal,
        exchangeRate: rate || null,
        exchangeRateBase: snapshot.exchange_rate_base || 'USDC',
        exchangeRateQuote: snapshot.exchange_rate_quote || geo.currencyCode,
        exchangeRateProvider: snapshot.exchange_rate_provider || '',
        exchangeRateFetchedAt: snapshot.exchange_rate_fetched_at || '',
        exchangeRateExpiresAt: snapshot.exchange_rate_expires_at || '',
        subtotal: subtotalLocal,
        pointsUsed: normalizedMethod === 'usdc_arc' ? pointDiscount : 0,
        pointsDiscount: pointDiscount,
        total: totalUsdc,
        totalUsdc,
        apointEligible,
        apointUnits,
        apointAwarded: false,
        paymentStatus: created.payment_status,
        status: created.status,
      };
      setStores(current => current.map(store => store.id === orderStore.id ? { ...store, orders: [order, ...(store.orders || [])] } : store));
      setMobileCart([]);
      return order;
    }

    const order = {
      id: `ORD-${String(Date.now()).slice(-6)}`,
      code: `ORD-${String(Date.now()).slice(-6)}`,
      createdAt: new Date().toISOString(),
      items: mobileCart,
      paymentMethod: normalizedMethod,
      localCurrency: geo.currencyCode,
      subtotalLocal,
      discountLocal,
      taxLocal,
      totalLocal,
      exchangeRate: rate || null,
      exchangeRateBase: snapshot.exchange_rate_base || 'USDC',
      exchangeRateQuote: snapshot.exchange_rate_quote || geo.currencyCode,
      exchangeRateProvider: snapshot.exchange_rate_provider || '',
      exchangeRateFetchedAt: snapshot.exchange_rate_fetched_at || '',
      exchangeRateExpiresAt: snapshot.exchange_rate_expires_at || '',
      subtotal: subtotalLocal,
      pointsUsed: normalizedMethod === 'usdc_arc' ? pointDiscount : 0,
      pointsDiscount: pointDiscount,
      total: totalUsdc,
      totalUsdc,
      apointEligible,
      apointUnits,
      apointAwarded: false,
      paymentStatus: normalizedMethod === 'usdc_arc' ? 'pending' : 'awaiting_confirmation',
      status: normalizedMethod === 'usdc_arc' ? 'awaiting_payment' : 'awaiting_confirmation',
    };
    setStores(current => current.map(store => store.id === orderStore.id ? { ...store, orders: [order, ...(store.orders || [])] } : store));
    setMobileCart([]);
    return order;
  }

  async function confirmMobileOrder(orderId, actorWallet) {
    if (!orderId || !actorWallet) return null;
    if (hasSupabaseConfig) {
      const result = await confirmStorefrontManualPayment({ orderId, actorWallet, note: 'Confirmed in store mobile' });
      await reloadNetwork();
      return result;
    }
    const paidAt = new Date().toISOString();
    updateActiveStore(store => ({
      ...store,
      orders: (store.orders || []).map(order => order.id === orderId
        ? { ...order, status: 'paid', paymentStatus: 'confirmed', paidAt, apointAwarded: true }
        : order),
    }));
    return { status: 'confirmed' };
  }

  function renderPage() {
    if (isGuest) {
      return (
        <section className="panel full-page-panel locked-access-panel">
          <div className="locked-box">
            <strong>Wallet has no store access</strong>
            <span>This wallet is not assigned as a system admin or store owner wallet.</span>
          </div>
        </section>
      );
    }

    if (connected && allowedPages.length && !allowedPages.includes(page)) {
      return (
        <section className="panel full-page-panel locked-access-panel">
          <div className="locked-box">
            <strong>Role access required</strong>
            <span>This wallet does not have permission to open this section.</span>
          </div>
        </section>
      );
    }

    const activeProducts = data.products.filter(product => (product.status || (product.active === false ? 'inactive' : 'active')) === 'active');
    const common = {
      products: activeProducts,
      customers,
      orders: activeStore?.orders || [],
      inventory: data.inventory || [],
      warehouses: data.warehouses || [],
      purchaseOrders: data.purchaseOrders || [],
      settings: data.settings || {},
      store: data.store,
      receiverWallet: safeReceiverWallet,
      taxRate,
      isManager,
    };

    if (page === 'admin') {
      return (
        <SystemAdminPage
          stores={stores}
          selectedStoreId={selectedStoreId}
          onSelectStore={setSelectedStoreId}
          onAddStore={handleAddStore}
          onUpdateStore={handleUpdateStore}
          onToggleStoreStatus={handleToggleStoreStatus}
          onUpdateStoreOwner={handleUpdateStoreOwner}
          currentWallet={currentWallet}
        />
      );
    }
    if (page === 'dashboard') return <DashboardPage {...common} />;
    if (page === 'orders') return <OrdersPage {...common} />;
    if (page === 'customers') return <CustomersPage customers={customers} />;
    if (page === 'products') return <ProductsPage products={data.products} setEditingProduct={setEditingProduct} canManage={canManageStore} onUpdateProductStatus={handleUpdateProductStatus} onDeleteProduct={deleteProduct} />;
    if (page === 'inventory') return <InventoryPage products={data.products} warehouses={data.warehouses || []} inventory={data.inventory || []} canManage={canManageStore} onAddInventoryProduct={handleAddInventoryProduct} onUpdateInventoryWarehouse={handleUpdateInventoryWarehouse} onDeleteInventoryItem={handleDeleteInventoryItem} />;
    if (page === 'points') {
      return (
        <PointsHistoryPage
          pointsHistory={isSystemAdmin ? networkPointsHistory : data.pointsHistory}
          stores={visibleStores}
          scopeLabel={isSystemAdmin ? 'Network Analytics' : 'Store Analytics'}
        />
      );
    }
    if (page === 'rewards') return <RewardsPage settings={data.settings || {}} />;
    if (page === 'warehouse') return <WarehousePage warehouses={data.warehouses || []} inventory={data.inventory || []} canManage={canManageStore} onAddWarehouse={handleAddWarehouse} onUpdateWarehouseStatus={handleUpdateWarehouseStatus} />;
    if (page === 'receiving') return <PurchaseOrdersPage purchaseOrders={data.purchaseOrders || []} />;
    if (page === 'best-sellers') return <BestSellersPage orders={activeStore?.orders || []} products={common.products} />;
    if (page === 'settings') return <SettingsPage store={data.store} receiverWallet={safeReceiverWallet} settings={data.settings || {}} canViewWallet={!isGuest} />;
    if (page === 'pos') {
      return (
        <POSPage
          invoiceActive={invoiceActive}
          canUsePos={canUsePos}
          posLockMessage={posLockMessage}
          onCreateInvoice={createNewInvoice}
          cartRows={cartRows}
          customers={customers}
          customerId={customerId}
          setCustomerId={setCustomerId}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          onSearchSubmit={handleSearchSubmit}
          changeQty={changeQty}
          removeItem={removeItem}
          subtotal={subtotal}
          taxRate={taxRate}
          taxAmount={taxAmount}
          grossTotal={grossTotal}
          pointsUsed={pointsUsed}
          setPointsUsed={setPointsUsed}
          pointsDiscount={pointsDiscount}
          total={total}
          pointsEarned={pointsEarned}
          selectedCustomer={selectedCustomer}
          onCreateCheckout={handleCreateCheckout}
          onConfirmMockPayment={handleConfirmMockPayment}
          checkout={checkout}
          checkoutPayment={checkoutPayment}
          paymentStatus={paymentStatus}
          receiverWallet={safeReceiverWallet}
          products={common.products}
          categories={data.categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          query={query}
          addToCart={addToCart}
          setEditingProduct={setEditingProduct}
          deleteProduct={deleteProduct}
          canManage={canManageStore}
        />
      );
    }

    return <DashboardPage {...common} />;
  }

  const mobileStores = stores.map(mobileStoreView).filter(Boolean);
  const slugFromPath = decodeURIComponent(window.location.pathname.replace(/^\/s\//, '').split('/')[0] || '');
  const storeFromSlug = mobileStores.find(store => store.slug === slugFromPath || String(store.id) === slugFromPath);
  const mobileStore = storeFromSlug || mobileStoreView(activeStore || firstActiveStore(stores));

  if (window.location.pathname.startsWith('/explore')) {
    return (
      <>
        <div className="mobile-demo-toolbar">
          <a href="/">Admin</a>
          <strong>Explore</strong>
          <a href="/map">Map</a>
          <a href="/store-mobile">Store Mobile</a>
        </div>
        <ExplorePage stores={mobileStores} onSelectStore={setSelectedStoreId} />
      </>
    );
  }

  if (window.location.pathname.startsWith('/map')) {
    return (
      <>
        <div className="mobile-demo-toolbar">
          <a href="/">Admin</a>
          <a href="/explore">Explore</a>
          <strong>Map</strong>
          <a href="/shop">Customer</a>
        </div>
        <StoreMapPage stores={mobileStores} onSelectStore={setSelectedStoreId} />
      </>
    );
  }

  if (window.location.pathname.startsWith('/store-mobile')) {
    return (
      <>
        <div className="mobile-demo-toolbar">
          <a href="/">Admin</a>
          <strong>Store Mobile</strong>
          <a href="/explore">Explore</a>
          <a href="/shop">Customer</a>
        </div>
        <StoreMobilePage
          store={mobileStore}
          stores={mobileStores}
          onSelectStore={setSelectedStoreId}
          onSaveProduct={saveMobileProduct}
          onDeleteProduct={deleteMobileProduct}
          onUpdateStore={updateMobileStore}
          onConfirmOrder={confirmMobileOrder}
        />
      </>
    );
  }

  if (window.location.pathname.startsWith('/shop') || window.location.pathname.startsWith('/store/') || window.location.pathname.startsWith('/s/')) {
    return (
      <>
        <div className="mobile-demo-toolbar">
          <a href="/">Admin</a>
          <a href="/explore">Explore</a>
          <a href="/map">Map</a>
          <a href="/store-mobile">Store Mobile</a>
          <strong>Customer</strong>
        </div>
        <CustomerStorefrontPage
          store={mobileStore}
          stores={mobileStores}
          onSelectStore={setSelectedStoreId}
          cart={mobileCart}
          setCart={setMobileCart}
          onPlaceOrder={(paymentMethod, pointAmount, snapshot) => placeMobileOrder(mobileStore, paymentMethod, pointAmount, snapshot)}
        />
      </>
    );
  }

  if (window.location.pathname.startsWith('/checkout')) {
    return (
      <CustomerCheckoutPage
        demoOrders={stores.flatMap(store => store.orders || [])}
        settings={data.settings || {}}
        store={data.store}
        receiverWallet={safeReceiverWallet}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onPageChange={setPage}
        store={data.store}
        stores={stores}
        selectedStoreId={selectedStoreId}
        onStoreChange={setSelectedStoreId}
        isSystemAdmin={isSystemAdmin}
        isGuest={isGuest}
        connected={connected}
        demoMode={demoMode}
      />
      <main className="main-shell">
        <Header
          query={query}
          setQuery={setQuery}
          connected={connected}
          onConnect={handleConnectWallet}
          onDemo={handleStartDemo}
          onSignOut={handleSignOut}
          staff={displayStaff}
          currentWallet={currentWallet}
          isManager={isManager}
          network={data.store.network}
          roleLabel={demoMode ? 'Demo Mode: local checkout preview' : roleContext.label}
        />
        <StatusBanner message={dbMessage} onReload={reloadNetwork} />
        <div className="content-shell">
          {renderPage()}
        </div>
      </main>

      {editingProduct && canManageStore && (
        <ProductModal
          product={editingProduct}
          categories={data.categories}
          units={uniqueText(data.products.map(product => product.unit || 'unit'))}
          usedCategories={uniqueText(data.products.map(product => product.category))}
          usedUnits={uniqueText(data.products.map(product => product.unit || 'unit'))}
          onClose={() => setEditingProduct(null)}
          onSave={saveProduct}
        />
      )}
    </div>
  );
}
