/* Backoffice shell: auth, role-based navigation, hash router, lazy views. */
import { sb, configured, state, $, esc, ROLE, storeName, errMsg, unlockAudio, closeLayer } from "./lib.js";

const ROUTES = [
  { id: "home", label: "Hoy", icon: "◐", roles: ["owner", "admin", "manager"] },
  { id: "orders", label: "Pedidos", icon: "☰", roles: ["owner", "admin", "manager", "cashier", "kitchen", "rider"] },
  { id: "neworder", label: "Nuevo pedido", icon: "＋", roles: ["owner", "admin", "manager", "cashier"] },
  { id: "customers", label: "Clientes", icon: "☺", roles: ["owner", "admin", "manager", "cashier"] },
  { id: "stores", label: "Sucursales", icon: "⌂", roles: ["owner", "admin", "manager"] },
  { id: "availability", label: "Agotados", icon: "✕", roles: ["owner", "admin", "manager", "cashier", "kitchen"] },
  { id: "menu", label: "Carta", icon: "巻", roles: ["owner", "admin"] },
  { id: "reports", label: "Reportes", icon: "▤", roles: ["owner", "admin", "manager", "cashier"] },
  { id: "team", label: "Equipo", icon: "♟", roles: ["owner", "admin"] },
  { id: "audit", label: "Auditoría", icon: "⌕", roles: ["owner", "admin"] },
  { id: "account", label: "Mi cuenta", icon: "◎", roles: ["owner", "admin", "manager", "cashier", "kitchen", "rider"] },
];
let cleanup = null, routeToken = 0;
const allowed = () => ROUTES.filter((r) => r.roles.includes(state.me.role));

async function boot() {
  if (!configured) { $("#notconfigured").hidden = false; return; }
  document.addEventListener("pointerdown", unlockAudio, { once: true });
  const { data } = await sb.auth.getSession();
  if (data.session) await enter(); else showLogin();
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") showLogin(); });
}
function showLogin(msg) { $("#app").hidden = true; $("#login").hidden = false; $("#loginErr").textContent = msg || ""; }
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target; $("#loginErr").textContent = "";
  const btn = f.querySelector("button"); btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  btn.disabled = false;
  if (error) { $("#loginErr").textContent = errMsg(error); return; }
  await enter();
});

async function enter() {
  const { data: u } = await sb.auth.getUser();
  const { data: me } = await sb.from("staff").select("*").eq("user_id", u.user && u.user.id).maybeSingle();
  if (!me || !me.active) { await sb.auth.signOut(); return showLogin("Tu usuario no tiene acceso al backoffice."); }
  state.me = me;
  const [st, mi, cr] = await Promise.all([
    sb.from("stores").select("*").order("sort"), sb.from("menu_items").select("*").order("sort"), sb.from("cancel_reasons").select("*").order("sort"),
  ]);
  state.stores = st.data || []; state.menu = mi.data || []; state.reasons = cr.data || [];
  $("#login").hidden = true; $("#app").hidden = false;
  $("#me").innerHTML = `<b>${esc(me.full_name)}</b>${esc(ROLE[me.role])} · ${esc(storeName(me.store_id))}<br><a href="#" id="logout">Cerrar sesión</a>`;
  $("#logout").onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); };
  renderNav(); route();
}
function renderNav() {
  const cur = (location.hash.slice(2) || "").split("/")[0];
  $("#nav").innerHTML = allowed().map((r) => `<a href="#/${r.id}" class="${r.id === cur ? "on" : ""}" data-r="${r.id}"><span aria-hidden="true">${r.icon}</span>${esc(r.label)}${r.id === "orders" ? '<span class="badge" id="newBadge" hidden>0</span>' : ""}</a>`).join("");
}
async function route() {
  if (!state.me) return;
  const [id, arg] = (location.hash.slice(2) || "").split("/");
  const r = allowed().find((x) => x.id === id) || allowed()[0];
  if (r.id !== id) { location.replace("#/" + r.id); return; }
  closeLayer();
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  renderNav();
  const my = ++routeToken;
  const old = $("#view"); const view = old.cloneNode(false); old.replaceWith(view); // fresh element: no stale listeners
  view.innerHTML = `<p class="loading">Cargando…</p>`;
  try {
    const mod = await import(`./views/${r.id}.js`);
    if (my !== routeToken) return;
    view.innerHTML = "";
    cleanup = (await mod.default(view, { arg })) || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<p class="empty">No se pudo cargar esta sección. ${esc(errMsg(e))}</p>`;
  }
}
addEventListener("hashchange", route);
boot();
