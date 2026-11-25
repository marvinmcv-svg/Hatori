-- =====================================================================
-- Hattori · 003 RPCs (the only way to create orders and change status/prices)
-- =====================================================================

create or replace function private.status_rank(s public.order_status) returns int
language sql immutable set search_path = '' as $$
  select case s when 'new' then 0 when 'confirmed' then 1 when 'preparing' then 2 when 'ready' then 3
                when 'out_for_delivery' then 4 when 'delivered' then 5 else 9 end
$$;

create or replace function private.new_code() returns text
language plpgsql volatile set search_path = '' as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'HT-';
    for i in 1..5 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.orders where code = c);
  end loop;
  return c;
end $$;

-- ---------------------------------------------------------------- place_order
create or replace function public.place_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.staff;
  is_public boolean;
  v_ref text := nullif(trim(payload->>'client_ref'), '');
  v_channel public.order_channel;
  v_service public.service_type;
  st public.stores;
  v_phone text;
  v_name text := nullif(trim(payload->>'customer_name'), '');
  v_addr text := nullif(trim(payload->>'address'), '');
  v_ref2 text := nullif(trim(payload->>'reference'), '');
  v_lat double precision := nullif(payload->>'lat', '')::double precision;
  v_lng double precision := nullif(payload->>'lng', '')::double precision;
  v_sched timestamptz;
  v_day date := (now() at time zone 'America/La_Paz')::date;
  v_cust public.customers;
  v_subtotal numeric(10,2) := 0;
  v_fee numeric(10,2) := 0;
  v_no int;
  o public.orders;
  it jsonb; mi public.menu_items; q int; n int := 0;
  lines jsonb := '[]'::jsonb;
  existing public.orders;
