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
  return import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID || '';
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

    walletConnectProvider = await EthereumProvider.init({
      projectId,
      chains: [chain.chainIdDecimal],
      optionalChains: [chain.chainIdDecimal],
      rpcMap: rpcUrl ? { [chain.chainIdDecimal]: rpcUrl } : undefined,
      showQrModal: true,
      methods: [
        'eth_sendTransaction',
        'personal_sign',
        'eth_signTypedData',
        'eth_signTypedData_v4',
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

  let chainReady = true;
  let chainError = null;

  try {
    await ensureEvmChain(chain, ethereum);
  } catch (error) {
    chainReady = false;
    chainError = error;
  }

  return {
    address,
    chainId: chain.chainIdDecimal,
    chainReady,
    chainError,
    network: chain.label,
    provider: ethereum,
  };
}

function waitForWalletConnectAccounts(ethereum, timeoutMs = 15000) {
  return new Promise(resolve => {
    let settled = false;
    let cleanup = () => {};

    const finish = accounts => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(normalizeProviderAccounts(accounts));
    };

    const timer = window.setTimeout(async () => {
      finish(await readProviderAccounts(ethereum));
    }, timeoutMs);

    const onAccountsChanged = accounts => finish(accounts);
    const onConnect = async () => finish(await readProviderAccounts(ethereum));

    cleanup = () => {
      window.clearTimeout(timer);
      ethereum.removeListener?.('accountsChanged', onAccountsChanged);
      ethereum.removeListener?.('connect', onConnect);
    };

    ethereum.on?.('accountsChanged', onAccountsChanged);
    ethereum.on?.('connect', onConnect);
  });
}

async function requestWalletAccounts(ethereum) {
  if (isWalletConnectProvider(ethereum)) {
    const enabledAccounts = normalizeProviderAccounts(await ethereum.enable());

    if (enabledAccounts.length) {
      return enabledAccounts;
    }

    const accounts = await waitForWalletConnectAccounts(ethereum);

    if (!accounts.length) {
      throw new Error('Wallet connected but no account is available.');
    }

    return accounts;
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
    // Keep the original provider error for debugging, but replace the common
    // multi-wallet/no-account failure with a useful message for the user.
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
    `${message} Please switch your wallet to ${chain.label} and return to this checkout.`
  );

  nextError.code = 'CHAIN_SWITCH_UNSUPPORTED';
  nextError.cause = error;
  return nextError;
}

export async function ensureEvmChain(chain, ethereum = getInjectedEthereum()) {
  assertChainReady(chain);

  if (!ethereum) {
    throw new Error('No EVM wallet found. Please install MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.');
  }

  const currentChain = await ethereum.request({ method: 'eth_chainId' });

  if (String(currentChain).toLowerCase() === chain.chainIdHex.toLowerCase()) {
    return true;
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chain.chainIdHex }],
    });

    return true;
  } catch (switchError) {
    if (switchError?.code !== 4902) {
      throw chainSwitchError(chain, switchError);
    }

    try {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [walletParams(chain)],
      });
    } catch (addError) {
      throw chainSwitchError(chain, addError);
    }

    return true;
  }
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

  const accounts = await requestWalletAccounts(ethereum);
  const address = accounts?.[0];

  assertAddress(address, 'connected wallet');

  let chainReady = true;
  let chainError = null;

  try {
    await ensureEvmChain(chain, ethereum);
  } catch (error) {
    chainReady = false;
    chainError = error;
  }

  return {
    address,
    chainId: chain.chainIdDecimal,
    chainReady,
    chainError,
    network: chain.label,
    provider: ethereum,
  };
}
