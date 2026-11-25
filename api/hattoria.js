/* HattorIA endpoint · POST /api/hattoria
   Tool-calling agent loop. Streams NDJSON events, one JSON object per line.
   Provider: HATTORIA_PROVIDER forces one; else NVIDIA if NVIDIA_API_KEY, else Anthropic. */
"use strict";
const { TOOLS, createSession, isYes } = require("./_tools.js");
const { SYSTEM, liveContext } = require("./_prompt.js");
const backend = require("./_backend.js");

const MAX_ROUNDS = 6;
const RL = new Map(); // best-effort per-IP rate limit (per warm instance)
function limited(ip) {
  const now = Date.now(), win = 60000, arr = (RL.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); RL.set(ip, arr);
  if (RL.size > 5000) RL.clear();
  return arr.length > 15;
}
function provider() {
  const f = (process.env.HATTORIA_PROVIDER || "").toLowerCase();
  if (f === "nvidia" && process.env.NVIDIA_API_KEY) return "nvidia";
  if (f === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (!f && process.env.NVIDIA_API_KEY) return "nvidia";
  if (!f && process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}
function cleanMessages(raw) {
  const msgs = (Array.isArray(raw) ? raw : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  // merge consecutive same-role messages
  const out = [];
  for (const m of msgs) { const last = out[out.length - 1]; if (last && last.role === m.role) last.content += "\n" + m.content; else out.push({ ...m }); }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); return res.end(JSON.stringify({ error: "method_not_allowed" })); }
  const prov = provider();
  if (!prov) { res.statusCode = 503; res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ error: "not_configured" })); }
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (limited(ip)) { res.statusCode = 429; res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ error: "rate_limited" })); }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const channel = body.channel === "voice" ? "voice" : "text";
  const messages = cleanMessages(body.messages);
  if (!messages.length) { res.statusCode = 400; return res.end(JSON.stringify({ error: "no_messages" })); }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const write = (e) => { try { res.write(JSON.stringify(e) + "\n"); } catch { /* client gone */ } };

  const session = createSession(body.state);
  let flushed = 0;
  const flush = () => { while (flushed < session.events.length) write(session.events[flushed++]); };

  // ---- Guard 1: confirmation is enforced by the server, not the model.
  const tokenAtStart = session.state.stage === "awaiting_confirmation" ? session.state.token : null;
  const lastUser = [...messages].reverse().find((m) => m.role === "user").content;
  const saidYes = !!tokenAtStart && isYes(lastUser);
  const ctx = { allowed: saidYes };
  let serverPlaced = null, serverPlaceError = null;

  async function recordIfPlaced() {
    const payload = session.takeBackendPayload();
    if (!payload) return null;
    const r = await backend.placeOrder(payload);
    if (r.ok) { const a = session.applyBackend(r); return { ok: true, ...a }; }
    if (r.businessError) { session.undoPlacement(); return { businessError: r.message }; }
    console.log(JSON.stringify({ evt: "hattoria_backend_unreachable", reason: r.reason, code: session.state.placed && session.state.placed.id }));
    return { ok: true, offline: true };
  }
  async function enrichStatus(result) {
    if (!result || !result.track_token) return result;
    const r = await backend.trackOrder(result.track_token);
    if (r.ok) return { ...result, live: { status: r.status, service: r.service, created_at: r.created_at, scheduled_for: r.scheduled_for, events: r.events, store: r.store && r.store.name }, tracking_page: "botón mostrado" };
    return { ...result, live: null, note: "No pudimos consultar el estado en vivo; ofrece preguntar a la sucursal." };
  }

  if (saidYes) {
    const r = session.run("place_order", { token: tokenAtStart }, ctx);
    if (r.ok) {
      const rec = await recordIfPlaced();
      if (rec && rec.businessError) serverPlaceError = rec.businessError; else serverPlaced = { id: session.state.placed.id };
    }
  }
  flush();

  async function runTool(name, input) {
    let out = session.run(name, input, ctx);
    if (name === "place_order" && out.ok && !out.duplicate) {
      const rec = await recordIfPlaced();
      if (rec && rec.businessError) out = { ok: false, error: "rejected", reason: rec.businessError, note: "Explica el motivo y ofrece una alternativa." };
      else out = { ...out, id: session.state.placed.id };
    }
    if (name === "get_order_status") out = await enrichStatus(out);
    flush();
    return out;
  }

  const live = liveContext(session.state, { channel, serverPlaced, serverPlaceError });
  try {
    if (prov === "anthropic") await anthropicLoop({ messages, live, channel, write, runTool, session });
    else await nvidiaLoop({ messages, live, channel, write, runTool, session });
  } catch (e) {
    console.log(JSON.stringify({ evt: "hattoria_error", msg: String(e && e.message), status: e && e.status }));
    write({ type: "error", kind: e && e.status === 429 ? "rate_limited" : "upstream" });
  }
  flush();
  write({ type: "state", state: session.state });
  res.end();
};

