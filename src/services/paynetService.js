import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';
import { pointsFromRaw, rawFromUSDC } from '../utils/format.js';

function rows(result) {
  if (result?.error) throw result.error;
  return Array.isArray(result?.data) ? result.data : [];
}

function one(result) {
  if (result?.error) throw result.error;
  return result?.data || null;
}

function roleLabel(role = 'cashier') {
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  if (role === 'warehouse') return 'Warehouse';
  if (role === 'accountant') return 'Accountant';
  return 'Cashier';
}

function mapStaff(row) {
  return {
    id: row.id,
    name: row.full_name,
    role: roleLabel(row.role),
    roleKey: row.role,
    wallet: row.wallet_address,
    avatar: row.avatar || (row.role === 'owner' ? 'SO' : 'ST'),
    active: row.is_active !== false,
  };
}

function mapProduct(row, warehouseMap = {}) {
  const warehouse = warehouseMap[row.id] || null;
  const localPriceMinor = Number(row.local_price_minor ?? row.sell_price ?? 0);
  const currencyDecimals = Number(row.currency_decimals ?? 0);
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode || '',
    category: row.category || 'Other',
    unit: row.unit || 'unit',
    price: localPriceMinor,
    localPriceMinor,
    localPrice: localPriceMinor / Math.pow(10, currencyDecimals),
    currencyCode: row.currency_code || '',
    priceUsdc: row.price_usdc === null || row.price_usdc === undefined ? null : Number(row.price_usdc),
    costPrice: Number(row.cost_price || 0),
    stock: Number(row.stock_quantity || 0),
    min: Number(row.min_stock || 0),
    image: row.image_url || '',
    emoji: '',
    description: row.description || '',
    status: row.status || 'active',
    active: row.status === 'active',
    visible: row.visible !== false && row.status !== 'inactive',
    warehouseId: warehouse?.warehouseId || '',
    warehouse: warehouse?.warehouse || '',
  };
}

function mapWarehouse(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address || '',
    status: row.status || 'active',
    active: row.status === 'active',
  };
}

function mapOrder(row) {
  const latestPayment = row.payments?.[0] || null;
  return {
    id: row.id,
    code: row.code,
    checkoutToken: row.checkout_token,
    storeId: row.store_id,
    customer: row.customer_wallet || 'Guest',
    customerWallet: row.customer_wallet || '',
    subtotal: Number(row.subtotal || 0),
    localCurrency: row.local_currency || '',
    subtotalLocal: Number(row.subtotal_local ?? row.subtotal ?? 0),
    discountLocal: Number(row.discount_local ?? row.discount_amount ?? 0),
    taxLocal: Number(row.tax_local ?? row.tax_amount ?? 0),
    totalLocal: Number(row.total_local ?? row.total_amount ?? 0),
    exchangeRate: row.exchange_rate === null || row.exchange_rate === undefined ? null : Number(row.exchange_rate),
    exchangeRateBase: row.exchange_rate_base || 'USDC',
    exchangeRateQuote: row.exchange_rate_quote || row.local_currency || '',
    exchangeRateProvider: row.exchange_rate_provider || '',
    exchangeRateFetchedAt: row.exchange_rate_fetched_at || '',
    exchangeRateExpiresAt: row.exchange_rate_expires_at || '',
    totalUsdc: row.total_usdc === null || row.total_usdc === undefined ? Number(row.total_amount || 0) : Number(row.total_usdc),
    apointEligible: row.apoint_eligible !== false,
    apointUnits: Number(row.apoint_units || 0),
    apointAwarded: row.apoint_awarded === true,
    apointAwardedAt: row.apoint_awarded_at || '',
    apointTransactionId: row.apoint_transaction_id || '',
    taxAmount: Number(row.tax_amount || 0),
    taxRate: Number(row.tax_rate || 10),
    pointsUsed: Number(row.apoints_redeemed || 0),
    pointsDiscount: Number(row.discount_amount || 0),
    total: Number(row.total_amount || 0),
    status: row.status || 'pending',
    paymentStatus: row.payment_status || 'pending',
    paymentMethod: row.payment_method || latestPayment?.method || 'usdc_arc',
    txHash: latestPayment?.tx_hash || '',
    proofTxHash: latestPayment?.proof_tx_hash || latestPayment?.raw_response?.proof_tx_hash || '',
    createdAt: row.created_at,
    paidAt: row.paid_at,
    items: (row.order_items || []).map(item => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      sku: item.sku,
      qty: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      total: Number(item.total_price || 0),
    })),
  };
}

