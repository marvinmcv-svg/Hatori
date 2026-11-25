/* Manual order entry (phone / walk-in / WhatsApp). Priced by the server via place_order. */
import { sb, state, esc, money, storeOptions, rpc, toast, errMsg, PAY, CHANNEL, $ } from "../lib.js";

export default async function render(el) {
  let cart = {}, ref = crypto.randomUUID();
  const menu = state.menu.filter((m) => m.active);
  el.innerHTML = `<div class="vhead"><div><h1>Nuevo pedido</h1><p class="muted">Teléfono, mostrador o WhatsApp. El precio lo calcula el sistema.</p></div></div>
  <div class="grid g2">
    <form class="panel grid" id="f" style="align-content:start">
      <label>WhatsApp / teléfono<input name="phone" inputmode="tel" placeholder="7XXXXXXX"></label>
      <p class="muted small" id="known"></p>
      <label>Nombre<input name="name" required></label>
      <div class="grid g2"><label>Canal<select name="channel">${["phone", "whatsapp", "walk_in"].map((c) => `<option value="${c}">${CHANNEL[c]}</option>`).join("")}</select></label>
      <label>Servicio<select name="service"><option value="pickup">Retiro</option><option value="delivery">Delivery</option><option value="dine_in">En mesa</option></select></label></div>
      <div class="grid g2"><label>Sucursal<select name="store">${storeOptions(state.me.store_id || (state.stores[0] || {}).id)}</select></label>
      <label>Hora (opcional)<input name="time" type="time"></label></div>
      <label data-del>Dirección<input name="address"></label><label data-del>Referencia<input name="reference"></label>
      <label>Pago<select name="payment_method"><option value="">—</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <label>Nota<input name="notes"></label>
      <p class="err" id="err"></p>
    </form>
    <div class="panel grid" style="align-content:start">
      <input id="q" placeholder="Buscar plato…" aria-label="Buscar plato">
      <div class="picker" id="pick"></div>
      <h3>Pedido</h3><div id="lines"></div>
      <p style="display:flex;justify-content:space-between"><span>Total estimado</span><b id="tot">Bs 0</b></p>
      <button class="btn btn--red btn--xl" id="go">Registrar pedido</button>
    </div>
  </div>`;
  const f = $("#f", el);
  const drawPick = (q = "") => { $("#pick", el).innerHTML = menu.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => `<button type="button" data-add="${esc(m.id)}"><b>${esc(m.name)}</b><br><span class="muted mono">${money(m.price)}</span></button>`).join(""); };
  const draw = () => {
    const ids = Object.keys(cart);
    $("#lines", el).innerHTML = ids.length ? ids.map((id) => { const m = menu.find((x) => x.id === id); return `<p style="display:flex;justify-content:space-between;gap:8px;margin:4px 0"><span>${esc(m.name)}</span><span><button class="btn btn--ghost btn--sm" data-dec="${id}">−</button> <b>${cart[id]}</b> <button class="btn btn--ghost btn--sm" data-add="${id}">+</button></span></p>`; }).join("") : `<p class="muted">Vacío</p>`;
    $("#tot", el).textContent = money(ids.reduce((s, id) => s + menu.find((x) => x.id === id).price * cart[id], 0));
  };
  const toggleDel = () => el.querySelectorAll("[data-del]").forEach((x) => { x.hidden = f.service.value !== "delivery"; });
  f.service.onchange = toggleDel; toggleDel();
  $("#q", el).oninput = (e) => drawPick(e.target.value);
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-add]"), d = e.target.closest("[data-dec]");
    if (a) { cart[a.dataset.add] = Math.min(50, (cart[a.dataset.add] || 0) + 1); draw(); }
    if (d) { if (--cart[d.dataset.dec] <= 0) delete cart[d.dataset.dec]; draw(); }
  });
  f.phone.addEventListener("change", async () => {
    const p = f.phone.value.replace(/\D/g, "").slice(-8); if (p.length !== 8) return;
    const { data: c } = await sb.from("customers").select("*, customer_addresses(address, reference, last_used_at)").eq("phone", "+591" + p).maybeSingle();
    if (!c) { $("#known", el).textContent = "Cliente nuevo"; return; }
    f.name.value = c.name || ""; const ad = (c.customer_addresses || []).sort((a, b) => b.last_used_at.localeCompare(a.last_used_at))[0];
    if (ad) { f.address.value = ad.address; f.reference.value = ad.reference || ""; }
    $("#known", el).innerHTML = `✓ ${esc(c.name)} · ${c.orders_count} pedidos${c.allergies ? ` · <b style="color:var(--bad)">Alergias: ${esc(c.allergies)}</b>` : ""}${c.blocked ? " · <b>BLOQUEADO</b>" : ""}`;
  });
  $("#go", el).onclick = async () => {
    $("#err", el).textContent = "";
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    const p = f.phone.value.replace(/\D/g, "");
    const payload = { client_ref: "adm-" + ref, channel: f.channel.value, store: f.store.value, service: f.service.value, customer_name: f.name.value.trim(),
      customer_phone: p ? p : null, address: f.address.value || null, reference: f.reference.value || null, scheduled_for: f.time.value || null,
      notes: f.notes.value || null, payment_method: f.payment_method.value || null, items };
    const btn = $("#go", el); btn.disabled = true;
    try { const r = await rpc("place_order", { payload }); toast(`Pedido ${r.code} registrado · ${money(r.total)}`); location.hash = "#/orders"; }
    catch (e) { $("#err", el).textContent = errMsg(e); btn.disabled = false; }
  };
  drawPick(); draw();
}
