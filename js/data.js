/* =========================================================================
   HATTORI · Cocina fusión Nikkei · Santa Cruz de la Sierra
   -------------------------------------------------------------------------
   ALL site content lives here. The website, the HattorIA assistant's tools
   and the Supabase seed (scripts/seed-sql.js) all read this same file and
   the same catalog() ids, so they can never disagree on a price or an id.

   RULE: nothing invented. Every fact has its source next to it.
   ========================================================================= */
(function (root) {
  "use strict";

  // Sources
  // [MENU]  Official "Menú" PDF linked from https://linktr.ee/hattorifusion
  //         (https://drive.google.com/file/d/11QA1bIWh5DsfS1m7LhRAAiwc6NwExNft) — all prices below
  // [MD]    Official "Carta del medio día" PDF, same Linktree
  //         (https://drive.google.com/file/d/1Mo19I454837RuwAeT_jHFb5JSHRqbAwa)
  // [IG]    https://www.instagram.com/hattoribolivia/ (bio + posts; photos & reels in assets/ come from these posts)
  // [LT]    https://linktr.ee/hattorifusion ("Reservas y Pedidos" → wa.me/62098707)
  // [FB]    https://www.facebook.com/hattorifusion/ (opening hours post)
  // [GM]    Google Maps links in the Instagram bio

  const it = (id, name, price, desc, extra) => Object.assign({ id, name, price, desc }, extra || {});

  const BRAND = {
    name: "Hattori",
    ai: "HattorIA",
    slogan: "Cocina con Sentimiento",                         // [MD] cover: "Cocina con Sentimiento"
    tagline: "Una marca. Una cultura. Historias infinitas.",  // [IG] profile highlight text
    cuisine: "Cocina fusión Nikkei",                           // [IG] bio
    city: "Santa Cruz de la Sierra",                           // [IG] bio
    config: {
      callCenter: "59162098707",   // [LT] "Reservas y Pedidos" + every [IG] caption "📲 62098707"
      altWhatsApp: "59177070797",  // [IG] bio link wa.me/59177070797 (owner to confirm its use)
      instagram: "https://www.instagram.com/hattoribolivia/",
      facebook: "https://www.facebook.com/hattorifusion/",
      linktree: "https://linktr.ee/hattorifusion",
      menuPdf: "https://drive.google.com/file/d/11QA1bIWh5DsfS1m7LhRAAiwc6NwExNft/view",
      lunchPdf: "https://drive.google.com/file/d/1Mo19I454837RuwAeT_jHFb5JSHRqbAwa/view",
      events: "https://drive.google.com/drive/folders/14xENRX5tbYRYGo6jTOFccMqQ1o9TLu7f", // [LT] "Eventos"
      timezone: "America/La_Paz",
      currency: "Bs",
      locale: "es-BO",
      phonePrefix: "591",
      phoneDigits: 8,
    },
    base: null,

    // ---------------- [MENU] full official menu
    menu: [
      { id: "entradas", name: "Entradas", items: [
        it("hamachi-kama", "Hamachi Kama", 75, "Mejillas de salmón empanizadas, acompañadas de causa en salsa de mariscos al fuego."),
        it("skin-de-salmon", "Skin de Salmón", 40, "Crocante piel de salmón, acompañada con salsas de la casa."),
        it("conchitas-cevicheras", "Conchitas Cevicheras", 75, "Conchitas con ceviche clásico cremoso y ají amarillo."),
        it("causa-rellena", "Causa Rellena", 85, "Causa rellena de calamares y queso, en salsa de ají amarillo y ceviche cremoso."),
        it("causitas-furay-2", "Causitas Furay", 40, "Esferas crocantes rellenas de queso cremoso coronadas con tartar de salmón.", { size: "2 u" }),
        it("causitas-furay-4", "Causitas Furay", 80, "Esferas crocantes rellenas de queso cremoso coronadas con tartar de salmón.", { size: "4 u" }),
        it("causa-limena", "Causa Limeña", 75, "Causita rellena con pulpa de pescado acevichado y palta, coronada con langostinos."),
        it("mariscos-al-fuego", "Mariscos al Fuego", 95, "Surtido de mariscos presentados al fuego."),
        it("langostinos-furay", "Langostinos Furay", 75, "Langostinos empanizados en panko, acompañados de mermelada de rocoto de la casa."),
        it("gyozas", "Gyozas", 75, "Empanaditas rellenas de cerdo, a la plancha o al vapor."),
        it("crispy-tartar-spicy", "Crispy Tartar Spicy", 75, "Tartar de pescado blanco con salsa spicy mayo sobre arroz crocante."),
        it("empanadas-hattori", "Empanadas Hattori", 45, "Crocante masa de la casa, rellena de mariscos en ají amarillo."),
        it("empanadas-mariscos-al-fuego", "Empanadas de Mariscos al Fuego", 45, "Crocante masa de la casa, rellena de salteado de mariscos al fuego."),
      ] },
      { id: "rolls", name: "Rolls & Makis", items: [
        it("acevichado-roll", "Acevichado Roll", 92, "Relleno de langostinos empanizados y palta. Cubierto con salmón en salsa acevichada.", { star: true, img: "assets/img/acevichado-roll.webp" }),
        it("parmesano-roll", "Parmesano Roll", 80, "Relleno de langostinos empanizados, queso crema y palta. Coronado con mix de quesos ahumados."),
        it("shake-furay", "Shake Furay", 80, "Langostinos empanizados y palta por dentro, cubierto de queso crema y bañado en salsas de la casa."),
        it("philadelphia-roll", "Philadelphia Roll", 80, "Salmón, palta y queso crema por dentro, cubierto con semillas de sésamo."),
        it("fried-roll", "Fried Roll", 80, "Salmón, palta y queso crema por dentro, empanizado por fuera.", { img: "assets/img/fried-roll.webp" }),
        it("avocado-roll", "Avocado Roll", 80, "Langostinos empanizados y queso crema por dentro, cubierto de palta y salsa tare."),
        it("ika-maki", "Ika Maki", 85, "Langostinos empanizados, queso crema y palta. Cubierto de salsa anticuchera y coronado con calamar crocante."),
        it("tartar-roll", "Tartar Roll", 92, "Langostinos empanizados, queso crema y palta. Cubierto de salmón flambeado, con tartar de salmón y crocante de camote.", { img: "assets/img/tartar-roll.webp" }),
        it("avocado-especial", "Avocado Especial", 85, "Relleno de langostinos empanizados y palta, cubierto con queso especiado de la casa."),
        it("gauchito-roll", "Gauchito Roll", 88, "Relleno de queso crema y palta, cubierto de lomito con chimichurri ahumado de la casa."),
        it("seiko-tempura-roll", "Seiko Tempura Roll", 95, "Relleno de langostino, salmón y palta. Coronado con selección de quesos especiados de la casa."),
      ] },
      { id: "especiales", name: "Rolls especiales", items: [
        it("hosso-roll", "Hosso Roll", 90, "Relleno de salmón y queso crema, cubierto con palta y tartar de langostinos en salsa barbacoa.", { size: "6 pzas" }),
        it("masu-roll", "Masu Roll", 55, "Relleno de lomito de trucha salmonada y pescado blanco, cubierto con palta.", { size: "6 pzas" }),
        it("thai-roll", "Thai Roll", 60, "Relleno de queso crema y palta, coronado con calamares crispy y salsa thai.", { size: "6 pzas" }),
        it("kuru-maki", "Kuru Maki", 65, "Crocante maki relleno de langostinos empanizados y palta, coronado con queso especiado ahumado.", { size: "6 pzas" }),
        it("maki-zen", "Maki Zen", 45, "Relleno de langostinos empanizados y palta, coronado con tartar de salmón y pescado blanco en salsa de jalapeño.", { size: "6 pzas" }),
        it("maki-al-fuego", "Maki al Fuego", 65, "Tempura relleno de queso y palta, coronado con mariscos al fuego.", { size: "6 pzas" }),
        it("temaki-clasico", "Temaki Clásico", 45, "Temaki relleno con trucha salmonada, palta y queso crema.", { size: "1 pza" }),
        it("acevi-roll", "Acevi Roll", 45, "Relleno de langostinos o pescado empanizado y palta. Cubierto con salmón en salsa acevichada.", { size: "6 pzas", img: "assets/img/acevichado-classic.webp" }),
      ] },
      { id: "sashimi", name: "Sashimi · Tiraditos · Tartar", items: [
        it("sashimi-trucha", "Sashimi de Trucha Salmonada", 80, "Frescos cortes de trucha salmonada seleccionada.", { size: "6 pzas" }),
        it("sashimi-atun", "Sashimi de Atún", 50, "Frescos cortes de atún seleccionado.", { size: "3 pzas" }),
        it("tiradito-trucha", "Tiradito de Trucha Salmonada", 80, "Finos cortes de trucha salmonada marinados en cítricos y salsa de la casa."),
        it("tartar-maguro", "Tartar Maguro", 98, "Cortes de atún fresco marinado en especias de la casa."),
        it("sashimi-moriawase-10", "Sashimi Moriawase", 150, "Combinación de finos cortes de atún, paiche, trucha salmonada y langostinos.", { size: "10 pzas" }),
        it("sashimi-moriawase-18", "Sashimi Moriawase", 270, "Combinación de finos cortes de atún, paiche, trucha salmonada y langostinos.", { size: "18 pzas", share: true }),
      ] },
      { id: "gunkan", name: "Gunkan · Nigiris · Baos", items: [
        it("gunkan-especial", "Gunkan Especial", 85, "Envolturas de salmón rellenas de shari, coronadas con tartar de salmón y salsa acevichada.", { size: "6 pzas" }),
        it("geishas-maracuya-3", "Geishas de Maracuyá", 45, "Envolturas de salmón con queso crema, salsa de maracuyá y camote frito.", { size: "3 u" }),
        it("geishas-maracuya-6", "Geishas de Maracuyá", 90, "Envolturas de salmón con queso crema, salsa de maracuyá y camote frito.", { size: "6 u" }),
        it("gunkan-tartar-3", "Gunkan Tartar", 55, "Envolturas de salmón rellenas de tartar de trucha, coronadas con tartar de langostinos y salsa acevichada.", { size: "3 u" }),
        it("gunkan-tartar-6", "Gunkan Tartar", 105, "Envolturas de salmón rellenas de tartar de trucha, coronadas con tartar de langostinos y salsa acevichada.", { size: "6 u" }),
        it("nigiri-lomito", "Nigiri de Lomito", 45, "Lomo sellado al fuego con salsa de lomo saltado, coronado con cilantro y ajo picante."),
        it("nigiri-salmon", "Nigiri de Salmón", 45, "Salmón sellado al fuego con tartar de trucha salmonada, coronado con cebollín."),
        it("nigiri-langostinos", "Nigiri de Langostinos", 45, "Langostinos cocidos delicadamente bañados en salsa parrillera."),
        it("bao-sakana-crispy", "Bao Sakana Crispy", 75, "Pan al vapor con filetes crocantes de pescado, ensalada criolla, salsa huancaína y acevichada, con papas fritas."),
        it("bao-cerdo", "Bao de Cerdo", 75, "Pan al vapor relleno de cerdo a la barbacoa y ensalada de la casa, con papas fritas."),
        it("bao-philadelphia", "Bao Philadelphia", 75, "Pan al vapor con lomito, queso cremoso y tomate en salsa Philadelphia de la casa, con papas fritas."),
      ] },
      { id: "ceviches", name: "Ceviches", items: [
        // [IG] reel DeNOa5pqUVY: "se prepara al momento y se sirve con el equilibrio perfecto de frescura y sabor"
        it("ceviche-clasico", "Ceviche Clásico", 85, "Coronado con chicharrón de calamar. Camote, choclo y maíz tostado.", { size: "Clásico" }),
        it("ceviche-clasico-mixto", "Ceviche Clásico", 110, "Coronado con chicharrón de calamar. Camote, choclo y maíz tostado.", { size: "Mixto" }),
        it("leche-de-tigre", "Leche de Tigre Hattori", 60, "Leche de tigre de nuestro ceviche clásico, presentada en copa."),
        it("ceviche-hattori", "Ceviche Hattori", 90, "Cortes de pescado blanco en leche de tigre apaltada.", { size: "Clásico" }),
        it("ceviche-hattori-mixto", "Ceviche Hattori", 115, "Cortes de pescado blanco en leche de tigre apaltada.", { size: "Mixto" }),
        it("ceviche-tropical", "Ceviche Tropical", 90, "Cortes de pescado blanco en leche de tigre tropical."),
        it("ceviche-a-la-brasa", "Ceviche a la Brasa", 85, "Filete de pescado a la brasa y calamar con salsa de tiradito de ají amarillo."),
      ] },
      { id: "bowls", name: "Bowls", items: [
        it("acevichado-de-salmon", "Acevichado de Salmón", 85, "Salmón en leche de tigre sobre arroz shari, con palta y nuestra clásica salsa acevichada."),
        it("ebi-bowl", "Ebi Bowl", 85, "Langostinos a la parrilla, salmón braseado, palta y vegetales frescos sobre arroz shari."),
        it("sashimi-bowl", "Sashimi Bowl", 82, "Salmón, langostinos, pepino, palta y vegetales frescos sobre arroz shari.", { img: "assets/img/sashimi-bowl.webp" }),
        it("niku-bowl", "Niku Bowl", 80, "Costilla de cerdo desmenuzada a la barbacoa, queso crema, pepino, palta y vegetales sobre arroz shari."),
      ] },
      { id: "calientes", name: "Cocina caliente", items: [
        it("jalea-limena", "Jalea Limeña", 130, "Pescado blanco, langostinos y calamar empanizados, con ensalada criolla y yuca frita."),
        it("picante-de-calamar", "Picante de Calamar", 95, "Calamares salteados y bañados en salsa de ajíes sobre papas asadas."),
        it("fettuccine-huancaina", "Fettuccine a la Huancaína", 95, "Fettuccine a la huancaína coronado con dados de surubí en salsa de ostras."),
        it("chaufa-de-cerdo", "Arroz Chaufa de Cerdo", 75, "Arroz salteado al estilo nikkei."),
        it("ebi-ramen", "Ebi Ramen", 85, "Ramen de langostinos con fideos artesanales."),
        it("ramen-hattori", "Ramen Hattori", 75, "Ramen tradicional con tiras de cerdo y fideos artesanales."),
        it("costillas-barbacoa", "Costillas a la Barbacoa", 120, "Costillas de cerdo a la barbacoa de la casa con puré de papas."),
        it("pulpo-anticuchero", "Pulpo Anticuchero", 140, "Pulpo en salsa anticuchera sobre puré de papas y vegetales."),
        it("salmon-glaseado", "Salmón Glaseado", 120, "Lomito de salmón a la plancha sobre puré de papas y vegetales."),
        it("torimeshi", "Torimeshi", 120, "Arroz con mariscos a la brasa."),
        it("lomo-saltado", "Lomo Saltado", 95, "Cortes de lomito salteados en salsa especial, con papas fritas."),
        it("trilogia-nikkei", "Trilogía Nikkei", 145, "Los íconos de la fusión en un plato: causa de calamares, ceviche Hattori y lomo saltado a la huancaína."),
        it("planchita-marina", "Planchita Marina", 125, "Mix de mariscos a la parrilla en salsa anticuchera, con choclo, papitas negras y salsa de la casa."),
        it("chaufa-mar-y-tierra", "Arroz Chaufa Nikkei Mar y Tierra", 120, "Arroz salteado al estilo nikkei con mariscos."),
        it("fettuccine-saltado", "Fettuccine Saltado", 120, "Piezas jugosas de lomo saltado sobre fettuccine en salsa cremosa huancaína.", { star: true, img: "assets/img/fetuccine-huancaina.webp" }),
      ] },
      { id: "compartir", name: "Para compartir", items: [
        it("fuente-nikkei", "Fuente Nikkei", 260, "Ceviche de ají amarillo, ceviche cremoso, jalea de pescado, copa de pulpo al olivo, sashimi de salmón y nigiri de langostino.", { share: true }),
        it("tabla-mix-hatt", "Tabla Mix Hatt", 165, "Mix de sushi: Fried roll, Philadelphia roll, Acevichado roll y Avocado roll.", { size: "20 pzas", share: true }),
        it("tabla-mix-tori", "Tabla Mix Tori", 165, "Mix de sushi: Philadelphia roll, Ika Maki, Avocado especial y Acevi roll.", { size: "20 pzas", share: true }),
        it("tabla-mix-hattori", "Tabla Mix Hattori", 165, "Gunkan especial, gunkan tartar, geishas, sashimi y nigiris.", { size: "11 pzas", share: true }),
      ] },
      { id: "ninos", name: "Menú para niños", items: [
        it("sakana-crispy-kids", "Sakana Crispy Kids", 50, "Chicharrón de pescado con papas fritas y arroz."),
        it("pollo-crispy-kids", "Pollo Crispy Kids", 50, "Chicharrón de pollo con papas fritas y arroz."),
        it("calamar-crispy-kids", "Calamar Crispy Kids", 60, "Calamar crocante con papas fritas y arroz."),
      ] },
      { id: "postres", name: "Postres", items: [
        it("suspiro-de-limena", "Suspiro de Limeña", 30, "Manjar de leche con merengue."),
        it("brownie-con-helado", "Brownie con Helado", 35, "Brownie de chocolate con helado de vainilla."),
        it("helada-de-caramelo", "Helada de Caramelo", 38, "Torta helada de caramelo y nueces."),
        it("creme-brulee", "Crème Brûlée", 28, "Crema con cubierta de caramelo."),
        it("copa-de-helado", "Copa de Helado", 30, "Tres sabores de helado."),
        it("brownie-tempura", "Brownie Tempura", 45, "Brownie de chocolate en tempura con helado."),
      ] },
      // [IG] posts mention these but they are not in the PDF menu → no price yet
      { id: "nuevos", name: "Nuevo en Hattori", items: [
        it("tataki-salad", "Tataki Salad", null, "La opción que siempre sorprende desde el primer bocado.", { hot: true, video: "assets/video/tataki-salad" }), // [IG] DgK0h7MxTEZ
        it("ramen-kaizen", "Ramen Kaizen", null, "Se prepara con dedicación: una experiencia llena de sabor en cada cucharada.", { hot: true }), // [IG] reel Det9XlPKDk9
      ] },
    ],

    // ---------------- [MD] Carta del medio día
    lunch: {
      title: "Carta del Medio Día",
      note: "Platos del mediodía. Consulta disponibilidad en tu sucursal.",
      items: [
        it("md-aji-de-gallina", "Ají de Gallina", 70, "Tradicional plato peruano a base de ají amarillo, queso, crema de leche y pechuga de gallina deshilachada."),
        it("md-jalea-mixta", "Jalea Mixta", 68, "Crocantes y jugosos cortes de pescado y calamar, con salsa tártara y ensalada criolla."),
        it("md-ceviche-ahumado", "Ceviche con Leche de Tigre Ahumada", 60, "Delicioso ceviche peruano con una increíble leche de tigre ahumada."),
        it("md-tiradito-mixto", "Tiradito Mixto", 72, "Cortes especiales de trucha y lomito de paiche bañados en leche de tigre al ají amarillo."),
        it("md-crispy-tartar", "Crispy Tartar Spicy", 65, "Crocantes galletas de shari coronadas con tartar de salmón en salsa de siracha y tare con quinua crocante."),
        it("md-causa-limena", "Causa Limeña", 68, "Clásica causita limeña con pulpa de surubí en salsa de jalapeño ahumado y leche de tigre de ají amarillo."),
        it("md-picante-calamares", "Picante de Calamares", 60, "Calamares salteados y bañados en una excepcional salsa a base de ajíes."),
        it("md-fettuccine-huancaina", "Fettuccine a la Huancaína", 69, "Coronado con dados jugosos de surubí en salsa de ostras."),
      ],
    },

    addons: [], drinks: [], weekly: [], combos: [], special: null, partner: null, offers: [],

    // Hero / signatures (all have real photos from [IG])
    featured: ["acevichado-roll", "tartar-roll", "fettuccine-saltado", "sashimi-bowl", "fried-roll"],

    branches: [
      {
        id: "equipetrol", name: "Equipetrol", whatsapp: "59162098707",
        // [IG] captions + [GM] "HATTORI, Los Lirios 86" · cross streets + pin: https://mundocamba.com/place/hattori/
        address: "Calle Los Lirios #86, entre C. Tropical y C. Los Flamboyanos · Equipetrol",
        maps: "https://maps.app.goo.gl/WbJeUREFnyyMspej9",          // [GM] bio link
        hours: null,
      },
      {
        id: "las-palmas", name: "Las Palmas", whatsapp: "59162098707",
        address: null,                                              // street address not published
        maps: "https://www.google.com/maps?q=-17.806841,-63.209820",// [GM] bio pin (owner to confirm it is Las Palmas)
        hours: null,
      },
    ],
    // [FB] "18:00 a 23:00 entre semana! Sábados y Domingos de 12:00 a 15:00 y de 18:00 a 23:00"
    defaultHours: {
      0: [["12:00", "15:00"], ["18:00", "23:00"]],
      1: [["18:00", "23:00"]], 2: [["18:00", "23:00"]], 3: [["18:00", "23:00"]], 4: [["18:00", "23:00"]], 5: [["18:00", "23:00"]],
      6: [["12:00", "15:00"], ["18:00", "23:00"]],
    },

    facts: [
      "Hattori es un restaurante de cocina fusión Nikkei (peruano-japonesa) en Santa Cruz de la Sierra. Su lema: Cocina con Sentimiento.",
      "Tiene dos sucursales: Equipetrol (Calle Los Lirios #86) y Las Palmas.",
      "Reservas y pedidos por WhatsApp al 62098707.",
      "La carta tiene entradas, rolls y makis, rolls especiales, sashimi, tiraditos, gunkan, nigiris, baos, ceviches, bowls, cocina caliente, platos para compartir, menú para niños y postres.",
      "Al mediodía hay una Carta del Medio Día con platos peruanos (ají de gallina, jalea mixta, tiradito, causa, etc.).",
      "Hattori es un lugar de after office con tragos.",
      "Hay cervezas, vinos, jugos naturales, gaseosas y cócteles de autor (sin lista de precios publicada).",
      "Las reservas de mesa se hacen por WhatsApp al 62098707.",
      "La sucursal de Las Palmas es la más nueva.",
      "Hattori organiza eventos (ver el enlace de Eventos).",
      "Horario: lunes a viernes de 18:00 a 23:00; sábados y domingos de 12:00 a 15:00 y de 18:00 a 23:00.",
    ],

    story: {
      eyebrow: "La experiencia Hattori",
      title: "Cocina con sentimiento.",
      paragraphs: [
        "Hay momentos que se disfrutan con todos los sentidos: sabores que llegan a la mesa, buena compañía y una experiencia que invita a quedarse.", // [IG] DfpDM5Uqd-E
        "En Hattori seguimos creando propuestas para sorprenderte. Nuevas creaciones, nuevos sabores por descubrir.", // [IG] Df-NEJKK4iE
      ],
      quote: { text: "No busca una cocina japonesa tradicional, sino una propuesta más creativa y contemporánea, pensada para compartir y disfrutar.", by: "Guía Dinorr" },
      video: "assets/video/experiencia",
    },

    // [IG] reels (downloaded, trimmed, muted)
    reels: [
      { src: "assets/video/tu-senal", caption: "Si todavía no conoces Hattori… esta es tu señal.", url: "https://instagram.com/p/DfNSRR6qX24" },
      { src: "assets/video/nuevas-creaciones", caption: "Nuevas creaciones, nuevos sabores por descubrir.", url: "https://instagram.com/p/Df-NEJKK4iE" },
      { src: "assets/video/tataki-salad", caption: "Nuestra Tataki Salad.", url: "https://instagram.com/p/DgK0h7MxTEZ" },
      { src: "assets/video/experiencia", caption: "Una experiencia que invita a quedarse.", url: "https://instagram.com/p/DfpDM5Uqd-E" },
      { src: "assets/video/after-office", caption: "El mejor after office está en Hattori 🍹", url: "https://instagram.com/p/DfZnMDsq6aB" },
    ],

    // [IG] photo posts
    feed: [
      { img: "assets/img/acevichado-roll.webp", url: "https://instagram.com/p/Df2LjyPKTzG", text: "Un favorito que nunca falla. El Acevichado Roll.", tag: "Acevichado Roll" },
      { img: "assets/img/tartar-roll.webp", url: "https://instagram.com/p/De7AGIbqncd", text: "Cuando un roll tiene el equilibrio perfecto, no necesita presentación.", tag: "Tartar Roll" },
      { img: "assets/img/sashimi-bowl.webp", url: "https://instagram.com/p/Dfw6Xu-pWcB", text: "Un plato que conquista desde el primer bocado.", tag: "Sashimi Bowl" },
      { img: "assets/img/fetuccine-huancaina.webp", url: "https://instagram.com/p/DfVXIGRq-i3", text: "Dos favoritos en un solo plato.", tag: "Fettuccine Saltado" },
      { img: "assets/img/fried-roll.webp", url: "https://instagram.com/p/DfDX01eKM3b", text: "La experiencia Hattori empieza con un primer bocado.", tag: "Fried Roll" },
      { img: "assets/img/acevichado-classic.webp", url: "https://instagram.com/p/DgDOqyXq1z5", text: "Porque los clásicos nunca fallan. 🥢", tag: "Acevichado" },
      { img: "assets/img/fetuccine-semana.webp", url: "https://instagram.com/p/DfhdWI1xtVl", text: "Empezar la semana sabe mejor con un buen plato.", tag: "Fettuccine" },
      { img: "assets/video/after-office.webp", url: "https://instagram.com/p/DfZnMDsq6aB", text: "El mejor after office está en Hattori 🍹✨", tag: "After office" },
    ],
  };

  // ---------- catalog(): id → normalized item (shared by site, tools and DB seed)
  BRAND.catalog = function catalog() {
    const out = {};
    BRAND.menu.forEach((cat, ci) => cat.items.forEach((x, ii) => {
      out[x.id] = {
        id: x.id, name: x.name, price: x.price, kind: cat.id === "postres" ? "dessert" : "main", cat: cat.id, catName: cat.name,
        size: x.size || null, desc: x.desc || "", veg: !!x.veg, hot: !!x.hot, star: !!x.star, share: !!x.share, img: x.img || null,
        orderable: typeof x.price === "number", sort: ci * 100 + ii,
      };
    }));
    BRAND.lunch.items.forEach((x, i) => {
      out[x.id] = { id: x.id, name: x.name, price: x.price, kind: "main", cat: "mediodia", catName: "Medio día", size: "Medio día", desc: x.desc, veg: false, hot: false, star: false, share: false, img: null, orderable: true, sort: 2000 + i };
    });
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