function storeCategories(products = []) {
  return ['All', ...products.map(product => product.category).filter(Boolean)]
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

function normalizePaymentMethod(method = 'usdc_arc') {
  if (method === 'usdc') return 'usdc_arc';
  if (method === 'bank') return 'bank_transfer';
  return ['usdc_arc', 'bank_transfer', 'cash'].includes(method) ? method : 'usdc_arc';
}

function paymentStatusForMethod(method) {
  if (method === 'usdc_arc') return { status: 'awaiting_payment', paymentStatus: 'pending_onchain', paymentRowStatus: 'pending' };
  return { status: 'awaiting_confirmation', paymentStatus: 'awaiting_confirmation', paymentRowStatus: 'awaiting_confirmation' };
}

function paymentMethodWallet(method = {}, store = {}) {
  return method.arc_wallet_address || method.receiver_wallet || store.receiverWallet || store.ownerWallet || '';
}

async function findStorePaymentMethod(store, methodName) {
  const normalized = normalizePaymentMethod(methodName);
  const selected = (store.paymentMethods || []).find(item => item.method === normalized);
  if (selected) return selected;

  if (!hasSupabaseConfig || !supabase || !store?.id) return null;

  const method = one(await supabase
    .from('store_payment_methods')
    .select('*, payment_networks(*), payment_tokens(*)')
    .eq('store_id', store.id)
    .eq('method', normalized)
    .maybeSingle());

  return method;
}

async function insertAuditLog({ actorWallet = '', action, entityType, entityId, metadata = {} }) {
  if (!hasSupabaseConfig || !supabase) return;
  try {
    await supabase.from('audit_logs').insert({
      actor_wallet: actorWallet || null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      metadata,
    });
  } catch (error) {
    console.warn('Cannot write audit log:', error.message || error);
  }
}

async function syncStoreDefaultPaymentReceiver(storeId, receiverWallet) {
  if (!storeId || !receiverWallet) return;

  const network = one(await supabase.from('payment_networks').select('id').eq('code', 'arc-testnet').maybeSingle());
  if (!network?.id) return;

  const token = one(await supabase
    .from('payment_tokens')
    .select('id')
    .eq('network_id', network.id)
    .eq('symbol', 'USDC')
    .maybeSingle());

  if (!token?.id) return;

  await supabase.from('store_payment_methods').upsert({
    store_id: storeId,
    network_id: network.id,
    token_id: token.id,
    receiver_wallet: receiverWallet,
    method: 'usdc_arc',
    is_enabled: true,
    arc_wallet_address: receiverWallet,
    is_default: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'store_id,method' });
}

export async function loadPaynetNetwork() {
  if (!hasSupabaseConfig || !supabase) return null;

  const [
    storeTypeRows,
    storeRows,
    staffRows,
    productRows,
    warehouseRows,
    inventoryRows,
    orderRows,
    customerRows,
    pointRows,
  ] = await Promise.all([
    supabase.from('store_types').select('*').order('sort_order'),
    supabase.from('stores').select('*, store_types(name, code), store_payment_methods(*)').order('created_at'),
    supabase.from('store_staff').select('*').order('created_at'),
    supabase.from('products').select('*').order('name'),
    supabase.from('warehouses').select('*').order('created_at'),
    supabase.from('inventory').select('*, warehouses(name)').order('updated_at'),
    supabase.from('orders').select('*, order_items(*), payments(*)').order('created_at', { ascending: false }),
    supabase.from('customers').select('*').order('total_spent', { ascending: false }),
    supabase.from('apoint_ledger').select('*').order('created_at', { ascending: false }),
  ]);

  const storeTypes = rows(storeTypeRows);
  const staff = rows(staffRows);
  const products = rows(productRows);
  const warehouses = rows(warehouseRows);
  const inventory = rows(inventoryRows);
  const orders = rows(orderRows);
  const customers = rows(customerRows).map(row => ({
    id: row.id,
    name: row.full_name || 'Wallet Customer',
    wallet: row.wallet_address,
    points: Number(row.point_balance || 0),
    totalSpent: Number(row.total_spent || 0),
    createdAt: row.created_at,
  }));
  const pointsHistory = rows(pointRows);

  const warehouseByProduct = Object.fromEntries(inventory.map(row => [
    row.product_id,
    {
      warehouseId: row.warehouse_id,
      warehouse: row.warehouses?.name || '',
      quantity: Number(row.quantity || 0),
      min: Number(row.min_quantity || 0),
    },
  ]));

  const stores = rows(storeRows).map(store => {
    const storeProducts = products.filter(product => product.store_id === store.id).map(product => mapProduct(product, warehouseByProduct));
    const paymentMethods = (store.store_payment_methods || []).map(method => ({
      id: method.id,
      method: method.method || 'usdc_arc',
      isEnabled: method.is_enabled !== false,
      bankName: method.bank_name || '',
      bankAccountName: method.bank_account_name || '',
      bankAccountNumber: method.bank_account_number || '',
      bankQrImage: method.bank_qr_image || '',
      arcWalletAddress: method.arc_wallet_address || store.receiver_wallet || '',
      cashInstructions: method.cash_instructions || '',
    }));
    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      branch: store.branch,
      type: store.store_types?.name || 'Store',
      status: store.status,
      isActive: store.is_active !== false && store.status !== 'disabled',
      accent: store.accent || '#2563eb',
      imageFolder: store.image_folder,
      ownerWallet: store.owner_wallet,
      receiverWallet: store.receiver_wallet,
      countryCode: store.country_code || 'VN',
      countryName: store.country_name || 'Vietnam',
      currencyCode: store.currency_code || 'VND',
      currencySymbol: store.currency_symbol || 'd',
      currencyDecimals: Number(store.currency_decimals ?? 0),
      stateProvince: store.state_province || '',
      city: store.city || '',
      district: store.district || '',
      ward: store.ward || '',
      streetAddress: store.street_address || store.branch || '',
      postalCode: store.postal_code || '',
      latitude: store.latitude === null || store.latitude === undefined ? null : Number(store.latitude),
      longitude: store.longitude === null || store.longitude === undefined ? null : Number(store.longitude),
      timezone: store.timezone || 'Asia/Ho_Chi_Minh',
      phone: store.phone || '',
      openingHours: store.opening_hours || {},
      mapVisibility: store.map_visibility !== false,
      locationSource: store.location_source || 'custom',
      administrativeDivisionId: store.administrative_division_id || '',
      paymentMethods,
      staffMembers: staff.filter(member => member.store_id === store.id).map(mapStaff),
      categories: storeCategories(storeProducts),
      warehouses: warehouses.filter(warehouse => warehouse.store_id === store.id).map(mapWarehouse),
      products: storeProducts,
      orders: orders.filter(order => order.store_id === store.id).map(mapOrder),
      pointsHistory: pointsHistory.filter(point => point.store_id === store.id),
    };
  });

  return { stores, storeTypes, customers, pointsHistory };
}

