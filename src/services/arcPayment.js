import { arcTestnet } from '../chains/arcTestnet.js';
import { connectEvmWallet, ensureEvmChain, getActiveEvmProvider, isValidEvmAddress } from './evmWallet.js';
import { DISPLAY_UNITS_PER_USDC } from '../utils/format.js';

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';

export const ARC_TESTNET_CHAIN = {
  ...arcTestnet,
  chainIdDecimal: Number(import.meta.env?.VITE_ARC_TESTNET_CHAIN_ID || arcTestnet.chainIdDecimal),
  rpcUrls: [import.meta.env?.VITE_ARC_TESTNET_RPC_URL || arcTestnet.rpcUrls[0]],
};

export const ARC_USDC = {
  ...arcTestnet.paymentToken,
  address: import.meta.env?.VITE_ARC_TESTNET_USDC_ADDRESS || arcTestnet.paymentToken.address,
};

export function arcTxUrl(txHash = '') {
  return txHash ? `${ARC_TESTNET_CHAIN.explorerUrl}/tx/${txHash}` : '';
}

function assertAddress(address, label = 'address') {
  if (!isValidEvmAddress(address)) {
    throw new Error(`Invalid ${label}: ${address || '(empty)'}`);
  }
}

function strip0x(value = '') {
  return String(value).replace(/^0x/i, '');
}

function pad32(hexValue = '') {
  return strip0x(hexValue).padStart(64, '0');
}

function encodeAddress(address) {
  assertAddress(address, 'address');
  return pad32(address.toLowerCase());
}

function encodeUint256(value) {
  const big = BigInt(value);
  if (big < 0n) throw new Error('Amount must be positive.');
  return big.toString(16).padStart(64, '0');
}

export function rawAmountToArcUsdcUnits(rawAmount = 0) {
  const raw = BigInt(Math.max(0, Math.round(Number(rawAmount || 0))));
  const tokenBase = 10n ** BigInt(ARC_USDC.decimals);
  return raw * (tokenBase / BigInt(DISPLAY_UNITS_PER_USDC));
}

export function encodeArcUsdcTransfer(to, rawAmount) {
  const amount = rawAmountToArcUsdcUnits(rawAmount);

  if (amount <= 0n) {
    throw new Error('Payment amount must be greater than 0 USDC.');
  }

  return `${ERC20_TRANSFER_SELECTOR}${encodeAddress(to)}${encodeUint256(amount)}`;
}

export async function connectArcTestnetWallet() {
  return connectEvmWallet(ARC_TESTNET_CHAIN);
}

export async function sendArcTestnetUsdcPayment({ from, to, rawAmount, provider }) {
  const ethereum = provider || getActiveEvmProvider();

  if (!ethereum) {
    throw new Error('No EVM wallet found.');
  }

  assertAddress(from, 'customer wallet');
  assertAddress(to, 'store receiver wallet');
  assertAddress(ARC_USDC.address, 'Arc USDC token');

  await ensureEvmChain(ARC_TESTNET_CHAIN, ethereum);

  return ethereum.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: ARC_USDC.address,
        value: '0x0',
        data: encodeArcUsdcTransfer(to, rawAmount),
      },
    ],
  });
}

export async function waitForArcTestnetReceipt(txHash, { timeoutMs = 90000, intervalMs = 1000, provider } = {}) {
  const ethereum = provider || getActiveEvmProvider();

  if (!ethereum) {
    throw new Error('No EVM wallet found.');
  }

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const receipt = await ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt) return receipt;

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Transaction was submitted but no receipt was found yet. Check Arc explorer: ${arcTxUrl(txHash)}`);
}
