-- =====================================================================
-- Hattori · 001 core schema
-- Business timezone: America/La_Paz · currency: BOB (Bs)
-- =====================================================================
create extension if not exists pgcrypto;

-- Enums (ids in English; labels in Spanish in the UI).
-- Sushi bar flow has no separate "oven" stage, so `cooking` is dropped.
create type public.staff_role as enum ('owner', 'admin', 'manager', 'cashier', 'kitchen', 'rider');
create type public.order_status as enum ('new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
-- Delivery apps used by Hattori are not public yet → add them here when confirmed (needs owner input).
create type public.order_channel as enum ('web', 'hattoria', 'whatsapp', 'phone', 'walk_in');
create type public.service_type as enum ('delivery', 'pickup', 'dine_in');
-- Accepted payment methods are not public → confirm with the owner.
create type public.payment_method as enum ('cash', 'qr', 'card', 'other');
create type public.payment_status as enum ('pending', 'paid', 'refunded');

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- stores
create table public.stores (
  id text primary key,                      -- = branches[].id in js/data.js
  name text not null unique,
  whatsapp text not null,
  address text,
  plus_code text,
  open_time time,                           -- informational; real hours live in data.js (split shifts)
  close_time time,
  is_paused boolean not null default false,
  pause_reason text,
  delivery_fee numeric(10,2),               -- null = quoted on WhatsApp
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stores_touch before update on public.stores for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- menu
create table public.menu_items (
  id text primary key,                      -- = catalog() ids
  name text not null,
  kind text not null check (kind in ('main', 'combo', 'promo', 'drink', 'extra', 'sauce', 'side', 'dessert')),
  category text,
  size text,
  description text,
  price numeric(10,2) not null check (price >= 0),
  veg boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger menu_items_touch before update on public.menu_items for each row execute function public.touch_updated_at();

create table public.store_item_availability (
  store_id text not null references public.stores(id) on delete cascade,
  item_id text not null references public.menu_items(id) on delete cascade,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (store_id, item_id)
);

-- ---------------------------------------------------------------- staff
create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role public.staff_role not null,
  store_id text references public.stores(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint staff_store_required check (role in ('owner', 'admin') or store_id is not null)
);
create index staff_store_idx on public.staff(store_id);

-- ---------------------------------------------------------------- CRM
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,               -- normalised +591XXXXXXXX
  name text,
  email text,
  birthday date,
  notes text,
  tags text[] not null default '{}',
  marketing_opt_in boolean not null default false,
  preferred_store text references public.stores(id),
  orders_count int not null default 0,
  total_spent numeric(12,2) not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_idx on public.customers using gin (to_tsvector('simple', coalesce(name, '')));
create index customers_last_order_idx on public.customers(last_order_at desc);
create index customers_pref_store_idx on public.customers(preferred_store);
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address text not null,
  reference text,
  lat double precision,
  lng double precision,
  last_used_at timestamptz not null default now(),
  unique (customer_id, address)
);

-- ---------------------------------------------------------------- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                -- HT-ABCDE, shown to the customer
  client_ref text not null unique,          -- idempotency key
  store_id text not null references public.stores(id),
  customer_id uuid references public.customers(id),
  channel public.order_channel not null,
  service public.service_type not null,
  status public.order_status not null default 'new',
  scheduled_for timestamptz,
  customer_name text not null,
  customer_phone text,
  address text,
  reference text,
  lat double precision,
  lng double precision,
  notes text,
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method public.payment_method,
  payment_status public.payment_status not null default 'pending',
  cash_change_for numeric(10,2),
  rider_id uuid references public.staff(user_id),
  cancel_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  ready_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index orders_store_status_idx on public.orders(store_id, status, created_at desc);
create index orders_created_idx on public.orders(created_at desc);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_rider_idx on public.orders(rider_id);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id text not null references public.menu_items(id),
  name text not null,
  unit_price numeric(10,2) not null,
  qty int not null check (qty between 1 and 50),
  line_total numeric(10,2) not null,
  notes text
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_item_idx on public.order_items(item_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  actor uuid,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);
