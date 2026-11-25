/* Carta: edit name, description, price, active, veg. Reminder: keep js/data.js in sync. */
import { sb, state, esc, toast, errMsg, $ } from "../lib.js";

export default async function render(el) {
  async function load() {
    const { data } = await sb.from("menu_items").select("*").order("sort");
    state.menu = data || [];
    el.innerHTML = `<div class="vhead"><div><h1>Carta</h1><p class="muted">⚠ La web muestra los precios de <code>js/data.js</code>; el sistema cobra los de aquí. Cambia los dos.</p></div></div>
    <div class="tablewrap"><table><thead><tr><th>Plato</th><th>Descripción</th><th>Precio (Bs)</th><th>Activo</th><th>Sin carne</th><th></th></tr></thead><tbody>
    ${state.menu.map((m) => `<tr data-id="${esc(m.id)}"><td><input name="name" value="${esc(m.name)}"><small class="muted mono">${esc(m.id)}</small></td>
      <td><input name="description" value="${esc(m.description || "")}"></td><td><input name="price" type="number" min="0" step="0.5" value="${m.price}" style="width:100px"></td>
      <td><input type="checkbox" name="active" style="width:auto" ${m.active ? "checked" : ""}></td><td><input type="checkbox" name="veg" style="width:auto" ${m.veg ? "checked" : ""}></td>
      <td><button class="btn btn--sm" data-save>Guardar</button></td></tr>`).join("")}</tbody></table></div>
    <p class="muted small">Los platos sin precio publicado (Fried Roll, Ceviche Clásico, etc.) no están aquí: agrégales precio en <code>js/data.js</code> y vuelve a generar el seed.</p>`;
  }
  el.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-save]")) return;
    const tr = e.target.closest("tr"); const g = (n) => tr.querySelector(`[name=${n}]`);
    const price = Number(g("price").value);
    if (!(price >= 0)) { toast("Precio inválido", true); return; }
    const { error } = await sb.from("menu_items").update({ name: g("name").value.trim(), description: g("description").value.trim() || null, price, active: g("active").checked, veg: g("veg").checked }).eq("id", tr.dataset.id);
    if (error) toast(errMsg(error), true); else toast("Guardado · recuerda actualizar js/data.js");
  });
  await load();
}
