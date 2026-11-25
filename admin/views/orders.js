/* Live kanban board per store: realtime + refetch on reconnect/visibility + 60 s safety poll. */
import { sb, state, esc, money, time, minsSince, STATUS, NEXT_LABEL, CHANNEL, SERVICE, nextStatus, storeOptions, isAdmin, rpc, toast, errMsg, beep, $ } from "../lib.js";
import { openOrder } from "./order-actions.js";

const COLS = ["new", "confirmed", "preparing", "ready", "out_for_delivery"];

export default async function render(el, { arg }) {
  let store = isAdmin() ? (localStorage.getItem("hattori.adm.store") || "") : state.me.store_id;
  let orders = [], seen = new Set(), first = true, fresh = new Set();
  el.innerHTML = `
    <div class="vhead"><div><h1>Pedidos</h1><p class="muted">En vivo · se actualiza solo</p></div>
      <div class="tools"><select id="st" aria-label="Sucursal">${storeOptions(store, { all: true })}</select>
      <button class="btn btn--ghost btn--sm" id="done">Ver cerrados de hoy</button></div></div>
    <div class="board" id="board"></div>`;
  const board = $("#board", el);
  $("#st", el).onchange = (e) => { store = e.target.value; localStorage.setItem("hattori.adm.store", store); load(); };
  $("#done", el).onclick = () => showClosed();

  async function load() {
    let q = sb.from("orders").select("*, order_items(name, qty)").in("status", COLS).order("created_at", { ascending: true }).limit(200);
    if (store) q = q.eq("store_id", store);
    const { data, error } = await q;
    if (error) { board.innerHTML = `<p class="empty">${esc(errMsg(error))}</p>`; return; }
    const newIds = (data || []).filter((o) => o.status === "new" && !seen.has(o.id)).map((o) => o.id);
    if (!first && newIds.length) {
      beep(); newIds.forEach((id) => fresh.add(id));
      if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("Hattori · Nuevo pedido", { body: `${newIds.length} pedido(s) nuevo(s)` });
      setTimeout(() => { newIds.forEach((id) => fresh.delete(id)); }, 8000);
    }
    (data || []).forEach((o) => seen.add(o.id));
    first = false; orders = data || []; draw();
  }
  function ageCls(m) { return m < 10 ? "g" : m < 20 ? "a" : "r"; }
  function card(o) {
    const n = nextStatus(o); const m = minsSince(o.created_at);
    return `<article class="ocard ${fresh.has(o.id) ? "fresh" : ""}" data-id="${o.id}">
      <div class="ocard__top"><span><span class="ocard__no">#${esc(o.order_no || "–")}</span> <span class="ocard__code">${esc(o.code)}</span></span><span class="age ${ageCls(m)}">${m} min</span></div>
      <div class="ocard__meta"><span class="pill">${esc(SERVICE[o.service])}</span><span class="pill">${esc(CHANNEL[o.channel] || o.channel)}</span>${o.scheduled_for ? `<span class="pill">⏰ ${time(o.scheduled_for)}</span>` : ""}${!store ? `<span class="pill">${esc(o.store_id)}</span>` : ""}</div>
      ${o.possible_duplicate ? `<p class="dup">⚠ Posible duplicado</p>` : ""}
      <ul>${(o.order_items || []).map((i) => `<li>${i.qty}× ${esc(i.name)}</li>`).join("")}</ul>
      <div class="ocard__foot"><b>${money(o.total)}</b>${n && canMove(o, n) ? `<button class="btn btn--red btn--sm" data-next="${n}">${esc(NEXT_LABEL[o.status])}</button>` : ""}</div>
    </article>`;
  }
  function canMove(o, n) {
    const r = state.me.role;
    if (r === "kitchen") return ["confirmed", "preparing", "ready"].includes(n);
    if (r === "rider") return ["out_for_delivery", "delivered"].includes(n);
    return true;
  }
  function draw() {
    const cols = COLS;
    board.innerHTML = cols.map((c) => { const list = orders.filter((o) => o.status === c);
      return `<section class="col" aria-label="${esc(STATUS[c])}"><h3>${esc(STATUS[c])}<span>${list.length}</span></h3>${list.map(card).join("") || `<p class="muted small" style="padding:6px">—</p>`}</section>`; }).join("");
    const nNew = orders.filter((o) => o.status === "new").length;
    const b = document.getElementById("newBadge"); if (b) { b.hidden = !nNew; b.textContent = nNew; }
    document.title = (nNew ? `(${nNew}) ` : "") + "Pedidos · Hattori";
  }
  board.addEventListener("click", async (e) => {
    const c = e.target.closest(".ocard"); if (!c) return;
    const o = orders.find((x) => x.id === c.dataset.id);
    const nb = e.target.closest("[data-next]");
    if (nb) {
      e.stopPropagation(); nb.disabled = true;
      try { await rpc("set_order_status", { p_order: o.id, p_status: nb.dataset.next }); toast(`${o.code} → ${STATUS[nb.dataset.next]}`); await load(); }
      catch (err) { toast(errMsg(err), true); nb.disabled = false; }
      return;
    }
    openOrder(o.id, load);
  });
  async function showClosed() {
    const { data } = await (store ? sb.from("orders").select("*").eq("store_id", store) : sb.from("orders").select("*"))
      .in("status", ["delivered", "cancelled"]).gte("created_at", new Date(Date.now() - 864e5).toISOString()).order("created_at", { ascending: false }).limit(100);
    const { drawer } = await import("../lib.js");
    const d = drawer("<h2>Cerrados (24 h)</h2>", (data || []).length ? `<table><tbody>${data.map((o) => `<tr class="click" data-id="${o.id}"><td>#${esc(o.order_no)} ${esc(o.code)}</td><td>${esc(STATUS[o.status])}</td><td>${money(o.total)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Nada por aquí</p>`);
    d.body.onclick = (e) => { const tr = e.target.closest("tr"); if (tr) openOrder(tr.dataset.id, load); };
  }

  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  await load();
  if (arg) openOrder(arg, load);
  const ch = sb.channel("orders-board").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
    .subscribe((s) => { if (s === "SUBSCRIBED") load(); });
  const poll = setInterval(load, 60000);
  const tick = setInterval(draw, 30000);
  const vis = () => { if (!document.hidden) load(); };
  document.addEventListener("visibilitychange", vis);
  addEventListener("online", load);
  return () => { sb.removeChannel(ch); clearInterval(poll); clearInterval(tick); document.removeEventListener("visibilitychange", vis); removeEventListener("online", load); document.title = "Hattori · Backoffice"; };
}
