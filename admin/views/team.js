/* Team: staff list, create users, change role/store/active, reset password (owner/admin). */
import { sb, state, esc, ROLE, storeName, modal, rpc, toast, errMsg, $ } from "../lib.js";

const roleOpts = (sel) => Object.entries(ROLE).filter(([k]) => k !== "owner" || state.me.role === "owner").map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
const storeOpts = (sel) => `<option value="">Todas (solo dueño/admin)</option>` + state.stores.map((s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${esc(s.name)}</option>`).join("");

export default async function render(el) {
  async function load() {
    const { data } = await sb.from("staff").select("*").order("role").order("full_name");
    el.innerHTML = `<div class="vhead"><div><h1>Equipo</h1><p class="muted">${(data || []).length} personas</p></div><button class="btn btn--red" id="add">+ Agregar persona</button></div>
    <div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sucursal</th><th>Estado</th><th></th></tr></thead><tbody>
    ${(data || []).map((s) => `<tr data-id="${s.user_id}"><td><b>${esc(s.full_name)}</b></td><td>${esc(s.email || "")}</td><td>${esc(ROLE[s.role])}</td><td>${esc(storeName(s.store_id))}</td>
      <td>${s.active ? '<span class="pill st-ready">Activo</span>' : '<span class="pill st-cancelled">Inactivo</span>'}</td>
      <td class="tools"><button class="btn btn--ghost btn--sm" data-edit>Editar</button><button class="btn btn--ghost btn--sm" data-pw>Contraseña</button></td></tr>`).join("")}</tbody></table></div>`;
    $("#add", el).onclick = add;
    el.querySelectorAll("tr[data-id]").forEach((tr) => {
      const s = data.find((x) => x.user_id === tr.dataset.id);
      tr.querySelector("[data-edit]").onclick = () => edit(s);
      tr.querySelector("[data-pw]").onclick = () => pw(s);
    });
  }
  function add() {
    const m = modal(`<h2>Agregar persona</h2><label>Nombre<input id="n"></label><label>Correo<input id="e" type="email"></label><label>Teléfono<input id="p"></label>
      <label>Contraseña temporal (mín. 8)<input id="w" type="text" minlength="8"></label><label>Rol<select id="r">${roleOpts("cashier")}</select></label><label>Sucursal<select id="s">${storeOpts(state.stores[0] && state.stores[0].id)}</select></label>
      <p class="err" id="er"></p><div class="tools"><button class="btn btn--red" id="ok">Crear</button><button class="btn btn--ghost" id="no">Cancelar</button></div>`);
    $("#no", m.el).onclick = m.close;
    $("#ok", m.el).onclick = async () => {
      try { await rpc("admin_create_staff", { p_email: $("#e", m.el).value, p_password: $("#w", m.el).value, p_full_name: $("#n", m.el).value, p_role: $("#r", m.el).value, p_store: $("#s", m.el).value || null, p_phone: $("#p", m.el).value || null });
        m.close(); toast("Usuario creado. Comparte la contraseña temporal en privado."); load(); }
      catch (e) { $("#er", m.el).textContent = errMsg(e); }
    };
  }
  function edit(s) {
    const m = modal(`<h2>${esc(s.full_name)}</h2><label>Nombre<input id="n" value="${esc(s.full_name)}"></label><label>Rol<select id="r">${roleOpts(s.role)}</select></label>
      <label>Sucursal<select id="s">${storeOpts(s.store_id)}</select></label><label style="flex-direction:row;gap:8px;align-items:center"><input id="a" type="checkbox" style="width:auto" ${s.active ? "checked" : ""}> Activo</label>
      <p class="err" id="er"></p><div class="tools"><button class="btn btn--red" id="ok">Guardar</button><button class="btn btn--ghost" id="no">Cancelar</button></div>`);
    $("#no", m.el).onclick = m.close;
    $("#ok", m.el).onclick = async () => {
      try { await rpc("admin_update_staff", { p_user: s.user_id, p_role: $("#r", m.el).value, p_store: $("#s", m.el).value || null, p_active: $("#a", m.el).checked, p_full_name: $("#n", m.el).value }); m.close(); toast("Guardado"); load(); }
      catch (e) { $("#er", m.el).textContent = errMsg(e); }
    };
  }
  function pw(s) {
    const m = modal(`<h2>Nueva contraseña</h2><p class="muted">${esc(s.full_name)}</p><label>Contraseña (mín. 8)<input id="w" type="text" minlength="8"></label><p class="err" id="er"></p>
      <div class="tools"><button class="btn btn--red" id="ok">Cambiar</button><button class="btn btn--ghost" id="no">Cancelar</button></div>`);
    $("#no", m.el).onclick = m.close;
    $("#ok", m.el).onclick = async () => { try { await rpc("admin_set_password", { p_user: s.user_id, p_password: $("#w", m.el).value }); m.close(); toast("Contraseña cambiada"); } catch (e) { $("#er", m.el).textContent = errMsg(e); } };
  }
  await load();
}
