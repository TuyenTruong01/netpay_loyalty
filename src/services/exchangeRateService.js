import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';

const FALLBACK_CACHE_MS = 10 * 60 * 1000;
const memoryCache = new Map();

function cacheKey(baseCurrency, quoteCurrency) {
  return `${String(baseCurrency || '').toUpperCase()}:${String(quoteCurrency || '').toUpperCase()}`;
}

function normalizeRate(row = {}, isCached = true) {
  if (!row) return null;
  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return {
    base_currency: row.base_currency || row.baseCurrency || 'USDC',
    quote_currency: row.quote_currency || row.quoteCurrency,
    rate,
    provider: row.provider || 'cache',
    fetched_at: row.fetched_at || row.fetchedAt || new Date().toISOString(),
    expires_at: row.expires_at || row.expiresAt || new Date(Date.now() + FALLBACK_CACHE_MS).toISOString(),
    status: row.status || 'fresh',
    is_cached: Boolean(row.is_cached ?? isCached),
  };
}

export async function getExchangeRate({ baseCurrency = 'USDC', quoteCurrency }) {
  const base = String(baseCurrency || 'USDC').toUpperCase();
  const quote = String(quoteCurrency || '').toUpperCase();
  if (!quote) throw new Error('Store currency is missing.');

  const key = cacheKey(base, quote);
  const cached = memoryCache.get(key);
  if (cached && new Date(cached.expires_at).getTime() > Date.now()) return cached;

  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required for exchange rates.');
  }

  const invoked = await supabase.functions.invoke('exchange-rate', {
    body: { baseCurrency: base, quoteCurrency: quote },
  });
  const functionError = invoked.error?.message || invoked.data?.error || '';

  if (!invoked.error) {
    const normalized = normalizeRate(invoked.data, Boolean(invoked.data?.is_cached));
    if (normalized) {
      memoryCache.set(key, normalized);
      return normalized;
    }
  }

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('base_currency', base)
    .eq('quote_currency', quote)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error) {
    const normalized = normalizeRate(data, true);
    if (normalized) {
      memoryCache.set(key, normalized);
      return { ...normalized, status: new Date(normalized.expires_at).getTime() > Date.now() ? normalized.status : 'stale' };
    }
  }

  throw new Error(functionError ? `Exchange rate is unavailable: ${functionError}` : 'Exchange rate is unavailable. Please try again later.');
}

export function convertLocalToUsdc(localAmount, rate) {
  const amount = Number(localAmount || 0);
  const safeRate = Number(rate || 0);
  if (!Number.isFinite(amount) || !Number.isFinite(safeRate) || safeRate <= 0) return null;
  return amount / safeRate;
}

export function minorToLocal(minorAmount, decimals = 0) {
  return Number(minorAmount || 0) / Math.pow(10, Number(decimals || 0));
}

export function localToMinor(amount, decimals = 0) {
  return Math.round(Number(amount || 0) * Math.pow(10, Number(decimals || 0)));
}

export function formatLocalCurrency(amount, store = {}) {
  const currency = String(store.currencyCode || store.currency_code || 'VND').toUpperCase();
  const decimals = Number(store.currencyDecimals ?? store.currency_decimals ?? (currency === 'VND' ? 0 : 2));
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(amount || 0));
  } catch {
    const symbol = store.currencySymbol || store.currency_symbol || currency;
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(amount || 0))} ${symbol}`;
  }
}

export function formatUsdc(amount, digits = 4) {
  const value = Number(amount || 0);
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value)} USDC`;
}

export function apointUnitsFromUsdc(usdcAmount) {
  return Math.max(0, Math.round(Number(usdcAmount || 0) * 100));
}

export function formatApointUnits(units = 0) {
  return `${(Number(units || 0) / 100).toFixed(2)} APoint`;
}
