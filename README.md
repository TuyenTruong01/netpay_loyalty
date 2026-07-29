# Paynet Loyalty

Paynet Loyalty is an agent-ready, wallet-native commerce and loyalty platform built on Arc. It gives real-world merchants a mobile storefront, QR shopping entry point, USDC checkout on Arc, manual cash/bank confirmation, and a unified APoint rewards system.

The project is built for the Arc hackathon DeFi and Agentic Economy tracks. The public product name is **Paynet Loyalty**. The Solidity contract suite keeps the technical `NetPay*` names for compatibility with deployed contracts.

## Problem

Small merchants often run catalog, inventory, payment confirmation, customer identity, and loyalty balances across disconnected tools. A normal payment QR code usually contains only recipient/payment information, so customers still need a separate product catalog, cart, receipt, and reward flow.

Paynet Loyalty solves this by turning a merchant wallet and QR code into a complete storefront and checkout flow.

## Solution

- Each merchant has a wallet-linked storefront with products, local prices, inventory, payment methods, and order history.
- Customers scan a Paynet Loyalty QR or open `/s/:storeSlug`, browse products, build a cart, and choose cash, bank transfer, or USDC on Arc.
- USDC checkout records a local-currency to USDC exchange-rate snapshot before payment.
- Cash and bank transfer orders remain `awaiting_confirmation` until an owner/staff wallet confirms them.
- Arc USDC orders become paid only after wallet payment and Paynet Loyalty V1 registry confirmation.
- Paid orders award APoint once, with audit logs and duplicate-safe reward logic.

## DeFi Track Relevance

Paynet Loyalty is stablecoin-native merchant payment infrastructure:

- Uses Arc and USDC for direct customer-to-merchant settlement.
- Stores `total_local`, local currency, exchange-rate snapshot, and `total_usdc` for each storefront order.
- Records Arc transaction hashes and Paynet Loyalty V1 registry proof links.
- Keeps merchant sales non-custodial: USDC goes directly to the store wallet.
- Treats APoint as a programmable loyalty layer tied to verified USDC payment amounts.

## Agentic Economy Track Relevance

Paynet Loyalty includes agent surfaces for merchant and customer workflows:

- **Store Management Agent:** answers low-stock, order, sales, payment, and store-status questions from the store mobile UI.
- **Shopping Assistant Agent:** helps customers understand products, payments, APoint, and checkout options.
- **Checkout/Loyalty logic:** validates order/payment state and awards APoint after confirmed payment.

Agents do not sign wallet transactions, move merchant funds, delete products directly, or change owner wallets. They prepare safe answers and actions, and the user confirms sensitive operations through the UI.

## Current Working Features

- Desktop admin and operations dashboard.
- Store owner/staff wallet access.
- Store Mobile page at `/store-mobile`.
- Customer storefront at `/shop` and `/s/:storeSlug`.
- Explore and map views for active stores.
- Product publishing with local currency prices and Paynet Loyalty-listed quantity.
- QR storefront link/poster flow.
- Real Supabase orders, order items, payments, audit logs, and APoint ledger rows.
- Cash and bank transfer checkout with owner/staff confirmation.
- USDC on Arc checkout with wallet transaction and Paynet Loyalty V1 registry transaction.
- Supabase Edge Function `exchange-rate` for USDC/local-currency snapshots.
- APoint awarding after paid orders with idempotency protection.
- Presentation deck at `docs/Paynet_Loyalty_Checkpoint_2.pptx`.

## Architecture

```text
Customer / Store Mobile UI
        |
        v
React + Vite frontend
        |
        +-- Supabase client
        |      stores, products, orders, payments, exchange_rates,
        |      customers, apoint_ledger, audit_logs, agent_actions
        |
        +-- Supabase Edge Function
        |      exchange-rate
        |
        +-- EVM wallet provider
               Arc Testnet USDC transfer
               NetPayPaymentRegistry transaction
```

## Technology Stack

