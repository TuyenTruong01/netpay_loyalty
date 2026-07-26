# Paynet Loyalty agent implementation map

## Current scaffold

The current mobile agents are implemented in:

```text
src/services/agentService.js
```

This file contains:

- `runStoreAgent`: Store Management Agent for low stock, sales, pending orders, and confirmation-required actions.
- `runShoppingAgent`: Shopping Assistant Agent for product recommendations, APoint explanation, and payment guidance.
- `logAgentAction`: writes every agent request/result to Supabase `agent_actions` when Supabase is configured.
- `loadCustomerByWallet`: loads customer APoint cache by wallet.

The mobile UI entry points are:

```text
src/pages/StoreMobilePage.jsx
src/pages/CustomerStorefrontPage.jsx
```

## Where to complete the real agent

For a production agent, keep API keys and model calls out of the frontend.

Recommended place:

```text
supabase/functions/netpay-agent/index.ts
```

The frontend should call this Edge Function. The Edge Function can:

- Read the store/customer context from Supabase.
- Call the model provider with a server-side API key.
- Run tool functions such as product search, low-stock lookup, sales summary, and cart suggestion.
- Write every tool call and decision to `agent_actions`.
- Return only the final answer and safe preview actions to the app.

## Suggested tool modules

Create these later when moving from scaffold to full agent:

```text
supabase/functions/netpay-agent/tools/storeTools.ts
supabase/functions/netpay-agent/tools/customerTools.ts
supabase/functions/netpay-agent/tools/auditTools.ts
```

Store tools:

- `list_low_stock`
- `list_pending_orders`
- `summarize_sales`
- `draft_product_update`
- `draft_quantity_adjustment`

Customer tools:

- `search_products`
- `recommend_products`
- `estimate_apoint`
- `explain_payment_options`
- `draft_cart`

Audit tools:

- `log_agent_action`
- `require_human_confirmation`

## Safety rule

Agents should never sign wallet transactions, move funds, change owner wallets, or delete products directly. They can prepare a preview, then the user confirms in the mobile UI.
