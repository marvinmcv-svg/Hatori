/* My account: profile summary + change own password. */
import { sb, state, esc, ROLE, storeName, toast, errMsg, $ } from "../lib.js";

export default async function render(el) {
  const m = state.me;
  el.innerHTML = `<div class="vhead"><h1>Mi cuenta</h1></div>
  <div class="grid g2"><div class="panel"><dl class="kv"><dt>Nombre</dt><dd>${esc(m.full_name)}</dd><dt>Correo</dt><dd>${esc(m.email || "")}</dd><dt>Rol</dt><dd>${esc(ROLE[m.role])}</dd><dt>Sucursal</dt><dd>${esc(storeName(m.store_id))}</dd></dl></div>
  <form class="panel grid" id="f"><h2>Cambiar contraseña</h2><label>Nueva contraseña<input type="password" name="p1" minlength="8" autocomplete="new-password" required></label>
  <label>Repetir<input type="password" name="p2" minlength="8" autocomplete="new-password" required></label><p class="err" id="er"></p><button class="btn btn--red">Cambiar</button></form></div>`;
  $("#f", el).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; $("#er", el).textContent = "";
    if (f.p1.value.length < 8) { $("#er", el).textContent = "Mínimo 8 caracteres."; return; }
    if (f.p1.value !== f.p2.value) { $("#er", el).textContent = "No coinciden."; return; }
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    if (error) $("#er", el).textContent = errMsg(error); else { toast("Contraseña cambiada"); f.reset(); }
  };
}
