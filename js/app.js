/* Hattori · site script: rendering, cart, WhatsApp funnel, live hours,
   HattorIA chat (streamed NDJSON) + voice mode. Vanilla, no build step. */
(function () {
  "use strict";
  const B = window.HATTORI, CFG = window.HATTORI_CONFIG || {};
  const CAT = B.catalog();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => B.config.currency + " " + Number(n).toLocaleString(B.config.locale, { maximumFractionDigits: 2 });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WA = (num, text) => "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /* ------------------------------------------------------------ store */
  const store = {
    get(k, d, s = localStorage) { try { const v = s.getItem("hattori." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v, s = localStorage) { try { s.setItem("hattori." + k, JSON.stringify(v)); } catch { /* quota */ } },
  };

  /* ------------------------------------------------------------ toast */
  let toastT;
  function toast(msg) {
    const t = $("[data-toast]"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600);
  }

  /* ------------------------------------------------------------ cart */
  let cart = sanitizeCart(store.get("cart", {}));
  function sanitizeCart(c) {
    const out = {};
    Object.entries(c || {}).forEach(([id, q]) => { if (CAT[id] && CAT[id].orderable) out[id] = Math.max(1, Math.min(50, q | 0)); });
    return out;
  }
  const cartTotal = () => Object.entries(cart).reduce((s, [id, q]) => s + CAT[id].price * q, 0);
  const cartCount = () => Object.values(cart).reduce((s, q) => s + q, 0);
  function setCart(next, silent) {
    cart = sanitizeCart(next); store.set("cart", cart); renderCart();
    if (!silent) { const n = $("[data-cart-count]"); n.classList.remove("bump"); void n.offsetWidth; n.classList.add("bump"); }
  }
  function addToCart(id, qty = 1) {
    const it = CAT[id]; if (!it || !it.orderable) return;
    setCart({ ...cart, [id]: (cart[id] || 0) + qty });
    toast("✓ " + it.name + " agregado");
  }
  function lineHTML(id, q) {
    const it = CAT[id];
    return `<div class="line"><span class="line__name">${esc(it.name)}<br><small>${money(it.price * q)}</small></span>
      <span class="qty"><button type="button" data-dec="${esc(id)}" aria-label="Quitar uno de ${esc(it.name)}">−</button><b>${q}</b>
      <button type="button" data-inc="${esc(id)}" aria-label="Agregar uno de ${esc(it.name)}">+</button></span></div>`;
  }
  function renderCart() {
    const ids = Object.keys(cart), n = cartCount();
    const badge = $("[data-cart-count]"); badge.textContent = n; badge.hidden = !n;
    $("[data-cart-total]").textContent = money(cartTotal());
    $("[data-cart-body]").innerHTML = ids.length ? ids.map((id) => lineHTML(id, cart[id])).join("")
      : `<div class="empty"><b>Tu pedido está vacío</b>Elige algo de la carta o pídeselo a HattorIA ✦</div>`;
    $("[data-mbar-cart]").textContent = n ? `${n} ${n === 1 ? "plato" : "platos"} · ${money(cartTotal())}` : "Tu pedido";
    const fc = $("[data-fcart]");
    if (fc) fc.innerHTML = ids.length ? ids.map((id) => lineHTML(id, cart[id])).join("") + `<p><b>Total ${money(cartTotal())}</b></p>` : `<p class="fcart__empty">Aún no agregaste platos.</p>`;
    updatePhone();
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-add],[data-inc],[data-dec]"); if (!t) return;
    if (t.dataset.add) addToCart(t.dataset.add);
    if (t.dataset.inc) setCart({ ...cart, [t.dataset.inc]: cart[t.dataset.inc] + 1 });
    if (t.dataset.dec) { const id = t.dataset.dec, c = { ...cart }; if (c[id] > 1) c[id]--; else delete c[id]; setCart(c, true); }
  });

  /* ------------------------------------------------------------ drawer / scrim */
  let lastFocus;
  function openCart() { lastFocus = document.activeElement; $("[data-scrim]").hidden = false; $("#cart").hidden = false; $("[data-close-cart]").focus(); updateMbar(); }
  function closeCart() { $("[data-scrim]").hidden = true; $("#cart").hidden = true; updateMbar(); lastFocus && lastFocus.focus(); }
  $$("[data-open-cart]").forEach((b) => b.addEventListener("click", openCart));
  $("[data-close-cart]").addEventListener("click", closeCart);
  $("[data-scrim]").addEventListener("click", closeCart);
  $("[data-cart-go]").addEventListener("click", () => { closeCart(); gotoStep(cartCount() ? 3 : 2); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#cart").hidden) closeCart(); else if (!$("#chat").hidden) closeChat(); } });

  /* ------------------------------------------------------------ status helpers */
  function statusLabel(s) {
    if (s.state === "open") return `Abierto · hasta ${s.closesAt}`;
    if (s.state === "soon") return `Cierra pronto · ${s.closesAt}`;
    if (s.opensAt) return s.opensDay === "hoy" ? `Abre hoy a las ${s.opensAt}` : `Abre ${s.opensDay} a las ${s.opensAt}`;
    return "Cerrado";
  }
  const isOpen = (s) => s.state === "open" || s.state === "soon";

  function renderLive() {
    const now = new Date(), t = B.localParts(now);
    const sts = B.branches.map((b) => ({ b, s: B.statusAt(b.id, now) }));
    const open = sts.filter((x) => isOpen(x.s)).length, N = B.branches.length;
    const first = sts[0].s;
    $("[data-live-dot]").className = "dot" + (open ? " on" : "");
    $("[data-live-text]").textContent = open ? `${open} de ${N} abiertas · hasta ${first.closesAt || "23:00"}` : statusLabel(first);
    $("[data-clock]").innerHTML = `<span class="dot ${open ? "on" : ""}"></span>${t.hhmm} en Santa Cruz · <b>${open} de ${N}</b> abiertas`;
    $("[data-ob-status]").innerHTML = open ? `<span class="dot on"></span><b>${open} de ${N}</b>&nbsp;sucursales abiertas ahora` : `<span class="dot"></span>${esc(statusLabel(first))}`;
    $$("[data-branch-select]").forEach((sel) => {
      const v = sel.value;
      sel.innerHTML = sts.map(({ b, s }) => `<option value="${esc(b.id)}">${esc(b.name)} · ${isOpen(s) ? "Abierto" : "Cerrado"}</option>`).join("");
      if (v) sel.value = v;
    });
    $("[data-branches]").innerHTML = sts.map(({ b, s }) => {
      const cls = s.state === "open" ? "" : s.state === "soon" ? " status--soon" : " status--closed";
      const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
        const h = B.hoursFor(b.id, d).map((x) => x.join("–")).join(" · ") || "Cerrado";
        return `<li class="${d === t.day ? "today" : ""}"><span>${B.DAYS[d][0].toUpperCase() + B.DAYS[d].slice(1)}</span><span>${h}</span></li>`;
      }).join("");
      return `<article class="branch reveal in">
        <span class="status${cls}"><span class="dot ${isOpen(s) ? "on" : ""}"></span>${esc(statusLabel(s))}</span>
        <h3>${esc(b.name)}</h3>
        <p class="branch__addr ${b.address ? "" : "missing"}">${b.address ? esc(b.address) : "Dirección exacta: consúltala por WhatsApp"}</p>
        <ul class="hours">${rows}</ul>
        <div class="branch__links">
          ${b.maps ? `<a class="btn btn--ink btn--sm" href="${esc(b.maps)}" target="_blank" rel="noopener">Cómo llegar ↗</a>` : ""}
          <a class="btn btn--wa btn--sm" href="${WA(b.whatsapp, "Hola Hattori " + b.name + " 👋")}" target="_blank" rel="noopener">WhatsApp ${esc(b.whatsapp.slice(3))}</a>
        </div></article>`;
    }).join("");
  }

  /* ------------------------------------------------------------ hero card stack */
  const feat = B.featured.map((id) => CAT[id]).filter(Boolean);
  let stackI = 0, stackTimer;
  const KANJI = { rolls: "巻", compartir: "盛", nikkei: "日系" };
  const KANJI_LBL = { rolls: "Maki · roll", compartir: "Mori · tabla", nikkei: "Nikkei" };
  function renderStack() {
    $("[data-stack]").innerHTML = feat.map((it, i) => `
      <article class="dish" data-i="${i}" aria-label="${i + 1} de ${feat.length}: ${esc(it.name)}">
        <div class="dish__no"><span>N.º 0${i + 1}</span><span>${esc(it.catName)}</span></div>
        <div class="dish__art"><div class="dish__circle" aria-hidden="true"><span>${KANJI[it.cat] || "日系"}</span><small>${esc(KANJI_LBL[it.cat] || "Nikkei")}</small></div>${it.star ? `<span class="dish__badge">Favorito</span>` : it.share ? `<span class="dish__badge">Para compartir</span>` : ""}</div>
        <h3 class="dish__name">${esc(it.name)}</h3>
        <p class="dish__desc">${esc(it.desc)}${it.size ? " · " + esc(it.size) : ""}</p>
        <div class="dish__foot"><p class="price"><small>${B.config.currency}</small>${it.price}</p>
          <button class="btn btn--red" data-add="${esc(it.id)}">Agregar</button></div>
      </article>`).join("");
    layoutStack();
  }
  function layoutStack() {
    $$(".dish").forEach((el) => {
      const i = +el.dataset.i, pos = (i - stackI + feat.length) % feat.length;
      el.dataset.pos = pos; el.style.zIndex = feat.length - pos; el.inert = pos !== 0;
    });
    $("[data-stack-count]").textContent = `${stackI + 1} / ${feat.length}`;
  }
  function stackGo(d) { stackI = (stackI + d + feat.length) % feat.length; layoutStack(); }
  $("[data-stack-next]").addEventListener("click", () => { stackGo(1); restartStack(); });
  $("[data-stack-prev]").addEventListener("click", () => { stackGo(-1); restartStack(); });
  function restartStack() { clearInterval(stackTimer); if (!reduced && !document.hidden) stackTimer = setInterval(() => stackGo(1), 6500); }
  $("#stack").addEventListener("mouseenter", () => clearInterval(stackTimer));
  $("#stack").addEventListener("mouseleave", restartStack);
  $("#stack").addEventListener("focusin", () => clearInterval(stackTimer));
  document.addEventListener("visibilitychange", restartStack);
  let tx = null;
  $("#stack").addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  $("#stack").addEventListener("touchend", (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) { stackGo(dx < 0 ? 1 : -1); restartStack(); } tx = null; });

  /* ------------------------------------------------------------ signatures + menu sheet */
  function renderSigs() {
    const ids = ["acevichado-roll", "tartar-roll", "tabla-mix", "fried-roll", "ceviche-clasico"].filter((id) => CAT[id]);
    $("[data-sigs]").innerHTML = ids.map((id) => {
      const it = CAT[id];
      return `<li class="sig reveal"><span class="sig__no"></span>
        <div><h3 class="sig__name">${esc(it.name)}${it.star ? `<span class="sig__tag">Favorito</span>` : it.share ? `<span class="sig__tag">Compartir</span>` : ""}</h3><p class="sig__desc">${esc(it.desc)}</p></div>
        ${it.orderable ? `<p class="price"><small>${B.config.currency}</small>${it.price}</p><button class="add" data-add="${esc(id)}" aria-label="Agregar ${esc(it.name)}">+</button>`
          : `<span class="mi__price ask">Consultar</span><a class="add" href="${WA(B.config.callCenter, "Hola Hattori 👋 ¿Cuánto cuesta el " + it.name + "?")}" target="_blank" rel="noopener" aria-label="Consultar ${esc(it.name)} por WhatsApp">?</a>`}
      </li>`;
    }).join("");
  }
  let activeTab = "all", query = "";
  function renderTabs() {
    const tabs = [{ id: "all", name: "Todo" }].concat(B.menu.map((c) => ({ id: c.id, name: c.name })));
    $("[data-tabs]").innerHTML = tabs.map((t) => `<button class="tab" role="tab" aria-selected="${t.id === activeTab}" data-tab="${esc(t.id)}">${esc(t.name)}</button>`).join("");
  }
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function renderSheet() {
    const q = norm(query.trim());
    const cols = B.menu.filter((c) => activeTab === "all" || c.id === activeTab).map((c) => {
      const items = c.items.filter((it) => !q || norm(it.name + " " + it.desc).includes(q));
      if (!items.length) return "";
      return `<div class="sheet__col"><h3>${esc(c.name)}</h3><div class="colhead"><span>Plato</span><span>Bs</span></div>
        ${items.map((it) => `<div class="mi">
          <span class="mi__name">${esc(it.name)}${it.star ? ` <span class="badge">Favorito</span>` : ""}${it.size ? ` <span class="badge badge--gold">${esc(it.size)}</span>` : ""}<span class="lead"></span></span>
          ${typeof it.price === "number" ? `<span class="mi__price">${it.price}</span>` : `<span class="mi__price ask">Consultar</span>`}
          <p class="mi__desc">${esc(it.desc)}</p>
          <span class="mi__act">${typeof it.price === "number" ? `<button class="add" data-add="${esc(it.id)}" aria-label="Agregar ${esc(it.name)}">+</button>`
            : `<a class="ask-btn" href="${WA(B.config.callCenter, "Hola Hattori 👋 Quiero consultar por el " + it.name)}" target="_blank" rel="noopener">WhatsApp</a>`}</span>
        </div>`).join("")}</div>`;
    }).join("");
    $("[data-sheet]").innerHTML = cols || `<p class="sheet__empty">No encontramos “${esc(query)}”. Pregúntale a HattorIA ✦</p>`;
  }
  $("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; activeTab = b.dataset.tab; renderTabs(); renderSheet(); });
  $("[data-menu-search]").addEventListener("input", (e) => { query = e.target.value; renderSheet(); });

  function renderStory() {
    const s = B.story;
    $("[data-story-eyebrow]").textContent = s.eyebrow;
    $("[data-story-title]").textContent = s.title;
    $("[data-story-paras]").innerHTML = s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
    $("[data-story-quote]").innerHTML = `“${esc(s.quote.text)}”<cite>— ${esc(s.quote.by)}</cite>`;
  }
  function renderFeed() {
    $("[data-feed]").innerHTML = B.feed.map((p) => `<a class="post reveal" href="${esc(p.url)}" target="_blank" rel="noopener">
      <span class="post__tag">${esc(p.tag)}</span><p class="post__txt">${esc(p.text)}</p><span class="post__go">Ver en Instagram ↗</span></a>`).join("");
  }
  function renderPicker() {
    $("[data-picker]").innerHTML = Object.values(CAT).filter((i) => i.orderable).map((i) =>
      `<button type="button" data-add="${esc(i.id)}">${esc(i.name)}<small>${money(i.price)}</small></button>`).join("");
  }

  /* ------------------------------------------------------------ funnel */
  const F = $("#funnel");
  let step = 1, clientRef = null;
  const val = (n) => { const el = F.elements[n]; if (!el) return ""; if (el instanceof RadioNodeList) return el.value; return el.value.trim(); };
  const intent = () => val("intent");
  const isOrder = () => intent() === "delivery" || intent() === "pickup";
  const branchOf = (id) => B.branches.find((b) => b.id === id) || B.branches[0];
  function normPhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.startsWith(B.config.phonePrefix) && d.length === B.config.phonePrefix.length + B.config.phoneDigits) d = d.slice(B.config.phonePrefix.length);
    return /^[67]\d{7}$/.test(d) ? d : null;
  }
  function gotoStep(n, noScroll) {
    step = n;
    $$("[data-step]", F).forEach((fs) => { fs.hidden = +fs.dataset.step !== n; });
    $$("[data-step-dot]", F).forEach((li) => li.classList.toggle("on", +li.dataset.stepDot <= n));
    const it = intent();
    $$("[data-when]", F).forEach((el) => { el.hidden = !(el.dataset.when === it || (el.dataset.when === "order" && isOrder())); });
    $$("[data-when-delivery]", F).forEach((el) => { el.hidden = it !== "delivery"; });
    $("[data-step2-legend]").textContent = isOrder() ? "Tu pedido" : it === "reserva" ? "Tu reserva" : "Tu consulta";
    if (n === 4) renderReview();
    if (!noScroll) document.getElementById("pedir").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    updatePhone();
  }
  function validate(n) {
    const err = $("[data-ferr]");
    if (n === 2 && isOrder() && !cartCount()) { toast("Agrega al menos un plato con precio publicado"); return false; }
    if (n === 3) {
      const msgs = [];
      if (!val("name")) msgs.push("tu nombre");
      if (!normPhone(val("phone"))) msgs.push("un WhatsApp válido (8 dígitos, ej. 7XXXXXXX)");
      if (intent() === "delivery" && !val("address")) msgs.push("la dirección");
      if (val("when") === "later" && !val("time")) msgs.push("la hora");
      err.textContent = msgs.length ? "Falta " + msgs.join(", ") + "." : "";
      return !msgs.length;
    }
    return true;
  }
  F.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]")) { if (validate(step)) gotoStep(Math.min(4, step + 1)); }
    if (e.target.closest("[data-prev]")) gotoStep(Math.max(1, step - 1));
  });
  F.addEventListener("input", updatePhone);
  F.addEventListener("change", (e) => {
    if (e.target.name === "when") F.elements.time.hidden = val("when") !== "later";
    if (e.target.name === "intent") gotoStep(step, true);
    updatePhone();
  });
  function buildMessage(extra) {
    const it = intent(), b = branchOf(val("branch"));
    const L = ["Hola Hattori 👋"];
    if (isOrder()) {
      L.push(`Quiero un pedido para *${it === "delivery" ? "Delivery" : "Retiro"}* en ${b.name}:`);
      Object.entries(cart).forEach(([id, q]) => L.push(`• ${q}× ${CAT[id].name} — ${money(CAT[id].price * q)}`));
      L.push(`*Total: ${money(cartTotal())}*`);
    } else if (it === "reserva") {
      L.push(`Quiero reservar mesa en ${b.name}: ${val("date") || "fecha a coordinar"}, ${val("guests") || 2} personas${val("occasion") ? " (" + val("occasion") + ")" : ""}.`);
    } else {
      L.push(`Tengo una consulta para ${b.name}: ${val("question") || "…"}`);
    }
    if (val("name")) L.push(`Nombre: ${val("name")}`);
    if (val("phone")) L.push(`WhatsApp: ${val("phone")}`);
    if (it === "delivery") { if (val("address")) L.push(`Dirección: ${val("address")}`); if (val("reference")) L.push(`Referencia: ${val("reference")}`); }
    if (isOrder()) L.push(`Hora: ${val("when") === "later" && val("time") ? val("time") : "Lo antes posible"}`);
    if (val("notes")) L.push(`Nota: ${val("notes")}`);
    if (extra) L.push("", extra);
    return L.join("\n");
  }
  function updatePhone() {
    if (!F) return;
    const b = branchOf(val("branch"));
    $("[data-phone-branch]").textContent = "Hattori " + b.name;
    $("[data-phone-msg]").textContent = buildMessage();
  }
  function renderReview() {
    const b = branchOf(val("branch"));
    const rows = [["Tipo", { delivery: "Delivery", pickup: "Retiro", reserva: "Reserva de mesa", consulta: "Consulta" }[intent()]], ["Sucursal", b.name], ["Nombre", val("name")], ["WhatsApp", val("phone")]];
    if (intent() === "delivery") rows.push(["Dirección", val("address") + (val("reference") ? " · " + val("reference") : "")]);
    if (isOrder()) { rows.push(["Hora", val("when") === "later" ? val("time") : "Lo antes posible"]); rows.push(["Platos", Object.entries(cart).map(([id, q]) => `${q}× ${CAT[id].name}`).join(", ")]); rows.push(["Total", money(cartTotal())]); }
    $("[data-review]").innerHTML = `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  }
  const DB_ERR = {
    store_paused: "Esta sucursal pausó los pedidos por un momento. Prueba con la otra o escríbenos.",
    delivery_unavailable: "El delivery no está disponible ahora en esta sucursal. ¿Lo pasas a retiro?",
    pickup_unavailable: "El retiro no está disponible ahora en esta sucursal.",
    invalid_phone: "Revisa tu número de WhatsApp (8 dígitos).",
    missing_address: "Necesitamos tu dirección para el delivery.",
    rate_limited: "Recibimos varios pedidos seguidos de este número. Espera unos minutos 🙏",
    customer_blocked: "No pudimos registrar el pedido. Escríbenos por WhatsApp.",
  };
  async function placeOrderRPC() {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) return { offline: true };
    clientRef = clientRef || "web-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random());
    const payload = {
      client_ref: clientRef, channel: "web", store: val("branch"), service: intent(), customer_name: val("name"),
      customer_phone: "+" + B.config.phonePrefix + normPhone(val("phone")), address: val("address") || null, reference: val("reference") || null,
      lat: null, lng: null, scheduled_for: val("when") === "later" ? val("time") : null, notes: val("notes") || null,
      items: Object.entries(cart).map(([id, qty]) => ({ id, qty })),
    };
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/place_order", {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey },
        body: JSON.stringify({ payload }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && j.ok) return j;
      const code = String((j && (j.message || j.error)) || "");
      const key = Object.keys(DB_ERR).find((k) => code.includes(k));
      if (key) return { error: DB_ERR[key] };
      if (code.includes("sold_out:")) return { error: "Se nos acabó: " + code.split("sold_out:")[1] + ". Quítalo del pedido o elige otro plato." };
      return { offline: true };
    } catch { return { offline: true }; } finally { clearTimeout(to); }
  }
  function trackUrl(token) { return (CFG.siteUrl || location.origin).replace(/\/$/, "") + (CFG.trackPath || "/seguimiento/") + "?t=" + token; }
  F.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("[data-send]"); const err = $("[data-ferr4]"); err.textContent = "";
    const b = branchOf(val("branch"));
    let extra = "", res = { offline: true };
    if (isOrder()) {
      btn.disabled = true; btn.textContent = "Registrando…";
      res = await placeOrderRPC();
      btn.disabled = false; btn.textContent = "Enviar por WhatsApp";
      if (res.error) { err.textContent = res.error; return; }
      if (res.code) extra = `Pedido ${res.code}\nSigue tu pedido: ${trackUrl(res.tracking_token)}`;
    }
    const url = WA((res.store_whatsapp || b.whatsapp).replace(/\D/g, ""), buildMessage(extra));
    window.open(url, "_blank", "noopener");
    const s = $("[data-success]"); s.hidden = false;
    s.innerHTML = res.code
      ? `<b>¡Pedido ${esc(res.code)} registrado! 🍣</b><p>Te abrimos WhatsApp con todo listo. Si no se abrió, <a href="${esc(url)}" target="_blank" rel="noopener">toca aquí</a>.</p><a class="btn btn--gold" href="${esc(trackUrl(res.tracking_token))}">📍 Seguir mi pedido</a>`
      : `<b>¡Listo! 🍣</b><p>Te abrimos WhatsApp con tu mensaje. Si no se abrió, <a href="${esc(url)}" target="_blank" rel="noopener">toca aquí</a>.</p>`;
    if (isOrder()) {
      saveMyOrder({ id: res.code || "WEB-" + Date.now().toString(36).toUpperCase(), at: Date.now(), branch: b.id, service: intent(), cart: { ...cart }, track: res.tracking_token || null });
      clientRef = null;
    }
  });
  function saveMyOrder(entry) { const h = store.get("myorders", []); h.unshift(entry); store.set("myorders", h.slice(0, 3)); }

  /* ------------------------------------------------------------ order box */
  $("#orderbox").addEventListener("submit", (e) => {
    e.preventDefault();
    const it = $("#orderbox").querySelector("input[name=ob-intent]:checked").value;
    F.elements.intent.value = it;
    F.elements.branch.value = $("#ob-branch").value;
    gotoStep(2);
  });

  /* ------------------------------------------------------------ header, nav, reveal, mbar */
  const hdr = $("#hdr");
  function onScroll() { hdr.classList.toggle("is-solid", scrollY > 40); updateMbar(); }
  addEventListener("scroll", onScroll, { passive: true });
  $("#burger").addEventListener("click", () => {
    const p = $("#navpanel"), open = p.hidden; p.hidden = !open; $("#burger").setAttribute("aria-expanded", open);
  });
  $("#navpanel").addEventListener("click", (e) => { if (e.target.closest("a,button")) { $("#navpanel").hidden = true; $("#burger").setAttribute("aria-expanded", "false"); } });
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .12 }) : null;
  function observeReveal() { $$(".reveal:not(.in)").forEach((el) => io ? io.observe(el) : el.classList.add("in")); }
  const visible = {};
  if ("IntersectionObserver" in window) {
    const vo = new IntersectionObserver((es) => { es.forEach((en) => { visible[en.target.id || en.target.tagName] = en.isIntersecting; }); updateMbar(); }, { threshold: .15 });
    ["top", "pedir"].forEach((id) => vo.observe(document.getElementById(id)));
    vo.observe($(".ftr"));
  }
  function updateMbar() {
    const hide = visible.top || visible.pedir || visible.FOOTER || !$("#chat").hidden || !$("#cart").hidden;
    $("[data-mbar]").classList.toggle("is-hidden", !!hide);
    $(".aifab").classList.toggle("is-hidden", !!visible.FOOTER || !$("#chat").hidden);
  }

  /* ============================================================ HattorIA chat */
  const chat = $("#chat"), log = $("[data-chat-log]"), input = $("#chat-input");
  let history = store.get("chat", [], sessionStorage);
  let aiState = store.get("aistate", null, sessionStorage) || { cart: {}, order: {}, stage: "browsing", history: store.get("myorders", []) };
  let busy = false;
  function openChat() {
    chat.hidden = false; document.body.classList.add("chat-open"); updateMbar();
    if (!log.childElementCount) { history.length ? history.forEach((m) => bubble(m.role === "user" ? "me" : "bot", m.content)) : greet(); }
    setTimeout(() => input.focus(), 50);
  }
  function closeChat() { chat.hidden = true; document.body.classList.remove("chat-open"); stopVoice(); updateMbar(); }
  $$("[data-open-chat]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); $("#navpanel").hidden = true; openChat(); }));
  $("[data-close-chat]").addEventListener("click", closeChat);

  function md(s) {
    let h = esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<b>$1</b>");
    const lines = h.split(/\n/); let out = "", inList = false;
    lines.forEach((l) => {
      const m = l.match(/^\s*[-•]\s+(.*)/);
      if (m) { if (!inList) { out += "<ul>"; inList = true; } out += "<li>" + m[1] + "</li>"; }
      else { if (inList) { out += "</ul>"; inList = false; } if (l.trim()) out += "<p>" + l + "</p>"; }
    });
    return out + (inList ? "</ul>" : "");
  }
  function bubble(who, text) {
    const d = document.createElement("div"); d.className = "msg msg--" + who;
    d.innerHTML = who === "bot" ? md(text) : esc(text); log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function card(html, cls = "") { const d = document.createElement("div"); d.className = "card " + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function chips(opts) {
    $("[data-chat-chips]").innerHTML = (opts || []).slice(0, 4).map((o) => `<button class="chip" type="button">${esc(o)}</button>`).join("");
  }
  $("[data-chat-chips]").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) send(c.textContent); });
  function greet() {
    const mine = store.get("myorders", []);
    bubble("bot", "¡Hola! Soy **HattorIA** ✦, el asistente de pedidos de Hattori. ¿Qué se te antoja hoy?");
    chips((mine.length ? ["🍣 Lo de siempre"] : []).concat(["Quiero pedir", "¿Qué me recomiendas?", "¿Qué sucursal está abierta?", "Reservar mesa"]));
  }
  const safeWa = (u) => typeof u === "string" && u.startsWith("https://wa.me/");
  const safeTrack = (u) => { try { const x = new URL(u, location.origin); return x.pathname.startsWith(CFG.trackPath || "/seguimiento/") && UUID_RE.test(x.searchParams.get("t") || ""); } catch { return false; } };
  function cartCardHTML(c) {
    const ids = Object.keys(c || {});
    if (!ids.length) return "<h4>Tu pedido</h4><p>Vacío</p>";
    const tot = ids.reduce((s, id) => s + (CAT[id] ? CAT[id].price * c[id] : 0), 0);
    return `<h4>Tu pedido</h4><ul>${ids.filter((id) => CAT[id]).map((id) => `<li><span>${c[id]}× ${esc(CAT[id].name)}</span><span>${money(CAT[id].price * c[id])}</span></li>`).join("")}<li class="tot"><span>Total</span><span>${money(tot)}</span></li></ul>`;
  }
  async function send(text) {
    text = String(text || "").trim(); if (!text || busy) return;
    busy = true; chips([]); input.value = "";
    bubble("me", text); history.push({ role: "user", content: text });
    const wait = document.createElement("div"); wait.className = "msg msg--bot"; wait.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`; log.appendChild(wait); log.scrollTop = log.scrollHeight;
    setVoice("thinking");
    aiState.cart = { ...cart }; aiState.history = store.get("myorders", []);
    let botEl = null, botText = "", cartCard = null;
    try {
      const r = await fetch("/api/hattoria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-16), state: aiState, channel: voiceOn ? "voice" : "text" }) });
      if (!r.ok || !r.body) throw Object.assign(new Error("http"), { status: r.status });
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl; while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          if (wait.parentNode) wait.remove();
          if (ev.type === "text") { if (!botEl) botEl = bubble("bot", ""); botText += ev.text; botEl.innerHTML = md(botText); log.scrollTop = log.scrollHeight; }
          else if (ev.type === "cart") { setCart(ev.cart || {}, false); if (cartCard) cartCard.innerHTML = cartCardHTML(ev.cart); else cartCard = card(cartCardHTML(ev.cart)); }
          else if (ev.type === "options") chips(ev.options);
          else if (ev.type === "readback") { card(`<h4>Revisa tu pedido</h4><pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(ev.summary)}</pre>`); chips(["Sí, confirmar", "Cambiar algo"]); }
          else if (ev.type === "location") {
            const c = card(`<button class="btn btn--ink btn--sm">📍 Compartir mi ubicación</button>`);
            c.querySelector("button").addEventListener("click", () => shareLocation(c));
          }
          else if (ev.type === "order" && safeWa(ev.url)) {
            card(`<h4>Pedido ${esc(ev.id)} listo</h4><p>Total ${money(ev.total)} · ${esc(ev.branch)}</p>
              <a class="btn btn--wa btn--block" href="${esc(ev.url)}" target="_blank" rel="noopener">Enviar por WhatsApp a ${esc(ev.branch)}</a>
              ${ev.track && safeTrack(ev.track) ? `<a class="btn btn--ink btn--block btn--sm" href="${esc(ev.track)}">📍 Seguir mi pedido</a>` : ""}`, "card--order");
            if (ev.entry) saveMyOrder(ev.entry);
          }
          else if (ev.type === "track" && safeTrack(ev.url)) card(`<a class="btn btn--ink btn--block btn--sm" href="${esc(ev.url)}">📍 Seguir pedido ${esc(ev.code || "")}</a>`);
          else if (ev.type === "handoff" && safeWa(ev.url)) card(`<a class="btn btn--wa btn--block btn--sm" href="${esc(ev.url)}" target="_blank" rel="noopener">Hablar con una persona (${esc(ev.to || "Hattori")})</a>`);
          else if (ev.type === "state" && ev.state) { aiState = ev.state; store.set("aistate", aiState, sessionStorage); }
          else if (ev.type === "error") throw Object.assign(new Error("ai"), { kind: ev.kind });
        }
      }
      if (wait.parentNode) wait.remove();
      if (botText) { history.push({ role: "assistant", content: botText }); speak(botText); } else setVoice("idle");
    } catch (err) {
      if (wait.parentNode) wait.remove();
      history.pop();
      const st = err.status;
      const msg = [503, 404, 501, 405].includes(st) ? "HattorIA se está preparando 🛠️ Muy pronto podrás pedir conmigo. Mientras tanto:"
        : st === 429 ? "Demasiadas preguntas seguidas 😅 Espera un minuto y seguimos." : "Se cortó la conexión. Inténtalo de nuevo o:";
      const d = bubble("bot", msg); d.classList.add("msg--err");
      card(`<a class="btn btn--ink btn--sm" href="#carta">Ver la carta</a> <a class="btn btn--red btn--sm" href="#pedir">Pedir por WhatsApp</a>`);
      setVoice("idle");
    } finally {
      busy = false; store.set("chat", history.slice(-20), sessionStorage);
    }
  }
  $("[data-chat-form]").addEventListener("submit", (e) => { e.preventDefault(); stopSpeaking(); send(input.value); });
  function shareLocation(c) {
    if (!navigator.geolocation) { toast("Tu navegador no comparte ubicación"); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      aiState.order = { ...(aiState.order || {}), location: { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) } };
      c.innerHTML = "<p>📍 Ubicación compartida</p>"; send("📍 Ubicación compartida");
    }, () => toast("No pudimos obtener tu ubicación"), { enableHighAccuracy: true, timeout: 10000 });
  }

  /* ------------------------------------------------------------ voice mode (Web Speech API) */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $("[data-mic]"), vbar = $("[data-voicebar]"), vstat = $("[data-voice-status]");
  let rec = null, voiceOn = false, wake = null;
  const VTXT = { idle: "Toca el micrófono y habla", listening: "Escuchando…", thinking: "Pensando…", speaking: "Hablando… toca para interrumpir" };
  function setVoice(s) { if (!SR) return; mic.dataset.state = s; vstat.textContent = VTXT[s]; vbar.classList.toggle("is-live", s !== "idle"); }
  if (SR) {
    mic.hidden = false; vbar.hidden = false;
    mic.addEventListener("click", () => {
      if (speechSynthesis.speaking) { stopSpeaking(); }
      if (rec) { rec.stop(); return; }
      listen();
    });
  }
  async function listen() {
    voiceOn = true; stopSpeaking();
    try { if ("wakeLock" in navigator && !wake) wake = await navigator.wakeLock.request("screen"); } catch { /* ignore */ }
    rec = new SR(); rec.lang = "es-BO"; rec.interimResults = true; rec.maxAlternatives = 1;
    let final = "";
    rec.onresult = (e) => { let interim = ""; for (const r of e.results) { if (r.isFinal) final = r[0].transcript; else interim += r[0].transcript; } input.value = final || interim; };
    rec.onerror = (e) => { if (e.error === "not-allowed") { toast("Sin permiso de micrófono: puedes escribir 🙂"); voiceOn = false; } };
    rec.onend = () => { rec = null; if (final) send(final); else setVoice("idle"); };
    try { rec.lang = "es-BO"; rec.start(); setVoice("listening"); } catch { rec = null; setVoice("idle"); }
  }
  function speechText(t) {
    return t.replace(/\*+/g, "").replace(/https?:\/\/\S+/g, "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✦]/gu, "")
      .replace(/Bs\.?\s?(\d+)/g, "$1 bolivianos").replace(/^\s*[-•]\s*/gm, "").trim();
  }
  function bestVoice() { const v = speechSynthesis.getVoices(); return v.find((x) => /es-BO/i.test(x.lang)) || v.find((x) => /es-(419|MX|US|AR|PE)/i.test(x.lang)) || v.find((x) => /^es/i.test(x.lang)); }
  function speak(t) {
    if (!voiceOn || !("speechSynthesis" in window)) { setVoice("idle"); return; }
    const u = new SpeechSynthesisUtterance(speechText(t)); u.lang = "es-BO"; const v = bestVoice(); if (v) u.voice = v;
    u.onend = () => { setVoice("idle"); if ($("[data-handsfree]").checked && !chat.hidden) listen(); };
    setVoice("speaking"); speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function stopSpeaking() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }
  function stopVoice() { stopSpeaking(); if (rec) rec.abort(); voiceOn = false; if (wake) { wake.release().catch(() => {}); wake = null; } setVoice("idle"); }

  /* ------------------------------------------------------------ boot */
  $("[data-year]").textContent = new Date().getFullYear();
  renderStack(); renderSigs(); renderTabs(); renderSheet(); renderStory(); renderFeed(); renderPicker();
  renderLive(); setInterval(renderLive, 60000);
  renderCart(); gotoStep(1, true); observeReveal(); restartStack(); onScroll();
})();
