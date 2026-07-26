-- End-to-end storefront checkout, payment confirmation, and idempotent APoint awarding.

alter table orders add column if not exists payment_method text not null default 'usdc_arc';
alter table orders add column if not exists local_currency text;
alter table orders add column if not exists subtotal_local bigint;
alter table orders add column if not exists discount_local bigint not null default 0;
alter table orders add column if not exists tax_local bigint not null default 0;
alter table orders add column if not exists total_local bigint;
alter table orders add column if not exists exchange_rate numeric(24, 10);
alter table orders add column if not exists exchange_rate_base text default 'USDC';
alter table orders add column if not exists exchange_rate_quote text;
alter table orders add column if not exists exchange_rate_provider text;
alter table orders add column if not exists exchange_rate_fetched_at timestamptz;
alter table orders add column if not exists exchange_rate_expires_at timestamptz;
alter table orders add column if not exists total_usdc numeric(20, 6) not null default 0;
alter table orders add column if not exists apoint_eligible boolean not null default true;
alter table orders add column if not exists apoint_units integer not null default 0;
alter table orders add column if not exists apoint_awarded boolean not null default false;
alter table orders add column if not exists apoint_awarded_at timestamptz;
alter table orders add column if not exists apoint_transaction_id uuid;

alter table payments add column if not exists method text;
alter table payments add column if not exists payment_status text;
alter table payments add column if not exists chain_id bigint;
alter table payments add column if not exists payer_wallet text;
alter table payments add column if not exists recipient_wallet text;
alter table payments add column if not exists token_address text;
alter table payments add column if not exists amount_usdc numeric(20, 6);
alter table payments add column if not exists confirmed_at timestamptz;

alter table customers add column if not exists apoint_units integer not null default 0;
alter table apoint_ledger add column if not exists apoint_units integer;

do $$
begin
  alter table orders drop constraint if exists orders_payment_method_check;
  alter table orders add constraint orders_payment_method_check
    check (payment_method in ('usdc_arc', 'bank_transfer', 'cash', 'usdc', 'bank'));

  alter table orders drop constraint if exists orders_status_check;
  alter table orders add constraint orders_status_check
    check (status in ('cart', 'new', 'pending', 'confirmed', 'awaiting_payment', 'awaiting_confirmation', 'paid', 'cancelled', 'expired', 'refunded'));

  alter table orders drop constraint if exists orders_payment_status_check;
  alter table orders add constraint orders_payment_status_check
    check (payment_status in ('pending', 'submitted', 'awaiting_confirmation', 'pending_onchain', 'confirmed', 'paid', 'failed', 'cancelled', 'refunded'));

  alter table payments drop constraint if exists payments_status_check;
  alter table payments add constraint payments_status_check
    check (status in ('pending', 'submitted', 'awaiting_confirmation', 'confirmed', 'paid', 'failed', 'cancelled', 'refunded'));
end $$;

create unique index if not exists apoint_ledger_order_earn_once
  on apoint_ledger(order_id, type)
  where type = 'earn' and order_id is not null;

create index if not exists idx_orders_awaiting_confirmation
  on orders(store_id, payment_status, created_at desc)
  where payment_status in ('submitted', 'awaiting_confirmation');

create or replace function netpay_actor_can_confirm(p_store_id uuid, p_actor_wallet text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from stores
    where id = p_store_id
      and lower(coalesce(p_actor_wallet, '')) in (
        lower(coalesce(owner_wallet, '')),
        lower(coalesce(receiver_wallet, ''))
      )
  )
  or exists (
    select 1
    from store_staff
    where store_id = p_store_id
      and is_active = true
      and lower(wallet_address) = lower(coalesce(p_actor_wallet, ''))
  );
$$;

