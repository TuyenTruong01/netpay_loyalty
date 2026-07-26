# Paynet APoint Loyalty

Paynet APoint Loyalty is a multi-store POS, checkout, inventory, and loyalty application built for Arc Testnet. Store staff can create invoices, customers can scan a QR checkout link, connect a wallet, pay with USDC on Arc, redeem APoint, and record a minimal on-chain payment proof.

The project combines a React/Vite frontend, Supabase operational data, WalletConnect/mobile wallet support, and a Solidity proof contract deployed for Arc Testnet demos.

## Problem

Small retail stores often manage sales, inventory, staff access, payment records, and loyalty balances across disconnected tools. This makes it difficult to audit payments, support wallet-native customers, or run loyalty programs across multiple store locations.

Paynet APoint focuses on these problems:

- Cashiers need a simple POS flow for creating invoices and checkout QR codes.
- Store owners need role-based access without a heavy back-office system.
- Customers need a mobile-friendly checkout page that supports wallet payment.
- Loyalty rewards should be tied to real paid amounts and remain easy to verify.
- Private order, customer, and inventory data should stay off-chain.
- Public blockchain data should only contain minimal payment proof.

## Solution

Paynet APoint provides a store operations dashboard and wallet checkout flow:

- Supabase stores stores, products, staff, orders, payments, inventory, customers, and APoint ledger data.
- Arc Testnet handles customer USDC payments.
- A Solidity contract emits `PaymentRecorded` events for payment proof.
- Wallet roles are resolved from `src/config/roleAccess.json`.
- The POS creates QR checkout links for customers.
- The public checkout page supports injected wallets, WalletConnect, and a mobile MetaMask Browser fallback.
- Demo mode allows local checkout testing without writing orders, inventory changes, or point balances to production Supabase tables.

## Key Features

- Multi-store System Admin console.
- Store owner and staff wallet-based access.
- POS invoice builder with product search, quantity controls, tax, totals, APoint redemption, and QR generation.
- Customer checkout page at `/checkout/:token`.
- Arc Testnet USDC payment flow.
- APoint payment proof transaction after wallet payment.
- Supabase payment status polling on the POS screen.
- Manual cash confirmation for non-wallet payments.
- Mobile wallet support through WalletConnect.
- iPhone/mobile fallback button to open checkout inside MetaMask Mobile Browser.
- Product catalog with image, SKU, barcode/QR field, category, unit, sell price, cost price, stock, description, and status.
- Product cards use contained square images to avoid cropping.
- Product and inventory delete actions with confirmation.
- Add/Edit Product accepts direct USDC decimal prices such as `1.2`.
- Category and Unit dropdown management inside the product modal.
- Inventory and warehouse views with low-stock indicators.
- Orders, revenue, best-seller, customer, points history, rewards, and settings pages.
- Local fallback data when Supabase is not configured.
- Demo button beside Connect Wallet for safe product and checkout previews.

## Tech Stack

- React
- Vite
- Supabase JavaScript client
- Hardhat
- Solidity `0.8.24`
- Arc Testnet
- EVM wallet provider API
- `@walletconnect/ethereum-provider`
- Lucide React icons
- Plain CSS in `src/styles.css`

## User Roles

Role access is configured in `src/config/roleAccess.json` and resolved in `src/utils/storeNetwork.js`.

| Role | Current access |
| --- | --- |
| System Admin | Can manage network stores and access store operation pages, including POS / Checkout. |
| Store Owner | Can manage POS, staff, products, inventory, warehouses, settings, and store operation pages for the assigned store. |
| Store Staff / Cashier | Can use operational pages such as POS, orders, customers, and inventory for the assigned store. |
| Guest / Unassigned Wallet | Cannot access store operations. |
| Demo Session | Can choose a store and create local demo checkout invoices without writing production orders or inventory changes. |
| Customer Wallet | Uses the public checkout page to connect a wallet, optionally redeem points, pay USDC, and receive updated loyalty data when using Supabase checkout. |

## Main Workflow

1. A user connects a wallet or starts Demo mode.
2. The app resolves the wallet role and active store.
3. Staff opens POS / Checkout.
4. Staff creates a new invoice and adds products.
5. The POS calculates subtotal, tax, point redemption, payable amount, and estimated APoint earning.
6. Staff generates a checkout QR/link.
7. Customer opens `/checkout/:token` from the QR/link.
8. Customer connects a wallet using injected provider, WalletConnect, or MetaMask Mobile Browser fallback.
9. If the wallet is on the wrong network, the app requests a switch to Arc Testnet.
10. Customer optionally redeems available APoint.
11. Customer pays USDC on Arc Testnet.
12. The app waits for the Arc payment receipt.
13. The app sends a proof transaction to `ApointPaymentProof`.
14. Supabase marks the order and payment as paid, stores payment/proof metadata, and updates customer points.
15. The POS polling loop detects the paid status and shows payment confirmation.

