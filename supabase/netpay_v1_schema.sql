-- NetPay Loyalty V1 Supabase schema + seed data.
-- Run this whole file in Supabase SQL Editor.
-- This schema is compatible with the current React app and keeps V1 tables for
-- mobile storefront, direct Arc USDC settlement, APoint cache, reviews, agents,
-- and deployed contract settings.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.netpay_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.netpay_slugify(value text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(both '-' from lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'store');
$$;

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

create table if not exists public.store_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_statuses (
  code text primary key,
  name text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_statuses (
  code text primary key,
  name text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_networks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  chain_id bigint unique,
  rpc_url text,
  explorer_url text,
  native_symbol text not null default 'USDC',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_tokens (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.payment_networks(id) on delete cascade,
  symbol text not null,
  contract_address text,
  decimals integer not null default 6,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(network_id, symbol)
);

-- ---------------------------------------------------------------------------
-- Access and merchant network
-- ---------------------------------------------------------------------------

create table if not exists public.admin_wallets (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  label text not null default 'System Admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  branch text not null default 'Main Branch',
  branch_name text,
  store_type_id uuid references public.store_types(id),
  store_type text,
  status text not null default 'active' check (status in ('pending', 'active', 'suspended', 'disabled')),
  owner_wallet text not null,
  receiver_wallet text not null,
  image_folder text,
  accent text not null default '#2563eb',
  logo_url text,
  cover_url text,
  description text,
  bank_qr_url text,
  opening_status text not null default 'open' check (opening_status in ('open', 'busy', 'closed')),
  rating numeric(3,2) not null default 4.80,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stores_owner_wallet_key on public.stores(owner_wallet);
create index if not exists stores_status_idx on public.stores(status);

create table if not exists public.store_wallets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  wallet_address text not null,
  wallet_role text not null default 'owner' check (wallet_role in ('owner', 'receiver', 'operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, wallet_address, wallet_role)
);

create table if not exists public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  full_name text not null,
  role text not null default 'cashier' check (role in ('owner', 'manager', 'cashier', 'warehouse', 'accountant')),
  wallet_address text not null,
  avatar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, wallet_address)
);

create table if not exists public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  tax_rate numeric(5,2) not null default 10,
  earn_rate_label text not null default '1 USDC paid = 1 APoint',
  redeem_rate_label text not null default '1 APoint = 0.01 USDC discount',
  max_redeem_label text not null default 'Max 20% of invoice total',
  agent_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  network_id uuid not null references public.payment_networks(id),
  token_id uuid not null references public.payment_tokens(id),
  receiver_wallet text not null,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_qr_url text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, network_id, token_id)
);

-- ---------------------------------------------------------------------------
-- Catalog and inventory
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  sku text not null,
  barcode text,
  category text not null default 'Other',
  unit text not null default 'unit',
  sell_price bigint not null default 0 check (sell_price >= 0),
  cost_price bigint not null default 0 check (cost_price >= 0),
  price_usdc numeric(20,6) not null default 0,
  listed_quantity integer not null default 0 check (listed_quantity >= 0),
  stock_quantity numeric not null default 0 check (stock_quantity >= 0),
  min_stock numeric not null default 0 check (min_stock >= 0),
  image_url text,
  description text,
  visible boolean not null default true,
  featured boolean not null default false,
  status text not null default 'active' references public.product_statuses(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, sku)
);

create index if not exists products_store_status_idx on public.products(store_id, status);
create index if not exists products_store_visible_idx on public.products(store_id, visible);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  address text,
  status text not null default 'active' references public.warehouse_statuses(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, name)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  min_quantity numeric not null default 0 check (min_quantity >= 0),
  updated_at timestamptz not null default now(),
  unique(product_id, warehouse_id)
);

