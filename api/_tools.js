/* HattorIA deterministic tools. The model PROPOSES tool calls; this file
   validates and executes them. Every price, total, hour and order is computed
   here from js/data.js — never by the model. */
"use strict";
const crypto = require("node:crypto");
const B = require("../js/data.js");
const CFG = require("../js/config.js");

const CAT = B.catalog();
const CUR = B.config.currency;
const money = (n) => `${CUR} ${Math.round(n * 100) / 100}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s:]/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => norm(s).split(" ").filter(Boolean);

/* ---------- Synonyms: customer words → menu words (teach new ones from hattoria_miss logs) */
const SYNONYMS = {
  "sushi": "roll", "rollo": "roll", "rollos": "roll", "rolls": "roll", "maki": "maki", "makis": "maki",
  "calamar": "ika", "pulpo": "ika", "trucha": "masu", "salmon": "masu",
  "tabla": "tabla", "bandeja": "tabla", "compartir": "tabla", "platter": "tabla", "grupo": "tabla",
  "cebiche": "ceviche", "seviche": "ceviche", "sebiche": "ceviche",
  "pasta": "fetuccine", "fideo": "fetuccine", "fideos": "fetuccine", "fettuccine": "fetuccine", "huancaina": "fetuccine",
  "sopa": "ramen", "caldo": "ramen", "noodles": "ramen",
  "ensalada": "salad", "salad": "salad", "bowl": "bowl", "poke": "bowl",
  "frito": "fried", "frita": "fried", "fritos": "fried", "crocante": "fried", "tempura": "fried",
  "acevichado": "acevichado", "acevichada": "acevichado", "tartar": "tartar", "tartare": "tartar",
};
const MULTI_SYNONYMS = { "para compartir": "tabla", "sin crudo": "", "sopa japonesa": "ramen" };

/* ---------- state hardening (everything from the browser is untrusted) */
const SERVICES = ["delivery", "pickup"];
function sanitizeCart(c) {
  const out = {}; let n = 0;
  for (const [id, q] of Object.entries(c && typeof c === "object" ? c : {})) {
    if (!CAT[id] || !CAT[id].orderable || n >= 30) continue;
    const qty = Math.max(1, Math.min(50, Math.floor(Number(q) || 0)));
    if (qty) { out[id] = qty; n++; }
  }
  return out;
}
function normPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  const P = B.config.phonePrefix;
  if (d.startsWith(P) && d.length === P.length + B.config.phoneDigits) d = d.slice(P.length);
  return /^[67]\d{7}$/.test(d) ? d : null;
}
const str = (v, max = 200) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : undefined);
function sanitizeState(s) {
  s = s && typeof s === "object" ? s : {};
  const o = s.order && typeof s.order === "object" ? s.order : {};
  const order = {};
  if (SERVICES.includes(o.service)) order.service = o.service;
  if (B.branches.some((b) => b.id === o.branch)) order.branch = o.branch;
  for (const k of ["address", "reference", "name", "payment", "notes"]) { const v = str(o[k]); if (v) order[k] = v; }
  if (o.when === "asap" || /^([01]\d|2[0-3]):[0-5]\d$/.test(o.when || "")) order.when = o.when;
  const ph = normPhone(o.phone); if (ph) order.phone = ph;
  if (o.location && Number.isFinite(+o.location.lat) && Number.isFinite(+o.location.lng) && Math.abs(+o.location.lat) <= 90 && Math.abs(+o.location.lng) <= 180) {
    order.location = { lat: +(+o.location.lat).toFixed(6), lng: +(+o.location.lng).toFixed(6) };
  }
  const history = (Array.isArray(s.history) ? s.history : []).slice(0, 3).map((h) => ({
    id: str(h && h.id, 20) || "", at: Number(h && h.at) || 0,
    branch: B.branches.some((b) => b.id === (h && h.branch)) ? h.branch : B.branches[0].id,
    service: SERVICES.includes(h && h.service) ? h.service : "pickup",
    cart: sanitizeCart(h && h.cart), track: h && UUID_RE.test(h.track || "") ? h.track : null,
  })).filter((h) => Object.keys(h.cart).length);
  const stage = ["browsing", "awaiting_confirmation", "placed"].includes(s.stage) ? s.stage : "browsing";
  return {
    cart: sanitizeCart(s.cart), prevCart: s.prevCart ? sanitizeCart(s.prevCart) : null, order, stage,
    token: typeof s.token === "string" && /^[a-f0-9]{16}$/.test(s.token) ? s.token : null,
    upsold: !!s.upsold, newsShown: !!s.newsShown, history,
    placed: s.placed && typeof s.placed === "object" && /^[a-f0-9]{16}$/.test(s.placed.token || "") ? { token: s.placed.token, id: str(s.placed.id, 20), url: String(s.placed.url || "").startsWith("https://wa.me/") ? s.placed.url : null, total: Number(s.placed.total) || 0 } : null,
  };
}

/* ---------- yes detection (server-enforced confirmation) */
const YES = ["si", "sí", "dale", "ok", "okay", "listo", "confirmo", "confirmar", "confirma", "de una", "va", "claro", "perfecto", "correcto", "yes", "sip", "simon", "ya", "hazlo", "manda", "envia", "envialo", "si confirmar", "si, confirmar", "esta bien", "todo bien", "asi esta bien"];
const NOT = ["no", "pero", "cambia", "cambiar", "cambio", "quita", "quitar", "saca", "agrega", "agregar", "anade", "espera", "mejor", "aunque", "menos", "mas"];
function isYes(text) {
  const t = norm(text); if (!t || t.length > 60) return false;
  const w = t.split(" ");
  if (w.some((x) => NOT.includes(x))) return false;
  return YES.some((y) => { const n = norm(y); return t === n || t.startsWith(n + " ") || w.includes(n); });
}

/* ---------- search */
function itemText(it) { return words(`${it.name} ${it.desc} ${it.catName} ${it.size || ""} ${it.share ? "tabla compartir" : ""}`); }
function searchMenu(query) {
  let q = norm(query);
  for (const [k, v] of Object.entries(MULTI_SYNONYMS)) q = q.replace(new RegExp(`\\b${k}\\b`, "g"), v);
  let ws = q.split(" ").filter(Boolean);
  const drop = new Set();
  ws.forEach((w, i) => { if ((w === "sin" || w === "without") && ws[i + 1]) drop.add(SYNONYMS[ws[i + 1]] || ws[i + 1]); });
  ws = ws.filter((w, i) => w !== "sin" && !(i > 0 && ws[i - 1] === "sin")).map((w) => SYNONYMS[w] !== undefined ? SYNONYMS[w] : w).filter((w) => w && w.length > 1 && !["el", "la", "los", "las", "de", "del", "un", "una", "con", "y", "que", "quiero", "tienen", "hay", "algo", "me", "por", "favor"].includes(w));
  const all = Object.values(CAT);
  if (!ws.length && !drop.size) return [];
  const scored = all.map((it) => {
    const tw = itemText(it);
    let score = 0;
    for (const w of ws) { if (tw.some((x) => x === w)) score += 3; else if (tw.some((x) => x.startsWith(w) && w.length >= 3)) score += 1; }
    for (const d of drop) if (tw.some((x) => x.startsWith(d))) score -= 5;
    return { it, score };
  }).filter((x) => x.score > 0 || (!ws.length && x.score === 0 && drop.size));
  scored.sort((a, b) => b.score - a.score || (a.it.kind === "main" ? -1 : 1) || a.it.sort - b.it.sort);
  return scored.slice(0, 8).map((x) => x.it);
}
function resolveItem(ref) {
  if (!ref) return { options: [] };
  if (CAT[ref]) return { item: CAT[ref] };
  const hits = searchMenu(ref);
  const exact = hits.find((h) => norm(h.name) === norm(ref));
  if (exact) return { item: exact };
  if (hits.length === 1) return { item: hits[0] };
  if (hits.length > 1) {
    const top = hits.filter((h) => itemText(h).join(" ").includes(norm(ref)));
    if (top.length === 1) return { item: top[0] };
  }
  return { options: hits.slice(0, 4) };
}
const brief = (it) => ({ id: it.id, name: it.name, price: it.orderable ? it.price : null, price_text: it.orderable ? money(it.price) : "precio no publicado (consultar por WhatsApp)", category: it.catName, size: it.size || undefined, orderable: it.orderable });

/* ---------- formatting */
function cartLines(cart) { return Object.entries(cart).map(([id, q]) => ({ id, name: CAT[id].name, qty: q, unit: CAT[id].price, line_total: CAT[id].price * q })); }
const cartTotal = (cart) => cartLines(cart).reduce((s, l) => s + l.line_total, 0);
function cartView(cart) { const lines = cartLines(cart); return { lines: lines.map((l) => ({ ...l, line_text: `${l.qty}× ${l.name} — ${money(l.line_total)}` })), total: cartTotal(cart), total_text: money(cartTotal(cart)), empty: !lines.length }; }
const branchById = (id) => B.branches.find((b) => b.id === id);
function findBranch(name) {
  if (!name) return null; const n = norm(name);
  return B.branches.find((b) => b.id === n || norm(b.name) === n || norm(b.name).includes(n) || n.includes(norm(b.name))) || null;
}
function statusText(s) {
  if (s.state === "open") return `abierta hasta las ${s.closesAt}`;
  if (s.state === "soon") return `cierra pronto (${s.closesAt})`;
  return s.opensAt ? `cerrada; abre ${s.opensDay} a las ${s.opensAt}` : "cerrada";
}
function waUrl(num, text) { return `https://wa.me/${num}?text=${encodeURIComponent(text)}`; }
const trackLink = (token) => `${CFG.siteUrl.replace(/\/$/, "")}${CFG.trackPath}?t=${token}`;
function mapsLink(loc) { return `https://maps.google.com/?q=${loc.lat},${loc.lng}`; }
function whenText(w) { return !w || w === "asap" ? "Lo antes posible" : w; }