For cash payments, staff can use the manual cash confirmation path from the POS screen. This updates Supabase only and does not emit an Arc proof event.

## Demo Workflow

The header includes a `Demo` button beside `Connect Wallet`.

Demo mode:

- Does not require an approved wallet.
- Allows store selection.
- Allows POS invoice creation.
- Creates `demo-*` checkout tokens.
- Encodes demo invoice data into the checkout token so a phone can open the QR checkout page.
- Does not write demo orders to the main Supabase `orders` or `payments` tables.
- Does not subtract real inventory.
- Does not add real customer points.

## Loyalty Rules

Point math is implemented in `src/utils/format.js`.

- Display unit: `10,000` raw units = `1.00 USDC`.
- Earning: `1 USDC paid = 1 APoint`.
- Fractional points are supported. Example: `3.08 USDC = 3.08 APoint`.
- Redemption: `1 APoint = 0.01 USDC discount`.
- Redemption is capped at 20% of the invoice total.
- On-chain proof stores points as scaled integer units using `POINTS_ONCHAIN_SCALE = 10000`.

## Blockchain / Smart Contract Integration

The current blockchain integration targets Arc Testnet only.

| Item | Value |
| --- | --- |
| Chain | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas token | USDC |
| USDC token interface | `0x3600000000000000000000000000000000000000` |

### Payment Service

`src/services/arcPayment.js`:

- Connects through the active EVM provider.
- Uses the active WalletConnect provider when the customer connected through WalletConnect.
- Requests Arc Testnet chain switching when needed.
- Encodes ERC-20 `transfer(address,uint256)`.
- Sends USDC to the store receiver wallet.
- Waits for transaction receipts.
- Builds Arc explorer transaction links.

### Wallet Service

`src/services/evmWallet.js`:

- Supports injected wallets such as MetaMask Browser.
- Supports WalletConnect when no injected provider is available.
- Restores WalletConnect accounts on focus and visibility changes through the checkout page.
- Keeps wallet connection state even when automatic chain switching is not supported.
- Provides WalletConnect mobile wallet configuration for MetaMask.

### Proof Contract

Contract: `contracts/ApointPaymentProof.sol`

The proof contract emits:

```solidity
event PaymentRecorded(
    string invoiceId,
    address indexed customerWallet,
    address indexed storeWallet,
    uint256 amount,
    uint256 points,
    uint256 timestamp
);
```

The app records payment proof through `src/services/apointProofService.js`. The proof transaction hash is saved in Supabase when the full connected checkout flow is used.

## Database / Supabase Integration

Supabase is optional for local UI exploration and required for the full connected multi-store workflow.

Client configuration: `src/lib/supabaseClient.js`

Schema file: `supabase/paynet_schema.sql`

Main tables:

- `store_types`
- `product_statuses`
- `warehouse_statuses`
- `stores`
- `store_staff`
- `products`
- `warehouses`
- `inventory`
- `customers`
- `payment_networks`
- `payment_tokens`
- `store_payment_methods`
- `orders`
- `order_items`
- `payments`
- `apoint_ledger`
- `audit_logs`

The schema seeds Arc Testnet network/token rows, demo stores, staff wallets, products, warehouses, customers, and payment methods.

RLS is enabled, but the included policies are prototype policies for hackathon/demo use. They should be tightened before production.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

Windows:

```bash
copy .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Fill in the values from your Supabase project, WalletConnect project, and deployed proof contract.

### 3. Set up Supabase

1. Create a new Supabase project.
2. Open SQL Editor.
3. Run the full contents of `supabase/paynet_schema.sql`.
4. Copy the project URL and anon key into `.env`.

### 4. Deploy the proof contract

Make sure the deployer wallet has Arc Testnet USDC for gas.

```bash
npm run deploy:arc
```

Then set:

```env
VITE_APOINT_PAYMENT_PROOF_ADDRESS=
```

For the V1 contract set, run:

```bash
npm run deploy:netpay:arc
```

Then set the deployed addresses:

```env
VITE_NETPAY_STORE_REGISTRY_ADDRESS=
VITE_NETPAY_PAYMENT_REGISTRY_ADDRESS=
VITE_APOINT_LEDGER_ADDRESS=
```

### 5. Run the app

```bash
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

### 6. Build

```bash
npm run build
```

### 7. Preview production build

```bash
npm run preview
```

## Environment Variables

