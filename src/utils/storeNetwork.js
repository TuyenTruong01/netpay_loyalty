import roleAccess from '../config/roleAccess.json';

export const SYSTEM_ADMIN_WALLET = '0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2';

export const STORE_WALLETS = {
  grocery: {
    owner: '0x863FBd9eaC8D1001828B2502A71d9520Cf85636D',
    staff: '0xCb55bA6B93A54Ae9406710620cD0686BDce4522d',
  },
  coffee: {
    owner: '0xc8044822b1cBF8416489e5Fc676c7746E2515aC6',
    staff: '0x8F524d30238C1a5734ddd1Fc7470Fe72204539E8',
  },
  noodles: {
    owner: '0x1e09B25731eef93646A36aD03E20147D3dfF3214',
    staff: '0x34104D0684434918EFa4B87eeC291C38ae25B8A1',
  },
};

export const walletOptions = [
  { label: 'System Admin', wallet: SYSTEM_ADMIN_WALLET },
  { label: 'Grocery Owner', wallet: STORE_WALLETS.grocery.owner },
  { label: 'Grocery Staff', wallet: STORE_WALLETS.grocery.staff },
  { label: 'Coffee Owner', wallet: STORE_WALLETS.coffee.owner },
  { label: 'Coffee Staff', wallet: STORE_WALLETS.coffee.staff },
  { label: 'Noodle Owner', wallet: STORE_WALLETS.noodles.owner },
  { label: 'Noodle Staff', wallet: STORE_WALLETS.noodles.staff },
];

export const roleAccessConfig = roleAccess;

function staffRoleLabel(role = 'cashier') {
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  if (role === 'warehouse') return 'Warehouse';
  if (role === 'accountant') return 'Accountant';
  return 'Cashier';
}

function avatarFromName(name = 'ST') {
  return String(name || 'ST')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'ST';
}

export function applyRoleAccessToStores(stores = [], access = roleAccessConfig) {
  const entries = access?.stores || [];

  return stores.map(store => {
    const entry = entries.find(item => item.storeSlug === store.slug || item.storeId === store.id);
    if (!entry) return store;

    const ownerWallet = entry.owner?.wallet || store.ownerWallet;
    const ownerMember = {
      id: `${store.id}-json-owner`,
      name: entry.owner?.name || `${store.name} Owner`,
      role: 'Owner',
      roleKey: 'owner',
      wallet: ownerWallet,
      avatar: avatarFromName(entry.owner?.name || 'Owner'),
      active: true,
    };

    const staffMembers = (entry.staff || []).map((member, index) => ({
      id: `${store.id}-json-staff-${index}`,
      name: member.name || `Staff ${index + 1}`,
      role: staffRoleLabel(member.role),
      roleKey: member.role || 'cashier',
      wallet: member.wallet,
      avatar: avatarFromName(member.name || 'Staff'),
      active: member.active !== false,
    })).filter(member => member.wallet);

    return {
      ...store,
      ownerWallet,
      receiverWallet: entry.receiverWallet || ownerWallet || store.receiverWallet,
      staffMembers: [ownerMember, ...staffMembers],
    };
  });
}

export function roleAccessWalletOptions(access = roleAccessConfig, stores = []) {
  const storeNameBySlug = Object.fromEntries(stores.map(store => [store.slug, store.name]));
  const adminOptions = (access?.systemAdmins || []).map(admin => ({
    label: admin.label || 'System Admin',
    wallet: admin.wallet,
  }));

  const storeOptions = (access?.stores || []).flatMap(entry => {
    const storeName = storeNameBySlug[entry.storeSlug] || entry.storeSlug || 'Store';
    const ownerOption = entry.owner?.wallet ? [{
      label: `${storeName} Owner`,
      wallet: entry.owner.wallet,
    }] : [];
    const staffOptions = (entry.staff || []).map(member => ({
      label: `${storeName} ${staffRoleLabel(member.role)}`,
      wallet: member.wallet,
    }));

    return [...ownerOption, ...staffOptions];
  });

  return [...adminOptions, ...storeOptions].filter(option => option.wallet);
}

export function visibleStoresForWallet(stores = [], wallet = '', access = roleAccessConfig) {
  const role = resolveNetworkRole(stores, wallet, access);
  if (role.roleKey === 'system_admin') return stores;
  if (role.store) return [role.store];
  return [];
}

