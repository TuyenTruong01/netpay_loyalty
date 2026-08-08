import EthereumProvider from '@walletconnect/ethereum-provider';

let walletConnectProvider = null;
let walletConnectChainId = null;
let activeEvmProvider = null;

function getInjectedProviders() {
  if (typeof window === 'undefined') return [];

  const ethereum = window.ethereum;
  if (!ethereum) return [];

  const providers = Array.isArray(ethereum.providers)
    ? ethereum.providers
    : [ethereum];

  // Some wallet extensions expose the same provider more than once.
  return [...new Set(providers)].filter(
    provider => provider && typeof provider.request === 'function'
  );
}

function walletNameFromProvider(provider = {}) {
  if (provider?.isRabby) return 'Rabby';
  if (provider?.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider?.isOkxWallet || provider?.isOKExWallet) return 'OKX Wallet';
  if (provider?.isBraveWallet) return 'Brave Wallet';
  if (provider?.isTrust || provider?.isTrustWallet) return 'Trust Wallet';
  if (provider?.isPhantom) return 'Phantom';
  if (provider?.isMetaMask) return 'MetaMask';
  return 'Browser Wallet';
}

function walletIdFromProvider(provider = {}, index = 0) {
  if (provider?.isRabby) return `rabby-${index}`;
  if (provider?.isCoinbaseWallet) return `coinbase-${index}`;
  if (provider?.isOkxWallet || provider?.isOKExWallet) return `okx-${index}`;
  if (provider?.isBraveWallet) return `brave-${index}`;
  if (provider?.isTrust || provider?.isTrustWallet) return `trust-${index}`;
  if (provider?.isPhantom) return `phantom-${index}`;
  if (provider?.isMetaMask) return `metamask-${index}`;
  return `wallet-${index}`;
}

function browserWalletDescriptor(provider, index = 0, info = null) {
  return {
    id: info?.uuid || walletIdFromProvider(provider, index),
    name: info?.name || walletNameFromProvider(provider),
    icon: info?.icon || '',
    rdns: info?.rdns || '',
    provider,
  };
}

function dedupeWalletDescriptors(wallets = []) {
  const seenProviders = new Set();
  const seenIds = new Set();

  return wallets.filter(wallet => {
    if (!wallet?.provider || typeof wallet.provider.request !== 'function') return false;
    if (seenProviders.has(wallet.provider)) return false;

    const idKey = `${wallet.rdns || ''}:${wallet.id || ''}`;
    if (idKey !== ':' && seenIds.has(idKey)) return false;

    seenProviders.add(wallet.provider);
    if (idKey !== ':') seenIds.add(idKey);
    return true;
  });
}

export async function discoverInjectedWallets(timeoutMs = 140) {
  if (typeof window === 'undefined') return [];

  const discovered = getInjectedProviders().map((provider, index) =>
    browserWalletDescriptor(provider, index)
  );

  // EIP-6963 is the modern multi-wallet discovery standard. It prevents one
  // extension from overwriting window.ethereum and lets the user choose explicitly.
  const announced = [];
  const onAnnounce = event => {
    const detail = event?.detail;
    if (!detail?.provider) return;
    announced.push(browserWalletDescriptor(detail.provider, announced.length, detail.info));
  };

  window.addEventListener('eip6963:announceProvider', onAnnounce);

  try {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    await new Promise(resolve => window.setTimeout(resolve, timeoutMs));
  } finally {
    window.removeEventListener('eip6963:announceProvider', onAnnounce);
  }

  const wallets = dedupeWalletDescriptors([...announced, ...discovered]);

  const withStatus = await Promise.all(wallets.map(async wallet => ({
    ...wallet,
    accounts: await readProviderAccounts(wallet.provider),
  })));

  // Already-authorized wallets appear first, but NetPay never auto-selects one
  // when the selector UI is being used.
  return withStatus.sort((a, b) => {
    const aAuthorized = a.accounts.length ? 0 : 1;
    const bAuthorized = b.accounts.length ? 0 : 1;
    if (aAuthorized !== bAuthorized) return aAuthorized - bAuthorized;
    return a.name.localeCompare(b.name);
  });
}