- React
- Vite
- Supabase JavaScript client
- Supabase SQL migrations
- Supabase Edge Functions
- Hardhat
- Solidity `0.8.24`
- Arc Testnet
- EVM wallet provider API
- WalletConnect
- Lucide React icons
- Plain CSS in `src/styles.css`

## Arc Testnet Configuration

| Item | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| Chain ID hex | `0x4cef52` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas token | USDC |
| USDC token interface | `0x3600000000000000000000000000000000000000` |

## Current Contract Addresses

These are Arc Testnet deployment addresses for the current V1 contract suite:

| Contract | Address |
| --- | --- |
| NetPayStoreRegistry | `0xb1c1A8508A39028330Bc2f204557f89AbEF27eb1` |
| APointLedger | `0x3A94d77956b66c4B62FC3D8C9470439D3381CcAe` |
| NetPayPaymentRegistry | `0x2ecFAD44469Ebdc90B4939c889e7A9bDc39E8E14` |

Deploy or test the current contracts with:

```bash
npm run compile:contracts
npm run test:netpay:v1
npm run deploy:netpay:arc
```

## Supabase Setup

For a fresh Supabase project:

1. Open Supabase SQL Editor.
2. Run `supabase/netpay_v1_schema.sql`.
3. Run the migration files in `supabase/migrations/` in filename order.
4. Deploy the exchange-rate Edge Function:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
npx supabase functions deploy exchange-rate
```

On Windows, if the Supabase npm wrapper cannot find its binary, install the platform binary locally for your machine only:

```bash
npm install --save-dev --include=optional @supabase/cli-windows-x64
./node_modules/@supabase/cli-windows-x64/bin/supabase.exe functions deploy exchange-rate
```

Do not commit `@supabase/cli-windows-x64` as a required dependency because Linux deploy hosts such as Vercel cannot install Windows-only packages.

The Edge Function uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side. Do not expose the service role key in frontend code.

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Windows CMD:

```bat
copy .env.example .env
```

Fill in:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_or_publishable_key
VITE_ARC_TESTNET_CHAIN_ID=5042002
VITE_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_TESTNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_NETPAY_STORE_REGISTRY_ADDRESS=0xb1c1A8508A39028330Bc2f204557f89AbEF27eb1
VITE_NETPAY_PAYMENT_REGISTRY_ADDRESS=0x2ecFAD44469Ebdc90B4939c889e7A9bDc39E8E14
VITE_APOINT_LEDGER_ADDRESS=0x3A94d77956b66c4B62FC3D8C9470439D3381CcAe
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
ARC_RPC_URL=https://rpc.testnet.arc.network
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
```

Do not commit `.env` or a real `DEPLOYER_PRIVATE_KEY`.

## Local Installation

```bash
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

Use a custom port if needed:

```bash
npm run dev -- --port 5178
```

## Windows Run Instructions

Option 1: double-click:

```text
RUN_LOCAL_WINDOWS.bat
```

Option 2: run from Git Bash or CMD in the project folder:

```bash
npm install
npm run dev -- --port 5178
```

The batch file uses only relative paths and calls `npm run dev`, so it can run on another Windows PC after dependencies are installed.

## Build

```bash
npm run build
```

## Main Demo Flow

1. Open `/store-mobile`.
2. Connect an owner/staff wallet or use read-only preview for navigation.
3. Confirm store payment methods and listed products.
4. Open `/shop` or `/s/minh-chau-grocery`.
5. Add products to cart.
6. Choose `USDC on Arc`.
7. Connect a wallet on Arc Testnet.
8. Confirm the order and pay USDC.
9. View the USDC transaction and Paynet Loyalty V1 registry transaction.
10. Refresh checkout/store mobile to see the order marked paid and APoint awarded.

## Repository Notes

- `supabase/.temp/`, `.env`, logs, build output, Hardhat artifacts, and editor files are ignored.
- The legacy proof fallback was removed. The current checkout path uses `NetPayPaymentRegistry`.
- `supabase/netpay_v1_schema.sql` is the current baseline schema. The old baseline schema was removed to avoid conflicting setup paths.
- Contract names such as `NetPayStoreRegistry` remain technical identifiers even though the public project name is Paynet Loyalty.
