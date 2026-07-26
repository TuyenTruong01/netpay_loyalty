import { ensureEvmChain, getActiveEvmProvider, isValidEvmAddress } from './evmWallet.js';
import { ARC_TESTNET_CHAIN, arcTxUrl, rawAmountToArcUsdcUnits, waitForArcTestnetReceipt } from './arcPayment.js';
import { rawFromPoints } from '../utils/format.js';

const RECORD_PAYMENT_SELECTOR = '0xf1678d99';

export const NETPAY_PAYMENT_REGISTRY_ADDRESS = import.meta.env?.VITE_NETPAY_PAYMENT_REGISTRY_ADDRESS || '';
export const APOINT_LEDGER_ADDRESS = import.meta.env?.VITE_APOINT_LEDGER_ADDRESS || '';

function assertAddress(address, label = 'address') {
  if (!isValidEvmAddress(address)) {
    throw new Error(`Invalid ${label}: ${address || '(empty)'}`);
  }
}

function assertConfiguredAddress(address, label) {
  assertAddress(address, label);

  if (/^0x0{40}$/i.test(String(address).trim())) {
    throw new Error(`${label} is not configured. Deploy NetPay V1 and set the address in .env.`);
  }
}

function strip0x(value = '') {
  return String(value).replace(/^0x/i, '');
}

function encodeUint256(value) {
  const big = BigInt(value);
  if (big < 0n) throw new Error('Value must be positive.');
  return big.toString(16).padStart(64, '0');
}

function encodeAddress(address) {
  assertAddress(address, 'address');
  return strip0x(address.toLowerCase()).padStart(64, '0');
}

function textToBytes32(value = '') {
  const bytes = new TextEncoder().encode(String(value || ''));
  let hash = 0xcbf29ce484222325n;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & ((1n << 256n) - 1n);
  }

  return hash.toString(16).padStart(64, '0');
}

function encodeBytes32(value) {
  const text = String(value || '');
  if (/^0x[a-fA-F0-9]{64}$/.test(text)) return strip0x(text);
  return textToBytes32(text);
}

export function hasNetPayV1RegistryConfig() {
  return isValidEvmAddress(NETPAY_PAYMENT_REGISTRY_ADDRESS) && !/^0x0{40}$/i.test(NETPAY_PAYMENT_REGISTRY_ADDRESS);
}

export function encodeNetPayRecordPaymentData({
  orderId,
  storeId,
  customerWallet,
  storeWallet,
  grossAmount,
  paidAmount,
  pointsRedeemed,
  txReference,
}) {
  const grossTokenUnits = rawAmountToArcUsdcUnits(grossAmount);
  const paidTokenUnits = rawAmountToArcUsdcUnits(paidAmount);
  const redeemed = BigInt(Math.floor(Number(pointsRedeemed || 0)));
  const discountTokenUnits = rawAmountToArcUsdcUnits(rawFromPoints(Number(redeemed)));

  if (grossTokenUnits !== paidTokenUnits + discountTokenUnits) {
    throw new Error('NetPay V1 payment totals do not match the APoint redemption discount.');
  }

  return [
    RECORD_PAYMENT_SELECTOR,
    encodeBytes32(orderId),
    encodeBytes32(storeId),
    encodeAddress(customerWallet),
    encodeAddress(storeWallet),
    encodeUint256(grossTokenUnits),
    encodeUint256(paidTokenUnits),
    encodeUint256(redeemed),
    encodeBytes32(txReference),
  ].join('');
}

export async function recordNetPayV1Payment({
  from,
  orderId,
  storeId,
  customerWallet,
  storeWallet,
  grossAmount,
  paidAmount,
  pointsRedeemed,
  txReference,
  provider,
}) {
  const ethereum = provider || getActiveEvmProvider();

  if (!ethereum) {
    throw new Error('No EVM wallet found.');
  }

  assertAddress(from, 'signer wallet');
  assertAddress(customerWallet, 'customer wallet');
  assertAddress(storeWallet, 'store receiver wallet');
  assertConfiguredAddress(NETPAY_PAYMENT_REGISTRY_ADDRESS, 'NetPayPaymentRegistry contract');

  await ensureEvmChain(ARC_TESTNET_CHAIN, ethereum);

  const txHash = await ethereum.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: NETPAY_PAYMENT_REGISTRY_ADDRESS,
        value: '0x0',
        data: encodeNetPayRecordPaymentData({
          orderId,
          storeId,
          customerWallet,
          storeWallet,
          grossAmount,
          paidAmount,
          pointsRedeemed,
          txReference,
        }),
      },
    ],
  });

  const receipt = await waitForArcTestnetReceipt(txHash, { provider: ethereum });

  return {
    txHash,
    blockNumber: receipt?.blockNumber,
    chainId: ARC_TESTNET_CHAIN.chainIdDecimal,
    contractAddress: NETPAY_PAYMENT_REGISTRY_ADDRESS,
    pointLedgerAddress: APOINT_LEDGER_ADDRESS,
    explorerUrl: arcTxUrl(txHash),
    receipt,
  };
}
