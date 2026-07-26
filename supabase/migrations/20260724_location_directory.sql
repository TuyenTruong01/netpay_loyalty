-- Location directory for country-aware store addresses.
-- This migration is intentionally small and import-friendly; add larger datasets later by CSV/JSON import.

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  code text,
  country_code text,
  name text,
  country_name text,
  normalized_name text,
  currency_code text,
  currency_symbol text,
  currency_decimals integer,
  phone_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table countries add column if not exists code text;
alter table countries add column if not exists country_code text;
alter table countries add column if not exists name text;
alter table countries add column if not exists country_name text;
alter table countries add column if not exists normalized_name text;
alter table countries add column if not exists currency_code text;
alter table countries add column if not exists currency_symbol text;
alter table countries add column if not exists currency_decimals integer;
alter table countries add column if not exists phone_code text;
alter table countries add column if not exists is_active boolean not null default true;
alter table countries add column if not exists created_at timestamptz not null default now();

update countries
set
  code = coalesce(code, country_code),
  country_code = coalesce(country_code, code),
  name = coalesce(name, country_name),
  country_name = coalesce(country_name, name),
  normalized_name = coalesce(normalized_name, lower(coalesce(name, country_name, code, country_code))),
  currency_decimals = coalesce(currency_decimals, 2);

create unique index if not exists countries_code_key on countries(code);
create index if not exists idx_countries_normalized_name on countries(normalized_name);
create index if not exists idx_countries_name on countries(name);

create table if not exists administrative_divisions (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  parent_id uuid references administrative_divisions(id) on delete cascade,
  division_type text not null,
  code text,
  name text not null,
  normalized_name text not null,
  level integer not null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  timezone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_administrative_divisions_country_code on administrative_divisions(country_code);
create index if not exists idx_administrative_divisions_parent_id on administrative_divisions(parent_id);
create index if not exists idx_administrative_divisions_level on administrative_divisions(level);
create index if not exists idx_administrative_divisions_normalized_name on administrative_divisions(normalized_name);
create index if not exists idx_administrative_divisions_name on administrative_divisions(name);
create unique index if not exists administrative_divisions_country_code_code_key
  on administrative_divisions(country_code, code)
  where code is not null;

alter table stores add column if not exists state_province text;
alter table stores add column if not exists city text;
alter table stores add column if not exists district text;
alter table stores add column if not exists ward text;
alter table stores add column if not exists postal_code text;
alter table stores add column if not exists country_code text default 'VN';
alter table stores add column if not exists location_source text not null default 'custom';
alter table stores add column if not exists administrative_division_id uuid;
alter table stores add column if not exists latitude numeric(10, 7);
alter table stores add column if not exists longitude numeric(10, 7);
alter table stores add column if not exists timezone text default 'Asia/Ho_Chi_Minh';
alter table stores add column if not exists map_visibility boolean not null default true;

insert into countries (
  code, country_code, name, country_name, normalized_name,
  currency_code, currency_symbol, currency_decimals, phone_code, is_active
)
values ('VN', 'VN', 'Vietnam', 'Vietnam', 'vietnam', 'VND', 'd', 0, '+84', true)
on conflict (code) do update set
  country_code = excluded.country_code,
  name = excluded.name,
  country_name = excluded.country_name,
  normalized_name = excluded.normalized_name,
  currency_code = excluded.currency_code,
  currency_symbol = excluded.currency_symbol,
  currency_decimals = excluded.currency_decimals,
  phone_code = excluded.phone_code,
  is_active = excluded.is_active;

with upsert_city as (
  insert into administrative_divisions (
    country_code, parent_id, division_type, code, name, normalized_name, level, latitude, longitude, timezone, is_active
  )
  values ('VN', null, 'municipality', 'VN-DN', 'Da Nang', 'da nang', 1, 16.0678, 108.2208, 'Asia/Ho_Chi_Minh', true)
  on conflict (country_code, code) where code is not null do update set
    name = excluded.name,
    normalized_name = excluded.normalized_name,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    timezone = excluded.timezone,
    is_active = excluded.is_active
  returning id
),
da_nang as (
  select id from upsert_city
  union all
  select id from administrative_divisions where country_code = 'VN' and code = 'VN-DN'
  limit 1
)
insert into administrative_divisions (country_code, parent_id, division_type, code, name, normalized_name, level, latitude, longitude, timezone, is_active)
select 'VN', da_nang.id, item.division_type, item.code, item.name, item.normalized_name, 2, item.latitude, item.longitude, 'Asia/Ho_Chi_Minh', true
from da_nang
cross join (values
  ('district', 'VN-DN-HC', 'Hai Chau', 'hai chau', 16.0675, 108.2200),
  ('district', 'VN-DN-TK', 'Thanh Khe', 'thanh khe', 16.0642, 108.1873),
  ('district', 'VN-DN-ST', 'Son Tra', 'son tra', 16.1061, 108.2522),
  ('district', 'VN-DN-NHS', 'Ngu Hanh Son', 'ngu hanh son', 16.0036, 108.2644),
  ('district', 'VN-DN-LC', 'Lien Chieu', 'lien chieu', 16.0718, 108.1503),
  ('district', 'VN-DN-CL', 'Cam Le', 'cam le', 16.0154, 108.1996),
  ('district', 'VN-DN-HV', 'Hoa Vang', 'hoa vang', 15.9996, 107.9972),
  ('district', 'VN-DN-HS', 'Hoang Sa', 'hoang sa', null, null)
) as item(division_type, code, name, normalized_name, latitude, longitude)
on conflict (country_code, code) where code is not null do update set
  parent_id = excluded.parent_id,
  division_type = excluded.division_type,
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone,
  is_active = excluded.is_active;

with hai_chau as (
  select id from administrative_divisions where country_code = 'VN' and code = 'VN-DN-HC' limit 1
)
insert into administrative_divisions (country_code, parent_id, division_type, code, name, normalized_name, level, latitude, longitude, timezone, is_active)
select 'VN', hai_chau.id, 'ward', item.code, item.name, item.normalized_name, 3, item.latitude, item.longitude, 'Asia/Ho_Chi_Minh', true
from hai_chau
cross join (values
  ('VN-DN-HC-TT', 'Thach Thang', 'thach thang', 16.0757, 108.2203),
  ('VN-DN-HC-HD1', 'Hai Chau I', 'hai chau i', 16.0682, 108.2209),
  ('VN-DN-HC-HD2', 'Hai Chau II', 'hai chau ii', 16.0627, 108.2193),
  ('VN-DN-HC-NB', 'Nam Duong', 'nam duong', 16.0645, 108.2149),
  ('VN-DN-HC-BT', 'Binh Thuan', 'binh thuan', 16.0549, 108.2172),
  ('VN-DN-HC-PT', 'Phuoc Ninh', 'phuoc ninh', 16.0666, 108.2172),
  ('VN-DN-HC-TP', 'Thuan Phuoc', 'thuan phuoc', 16.0804, 108.2212),
  ('VN-DN-HC-HA', 'Hoa Cuong Bac', 'hoa cuong bac', 16.0467, 108.2197),
  ('VN-DN-HC-HN', 'Hoa Cuong Nam', 'hoa cuong nam', 16.0335, 108.2222)
) as item(code, name, normalized_name, latitude, longitude)
on conflict (country_code, code) where code is not null do update set
  parent_id = excluded.parent_id,
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone,
  is_active = excluded.is_active;
