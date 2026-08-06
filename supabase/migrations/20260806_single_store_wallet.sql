begin;

-- One store has one primary wallet. Keep legacy receiver fields synchronized
-- so existing checkout code and historical records continue to work.
update public.stores
set receiver_wallet = owner_wallet,
    updated_at = now()
where receiver_wallet is distinct from owner_wallet;

update public.store_payment_methods spm
set receiver_wallet = s.owner_wallet,
    arc_wallet_address = case
      when spm.method = 'usdc_arc' then s.owner_wallet
      else spm.arc_wallet_address
    end,
    updated_at = now()
from public.stores s
where spm.store_id = s.id
  and (
    spm.receiver_wallet is distinct from s.owner_wallet
    or (spm.method = 'usdc_arc' and spm.arc_wallet_address is distinct from s.owner_wallet)
  );

-- Staff wallets are no longer active authorization identities.
-- Keep rows for historical foreign-key references.
update public.store_staff
set is_active = false,
    updated_at = now()
where is_active = true;

commit;
