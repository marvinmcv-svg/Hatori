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

The palette is **provisional**: Hattori's logo and post graphics weren't publicly downloadable, so colours couldn't be pixel-sampled. Swap the hex values at the top of `css/styles.css` (token names stay).

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

## Needs owner input

Everything below was **not public** on Instagram, Facebook or other sources, so it's left out of the site and the assistant on purpose:

| Missing | Where to add it |
|---|---|
| **Full menu with prices.** Only 5 prices are public (Acevichado Roll 95, Tartar Roll 97, Ika Maki 95, Masu Roll 60, Tabla Mix 175). Fried Roll, Ceviche Clásico, Causa Furay, Tataki Salad, Sashimi Bowl, Fetuccine a la Huancaína and Ramen show "Consultar". | `js/data.js` → `menu`, then `npm run seed` |
| Full name of the "Tabla Mix" (the source was truncated: "Tabla mix hat…") | `js/data.js` |
| Ingredients / descriptions per dish, and allergens | `js/data.js` (`desc`) |
| Drinks / cocktails ("after office") with prices | `js/data.js` → `drinks` |
| **Logo file + brand colours + fonts** (palette is provisional) | `assets/brand/`, `css/styles.css` tokens |
| **Real photos and reels** of the dishes (no photos are shown, by design: nothing stock or AI-generated) | `assets/img`, `assets/video` |
| Las Palmas address, map link and its own WhatsApp (if different) | `js/data.js` → `branches` + `/admin` → Sucursales |
| Confirm opening hours per branch (from a Facebook post: Mon–Fri 18–23, Sat–Sun 12–15 and 18–23) | `js/data.js` → `defaultHours` / `branches[].hours` |
| Delivery: zones, fee, delivery apps used | `/admin` → Sucursales (fee) and the `order_channel` enum |
| Payment methods accepted | `payment_method` enum (001) + assistant facts |
| Promos, combos, anniversary / founding year | `js/data.js` → `weekly`, `combos` |
| Invoice (NIT) requirements | CRM fields already exist |
| Supabase project + owner email; Anthropic key | `js/config.js`, Vercel env |
| Domain (currently assumes `hattori.vercel.app`) | `js/config.js` → `siteUrl`, canonical in `index.html` |

## Roadmap

Payments (QR / card), WhatsApp Business API bot, rewards and accounts, POS / fiscal invoicing, push notifications, live rider map.