function providerPriority(provider) {
  // Important: Rabby and some other wallets may also expose isMetaMask=true
  // for compatibility, so exclude them from the MetaMask branch.
  if (provider?.isRabby === true) return 10;
  if (
    provider?.isMetaMask === true &&
    provider?.isRabby !== true &&
    provider?.isCoinbaseWallet !== true
  ) {
    return 20;
  }
  if (provider?.isCoinbaseWallet === true) return 30;
  return 100;
}

export function getInjectedEthereum() {
  const providers = getInjectedProviders();

  if (providers.length) {
    return [...providers].sort(
      (a, b) => providerPriority(a) - providerPriority(b)
    )[0];
  }

  return walletConnectProvider;
}

async function selectInjectedEthereum() {
  const providers = getInjectedProviders();

  if (!providers.length) {
    return null;
  }

  // First reuse a provider that already has permission for this site.
  // This avoids asking the wrong extension when several wallets are injected.
  for (const provider of providers) {
    const accounts = await readProviderAccounts(provider);
    if (accounts.length) {
      return provider;
    }
  }

  // No provider is authorized yet. Use a deterministic priority and, crucially,
  // do not mistake Rabby for MetaMask just because it exposes isMetaMask=true.
  return [...providers].sort(
    (a, b) => providerPriority(a) - providerPriority(b)
  )[0];
}

export function getActiveEvmProvider() {
  return activeEvmProvider || getInjectedEthereum();
}

export function setActiveEvmProvider(ethereum) {
  activeEvmProvider = ethereum || activeEvmProvider;
  return activeEvmProvider;
}

export function isValidEvmAddress(address = '') {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address).trim());
}

function assertAddress(address, label = 'address') {
  if (!isValidEvmAddress(address)) {
    throw new Error(`Invalid ${label}: ${address || '(empty)'}`);
  }
}

function assertChainReady(chain) {
  if (!chain?.chainIdHex || !chain?.chainIdDecimal) {
    throw new Error('Payment network is missing chain configuration.');
  }
}

function walletParams(chain) {
  return {
    chainId: chain.chainIdHex,
    chainName: chain.label,
    rpcUrls: chain.rpcUrls || [],
    nativeCurrency: chain.nativeCurrency,
    blockExplorerUrls: chain.explorerUrl ? [chain.explorerUrl] : [],
  };
}

function walletConnectProjectId() {
  return String(import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID || '').trim();
}

function isWalletConnectRelayError(error) {
  const message = String(error?.message || error || '');
  return /subscrib(?:e|ing).*failed|relay.*failed|socket.*closed|connection.*stalled|publish.*failed/i.test(message);
}

function clearWalletConnectStorage() {
  if (typeof window === 'undefined') return;

  const clearMatchingKeys = storage => {
    if (!storage) return;

    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && /^(wc@2:|walletconnect)|walletconnect/i.test(key)) {
        keys.push(key);
      }
    }

    keys.forEach(key => {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore browser storage restrictions (private mode, blocked storage, etc.).
      }
    });
  };

  try {
    clearMatchingKeys(window.localStorage);
  } catch {}

  try {
    clearMatchingKeys(window.sessionStorage);
  } catch {}
}

async function resetWalletConnectProvider({ clearStorage = false } = {}) {
  const provider = walletConnectProvider;

  walletConnectProvider = null;
  walletConnectChainId = null;

  if (activeEvmProvider === provider) {
    activeEvmProvider = null;
  }

  if (provider) {
    try {
      await provider.disconnect?.();
    } catch {
      // A stale relay/session can make disconnect fail; continue with local cleanup.
    }
  }

  if (clearStorage) {
    clearWalletConnectStorage();
  }
}

export function walletConnectAvailable() {
  return Boolean(walletConnectProjectId());
}

export function getWalletConnectChoice() {
  return {
    id: 'walletconnect-mobile',
    name: 'WalletConnect',
    icon: '',
    rdns: 'walletconnect',
    type: 'walletconnect',
    accounts: [],
    description: 'Connect a mobile wallet such as MetaMask, Rabby, OKX Wallet, Trust Wallet, or Coinbase Wallet.',
  };
}

