# Supabase setup for Paynet Loyalty V1

## 1. Run schema

Open Supabase SQL Editor and run:

```text
supabase/netpay_v1_schema.sql
```

The file creates the app-compatible schema, demo seed data, V1 support tables, permissive demo RLS policies, and deployed Arc Testnet contract settings.

## 2. Add frontend keys

After the schema runs, put these values in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

Do not put the Supabase service role key in `.env` for the frontend.

## 3. Existing Arc settings

These V1 contract addresses are already seeded in the SQL and configured in `.env`:

```env
VITE_NETPAY_STORE_REGISTRY_ADDRESS=0xb1c1A8508A39028330Bc2f204557f89AbEF27eb1
VITE_APOINT_LEDGER_ADDRESS=0x3A94d77956b66c4B62FC3D8C9470439D3381CcAe
VITE_NETPAY_PAYMENT_REGISTRY_ADDRESS=0x2ecFAD44469Ebdc90B4939c889e7A9bDc39E8E14
```

## 4. Verify locally

Run:

```bash
npm run build
npm run dev
```

The status banner should change from local fallback mode to Supabase connected mode after the keys are set.
