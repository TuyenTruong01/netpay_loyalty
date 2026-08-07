import { useEffect, useMemo, useState } from 'react';

function shortAddress(address = '') {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function walletBadge(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'W';
}

export default function WalletSelector({
  open,
  wallets = [],
  loading = false,
  error = '',
  onClose,
  onRefresh,
  onSelect,
  walletConnectEnabled = false,
}) {
  const [connectingId, setConnectingId] = useState('');

  useEffect(() => {
    if (!open) setConnectingId('');
  }, [open]);

  const sortedWallets = useMemo(() => wallets || [], [wallets]);

  if (!open) return null;

  async function choose(wallet) {
    if (connectingId) return;
    setConnectingId(wallet.id);
    try {
      await onSelect(wallet);
    } catch {
      // App keeps the selector open and displays the provider error inline.
    } finally {
      setConnectingId('');
    }
  }

  return (
    <div style={styles.backdrop} role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="wallet-selector-title">
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>PAYNET LOYALTY</div>
            <h2 id="wallet-selector-title" style={styles.title}>Choose a wallet</h2>
            <p style={styles.subtitle}>Choose an injected browser wallet, or use WalletConnect on mobile.</p>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose} aria-label="Close wallet selector">×</button>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Detecting browser wallets…</div>
          ) : sortedWallets.length ? (
            sortedWallets.map(wallet => {
              const account = wallet.accounts?.[0] || '';
              const isConnecting = connectingId === wallet.id;
              return (
                <button
                  type="button"
                  key={wallet.id}
                  style={{ ...styles.walletButton, ...(isConnecting ? styles.walletButtonBusy : {}) }}
                  onClick={() => choose(wallet)}
                  disabled={Boolean(connectingId)}
                >
                  <span style={styles.iconWrap}>
                    {wallet.icon ? (
                      <img src={wallet.icon} alt="" style={styles.iconImage} />
                    ) : (
                      <span style={styles.iconFallback}>{walletBadge(wallet.name)}</span>
                    )}
                  </span>
                  <span style={styles.walletText}>
                    <strong style={styles.walletName}>{wallet.name}</strong>
                    <span style={styles.walletMeta}>
                      {account ? `Authorized · ${shortAddress(account)}` : 'Browser extension · not connected yet'}
                    </span>
                  </span>
                  <span style={styles.walletAction}>{isConnecting ? 'Connecting…' : 'Connect'}</span>
                </button>
              );
            })
          ) : (
            <div style={styles.empty}>
              <strong>No injected browser wallet detected.</strong>
              <span>On iPhone/Android Safari or Chrome, use WalletConnect below.</span>
            </div>
          )}

          <div style={styles.sectionLabel}>MOBILE / WALLET APP</div>
          <button
            type="button"
            style={{ ...styles.walletButton, ...styles.walletConnectButton, ...(connectingId === 'walletconnect-mobile' ? styles.walletButtonBusy : {}) }}
            onClick={() => choose({ id: 'walletconnect-mobile', name: 'WalletConnect', type: 'walletconnect' })}
            disabled={Boolean(connectingId)}
          >
            <span style={{ ...styles.iconWrap, ...styles.walletConnectIcon }}>WC</span>
            <span style={styles.walletText}>
              <strong style={styles.walletName}>WalletConnect</strong>
              <span style={styles.walletMeta}>Open MetaMask, Rabby, OKX, Trust Wallet, Coinbase Wallet, or another compatible mobile wallet.</span>
            </span>
            <span style={styles.walletAction}>
              {connectingId === 'walletconnect-mobile'
                ? 'Connecting…'
                : (walletConnectEnabled ? 'Connect' : 'Setup required')}
            </span>
          </button>
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.secondaryButton} onClick={onRefresh} disabled={loading || Boolean(connectingId)}>
            {loading ? 'Detecting…' : 'Refresh wallets'}
          </button>
          <button type="button" style={styles.cancelButton} onClick={onClose} disabled={Boolean(connectingId)}>Cancel</button>
        </div>

        <p style={styles.note}>Injected wallets are used on desktop. WalletConnect is the recommended path from Safari/Chrome on mobile.</p>
      </section>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15, 23, 42, .58)',
    display: 'grid', placeItems: 'center', padding: 20, backdropFilter: 'blur(2px)',
  },
  modal: {
    width: 'min(520px, 100%)', maxHeight: 'min(720px, calc(100vh - 36px))', overflow: 'auto',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18,
    boxShadow: '0 28px 80px rgba(15, 23, 42, .28)', padding: 20, color: '#0f172a',
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' },
  eyebrow: { fontSize: 11, lineHeight: 1.2, color: '#5b35f5', fontWeight: 900, letterSpacing: '.08em' },
  title: { margin: '5px 0 4px', fontSize: 24, lineHeight: 1.15 },
  subtitle: { margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.5 },
  closeButton: {
    width: 36, height: 36, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff',
    color: '#475569', fontSize: 24, lineHeight: 1, cursor: 'pointer', flex: '0 0 auto',
  },
  error: {
    marginTop: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca',
    background: '#fef2f2', color: '#991b1b', fontSize: 12, lineHeight: 1.45,
  },
  list: { display: 'grid', gap: 9, marginTop: 16 },
  sectionLabel: { marginTop: 8, fontSize: 10, fontWeight: 900, letterSpacing: '.08em', color: '#94a3b8' },
  walletButton: {
    width: '100%', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) auto', alignItems: 'center', gap: 11,
    padding: 11, border: '1px solid #e2e8f0', borderRadius: 13, background: '#fff', color: '#0f172a',
    textAlign: 'left', cursor: 'pointer', transition: 'border-color .15s ease, background .15s ease',
  },
  walletButtonBusy: { background: '#f8fafc', borderColor: '#c4b5fd' },
  walletConnectButton: { borderColor: '#c4b5fd', background: '#faf8ff' },
  walletConnectIcon: { fontSize: 12, fontWeight: 900, color: '#5b35f5' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12, background: '#f1f5f9', display: 'grid', placeItems: 'center', overflow: 'hidden',
  },
  iconImage: { width: 30, height: 30, objectFit: 'contain', borderRadius: 8 },
  iconFallback: { fontSize: 13, fontWeight: 900, color: '#5b35f5' },
  walletText: { minWidth: 0, display: 'grid', gap: 3 },
  walletName: { fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  walletMeta: { fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  walletAction: { fontSize: 12, fontWeight: 900, color: '#5b35f5', whiteSpace: 'nowrap' },
  empty: {
    minHeight: 110, border: '1px dashed #cbd5e1', borderRadius: 13, background: '#f8fafc', color: '#64748b',
    display: 'grid', placeItems: 'center', alignContent: 'center', gap: 5, padding: 18, textAlign: 'center', fontSize: 12,
  },
  footer: { display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 16 },
  secondaryButton: {
    minHeight: 38, border: '1px solid #d8b4fe', borderRadius: 10, padding: '0 13px', background: '#f5f3ff', color: '#5b21b6',
    fontWeight: 850, cursor: 'pointer',
  },
  cancelButton: {
    minHeight: 38, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 13px', background: '#fff', color: '#475569',
    fontWeight: 850, cursor: 'pointer',
  },
  note: { margin: '13px 0 0', color: '#94a3b8', fontSize: 11, lineHeight: 1.45, textAlign: 'center' },
};