/* ---------------------------------------------------------------- Claude */
async function anthropicLoop({ messages, live, channel, write, runTool }) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic();
  const voice = channel === "voice";
  const model = voice ? (process.env.HATTORIA_VOICE_MODEL || "claude-haiku-5-5") : (process.env.HATTORIA_MODEL || "claude-sonnet-5-5");
  const msgs = messages.map((m) => ({ role: m.role, content: m.content }));
  const system = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, // static → cached (tools render before it)
    { type: "text", text: live },                                          // live context → uncached
  ];
  let lastText = "";
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const params = { model, max_tokens: voice ? 1024 : 4096, system, tools: TOOLS, messages: msgs, output_config: { effort: "low" } };
    // Sonnet 5.5: route safety-classifier refusals to a fallback model server-side.
    const useFallback = /^claude-sonnet-5-5/.test(model);
    const stream = useFallback
      ? client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : client.messages.stream(params);
    let started = false;
    stream.on("text", (t) => {
      if (!started && round > 0 && lastText && /[.!?…)]\s*$/.test(lastText)) write({ type: "text", text: "\n\n" });
      started = true; lastText += t; write({ type: "text", text: t });
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") { write({ type: "text", text: "Mejor te paso con una persona del equipo para eso 🙏" }); return; }
    msgs.push({ role: "assistant", content: final.content }); // keep every block unchanged (thinking included)
    const uses = final.content.filter((b) => b.type === "tool_use");
    if (final.stop_reason !== "tool_use" || !uses.length) return;
    const results = [];
    for (const u of uses) {
      const out = await runTool(u.name, u.input);
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) });
    }
    msgs.push({ role: "user", content: results }); // all results in ONE user message
  }
}

/* ---------------------------------------------------------------- NVIDIA NIM (OpenAI-compatible) */
async function nvidiaLoop({ messages, live, channel, write, runTool }) {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: "https://integrate.api.nvidia.com/v1" });
  const model = process.env.HATTORIA_NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const tools = TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const msgs = [{ role: "system", content: SYSTEM + "\n\n" + live }, ...messages];
  let lastText = "";
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = await client.chat.completions.create({ model, messages: msgs, tools, stream: true, temperature: 0.3, max_tokens: channel === "voice" ? 400 : 1200 });
    const calls = []; let text = "", started = false;
    for await (const chunk of stream) {
      const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta; if (!d) continue;
      if (d.content) {
        if (!started && round > 0 && lastText && /[.!?…)]\s*$/.test(lastText)) write({ type: "text", text: "\n\n" });
        started = true; text += d.content; lastText += d.content; write({ type: "text", text: d.content });
      }
      for (const tc of d.tool_calls || []) {
        const i = tc.index ?? calls.length;
        calls[i] = calls[i] || { id: tc.id, name: "", args: "" };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function && tc.function.name) calls[i].name += tc.function.name;
        if (tc.function && tc.function.arguments) calls[i].args += tc.function.arguments;
      }
    }
    const done = calls.filter(Boolean);
    if (!done.length) return;
    msgs.push({ role: "assistant", content: text || null, tool_calls: done.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });
    for (const c of done) {
      let input; try { input = JSON.parse(c.args || "{}"); } catch { input = null; }
      const out = input ? await runTool(c.name, input) : { error: "invalid_json" };
      msgs.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out) });
    }
  }
}

module.exports.cleanMessages = cleanMessages;
