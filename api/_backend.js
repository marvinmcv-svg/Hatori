"use strict";
/* Calls the public Supabase RPCs with the PUBLISHABLE key (row-level security
   limits it). 6 s timeout. Returns { ok, ... } | { businessError } | { unreachable }. */
const CFG = require("../js/config.js");

const URL_ = process.env.SUPABASE_URL || CFG.supabaseUrl;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || CFG.supabaseKey;
const BUSINESS = ["store_paused", "delivery_unavailable", "pickup_unavailable", "sold_out", "invalid_phone", "missing_address", "rate_limited", "customer_blocked", "unknown_item", "dine_in"];
const FRIENDLY = {
  store_paused: "la sucursal pausó los pedidos por un momento",
  delivery_unavailable: "el delivery no está disponible ahora en esa sucursal",
  pickup_unavailable: "el retiro no está disponible ahora en esa sucursal",
  invalid_phone: "el número de WhatsApp no es válido",
  missing_address: "falta la dirección para el delivery",
  rate_limited: "llegaron varios pedidos seguidos de ese número; hay que esperar unos minutos",
  customer_blocked: "no se pudo registrar el pedido; debe escribir por WhatsApp",
  unknown_item: "un plato ya no está en la carta",
};

async function rpc(name, body) {
  if (!URL_ || !KEY) return { unreachable: true, reason: "not_configured" };
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${URL_.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (r.ok) return j && typeof j === "object" ? { ok: true, ...j } : { unreachable: true, reason: "bad_body" };
    const msg = String((j && (j.message || j.error || j.hint)) || "");
    const key = BUSINESS.find((k) => msg.includes(k));
    if (key) {
      const detail = key === "sold_out" ? `se acabó ${msg.split("sold_out:")[1] || "un plato"}` : FRIENDLY[key] || key;
      return { businessError: key, message: detail };
    }
    return { unreachable: true, reason: `http_${r.status}` };
  } catch (e) {
    return { unreachable: true, reason: e.name === "AbortError" ? "timeout" : "network" };
  } finally { clearTimeout(to); }
}

module.exports = {
  placeOrder: (payload) => rpc("place_order", { payload }),
  trackOrder: (token) => rpc("track_order", { token }),
};