export async function createStoreRecord(draft) {
  const slug = String(draft.name || 'new-store').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'new-store';
  const type = one(await supabase.from('store_types').select('id').eq('name', draft.type).maybeSingle());
  const payload = {
    slug,
    name: draft.name.trim(),
    branch: draft.branch?.trim() || 'Main Branch',
    store_type_id: type?.id || null,
    owner_wallet: draft.ownerWallet.trim(),
    receiver_wallet: draft.ownerWallet.trim(),
    image_folder: `/png/stores/${slug}/products`,
    status: 'active',
  };
  const store = one(await supabase.from('stores').insert(payload).select('*').single());
  await supabase.from('store_staff').insert({
    store_id: store.id,
    full_name: `${store.name} Owner`,
    role: 'owner',
    wallet_address: store.owner_wallet,
    avatar: 'SO',
  });
  await supabase.from('warehouses').insert({
    store_id: store.id,
    name: 'Main Store',
    address: store.branch,
    status: 'active',
  });
  await syncStoreDefaultPaymentReceiver(store.id, store.owner_wallet);
  return store;
}

export async function updateStoreRecord(storeId, draft) {
  const type = one(await supabase.from('store_types').select('id').eq('name', draft.type).maybeSingle());
  const ownerWallet = draft.ownerWallet.trim();
  const store = one(await supabase.from('stores').update({
    name: draft.name,
    branch: draft.branch,
    store_type_id: type?.id || null,
    status: draft.status,
    owner_wallet: ownerWallet,
    receiver_wallet: ownerWallet,
    updated_at: new Date().toISOString(),
  }).eq('id', storeId).select('*').single());
  await syncStoreDefaultPaymentReceiver(storeId, ownerWallet);
  return store;
}