function buildWhatsApp(cart, o, code, track) {
  const b = branchById(o.branch);
  const L = ["Hola Hattori 👋", `Quiero un pedido para *${o.service === "delivery" ? "Delivery" : "Retiro"}* en ${b.name}:`];
  cartLines(cart).forEach((l) => L.push(`• ${l.qty}× ${l.name} — ${money(l.line_total)}`));
  L.push(`*Total: ${money(cartTotal(cart))}*`);
  L.push(`Nombre: ${o.name}`, `WhatsApp: ${o.phone}`);
  if (o.service === "delivery") {
    if (o.address) L.push(`Dirección: ${o.address}`);
    if (o.reference) L.push(`Referencia: ${o.reference}`);
    if (o.location) L.push(`Ubicación: ${mapsLink(o.location)}`);
  }
  L.push(`Hora: ${whenText(o.when)}`);
  if (o.payment) L.push(`Pago: ${o.payment}`);
  if (o.notes) L.push(`Nota: ${o.notes}`);
  L.push("", `Pedido ${code} (vía HattorIA)`);
  if (track) L.push(`Sigue tu pedido: ${trackLink(track)}`);
  return L.join("\n");
}
function tokenFor(cart, o) {
  const body = JSON.stringify([Object.keys(cart).sort().map((k) => [k, cart[k]]), ["service", "branch", "address", "reference", "when", "name", "phone", "payment", "notes"].map((k) => o[k] || ""), o.location || null]);
  return crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
}
const codeFor = (token) => "HT-" + parseInt(token.slice(0, 10), 16).toString(36).toUpperCase().slice(-5).padStart(5, "X");

