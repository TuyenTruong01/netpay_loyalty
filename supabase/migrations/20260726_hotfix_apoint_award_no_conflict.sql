-- Hotfix: avoid relying on a partial unique index for APoint award idempotency.
-- Run this in Supabase SQL Editor if checkout confirmation fails with:
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".

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