const sharedCustomers = [
  {
    id: 'C001',
    name: 'Wallet Customer',
    wallet: '0xf3a00000000000000000000000000000009b2c1d',
    points: 394,
    totalSpent: 409000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'C002',
    name: 'Guest Wallet',
    wallet: '0x7b2e1af93c000000000000000000000000abc123',
    points: 128,
    totalSpent: 128000,
    createdAt: new Date().toISOString(),
  },
];

const commonSettings = {
  taxRate: 10,
  earnRate: '1 USDC paid = 1 APoint',
  redeemRate: '1 APoint = 0.01 USDC discount',
  maxRedeem: 'Max 20% of invoice total',
};

export const initialNetworkStores = [
  {
    id: 'store-grocery',
    name: 'Minh Chau Grocery',
    branch: 'Da Nang Branch',
    type: 'Grocery',
    status: 'active',
    accent: '#5b35f5',
    imageFolder: '/png/stores/minh-chau-grocery/products',
    ownerWallet: STORE_WALLETS.grocery.owner,
    receiverWallet: STORE_WALLETS.grocery.owner,
    staffMembers: [
      { id: 'grocery-owner', name: 'Grocery Owner', role: 'Owner', roleKey: 'owner', wallet: STORE_WALLETS.grocery.owner, avatar: 'GO', active: true },
      { id: 'grocery-staff', name: 'Grocery Cashier', role: 'Cashier', roleKey: 'cashier', wallet: STORE_WALLETS.grocery.staff, avatar: 'GC', active: true },
    ],
    categories: ['All', 'Drinks', 'Food', 'Condiments', 'Household', 'Snacks'],
    warehouses: [{ id: 'store-grocery-main', name: 'Main Store', address: 'Da Nang Branch', status: 'active', active: true }],
    products: [
      { id: 'G001', name: 'ChocoPie Cake', sku: 'CHOCO-PIE', barcode: '893000001001', category: 'Snacks', unit: 'box', price: 12000, costPrice: 9500, stock: 43, min: 15, image: '/png/stores/minh-chau-grocery/products/chocopie-cake.png', emoji: '', description: 'Chocolate pie snack', active: true },
      { id: 'G002', name: 'Coca-Cola Can 330ml', sku: 'COCA-330', barcode: '893000001002', category: 'Drinks', unit: 'can', price: 9000, costPrice: 7000, stock: 45, min: 20, image: '/png/stores/minh-chau-grocery/products/coca-cola-can-330ml.png', emoji: '', description: 'Soft drink can', active: true },
      { id: 'G003', name: 'Neptune Cooking Oil 1L', sku: 'NEPTUNE-1L', barcode: '893000001003', category: 'Condiments', unit: 'bottle', price: 42000, costPrice: 35000, stock: 28, min: 10, image: '/png/stores/minh-chau-grocery/products/neptune-cooking-oil-1l.png', emoji: '', description: 'Cooking oil bottle', active: true },
      { id: 'G004', name: 'ST25 Rice 5kg', sku: 'ST25-5KG', barcode: '893000001004', category: 'Food', unit: 'bag', price: 155000, costPrice: 130000, stock: 21, min: 30, image: '/png/stores/minh-chau-grocery/products/st25-rice-5kg.png', emoji: '', description: 'Premium rice bag', active: true },
      { id: 'G005', name: 'Pulppy Toilet Paper', sku: 'PULPPY-10', barcode: '893000001005', category: 'Household', unit: 'pack', price: 35000, costPrice: 28000, stock: 26, min: 20, image: '/png/stores/minh-chau-grocery/products/pulppy-toilet-paper.png', emoji: '', description: 'Toilet paper pack', active: true },
    ],
  },
  {
    id: 'store-coffee',
    name: 'Morning Cafe',
    branch: 'Central Counter',
    type: 'Coffee',
    status: 'active',
    accent: '#0f766e',
    imageFolder: '/png/stores/morning-arc-cafe/products',
    ownerWallet: STORE_WALLETS.coffee.owner,
    receiverWallet: STORE_WALLETS.coffee.owner,
    staffMembers: [
      { id: 'coffee-owner', name: 'Cafe Owner', role: 'Owner', roleKey: 'owner', wallet: STORE_WALLETS.coffee.owner, avatar: 'CO', active: true },
      { id: 'coffee-staff', name: 'Cafe Barista', role: 'Cashier', roleKey: 'cashier', wallet: STORE_WALLETS.coffee.staff, avatar: 'CB', active: true },
    ],
    categories: ['All', 'Coffee', 'Tea', 'Bakery', 'Cold Drinks'],
    warehouses: [{ id: 'store-coffee-main', name: 'Main Counter', address: 'Central Counter', status: 'active', active: true }],
    products: [
      { id: 'C001', name: 'Americano', sku: 'AMERICANO', barcode: 'CAFE001', category: 'Coffee', unit: 'cup', price: 28000, costPrice: 12000, stock: 80, min: 20, image: '/png/stores/morning-arc-cafe/products/cafe-americano.png', emoji: '', description: 'Double shot espresso with hot water', active: true },
      { id: 'C002', name: 'Latte', sku: 'LATTE', barcode: 'CAFE002', category: 'Coffee', unit: 'cup', price: 38000, costPrice: 16000, stock: 70, min: 20, image: '/png/stores/morning-arc-cafe/products/cafe-latte.png', emoji: '', description: 'Espresso with steamed milk', active: true },
      { id: 'C003', name: 'Cold Brew', sku: 'COLD-BREW', barcode: 'CAFE003', category: 'Cold Drinks', unit: 'bottle', price: 42000, costPrice: 18000, stock: 36, min: 12, image: '/png/stores/morning-arc-cafe/products/cafe-cold-brew.png', emoji: '', description: 'Slow brewed cold coffee', active: true },
      { id: 'C004', name: 'Matcha Tea', sku: 'MATCHA', barcode: 'CAFE004', category: 'Tea', unit: 'cup', price: 40000, costPrice: 17000, stock: 52, min: 15, image: '/png/stores/morning-arc-cafe/products/cafe-matcha.png', emoji: '', description: 'Ceremonial matcha latte', active: true },
      { id: 'C005', name: 'Butter Croissant', sku: 'CROISSANT', barcode: 'CAFE005', category: 'Bakery', unit: 'piece', price: 32000, costPrice: 15000, stock: 24, min: 10, image: '/png/stores/morning-arc-cafe/products/cafe-croissant.png', emoji: '', description: 'Daily baked croissant', active: true },
    ],
  },
  {
    id: 'store-noodles',
    name: 'Golden Bowl Noodles',
    branch: 'Kitchen 01',
    type: 'Noodle Restaurant',
    status: 'active',
    accent: '#b45309',
    imageFolder: '/png/stores/golden-bowl-noodles/products',
    ownerWallet: STORE_WALLETS.noodles.owner,
    receiverWallet: STORE_WALLETS.noodles.owner,
    staffMembers: [
      { id: 'noodle-owner', name: 'Noodle Owner', role: 'Owner', roleKey: 'owner', wallet: STORE_WALLETS.noodles.owner, avatar: 'NO', active: true },
      { id: 'noodle-staff', name: 'Noodle Cashier', role: 'Cashier', roleKey: 'cashier', wallet: STORE_WALLETS.noodles.staff, avatar: 'NC', active: true },
    ],
    categories: ['All', 'Noodles', 'Sides', 'Drinks', 'Toppings'],
    warehouses: [{ id: 'store-noodles-main', name: 'Main Kitchen', address: 'Kitchen 01', status: 'active', active: true }],
    products: [
      { id: 'N001', name: 'Beef Noodle Bowl', sku: 'BEEF-NOODLE', barcode: 'NOODLE001', category: 'Noodles', unit: 'bowl', price: 65000, costPrice: 35000, stock: 50, min: 12, image: '/png/stores/golden-bowl-noodles/products/noodle-beef-bowl.png', emoji: '', description: 'Signature beef broth noodle bowl', active: true },
      { id: 'N002', name: 'Chicken Noodle Bowl', sku: 'CHICKEN-NOODLE', barcode: 'NOODLE002', category: 'Noodles', unit: 'bowl', price: 58000, costPrice: 30000, stock: 54, min: 12, image: '/png/stores/golden-bowl-noodles/products/noodle-chicken-bowl.png', emoji: '', description: 'Chicken broth with herbs', active: true },
      { id: 'N003', name: 'Spicy Dry Noodles', sku: 'SPICY-DRY', barcode: 'NOODLE003', category: 'Noodles', unit: 'bowl', price: 52000, costPrice: 26000, stock: 42, min: 10, image: '/png/stores/golden-bowl-noodles/products/noodle-spicy-dry.png', emoji: '', description: 'Dry noodles with chili oil', active: true },
      { id: 'N004', name: 'Spring Rolls', sku: 'ROLLS', barcode: 'NOODLE004', category: 'Sides', unit: 'plate', price: 30000, costPrice: 14000, stock: 30, min: 8, image: '/png/stores/golden-bowl-noodles/products/noodle-spring-rolls.png', emoji: '', description: 'Fresh rolls with dipping sauce', active: true },
      { id: 'N005', name: 'Iced Tea', sku: 'ICED-TEA', barcode: 'NOODLE005', category: 'Drinks', unit: 'glass', price: 12000, costPrice: 3000, stock: 120, min: 30, image: '/png/stores/golden-bowl-noodles/products/noodle-iced-tea.png', emoji: '', description: 'House iced tea', active: true },
    ],
  },
];