/* ---------- tool schemas (valid for Anthropic and OpenAI-style providers) */
const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const TOOLS = [
  { name: "search_menu", description: "Busca platos en la carta de Hattori por nombre, ingrediente o tipo (ej. 'roll', 'ceviche', 'para compartir', 'sin salmón'). Úsala para CUALQUIER pregunta sobre la carta o precios.", input_schema: obj({ query: { type: "string" } }, ["query"]) },
  { name: "get_item_details", description: "Detalle de un plato: precio, tamaño, descripción y aviso de alérgenos.", input_schema: obj({ item: { type: "string", description: "id o nombre del plato" } }, ["item"]) },
  { name: "get_whats_new", description: "Qué hay de nuevo o destacado en Hattori.", input_schema: obj({}) },
  { name: "get_branches", description: "Sucursales: horario, si está abierta ahora, dirección, WhatsApp.", input_schema: obj({ name: { type: "string" } }) },
  { name: "get_deals", description: "Promos y combos vigentes y sugerencias según el carrito.", input_schema: obj({}) },
  { name: "cart_add", description: "Agrega platos al carrito. Acepta ids o nombres.", input_schema: obj({ items: { type: "array", items: obj({ item: { type: "string" }, qty: { type: "integer", minimum: 1, maximum: 50 } }, ["item"]) } }, ["items"]) },
  { name: "cart_remove", description: "Quita un plato del carrito.", input_schema: obj({ item: { type: "string" } }, ["item"]) },
  { name: "cart_set_qty", description: "Cambia la cantidad de un plato del carrito.", input_schema: obj({ item: { type: "string" }, qty: { type: "integer", minimum: 0, maximum: 50 } }, ["item", "qty"]) },
  { name: "cart_clear", description: "Vacía el carrito.", input_schema: obj({}) },
  { name: "cart_view", description: "Muestra el carrito con el total exacto.", input_schema: obj({}) },
  { name: "cart_undo", description: "Deshace el último cambio del carrito.", input_schema: obj({}) },
  { name: "cart_swap_to_combo", description: "Reemplaza platos del carrito por un combo equivalente.", input_schema: obj({ combo_id: { type: "string" } }, ["combo_id"]) },
  { name: "suggest_upsell", description: "Una sola sugerencia adicional por conversación (bebida o acompañamiento).", input_schema: obj({}) },
  { name: "get_my_orders", description: "Mi Pedido: los últimos pedidos hechos en este dispositivo.", input_schema: obj({}) },
  { name: "reorder", description: "Vuelve a cargar un pedido anterior (Mi Pedido) en el carrito. index 0 = el más reciente.", input_schema: obj({ index: { type: "integer", minimum: 0, maximum: 2 } }, ["index"]) },
  { name: "set_order_details", description: "Guarda los datos del pedido y devuelve lo que falta. service: delivery|pickup. when: 'asap' o 'HH:MM'. phone: WhatsApp boliviano de 8 dígitos.", input_schema: obj({ service: { type: "string", enum: ["delivery", "pickup"] }, branch: { type: "string" }, address: { type: "string" }, reference: { type: "string" }, when: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, payment: { type: "string" }, notes: { type: "string" } }) },
  { name: "request_location", description: "Muestra el botón 'Compartir mi ubicación' (entrega con pin).", input_schema: obj({}) },
  { name: "prepare_order", description: "Revisa que el pedido esté completo y genera el resumen para confirmar. Después de llamarla, termina tu turno y espera el 'sí' del cliente.", input_schema: obj({}) },
  { name: "place_order", description: "Confirma el pedido. SOLO después de que el cliente dijo 'sí' al resumen.", input_schema: obj({ token: { type: "string" } }, ["token"]) },
  { name: "get_order_status", description: "Sigue tu Roll: estado en vivo del último pedido.", input_schema: obj({}) },
  { name: "handoff_to_human", description: "Pasa la conversación a una persona por WhatsApp (reclamos, alergias severas, eventos grandes, o tras 2 intentos fallidos).", input_schema: obj({ reason: { type: "string" }, summary: { type: "string" } }, ["reason", "summary"]) },
  { name: "show_options", description: "Muestra 2 a 4 botones de respuesta rápida.", input_schema: obj({ options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } }, ["options"]) },
  { name: "log_miss", description: "Registra algo que el cliente pidió y no supiste responder.", input_schema: obj({ text: { type: "string" }, reason: { type: "string" } }, ["text", "reason"]) },
];

