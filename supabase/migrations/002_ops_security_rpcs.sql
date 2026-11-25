-- =====================================================================
-- Hattori · 002 operations, security helpers, triggers, RLS
-- =====================================================================

-- ---------------------------------------------------------------- operational columns
alter table public.stores
  add column paused_until timestamptz,
  add column accepts_delivery boolean not null default true,
  add column accepts_pickup boolean not null default true,
  add column prep_minutes int not null default 20 check (prep_minutes between 1 and 240);

alter table public.customers
  add column alt_phone text,
  add column tax_id text,            -- NIT / CI for the invoice
  add column business_name text,     -- razón social
  add column allergies text,
  add column blocked boolean not null default false,
  add column opt_in_at timestamptz,
  add column opt_in_source text;

alter table public.customer_addresses
  add column zone text,              -- barrio / zona (Equipetrol, Las Palmas…)
  add column ring text;              -- anillo (Santa Cruz is organised by rings)

alter table public.orders
  add column tracking_token uuid not null unique default gen_random_uuid(),
  add column order_no int,
  add column business_day date not null default (now() at time zone 'America/La_Paz')::date,
  add column possible_duplicate boolean not null default false,
  add column invoice_tax_id text,
  add column invoice_name text,
  add column courier text not null default 'own',
  add column courier_ref text,
  add column courier_cost numeric(10,2),
  add column started_at timestamptz;
create index orders_day_store_idx on public.orders(business_day, store_id);

create table public.store_daily_counters (
  store_id text not null references public.stores(id) on delete cascade,
  day date not null,
  last_no int not null default 0,
  primary key (store_id, day)
);

create table public.cancel_reasons (
  code text primary key,
  label text not null,
  needs_note boolean not null default false,
  sort int not null default 0
);
insert into public.cancel_reasons (code, label, needs_note, sort) values
  ('changed_mind', 'El cliente cambió de opinión', false, 1),
  ('no_answer', 'El cliente no responde', false, 2),
  ('duplicate', 'Pedido duplicado', false, 3),
  ('fake', 'Pedido falso / broma', false, 4),
  ('out_of_zone', 'Fuera de la zona de delivery', false, 5),
  ('sold_out', 'Producto agotado', false, 6),
  ('store_closed', 'Sucursal cerrada o saturada', false, 7),
  ('delay', 'Demora excesiva', false, 8),
  ('taking_error', 'Error al tomar el pedido', false, 9),
  ('payment', 'Pago no confirmado', false, 10),
  ('wrong_address', 'Dirección incorrecta', false, 11),
  ('absent', 'Cliente ausente en la entrega', false, 12),
  ('courier', 'Problema con el repartidor', false, 13),
  ('other', 'Otro (explicar)', true, 99);

-- ---------------------------------------------------------------- private helpers
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create or replace function private.my_staff() returns public.staff
language sql stable security definer set search_path = '' as $$
  select s.* from public.staff s where s.user_id = auth.uid() and s.active
$$;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid() and s.active and s.role in ('owner', 'admin'))
$$;
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid() and s.active)
$$;
create or replace function private.can_store(p_store text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid() and s.active
                 and (s.role in ('owner', 'admin') or s.store_id = p_store))
$$;
create or replace function private.has_role(p_roles public.staff_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid() and s.active and s.role = any (p_roles))
$$;
grant execute on all functions in schema private to authenticated, anon;

create or replace function public.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '591%' and length(d) = 11 then d := substr(d, 4); end if;
  if d ~ '^[67][0-9]{7}$' then return '+591' || d; end if;
  return null;
end $$;

-- ---------------------------------------------------------------- triggers
create or replace function private.order_totals() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.total := greatest(0, coalesce(new.subtotal, 0) + coalesce(new.delivery_fee, 0) - coalesce(new.discount, 0));
  return new;
end $$;
create trigger orders_totals before insert or update of subtotal, delivery_fee, discount on public.orders
  for each row execute function private.order_totals();

create or replace function private.refresh_customer_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid uuid := coalesce(new.customer_id, old.customer_id);
begin
  if cid is null then return null; end if;
  update public.customers c set
    orders_count = x.n, total_spent = x.spent, first_order_at = x.first_at, last_order_at = x.last_at
  from (select count(*)::int n, coalesce(sum(total), 0) spent, min(created_at) first_at, max(created_at) last_at
        from public.orders where customer_id = cid and status <> 'cancelled') x
  where c.id = cid;
  return null;
end $$;
create trigger orders_customer_stats after insert or update of status, total, customer_id on public.orders
  for each row execute function private.refresh_customer_stats();

