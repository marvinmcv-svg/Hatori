/* Branches: pause with auto-resume, delivery/pickup toggles, prep minutes, fee, WhatsApp, address. */
import { sb, state, esc, toast, errMsg, isAdmin, dateTime, $ } from "../lib.js";

export default async function render(el) {
  async function load() {
    let q = sb.from("stores").select("*").order("sort");
    if (!isAdmin()) q = q.eq("id", state.me.store_id);
    const { data } = await q; const B = window.HATTORI;
    el.innerHTML = `<div class="vhead"><div><h1>Sucursales</h1><p class="muted">El horario publicado vive en js/data.js (turnos partidos).</p></div></div>
    <div class="grid g2">${(data || []).map((s) => {
      const paused = s.is_paused && (!s.paused_until || new Date(s.paused_until) > new Date());
      const hours = [1, 2, 3, 4, 5, 6, 0].map((d) => `${B.DAYS[d].slice(0, 3)} ${B.hoursFor(s.id, d).map((x) => x.join("–")).join(", ")}`).join(" · ");
      return `<form class="panel grid" data-id="${esc(s.id)}">
        <div style="display:flex;justify-content:space-between;align-items:center"><h2>${esc(s.name)}</h2><span class="pill ${paused ? "st-new" : "st-ready"}">${paused ? "Pausada" + (s.paused_until ? " hasta " + dateTime(s.paused_until) : "") : "Recibiendo pedidos"}</span></div>
        <p class="muted small">${esc(hours)}</p>
        ${paused ? `<button type="button" class="btn btn--gold" data-resume>Reanudar pedidos</button>` : `<div class="tools"><input name="reason" placeholder="Motivo de la pausa (ej. cocina saturada)" style="flex:1">
          ${[15, 30, 60].map((m) => `<button type="button" class="btn btn--ghost btn--sm" data-pause="${m}">${m} min</button>`).join("")}<button type="button" class="btn btn--ghost btn--sm" data-pause="0">Hasta reanudar</button></div>`}
        <div class="grid g2">
          <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="accepts_delivery" style="width:auto" ${s.accepts_delivery ? "checked" : ""}> Delivery</label>
          <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="accepts_pickup" style="width:auto" ${s.accepts_pickup ? "checked" : ""}> Retiro</label>
          <label>Minutos de preparación<input type="number" name="prep_minutes" min="1" max="240" value="${s.prep_minutes}"></label>
          <label>Costo de delivery (Bs, vacío = se cotiza)<input type="number" name="delivery_fee" min="0" step="0.5" value="${s.delivery_fee ?? ""}"></label>
          <label>WhatsApp<input name="whatsapp" value="${esc(s.whatsapp)}"></label>
          <label>Dirección<input name="address" value="${esc(s.address || "")}"></label>
        </div>
        <button class="btn btn--red">Guardar</button></form>`;
    }).join("")}</div>`;
  }
  async function patch(id, p, msg) { const { error } = await sb.from("stores").update(p).eq("id", id); if (error) toast(errMsg(error), true); else { toast(msg || "Guardado"); load(); } }
  el.addEventListener("click", (e) => {
    const f = e.target.closest("form[data-id]"); if (!f) return; const id = f.dataset.id;
    const p = e.target.closest("[data-pause]");
    if (p) { const m = +p.dataset.pause; patch(id, { is_paused: true, pause_reason: f.reason.value || null, paused_until: m ? new Date(Date.now() + m * 60000).toISOString() : null }, "Sucursal pausada"); }
    if (e.target.closest("[data-resume]")) patch(id, { is_paused: false, pause_reason: null, paused_until: null }, "Pedidos reanudados");
  });
  el.addEventListener("submit", (e) => {
    e.preventDefault(); const f = e.target;
    patch(f.dataset.id, { accepts_delivery: f.accepts_delivery.checked, accepts_pickup: f.accepts_pickup.checked, prep_minutes: +f.prep_minutes.value || 20,
      delivery_fee: f.delivery_fee.value === "" ? null : +f.delivery_fee.value, whatsapp: f.whatsapp.value.replace(/\D/g, ""), address: f.address.value || null });
  });
  await load();
}