create or replace function netpay_award_apoint_for_paid_order(
  p_order_id uuid,
  p_actor_wallet text default null,
  p_tx_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_customer_id uuid;
  v_wallet text;
  v_units integer;
  v_ledger_id uuid;
  v_balance integer;
begin
  select * into v_order
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status <> 'paid' then
    raise exception 'order_not_paid';
  end if;

  if coalesce(v_order.apoint_awarded, false) then
    return jsonb_build_object('status', 'already_awarded', 'apoint_units', coalesce(v_order.apoint_units, 0));
  end if;

  if coalesce(v_order.apoint_eligible, true) = false then
    update orders
    set apoint_awarded = true,
        apoint_awarded_at = now(),
        apoint_units = 0,
        updated_at = now()
    where id = p_order_id;

    insert into audit_logs(actor_wallet, action, entity_type, entity_id, metadata)
    values (
      p_actor_wallet,
      'apoint_skipped',
      'order',
      p_order_id::text,
      jsonb_build_object('reason', 'not_eligible_without_exchange_rate')
    );

    return jsonb_build_object('status', 'skipped_not_eligible', 'apoint_units', 0);
  end if;

  v_units := greatest(0, coalesce(v_order.apoint_units, round(coalesce(v_order.total_usdc, 0) * 100)::integer));
  v_wallet := nullif(v_order.customer_wallet, '');

  if v_units <= 0 or v_wallet is null then
    update orders
    set apoint_awarded = true,
        apoint_awarded_at = now(),
        apoint_units = v_units,
        updated_at = now()
    where id = p_order_id;

    return jsonb_build_object('status', 'no_award', 'apoint_units', v_units);
  end if;

  select id, coalesce(apoint_units, 0) into v_customer_id, v_balance
  from customers
  where lower(wallet_address) = lower(v_wallet)
  limit 1;

  if v_customer_id is null then
    insert into customers(wallet_address, full_name, apoint_units, point_balance, total_spent)
    values (v_wallet, 'Wallet Customer', v_units, v_units, coalesce(v_order.total_amount, 0))
    returning id, apoint_units into v_customer_id, v_balance;
  else
    update customers
    set apoint_units = coalesce(apoint_units, 0) + v_units,
        point_balance = coalesce(point_balance, 0) + v_units,
        total_spent = coalesce(total_spent, 0) + coalesce(v_order.total_amount, 0),
        updated_at = now()
    where id = v_customer_id
    returning apoint_units into v_balance;
  end if;

  select id into v_ledger_id
  from apoint_ledger
  where order_id = v_order.id
    and type = 'earn'
  limit 1;

  if v_ledger_id is null then
    insert into apoint_ledger(wallet_address, store_id, order_id, type, points, apoint_units, balance_after, tx_hash, note)
    values (v_wallet, v_order.store_id, v_order.id, 'earn', v_units::numeric / 100, v_units, v_balance, p_tx_hash, 'Earned from ' || v_order.code)
    returning id into v_ledger_id;
  end if;

  update orders
  set apoint_units = v_units,
      apoint_awarded = true,
      apoint_awarded_at = now(),
      apoint_transaction_id = coalesce(v_ledger_id, apoint_transaction_id),
      updated_at = now()
  where id = p_order_id;

  insert into audit_logs(actor_wallet, action, entity_type, entity_id, metadata)
  values (
    p_actor_wallet,
    'apoint_awarded',
    'order',
    p_order_id::text,
    jsonb_build_object('apoint_units', v_units, 'customer_wallet', v_wallet, 'tx_hash', p_tx_hash)
  );

  return jsonb_build_object('status', 'awarded', 'apoint_units', v_units, 'ledger_id', v_ledger_id);
end;
$$;

create or replace function confirm_storefront_manual_payment(
  p_order_id uuid,
  p_actor_wallet text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_paid_at timestamptz := now();
  v_award jsonb;
begin
  select * into v_order
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if not netpay_actor_can_confirm(v_order.store_id, p_actor_wallet) then
    raise exception 'unauthorized_wallet';
  end if;

  if v_order.payment_method not in ('cash', 'bank_transfer', 'bank') then
    raise exception 'manual_confirmation_not_allowed_for_method';
  end if;

  if v_order.status = 'paid' or v_order.payment_status in ('confirmed', 'paid') then
    insert into audit_logs(actor_wallet, action, entity_type, entity_id, metadata)
    values (p_actor_wallet, 'payment_confirmation_duplicate', 'order', p_order_id::text, jsonb_build_object('payment_method', v_order.payment_method));
    v_award := netpay_award_apoint_for_paid_order(p_order_id, p_actor_wallet, null);
    return jsonb_build_object('status', 'already_confirmed', 'award', v_award);
  end if;

  update orders
  set status = 'paid',
      payment_status = 'confirmed',
      paid_at = v_paid_at,
      completed_at = coalesce(completed_at, v_paid_at),
      updated_at = v_paid_at
  where id = p_order_id;

  update payments
  set status = 'confirmed',
      payment_status = 'confirmed',
      confirmed_at = v_paid_at,
      paid_at = v_paid_at,
      raw_response = coalesce(raw_response, '{}'::jsonb) || jsonb_build_object(
        'mode', 'manual-store-confirmation',
        'confirmed_by_wallet', p_actor_wallet,
        'note', p_note
      )
  where order_id = p_order_id;

  insert into audit_logs(actor_wallet, action, entity_type, entity_id, metadata)
  values (
    p_actor_wallet,
    'payment_confirmed',
    'order',
    p_order_id::text,
    jsonb_build_object('payment_method', v_order.payment_method, 'note', p_note)
  );

  v_award := netpay_award_apoint_for_paid_order(p_order_id, p_actor_wallet, null);

  return jsonb_build_object('status', 'confirmed', 'award', v_award);
end;
$$;