export async function updateStoreLocationRecord(storeId, draft) {
  const payload = {
    country_code: draft.countryCode || draft.country_code || null,
    country_name: draft.countryName || draft.country_name || null,
    currency_code: draft.currencyCode || draft.currency_code || null,
    currency_symbol: draft.currencySymbol || draft.currency_symbol || null,
    currency_decimals: Number(draft.currencyDecimals ?? draft.currency_decimals ?? 0),
    state_province: draft.stateProvince || draft.state_province || null,
    city: draft.city || null,
    district: draft.district || null,
    ward: draft.ward || null,
    street_address: draft.streetAddress || draft.street_address || null,
    postal_code: draft.postalCode || draft.postal_code || null,
    latitude: draft.latitude === '' || draft.latitude === null || draft.latitude === undefined ? null : Number(draft.latitude),
    longitude: draft.longitude === '' || draft.longitude === null || draft.longitude === undefined ? null : Number(draft.longitude),
    timezone: draft.timezone || null,
    phone: draft.phone || null,
    map_visibility: draft.mapVisibility !== false,
    location_source: draft.locationSource || draft.location_source || 'custom',
    administrative_division_id: draft.administrativeDivisionId || draft.administrative_division_id || null,
    updated_at: new Date().toISOString(),
  };
  return one(await supabase.from('stores').update(payload).eq('id', storeId).select('*').single());
}

export async function updateStoreOwnerRecord(storeId, ownerWallet) {
  const wallet = ownerWallet.trim();
  const updatedAt = new Date().toISOString();
  const store = one(await supabase.from('stores').update({
    owner_wallet: wallet,
    receiver_wallet: wallet,
    updated_at: updatedAt,
  }).eq('id', storeId).select('*').single());

  await supabase.from('store_staff').upsert({
    store_id: storeId,
    full_name: `${store.name} Owner`,
    role: 'owner',
    wallet_address: wallet,
    avatar: 'SO',
    is_active: true,
    updated_at: updatedAt,
  }, { onConflict: 'store_id,wallet_address' });

  await syncStoreDefaultPaymentReceiver(storeId, wallet);
  return store;
}

export async function updateStoreStatusRecord(storeId, status) {
  return one(await supabase.from('stores').update({ status, updated_at: new Date().toISOString() }).eq('id', storeId).select('*').single());
}

export async function saveStaffRecord(storeId, staffDraft) {
  const payload = {
    store_id: storeId,
    full_name: staffDraft.name.trim(),
    role: staffDraft.role,
    wallet_address: staffDraft.wallet.trim(),
    is_active: staffDraft.active !== false,
    avatar: staffDraft.role === 'owner' ? 'SO' : 'ST',
    updated_at: new Date().toISOString(),
  };
  if (staffDraft.id && !String(staffDraft.id).startsWith('staff-')) {
    return one(await supabase.from('store_staff').update(payload).eq('id', staffDraft.id).select('*').single());
  }
  return one(await supabase.from('store_staff').insert(payload).select('*').single());
}

