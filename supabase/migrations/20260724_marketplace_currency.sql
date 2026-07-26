-- NetPay marketplace, local currency pricing, payment confirmation, and APoint units.
-- Run this in Supabase SQL editor after the original netpay_v1_schema.sql.

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  country_code text not null unique,
  country_name text not null,
  currency_code text not null,
  currency_symbol text not null default '',
  currency_decimals integer not null default 2,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into countries (country_code, country_name, currency_code, currency_symbol, currency_decimals, is_active)
values
  ('VN', 'Vietnam', 'VND', 'd', 0, true),
  ('US', 'United States', 'USD', '$', 2, true),
  ('SG', 'Singapore', 'SGD', '$', 2, true),
  ('TH', 'Thailand', 'THB', 'B', 2, true)
on conflict (country_code) do update set
  country_name = excluded.country_name,
  currency_code = excluded.currency_code,
  currency_symbol = excluded.currency_symbol,
  currency_decimals = excluded.currency_decimals,
  is_active = excluded.is_active;

alter table stores add column if not exists slug text;
alter table stores add column if not exists country_code text default 'VN';
alter table stores add column if not exists country_name text default 'Vietnam';
alter table stores add column if not exists currency_code text default 'VND';
alter table stores add column if not exists currency_symbol text default 'd';
alter table stores add column if not exists currency_decimals integer default 0;
alter table stores add column if not exists state_province text;
alter table stores add column if not exists city text;
alter table stores add column if not exists district text;
alter table stores add column if not exists ward text;
alter table stores add column if not exists street_address text;
alter table stores add column if not exists postal_code text;
alter table stores add column if not exists latitude numeric(10, 7);
alter table stores add column if not exists longitude numeric(10, 7);
alter table stores add column if not exists timezone text default 'Asia/Ho_Chi_Minh';
alter table stores add column if not exists phone text;
alter table stores add column if not exists opening_hours jsonb default '{}'::jsonb;
alter table stores add column if not exists map_visibility boolean not null default true;
alter table stores add column if not exists is_active boolean not null default true;

do $$
begin
  begin
    create extension if not exists postgis;
  exception when others then
    raise notice 'PostGIS is not available; latitude/longitude columns remain usable.';
  end;

  if exists (select 1 from pg_type where typname = 'geography') then
    alter table stores add column if not exists location geography(Point, 4326);
    update stores
      set location = st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
      where latitude is not null and longitude is not null and location is null;
  end if;
end $$;

update stores
set
  slug = coalesce(nullif(slug, ''), lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
  country_code = coalesce(country_code, 'VN'),
  country_name = coalesce(country_name, 'Vietnam'),
  currency_code = coalesce(currency_code, 'VND'),
  currency_symbol = coalesce(currency_symbol, 'd'),
  currency_decimals = coalesce(currency_decimals, 0),
  city = coalesce(city, split_part(coalesce(branch, ''), ' ', 1)),
  street_address = coalesce(street_address, branch),
  is_active = case when status = 'disabled' then false else coalesce(is_active, true) end;

alter table products add column if not exists local_price_minor bigint;
alter table products add column if not exists currency_code text;
alter table products add column if not exists price_usdc numeric(18, 6);
alter table products add column if not exists visible boolean not null default true;

update products
set
  local_price_minor = coalesce(local_price_minor, sell_price::bigint),
  currency_code = coalesce(currency_code, (select stores.currency_code from stores where stores.id = products.store_id limit 1)),
  visible = case when status = 'inactive' then false else coalesce(visible, true) end;

create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null,
  rate numeric(24, 10) not null,
  provider text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'fresh',
  raw_reference jsonb,
  created_at timestamptz not null default now()
);

create table if not exists store_payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  network_id uuid,
  token_id uuid,
  receiver_wallet text,
  is_active boolean not null default true,
  method text not null check (method in ('usdc_arc', 'bank_transfer', 'cash')),
  is_enabled boolean not null default true,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_qr_image text,
  arc_wallet_address text,
  cash_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, method)
);

alter table store_payment_methods add column if not exists network_id uuid;
alter table store_payment_methods add column if not exists token_id uuid;
alter table store_payment_methods add column if not exists receiver_wallet text;
alter table store_payment_methods add column if not exists is_active boolean not null default true;
alter table store_payment_methods add column if not exists method text;
alter table store_payment_methods add column if not exists is_enabled boolean not null default true;
alter table store_payment_methods add column if not exists bank_name text;
alter table store_payment_methods add column if not exists bank_account_name text;
alter table store_payment_methods add column if not exists bank_account_number text;
alter table store_payment_methods add column if not exists bank_qr_image text;
alter table store_payment_methods add column if not exists arc_wallet_address text;
alter table store_payment_methods add column if not exists cash_instructions text;
alter table store_payment_methods add column if not exists created_at timestamptz not null default now();
alter table store_payment_methods add column if not exists updated_at timestamptz not null default now();

alter table store_payment_methods alter column method set default 'usdc_arc';
update store_payment_methods
set
  method = coalesce(method, 'usdc_arc'),
  is_enabled = coalesce(is_enabled, is_active, true),
  arc_wallet_address = coalesce(arc_wallet_address, receiver_wallet)
where method is null or arc_wallet_address is null;
alter table store_payment_methods alter column method set not null;