async function getWalletConnectProvider(chain) {
  assertChainReady(chain);

  const projectId = walletConnectProjectId();

  if (!projectId) {
    const error = new Error(
      'WalletConnect is not configured yet. Add VITE_WALLETCONNECT_PROJECT_ID in Vercel Environment Variables, then redeploy.'
    );
    error.code = 'WALLETCONNECT_PROJECT_ID_MISSING';
    throw error;
  }

  // Re-create the provider if NetPay changes to a different payment chain.
  if (walletConnectProvider && walletConnectChainId !== chain.chainIdDecimal) {
    try {
      await walletConnectProvider.disconnect?.();
    } catch {
      // Ignore stale-session cleanup failures; a fresh provider is created below.
    }
    walletConnectProvider = null;
    walletConnectChainId = null;
  }

  if (!walletConnectProvider) {
    const rpcUrl = chain.rpcUrls?.[0];

    // Arc is the payment network, so request Arc in the WalletConnect
    // session itself. Do not create the session on Ethereum mainnet and then
    // try to mutate it to Arc afterwards: WalletConnect v2 namespaces are
    // approved when the session is created, and a later chain switch cannot
    // reliably add a chain that was not approved in that namespace.
    const rpcMap = rpcUrl
      ? { [chain.chainIdDecimal]: rpcUrl }
      : undefined;

    walletConnectProvider = await EthereumProvider.init({
      projectId,
      chains: [chain.chainIdDecimal],
      rpcMap,
      showQrModal: true,
      methods: [
        'eth_sendTransaction',
        'personal_sign',
        'eth_signTypedData',
        'eth_signTypedData_v4',
      ],
      optionalMethods: [
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
      ],
      events: ['accountsChanged', 'chainChanged', 'connect', 'disconnect'],
      metadata: {
        name: 'Paynet Loyalty',
        description: 'Paynet Loyalty USDC checkout',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://paynet.local',
        icons: typeof window !== 'undefined'
          ? [`${window.location.origin}/png/logo/paynet-logo.png`]
          : [],
      },
    });

    walletConnectChainId = chain.chainIdDecimal;
  }

  return walletConnectProvider;
}

function isWalletConnectProvider(ethereum) {
  return Boolean(ethereum && ethereum === walletConnectProvider);
}

function normalizeProviderAccounts(accounts) {
  if (Array.isArray(accounts)) return accounts;
  if (typeof accounts === 'string') return [accounts];
  return [];
}

