/* CRM: segments, search, filters, CSV export, profile drawer. */
import { sb, state, esc, money, dateTime, storeName, statusPill, drawer, toast, errMsg, csv, can, $ } from "../lib.js";
import { openOrder } from "./order-actions.js";

const SEG = { vip: "VIP", frequent: "Frecuente", risk: "En riesgo", new: "Nuevo", occasional: "Ocasional", lost: "Perdido", none: "Sin pedidos" };
function segment(c, vipLine) {
  if (!c.orders_count) return "none";
  const days = c.last_order_at ? (Date.now() - new Date(c.last_order_at)) / 864e5 : 999;
  if (+c.total_spent >= vipLine) return "vip";
  if (days > 60) return "lost";
  if (c.orders_count >= 3 && days < 30) return "frequent";
  if (c.orders_count >= 2 && days >= 30) return "risk";
  if (c.orders_count === 1) return "new";
  return "occasional";
}

export default async function render(el) {
  el.innerHTML = `<div class="vhead"><div><h1>Clientes</h1><p class="muted" id="sub"></p></div>
    <div class="tools"><input id="q" placeholder="Nombre o teléfono" aria-label="Buscar"><select id="seg"><option value="">Todos los segmentos</option>${Object.entries(SEG).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    <select id="st"><option value="">Todas las sucursales</option>${state.stores.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    <label style="flex-direction:row;align-items:center"><input type="checkbox" id="mk" style="width:auto"> Marketing</label>
    <select id="sort"><option value="last">Última compra</option><option value="spent">Más gastado</option><option value="count">Más pedidos</option></select>
    <button class="btn btn--ghost btn--sm" id="csv">Exportar CSV</button></div></div>
    <div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Segmento</th><th>Pedidos</th><th>Gastado</th><th>Última</th><th>Sucursal</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const { data, error } = await sb.from("customers").select("*").order("last_order_at", { ascending: false, nullsFirst: false }).limit(5000);
  if (error) { el.innerHTML = `<p class="empty">${esc(errMsg(error))}</p>`; return; }
  const all = data || [];
  const spends = all.map((c) => +c.total_spent).sort((a, b) => b - a);
  const vipLine = Math.max(1000, spends[Math.floor(spends.length * 0.1)] || Infinity); // top 10% or Bs 1000+
  all.forEach((c) => { c.seg = segment(c, vipLine); });
  let list = all;
  function draw() {
    const q = $("#q", el).value.toLowerCase(), sg = $("#seg", el).value, st = $("#st", el).value, mk = $("#mk", el).checked, so = $("#sort", el).value;
    list = all.filter((c) => (!q || (c.name || "").toLowerCase().includes(q) || c.phone.includes(q)) && (!sg || c.seg === sg) && (!st || c.preferred_store === st) && (!mk || c.marketing_opt_in));
    list.sort((a, b) => so === "spent" ? b.total_spent - a.total_spent : so === "count" ? b.orders_count - a.orders_count : String(b.last_order_at || "").localeCompare(String(a.last_order_at || "")));
    $("#sub", el).textContent = `${list.length} de ${all.length} clientes`;
    $("#rows", el).innerHTML = list.slice(0, 300).map((c) => `<tr class="click" data-id="${c.id}"><td><b>${esc(c.name || "—")}</b>${c.blocked ? ' <span class="pill st-cancelled">Bloqueado</span>' : ""}</td><td class="mono">${esc(c.phone)}</td><td><span class="pill">${SEG[c.seg]}</span></td><td>${c.orders_count}</td><td>${money(c.total_spent)}</td><td>${dateTime(c.last_order_at)}</td><td>${esc(storeName(c.preferred_store))}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Sin clientes</td></tr>`;
  }
  ["q", "seg", "st", "mk", "sort"].forEach((id) => $("#" + id, el).addEventListener("input", draw));
  $("#csv", el).onclick = () => csv("clientes-hattori.csv", list.map((c) => ({ nombre: c.name, telefono: c.phone, segmento: SEG[c.seg], pedidos: c.orders_count, gastado: c.total_spent, ultima: c.last_order_at, sucursal: c.preferred_store, marketing: c.marketing_opt_in, tags: (c.tags || []).join("|") })));
  $("#rows", el).onclick = (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) profile(all.find((c) => c.id === tr.dataset.id), draw); };
  draw();
}

async function profile(c, redraw) {
  const [{ data: orders }, { data: addrs }] = await Promise.all([
    sb.from("orders").select("id, code, status, total, created_at, store_id, order_items(name, qty)").eq("customer_id", c.id).order("created_at", { ascending: false }).limit(50),
    sb.from("customer_addresses").select("*").eq("customer_id", c.id).order("last_used_at", { ascending: false }),
  ]);
  const fav = {}; (orders || []).filter((o) => o.status !== "cancelled").forEach((o) => (o.order_items || []).forEach((i) => { fav[i.name] = (fav[i.name] || 0) + i.qty; }));
  const favs = Object.entries(fav).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const d = drawer(`<h2>${esc(c.name || c.phone)}</h2><span class="pill">${esc(SEG[c.seg] || "")}</span>`, `
    <div class="grid g3"><div class="kpi"><small>Pedidos</small><b>${c.orders_count}</b></div><div class="kpi"><small>Gastado</small><b>${money(c.total_spent)}</b></div><div class="kpi"><small>Desde</small><b style="font-size:1rem">${dateTime(c.first_order_at) || "—"}</b></div></div>
    ${favs.length ? `<div><h3>Favoritos</h3><p>${favs.map(([n, q]) => `${esc(n)} ×${q}`).join(" · ")}</p></div>` : ""}
    <form class="grid g2" id="pf">
      <label>Nombre<input name="name" value="${esc(c.name || "")}"></label><label>Correo<input name="email" type="email" value="${esc(c.email || "")}"></label>
      <label>Cumpleaños<input name="birthday" type="date" value="${esc(c.birthday || "")}"></label><label>Tel. alterno<input name="alt_phone" value="${esc(c.alt_phone || "")}"></label>
      <label>NIT / CI<input name="tax_id" value="${esc(c.tax_id || "")}"></label><label>Razón social<input name="business_name" value="${esc(c.business_name || "")}"></label>
      <label style="grid-column:1/-1">Alergias<input name="allergies" value="${esc(c.allergies || "")}"></label>
      <label style="grid-column:1/-1">Etiquetas (separadas por coma)<input name="tags" value="${esc((c.tags || []).join(", "))}"></label>
      <label style="grid-column:1/-1">Notas<textarea name="notes" rows="2">${esc(c.notes || "")}</textarea></label>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="marketing_opt_in" style="width:auto" ${c.marketing_opt_in ? "checked" : ""}> Acepta marketing</label>
      ${can("owner", "admin", "manager") ? `<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="blocked" style="width:auto" ${c.blocked ? "checked" : ""}> Bloqueado</label>` : ""}
      <button class="btn btn--red" style="grid-column:1/-1">Guardar</button></form>
    ${(addrs || []).length ? `<div><h3>Direcciones</h3>${addrs.map((a) => `<p>${esc(a.address)}${a.reference ? ` · <span class="muted">${esc(a.reference)}</span>` : ""}</p>`).join("")}</div>` : ""}
    <div><h3>Pedidos</h3><table><tbody>${(orders || []).map((o) => `<tr class="click" data-id="${o.id}"><td>${dateTime(o.created_at)}</td><td>${esc(o.code)}</td><td>${statusPill(o.status)}</td><td>${money(o.total)}</td></tr>`).join("")}</tbody></table></div>`);
  d.body.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openOrder(tr.dataset.id); });
  $("#pf", d.body).addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    const patch = { name: f.name.value || null, email: f.email.value || null, birthday: f.birthday.value || null, alt_phone: f.alt_phone.value || null, tax_id: f.tax_id.value || null,
      business_name: f.business_name.value || null, allergies: f.allergies.value || null, notes: f.notes.value || null,
      tags: f.tags.value.split(",").map((t) => t.trim()).filter(Boolean), marketing_opt_in: f.marketing_opt_in.checked };
    if (f.marketing_opt_in.checked && !c.marketing_opt_in) { patch.opt_in_at = new Date().toISOString(); patch.opt_in_source = "backoffice"; }
    if (f.blocked) patch.blocked = f.blocked.checked;
    const { error } = await sb.from("customers").update(patch).eq("id", c.id);
    if (error) toast(errMsg(error), true); else { Object.assign(c, patch); toast("Cliente guardado"); redraw(); }
  });
}