-- ---------------------------------------------------------------------------
-- Customers, orders, payments, APoint
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  wallet_address text unique not null,
  full_name text not null default 'Wallet Customer',
  point_balance numeric not null default 0 check (point_balance >= 0),
  total_spent bigint not null default 0 check (total_spent >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id),
  staff_id uuid references public.store_staff(id),
  code text unique not null,
  order_ref text unique,
  checkout_token text unique not null,
  customer_wallet text,
  payment_method text not null default 'usdc' check (payment_method in ('cash', 'bank', 'usdc')),
  subtotal bigint not null default 0 check (subtotal >= 0),
  subtotal_usdc numeric(20,6) not null default 0,
  tax_rate numeric(5,2) not null default 10,
  tax_amount bigint not null default 0 check (tax_amount >= 0),
  total_before_points bigint not null default 0 check (total_before_points >= 0),
  apoints_redeemed numeric not null default 0 check (apoints_redeemed >= 0),
  apoint_redeemed bigint not null default 0,
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  apoint_discount_usdc numeric(20,6) not null default 0,
  total_amount bigint not null default 0 check (total_amount >= 0),
  total_usdc numeric(20,6) not null default 0,
  apoints_earned numeric not null default 0 check (apoints_earned >= 0),
  status text not null default 'pending' check (status in ('new', 'pending', 'confirmed', 'paid', 'cancelled', 'refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'pending_onchain', 'pending_confirmation', 'paid', 'failed', 'refunded')),
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists orders_store_created_idx on public.orders(store_id, created_at desc);
create index if not exists orders_checkout_token_idx on public.orders(checkout_token);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  sku text,
  quantity numeric not null check (quantity > 0),
  unit_price bigint not null default 0 check (unit_price >= 0),
  unit_price_usdc numeric(20,6) not null default 0,
  total_price bigint not null default 0 check (total_price >= 0),
  line_total_usdc numeric(20,6) not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  network_id uuid references public.payment_networks(id),
  token_id uuid references public.payment_tokens(id),
  payer_wallet text,
  customer_wallet text,
  receiver_wallet text not null,
  store_wallet text,
  amount bigint not null default 0 check (amount >= 0),
  paid_usdc numeric(20,6),
  tx_hash text,
  chain_id bigint,
  contract_address text,
  token_address text,
  proof_tx_hash text,
  proof_contract_address text,
  contract_order_id text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'failed')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  verified_at timestamptz
);

create index if not exists payments_order_idx on public.payments(order_id);
create unique index if not exists payments_tx_hash_key on public.payments(tx_hash) where tx_hash is not null;

create table if not exists public.payment_verifications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  verifier_wallet text,
  chain_id bigint not null,
  tx_hash text not null,
  payment_registry_tx_hash text,
  payment_registry_address text,
  apoint_ledger_address text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists public.apoint_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  store_id uuid references public.stores(id),
  order_id uuid references public.orders(id),
  type text not null check (type in ('earn', 'redeem', 'adjust', 'refund')),
  points numeric not null,
  balance_after numeric,
  tx_hash text,
  proof_tx_hash text,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reviews, agents, audit, contract settings
