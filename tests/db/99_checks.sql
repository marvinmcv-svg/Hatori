\set ON_ERROR_STOP 0
-- staff fixtures
insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','owner@x.bo'),('22222222-2222-2222-2222-222222222222','kitchen@x.bo'),('33333333-3333-3333-3333-333333333333','cashier@x.bo'),('44444444-4444-4444-4444-444444444444','mgr-lp@x.bo');
insert into public.staff(user_id,full_name,role,store_id) values ('11111111-1111-1111-1111-111111111111','Owner','owner',null),('22222222-2222-2222-2222-222222222222','Cocina','kitchen','equipetrol'),('33333333-3333-3333-3333-333333333333','Caja','cashier','equipetrol'),('44444444-4444-4444-4444-444444444444','Mgr LP','manager','las-palmas');
grant usage on schema extensions to authenticated;

set role anon;
select '1 anon place (price tamper ignored)' t, public.place_order('{"client_ref":"t-1","channel":"web","store":"equipetrol","service":"pickup","customer_name":"Ana Pérez","customer_phone":"71234567","items":[{"id":"acevichado-roll","qty":2,"price":1}]}')->>'total' total;
select '2 idempotent' t, (public.place_order('{"client_ref":"t-1","channel":"web","store":"equipetrol","service":"pickup","customer_name":"Ana","customer_phone":"71234567","items":[{"id":"tabla-mix","qty":1}]}'))->>'duplicate' dup;
select '3 anon cannot read orders' t; select count(*) from public.orders;
select '4 anon cannot read customers' t; select count(*) from public.customers;
select '5 anon staff channel' t; select public.place_order('{"client_ref":"t-x","channel":"phone","store":"equipetrol","service":"pickup","customer_name":"A","customer_phone":"71234567","items":[{"id":"tabla-mix"}]}');
select '6 bad phone' t; select public.place_order('{"client_ref":"t-y","store":"equipetrol","service":"pickup","customer_name":"A","customer_phone":"123","items":[{"id":"tabla-mix"}]}');
select '7 delivery no address' t; select public.place_order('{"client_ref":"t-z","store":"equipetrol","service":"delivery","customer_name":"A","customer_phone":"71234567","items":[{"id":"tabla-mix"}]}');
reset role;
-- track
select '8 track (no phone)' t, public.track_order((select tracking_token from orders where client_ref='t-1')) ? 'customer_phone' as leaks_phone, (public.track_order((select tracking_token from orders where client_ref='t-1')))->>'first_name' fn;

-- kitchen marks sold out, then anon is refused
set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into public.store_item_availability(store_id,item_id,available) values ('equipetrol','tartar-roll',false);
select '9 kitchen cannot 86 another store' t; insert into public.store_item_availability(store_id,item_id,available) values ('las-palmas','tartar-roll',false);
reset role; set role anon;
select '10 sold out' t; select public.place_order('{"client_ref":"t-2","store":"equipetrol","service":"pickup","customer_name":"A","customer_phone":"71234567","items":[{"id":"tartar-roll"}]}');
reset role; update stores set is_paused=true where id='las-palmas'; set role anon;
select set_config('request.jwt.claim.sub','',false);
select '11 paused' t; select public.place_order('{"client_ref":"t-3","store":"las-palmas","service":"pickup","customer_name":"A","customer_phone":"71234567","items":[{"id":"masu-roll"}]}');
reset role; update stores set is_paused=false where id='las-palmas';

-- status flow & roles
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select '12 kitchen confirm' t, public.set_order_status((select id from orders where client_ref='t-1'),'confirmed');
select '13 kitchen preparing' t, public.set_order_status((select id from orders where client_ref='t-1'),'preparing');
select '14 kitchen cannot cancel' t; select public.set_order_status((select id from orders where client_ref='t-1'),'cancelled',null,'other');
select '15 kitchen cannot update status column directly' t; update orders set status='delivered' where client_ref='t-1';
select '15b kitchen cannot change subtotal' t; update orders set subtotal=1 where client_ref='t-1';
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
select '16 cashier cannot cancel after preparing' t; select public.set_order_status((select id from orders where client_ref='t-1'),'cancelled',null,'changed_mind');
select '17 cashier dispatch pickup not allowed' t; select public.set_order_status((select id from orders where client_ref='t-1'),'out_for_delivery');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
select '18 LP manager sees only own store' t, count(*) from orders;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select '19 owner sees all' t, count(*) from orders;
update menu_items set price=99 where id='acevichado-roll';
select '20 report' t, (public.report_summary(current_date-1, current_date+1))->>'revenue' rev;
select '21 audit rows' t, action, entity, data from audit_log order by id desc limit 3;
select '22 create staff' t, public.admin_create_staff('nuevo@hattori.bo','supersecret','Nuevo','rider','equipetrol') is not null ok;
reset role;
select '23 customer stats' t, orders_count, total_spent from customers;
