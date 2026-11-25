/* Shared backoffice helpers: Supabase client, state, formatters, labels, UI primitives. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CFG = window.HATTORI_CONFIG || {};
export const BRAND = window.HATTORI;
export const configured = !!(CFG.supabaseUrl && CFG.supabaseKey);
export const sb = configured ? createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true } }) : null;
export const state = { me: null, stores: [], menu: [], reasons: [] };

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const money = (n) => "Bs " + Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: 2 });
export const TZ = "America/La_Paz";
export const time = (iso) => iso ? new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";
export const dateTime = (iso) => iso ? new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export const daysAgo = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() - n * 864e5));
export const minsSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

export const STATUS = { new: "Nuevo", confirmed: "Confirmado", preparing: "En barra", ready: "Listo", out_for_delivery: "En camino", delivered: "Entregado", cancelled: "Cancelado" };
export const NEXT_LABEL = { new: "Confirmar", confirmed: "Empezar", preparing: "¡Listo!", ready: "Despachar", out_for_delivery: "Entregar" };
export const CHANNEL = { web: "Web", hattoria: "HattorIA", whatsapp: "WhatsApp", phone: "Teléfono", walk_in: "Mostrador" };
export const SERVICE = { delivery: "Delivery", pickup: "Retiro", dine_in: "En mesa" };
export const ROLE = { owner: "Dueño", admin: "Admin", manager: "Encargado", cashier: "Caja", kitchen: "Cocina", rider: "Repartidor" };
export const PAY = { cash: "Efectivo", qr: "QR", card: "Tarjeta", other: "Otro" };
export const PAY_STATUS = { pending: "Pendiente", paid: "Pagado", refunded: "Reembolsado" };
export const FLOW = {
  delivery: ["new", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"],
  pickup: ["new", "confirmed", "preparing", "ready", "delivered"],
  dine_in: ["new", "confirmed", "preparing", "ready", "delivered"],
};
export const nextStatus = (o) => { const f = FLOW[o.service] || FLOW.pickup; const i = f.indexOf(o.status); return i >= 0 && i < f.length - 1 ? f[i + 1] : null; };
export const statusPill = (s) => `<span class="pill st-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
export const storeName = (id) => (state.stores.find((s) => s.id === id) || {}).name || id || "Todas";
export const can = (...roles) => !!state.me && roles.includes(state.me.role);
export const isAdmin = () => can("owner", "admin");

const ERR = {
  forbidden: "No tienes permiso para esto.", forbidden_store: "Esa sucursal no es tuya.", role_forbidden: "Tu rol no puede hacer ese cambio.",
  closed_needs_manager: "Reabrir un pedido cerrado requiere un encargado.", cancel_needs_manager: "Cancelar un pedido ya en barra requiere un encargado.",
  recall_needs_manager: "Volver atrás requiere un encargado.", not_delivery: "Solo los pedidos delivery salen en camino.",
  cancel_reason_required: "Elige un motivo de cancelación.", cancel_note_required: "Explica el motivo en la nota.",
  weak_password: "La contraseña debe tener al menos 8 caracteres.", email_taken: "Ese correo ya existe.", invalid_email: "Correo inválido.",
  owner_only: "Solo el dueño puede hacer esto.", cannot_demote_self: "No puedes quitarte permisos a ti mismo.",
  store_paused: "La sucursal está pausada.", invalid_phone: "Teléfono inválido (8 dígitos).", missing_address: "Falta la dirección.",
  missing_name: "Falta el nombre.", no_items: "Agrega al menos un plato.", rate_limited: "Demasiados pedidos seguidos de ese número.",
  customer_blocked: "Ese cliente está bloqueado.", "Invalid login credentials": "Correo o contraseña incorrectos.",
};
export function errMsg(e) {
  const m = String((e && (e.message || e.error_description || e.error)) || e || "");
  if (m.startsWith("sold_out:")) return "Agotado: " + m.slice(9);
  const k = Object.keys(ERR).find((x) => m.includes(x));
  return k ? ERR[k] : "Algo salió mal. Intenta de nuevo.";
}
export function toast(msg, bad) {
  const t = document.createElement("div"); t.className = "toast" + (bad ? " bad" : ""); t.textContent = msg;
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), 3200);
}
export async function rpc(name, args) { const { data, error } = await sb.rpc(name, args); if (error) throw error; return data; }

let openLayer = null;
function trapEsc(close) { const h = (e) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }
export function drawer(titleHTML, bodyHTML) {
  closeLayer();
  const scrim = document.createElement("div"); scrim.className = "scrim";
  const d = document.createElement("aside"); d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
  d.innerHTML = `<header><div>${titleHTML}</div><button class="x" aria-label="Cerrar">✕</button></header><div class="body">${bodyHTML}</div>`;
  document.body.append(scrim, d);
  const prev = document.activeElement;
  const close = () => { scrim.remove(); d.remove(); off(); openLayer = null; prev && prev.focus && prev.focus(); };
  const off = trapEsc(close);
  scrim.onclick = close; $(".x", d).onclick = close; $(".x", d).focus();
  openLayer = close; return { el: d, body: $(".body", d), close };
}
export function modal(html) {
  const scrim = document.createElement("div"); scrim.className = "scrim"; scrim.style.zIndex = 52;
  const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.style.zIndex = 53; m.innerHTML = html;
  document.body.append(scrim, m);
  const close = () => { scrim.remove(); m.remove(); off(); };
  const off = trapEsc(close); scrim.onclick = close;
  const f = m.querySelector("input,select,textarea,button"); f && f.focus();
  return { el: m, close };
}
export function closeLayer() { if (openLayer) openLayer(); }

let audioCtx;
export function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch { /* no audio */ } }
export function beep() {
  if (!audioCtx) return;
  [0, .18, .36].forEach((t, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = i === 2 ? 1175 : 880; o.type = "sine"; g.gain.setValueAtTime(.0001, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(.3, audioCtx.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + t + .16);
    o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + .18);
  });
}
export function csv(filename, rows) {
  if (!rows.length) { toast("No hay datos para exportar"); return; }
  const cols = Object.keys(rows[0]);
  const q = (v) => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" })); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function trackUrl(token) { return (CFG.siteUrl || location.origin).replace(/\/$/, "") + (CFG.trackPath || "/seguimiento/") + "?t=" + token; }
export function waLink(phone, text) { return "https://wa.me/" + String(phone || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(text); }
export function storeOptions(selected, { all = false } = {}) {
  const list = isAdmin() ? state.stores : state.stores.filter((s) => s.id === state.me.store_id);
  return (all && isAdmin() ? `<option value="">Todas las sucursales</option>` : "") + list.map((s) => `<option value="${esc(s.id)}" ${s.id === selected ? "selected" : ""}>${esc(s.name)}</option>`).join("");
}
export function barChart(data, { label = (d) => d.label, value = (d) => d.value, fmt = (v) => v, cls = "bar" } = {}) {
  if (!data.length) return `<p class="empty">Sin datos</p>`;
  const W = 600, H = 180, pad = 24, max = Math.max(...data.map(value), 1), bw = (W - pad) / data.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${data.map((d, i) => {
    const h = Math.max(2, (value(d) / max) * (H - 46)); const x = pad / 2 + i * bw;
    return `<g><rect class="${cls}" x="${x + 3}" y="${H - 22 - h}" width="${Math.max(4, bw - 6)}" height="${h}" rx="3"><title>${esc(label(d))}: ${esc(fmt(value(d)))}</title></rect>
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#6e645b">${esc(label(d))}</text></g>`;
  }).join("")}</svg>`;
}
