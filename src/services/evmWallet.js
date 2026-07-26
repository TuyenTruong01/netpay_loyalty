import EthereumProvider from '@walletconnect/ethereum-provider';

let walletConnectProvider = null;
let activeEvmProvider = null;

export function getInjectedEthereum() {
  if (typeof window === 'undefined') return null;

  const eth = window.ethereum;
  if (eth && Array.isArray(eth.providers)) {
    const metamask = eth.providers.find((provider) => provider.isMetaMask);
    const rabby = eth.providers.find((provider) => provider.isRabby);
    return metamask || rabby || eth.providers[0] || eth;
  }

  return eth || walletConnectProvider;
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

async function getWalletConnectProvider(chain) {
  const projectId = walletConnectProjectId();

  if (!projectId) {
    throw new Error('WalletConnect projectId is missing. Set VITE_WALLETCONNECT_PROJECT_ID in .env.');
  }

  if (!walletConnectProvider) {
    walletConnectProvider = await EthereumProvider.init({
      projectId,
      chains: [chain.chainIdDecimal],
      optionalChains: [chain.chainIdDecimal],
      rpcMap: {
        [chain.chainIdDecimal]: chain.rpcUrls?.[0],
        },
        showQrModal: true,
        qrModalOptions: {
          mobileWallets: [
            {
              id: 'metamask',
              name: 'MetaMask',
              links: {
                native: 'metamask://',
                universal: 'https://metamask.app.link',
              },
            },
          ],
          enableExplorer: true,
        },
        metadata: {
          name: 'Paynet Loyalty Loyalty',
          description: 'Paynet Loyalty USDC checkout',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://paynet.local',
        icons: typeof window !== 'undefined' ? [`${window.location.origin}/png/logo/paynet-logo.png`] : [],
      },
    });
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

    return waitForWalletConnectAccounts(ethereum);
  }

  return normalizeProviderAccounts(await ethereum.request({ method: 'eth_requestAccounts' }));
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

export async function connectEvmWallet(chain) {
  let ethereum = getInjectedEthereum();

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
