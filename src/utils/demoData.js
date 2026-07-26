import { DEFAULT_STAFF_WALLETS } from './roles.js';

const DEMO_RECEIVER_WALLET = '0x10832dbAc54F6EBD6133356e5277868aA36d32fb';

export const demoState = {
  store: {
    name: 'Minh Chau Grocery',
    branch: 'Da Nang Branch',
    network: 'Store payment network',
  },
  settings: {
    taxRate: 10,
    earnRate: '1 USDC paid = 1 point',
    redeemRate: '1 point = 0.01 USDC discount',
    maxRedeem: 'Max 20% of invoice total',
  },
  receiverWallet: DEMO_RECEIVER_WALLET,
  staff: DEFAULT_STAFF_WALLETS[0],
  staffMembers: DEFAULT_STAFF_WALLETS,
  categories: ['All', 'Drinks', 'Food', 'Condiments', 'Household', 'Snacks', 'Other'],
  products: [
    { id: 'P001', name: 'ChocoPie Cake', sku: 'CHOCO-PIE', barcode: '893000001001', category: 'Snacks', unit: 'box', price: 12000, costPrice: 9500, stock: 43, min: 15, emoji: '🍪', description: 'Chocolate pie snack', active: true },
    { id: 'P002', name: 'Coca-Cola Can 330ml', sku: 'COCA-330', barcode: '893000001002', category: 'Drinks', unit: 'can', price: 9000, costPrice: 7000, stock: 45, min: 20, emoji: '🥤', description: 'Soft drink can', active: true },
    { id: 'P003', name: 'Neptune Cooking Oil 1L', sku: 'NEPTUNE-1L', barcode: '893000001003', category: 'Condiments', unit: 'bottle', price: 42000, costPrice: 35000, stock: 28, min: 10, emoji: '🛢️', description: 'Cooking oil bottle', active: true },
    { id: 'P004', name: 'ST25 Rice 5kg', sku: 'GAO-ST25-5KG', barcode: '893000001004', category: 'Food', unit: 'bag', price: 155000, costPrice: 130000, stock: 21, min: 30, emoji: '🍚', description: 'Premium rice bag', active: true },
    { id: 'P005', name: 'Pulppy Toilet Paper', sku: 'PULPPY-10', barcode: '893000001005', category: 'Household', unit: 'pack', price: 35000, costPrice: 28000, stock: 26, min: 20, emoji: '🧻', description: 'Toilet paper pack', active: true },
    { id: 'P006', name: 'P/S Toothpaste', sku: 'PS-180G', barcode: '893000001006', category: 'Household', unit: 'tube', price: 18000, costPrice: 14000, stock: 35, min: 20, emoji: '🪥', description: 'Toothpaste tube', active: true },
  ],
  customers: [
    { id: 'C001', name: 'Wallet Customer', wallet: '0xf3a00000000000000000000000000000009b2c1d', points: 394, totalSpent: 409000, createdAt: new Date().toISOString() },
    { id: 'C002', name: 'Guest Wallet', wallet: '0x7b2e1af93c000000000000000000000000abc123', points: 128, totalSpent: 128000, createdAt: new Date().toISOString() },
  ],
  orders: [],
  payments: [],
  movements: [],
  pointsHistory: [],
  inventory: [],
  warehouses: [{ id: 'W001', name: 'Main Store', address: 'Da Nang Branch', active: true }],
  purchaseOrders: [],
};