function walletConnectSessions(ethereum) {
  const sessions = [];

  if (ethereum?.session) {
    sessions.push(ethereum.session);
  }

  // @walletconnect/ethereum-provider can update its internal SignClient session
  // store before the top-level `provider.session` reference is refreshed after
  // an iOS app hand-off. Read both locations so Safari can recover immediately
  // after the user approves the connection in MetaMask/Rabby/OKX.
  const stores = [
    ethereum?.signer?.client?.session,
    ethereum?.client?.session,
  ].filter(Boolean);

  for (const store of stores) {
    try {
      const values = typeof store.getAll === 'function'
        ? store.getAll()
        : (Array.isArray(store.values) ? store.values : []);
      for (const session of values || []) {
        if (session) sessions.push(session);
      }
    } catch {
      // Session-store internals differ between WalletConnect versions.
    }
  }

  const seen = new Set();
  return sessions.filter(session => {
    const key = session?.topic || session?.pairingTopic || JSON.stringify(session?.namespaces || {});
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function walletConnectAccountsForChain(ethereum, chain) {
  if (!chain?.chainIdDecimal) return [];

  const target = String(chain.chainIdDecimal);
  const accounts = walletConnectSessions(ethereum)
    .flatMap(session => Object.values(session?.namespaces || {}))
    .flatMap(namespace => normalizeProviderAccounts(namespace?.accounts))
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(value => {
      const parts = value.split(':');
      return parts.length >= 3 && parts[0] === 'eip155' && parts[1] === target;
    })
    .map(value => value.split(':').pop())
    .filter(isValidEvmAddress);

  return [...new Set(accounts)];
}

function walletConnectSessionHasChain(ethereum, chain) {
  if (!chain?.chainIdDecimal) return false;

  const targetCaip = `eip155:${chain.chainIdDecimal}`;

  return walletConnectSessions(ethereum).some(session =>
    Object.values(session?.namespaces || {}).some(namespace => {
      const chains = normalizeProviderAccounts(namespace?.chains);
      const accounts = normalizeProviderAccounts(namespace?.accounts);
      return (
        chains.includes(targetCaip) ||
        accounts.some(value => String(value).startsWith(`${targetCaip}:`))
      );
    })
  );
}

function closeWalletConnectModal(ethereum) {
  // Best-effort only. Different versions expose the modal in different places.
  const closers = [
    () => ethereum?.modal?.closeModal?.(),
    () => ethereum?.modal?.close?.(),
    () => ethereum?.signer?.modal?.closeModal?.(),
  ];

  for (const close of closers) {
    try {
      const result = close();
      if (result !== undefined) return;
    } catch {
      // The connection itself must not fail just because the modal API changed.
    }
  }
}

async function readProviderAccounts(ethereum) {
  const directAccounts = normalizeProviderAccounts(ethereum?.accounts);

  if (directAccounts.length) {
    return directAccounts;
  }

  try {
    return normalizeProviderAccounts(await ethereum.request({ method: 'eth_accounts' }));
  } catch {
    return [];
  }
}

export async function getEvmProviderAccounts(ethereum = getActiveEvmProvider()) {
  if (!ethereum) return [];
  return readProviderAccounts(ethereum);
}

export async function restoreEvmWalletConnection(chain) {
  const ethereum = getActiveEvmProvider();

  if (!ethereum) {
    return null;
  }

  const accounts = await readProviderAccounts(ethereum);
  const address = accounts?.[0];

  if (!isValidEvmAddress(address)) {
    return null;
  }

  activeEvmProvider = ethereum;

  // A connection is only considered successful after the wallet is on the
  // payment network. If Arc is missing, ensureEvmChain asks the wallet to add it;
  // if another network is active, it asks the wallet to switch to Arc.
  await ensureEvmChain(chain, ethereum);

  return {
    address,
    chainId: chain.chainIdDecimal,
    chainReady: true,
    chainError: null,
    network: chain.label,
    provider: ethereum,
  };
}

function waitForWalletConnectAccounts(ethereum, chain, timeoutMs = 60000, getPendingAccounts = null) {
  return new Promise(resolve => {
    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;
    let cleanup = () => {};

    const finish = accounts => {
      const normalized = normalizeProviderAccounts(accounts).filter(isValidEvmAddress);
      if (settled || !normalized.length) return false;
      settled = true;
      cleanup();
      closeWalletConnectModal(ethereum);
      resolve(normalized);
      return true;
    };

    const checkAccounts = async () => {
      if (settled) return;

      // 1) First inspect the approved WalletConnect session itself. On iOS this
      // is often updated before provider.accounts / accountsChanged are replayed.
      const sessionAccounts = walletConnectAccountsForChain(ethereum, chain);
      if (finish(sessionAccounts)) return;

      // 2) Accept accounts returned by enable() if that promise eventually
      // resolves after Safari resumes.
      try {
        const pending = typeof getPendingAccounts === 'function'
          ? getPendingAccounts()
          : [];
        if (finish(pending)) return;
      } catch {}

      // 3) Fall back to provider state and eth_accounts.
      const direct = normalizeProviderAccounts(ethereum?.accounts);
      if (finish(direct)) return;

      try {
        const requested = normalizeProviderAccounts(
          await ethereum.request({ method: 'eth_accounts' })
        );
        finish(requested);
      } catch {
        // While the wallet app is foregrounded, Safari RPC calls can temporarily
        // fail. Keep polling the session store until the browser resumes.
      }
    };

    const onAccountsChanged = accounts => finish(accounts);
    const onConnect = () => { void checkAccounts(); };
    const onChainChanged = () => { void checkAccounts(); };
    const onSessionEvent = () => { void checkAccounts(); };
    const onSessionUpdate = () => { void checkAccounts(); };
    const onSessionConnect = () => { void checkAccounts(); };
    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void checkAccounts();
      }
    };
    const onFocus = () => { void checkAccounts(); };
    const onPageShow = () => { void checkAccounts(); };

    cleanup = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      ethereum.removeListener?.('accountsChanged', onAccountsChanged);
      ethereum.removeListener?.('connect', onConnect);
      ethereum.removeListener?.('chainChanged', onChainChanged);
      ethereum.removeListener?.('session_event', onSessionEvent);
      ethereum.removeListener?.('session_update', onSessionUpdate);
      ethereum.removeListener?.('session_connect', onSessionConnect);
      document?.removeEventListener?.('visibilitychange', onVisibilityChange);
      window?.removeEventListener?.('focus', onFocus);
      window?.removeEventListener?.('pageshow', onPageShow);
    };

    ethereum.on?.('accountsChanged', onAccountsChanged);
    ethereum.on?.('connect', onConnect);
    ethereum.on?.('chainChanged', onChainChanged);
    ethereum.on?.('session_event', onSessionEvent);
    ethereum.on?.('session_update', onSessionUpdate);
    ethereum.on?.('session_connect', onSessionConnect);
    document?.addEventListener?.('visibilitychange', onVisibilityChange);
    window?.addEventListener?.('focus', onFocus);
    window?.addEventListener?.('pageshow', onPageShow);

    // iOS may not replay any provider event after returning from the wallet app,
    // so poll the SignClient session store as the source of truth.
    pollTimer = window.setInterval(() => { void checkAccounts(); }, 500);
    timeoutTimer = window.setTimeout(async () => {
      if (settled) return;
      const finalAccounts = walletConnectAccountsForChain(ethereum, chain);
      settled = true;
      cleanup();
      if (finalAccounts.length) closeWalletConnectModal(ethereum);
      resolve(finalAccounts);
    }, timeoutMs);

    void checkAccounts();
  });
}

