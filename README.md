# Movigo Broadcast — WhatsApp Bulk Campaign Tool

Upload a CSV/XLSX of contacts, map the columns, write one message with an
image, and send it to everyone in one click. Built for sending Movigo's
retailer/driver promos, and doubles as a full-stack college project.

## What it does

1. **Upload** — drag in a `.csv` or `.xlsx` export of your retailers/drivers
2. **Map columns** — tell it which column is the phone number, and which to
   use for personalization (`{{name}}`, `{{city}}`)
3. **Compose** — write the message, paste an image URL, preview it as it'll
   look on WhatsApp
4. **Send** — one click, watch live progress, export a results CSV
   (who got it, who failed, and why)
5. **History** — every past campaign is logged with its stats

## Running it

```bash
npm install
npm start
```

Then open **http://localhost:4000**

## Mock mode (default)

Right now sending is **mocked** — it simulates realistic latency and a
~92% success rate so you can fully build/demo/grade the app before you have
real WhatsApp Business API credentials. You'll see it clearly labeled
"MOCK SEND MODE" in the sidebar.

## Going live with real WhatsApp sending

You cannot send free-form bulk WhatsApp messages — Meta requires an approved
**message template** (image header + body text with variables) if you're
messaging someone outside a 24-hour conversation window. Steps:

1. Sign up with a WhatsApp Business API provider — **AiSensy** or
   **Interakt** are the fastest to onboard with in India.
2. Get your business verified and create your message template
   (e.g. `area_expansion_promo`) with an image header and body variables.
   Wait for Meta's approval (usually a few hours).
3. Open `services/whatsappService.js` — it has ready-to-paste example code
   for both AiSensy and Interakt in the comments at the top. Swap the mock
   body of `sendWhatsAppTemplate()` for the real fetch call.
4. Set `USE_MOCK_WHATSAPP=false` as an environment variable.
5. Everything else — upload, mapping, compose UI, progress tracking, CSV
   export — stays exactly the same.

## Project structure

```
server.js                    Express app + all API routes
services/whatsappService.js  Sending logic (mock now, real API later)
services/phoneUtils.js       Phone number normalization/validation (India)
services/campaignStore.js    Simple JSON-file campaign storage
public/                      Frontend (vanilla HTML/CSS/JS, no build step)
data/campaigns.json          Campaign history (auto-created)
```

No database setup needed — campaign history is stored in a local JSON file.
If you want to swap this for MongoDB later (to match your Movigo stack),
`services/campaignStore.js` is the only file that needs to change.

## Notes for your college write-up

- Solves a real problem for a live startup (Movigo) with 900+ real users
- Full stack: file parsing (`xlsx`), REST API design, async job processing
  with progress polling, CSV export, phone number validation/normalization
- Designed so the "send" layer is swappable — mock now, real WhatsApp
  Business API later — a clean example of an adapter/strategy pattern
- Known limitation to mention if asked: current sending loop is sequential
  with a delay; for very large lists (10k+) you'd want a proper job queue
  (e.g. BullMQ + Redis) instead of the in-memory loop used here
