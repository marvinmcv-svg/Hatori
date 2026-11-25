/* Audit: who changed what and when, readable before → after diffs, filters. */
import { sb, esc, dateTime, STATUS, $ } from "../lib.js";

const ENT = { stores: "Sucursal", menu_items: "Carta", store_item_availability: "Agotados", staff: "Equipo", orders: "Pedido" };
const ACT = { insert: "creó", update: "cambió", delete: "eliminó" };
const show = (v) => v == null ? "—" : typeof v === "string" ? (STATUS[v] || v) : JSON.stringify(v);

export default async function render(el) {
  el.innerHTML = `<div class="vhead"><div><h1>Auditoría</h1></div><div class="tools"><select id="ent"><option value="">Todo</option>${Object.entries(ENT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    <input id="q" placeholder="Buscar id…"></div></div><div class="tablewrap"><table><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const { data: staff } = await sb.from("staff").select("user_id, full_name");
  const who = (id) => id ? ((staff || []).find((s) => s.user_id === id) || {}).full_name || "Usuario" : "Sistema / web";
  async function load() {
    let q = sb.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
    const e = $("#ent", el).value, s = $("#q", el).value.trim();
    if (e) q = q.eq("entity", e); if (s) q = q.ilike("entity_id", `%${s}%`);
    const { data } = await q;
    $("#rows", el).innerHTML = (data || []).map((a) => {
      const detail = a.action === "update" ? Object.entries(a.data || {}).map(([k, v]) => `<div class="diff"><b>${esc(k)}</b>: <del>${esc(show(v.from))}</del> → <ins>${esc(show(v.to))}</ins></div>`).join("")
        : `<div class="diff">${esc(a.data && (a.data.name || a.data.full_name || a.data.item_id) || "")}</div>`;
      return `<tr><td>${dateTime(a.created_at)}</td><td>${esc(who(a.actor))}</td><td>${esc(ACT[a.action] || a.action)} ${esc(ENT[a.entity] || a.entity)} <span class="muted mono small">${esc(a.entity_id || "")}</span></td><td>${detail}</td></tr>`;
    }).join("") || `<tr><td colspan="4" class="empty">Sin registros</td></tr>`;
  }
  $("#ent", el).onchange = load; $("#q", el).oninput = () => { clearTimeout(load.t); load.t = setTimeout(load, 300); };
  await load();
}
