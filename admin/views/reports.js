/* Reports: KPI tiles vs targets, SVG charts, top items, cancel reasons, CSV export. */
import { sb, state, esc, money, storeOptions, rpc, errMsg, csv, today, daysAgo, barChart, isAdmin, CHANNEL, SERVICE, storeName, $ } from "../lib.js";

const TARGETS = [ // [key, label, target, lowerIsBetter, unit]
  ["avg_prep_min", "Preparación", 15, true, "min"], ["avg_out_door_min", "Salida", 20, true, "min"], ["avg_delivery_min", "Entrega", 40, true, "min"],
  ["cancelled_pct", "Cancelados", 3, true, "%"], ["late_pct", "Tarde (>45 min)", 20, true, "%"],
];
export default async function render(el) {
  el.innerHTML = `<div class="vhead"><div><h1>Reportes</h1></div><div class="tools">
    <input type="date" id="from" value="${daysAgo(6)}"><input type="date" id="to" value="${today()}">
    ${isAdmin() ? `<select id="st">${storeOptions("", { all: true })}</select>` : ""}
    <button class="btn btn--sm" id="go">Ver</button><button class="btn btn--ghost btn--sm" id="csv">Exportar pedidos CSV</button></div></div><div id="out"></div>`;
  const args = () => ({ p_from: $("#from", el).value, p_to: $("#to", el).value, p_store: ($("#st", el) || {}).value || null });
  async function load() {
    const out = $("#out", el); out.innerHTML = `<p class="loading">Calculando…</p>`;
    let r; try { r = await rpc("report_summary", args()); } catch (e) { out.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; return; }
    const tiles = TARGETS.map(([k, l, t, lower, u]) => { const v = r[k]; const cls = v == null ? "" : (lower ? v <= t : v >= t) ? "ok" : v <= t * 1.3 ? "warn" : "bad";
      return `<div class="kpi ${cls}"><small>${l}</small><b>${v == null ? "—" : v + " " + u}</b><em>meta ≤ ${t} ${u}</em></div>`; }).join("");
    out.innerHTML = `<div class="grid g4">${[["Pedidos", r.orders], ["Ventas", money(r.revenue)], ["Ticket promedio", money(r.avg_ticket)], ["Clientes", `${r.customers} <em>(${r.new_customers} nuevos)</em>`]].map(([k, v]) => `<div class="kpi"><small>${k}</small><b>${v}</b></div>`).join("")}</div>
      <div class="grid g4" style="margin-top:14px;grid-template-columns:repeat(5,1fr)">${tiles}</div>
      <div class="grid g2" style="margin-top:14px">
        <div class="panel"><h2>Ventas por día</h2>${barChart(r.by_day, { label: (d) => d.day.slice(5), value: (d) => +d.revenue, fmt: money })}</div>
        <div class="panel"><h2>Pedidos por hora</h2>${barChart(r.by_hour, { label: (d) => d.hour + "h", value: (d) => d.orders, cls: "bar2" })}</div>
        <div class="panel"><h2>Por sucursal</h2>${barChart(r.by_store, { label: (d) => storeName(d.store), value: (d) => +d.revenue, fmt: money })}</div>
        <div class="panel"><h2>Por canal</h2>${barChart(r.by_channel, { label: (d) => CHANNEL[d.channel] || d.channel, value: (d) => d.orders, cls: "bar2" })}</div>
        <div class="panel"><h2>Por servicio</h2>${barChart(r.by_service, { label: (d) => SERVICE[d.service], value: (d) => d.orders })}</div>
        <div class="panel"><h2>Motivos de cancelación</h2>${(r.cancel_reasons || []).map((c) => `<p style="display:flex;justify-content:space-between;margin:4px 0"><span>${esc(c.reason)}</span><b>${c.count}</b></p>`).join("") || `<p class="empty">Sin cancelaciones 🎉</p>`}</div>
      </div>
      <div class="panel" style="margin-top:14px"><h2>Platos más pedidos</h2><table><tbody>${(r.top_items || []).map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.name)}</td><td>${t.qty}</td><td style="text-align:right">${money(t.revenue)}</td></tr>`).join("") || `<tr><td class="empty">Sin datos</td></tr>`}</tbody></table></div>`;
  }
  $("#go", el).onclick = load;
  $("#csv", el).onclick = async () => {
    const a = args(); let q = sb.from("orders").select("code, order_no, business_day, store_id, channel, service, status, customer_name, customer_phone, subtotal, delivery_fee, discount, total, payment_method, payment_status, cancel_reason, created_at").gte("business_day", a.p_from).lte("business_day", a.p_to).order("created_at").limit(10000);
    if (a.p_store) q = q.eq("store_id", a.p_store); else if (!isAdmin()) q = q.eq("store_id", state.me.store_id);
    const { data } = await q; csv(`pedidos-hattori-${a.p_from}_${a.p_to}.csv`, data || []);
  };
  await load();
}