/* ---------- session: runs tools against a state, collects UI events */
function createSession(rawState, opts = {}) {
  const now = opts.now || (() => new Date());
  const state = sanitizeState(rawState);
  const events = [];
  const emit = (e) => events.push(e);
  const log = opts.log || ((x) => console.log(JSON.stringify(x)));
  const setCart = (next) => { state.prevCart = { ...state.cart }; state.cart = sanitizeCart(next); emit({ type: "cart", cart: state.cart }); if (state.stage === "awaiting_confirmation") { state.stage = "browsing"; state.token = null; } };
  const invalidate = () => { if (state.stage === "awaiting_confirmation") { state.stage = "browsing"; state.token = null; } };
  let backendPayload = null;

  function missing() {
    const o = state.order, m = [];
    if (!Object.keys(state.cart).length) m.push("platos");
    if (!o.service) m.push("delivery o retiro");
    if (!o.branch) m.push("sucursal");
    if (o.service === "delivery" && !o.address && !o.location) m.push("dirección o ubicación");
    if (!o.when) m.push("hora (lo antes posible u HH:MM)");
    if (!o.name) m.push("nombre");
    if (!o.phone) m.push("WhatsApp (8 dígitos)");
    return m;
  }
  function checkTime(branch, when) {
    const n = now();
    if (!when || when === "asap") {
      const s = B.statusAt(branch, n);
      return s.state === "closed" ? `La sucursal está ${statusText(s)}. Puedes programar para cuando abra.` : null;
    }
    const t = B.localParts(n);
    if (B.toMin(when) <= t.minutes) return `Esa hora (${when}) ya pasó; ahora son las ${t.hhmm}.`;
    if (!B.openAtTime(branch, when, n)) return `A las ${when} la sucursal ${branchById(branch).name} no está abierta. Horario hoy: ${B.hoursFor(branch, t.day).map((x) => x.join("–")).join(", ") || "cerrado"}.`;
    return null;
  }

  const impl = {
    search_menu({ query }) {
      const r = searchMenu(query);
      if (!r.length) { log({ evt: "hattoria_miss", text: query, reason: "search_empty" }); return { results: [], note: "Sin resultados en la carta publicada." }; }
      return { results: r.map(brief) };
    },
    get_item_details({ item }) {
      const r = resolveItem(item);
      if (!r.item) return { error: "not_found", options: (r.options || []).map(brief) };
      const it = r.item;
      return { ...brief(it), description: it.desc, ingredients: "La carta publicada no detalla ingredientes.", allergens: "No tenemos información de alérgenos; consulta en la sucursal antes de pedir.", included_in_promos: [] };
    },
    get_whats_new() {
      state.newsShown = true;
      return { featured: B.featured.map((id) => brief(CAT[id])), new_items: Object.values(CAT).filter((i) => i.hot).map(brief), promos: [], note: "No hay promos ni combos publicados ahora." };
    },
    get_branches({ name } = {}) {
      const n = now(), t = B.localParts(n);
      const list = (name ? [findBranch(name)].filter(Boolean) : B.branches).map((b) => {
        const s = B.statusAt(b.id, n);
        return { id: b.id, name: b.name, status: s.state, status_text: statusText(s), hours_today: B.hoursFor(b.id, t.day).map((x) => x.join("–")), address: b.address || "no publicada (consultar por WhatsApp)", whatsapp: b.whatsapp, maps: b.maps || null };
      });
      return { now: t.hhmm, branches: list };
    },
    get_deals() {
      return { today_promo: null, special: null, combos: [], hints: [], note: "Hattori no tiene promos ni combos publicados en este momento. No inventes ninguno." };
    },
    cart_add({ items }) {
      const next = { ...state.cart }, added = [], problems = [];
      for (const x of (items || []).slice(0, 30)) {
        const r = resolveItem(x.item);
        if (!r.item) { problems.push({ item: x.item, error: r.options && r.options.length ? "ambiguous" : "not_found", options: (r.options || []).map(brief) }); continue; }
        if (!r.item.orderable) { problems.push({ item: r.item.name, error: "price_not_published", note: "Este plato no tiene precio publicado; se consulta por WhatsApp con la sucursal." }); continue; }
        if (!next[r.item.id] && Object.keys(next).length >= 30) { problems.push({ item: r.item.name, error: "cart_full" }); continue; }
        const q = Math.max(1, Math.min(50, x.qty | 0 || 1));
        next[r.item.id] = Math.min(50, (next[r.item.id] || 0) + q); added.push({ id: r.item.id, name: r.item.name, qty: q });
      }
      if (added.length) setCart(next);
      problems.forEach((p) => p.error === "not_found" && log({ evt: "hattoria_miss", text: p.item, reason: "cart_add_not_found" }));
      return { added, problems, cart: cartView(state.cart) };
    },
    cart_remove({ item }) {
      const r = resolveItem(item); const id = r.item && r.item.id;
      if (!id || !state.cart[id]) return { error: "not_in_cart", cart: cartView(state.cart) };
      const next = { ...state.cart }; delete next[id]; setCart(next); return { removed: CAT[id].name, cart: cartView(state.cart) };
    },
    cart_set_qty({ item, qty }) {
      const r = resolveItem(item); const id = r.item && r.item.id;
      if (!id || !state.cart[id]) return { error: "not_in_cart", cart: cartView(state.cart) };
      const next = { ...state.cart }; const q = Math.max(0, Math.min(50, qty | 0));
      if (q === 0) delete next[id]; else next[id] = q; setCart(next); return { cart: cartView(state.cart) };
    },
    cart_clear() { setCart({}); return { cart: cartView(state.cart) }; },
    cart_view() { return { cart: cartView(state.cart) }; },
    cart_undo() {
      if (!state.prevCart) return { error: "nothing_to_undo", cart: cartView(state.cart) };
      const p = state.prevCart; setCart(p); state.prevCart = null; return { cart: cartView(state.cart) };
    },
    cart_swap_to_combo() { return { error: "no_combos", note: "Hattori no tiene combos publicados." }; },
    suggest_upsell() {
      if (state.upsold) return { suggestion: null, note: "Ya sugeriste algo en esta conversación." };
      state.upsold = true;
      return { suggestion: null, note: "No hay bebidas ni acompañamientos con precio publicado; no sugieras nada." };
    },
    get_my_orders() {
      return { orders: state.history.map((h, i) => ({ index: i, id: h.id, branch: branchById(h.branch).name, service: h.service, items: cartView(h.cart).lines.map((l) => l.line_text), total_text: money(cartTotal(h.cart)) })) };
    },
    reorder({ index }) {
      const h = state.history[index | 0];
      if (!h) return { error: "no_order" };
      setCart(h.cart); state.order.branch = h.branch; state.order.service = h.service; invalidate();
      return { loaded: true, branch: branchById(h.branch).name, service: h.service, cart: cartView(state.cart) };
    },
    set_order_details(input) {
      const o = state.order, errors = [];
      if (input.service !== undefined) { if (SERVICES.includes(input.service)) o.service = input.service; else errors.push("Servicio inválido: delivery o retiro."); }
      if (input.branch !== undefined) { const b = findBranch(input.branch); if (b) o.branch = b.id; else errors.push(`No existe la sucursal "${input.branch}". Sucursales: ${B.branches.map((x) => x.name).join(", ")}.`); }
      for (const k of ["address", "reference", "name", "payment", "notes"]) if (input[k] !== undefined) { const v = str(input[k]); if (v) o[k] = v; }
      if (input.phone !== undefined) { const p = normPhone(input.phone); if (p) o.phone = p; else errors.push("El WhatsApp debe tener 8 dígitos y empezar con 6 o 7."); }
      if (input.when !== undefined) {
        const w = norm(input.when);
        const val = ["asap", "ya", "ahora", "lo antes posible", "cuanto antes"].includes(w) ? "asap" : (w.match(/^(\d{1,2}):?(\d{2})$/) ? w.replace(/^(\d{1,2}):?(\d{2})$/, (_, h, m) => `${h.padStart(2, "0")}:${m}`) : null);
        if (!val || (val !== "asap" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(val))) errors.push("La hora debe ser 'lo antes posible' o HH:MM.");
        else o.when = val;
      }
      if (o.branch && o.when) { const e = checkTime(o.branch, o.when); if (e) { errors.push(e); if (input.when !== undefined) delete o.when; } }
      invalidate();
      return { saved: { ...o }, errors, missing: missing() };
    },
    request_location() { emit({ type: "location" }); return { shown: true }; },
    prepare_order() {
      const m = missing(); if (m.length) return { ready: false, missing: m };
      const e = checkTime(state.order.branch, state.order.when); if (e) return { ready: false, error: e };
      const o = state.order, b = branchById(o.branch), v = cartView(state.cart);
      const summary = [...v.lines.map((l) => l.line_text), `Total: ${v.total_text}`, `${o.service === "delivery" ? "Delivery" : "Retiro"} · ${b.name}`,
        o.service === "delivery" ? `Dirección: ${o.address || "ubicación compartida"}${o.reference ? " (" + o.reference + ")" : ""}` : null,
        `Hora: ${whenText(o.when)}`, `A nombre de ${o.name} · ${o.phone}`].filter(Boolean).join("\n");
      state.token = tokenFor(state.cart, o); state.stage = "awaiting_confirmation";
      emit({ type: "readback", summary });
      return { ready: true, token: state.token, summary, instruction: "Muestra el resumen y pregunta si confirma. Termina tu turno." };
    },
    place_order({ token }, ctx = {}) {
      if (state.placed && state.placed.token === token) return { ok: true, duplicate: true, id: state.placed.id, total_text: money(state.placed.total), note: "El pedido ya estaba confirmado; dile que toque el botón de WhatsApp." };
      if (!ctx.allowed) return { ok: false, error: "not_confirmed", note: "No puedes confirmar sin el 'sí' explícito del cliente al resumen." };
      if (state.stage !== "awaiting_confirmation" || !state.token || token !== state.token || tokenFor(state.cart, state.order) !== token) return { ok: false, error: "token_mismatch", note: "El pedido cambió; vuelve a llamar prepare_order." };
      const o = state.order, b = branchById(o.branch), total = cartTotal(state.cart), code = codeFor(token);
      const url = waUrl(b.whatsapp, buildWhatsApp(state.cart, o, code, null));
      backendPayload = {
        client_ref: `hattoria-${token}-${o.phone}`, channel: "hattoria", store: o.branch, service: o.service, customer_name: o.name,
        customer_phone: `+${B.config.phonePrefix}${o.phone}`, address: o.address || null, reference: o.reference || null,
        lat: o.location ? o.location.lat : null, lng: o.location ? o.location.lng : null, scheduled_for: o.when === "asap" ? null : o.when,
        notes: [o.notes, o.payment ? "Pago: " + o.payment : null].filter(Boolean).join(" · ") || null,
        items: Object.entries(state.cart).map(([id, qty]) => ({ id, qty })),
      };
      const entry = { id: code, at: now().getTime(), branch: o.branch, service: o.service, cart: { ...state.cart }, track: null };
      state.placed = { token, id: code, url, total }; state.stage = "placed";
      state.history = [entry, ...state.history].slice(0, 3);
      emit({ type: "order", id: code, url, track: null, branch: b.name, total, entry });
      return { ok: true, id: code, total_text: money(total), branch: b.name, note: "Pedido listo. Dile que toque el botón verde para enviarlo por WhatsApp." };
    },
    get_order_status() {
      const h = state.history[0];
      if (!h) return { found: false, note: "No hay pedidos recientes en este dispositivo." };
      const b = branchById(h.branch);
      emit({ type: "handoff", url: waUrl(b.whatsapp, `Hola Hattori 👋 ¿Cómo va mi pedido ${h.id}?`), to: b.name });
      if (h.track) emit({ type: "track", url: trackLink(h.track), code: h.id });
      return { found: true, id: h.id, branch: b.name, track_token: h.track, live: null, note: h.track ? "Consultando estado en vivo." : "Este pedido no tiene seguimiento en vivo; ofrece el botón para preguntar a la sucursal. No inventes tiempos." };
    },
    handoff_to_human({ reason, summary }) {
      const b = branchById(state.order.branch) || null;
      const num = b ? b.whatsapp : B.config.callCenter;
      emit({ type: "handoff", url: waUrl(num, `Hola Hattori 👋 ${str(reason, 120) || ""}\n${str(summary, 400) || ""}`.trim()), to: b ? b.name : "Hattori" });
      return { shown: true };
    },
    show_options({ options }) { const o = (options || []).map((x) => str(x, 40)).filter(Boolean).slice(0, 4); if (o.length >= 2) emit({ type: "options", options: o }); return { shown: o.length >= 2 }; },
    log_miss({ text, reason }) { log({ evt: "hattoria_miss", text: str(text, 200), reason: str(reason, 100) }); return { logged: true }; },
  };

  function run(name, input, ctx) {
    const fn = impl[name];
    if (!fn) return { error: "unknown_tool" };
    try { return fn(input && typeof input === "object" ? input : {}, ctx); } catch (e) { log({ evt: "hattoria_tool_error", name, msg: String(e && e.message) }); return { error: "tool_failed" }; }
  }
  return {
    state, events, run, missing,
    takeBackendPayload() { const p = backendPayload; backendPayload = null; return p; },
    /** After the DB accepted the order: swap in the DB code + tracking link. */
    applyBackend(res) {
      if (!state.placed) return null;
      const code = res.code || state.placed.id, track = UUID_RE.test(res.tracking_token || "") ? res.tracking_token : null;
      const o = state.order, b = branchById(o.branch), total = Number(res.total) || state.placed.total;
      const url = waUrl(String(res.store_whatsapp || b.whatsapp).replace(/\D/g, ""), buildWhatsApp(state.cart, o, code, track));
      state.placed = { ...state.placed, id: code, url, total };
      state.history[0] = { ...state.history[0], id: code, track };
      for (const e of events) if (e.type === "order") Object.assign(e, { id: code, url, total, track: track ? trackLink(track) : null, entry: state.history[0] });
      return { id: code, total, track };
    },
    /** DB rejected for a business reason: undo placement. */
    undoPlacement() { state.placed = null; state.stage = "awaiting_confirmation"; state.history = state.history.slice(1); for (let i = events.length - 1; i >= 0; i--) if (events[i].type === "order") events.splice(i, 1); },
  };
}

module.exports = { TOOLS, createSession, sanitizeState, isYes, searchMenu, buildWhatsApp, normPhone, tokenFor, money, CAT, UUID_RE, trackLink };
