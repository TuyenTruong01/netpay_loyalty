# Single-wallet refactor

The active model is now one store = one primary wallet.

## Source of truth

- Store authorization: `stores.owner_wallet`
- USDC receiver: the same `stores.owner_wallet`
- Manual payment confirmation: the same `stores.owner_wallet`

## Removed

- `src/config/roleAccess.json`
- `src/utils/roles.js`
- `src/pages/StaffPage.jsx`
- Staff navigation and active staff authorization

## Compatibility kept temporarily

- `stores.receiver_wallet` remains synchronized with `owner_wallet`.
- `store_staff` remains in the database for historical foreign-key compatibility, but its rows are deactivated by the new migration.
- Frontend `receiverWallet` props remain as aliases in checkout components to avoid a broad breaking rename. Their value now comes from `ownerWallet`.

## Database deployment

Run migrations in filename order, including:

`supabase/migrations/20260806_single_store_wallet.sql`

Then redeploy the frontend so Vite uses the current Supabase environment variables.