export async function disableStaffRecord(staffId) {
  return one(await supabase.from('store_staff').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', staffId).select('*').single());
}

export async function saveProductRecord(storeId, product) {
  const payload = {
    store_id: storeId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode || null,
    category: product.category || 'Other',
    unit: product.unit || 'unit',
    sell_price: Number(product.price || 0),
    cost_price: Number(product.costPrice || 0),
    stock_quantity: Number(product.stock || 0),
    min_stock: Number(product.min || 0),
    image_url: product.image || '',
    description: product.description || '',
    status: product.status || (product.active === false ? 'inactive' : 'active'),
    updated_at: new Date().toISOString(),
  };
  if (product.id && !String(product.id).startsWith('P') && product.id.length > 20) {
    return one(await supabase.from('products').update(payload).eq('id', product.id).select('*').single());
  }
  return one(await supabase.from('products').insert(payload).select('*').single());
}

export async function updateProductStatusRecord(productId, status) {
  return one(await supabase.from('products').update({ status, updated_at: new Date().toISOString() }).eq('id', productId).select('*').single());
}

export async function addWarehouseRecord(storeId, draft) {
  return one(await supabase.from('warehouses').insert({
    store_id: storeId,
    name: draft.name.trim(),
    address: draft.address?.trim() || '',
    status: draft.status || 'active',
  }).select('*').single());
}

export async function updateWarehouseStatusRecord(warehouseId, status) {
  return one(await supabase.from('warehouses').update({ status, updated_at: new Date().toISOString() }).eq('id', warehouseId).select('*').single());
}

export async function createCheckoutOrder({
  store,
  staff,
  customer,
  cartRows,
  subtotal,
  taxRate,
  taxAmount,
  pointsUsed,
  pointsDiscount,
  total,
}) {
  const token = `${store.slug || store.id}-${Date.now().toString(16)}`;
  const code = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
  const earned = pointsFromRaw(total);

  const order = one(await supabase.from('orders').insert({
    store_id: store.id,
    staff_id: staff?.id || null,
    customer_id: customer?.id && !String(customer.id).startsWith('C') ? customer.id : null,
    customer_wallet: customer?.wallet || null,
    code,
    checkout_token: token,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_before_points: subtotal + taxAmount,
    apoints_redeemed: pointsUsed,
    discount_amount: pointsDiscount,
    total_amount: total,
    apoints_earned: earned,
    status: 'pending',
    payment_status: 'pending',
  }).select('*').single());

  await supabase.from('order_items').insert(cartRows.map(row => ({
    order_id: order.id,
    product_id: row.id,
    product_name: row.name,
    sku: row.sku,
    quantity: row.qty,
    unit_price: row.price,
    total_price: row.price * row.qty,
  })));

  const arcMethod = one(await supabase
    .from('store_payment_methods')
    .select('*, payment_networks!inner(*), payment_tokens(*)')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('payment_networks.code', 'arc-testnet')
    .maybeSingle());

  const method = arcMethod || one(await supabase
    .from('store_payment_methods')
    .select('*, payment_networks(*), payment_tokens(*)')
    .eq('store_id', store.id)
    .eq('is_default', true)
    .maybeSingle());

  await supabase.from('payments').insert({
    order_id: order.id,
    store_id: store.id,
    network_id: method?.network_id || null,
    token_id: method?.token_id || null,
    receiver_wallet: method?.receiver_wallet || store.receiverWallet,
    amount: total,
    status: 'pending',
  });

  return {
    order_id: order.id,
    order_code: order.code,
    checkout_token: order.checkout_token,
  };
}

export async function createStorefrontOrder({
  store,
  cartRows = [],
  paymentMethod = 'usdc_arc',
  customerWallet = '',
  pointsUsed = 0,
  snapshot = {},
}) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to create a real storefront order.');
  }

  const methodName = normalizePaymentMethod(paymentMethod);
  const status = paymentStatusForMethod(methodName);
  const method = await findStorePaymentMethod(store, methodName);
  const token = `${store.slug || store.id}-${Date.now().toString(16)}`;
  const code = `SO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
  const totalUsdc = Number(snapshot.total_usdc || 0);
  const totalUsdcRaw = rawFromUSDC(totalUsdc);
  const apointUnits = Number(snapshot.apoint_units ?? Math.round(totalUsdc * 100));
  const apointEligible = snapshot.apoint_eligible !== false && totalUsdc > 0;
  const localCurrency = snapshot.local_currency || store.currencyCode || 'VND';
  const subtotalLocal = Number(snapshot.subtotal_local || 0);
  const discountLocal = Number(snapshot.discount_local || 0);
  const taxLocal = Number(snapshot.tax_local || 0);
  const totalLocal = Number(snapshot.total_local ?? Math.max(0, subtotalLocal + taxLocal - discountLocal));

  const order = one(await supabase.from('orders').insert({
    store_id: store.id,
    customer_wallet: customerWallet || null,
    code,
    checkout_token: token,
    payment_method: methodName,
    subtotal: totalUsdcRaw,
    subtotal_usdc: totalUsdc,
    tax_rate: 0,
    tax_amount: 0,
    total_before_points: totalUsdcRaw,
    apoints_redeemed: Number(pointsUsed || 0),
    discount_amount: 0,
    total_amount: totalUsdcRaw,
    total_usdc: totalUsdc,
    local_currency: localCurrency,
    subtotal_local: subtotalLocal,
    discount_local: discountLocal,
    tax_local: taxLocal,
    total_local: totalLocal,
    exchange_rate: snapshot.exchange_rate || null,
    exchange_rate_base: snapshot.exchange_rate_base || 'USDC',
    exchange_rate_quote: snapshot.exchange_rate_quote || localCurrency,
    exchange_rate_provider: snapshot.exchange_rate_provider || null,
    exchange_rate_fetched_at: snapshot.exchange_rate_fetched_at || null,
    exchange_rate_expires_at: snapshot.exchange_rate_expires_at || null,
    apoint_eligible: apointEligible,
    apoint_units: apointUnits,
    apoint_awarded: false,
    status: status.status,
    payment_status: status.paymentStatus,
    note: snapshot.note || null,
  }).select('*').single());

  if (cartRows.length) {
    await supabase.from('order_items').insert(cartRows.map(line => {
      const localUnitPrice = Number(line.localPriceMinor ?? line.price ?? 0);
      return {
        order_id: order.id,
        product_id: line.id,
        product_name: line.name,
        sku: line.sku,
        quantity: Number(line.quantity || line.qty || 0),
        unit_price: localUnitPrice,
        total_price: localUnitPrice * Number(line.quantity || line.qty || 0),
      };
    }));
  }

  await supabase.from('payments').insert({
    order_id: order.id,
    store_id: store.id,
    network_id: method?.network_id || null,
    token_id: method?.token_id || null,
    method: methodName,
    receiver_wallet: paymentMethodWallet(method, store),
    recipient_wallet: paymentMethodWallet(method, store),
    store_wallet: paymentMethodWallet(method, store),
    customer_wallet: customerWallet || null,
    amount: totalUsdcRaw,
    amount_usdc: totalUsdc,
    paid_usdc: methodName === 'usdc_arc' ? null : totalUsdc,
    status: status.paymentRowStatus,
    payment_status: status.paymentStatus,
    raw_response: {
      mode: methodName === 'usdc_arc' ? 'storefront-usdc-pending' : 'storefront-manual-awaiting-confirmation',
      local_currency: localCurrency,
      total_local: totalLocal,
      total_usdc: totalUsdc,
      exchange_rate: snapshot.exchange_rate || null,
    },
  });

  await insertAuditLog({
    actorWallet: customerWallet,
    action: 'storefront_order_created',
    entityType: 'order',
    entityId: order.id,
    metadata: { payment_method: methodName, total_local: totalLocal, local_currency: localCurrency, total_usdc: totalUsdc },
  });

  return {
    order_id: order.id,
    order_code: order.code,
    checkout_token: order.checkout_token,
    payment_method: methodName,
    status: order.status,
    payment_status: order.payment_status,
  };
}

export async function loadCheckoutOrder(token) {
  const order = one(await supabase
    .from('orders')
    .select('*, stores(name, branch, receiver_wallet), order_items(*), payments(*, payment_networks(*), payment_tokens(*))')
    .or(`checkout_token.eq.${token},code.eq.${token}`)
    .maybeSingle());

  if (!order) return null;
  const payment = Array.isArray(order.payments) ? order.payments[0] : null;

  return {
    ...mapOrder(order),
    storeName: order.stores?.name,
    storeBranch: order.stores?.branch,
    receiverWallet: payment?.receiver_wallet || order.stores?.receiver_wallet,
    networkCode: payment?.payment_networks?.code || payment?.network || 'arc-testnet',
    paymentNetwork: payment?.payment_networks || null,
    paymentToken: payment?.payment_tokens || null,
  };
}

export async function loadCheckoutPaymentStatus(orderId) {
  if (!hasSupabaseConfig || !supabase || !orderId) return null;

  const order = one(await supabase
    .from('orders')
    .select('*, payments(*, payment_networks(*), payment_tokens(*))')
    .eq('id', orderId)
    .maybeSingle());

  if (!order) return null;

  const payment = Array.isArray(order.payments) ? order.payments[0] : null;
  const rawResponse = payment?.raw_response || {};

  return {
    orderId: order.id,
    code: order.code,
    checkoutToken: order.checkout_token,
    status: order.status || 'pending',
    paymentStatus: order.payment_status || payment?.status || 'pending',
    paymentMethod: order.payment_method || payment?.method || 'usdc_arc',
    localCurrency: order.local_currency || '',
    totalLocal: Number(order.total_local || 0),
    totalUsdc: Number(order.total_usdc || 0),
    apointUnits: Number(order.apoint_units || 0),
    apointAwarded: order.apoint_awarded === true,
    total: Number(order.total_amount || payment?.amount || 0),
    subtotal: Number(order.subtotal || 0),
    taxAmount: Number(order.tax_amount || 0),
    pointsUsed: Number(order.apoints_redeemed || 0),
    pointsDiscount: Number(order.discount_amount || 0),
    pointsEarned: Number(order.apoints_earned || 0),
    paidAt: order.paid_at || payment?.paid_at || '',
    payerWallet: payment?.payer_wallet || rawResponse.wallet_address || '',
    receiverWallet: payment?.receiver_wallet || rawResponse.receiver_wallet || '',
    txHash: payment?.tx_hash || rawResponse.payment_tx_hash || '',
    proofTxHash: payment?.proof_tx_hash || rawResponse.proof_tx_hash || '',
    proofContractAddress: payment?.proof_contract_address || rawResponse.proof_contract_address || '',
    paymentExplorerUrl: rawResponse.payment_explorer_url || '',
    proofExplorerUrl: rawResponse.proof_explorer_url || '',
    paymentMode: rawResponse.mode || '',
    rawResponse,
  };
}

export async function confirmStorefrontManualPayment({ orderId, actorWallet, note = '' }) {
  if (!hasSupabaseConfig || !supabase || !orderId) {
    throw new Error('Supabase is required to confirm storefront payments.');
  }

  const { data, error } = await supabase.rpc('confirm_storefront_manual_payment', {
    p_order_id: orderId,
    p_actor_wallet: actorWallet,
    p_note: note,
  });

  if (error) throw error;
  return data;
}

export async function confirmCheckoutPayment({ orderId, payerWallet, txHash, rawResponse = {} }) {
  const paidAt = new Date().toISOString();
  const redeemedPoints = Number(rawResponse.redeemed_points || 0);
  const redeemedValue = Number(rawResponse.redeemed_value_raw || 0);
  const paidTotal = Number(rawResponse.payable_raw || 0);
  const orderBefore = one(await supabase.from('orders').select('*').eq('id', orderId).maybeSingle());
  if (!orderBefore) throw new Error('Order not found.');

  if (orderBefore.status === 'paid' || ['confirmed', 'paid'].includes(orderBefore.payment_status)) {
    await insertAuditLog({
      actorWallet: payerWallet,
      action: 'payment_confirmation_duplicate',
      entityType: 'order',
      entityId: orderId,
      metadata: { tx_hash: txHash, payment_method: orderBefore.payment_method || 'usdc_arc' },
    });

    if (!orderBefore.apoint_awarded) {
      const award = await supabase.rpc('netpay_award_apoint_for_paid_order', {
        p_order_id: orderId,
        p_actor_wallet: payerWallet,
        p_tx_hash: txHash || null,
      });
      if (award.error) throw award.error;
    }

    return orderBefore;
  }

  const totalUsdc = Number(orderBefore.total_usdc || rawResponse.total_usdc || 0);
  const earnedUnits = Number(orderBefore.apoint_units || rawResponse.apoint_units || Math.round(totalUsdc * 100));
  const earnedPoints = earnedUnits / 100;

  const order = one(await supabase
    .from('orders')
    .update({
      status: 'paid',
      payment_status: 'confirmed',
      paid_at: paidAt,
      completed_at: paidAt,
      updated_at: paidAt,
      apoints_redeemed: redeemedPoints,
      discount_amount: redeemedValue,
      total_amount: paidTotal,
      total_usdc: totalUsdc || undefined,
      apoints_earned: earnedPoints,
      apoint_units: earnedUnits,
    })
    .eq('id', orderId)
    .select('*')
    .single());

  const paymentUpdate = {
    payer_wallet: payerWallet,
    tx_hash: txHash,
    chain_id: rawResponse.chain_id || null,
    contract_address: rawResponse.payment_token || null,
    token_address: rawResponse.payment_token || null,
    amount_usdc: totalUsdc || null,
    paid_usdc: totalUsdc || null,
    proof_tx_hash: rawResponse.proof_tx_hash || null,
    proof_contract_address: rawResponse.proof_contract_address || null,
    status: 'confirmed',
    payment_status: 'confirmed',
    raw_response: rawResponse,
    paid_at: paidAt,
    confirmed_at: paidAt,
    verified_at: paidAt,
  };

  const paymentResult = await supabase.from('payments').update(paymentUpdate).eq('order_id', orderId);
  if (paymentResult.error) {
    const fallbackUpdate = {
      payer_wallet: payerWallet,
      tx_hash: txHash,
      status: 'paid',
      raw_response: rawResponse,
      paid_at: paidAt,
    };
    const fallbackResult = await supabase.from('payments').update(fallbackUpdate).eq('order_id', orderId);
    if (fallbackResult.error) throw fallbackResult.error;
  }

  await insertAuditLog({
    actorWallet: payerWallet,
    action: 'payment_confirmed',
    entityType: 'order',
    entityId: orderId,
    metadata: { payment_method: order.payment_method || 'usdc_arc', tx_hash: txHash, total_usdc: totalUsdc },
  });

  if (payerWallet && redeemedPoints > 0) {
    const existing = one(await supabase.from('customers').select('*').eq('wallet_address', payerWallet).maybeSingle());
    const balance = Number(existing?.point_balance || 0) - redeemedPoints;
    if (existing) {
      await supabase.from('customers').update({
        point_balance: balance,
        updated_at: paidAt,
      }).eq('id', existing.id);
    }

    const ledgerRows = [];
    if (redeemedPoints > 0) {
      ledgerRows.push({
        wallet_address: payerWallet,
        store_id: order.store_id,
        order_id: order.id,
        type: 'redeem',
        points: -redeemedPoints,
        balance_after: Number(existing?.point_balance || 0) - redeemedPoints,
        tx_hash: txHash,
        note: `Redeemed on ${order.code}`,
      });
    }
    if (ledgerRows.length) {
      await supabase.from('apoint_ledger').insert(ledgerRows);
    }
  }

  const award = await supabase.rpc('netpay_award_apoint_for_paid_order', {
    p_order_id: orderId,
    p_actor_wallet: payerWallet,
    p_tx_hash: txHash || null,
  });
  if (award.error) throw award.error;

  return order;
}