async function requestWalletAccounts(ethereum, chain = null) {
  if (isWalletConnectProvider(ethereum)) {
    // Do NOT await enable() before watching the session. On iOS the deep-link
    // hand-off can leave the enable promise pending even though MetaMask has
    // already approved and SignClient already contains the session/account.
    let enabledAccounts = [];
    let enableError = null;

    Promise.resolve()
      .then(() => ethereum.enable())
      .then(accounts => {
        enabledAccounts = normalizeProviderAccounts(accounts);
      })
      .catch(error => {
        enableError = error;
      });

    const accounts = await waitForWalletConnectAccounts(
      ethereum,
      chain,
      60000,
      () => enabledAccounts
    );

    if (accounts.length) {
      return accounts;
    }

    // If approval never produced a session/account, surface the provider error
    // when one exists; otherwise provide a precise mobile-resume message.
    if (enableError) {
      throw enableError;
    }

    const error = new Error(
      'The wallet was approved, but NetPay could not read the Arc account from the WalletConnect session. Return to Safari after approval, then reconnect once.'
    );
    error.code = 'WALLETCONNECT_ACCOUNT_TIMEOUT';
    throw error;
  }

  try {
    const accounts = normalizeProviderAccounts(
      await ethereum.request({ method: 'eth_requestAccounts' })
    );

    if (!accounts.length) {
      throw new Error(
        'Wallet did not provide an account. Unlock the wallet and select an account.'
      );
    }

    return accounts;
  } catch (error) {
    if (
      error?.code === 4001 &&
      /at least one account|no account/i.test(String(error?.message || ''))
    ) {
      const nextError = new Error(
        'The selected browser wallet has no available account. Unlock it, create/select an account, or disable the unused wallet extension and try again.'
      );
      nextError.code = 'WALLET_NO_ACCOUNT';
      nextError.cause = error;
      throw nextError;
    }

    if (error?.code === 4001) {
      const nextError = new Error('Wallet connection was rejected.');
      nextError.code = 4001;
      nextError.cause = error;
      throw nextError;
    }

    throw error;
  }
}

function chainSwitchError(chain, error) {
  const message = error?.message || 'Wallet could not switch networks automatically.';
  const nextError = new Error(
    `${message} NetPay could not activate ${chain.label}. Please approve the add/switch network request in your wallet and return to NetPay.`
  );

  nextError.code = 'CHAIN_SWITCH_UNSUPPORTED';
  nextError.cause = error;
  return nextError;
}

