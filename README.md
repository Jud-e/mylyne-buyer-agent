# Mylyne Social Buyer Concierge — Listings Edition

A mobile-first social-media acquisition MVP for **Mylyne & Associates**. It is intentionally **not a replacement for Mylyne's existing website**. Its job is to turn a Reel/ad/post click into a useful, low-friction interaction and then hand a better-informed buyer inquiry to Mylyne.

## What changed in this version

- Campaign-aware agent: a social post can pre-fill area, property type and budget context.
- One-tap questions instead of a long lead form.
- A useful result is shown **before** contact details are requested.
- **Show me homes** searches a listing-provider layer and returns a small shortlist.
- The included listing provider uses `data/listings.json` placeholder data; every demo listing is marked as such in the UI.
- Clicking/opening a listing or asking for **More like this** is remembered.
- **Contact Mylyne** writes the lead to `data/leads.json`, including the listings that influenced the inquiry.
- Explicit user facts, campaign-derived inferences and unknown fields remain separate.
- GA4-ready events are included, but contact details are not sent to GA4.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The Express API runs on port `3001`; Vite proxies `/api` to it during development.

Useful demo URLs:

```text
http://localhost:5173/surrey-townhomes
http://localhost:5173/surrey-750
http://localhost:5173/first-home
http://localhost:5173/?campaign=surrey-townhomes&utm_source=instagram
```

## The acquisition flow

```text
Social post / Reel / ad
        ↓
Campaign-aware landing
        ↓
1–3 one-tap questions
        ↓
Immediate buyer direction
        ↓
Show matching homes
        ↓
Small listing shortlist
        ↓
View home / More like this
        ↓
Contact Mylyne
        ↓
Structured lead JSON
```

The important design rule is: **do not ask a question unless its answer unlocks something useful.**

## Lead JSON and the earlier qualification form

`data/leads.json` is the demo persistence layer. A saved record fills most of the useful fields from the earlier qualification-form concept without forcing the visitor to type them all.

Fields include:

- name / email / phone / preferred contact
- social platform / campaign / content source
- buyer intent
- area
- property type
- budget interest
- priority
- timeline
- financing (left `unknown` unless actually collected)
- buying-within-six-months derived from the visitor's selected timeline
- listing interest and requested action
- known facts
- campaign-inferred facts
- unknown fields such as occupation or financing
- concise agent handoff summary
- contact consent

The app does **not** invent occupation, income, mortgage approval, or other unsupported facts.

## Listing architecture

The React app does not know where listings come from. It calls:

```text
POST /api/listings/search
```

The server delegates to:

```text
server/providers/listingProvider.js
```

That provider normalizes every listing to roughly:

```json
{
  "id": "provider-listing-id",
  "status": "active",
  "area": "Surrey",
  "neighbourhood": "Cloverdale",
  "propertyType": "Townhome",
  "price": 749000,
  "beds": 3,
  "baths": 3,
  "sqft": 1510,
  "yearBuilt": 2018,
  "highlights": ["More space"],
  "image": "https://...",
  "detailUrl": "https://mylyne.com/...",
  "isPlaceholder": false
}
```

This means the UI does not need to be rebuilt when the real listing source arrives. Replace the provider implementation and preserve this normalized response shape.

# API / integration plug-in points

## 1. Mylyne website / IDX / MLS listing feed — highest priority

**Current:** `data/listings.json` placeholder listings.

**Production:** connect an approved listing feed/API supplied by Mylyne's website/IDX/MLS provider. Do not assume that because listings are publicly visible on a website they may be copied or republished by a scraper. Confirm the provider's API/feed terms and MLS/board requirements first.

Swap point:

```text
server/providers/listingProvider.js
```

Typical inputs needed from the provider:

- API/feed base URL
- API key or OAuth credentials
- brokerage/agent identifiers if filtering Mylyne's own listings
- supported filters: city/area, price, property type, beds/baths, status
- image and detail-page rules
- attribution/disclaimer requirements

The provider can either return Mylyne's own listings or broader permitted IDX inventory. `detailUrl` should normally point back to the approved listing detail page on Mylyne's existing site.

## 2. CRM / lead destination

**Current:** `POST /api/leads` appends to `data/leads.json`.

**Production:** replace or supplement the file write with the CRM Mylyne actually uses.

Swap point:

```text
server/index.js → POST /api/leads
```

Map the CRM to the same structured payload: contact, source/campaign, buyer profile, listing interest, consent and agent summary. Good production behavior is to create/update a contact and create a buyer inquiry/activity containing the context.

## 3. Google Analytics 4

**Current:** the frontend calls `window.gtag('event', ...)` only if GA4 has already been installed.

Events include:

```text
concierge_started
concierge_answer
concierge_result_viewed
listing_search_started
listing_results_viewed
listing_interest
contact_opened
contact_mylyne
```

Install Mylyne's GA4 tag/container separately, then these hooks begin emitting events. Keep names, emails, phone numbers and other PII out of GA4. Campaign parameters should also remain free of PII.

## 4. Optional LLM / AI API

**Current:** deterministic agent logic. This is intentional: campaign context + a few taps are enough for the MVP and deterministic logic cannot hallucinate lead fields.

**Later:** an LLM can be added for free-text buyer questions, explaining trade-offs, or generating a cleaner handoff summary.

Recommended boundary:

```text
server/providers/agentProvider.js   (future)
```

Do not let an LLM silently invent qualification fields. Store generated/inferred statements separately from explicit user facts and listing-provider facts.

## 5. Email / SMS notification

**Current:** the lead is written to JSON only.

**Later:** after `/api/leads` succeeds, call the team's approved email/SMS provider to alert Mylyne. A notification can contain the buyer's requested contact method, campaign source, profile summary and listing interest.

Keep provider credentials server-side in environment variables, never in React/Vite client code.

## 6. Mylyne's main website

This concierge should complement the current website rather than replace it. Typical deployment options:

```text
mylyne.com/next-move
next.mylyne.com
homes.mylyne.com
```

Social posts can deep-link to campaign routes, while listing cards can link back to Mylyne's existing property-detail pages.

## Environment variables (future production example)

Create `.env` values only when the relevant provider is connected:

```text
LISTING_API_BASE_URL=
LISTING_API_KEY=
CRM_API_BASE_URL=
CRM_API_KEY=
LLM_API_KEY=
EMAIL_API_KEY=
```

Do not prefix server secrets with `VITE_`; Vite-prefixed variables can be exposed to browser code.

## Adding social campaigns

Edit `CAMPAIGNS` in `src/main.jsx`:

```js
'langley-family': {
  platform: 'instagram',
  content: 'What $800K buys a family in Langley',
  area: 'Langley',
  budget: 'Around $800K',
  hook: 'Looking for more space in Langley?',
  title: 'Tell me what matters most and I’ll narrow the options.',
  first: 'priority'
}
```

Then link the relevant Reel/ad to `/langley-family`.

## Production notes

`data/leads.json` and `data/listings.json` are demo-only. A real deployment should use durable storage, access controls, validation, backups, rate limiting and the privacy/consent practices applicable to the business. The listing integration must use an authorized source and follow its display/attribution rules.

Google Analytics should receive behavioral/campaign events, not lead contact details. Google explicitly prohibits sending data such as names, emails and personal phone numbers that can identify an individual to Analytics.