-- ---------------------------------------------------------------------------

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_wallet text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  product_quality integer check (product_quality between 1 and 5),
  service_quality integer check (service_quality between 1 and 5),
  preparation_speed integer check (preparation_speed between 1 and 5),
  status text not null default 'published' check (status in ('published', 'flagged', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_wallet text,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  actor_wallet text,
  store_id uuid references public.stores(id) on delete set null,
  agent_type text not null check (agent_type in ('store_management', 'shopping_assistant', 'network_operations')),
  action_name text not null,
  risk_level text not null default 'read' check (risk_level in ('read', 'preview', 'confirm_required', 'blocked')),
  request jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  confirmation_status text not null default 'not_required' check (confirmation_status in ('not_required', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_wallet text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_settings (
  id smallint primary key default 1 check (id = 1),
  chain_id bigint not null,
  usdc_address text not null,
  store_registry_address text,
  payment_registry_address text,
  apoint_ledger_address text,
  deployed_by text,
  deployed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Compatibility migrations for databases that already ran an older draft.
-- ---------------------------------------------------------------------------

alter table public.stores add column if not exists branch_name text;
alter table public.stores add column if not exists store_type_id uuid references public.store_types(id);
alter table public.stores add column if not exists store_type text;
alter table public.stores add column if not exists receiver_wallet text;
alter table public.stores add column if not exists image_folder text;
alter table public.stores add column if not exists accent text not null default '#2563eb';
alter table public.stores add column if not exists opening_status text not null default 'open';
alter table public.stores add column if not exists rating numeric(3,2) not null default 4.80;
alter table public.stores add column if not exists review_count integer not null default 0;

alter table public.products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.products add column if not exists category text not null default 'Other';
alter table public.products add column if not exists unit text not null default 'unit';
alter table public.products add column if not exists sell_price bigint not null default 0;
alter table public.products add column if not exists cost_price bigint not null default 0;
alter table public.products add column if not exists price_usdc numeric(20,6) not null default 0;
alter table public.products alter column price_usdc set default 0;
alter table public.products add column if not exists listed_quantity integer not null default 0;
alter table public.products add column if not exists stock_quantity numeric not null default 0;
alter table public.products add column if not exists min_stock numeric not null default 0;
alter table public.products add column if not exists visible boolean not null default true;
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists status text not null default 'active' references public.product_statuses(code);

alter table public.customers add column if not exists store_id uuid references public.stores(id) on delete set null;
alter table public.customers add column if not exists point_balance numeric not null default 0;
alter table public.customers add column if not exists total_spent bigint not null default 0;
alter table public.customers add column if not exists is_active boolean not null default true;
alter table public.customers add column if not exists updated_at timestamptz not null default now();

alter table public.orders add column if not exists code text;
alter table public.orders add column if not exists order_ref text;
alter table public.orders add column if not exists checkout_token text;
alter table public.orders add column if not exists customer_id uuid references public.customers(id);
alter table public.orders add column if not exists staff_id uuid references public.store_staff(id);
alter table public.orders add column if not exists subtotal bigint not null default 0;
alter table public.orders add column if not exists subtotal_usdc numeric(20,6) not null default 0;
alter table public.orders alter column subtotal_usdc set default 0;
alter table public.orders add column if not exists tax_rate numeric(5,2) not null default 10;
alter table public.orders add column if not exists tax_amount bigint not null default 0;
alter table public.orders add column if not exists total_before_points bigint not null default 0;
alter table public.orders add column if not exists apoints_redeemed numeric not null default 0;
alter table public.orders add column if not exists apoint_redeemed bigint not null default 0;
alter table public.orders alter column apoint_redeemed set default 0;
alter table public.orders add column if not exists discount_amount bigint not null default 0;
alter table public.orders add column if not exists apoint_discount_usdc numeric(20,6) not null default 0;
alter table public.orders alter column apoint_discount_usdc set default 0;
alter table public.orders add column if not exists total_amount bigint not null default 0;
alter table public.orders add column if not exists total_usdc numeric(20,6) not null default 0;
alter table public.orders alter column total_usdc set default 0;
alter table public.orders add column if not exists apoints_earned numeric not null default 0;
alter table public.orders add column if not exists note text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders alter column order_ref drop not null;

alter table public.order_items add column if not exists sku text;
alter table public.order_items add column if not exists unit_price bigint not null default 0;
alter table public.order_items add column if not exists unit_price_usdc numeric(20,6) not null default 0;
alter table public.order_items alter column unit_price_usdc set default 0;
alter table public.order_items add column if not exists total_price bigint not null default 0;
alter table public.order_items add column if not exists line_total_usdc numeric(20,6) not null default 0;
alter table public.order_items alter column line_total_usdc set default 0;

alter table public.payments add column if not exists store_id uuid references public.stores(id) on delete cascade;
alter table public.payments add column if not exists network_id uuid references public.payment_networks(id);
alter table public.payments add column if not exists token_id uuid references public.payment_tokens(id);
alter table public.payments add column if not exists payer_wallet text;
alter table public.payments add column if not exists customer_wallet text;
alter table public.payments add column if not exists receiver_wallet text;
alter table public.payments add column if not exists store_wallet text;
alter table public.payments add column if not exists amount bigint not null default 0;
alter table public.payments add column if not exists paid_usdc numeric(20,6);
alter table public.payments add column if not exists chain_id bigint;
alter table public.payments add column if not exists contract_address text;
alter table public.payments add column if not exists token_address text;
alter table public.payments add column if not exists proof_tx_hash text;
alter table public.payments add column if not exists proof_contract_address text;
alter table public.payments add column if not exists contract_order_id text;
alter table public.payments add column if not exists verification_status text not null default 'pending';
alter table public.payments add column if not exists status text not null default 'pending';
alter table public.payments add column if not exists raw_response jsonb not null default '{}'::jsonb;
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments add column if not exists verified_at timestamptz;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'store_types', 'payment_networks', 'payment_tokens', 'admin_wallets',
    'stores', 'store_wallets', 'store_staff', 'store_settings',
    'store_payment_methods', 'categories', 'products', 'warehouses',
    'customers', 'orders', 'reviews', 'review_reports', 'contract_settings'
  ] loop
    execute format('drop trigger if exists trg_%1$s_touch_updated_at on public.%1$I', target_table);
    execute format(
      'create trigger trg_%1$s_touch_updated_at before update on public.%1$I for each row execute function public.netpay_touch_updated_at()',
      target_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed reference data
-- ---------------------------------------------------------------------------

insert into public.store_types(code, name, sort_order) values
  ('grocery', 'Grocery', 10),
  ('coffee', 'Coffee', 20),
  ('noodle_restaurant', 'Noodle Restaurant', 30),
  ('restaurant', 'Restaurant', 40),
  ('retail', 'Retail', 50)
on conflict (code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.product_statuses(code, name, sort_order) values
  ('active', 'Active', 10),
  ('inactive', 'Inactive', 20),
  ('discontinued', 'No longer produced', 30)
on conflict (code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.warehouse_statuses(code, name, sort_order) values
  ('active', 'Active', 10),
  ('inactive', 'Inactive', 20),
  ('discontinued', 'No longer used', 30)
on conflict (code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.payment_networks(code, name, chain_id, rpc_url, explorer_url, native_symbol) values
  ('arc-testnet', 'Arc Testnet', 5042002, 'https://rpc.testnet.arc.network', 'https://testnet.arcscan.app', 'USDC')
on conflict (code) do update set
  name = excluded.name,
  chain_id = excluded.chain_id,
  rpc_url = excluded.rpc_url,
  explorer_url = excluded.explorer_url,
  native_symbol = excluded.native_symbol,
  is_active = true;

with network as (
  select id from public.payment_networks where code = 'arc-testnet'
)
insert into public.payment_tokens(network_id, symbol, contract_address, decimals)
select id, 'USDC', '0x3600000000000000000000000000000000000000', 6
from network
on conflict (network_id, symbol) do update set
  contract_address = excluded.contract_address,
  decimals = excluded.decimals,
  is_active = true;

insert into public.admin_wallets(wallet_address, label, is_active) values
  ('0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2', 'System Admin', true),
  ('0x6bCA39aA6754537Cf7711a8d3DD698530F9458C5', 'NetPay V1 Deployer', true)
on conflict (wallet_address) do update set
  label = excluded.label,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Seed stores
-- ---------------------------------------------------------------------------

with seed(slug, name, branch, type_code, owner_wallet, image_folder, accent, description) as (
  values
    ('minh-chau-grocery', 'Minh Chau Grocery', 'Da Nang Branch', 'grocery', '0x863FBd9eaC8D1001828B2502A71d9520Cf85636D', '/png/stores/minh-chau-grocery/products', '#5b35f5', 'Neighborhood grocery with selected household essentials.'),
    ('morning-arc-cafe', 'Morning Cafe', 'Central Counter', 'coffee', '0xc8044822b1cBF8416489e5Fc676c7746E2515aC6', '/png/stores/morning-arc-cafe/products', '#0f766e', 'Coffee and bakery counter for fast mobile orders.'),
    ('golden-bowl-noodles', 'Golden Bowl Noodles', 'Kitchen 01', 'noodle_restaurant', '0x1e09B25731eef93646A36aD03E20147D3dfF3214', '/png/stores/golden-bowl-noodles/products', '#b45309', 'Noodle kitchen with direct pickup ordering.')
)
insert into public.stores(slug, name, branch, branch_name, store_type_id, store_type, owner_wallet, receiver_wallet, image_folder, accent, description, status, opening_status)
select
  seed.slug,
  seed.name,
  seed.branch,
  seed.branch,
  store_types.id,
  store_types.name,
  seed.owner_wallet,
  seed.owner_wallet,
  seed.image_folder,
  seed.accent,
  seed.description,
  'active',
  'open'
from seed
join public.store_types on store_types.code = seed.type_code
on conflict (slug) do update set
  name = excluded.name,
  branch = excluded.branch,
  branch_name = excluded.branch_name,
  store_type_id = excluded.store_type_id,
  store_type = excluded.store_type,
  owner_wallet = excluded.owner_wallet,
  receiver_wallet = excluded.receiver_wallet,
  image_folder = excluded.image_folder,
  accent = excluded.accent,
  description = excluded.description,
  status = excluded.status,
  opening_status = excluded.opening_status;

with stores_seed as (
  select id, slug, owner_wallet, receiver_wallet, branch from public.stores
)
insert into public.store_wallets(store_id, wallet_address, wallet_role, is_active)
select id, owner_wallet, 'owner', true from stores_seed
union all
select id, receiver_wallet, 'receiver', true from stores_seed
on conflict (store_id, wallet_address, wallet_role) do update set is_active = true;

with stores_seed as (
  select id, slug, owner_wallet from public.stores
)
insert into public.store_staff(store_id, full_name, role, wallet_address, avatar, is_active)
select id, 'Grocery Owner', 'owner', owner_wallet, 'GO', true from stores_seed where slug = 'minh-chau-grocery'
union all select id, 'Grocery Cashier', 'cashier', '0xCb55bA6B93A54Ae9406710620cD0686BDce4522d', 'GC', true from stores_seed where slug = 'minh-chau-grocery'
union all select id, 'Cafe Owner', 'owner', owner_wallet, 'CO', true from stores_seed where slug = 'morning-arc-cafe'
union all select id, 'Cafe Barista', 'cashier', '0x8F524d30238C1a5734ddd1Fc7470Fe72204539E8', 'CB', true from stores_seed where slug = 'morning-arc-cafe'
union all select id, 'Noodle Owner', 'owner', owner_wallet, 'NO', true from stores_seed where slug = 'golden-bowl-noodles'
union all select id, 'Noodle Cashier', 'cashier', '0x34104D0684434918EFa4B87eeC291C38ae25B8A1', 'NC', true from stores_seed where slug = 'golden-bowl-noodles'
on conflict (store_id, wallet_address) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  avatar = excluded.avatar,
  is_active = excluded.is_active;

insert into public.store_settings(store_id)
select id from public.stores
on conflict (store_id) do nothing;

with stores_seed as (
  select id, slug, branch from public.stores
)
insert into public.warehouses(store_id, name, address, status)
select id, 'Main Store', branch, 'active' from stores_seed where slug = 'minh-chau-grocery'
union all select id, 'Main Counter', branch, 'active' from stores_seed where slug = 'morning-arc-cafe'
union all select id, 'Main Kitchen', branch, 'active' from stores_seed where slug = 'golden-bowl-noodles'
on conflict (store_id, name) do update set
  address = excluded.address,
  status = excluded.status;

-- ---------------------------------------------------------------------------
-- Seed categories and products
-- Raw money convention: 10,000 raw units = 1.00 USDC.
-- ---------------------------------------------------------------------------

with product_seed(store_slug, category_name) as (
  values
    ('minh-chau-grocery', 'Snacks'),
    ('minh-chau-grocery', 'Drinks'),
    ('minh-chau-grocery', 'Condiments'),
    ('minh-chau-grocery', 'Food'),
    ('minh-chau-grocery', 'Household'),
    ('morning-arc-cafe', 'Coffee'),
    ('morning-arc-cafe', 'Cold Drinks'),
    ('morning-arc-cafe', 'Tea'),
    ('morning-arc-cafe', 'Bakery'),
    ('golden-bowl-noodles', 'Noodles'),
    ('golden-bowl-noodles', 'Sides'),
    ('golden-bowl-noodles', 'Drinks')
)
insert into public.categories(store_id, name, sort_order)
select stores.id, product_seed.category_name, 100
from product_seed
join public.stores on stores.slug = product_seed.store_slug
on conflict (store_id, name) do update set is_active = true;

with seed(store_slug, name, sku, barcode, category, unit, sell_price, cost_price, stock_quantity, min_stock, image_file, description, featured) as (
  values
    ('minh-chau-grocery','ChocoPie Cake','CHOCO-PIE','893000001001','Snacks','box',12000,9500,43,15,'chocopie-cake.png','Chocolate pie snack', true),
    ('minh-chau-grocery','Coca-Cola Can 330ml','COCA-330','893000001002','Drinks','can',9000,7000,45,20,'coca-cola-can-330ml.png','Soft drink can', true),
    ('minh-chau-grocery','Neptune Cooking Oil 1L','NEPTUNE-1L','893000001003','Condiments','bottle',42000,35000,28,10,'cooking-oil-1l.png','Cooking oil bottle', false),
    ('minh-chau-grocery','ST25 Rice 5kg','ST25-5KG','893000001004','Food','bag',155000,130000,21,30,'rice-bag-5kg.png','Premium rice bag', true),
    ('minh-chau-grocery','Pulppy Toilet Paper','PULPPY-10','893000001005','Household','pack',35000,28000,26,20,'tissue-box.png','Toilet paper pack', false),
    ('morning-arc-cafe','Americano','AMERICANO','CAFE001','Coffee','cup',28000,12000,80,20,'iced-black-coffee.png','Double shot espresso with hot water', true),
    ('morning-arc-cafe','Latte','LATTE','CAFE002','Coffee','cup',38000,16000,70,20,'hot-latte.png','Espresso with steamed milk', true),
    ('morning-arc-cafe','Cold Brew','COLD-BREW','CAFE003','Cold Drinks','bottle',42000,18000,36,12,'iced-milk-coffee.png','Slow brewed cold coffee', false),
    ('morning-arc-cafe','Matcha Tea','MATCHA','CAFE004','Tea','cup',40000,17000,52,15,'matcha-latte.png','Ceremonial matcha latte', true),
    ('morning-arc-cafe','Butter Croissant','CROISSANT','CAFE005','Bakery','piece',32000,15000,24,10,'cappuccino.png','Daily baked croissant', false),
    ('golden-bowl-noodles','Beef Noodle Bowl','BEEF-NOODLE','NOODLE001','Noodles','bowl',65000,35000,50,12,'beef-special-noodle.png','Signature beef broth noodle bowl', true),
    ('golden-bowl-noodles','Chicken Noodle Bowl','CHICKEN-NOODLE','NOODLE002','Noodles','bowl',58000,30000,54,12,'chicken-noodle.png','Chicken broth with herbs', true),
    ('golden-bowl-noodles','Spicy Dry Noodles','SPICY-DRY','NOODLE003','Noodles','bowl',52000,26000,42,10,'spicy-noodle.png','Dry noodles with chili oil', true),
    ('golden-bowl-noodles','Spring Rolls','ROLLS','NOODLE004','Sides','plate',30000,14000,30,8,'steamed-dumplings.png','Fresh rolls with dipping sauce', false),
    ('golden-bowl-noodles','Iced Tea','ICED-TEA','NOODLE005','Drinks','glass',12000,3000,120,30,'extra-egg-bowl.png','House iced tea', false)
),
resolved as (
  select
    stores.id as store_id,
    categories.id as category_id,
    seed.name,
    seed.sku,
    seed.barcode,
    seed.category,
    seed.unit,
    seed.sell_price,
    seed.cost_price,
    seed.stock_quantity,
    seed.stock_quantity::integer as listed_quantity,
    seed.min_stock,
    stores.image_folder || '/' || seed.image_file as image_url,
    seed.description,
    seed.featured
  from seed
  join public.stores on stores.slug = seed.store_slug
  left join public.categories on categories.store_id = stores.id and categories.name = seed.category
)
insert into public.products(
  store_id, category_id, name, sku, barcode, category, unit, sell_price, price_usdc,
  cost_price, stock_quantity, listed_quantity, min_stock, image_url, description,
  visible, featured, status
)
select
  store_id, category_id, name, sku, barcode, category, unit, sell_price, sell_price::numeric / 10000,
  cost_price, stock_quantity, listed_quantity, min_stock, image_url, description,
  true, featured, 'active'
from resolved
on conflict (store_id, sku) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  barcode = excluded.barcode,
  category = excluded.category,
  unit = excluded.unit,
  sell_price = excluded.sell_price,
  price_usdc = excluded.price_usdc,
  cost_price = excluded.cost_price,
  stock_quantity = excluded.stock_quantity,
  listed_quantity = excluded.listed_quantity,
  min_stock = excluded.min_stock,
  image_url = excluded.image_url,
  description = excluded.description,
  visible = excluded.visible,
  featured = excluded.featured,
  status = excluded.status;

with stock_rows as (
  select products.store_id, products.id as product_id, warehouses.id as warehouse_id, products.stock_quantity, products.min_stock
  from public.products
  join public.warehouses on warehouses.store_id = products.store_id
)
insert into public.inventory(store_id, product_id, warehouse_id, quantity, min_quantity)
select store_id, product_id, warehouse_id, stock_quantity, min_stock
from stock_rows
on conflict (product_id, warehouse_id) do update set
  quantity = excluded.quantity,
  min_quantity = excluded.min_quantity;

-- ---------------------------------------------------------------------------
-- Seed customers, payment methods, contracts
-- ---------------------------------------------------------------------------

insert into public.customers(wallet_address, full_name, point_balance, total_spent, is_active) values
  ('0xf3a00000000000000000000000000000009b2c1d', 'Wallet Customer', 394, 409000, true),
  ('0x7b2e1af93c000000000000000000000000abc123', 'Guest Wallet', 128, 128000, true)
on conflict (wallet_address) do update set
  full_name = excluded.full_name,
  is_active = excluded.is_active;

insert into public.store_payment_methods(store_id, network_id, token_id, receiver_wallet, is_default, is_active)
select stores.id, payment_networks.id, payment_tokens.id, stores.receiver_wallet, true, true
from public.stores
join public.payment_networks on payment_networks.code = 'arc-testnet'
join public.payment_tokens on payment_tokens.network_id = payment_networks.id and payment_tokens.symbol = 'USDC'
on conflict (store_id, network_id, token_id) do update set
  receiver_wallet = excluded.receiver_wallet,
  is_default = true,
  is_active = true;

insert into public.contract_settings(
  id,
  chain_id,
  usdc_address,
  store_registry_address,
  payment_registry_address,
  apoint_ledger_address,
  deployed_by,
  deployed_at
) values (
  1,
  5042002,
  '0x3600000000000000000000000000000000000000',
  '0xb1c1A8508A39028330Bc2f204557f89AbEF27eb1',
  '0x2ecFAD44469Ebdc90B4939c889e7A9bDc39E8E14',
  '0x3A94d77956b66c4B62FC3D8C9470439D3381CcAe',
  '0x6bCA39aA6754537Cf7711a8d3DD698530F9458C5',
  '2026-07-23T00:00:00Z'
)
on conflict (id) do update set
  chain_id = excluded.chain_id,
  usdc_address = excluded.usdc_address,
  store_registry_address = excluded.store_registry_address,
  payment_registry_address = excluded.payment_registry_address,
  apoint_ledger_address = excluded.apoint_ledger_address,
  deployed_by = excluded.deployed_by,
  deployed_at = excluded.deployed_at;

-- ---------------------------------------------------------------------------
-- Useful views
-- ---------------------------------------------------------------------------

create or replace view public.netpay_storefront_products as
select
  stores.id as store_id,
  stores.slug as store_slug,
  stores.name as store_name,
  products.id as product_id,
  products.name,
  products.sku,
  products.barcode,
  products.category,
  products.unit,
  products.price_usdc,
  products.listed_quantity,
  products.image_url,
  products.description,
  products.featured,
  products.visible,
  products.status
from public.stores
join public.products on products.store_id = stores.id
where stores.status = 'active'
  and products.visible = true
  and products.status = 'active';

create or replace view public.netpay_payment_report as
select
  payments.id as payment_id,
  orders.code as order_code,
  stores.name as store_name,
  payments.chain_id,
  payments.tx_hash,
  payments.proof_tx_hash,
  payments.status,
  payments.amount,
  payments.paid_usdc,
  payments.created_at,
  payments.paid_at
from public.payments
join public.orders on orders.id = payments.order_id
join public.stores on stores.id = payments.store_id;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- These policies are intentionally open for hackathon/demo use because the
-- current frontend writes directly with the anon key. Replace with wallet-aware
-- Edge Functions and stricter policies before production.

alter table public.store_types enable row level security;
alter table public.product_statuses enable row level security;
alter table public.warehouse_statuses enable row level security;
alter table public.payment_networks enable row level security;
alter table public.payment_tokens enable row level security;
alter table public.admin_wallets enable row level security;
alter table public.stores enable row level security;
alter table public.store_wallets enable row level security;
alter table public.store_staff enable row level security;
alter table public.store_settings enable row level security;
alter table public.store_payment_methods enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_verifications enable row level security;
alter table public.apoint_ledger enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.agent_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.contract_settings enable row level security;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'store_types', 'product_statuses', 'warehouse_statuses', 'payment_networks',
    'payment_tokens', 'admin_wallets', 'stores', 'store_wallets', 'store_staff',
    'store_settings', 'store_payment_methods', 'categories', 'products',
    'product_images', 'warehouses', 'inventory', 'customers', 'orders',
    'order_items', 'payments', 'payment_verifications', 'apoint_ledger',
    'reviews', 'review_reports', 'agent_actions', 'audit_logs',
    'contract_settings'
  ] loop
    execute format('drop policy if exists "netpay_demo_all_%1$s" on public.%1$I', target_table);
    execute format('create policy "netpay_demo_all_%1$s" on public.%1$I for all using (true) with check (true)', target_table);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select on all sequences in schema public to anon, authenticated;