begin
  if v_ref is null or length(v_ref) > 200 then raise exception 'invalid_client_ref'; end if;

  -- 1. idempotency
  select * into existing from public.orders where client_ref = v_ref;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'code', existing.code, 'order_no', existing.order_no,
      'tracking_token', existing.tracking_token, 'subtotal', existing.subtotal, 'delivery_fee', existing.delivery_fee,
      'total', existing.total, 'status', existing.status, 'store', existing.store_id,
      'store_whatsapp', (select whatsapp from public.stores where id = existing.store_id));
  end if;

  -- 2. caller
  me := private.my_staff();
  is_public := me.user_id is null;
  begin v_channel := coalesce(payload->>'channel', 'web')::public.order_channel; exception when others then raise exception 'invalid_channel'; end;
  if is_public and v_channel not in ('web', 'hattoria') then raise exception 'invalid_channel'; end if;
  begin v_service := (payload->>'service')::public.service_type; exception when others then raise exception 'invalid_service'; end;
  if v_service is null then raise exception 'invalid_service'; end if;

  -- 3. store
  select * into st from public.stores s where (s.id = payload->>'store' or lower(s.name) = lower(payload->>'store')) and s.active;
  if not found then raise exception 'unknown_store'; end if;
  if not is_public and me.role not in ('owner', 'admin') and me.store_id <> st.id then raise exception 'forbidden_store'; end if;
  if is_public then
    if st.is_paused and (st.paused_until is null or st.paused_until > now()) then raise exception 'store_paused'; end if;
    if v_service = 'delivery' and not st.accepts_delivery then raise exception 'delivery_unavailable'; end if;
    if v_service = 'pickup' and not st.accepts_pickup then raise exception 'pickup_unavailable'; end if;
    if v_service = 'dine_in' then raise exception 'dine_in'; end if;
  end if;

  -- 4. customer data
  v_phone := public.normalize_phone(payload->>'customer_phone');
  if is_public and v_phone is null then raise exception 'invalid_phone'; end if;
  if v_name is null then raise exception 'missing_name'; end if;
  if v_service = 'delivery' and v_addr is null and (v_lat is null or v_lng is null) then raise exception 'missing_address'; end if;

  -- 5. schedule
  if nullif(payload->>'scheduled_for', '') is not null then
    if payload->>'scheduled_for' ~ '^\d{1,2}:\d{2}$' then
      v_sched := ((v_day::text || ' ' || (payload->>'scheduled_for'))::timestamp) at time zone 'America/La_Paz';
    else
      begin v_sched := (payload->>'scheduled_for')::timestamptz; exception when others then raise exception 'invalid_schedule'; end;
    end if;
  end if;

  -- 6. anti-abuse
  if v_phone is not null then
    select * into v_cust from public.customers where phone = v_phone;
    if found and v_cust.blocked and is_public then raise exception 'customer_blocked'; end if;
    if is_public and (select count(*) from public.orders where customer_phone = v_phone and created_at > now() - interval '10 minutes' and channel in ('web', 'hattoria')) >= 5 then
      raise exception 'rate_limited';
    end if;
  end if;

  -- 7. items: priced from menu_items, never from the client
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then raise exception 'no_items'; end if;
  if jsonb_array_length(payload->'items') > 30 then raise exception 'too_many_items'; end if;
  for it in select * from jsonb_array_elements(payload->'items') loop
    select * into mi from public.menu_items m where m.id = it->>'id' and m.active;
    if not found then raise exception 'unknown_item:%', it->>'id'; end if;
    if exists (select 1 from public.store_item_availability a where a.store_id = st.id and a.item_id = mi.id and not a.available) then
      raise exception 'sold_out:%', mi.name;
    end if;
    q := least(50, greatest(1, coalesce((it->>'qty')::int, 1)));
    v_subtotal := v_subtotal + mi.price * q;
    lines := lines || jsonb_build_object('id', mi.id, 'name', mi.name, 'unit_price', mi.price, 'qty', q, 'line_total', mi.price * q);
  end loop;

  -- 8. CRM upsert
  if v_phone is not null then
    insert into public.customers (phone, name, preferred_store, tax_id, business_name)
    values (v_phone, v_name, st.id, nullif(payload->>'invoice_tax_id', ''), nullif(payload->>'invoice_name', ''))
    on conflict (phone) do update set name = coalesce(excluded.name, public.customers.name), preferred_store = excluded.preferred_store,
      tax_id = coalesce(excluded.tax_id, public.customers.tax_id), business_name = coalesce(excluded.business_name, public.customers.business_name)
    returning * into v_cust;
    if v_service = 'delivery' and v_addr is not null then
      insert into public.customer_addresses (customer_id, address, reference, lat, lng)
      values (v_cust.id, v_addr, v_ref2, v_lat, v_lng)
      on conflict (customer_id, address) do update set reference = excluded.reference, lat = coalesce(excluded.lat, public.customer_addresses.lat), lng = coalesce(excluded.lng, public.customer_addresses.lng), last_used_at = now();
    end if;
  end if;

  -- 10. daily number + insert
  insert into public.store_daily_counters (store_id, day, last_no) values (st.id, v_day, 1)
  on conflict (store_id, day) do update set last_no = public.store_daily_counters.last_no + 1
  returning last_no into v_no;
  if v_service = 'delivery' then v_fee := coalesce(st.delivery_fee, 0); end if;

  insert into public.orders (code, client_ref, store_id, customer_id, channel, service, scheduled_for, customer_name, customer_phone,
    address, reference, lat, lng, notes, subtotal, delivery_fee, order_no, business_day, created_by, invoice_tax_id, invoice_name,
    payment_method, possible_duplicate)
  values (private.new_code(), v_ref, st.id, v_cust.id, v_channel, v_service, v_sched, v_name, v_phone,
    v_addr, v_ref2, v_lat, v_lng, left(nullif(payload->>'notes', ''), 500), v_subtotal, v_fee, v_no, v_day, me.user_id,
    nullif(payload->>'invoice_tax_id', ''), nullif(payload->>'invoice_name', ''),
    case when not is_public and nullif(payload->>'payment_method', '') is not null then (payload->>'payment_method')::public.payment_method end,
    -- 9. possible duplicate: same phone + store + subtotal within 3 minutes
    v_phone is not null and exists (select 1 from public.orders x where x.customer_phone = v_phone and x.store_id = st.id and x.subtotal = v_subtotal and x.created_at > now() - interval '3 minutes'))
  returning * into o;

  insert into public.order_items (order_id, item_id, name, unit_price, qty, line_total)
  select o.id, l->>'id', l->>'name', (l->>'unit_price')::numeric, (l->>'qty')::int, (l->>'line_total')::numeric from jsonb_array_elements(lines) l;
  insert into public.order_events (order_id, status, note, actor) values (o.id, 'new', 'Pedido recibido por ' || v_channel::text, me.user_id);

  -- 11.
  return jsonb_build_object('ok', true, 'code', o.code, 'order_no', o.order_no, 'tracking_token', o.tracking_token,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'total', o.total, 'status', o.status,
    'store', st.id, 'store_whatsapp', st.whatsapp, 'items', lines);
end $$;

