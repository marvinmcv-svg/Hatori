# Hattori · Cocina fusión Nikkei · Santa Cruz de la Sierra

Website + **HattorIA** (AI ordering assistant with voice) + WhatsApp ordering funnel + Supabase order backend + public order tracking (**Sigue tu Roll**) + `/admin` staff backoffice.

- Instagram: [@hattoribolivia](https://www.instagram.com/hattoribolivia/) · Facebook: [hattorifusion](https://www.facebook.com/hattorifusion/)
- Branches: **Equipetrol** (Calle Los Lirios #86) and **Las Palmas** · WhatsApp **62098707**

## Stack

Static site with no build step (HTML + CSS + vanilla JS), Vercel serverless functions for the assistant (`api/`), Supabase (Postgres + Auth + Realtime) for orders. Node ≥ 20.

```
index.html               homepage + SEO (Open Graph, schema.org Restaurant)
css/styles.css           design system (tokens at the top)
js/data.js               ALL content + catalog(): shared by the site, HattorIA's tools AND the DB seed
js/config.js             public backend config (Supabase URL + publishable key, siteUrl)
js/app.js                rendering, cart, WhatsApp funnel, live open/closed, chat UI + voice
api/hattoria.js          assistant endpoint: tool-calling loop, streams NDJSON
api/_tools.js            deterministic tools (menu, cart, order, handoff…) + JSON schemas
api/_prompt.js           system prompt + live context
api/_persona.js          HattorIA's own lines + easter eggs
api/_backend.js          calls place_order / track_order RPCs (6 s timeout)
seguimiento/index.html   public order tracking page (?t=<token>)
admin/                   backoffice (login, role-based views, realtime kanban)
supabase/migrations/     001 core schema · 002 ops/security/RLS · 003 RPCs
supabase/seed.sql        generated from data.js (never edit by hand)
scripts/seed-sql.js      node scripts/seed-sql.js > supabase/seed.sql
tests/                   npm test (tools + server guards) · tests/db (SQL behaviour checks)
```

## Design

An editorial Nikkei direction (sumi ink · washi paper · vermilion · gold; Shippori Mincho + Manrope + IBM Plex Mono; seigaiha wave motif), with UX patterns taken from Mobbin references:

| Pattern | Reference |
|---|---|
| Centred serif wordmark + info flanks ("Abierto hoy hasta…"), typeset menu sheet | Monte |
| Bag slide-over, order-context bar, step-by-step tracking | sweetgreen |
| Delivery / Retiro segmented control, two-column checkout with summary | Uber Eats, DoorDash |
| Big "signature" rows | CHOPT, Chipotle |
| Floating store/cart bar on mobile | Starbucks |
| Kanban order board | Slack lists, HubSpot help desk |

The palette and logo come from Hattori's own assets (see "Sources" below).

## HattorIA (the assistant)

- `POST /api/hattoria` with `{ messages, state, channel: "text" | "voice" }` → NDJSON events: `text`, `cart`, `options`, `readback`, `location`, `order`, `track`, `handoff`, `state`, `error`.
- **The model never does money.** It proposes tool calls; `api/_tools.js` computes every price and total from `js/data.js`. The database re-prices every order from `menu_items`.
- **Confirmation is enforced by the server.** The model can't summarise and confirm in the same turn; only a clear "sí" to the read-back places the order, and a repeated "sí" never creates a second one (`tests/guard.test.js`).
- Without an AI key the chat shows "se está preparando 🛠️" and the rest of the site works.
- Voice mode: Web Speech API (push-to-talk, hands-free, barge-in, Bolivian Spanish, "Bs 95" read as "95 bolivianos").
- **Teaching it new words:** search the function logs for `{"evt":"hattoria_miss"…}`, add the word to `SYNONYMS` in `api/_tools.js`, and add a test.

| Variable (Vercel → Settings → Environment Variables) | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude key |
| `HATTORIA_MODEL` / `HATTORIA_VOICE_MODEL` | optional overrides (defaults `claude-sonnet-5-5` / `claude-haiku-5-5`) |
| `NVIDIA_API_KEY`, `HATTORIA_NVIDIA_MODEL` | optional NVIDIA NIM provider (must support tool calling) |
| `HATTORIA_PROVIDER` | optional, forces `anthropic` or `nvidia` |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | optional; otherwise read from `js/config.js` |

Sonnet 5.5 requests use server-side refusal fallbacks (`fallbacks: "default"`).

## Backend (Supabase)

1. Create a project (region: São Paulo is closest to Santa Cruz).
2. Apply `supabase/migrations/001…003` in order, then `supabase/seed.sql`.
3. Create the owner in Auth → Users, then run the `insert into public.staff … 'owner'` line at the end of `seed.sql`.
4. Put the project URL + **publishable** key in `js/config.js` (never the service-role key).
5. Dashboard: Auth → turn **off** "Allow new users to sign up"; turn **on** leaked-password protection. Run the security and performance advisors.

Security highlights: RLS on every table. The publishable key can only place and track orders; it can't read orders or customers. Status and prices change only through RPCs. Kitchen can only move orders through confirmed/preparing/ready, and riders only through dispatch/delivery. Cashiers can't cancel after prep starts, and managers only see their own branch. An audit log keeps readable before → after diffs.

`tests/db/run.sh` applies a Supabase stub + all migrations + seed to a local Postgres and runs those checks.

**Keep prices in sync:** the site shows `js/data.js`; the DB charges `menu_items`. After a price change, update both (in `/admin` → Carta and in `data.js`), or edit `data.js` and re-run the seed.

## WhatsApp funnel and routing

The 4-step funnel (Qué → Detalle → Tus datos → Enviar) records the order via `place_order` (idempotent `client_ref` per cart). It then opens `wa.me/<branch WhatsApp>` with the order code and tracking link. If the backend is unreachable, WhatsApp still opens, so an order is never lost. Each branch has its own `whatsapp` in `data.js` (today both use 62098707).

## Run locally

```bash
npm install
npm test
npx vercel dev
```

## Sources and what is real

- **Brand:** gold brush logo from the Instagram profile (HD). Palette sampled from the logo (#D3A334 on black) and from the official menu (charcoal #3D3F41, gold #C6A23C). Fonts: Fraunces and Allura, the closest open fonts to the menu's Larken and Eyesome Script. Slogan "Cocina con Sentimiento" from the lunch menu.
- **Menu and prices:** the official **Menú** (93 dishes) and **Carta del Medio Día** (8 dishes) PDFs linked from [linktr.ee/hattorifusion](https://linktr.ee/hattorifusion).
- **Photos and reels:** downloaded from @hattoribolivia's latest posts (7 photos, 5 reels), compressed into `assets/`.
- **Contact:** reservations and orders on WhatsApp 62098707 (Linktree). Equipetrol: Los Lirios #86 (Google Maps link in the bio). Las Palmas: map pin from the bio.

## Needs owner input

| Missing | Where to add it |
|---|---|
| Prices for **Tataki Salad** and **Ramen Kaizen** (new on Instagram, not in the PDF menu yet) | `js/data.js`, then `npm run seed` |
| Drinks and cocktails with prices (not in the PDF) | `js/data.js` → `drinks` |
| Las Palmas street address; confirm the map pin and whether it has its own WhatsApp | `js/data.js` → `branches` |
| What the second WhatsApp in the bio (77070797) is for | `js/data.js` → `config.altWhatsApp` |
| Confirm hours per branch and the lunch-menu schedule | `js/data.js` → `defaultHours` |
| Delivery zones, fee, delivery apps; accepted payment methods | `/admin` → Sucursales; `payment_method` enum |
| Allergen information per dish | `js/data.js` (`desc`) |
| Supabase project (orders, tracking, /admin) and an Anthropic key (HattorIA) | `js/config.js`, Vercel env vars |
| Original font files (Larken / Eyesome) if licensed for web | `css/styles.css` |

## Roadmap

Payments (QR / card), WhatsApp Business API bot, rewards and accounts, POS / fiscal invoicing, push notifications, live rider map.