function isUnknownChainError(error) {
  const code = Number(error?.code);
  const message = String(error?.message || error || '');

  return (
    code === 4902 ||
    code === -32603 ||
    /unknown chain|unrecognized chain|chain.*not (?:added|found|configured|supported)|network.*not (?:added|found|configured|supported)|add.*network|unsupported chain/i.test(message)
  );
}

function normalizeChainId(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `0x${value.toString(16)}`.toLowerCase();
  }

  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';

  if (text.startsWith('0x')) {
    try {
      return `0x${BigInt(text).toString(16)}`.toLowerCase();
    } catch {
      return text;
    }
  }

  try {
    return `0x${BigInt(text).toString(16)}`.toLowerCase();
  } catch {
    return text;
  }
}

async function readProviderChainId(ethereum) {
  try {
    return normalizeChainId(
      await ethereum.request({ method: 'eth_chainId' })
    );
  } catch {
    return '';
  }
}

function waitForTargetChain(ethereum, targetHex, timeoutMs = 15000) {
  return new Promise(resolve => {
    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      ethereum.removeListener?.('chainChanged', onChainChanged);
      document?.removeEventListener?.('visibilitychange', onVisibilityChange);
      window?.removeEventListener?.('focus', onFocus);
      window?.removeEventListener?.('pageshow', onPageShow);
    };

    const finish = value => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const check = async () => {
      if (settled) return;
      const current = await readProviderChainId(ethereum);
      if (current === targetHex) finish(true);
    };

    const onChainChanged = value => {
      if (normalizeChainId(value) === targetHex) finish(true);
    };
    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void check();
      }
    };
    const onFocus = () => { void check(); };
    const onPageShow = () => { void check(); };

    ethereum.on?.('chainChanged', onChainChanged);
    document?.addEventListener?.('visibilitychange', onVisibilityChange);
    window?.addEventListener?.('focus', onFocus);
    window?.addEventListener?.('pageshow', onPageShow);

    pollTimer = window.setInterval(() => { void check(); }, 700);
    timeoutTimer = window.setTimeout(() => finish(false), timeoutMs);
    void check();
  });
}

async function requestAddChain(chain, ethereum) {
  await ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [walletParams(chain)],
  });
}

async function requestSwitchChain(chain, ethereum) {
  await ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chain.chainIdHex }],
  });

  // WalletConnect's EthereumProvider keeps a default CAIP chain internally.
  // Keep it synchronized after the wallet accepts the switch when supported.
  try {
    await ethereum.setDefaultChain?.(chain.chainIdDecimal);
  } catch {
    // Not every provider implements setDefaultChain; the wallet RPC remains
    // authoritative, so this is only a synchronization aid.
  }
}