-- ---------------------------------------------------------------- track_order (public, no PII)
create or replace function public.track_order(token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ok', true, 'code', o.code, 'order_no', o.order_no, 'status', o.status, 'service', o.service,
    'first_name', split_part(coalesce(o.customer_name, ''), ' ', 1),
    'created_at', o.created_at, 'scheduled_for', o.scheduled_for, 'total', o.total, 'delivery_fee', o.delivery_fee,
    'cancel_reason', (select label from public.cancel_reasons r where r.code = o.cancel_reason),
    'store', jsonb_build_object('name', s.name, 'whatsapp', s.whatsapp, 'prep_minutes', s.prep_minutes),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty) order by i.name), '[]') from public.order_items i where i.order_id = o.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.created_at), '[]') from public.order_events e where e.order_id = o.id))
  from public.orders o join public.stores s on s.id = o.store_id
  where o.tracking_token = token
$$;

-- ---------------------------------------------------------------- set_order_status (staff)
create or replace function public.set_order_status(p_order uuid, p_status public.order_status, p_note text default null, p_cancel_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me public.staff := private.my_staff();
  o public.orders;
  mgr boolean;
  r public.cancel_reasons;
begin
  if me.user_id is null then raise exception 'not_staff'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if me.role not in ('owner', 'admin') and me.store_id <> o.store_id then raise exception 'forbidden_store'; end if;
  mgr := me.role in ('owner', 'admin', 'manager');
  if o.status = p_status then return jsonb_build_object('ok', true, 'status', o.status); end if;

  if o.status in ('delivered', 'cancelled') and not mgr then raise exception 'closed_needs_manager'; end if;
  if me.role = 'kitchen' and p_status not in ('confirmed', 'preparing', 'ready') then raise exception 'role_forbidden'; end if;
  if me.role = 'rider' and p_status not in ('out_for_delivery', 'delivered') then raise exception 'role_forbidden'; end if;
  if p_status = 'out_for_delivery' and o.service <> 'delivery' then raise exception 'not_delivery'; end if;

  if p_status = 'cancelled' then
    select * into r from public.cancel_reasons where code = p_cancel_reason;
    if not found then raise exception 'cancel_reason_required'; end if;
    if r.needs_note and nullif(trim(p_note), '') is null then raise exception 'cancel_note_required'; end if;
    if private.status_rank(o.status) >= 2 and not mgr then raise exception 'cancel_needs_manager'; end if;
    if me.role in ('kitchen', 'rider') then raise exception 'role_forbidden'; end if;
  elsif o.status <> 'cancelled' and private.status_rank(p_status) < private.status_rank(o.status) and not mgr then
    raise exception 'recall_needs_manager';
  end if;

  update public.orders set
    status = p_status,
    cancel_reason = case when p_status = 'cancelled' then p_cancel_reason else cancel_reason end,
    confirmed_at = case when p_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    started_at = case when p_status = 'preparing' then coalesce(started_at, now()) else started_at end,
    ready_at = case when p_status = 'ready' then coalesce(ready_at, now()) else ready_at end,
    dispatched_at = case when p_status = 'out_for_delivery' then coalesce(dispatched_at, now()) else dispatched_at end,
    delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
    rider_id = case when me.role = 'rider' then me.user_id else rider_id end
  where id = o.id;
  insert into public.order_events (order_id, status, note, actor) values (o.id, p_status, nullif(trim(p_note), ''), me.user_id);
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

-- ---------------------------------------------------------------- staff management
create or replace function public.admin_create_staff(p_email text, p_password text, p_full_name text, p_role public.staff_role, p_store text default null, p_phone text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.my_staff(); uid uuid := gen_random_uuid(); em text := lower(trim(p_email));
begin
  if me.user_id is null or me.role not in ('owner', 'admin') then raise exception 'forbidden'; end if;
  if p_role = 'owner' and me.role <> 'owner' then raise exception 'owner_only'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'weak_password'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from auth.users where email = em) then raise exception 'email_taken'; end if;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', em, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_full_name), now(), now());
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  insert into public.staff (user_id, full_name, email, phone, role, store_id) values (uid, p_full_name, em, p_phone, p_role, p_store);
  return uid;
end $$;

create or replace function public.admin_update_staff(p_user uuid, p_role public.staff_role, p_store text, p_active boolean, p_full_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.my_staff(); t public.staff;
begin
  if me.user_id is null or me.role not in ('owner', 'admin') then raise exception 'forbidden'; end if;
  select * into t from public.staff where user_id = p_user;
  if not found then raise exception 'not_found'; end if;
  if (t.role = 'owner' or p_role = 'owner') and me.role <> 'owner' then raise exception 'owner_only'; end if;
  if p_user = me.user_id and (p_role <> me.role or not p_active) then raise exception 'cannot_demote_self'; end if;
  update public.staff set role = p_role, store_id = p_store, active = p_active, full_name = coalesce(nullif(trim(p_full_name), ''), full_name) where user_id = p_user;
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
declare me public.staff := private.my_staff(); t public.staff;
begin
  if me.user_id is null or me.role not in ('owner', 'admin') then raise exception 'forbidden'; end if;
  select * into t from public.staff where user_id = p_user;
  if not found then raise exception 'not_found'; end if;
  if t.role = 'owner' and me.role <> 'owner' then raise exception 'owner_only'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'weak_password'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- ---------------------------------------------------------------- reports
create or replace function public.report_summary(p_from date, p_to date, p_store text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me public.staff := private.my_staff(); v_store text := p_store; res jsonb;
begin
  if me.user_id is null or me.role not in ('owner', 'admin', 'manager', 'cashier') then raise exception 'forbidden'; end if;
  if me.role not in ('owner', 'admin') then v_store := me.store_id; end if;
  with o as (
    select * from public.orders where business_day between p_from and p_to and (v_store is null or store_id = v_store)
  ), ok as (select * from o where status <> 'cancelled')
  select jsonb_build_object(
    'orders', (select count(*) from ok),
    'revenue', (select coalesce(sum(total), 0) from ok),
    'avg_ticket', (select coalesce(round(avg(total), 2), 0) from ok),
    'cancelled', (select count(*) from o where status = 'cancelled'),
    'cancelled_pct', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where status = 'cancelled') / count(*), 1) end from o),
    'customers', (select count(distinct customer_id) from ok),
    'new_customers', (select count(*) from public.customers c where (c.first_order_at at time zone 'America/La_Paz')::date between p_from and p_to and (v_store is null or c.preferred_store = v_store)),
    'avg_prep_min', (select round(avg(extract(epoch from ready_at - confirmed_at) / 60)::numeric, 1) from ok where ready_at is not null and confirmed_at is not null),
    'avg_out_door_min', (select round(avg(extract(epoch from dispatched_at - created_at) / 60)::numeric, 1) from ok where dispatched_at is not null),
    'avg_delivery_min', (select round(avg(extract(epoch from delivered_at - created_at) / 60)::numeric, 1) from ok where delivered_at is not null and service = 'delivery'),
    'late_pct', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where delivered_at - created_at > interval '45 minutes') / count(*), 1) end from ok where delivered_at is not null),
    'by_day', (select coalesce(jsonb_agg(x order by x->>'day'), '[]') from (select jsonb_build_object('day', business_day, 'orders', count(*), 'revenue', sum(total)) x from ok group by business_day) t),
    'by_hour', (select coalesce(jsonb_agg(x order by (x->>'hour')::int), '[]') from (select jsonb_build_object('hour', extract(hour from created_at at time zone 'America/La_Paz')::int, 'orders', count(*)) x from ok group by extract(hour from created_at at time zone 'America/La_Paz')) t),
    'by_store', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('store', store_id, 'orders', count(*), 'revenue', sum(total)) x from ok group by store_id) t),
    'by_channel', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('channel', channel, 'orders', count(*), 'revenue', sum(total)) x from ok group by channel) t),
    'by_service', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('service', service, 'orders', count(*), 'revenue', sum(total)) x from ok group by service) t),
    'top_items', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('name', i.name, 'qty', sum(i.qty), 'revenue', sum(i.line_total)) x from public.order_items i join ok on ok.id = i.order_id group by i.name order by sum(i.qty) desc limit 15) t),
    'cancel_reasons', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('reason', coalesce(r.label, o.cancel_reason), 'count', count(*)) x from o left join public.cancel_reasons r on r.code = o.cancel_reason where o.status = 'cancelled' group by coalesce(r.label, o.cancel_reason)) t)
  ) into res;
  return res;
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on all functions in schema public from anon, public;
grant execute on function public.place_order(jsonb), public.track_order(uuid), public.normalize_phone(text) to anon, authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, text, text), public.admin_create_staff(text, text, text, public.staff_role, text, text),
  public.admin_update_staff(uuid, public.staff_role, text, boolean, text), public.admin_set_password(uuid, text),
  public.report_summary(date, date, text) to authenticated;
revoke execute on all functions in schema private from anon, public;
grant execute on function private.my_staff(), private.is_admin(), private.is_staff(), private.can_store(text), private.has_role(public.staff_role[]), private.status_rank(public.order_status), private.new_code() to authenticated, anon;
