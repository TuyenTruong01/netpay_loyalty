import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';

function includesAny(text = '', terms = []) {
  const normalized = String(text || '').toLowerCase();
  return terms.some(term => normalized.includes(term));
}

export async function logAgentAction({
  actorWallet = '',
  storeId = null,
  agentType,
  actionName,
  riskLevel = 'read',
  request = {},
  result = {},
  confirmationStatus = 'not_required',
}) {
  if (!hasSupabaseConfig || !supabase) return;

  try {
    await supabase.from('agent_actions').insert({
      actor_wallet: actorWallet || null,
      store_id: storeId || null,
      agent_type: agentType,
      action_name: actionName,
      risk_level: riskLevel,
      request,
      result,
      confirmation_status: confirmationStatus,
    });
  } catch (error) {
    console.warn('Cannot log agent action:', error.message || error);
  }
}

export async function loadCustomerByWallet(walletAddress = '') {
  if (!hasSupabaseConfig || !supabase || !walletAddress) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('wallet_address', walletAddress)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function runStoreAgent({ prompt, store, actorWallet }) {
  const products = store?.products || [];
  const orders = store?.orders || [];
  const lowStock = products.filter(product => Number(product.listedQuantity ?? product.stock ?? 0) <= 5);
  const pendingOrders = orders.filter(order => !['paid', 'completed'].includes(String(order.paymentStatus || order.status || '').toLowerCase()));
  const usdcSales = orders.reduce((sum, order) => sum + Number(order.totalUsdc ?? order.total_usdc ?? 0), 0);

  let actionName = 'store_summary';
  let answer = [
    `${store?.name || 'This store'} has ${products.length} listed products in ${store?.currencyCode || 'local currency'}.`,
    `${lowStock.length} products are low stock.`,
    `${pendingOrders.length} orders need attention.`,
  ].join(' ');

  if (includesAny(prompt, ['low stock', 'sap het', 'het hang', 'ton kho'])) {
    actionName = 'list_low_stock';
    answer = lowStock.length
      ? `Low stock: ${lowStock.map(product => product.name).join(', ')}.`
      : 'No listed product is low stock right now.';
  } else if (includesAny(prompt, ['sales', 'revenue', 'doanh thu'])) {
    actionName = 'summarize_sales';
    answer = `Today has ${orders.length} orders and estimated confirmed value of ${usdcSales.toFixed(2)} USDC after local-currency conversion snapshots.`;
  } else if (includesAny(prompt, ['rate', 'exchange', 'ty gia', 'currency'])) {
    actionName = 'explain_exchange_rate';
    answer = `Products are priced in ${store?.currencyCode || 'the store currency'}. Checkout fetches a USDC exchange-rate snapshot through the Supabase Edge Function, and historical orders keep their original rate.`;
  } else if (includesAny(prompt, ['qr', 'map', 'location', 'dia chi', 'vi tri'])) {
    actionName = 'explain_store_discovery';
    answer = `This store can appear in Explore and Map when it is active and map visibility is enabled. The storefront QR should point to /s/${store?.slug || ':storeSlug'}?source=store_qr.`;
  } else if (includesAny(prompt, ['pending', 'order', 'don hang'])) {
    actionName = 'list_pending_orders';
    answer = pendingOrders.length
      ? `Pending orders: ${pendingOrders.map(order => order.id || order.code).join(', ')}.`
      : 'No pending orders are waiting right now.';
  } else if (includesAny(prompt, ['hide', 'delete', 'remove', 'wallet', 'owner'])) {
    actionName = 'requires_confirmation';
    answer = 'That action can affect products, wallets, payment confirmation, exchange settings, or store visibility. I can prepare a preview, but a human confirmation step is required before changes are applied.';
  }

  const result = { answer, actionName };
  await logAgentAction({
    actorWallet,
    storeId: store?.id,
    agentType: 'store_management',
    actionName,
    riskLevel: actionName === 'requires_confirmation' ? 'confirm_required' : 'read',
    request: { prompt },
    result,
    confirmationStatus: actionName === 'requires_confirmation' ? 'pending' : 'not_required',
  });

  return result;
}

export async function runShoppingAgent({ prompt, store, cart = [], actorWallet }) {
  const products = (store?.products || []).filter(product =>
    product.visible !== false &&
    product.active !== false &&
    Number(product.listedQuantity ?? product.stock ?? 0) > 0
  );
  const subtotal = cart.reduce((sum, line) => sum + Number(line.localPriceMinor ?? line.price ?? 0) * Number(line.quantity || 0), 0);

  let actionName = 'shopping_summary';
  let answer = `${store?.name || 'This store'} has ${products.length} available products priced in ${store?.currencyCode || 'local currency'}. Your current cart subtotal is ${subtotal} minor currency units before any USDC conversion.`;

  if (includesAny(prompt, ['cheap', 'under', 'duoi', 're'])) {
    actionName = 'recommend_budget_products';
    const picks = products
      .slice()
      .sort((a, b) => Number(a.localPriceMinor ?? a.price ?? 0) - Number(b.localPriceMinor ?? b.price ?? 0))
      .slice(0, 3);
    answer = picks.length
      ? `Budget picks: ${picks.map(product => `${product.name} (${Number(product.localPriceMinor ?? product.price ?? 0)} minor ${store?.currencyCode || 'currency'} units)`).join(', ')}.`
      : 'No available products match the budget request yet.';
  } else if (includesAny(prompt, ['popular', 'best', 'recommend', 'goi y'])) {
    actionName = 'recommend_products';
    const picks = products.filter(product => product.featured).slice(0, 3);
    const fallback = picks.length ? picks : products.slice(0, 3);
    answer = fallback.length
      ? `Recommended: ${fallback.map(product => product.name).join(', ')}.`
      : 'No product is available for recommendation yet.';
  } else if (includesAny(prompt, ['apoint', 'point', 'reward'])) {
    actionName = 'explain_apoint';
    answer = 'APoint can be awarded for USDC on Arc, bank transfer, and cash after the order is confirmed paid. 1 APoint is stored as 100 units, so 3.81 USDC earns 381 APoint units.';
  } else if (includesAny(prompt, ['pay', 'wallet', 'usdc', 'bank', 'cash'])) {
    actionName = 'explain_payment';
    answer = 'USDC on Arc requires a wallet and valid transaction confirmation. Bank transfer and cash orders stay awaiting confirmation until store owner or staff marks them paid.';
  }

  const result = { answer, actionName };
  await logAgentAction({
    actorWallet,
    storeId: store?.id,
    agentType: 'shopping_assistant',
    actionName,
    riskLevel: 'read',
    request: { prompt, cartSize: cart.length },
    result,
  });

  return result;
}