export async function ensureEvmChain(chain, ethereum = getInjectedEthereum()) {
  assertChainReady(chain);

  if (!ethereum) {
    throw new Error('No EVM wallet found. Please install MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.');
  }

  const targetHex = normalizeChainId(chain.chainIdHex);

  if (isWalletConnectProvider(ethereum)) {
    // For WalletConnect, Arc must already belong to the approved session.
    // wallet_addEthereumChain cannot reliably expand an existing WC v2 session
    // namespace, so fail clearly instead of hanging after mobile approval.
    if (!walletConnectSessionHasChain(ethereum, chain)) {
      const error = new Error(
        `${chain.label} was not approved by the mobile wallet. Disconnect the WalletConnect session and connect again, then approve ${chain.label} when the wallet asks for the network.`
      );
      error.code = 'WALLETCONNECT_ARC_NOT_APPROVED';
      throw error;
    }

    try {
      await ethereum.setDefaultChain?.(chain.chainIdDecimal);
    } catch {
      // Session approval is authoritative; setDefaultChain is only provider sync.
    }

    const arcAccounts = walletConnectAccountsForChain(ethereum, chain);
    if (!arcAccounts.length) {
      const error = new Error(
        `${chain.label} is present in the WalletConnect session, but the wallet did not expose an account for that network. Reconnect and approve the Arc account.`
      );
      error.code = 'WALLETCONNECT_ARC_ACCOUNT_MISSING';
      throw error;
    }

    return true;
  }

  const currentChain = await readProviderChainId(ethereum);

  if (currentChain === targetHex) {
    return true;
  }

  let switchError = null;

  try {
    await requestSwitchChain(chain, ethereum);
  } catch (error) {
    switchError = error;
  }

  if (switchError) {
    // 4902 is the standard "unknown chain" error. Some mobile wallets wrap the
    // same condition in -32603 or a generic unsupported-network message, so
    // WalletConnect gets one safe add-network attempt for those cases too.
    if (!isUnknownChainError(switchError) && !isWalletConnectProvider(ethereum)) {
      throw chainSwitchError(chain, switchError);
    }

    try {
      await requestAddChain(chain, ethereum);
    } catch (addError) {
      // A few wallets return "already added" as an error. In that case the
      // following switch can still succeed, so only stop on a clearly rejected
      // request from the user.
      const message = String(addError?.message || '');
      if (addError?.code === 4001 || /reject|denied|cancel/i.test(message)) {
        throw chainSwitchError(chain, addError);
      }
    }

    try {
      await requestSwitchChain(chain, ethereum);
    } catch (secondSwitchError) {
      throw chainSwitchError(chain, secondSwitchError);
    }
  }

  // iOS may background Safari while the wallet shows the add/switch prompt.
  // Wait for the app to return and verify Arc is actually active before NetPay
  // reports the wallet as connected.
  const activated = await waitForTargetChain(ethereum, targetHex);

  if (!activated) {
    const finalChain = await readProviderChainId(ethereum);
    if (finalChain !== targetHex) {
      const error = new Error(
        `${chain.label} was added, but the wallet did not activate it. Open the wallet, select ${chain.label}, then return to NetPay.`
      );
      error.code = 'CHAIN_NOT_ACTIVE';
      throw error;
    }
  }

  return true;
}

export async function connectEvmWallet(chain, selectedWallet = null) {
  const wantsWalletConnect = selectedWallet?.type === 'walletconnect';
  let ethereum = wantsWalletConnect
    ? await getWalletConnectProvider(chain)
    : (selectedWallet?.provider || selectedWallet || null);

  if (!ethereum && !selectedWallet) {
    ethereum = await selectInjectedEthereum();
  }

  if (!ethereum) {
    ethereum = await getWalletConnectProvider(chain);
  }

  activeEvmProvider = ethereum;

  let accounts;

  try {
    accounts = await requestWalletAccounts(ethereum, chain);
  } catch (error) {
    // WalletConnect v2 can leave a stale relay topic/session in browser storage
    // after a cancelled or interrupted mobile connection. The next attempt then
    // fails with "Subscribing to <topic> failed" before a wallet can open.
    // Clean only WalletConnect-owned keys and retry once with a fresh provider.
    if (isWalletConnectProvider(ethereum) && isWalletConnectRelayError(error)) {
      await resetWalletConnectProvider({ clearStorage: true });

      try {
        ethereum = await getWalletConnectProvider(chain);
        activeEvmProvider = ethereum;
        accounts = await requestWalletAccounts(ethereum, chain);
      } catch (retryError) {
        if (isWalletConnectRelayError(retryError)) {
          const nextError = new Error(
            'WalletConnect could not reach its relay service. The stale session was reset, but the relay subscription still failed. Check the Reown Project ID/domain settings and your network, then try again.'
          );
          nextError.code = 'WALLETCONNECT_RELAY_FAILED';
          nextError.cause = retryError;
          throw nextError;
        }
        throw retryError;
      }
    } else {
      throw error;
    }
  }

  const address = accounts?.[0];

  assertAddress(address, 'connected wallet');

  // A connection is only considered successful after the wallet is on the
  // payment network. If Arc is missing, ensureEvmChain asks the wallet to add it;
  // if another network is active, it asks the wallet to switch to Arc.
  await ensureEvmChain(chain, ethereum);

  return {
    address,
    chainId: chain.chainIdDecimal,
    chainReady: true,
    chainError: null,
    network: chain.label,
    provider: ethereum,
  };
}