export function normalizeWallet(wallet = '') {
  return String(wallet || '').trim().toLowerCase();
}

export function isSystemAdmin(wallet = '', access = roleAccessConfig) {
  const normalized = normalizeWallet(wallet);
  if (!normalized) return false;
  const systemAdmins = Array.isArray(access) ? access : access?.systemAdmins;

  return (systemAdmins || []).some(admin => {
    const adminWallet = typeof admin === 'string' ? admin : admin?.wallet;
    const normalizedAdminWallet = normalizeWallet(adminWallet);
    return Boolean(normalizedAdminWallet) && normalizedAdminWallet === normalized;
  });
}

export function findStoreByWallet(stores = [], wallet = '', access = roleAccessConfig) {
  const normalized = normalizeWallet(wallet);
  if (!normalized) return null;

  return stores.find(store => {
    if (store.status === 'disabled') return false;
    const entry = (access?.stores || []).find(item => item.storeSlug === store.slug || item.storeId === store.id);
    if (!entry) return false;
    const ownerWallet = entry.owner?.wallet;
    const staffList = entry.staff || [];
    const ownerMatch = normalizeWallet(ownerWallet) === normalized;
    const staffMatch = staffList.some(member => normalizeWallet(member.wallet) === normalized && member.active !== false);
    return ownerMatch || staffMatch;
  }) || null;
}

