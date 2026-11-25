/* =========================================================================
   HATTORI · Cocina fusión Nikkei · Santa Cruz de la Sierra
   -------------------------------------------------------------------------
   ALL site content lives here. The website, the HattorIA assistant's tools
   and the Supabase seed (scripts/seed-sql.js) all read this same file and
   the same catalog() ids, so they can never disagree on a price or an id.

   RULE: nothing invented. Every fact has its source next to it.
   Anything not public is `null` and listed in README → "Needs owner input".
   A dish with `price: null` is shown as "Consultar" and cannot be added to
   the cart until the owner fills in its price.
   ========================================================================= */
(function (root) {
  "use strict";

  // Source keys used in the comments below
  // [IG]      https://www.instagram.com/hattoribolivia/  (bio)
  // [IG-AO]   https://www.instagram.com/p/DfZnMDsq6aB/  (after office reel: both branches + WhatsApp)
  // [FB]      https://www.facebook.com/hattorifusion/    (page: hours + Los Lirios #86)
  // [YX]      https://yandex.com/maps/org/hattori/195364302562/  (menu snippet with Bs prices)
  // [DIN]     https://dinorr.com/restaurantes/hattori     (independent review, Equipetrol)
  // [TT]      https://www.tiktok.com/@bolivianeats/video/7110967578113232134 (mentions Causa Furay)

  const BRAND = {
    name: "Hattori",
    ai: "HattorIA",
    slogan: "Una marca. Una cultura. Historias infinitas.", // [IG] search snippet of the profile: "Una marca Una cultura Historias infinitas"
    cuisine: "Cocina fusión Nikkei",                         // [IG] bio: "Restaurante de comida fusión Nikkei"
    city: "Santa Cruz de la Sierra",                         // [IG] bio
    config: {
      callCenter: "59162098707",   // [IG-AO] "📲 62098707"
      instagram: "https://www.instagram.com/hattoribolivia/",
      facebook: "https://www.facebook.com/hattorifusion/",
      timezone: "America/La_Paz",
      currency: "Bs",
      locale: "es-BO",
      phonePrefix: "591",
      phoneDigits: 8,
    },

    // What every roll has. Not published → left generic on purpose (no ingredients invented).
    base: null,

    menu: [
      {
        id: "rolls", name: "Rolls", items: [
          // [YX] "Acevichado roll · 95 Bs." · [IG] https://instagram.com/p/Df2LjyPKTzG "El Acevichado Roll se ganó un lugar especial entre los más pedidos"
          { id: "acevichado-roll", name: "Acevichado Roll", price: 95, desc: "Un favorito que nunca falla: de los más pedidos de Hattori.", star: true },
          // [YX] "Tartar roll · 97 Bs." · [IG] https://instagram.com/p/De7AGIbqncd "Cuando un roll tiene el equilibrio perfecto, no necesita presentación"
          { id: "tartar-roll", name: "Tartar Roll", price: 97, desc: "Cuando un roll tiene el equilibrio perfecto, no necesita presentación." },
          // [YX] "Ika maki · 95 Bs."
          { id: "ika-maki", name: "Ika Maki", price: 95, desc: "Maki de la carta Hattori." },
          // [YX] "Masu roll 6 piezas · 60 Bs."
          { id: "masu-roll", name: "Masu Roll", size: "6 piezas", price: 60, desc: "Roll de 6 piezas." },
          // [IG] https://instagram.com/p/DfDX01eKM3b "Fried Roll, una combinación que siempre invita a volver" — price not public
          { id: "fried-roll", name: "Fried Roll", price: null, desc: "Una combinación que siempre invita a volver." },
        ],
      },
      {
        id: "compartir", name: "Para compartir", items: [
          // [YX] "Tabla mix hat · 175 Bs." (name truncated in the source; owner to confirm full name)
          { id: "tabla-mix", name: "Tabla Mix Hattori", price: 175, desc: "La tabla para compartir de la casa.", share: true },
        ],
      },
      {
        id: "nikkei", name: "Cocina Nikkei", items: [
          // [FB] "Fresco, intenso y lleno de sabor. Nuestro Ceviche Clásico siempre es una buena elección."
          { id: "ceviche-clasico", name: "Ceviche Clásico", price: null, desc: "Fresco, intenso y lleno de sabor." },
          // [TT] "Hattori- Tartar Roll, Causa Furay y su Acevichado"
          { id: "causa-furay", name: "Causa Furay", price: null, desc: "Causa de la casa." },
          // [IG] https://instagram.com/p/DgK0h7MxTEZ "Nuestra Tataki Salad es esa opción que siempre sorprende desde el primer bocado"
          { id: "tataki-salad", name: "Tataki Salad", price: null, desc: "La opción que siempre sorprende desde el primer bocado." },
          // [IG] https://instagram.com/p/Dfw6Xu-pWcB "Nuestro Sashimi Bowl combina ingredientes frescos"
          { id: "sashimi-bowl", name: "Sashimi Bowl", price: null, desc: "Ingredientes frescos y todo el sabor Nikkei en un bowl." },
          // [IG] https://instagram.com/p/DfhdWI1xtVl + https://instagram.com/p/DfVXIGRq-i3 "Fetuccine saltado y esa salsa huancaína"
          { id: "fetuccine-huancaina", name: "Fetuccine Saltado a la Huancaína", price: null, desc: "Dos favoritos en un solo plato: fetuccine saltado y salsa huancaína." },
          // [IG] https://instagram.com/p/DfNSRR6qX24 "Desde sushi y ramen hasta platos para compartir"
          { id: "ramen", name: "Ramen", price: null, desc: "Para los días de antojo de algo caliente." },
        ],
      },
    ],

    addons: [],   // not public
    drinks: [],   // cocktails exist ("after office" [IG-AO]) but no names/prices are public
    weekly: [],   // no weekly promos published
    combos: [],   // no combos published
    special: null,
    partner: null,
    offers: [],

    // Highlighted dishes (hero card stack). Only items with a public price are orderable.
    featured: ["acevichado-roll", "tartar-roll", "tabla-mix"],

    // [IG-AO] "📍Equipetrol C/Los Lirios #86 📍Las Palmas 📲 62098707"
    // Hours [FB]: "18:00 a 23:00 entre semana! Sábados y Domingos de 12:00 a 15:00 y de 18:00 a 23:00"
    // The FB post does not say whether it applies to both branches → owner to confirm.
    branches: [
      {
        id: "equipetrol", name: "Equipetrol", whatsapp: "59162098707",
        address: "Calle Los Lirios #86, Equipetrol", // [IG-AO] + [FB] + [DIN]
        maps: "https://maps.google.com/?cid=9195594500659114044", // [DIN] "Cómo llegar"
        hours: null, // uses default hours below
      },
      {
        id: "las-palmas", name: "Las Palmas", whatsapp: "59162098707",
        address: null, // not public → needs owner input
        maps: null,
        hours: null,
      },
    ],
    // day 0 = Sunday … 6 = Saturday. Each day: list of [open, close] shifts.
    defaultHours: {
      0: [["12:00", "15:00"], ["18:00", "23:00"]],
      1: [["18:00", "23:00"]],
      2: [["18:00", "23:00"]],
      3: [["18:00", "23:00"]],
      4: [["18:00", "23:00"]],
      5: [["18:00", "23:00"]],
      6: [["12:00", "15:00"], ["18:00", "23:00"]],
    },

    facts: [
      "Hattori es un restaurante de cocina fusión Nikkei (peruano-japonesa) en Santa Cruz de la Sierra.",
      "Tiene dos sucursales: Equipetrol (Calle Los Lirios #86) y Las Palmas.",
      "Pedidos y consultas por WhatsApp al 62098707.",
      "En la carta hay sushi, ceviches, tiraditos, ramen y platos para compartir.",
      "Hattori es un lugar de after office con tragos.",
      "Horario: lunes a viernes de 18:00 a 23:00; sábados y domingos de 12:00 a 15:00 y de 18:00 a 23:00.",
    ],

    story: {
      eyebrow: "La experiencia Hattori",
      title: "La intensidad peruana con la precisión japonesa.",
      paragraphs: [
        // [IG] https://instagram.com/p/DfpDM5Uqd-E
        "Hay momentos que se disfrutan con todos los sentidos: sabores que llegan a la mesa, buena compañía y una experiencia que invita a quedarse.",
        // [IG] https://instagram.com/p/Df-NEJKK4iE
        "En Hattori seguimos creando propuestas para sorprenderte. Nuevas creaciones, nuevos sabores por descubrir.",
      ],
      // [DIN] independent review
      quote: { text: "No busca una cocina japonesa tradicional, sino una propuesta más creativa y contemporánea, pensada para compartir y disfrutar.", by: "Guía Dinorr" },
    },

    // Real captions shown as typographic cards (no photos available yet)
    feed: [
      { url: "https://instagram.com/p/DgK0h7MxTEZ", text: "Nuestra Tataki Salad es esa opción que siempre sorprende desde el primer bocado.", tag: "Tataki Salad" },
      { url: "https://instagram.com/p/DgDOqyXq1z5", text: "Porque los clásicos nunca fallan. 🥢 Nuestro Acevichado te espera.", tag: "Acevichado" },
      { url: "https://instagram.com/p/DfZnMDsq6aB", text: "El mejor after office está en Hattori 🍹✨", tag: "After office" },
      { url: "https://instagram.com/p/DfNSRR6qX24", text: "Desde sushi y ramen hasta platos para compartir, aquí siempre hay algo para ti.", tag: "Carta" },
      { url: "https://instagram.com/p/Dfw6Xu-pWcB", text: "Un plato que conquista desde el primer bocado. 🍣✨ Nuestro Sashimi Bowl.", tag: "Sashimi Bowl" },
      { url: "https://instagram.com/p/DfhdWI1xtVl", text: "Empezar la semana sabe mejor con un Fetuccine Saltado a la Huancaína. 🍝✨", tag: "Fetuccine" },
    ],
  };

  // ---------- catalog(): id → normalized item (shared by site, tools and DB seed)
  BRAND.catalog = function catalog() {
    const out = {};
    BRAND.menu.forEach((cat, ci) => cat.items.forEach((it, ii) => {
      out[it.id] = {
        id: it.id, name: it.name, price: it.price, kind: "main", cat: cat.id, catName: cat.name,
        size: it.size || null, desc: it.desc || "", veg: !!it.veg, hot: !!it.hot, star: !!it.star,
        share: !!it.share, orderable: typeof it.price === "number", sort: ci * 100 + ii,
      };
    }));
    BRAND.drinks.forEach((d, i) => { out[d.id] = { id: d.id, name: d.name, price: d.price, kind: "drink", cat: "drinks", catName: "Bebidas", size: d.size || null, desc: "", orderable: typeof d.price === "number", sort: 900 + i }; });
    return out;
  };

  BRAND.hoursFor = function hoursFor(branchId, day) {
    const b = BRAND.branches.find((x) => x.id === branchId);
    const h = (b && b.hours) || BRAND.defaultHours;
    return h[day] || [];
  };

  // ---------- Time helpers (restaurant timezone). Shared by site + assistant.
  const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  BRAND.DAYS = DAYS;
  BRAND.localParts = function localParts(date) {
    const d = date || new Date();
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: BRAND.config.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    const hh = p.hour === "24" ? "00" : p.hour;
    return { day, minutes: Number(hh) * 60 + Number(p.minute), hhmm: hh + ":" + p.minute, date: p.year + "-" + p.month + "-" + p.day };
  };
  /** → { state: "open"|"soon"|"closed", closesAt?, opensAt?, opensDay?: "hoy"|"mañana"|<day name> } */
  BRAND.statusAt = function statusAt(branchId, date) {
    const t = BRAND.localParts(date);
    const shifts = BRAND.hoursFor(branchId, t.day);
    for (const [o, c] of shifts) {
      if (t.minutes >= toMin(o) && t.minutes < toMin(c)) {
        return { state: toMin(c) - t.minutes <= 30 ? "soon" : "open", closesAt: c };
      }
    }
    const later = shifts.find(([o]) => toMin(o) > t.minutes);
    if (later) return { state: "closed", opensAt: later[0], opensDay: "hoy" };
    for (let i = 1; i <= 7; i++) {
      const d = (t.day + i) % 7; const s = BRAND.hoursFor(branchId, d);
      if (s.length) return { state: "closed", opensAt: s[0][0], opensDay: i === 1 ? "mañana" : DAYS[d] };
    }
    return { state: "closed" };
  };
  /** Is the branch open at HH:MM today (local)? */
  BRAND.openAtTime = function openAtTime(branchId, hhmm, date) {
    const t = BRAND.localParts(date); const m = toMin(hhmm);
    return BRAND.hoursFor(branchId, t.day).some(([o, c]) => m >= toMin(o) && m < toMin(c));
  };
  BRAND.toMin = toMin;

  if (typeof module !== "undefined" && module.exports) module.exports = BRAND;
  else root.HATTORI = BRAND;
})(typeof window !== "undefined" ? window : globalThis);
