import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';

const VISIT_SESSION_KEY = 'netpay.visitSessionId';

function sessionId() {
  try {
    const existing = window.localStorage.getItem(VISIT_SESSION_KEY);
    if (existing) return existing;
    const next = `visit-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(VISIT_SESSION_KEY, next);
    return next;
  } catch {
    return `visit-${Date.now().toString(16)}`;
  }
}

export async function recordStoreVisit({ storeId, visitorWallet = '', source = 'direct' }) {
  if (!hasSupabaseConfig || !supabase || !storeId) return;

  try {
    await supabase.from('store_visits').insert({
      store_id: storeId,
      visitor_wallet: visitorWallet || null,
      session_id: sessionId(),
      source,
      referrer: document.referrer || null,
    });
  } catch (error) {
    console.warn('Cannot record store visit:', error.message || error);
  }
}
