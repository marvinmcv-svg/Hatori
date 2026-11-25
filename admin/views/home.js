/* "Hoy": today's KPIs, live counts per status, store status, latest orders. */
import { sb, state, esc, money, time, STATUS, statusPill, storeName, today, isAdmin, rpc, $ } from "../lib.js";
import { openOrder } from "./order-actions.js";

export default async function render(el) {
  el.innerHTML = `<div class="vhead"><div><h1>Hoy en Hattori</h1><p class="muted" id="sub"></p></div><a class="btn btn--red" href="#/orders">Ir al tablero →</a></div>
    <div class="grid g4" id="kpis"></div><div class="grid g2" style="margin-top:14px"><div class="panel"><h2>Por estado</h2><div id="counts"></div></div>
    <div class="panel"><h2>Sucursales</h2><div id="stores"></div></div></div>
    <div class="panel" style="margin-top:14px"><h2>Últimos pedidos</h2><div class="tablewrap" style="border:0"><table id="latest"></table></div></div>`;
  async function load() {
    const d = today(); const store = isAdmin() ? null : state.me.store_id;
    $("#sub", el).textContent = new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/La_Paz" });
    const [rep, live, stores] = await Promise.all([
      rpc("report_summary", { p_from: d, p_to: d, p_store: store }),
      (store ? sb.from("orders").select("id, code, order_no, status, total, created_at, customer_name, store_id").eq("store_id", store) : sb.from("orders").select("id, code, order_no, status, total, created_at, customer_name, store_id")).eq("business_day", d).order("created_at", { ascending: false }).limit(200),
      sb.from("stores").select("*").order("sort"),
    ]);
    const rows = live.data || [];
    $("#kpis", el).innerHTML = [["Pedidos", rep.orders], ["Ventas", money(rep.revenue)], ["Ticket promedio", money(rep.avg_ticket)], ["Cancelados", `${rep.cancelled} <em>(${rep.cancelled_pct}%)</em>`]]
      .map(([k, v]) => `<div class="kpi"><small>${k}</small><b>${v}</b></div>`).join("");
    $("#counts", el).innerHTML = Object.keys(STATUS).map((s) => `<p style="display:flex;justify-content:space-between;margin:6px 0">${statusPill(s)}<b>${rows.filter((o) => o.status === s).length}</b></p>`).join("");
    const B = window.HATTORI;
    $("#stores", el).innerHTML = (stores.data || []).map((s) => {
      const paused = s.is_paused && (!s.paused_until || new Date(s.paused_until) > new Date());
      const st = B.statusAt(s.id, new Date()); const open = st.state !== "closed";
      return `<p style="display:flex;justify-content:space-between;margin:8px 0"><span><span class="dot ${paused ? "warn" : open ? "on" : ""}"></span> <b>${esc(s.name)}</b></span><span class="muted">${paused ? "Pausada" + (s.pause_reason ? " · " + esc(s.pause_reason) : "") : open ? "Abierta" : "Cerrada"}</span></p>`;
    }).join("");
    $("#latest", el).innerHTML = rows.slice(0, 12).map((o) => `<tr class="click" data-id="${o.id}"><td>${time(o.created_at)}</td><td>#${esc(o.order_no)} ${esc(o.code)}</td><td>${esc(o.customer_name)}</td><td>${esc(storeName(o.store_id))}</td><td>${statusPill(o.status)}</td><td style="text-align:right">${money(o.total)}</td></tr>`).join("") || `<tr><td class="empty">Aún no hay pedidos hoy</td></tr>`;
  }
  $("#latest", el).onclick = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openOrder(tr.dataset.id, load); };
  await load();
  const ch = sb.channel("home").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).on("postgres_changes", { event: "*", schema: "public", table: "stores" }, load).subscribe();
  return () => sb.removeChannel(ch);
}
