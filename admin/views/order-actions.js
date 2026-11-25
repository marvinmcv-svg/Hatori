/* Order detail drawer: timeline, customer, address, payment, rider, notes, recall, cancel, WhatsApp, tracking link. */
import { sb, state, esc, money, time, dateTime, STATUS, CHANNEL, SERVICE, PAY, PAY_STATUS, FLOW, nextStatus, NEXT_LABEL, drawer, modal, rpc, toast, errMsg, trackUrl, waLink, can, storeName, $ } from "../lib.js";

export async function openOrder(id, onChange = () => {}) {
  const [{ data: o, error }, { data: items }, { data: evs }] = await Promise.all([
    sb.from("orders").select("*").eq("id", id).single(),
    sb.from("order_items").select("*").eq("order_id", id),
    sb.from("order_events").select("*").eq("order_id", id).order("created_at"),
  ]);
  if (error) { toast(errMsg(error), true); return; }
  const riders = can("owner", "admin", "manager", "cashier") ? (await sb.from("staff").select("user_id, full_name, store_id").eq("role", "rider").eq("active", true)).data || [] : [];
  const mgr = can("owner", "admin", "manager");
  const n = nextStatus(o);
  const flow = FLOW[o.service] || FLOW.pickup;
  const prev = flow[flow.indexOf(o.status) - 1];
  const d = drawer(`<h2>#${esc(o.order_no || "–")} · ${esc(o.code)}</h2><span class="pill st-${o.status}">${esc(STATUS[o.status])}</span>`, `
    ${o.possible_duplicate ? `<p class="dup">⚠ Posible duplicado: mismo teléfono, sucursal y monto en menos de 3 minutos.</p>` : ""}
    <div class="tools">
      ${n && o.status !== "cancelled" ? `<button class="btn btn--red" data-act="next">${esc(NEXT_LABEL[o.status])}</button>` : ""}
      ${mgr && prev && !["cancelled"].includes(o.status) ? `<button class="btn btn--ghost btn--sm" data-act="recall">↶ Volver a ${esc(STATUS[prev])}</button>` : ""}
      ${o.status !== "cancelled" && o.status !== "delivered" && !can("kitchen", "rider") ? `<button class="btn btn--ghost btn--sm" data-act="cancel">Cancelar</button>` : ""}
      ${mgr && ["cancelled", "delivered"].includes(o.status) ? `<button class="btn btn--ghost btn--sm" data-act="reopen">Reabrir</button>` : ""}
    </div>
    <dl class="kv">
      <dt>Sucursal</dt><dd>${esc(storeName(o.store_id))}</dd>
      <dt>Servicio</dt><dd>${esc(SERVICE[o.service])} · ${esc(CHANNEL[o.channel] || o.channel)}</dd>
      <dt>Creado</dt><dd>${dateTime(o.created_at)}${o.scheduled_for ? ` · programado ${time(o.scheduled_for)}` : ""}</dd>
      <dt>Cliente</dt><dd>${esc(o.customer_name)}${o.customer_phone ? ` · <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a>` : ""}</dd>
      ${o.service === "delivery" ? `<dt>Dirección</dt><dd>${esc(o.address || "—")}${o.reference ? `<br><span class="muted">${esc(o.reference)}</span>` : ""}${o.lat ? `<br><a href="https://maps.google.com/?q=${o.lat},${o.lng}" target="_blank" rel="noopener">Ver en el mapa ↗</a>` : ""}</dd>` : ""}
      ${o.cancel_reason ? `<dt>Cancelado</dt><dd>${esc((state.reasons.find((r) => r.code === o.cancel_reason) || {}).label || o.cancel_reason)}</dd>` : ""}
    </dl>
    <div class="panel"><table><tbody>${(items || []).map((i) => `<tr><td>${i.qty}×</td><td>${esc(i.name)}</td><td style="text-align:right">${money(i.line_total)}</td></tr>`).join("")}
      <tr><td></td><td>Subtotal</td><td style="text-align:right">${money(o.subtotal)}</td></tr>
      <tr><td></td><td>Delivery</td><td style="text-align:right">${money(o.delivery_fee)}</td></tr>
      ${+o.discount ? `<tr><td></td><td>Descuento</td><td style="text-align:right">−${money(o.discount)}</td></tr>` : ""}
      <tr><td></td><td><b>Total</b></td><td style="text-align:right"><b>${money(o.total)}</b></td></tr></tbody></table></div>
    ${!can("kitchen") ? `<form class="grid g2" id="ops">
      <label>Pago<select name="payment_method"><option value="">—</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}" ${o.payment_method === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Estado del pago<select name="payment_status">${Object.entries(PAY_STATUS).map(([k, v]) => `<option value="${k}" ${o.payment_status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      ${o.service === "delivery" ? `<label>Costo de delivery (Bs)<input name="delivery_fee" type="number" min="0" step="0.5" value="${esc(o.delivery_fee)}"></label>
      <label>Repartidor<select name="rider_id"><option value="">—</option>${riders.filter((r) => r.store_id === o.store_id || !r.store_id).map((r) => `<option value="${r.user_id}" ${o.rider_id === r.user_id ? "selected" : ""}>${esc(r.full_name)}</option>`).join("")}</select></label>` : ""}
      ${mgr ? `<label>Descuento (Bs)<input name="discount" type="number" min="0" step="0.5" value="${esc(o.discount)}"></label>` : ""}
      <label style="grid-column:1/-1">Notas<textarea name="notes" rows="2">${esc(o.notes || "")}</textarea></label>
      <button class="btn btn--ghost btn--sm" style="grid-column:1/-1">Guardar cambios</button></form>` : (o.notes ? `<p><b>Nota:</b> ${esc(o.notes)}</p>` : "")}
    <div><h3>Historial</h3><ul class="timeline">${(evs || []).map((e) => `<li><time>${time(e.created_at)}</time><span>${esc(STATUS[e.status])}${e.note ? ` · <span class="muted">${esc(e.note)}</span>` : ""}</span></li>`).join("")}</ul></div>
    <div class="tools">
      ${o.customer_phone ? `<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="${esc(waLink(o.customer_phone, `Hola ${o.customer_name.split(" ")[0]} 👋 Te escribimos de Hattori por tu pedido ${o.code}.`))}">WhatsApp al cliente</a>` : ""}
      <button class="btn btn--ghost btn--sm" data-act="copy">Copiar link de seguimiento</button>
    </div>`);

  const refresh = async () => { onChange(); d.close(); openOrder(id, onChange); };
  async function setStatus(s, note, reason) {
    try { await rpc("set_order_status", { p_order: id, p_status: s, p_note: note || null, p_cancel_reason: reason || null }); toast(`${o.code} → ${STATUS[s]}`); refresh(); }
    catch (e) { toast(errMsg(e), true); }
  }
  d.body.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]"); if (!a) return;
    const act = a.dataset.act;
    if (act === "next") setStatus(n);
    if (act === "recall") setStatus(prev, "Vuelto atrás");
    if (act === "reopen") setStatus("confirmed", "Reabierto");
    if (act === "copy") { navigator.clipboard.writeText(trackUrl(o.tracking_token)).then(() => toast("Link copiado")); }
    if (act === "cancel") {
      const m = modal(`<h2>Cancelar ${esc(o.code)}</h2>
        <label>Motivo<select id="cr">${state.reasons.map((r) => `<option value="${esc(r.code)}">${esc(r.label)}</option>`).join("")}</select></label>
        <label>Nota<textarea id="cn" rows="2"></textarea></label>
        <div class="tools"><button class="btn btn--red" id="ok">Cancelar pedido</button><button class="btn btn--ghost" id="no">Volver</button></div>`);
      $("#no", m.el).onclick = m.close;
      $("#ok", m.el).onclick = async () => { m.close(); setStatus("cancelled", $("#cn", m.el).value, $("#cr", m.el).value); };
    }
  });
  const ops = $("#ops", d.body);
  if (ops) ops.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(ops));
    const patch = { payment_method: f.payment_method || null, payment_status: f.payment_status, notes: f.notes || null };
    if ("delivery_fee" in f) patch.delivery_fee = Number(f.delivery_fee) || 0;
    if ("rider_id" in f) patch.rider_id = f.rider_id || null;
    if ("discount" in f) patch.discount = Number(f.discount) || 0;
    const { error: err } = await sb.from("orders").update(patch).eq("id", id);
    if (err) toast(errMsg(err), true); else { toast("Guardado"); refresh(); }
  });
}
