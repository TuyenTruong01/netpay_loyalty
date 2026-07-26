import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CACHE_SECONDS = 600;
const STALE_SECONDS = 86400;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeCurrency(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function validateCurrency(value: string) {
  return /^[A-Z0-9]{2,10}$/.test(value);
}

async function fetchCoinbaseQuote(baseCurrency: string, quoteCurrency: string) {
  const response = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${encodeURIComponent(baseCurrency)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('provider_unavailable');
  }

  const payload = await response.json();
  const rawRate = payload?.data?.rates?.[quoteCurrency];
  const rate = Number(rawRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('quote_not_supported');
  }

  return { rate, rawReference: { coinbase_currency: baseCurrency } };
}

async function fetchCoinbaseRate(baseCurrency: string, quoteCurrency: string) {
  try {
    const direct = await fetchCoinbaseQuote(baseCurrency, quoteCurrency);
    return { ...direct, provider: 'coinbase' };
  } catch (error) {
    if (baseCurrency !== 'USDC') {
      throw error;
    }

    const usdProxy = await fetchCoinbaseQuote('USD', quoteCurrency);
    return {
      rate: usdProxy.rate,
      provider: 'coinbase-usd-proxy',
      rawReference: {
        ...usdProxy.rawReference,
        requested_base_currency: baseCurrency,
        proxy_base_currency: 'USD',
        peg_assumption: 'USDC_USD',
      },
    };
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'function_not_configured' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const baseCurrency = normalizeCurrency(body.baseCurrency || body.base_currency || 'USDC');
  const quoteCurrency = normalizeCurrency(body.quoteCurrency || body.quote_currency);

  if (!validateCurrency(baseCurrency) || !validateCurrency(quoteCurrency)) {
    return json({ error: 'invalid_currency' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();

  const fresh = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('base_currency', baseCurrency)
    .eq('quote_currency', quoteCurrency)
    .gt('expires_at', now.toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fresh.data && !fresh.error) {
    return json({
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      rate: Number(fresh.data.rate),
      provider: fresh.data.provider,
      fetched_at: fresh.data.fetched_at,
      expires_at: fresh.data.expires_at,
      status: fresh.data.status || 'fresh',
      is_cached: true,
    });
  }

  try {
    const providerResult = await fetchCoinbaseRate(baseCurrency, quoteCurrency);
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + CACHE_SECONDS * 1000);

    const inserted = await supabase
      .from('exchange_rates')
      .insert({
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        rate: providerResult.rate,
        provider: providerResult.provider,
        fetched_at: fetchedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'fresh',
        raw_reference: providerResult.rawReference,
      })
      .select('*')
      .single();

    if (inserted.error) throw inserted.error;

    return json({
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      rate: providerResult.rate,
      provider: providerResult.provider,
      fetched_at: fetchedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'fresh',
      is_cached: false,
    });
  } catch {
    const staleCutoff = new Date(now.getTime() - STALE_SECONDS * 1000).toISOString();
    const stale = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('base_currency', baseCurrency)
      .eq('quote_currency', quoteCurrency)
      .gte('fetched_at', staleCutoff)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (stale.data && !stale.error) {
      return json({
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        rate: Number(stale.data.rate),
        provider: stale.data.provider,
        fetched_at: stale.data.fetched_at,
        expires_at: stale.data.expires_at,
        status: 'stale',
        is_cached: true,
      });
    }

    return json({ error: 'exchange_rate_unavailable' }, 502);
  }
});
