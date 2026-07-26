import { ensureEvmChain, getActiveEvmProvider, isValidEvmAddress } from './evmWallet.js';
import { ARC_TESTNET_CHAIN, arcTxUrl, waitForArcTestnetReceipt } from './arcPayment.js';

const RECORD_PAYMENT_SELECTOR = '0x78102d43';

export const APOINT_PAYMENT_PROOF_ADDRESS = import.meta.env?.VITE_APOINT_PAYMENT_PROOF_ADDRESS || '';

function assertAddress(address, label = 'address') {
  if (!isValidEvmAddress(address)) {
    throw new Error(`Invalid ${label}: ${address || '(empty)'}`);
  }
}

function assertNonZeroAddress(address, label = 'address') {
  assertAddress(address, label);

  if (/^0x0{40}$/i.test(String(address).trim())) {
    throw new Error(`Invalid ${label}: zero address. Deploy the Arc proof contract and set VITE_APOINT_PAYMENT_PROOF_ADDRESS.`);
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

function encodeString(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const hex = Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const paddedLength = Math.ceil(hex.length / 64) * 64;

  return `${encodeUint256(bytes.length)}${hex.padEnd(paddedLength, '0')}`;
}

export function encodeRecordPaymentData({
  invoiceId,
  customerWallet,
  storeWallet,
  amount,
  points,
}) {
  return [
    RECORD_PAYMENT_SELECTOR,
    encodeUint256(160),
    encodeAddress(customerWallet),
    encodeAddress(storeWallet),
    encodeUint256(amount),
    encodeUint256(points),
    encodeString(invoiceId),
  ].join('');
}

export async function recordApointPaymentProof({
  from,
  invoiceId,
  customerWallet,
  storeWallet,
  amount,
  points,
  provider,
}) {
  const ethereum = provider || getActiveEvmProvider();

  if (!ethereum) {
    throw new Error('No EVM wallet found.');
  }

  assertAddress(from, 'signer wallet');
  assertAddress(customerWallet, 'customer wallet');
  assertAddress(storeWallet, 'store receiver wallet');
  assertNonZeroAddress(APOINT_PAYMENT_PROOF_ADDRESS, 'ApointPaymentProof contract');

  await ensureEvmChain(ARC_TESTNET_CHAIN, ethereum);

  const txHash = await ethereum.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: APOINT_PAYMENT_PROOF_ADDRESS,
        value: '0x0',
        data: encodeRecordPaymentData({
          invoiceId,
          customerWallet,
          storeWallet,
          amount,
          points,
        }),
      },
    ],
  });

  const receipt = await waitForArcTestnetReceipt(txHash, { provider: ethereum });

  return {
    txHash,
    blockNumber: receipt?.blockNumber,
    chainId: ARC_TESTNET_CHAIN.chainIdDecimal,
    contractAddress: APOINT_PAYMENT_PROOF_ADDRESS,
    explorerUrl: arcTxUrl(txHash),
    receipt,
  };
}