do $$
begin
  alter table store_payment_methods
    add constraint store_payment_methods_method_check
    check (method in ('usdc_arc', 'bank_transfer', 'cash'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table store_payment_methods drop constraint if exists store_payment_methods_store_id_network_id_token_id_key;
  alter table store_payment_methods drop constraint if exists store_payment_methods_store_network_token_key;
  drop index if exists store_payment_methods_store_network_token_key;
end $$;

create unique index if not exists store_payment_methods_store_method_key
  on store_payment_methods(store_id, method);

insert into store_payment_methods (store_id, network_id, token_id, receiver_wallet, method, is_enabled, arc_wallet_address, cash_instructions)
select stores.id, payment_networks.id, payment_tokens.id, stores.receiver_wallet, 'usdc_arc', true, stores.receiver_wallet, null
from stores
left join payment_networks on payment_networks.code = 'arc-testnet'
left join payment_tokens on payment_tokens.network_id = payment_networks.id and payment_tokens.symbol = 'USDC'
on conflict (store_id, method) do update set
  network_id = excluded.network_id,
  token_id = excluded.token_id,
  receiver_wallet = excluded.receiver_wallet,
  arc_wallet_address = excluded.arc_wallet_address,
  is_enabled = true,
  updated_at = now();

insert into store_payment_methods (store_id, network_id, token_id, receiver_wallet, method, is_enabled, cash_instructions)
select stores.id, payment_networks.id, payment_tokens.id, stores.receiver_wallet, 'cash', true, 'Pay at counter. Store staff confirms after receiving cash.'
from stores
left join payment_networks on payment_networks.code = 'arc-testnet'
left join payment_tokens on payment_tokens.network_id = payment_networks.id and payment_tokens.symbol = 'USDC'
on conflict (store_id, method) do nothing;

insert into store_payment_methods (store_id, network_id, token_id, receiver_wallet, method, is_enabled, bank_name, bank_account_name, bank_account_number)
select stores.id, payment_networks.id, payment_tokens.id, stores.receiver_wallet, 'bank_transfer', true, 'Store bank', stores.name, null
from stores
left join payment_networks on payment_networks.code = 'arc-testnet'
left join payment_tokens on payment_tokens.network_id = payment_networks.id and payment_tokens.symbol = 'USDC'
on conflict (store_id, method) do nothing;

create table if not exists store_qr_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  qr_type text not null default 'storefront',
  target_url text not null,
  source_code text not null default 'store_qr',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists store_visits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  visitor_wallet text,
  session_id text,
  source text not null default 'direct',
  referrer text,
  visited_at timestamptz not null default now()
);

alter table orders add column if not exists local_currency text;
alter table orders add column if not exists subtotal_local bigint;
alter table orders add column if not exists discount_local bigint default 0;
alter table orders add column if not exists tax_local bigint default 0;
alter table orders add column if not exists total_local bigint;
alter table orders add column if not exists exchange_rate numeric(24, 10);
alter table orders add column if not exists exchange_rate_base text default 'USDC';
alter table orders add column if not exists exchange_rate_quote text;
alter table orders add column if not exists exchange_rate_provider text;
alter table orders add column if not exists exchange_rate_fetched_at timestamptz;
alter table orders add column if not exists exchange_rate_expires_at timestamptz;
alter table orders add column if not exists total_usdc numeric(18, 6);
alter table orders add column if not exists apoint_eligible boolean not null default true;
alter table orders add column if not exists apoint_units integer default 0;
alter table orders add column if not exists apoint_awarded boolean not null default false;
alter table orders add column if not exists apoint_awarded_at timestamptz;
alter table orders add column if not exists apoint_transaction_id uuid;

alter table payments add column if not exists method text;
alter table payments add column if not exists chain_id bigint;
alter table payments add column if not exists payer_wallet text;
alter table payments add column if not exists recipient_wallet text;
alter table payments add column if not exists token_address text;
alter table payments add column if not exists amount_usdc numeric(18, 6);
alter table payments add column if not exists confirmed_at timestamptz;

create index if not exists idx_stores_slug on stores(slug);
create index if not exists idx_stores_country_code on stores(country_code);
create index if not exists idx_stores_city on stores(city);
create index if not exists idx_stores_is_active on stores(is_active);
create index if not exists idx_exchange_rates_pair on exchange_rates(base_currency, quote_currency, expires_at desc);
create index if not exists idx_orders_store_id on orders(store_id);
create index if not exists idx_orders_payment_status on orders(payment_status);
create index if not exists idx_store_visits_store_id on store_visits(store_id);
create index if not exists idx_store_visits_visited_at on store_visits(visited_at desc);

alter table countries enable row level security;
alter table exchange_rates enable row level security;
alter table store_payment_methods enable row level security;
alter table store_qr_codes enable row level security;
alter table store_visits enable row level security;

do $$
begin
  create policy "Public can read active countries" on countries for select using (is_active = true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public can read exchange rates" on exchange_rates for select using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public can read enabled store payment methods" on store_payment_methods for select using (is_enabled = true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public can read active store QR codes" on store_qr_codes for select using (is_active = true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public can create store visits" on store_visits for insert with check (true);
exception when duplicate_object then null;
end $$;
