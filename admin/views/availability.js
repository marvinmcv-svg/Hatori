/* "Agotados" (86): big touch targets per item per store. Blocks web + HattorIA orders instantly. */
import { sb, state, esc, storeOptions, toast, errMsg, isAdmin, $ } from "../lib.js";

export default async function render(el) {
  let store = state.me.store_id || (state.stores[0] || {}).id;
  el.innerHTML = `<div class="vhead"><div><h1>Agotados</h1><p class="muted">Toca un plato para marcarlo agotado en esta sucursal.</p></div>
    <div class="tools">${isAdmin() ? `<select id="st">${storeOptions(store)}</select>` : ""}</div></div><div class="avail" id="grid"></div>`;
  async function load() {
    const { data } = await sb.from("store_item_availability").select("*").eq("store_id", store);
    const off = new Set((data || []).filter((a) => !a.available).map((a) => a.item_id));
    $("#grid", el).innerHTML = state.menu.filter((m) => m.active).map((m) => `<button class="${off.has(m.id) ? "off" : ""}" data-id="${esc(m.id)}" aria-pressed="${off.has(m.id)}"><b>${esc(m.name)}</b><small>${off.has(m.id) ? "AGOTADO" : "Disponible"}</small></button>`).join("");
  }
  $("#grid", el).onclick = async (e) => {
    const b = e.target.closest("button[data-id]"); if (!b) return;
    const available = b.classList.contains("off");
    b.disabled = true;
    const { error } = await sb.from("store_item_availability").upsert({ store_id: store, item_id: b.dataset.id, available, updated_at: new Date().toISOString(), updated_by: state.me.user_id });
    if (error) toast(errMsg(error), true); else toast(available ? "Disponible de nuevo" : "Marcado agotado");
    load();
  };
  const st = $("#st", el); if (st) st.onchange = (e) => { store = e.target.value; load(); };
  await load();
  const ch = sb.channel("avail").on("postgres_changes", { event: "*", schema: "public", table: "store_item_availability" }, load).subscribe();
  return () => sb.removeChannel(ch);
}