create or replace function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb; old_rec jsonb; diff jsonb := '{}'::jsonb; k text;
  watched text[] := array['status', 'cancel_reason', 'discount', 'delivery_fee', 'payment_method', 'payment_status', 'total', 'rider_id'];
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log(actor, action, entity, entity_id, data) values (auth.uid(), 'delete', tg_table_name, coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'user_id', (to_jsonb(old)->>'store_id') || '/' || (to_jsonb(old)->>'item_id')), to_jsonb(old));
    return old;
  end if;
  rec := to_jsonb(new);
  if tg_op = 'INSERT' then
    if tg_table_name = 'orders' then return new; end if; -- order creation is already in order_events
    insert into public.audit_log(actor, action, entity, entity_id, data) values (auth.uid(), 'insert', tg_table_name, coalesce(rec->>'id', rec->>'user_id', (rec->>'store_id') || '/' || (rec->>'item_id')), rec);
    return new;
  end if;
  old_rec := to_jsonb(old);
  for k in select jsonb_object_keys(rec) loop
    if k in ('updated_at') then continue; end if;
    if tg_table_name = 'orders' and not (k = any (watched)) then continue; end if;
    if rec->k is distinct from old_rec->k then diff := diff || jsonb_build_object(k, jsonb_build_object('from', old_rec->k, 'to', rec->k)); end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into public.audit_log(actor, action, entity, entity_id, data) values (auth.uid(), 'update', tg_table_name, coalesce(rec->>'id', rec->>'user_id', (rec->>'store_id') || '/' || (rec->>'item_id')), diff);
  end if;
  return new;
end $$;
create trigger stores_audit after insert or update or delete on public.stores for each row execute function private.audit();
create trigger menu_audit after insert or update or delete on public.menu_items for each row execute function private.audit();
create trigger avail_audit after insert or update or delete on public.store_item_availability for each row execute function private.audit();
create trigger staff_audit after insert or update or delete on public.staff for each row execute function private.audit();
create trigger orders_audit after update on public.orders for each row execute function private.audit();

-- ---------------------------------------------------------------- RLS
alter table public.stores enable row level security;
alter table public.menu_items enable row level security;
alter table public.store_item_availability enable row level security;
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.store_daily_counters enable row level security;
alter table public.cancel_reasons enable row level security;

-- public catalogue (no personal data)
create policy stores_read on public.stores for select to anon, authenticated using (true);
create policy menu_read on public.menu_items for select to anon, authenticated using (true);
create policy avail_read on public.store_item_availability for select to anon, authenticated using (true);
create policy cancel_reasons_read on public.cancel_reasons for select to anon, authenticated using (true);

create policy stores_update on public.stores for update to authenticated
  using ((select private.is_admin()) or ((select private.has_role(array['manager']::public.staff_role[])) and (select private.can_store(id))))
  with check ((select private.is_admin()) or ((select private.has_role(array['manager']::public.staff_role[])) and (select private.can_store(id))));
create policy stores_insert on public.stores for insert to authenticated with check ((select private.is_admin()));

create policy menu_write on public.menu_items for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy avail_write on public.store_item_availability for all to authenticated
  using ((select private.has_role(array['owner', 'admin', 'manager', 'cashier', 'kitchen']::public.staff_role[])) and (select private.can_store(store_id)))
  with check ((select private.has_role(array['owner', 'admin', 'manager', 'cashier', 'kitchen']::public.staff_role[])) and (select private.can_store(store_id)));

create policy staff_read on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin())
         or ((select private.has_role(array['manager']::public.staff_role[])) and store_id = (select (private.my_staff()).store_id)));

create policy customers_rw on public.customers for all to authenticated
  using ((select private.has_role(array['owner', 'admin', 'manager', 'cashier']::public.staff_role[])))
  with check ((select private.has_role(array['owner', 'admin', 'manager', 'cashier']::public.staff_role[])));
create policy addresses_read on public.customer_addresses for select to authenticated
  using ((select private.has_role(array['owner', 'admin', 'manager', 'cashier', 'rider']::public.staff_role[])));
create policy addresses_write on public.customer_addresses for all to authenticated
  using ((select private.has_role(array['owner', 'admin', 'manager', 'cashier']::public.staff_role[])))
  with check ((select private.has_role(array['owner', 'admin', 'manager', 'cashier']::public.staff_role[])));

create policy orders_read on public.orders for select to authenticated using ((select private.can_store(store_id)));
create policy orders_update on public.orders for update to authenticated using ((select private.can_store(store_id))) with check ((select private.can_store(store_id)));
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (select private.can_store(o.store_id))));
create policy order_events_read on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (select private.can_store(o.store_id))));
create policy audit_read on public.audit_log for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------- column-level grants
revoke all on all tables in schema public from anon;
grant select on public.stores, public.menu_items, public.store_item_availability, public.cancel_reasons to anon;

revoke insert, update, delete on public.orders, public.order_items, public.order_events, public.staff, public.audit_log, public.store_daily_counters from authenticated;
grant select on all tables in schema public to authenticated;
-- staff may edit only operational order columns; status and prices change only through RPCs
grant update (payment_method, payment_status, cash_change_for, rider_id, notes, delivery_fee, discount, address, reference,
              courier, courier_ref, courier_cost, invoice_tax_id, invoice_name, scheduled_for) on public.orders to authenticated;
grant insert, update, delete on public.stores, public.menu_items, public.store_item_availability, public.customers, public.customer_addresses to authenticated;

-- ---------------------------------------------------------------- realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders, public.order_events, public.stores, public.store_item_availability;
  end if;
end $$;