export function resolveNetworkRole(stores = [], wallet = '', access = roleAccessConfig) {
  if (isSystemAdmin(wallet, access)) {
    return {
      roleKey: 'system_admin',
      role: 'System Admin',
      label: 'System Admin: network control',
      store: null,
      member: { name: 'System Admin', role: 'System Admin', roleKey: 'system_admin', wallet, avatar: 'SA', active: true },
    };
  }

  const store = findStoreByWallet(stores, wallet, access);
  if (!store) {
    return {
      roleKey: 'guest',
      role: 'Guest',
      label: 'No store access',
      store: null,
      member: null,
    };
  }

  const entry = (access?.stores || []).find(item => item.storeSlug === store.slug || item.storeId === store.id);
  if (!entry) {
    return {
      roleKey: 'guest',
      role: 'Guest',
      label: 'No store access',
      store: null,
      member: null,
    };
  }

  const ownerWallet = entry.owner?.wallet;
  const ownerMatch = normalizeWallet(ownerWallet) === normalizeWallet(wallet);
  const staffMember = (entry.staff || []).find(item => normalizeWallet(item.wallet) === normalizeWallet(wallet) && item.active !== false);
  const member = ownerMatch
    ? { name: entry?.owner?.name || `${store.name} Owner`, role: 'Owner', roleKey: 'owner', wallet, avatar: 'SO', active: true }
    : staffMember
      ? { name: staffMember.name, role: staffRoleLabel(staffMember.role), roleKey: staffMember.role || 'cashier', wallet, avatar: avatarFromName(staffMember.name), active: staffMember.active !== false }
      : null;

  if (!ownerMatch && !member) {
    return {
      roleKey: 'guest',
      role: 'Guest',
      label: 'No store access',
      store: null,
      member: null,
    };
  }

  return {
    roleKey: ownerMatch ? 'store_owner' : member?.roleKey || 'cashier',
    role: ownerMatch ? 'Store Owner' : member?.role || 'Cashier',
    label: ownerMatch ? 'Store Owner: staff and inventory control' : 'Staff: POS access',
    store,
    member,
  };
}

export function buildStoreState(store) {
  return {
    store: {
      id: store.id,
      name: store.name,
      branch: store.branch,
      network: 'Store payment network',
      type: store.type,
      status: store.status,
    },
    settings: commonSettings,
    receiverWallet: store.receiverWallet,
    staff: store.staffMembers[0],
    staffMembers: store.staffMembers,
    categoryRows: [],
    categories: store.categories,
    products: store.products,
    customers: sharedCustomers,
    orders: [],
    payments: [],
    movements: [],
    pointsHistory: [],
    inventory: [],
    warehouses: store.warehouses || [{ id: `${store.id}-main`, name: 'Main Store', address: store.branch, status: 'active', active: true }],
    purchaseOrders: [],
  };
}
