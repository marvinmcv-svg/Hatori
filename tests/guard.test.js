"use strict";
/* Guard test: a fake model that calls prepare_order AND place_order in the same
   turn must NOT produce an order. A later "sí" is confirmed by the server. */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function fakeAnthropic(script) {
  let call = 0;
  class Fake {
    constructor() {
      const stream = () => {
        const step = script[call++] || { text: "ok", stop: "end_turn" };
        const handlers = {};
        return {
          on(ev, fn) { handlers[ev] = fn; return this; },
          async finalMessage() {
            if (step.text && handlers.text) handlers.text(step.text);
            const content = [];
            if (step.text) content.push({ type: "text", text: step.text });
            (step.tools || []).forEach((t, i) => content.push({ type: "tool_use", id: "tu_" + call + "_" + i, name: t.name, input: t.input }));
            return { content, stop_reason: step.stop || (step.tools ? "tool_use" : "end_turn") };
          },
        };
      };
      this.messages = { stream };
      this.beta = { messages: { stream } };
    }
  }
  return Fake;
}
function load(script) {
  const sdk = require.resolve("@anthropic-ai/sdk", { paths: [path.join(__dirname, "..")] });
  require.cache[sdk] = { id: sdk, filename: sdk, loaded: true, exports: fakeAnthropic(script) };
  delete require.cache[require.resolve("../api/hattoria.js")];
  return require("../api/hattoria.js");
}
async function call(handler, body) {
  const out = [];
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, write(s) { out.push(s); }, end(s) { if (s) out.push(s); } };
  await handler({ method: "POST", headers: {}, socket: {}, body }, res);
  return { res, events: out.join("").split("\n").filter(Boolean).map((l) => JSON.parse(l)) };
}

const READY = {
  cart: { "acevichado-roll": 1 },
  order: { service: "pickup", branch: "equipetrol", when: "asap", name: "Ana", phone: "71234567" },
};

test("no key → 503 not_configured", async () => {
  delete process.env.ANTHROPIC_API_KEY; delete process.env.NVIDIA_API_KEY;
  const h = load([]);
  const { res } = await call(h, { messages: [{ role: "user", content: "hola" }] });
  assert.equal(res.statusCode, 503);
});

test("model cannot prepare and place in one turn", async () => {
  process.env.ANTHROPIC_API_KEY = "test";
  // keep the test independent of the real clock: pick a time the branch is open
  const RealDate = Date; global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : ["2026-11-28T00:00:00Z"])); } static now() { return new RealDate("2026-11-28T00:00:00Z").getTime(); } };
  try {
    const h = load([{ tools: [{ name: "prepare_order", input: {} }] }, { tools: [{ name: "place_order", input: { token: "0000000000000000" } }] }, { text: "¿Confirmas?" }]);
    const { events } = await call(h, { messages: [{ role: "user", content: "eso es todo" }], state: READY });
    assert.ok(events.some((e) => e.type === "readback"));
    assert.ok(!events.some((e) => e.type === "order"), "no order without an explicit yes");
    const state = events.find((e) => e.type === "state").state;
    assert.equal(state.stage, "awaiting_confirmation");

    // Next request: the customer says "sí" → the server places it before the model runs
    const h2 = load([{ text: "¡Listo! Toca el botón verde." }]);
    const r2 = await call(h2, { messages: [{ role: "user", content: "eso es todo" }, { role: "assistant", content: "¿Confirmas?" }, { role: "user", content: "sí" }], state });
    const orders = r2.events.filter((e) => e.type === "order");
    assert.equal(orders.length, 1);
    assert.ok(orders[0].url.startsWith("https://wa.me/"));
    // a second "sí" does not create a second order
    const st2 = r2.events.find((e) => e.type === "state").state;
    const h3 = load([{ text: "Ya está listo." }]);
    const r3 = await call(h3, { messages: [{ role: "user", content: "sí" }], state: st2 });
    assert.equal(r3.events.filter((e) => e.type === "order").length, 0);
  } finally { global.Date = RealDate; }
});
