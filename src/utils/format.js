export const DISPLAY_UNITS_PER_USDC = 10000;
export const EARN_RAW_PER_POINT = DISPLAY_UNITS_PER_USDC;
export const POINT_VALUE_RAW = DISPLAY_UNITS_PER_USDC * 0.01;
export const POINTS_ONCHAIN_SCALE = 10000;

export function toUSDC(rawAmount = 0) {
  return Number(rawAmount || 0) / DISPLAY_UNITS_PER_USDC;
}

export function rawFromUSDC(amount = 0) {
  return Math.round(Number(amount || 0) * DISPLAY_UNITS_PER_USDC);
}

export function money(rawAmount = 0) {
  const value = toUSDC(rawAmount);
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} USDC`;
}

export function rawFromPoints(points = 0) {
  return Math.round(Number(points || 0) * POINT_VALUE_RAW);
}

export function pointsFromRaw(rawAmount = 0) {
  return Math.floor(Number(rawAmount || 0) / EARN_RAW_PER_POINT);
}

export function redeemablePointsFromRaw(rawAmount = 0) {
  return Math.floor(Number(rawAmount || 0) / POINT_VALUE_RAW);
}

export function formatPoints(points = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(points || 0));
}

export function pointsToOnchainUnits(points = 0) {
  return Math.round(Number(points || 0) * POINTS_ONCHAIN_SCALE);
}

export function shortAddress(address = '') {
  if (!address) return 'Not connected';
  const value = String(address);
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

export function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function makeMockTx() {
  return `0xarc_mock_${Date.now().toString(16)}`;
}