Use `.env.example` as the template.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxxx
VITE_ARC_TESTNET_CHAIN_ID=5042002
VITE_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_TESTNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_NETPAY_STORE_REGISTRY_ADDRESS=
VITE_NETPAY_PAYMENT_REGISTRY_ADDRESS=
VITE_APOINT_LEDGER_ADDRESS=
VITE_APOINT_PAYMENT_PROOF_ADDRESS=
VITE_WALLETCONNECT_PROJECT_ID=
ARC_RPC_URL=https://rpc.testnet.arc.network
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
```

Notes:

- Do not commit a real `DEPLOYER_PRIVATE_KEY`.
- `VITE_WALLETCONNECT_PROJECT_ID` is required for WalletConnect mobile checkout.
- `VITE_NETPAY_PAYMENT_REGISTRY_ADDRESS` makes checkout record through the V1 payment registry.
- `VITE_APOINT_PAYMENT_PROOF_ADDRESS` remains available as a legacy proof fallback when V1 registry is not configured.

## Demo Accounts / Wallets

These are public addresses for role access and seeded demo data. They are not private keys.

### System Admin

| Label | Wallet |
| --- | --- |
| System Admin | `0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2` |

### Stores

| Store | Role | Wallet |
| --- | --- | --- |
| Minh Chau Grocery | Owner / Receiver | `0x863FBd9eaC8D1001828B2502A71d9520Cf85636D` |
| Minh Chau Grocery | Cashier | `0xCb55bA6B93A54Ae9406710620cD0686BDce4522d` |
| Morning Cafe | Owner / Receiver | `0xc8044822b1cBF8416489e5Fc676c7746E2515aC6` |
| Morning Cafe | Cashier | `0x8F524d30238C1a5734ddd1Fc7470Fe72204539E8` |
| Golden Bowl Noodles | Owner / Receiver | `0x1e09B25731eef93646A36aD03E20147D3dfF3214` |
| Golden Bowl Noodles | Cashier | `0x34104D0684434918EFa4B87eeC291C38ae25B8A1` |

### Seeded Customer Wallets

| Label | Wallet |
| --- | --- |
| Wallet Customer | `0xf3a00000000000000000000000000000009b2c1d` |
| Guest Wallet | `0x7b2e1af93c000000000000000000000000abc123` |

## Project Structure

```text
.
|-- contracts/
|   `-- ApointPaymentProof.sol
|-- scripts/
|   |-- deployApointPaymentProof.js
|   `-- testRecordPaymentProof.js
|-- supabase/
|   `-- paynet_schema.sql
|-- public/
|   `-- png/
|-- src/
|   |-- chains/
|   |   |-- arcTestnet.js
|   |   `-- index.js
|   |-- components/
|   |   |-- Header.jsx
|   |   |-- POSPanel.jsx
|   |   |-- ProductGrid.jsx
|   |   |-- ProductModal.jsx
|   |   |-- Sidebar.jsx
|   |   `-- StatusBanner.jsx
|   |-- config/
|   |   `-- roleAccess.json
|   |-- lib/
|   |   `-- supabaseClient.js
|   |-- pages/
|   |   |-- CustomerCheckoutPage.jsx
|   |   |-- POSPage.jsx
|   |   |-- ProductsPage.jsx
|   |   |-- InventoryPage.jsx
|   |   |-- SystemAdminPage.jsx
|   |   `-- other dashboard and operation pages
|   |-- services/
|   |   |-- apointProofService.js
|   |   |-- arcPayment.js
|   |   |-- evmWallet.js
|   |   `-- paynetService.js
|   |-- utils/
|   |   |-- format.js
|   |   |-- storeNetwork.js
|   |   `-- supporting helpers
|   |-- App.jsx
|   |-- main.jsx
|   `-- styles.css
|-- hardhat.config.js
|-- package.json
`-- README.md
```

## Screenshots

Screenshots can be added under `docs/images`.

Suggested files:

- `docs/images/system-admin.png`
- `docs/images/store-pos.png`
- `docs/images/customer-checkout.png`
- `docs/images/payment-confirmed.png`
- `docs/images/products-inventory.png`
- `docs/images/points-history.png`

## Roadmap

- Replace prototype Supabase RLS policies with production-grade policies.
- Add automated tests for point math, checkout confirmation, and proof encoding.
- Add an admin/indexer view for Arc `PaymentRecorded` events.
- Add richer audit logging for product, inventory, and staff changes.
- Add production deployment documentation.
- Add Arc mainnet configuration when production addresses are available.

## Current Limitations

- Supabase policies in the included schema are permissive prototype policies.
- Demo mode is intentionally local/test-oriented and does not write production orders or inventory changes.
- Category and Unit management is currently derived from product data in the UI, not separate Supabase tables.
- Manual cash payments are recorded in Supabase only and do not emit Arc proof events.
- The proof contract emits events but does not maintain a full on-chain order registry.
- The app is configured for Arc Testnet.
