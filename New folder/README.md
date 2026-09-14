# Midwest Supplies — Contact Form Backend (Option B)

A small Node/Express API that receives your contact form submissions, stores
them in a SQLite database, and emails you a notification — replacing EmailJS.

Tested end-to-end: valid submissions, missing-field/invalid-email validation,
honeypot spam trap, rate limiting, and the protected `/submissions` viewer all
confirmed working before delivery.

## What it captures per submission

Name, company, email, phone, subject, message, IP address, browser, browser
version, OS, OS version, device type (desktop/mobile/tablet), raw user agent,
referring page, and timestamp. Country/region/city are optional (off by
default — see `ENABLE_IP_GEOLOCATION` below).

## Folder structure

```
backend/
  server.js        — Express app & routes
  db.js             — SQLite schema + queries (better-sqlite3)
  email.js          — Sends the notification email via Resend
  geolocation.js     — Optional IP → city/region/country lookup
  package.json
  .env.example       — copy to .env and fill in
frontend/
  contact.html       — your contact page, updated to call the API
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

- `ALLOWED_ORIGINS` — your site's domain(s), comma-separated (CORS allowlist)
- `RESEND_API_KEY` — from [resend.com](https://resend.com) (free tier is fine); verify your sending domain there first
- `EMAIL_FROM` — must be on the domain you verified in Resend
- `EMAIL_TO` — where submissions get emailed (e.g. sales@mw-supplies.com)
- `ADMIN_KEY` — a long random string; required as the `X-Admin-Key` header to view stored leads
- `ENABLE_IP_GEOLOCATION` — `true` to also record approximate city/region/country per submission (uses the free ip-api.com service)

Run it:

```bash
npm start
```

The API listens on `PORT` (default 3001) with these routes:

- `POST /submit-form` — accepts the form JSON, saves it, emails you
- `GET /submissions` — returns stored leads (requires `X-Admin-Key` header)
- `GET /health` — uptime check

## 2. Frontend change

In `frontend/contact.html`, find this line near the bottom and point it at
wherever you deploy the backend:

```js
const API_URL = 'https://YOUR-BACKEND-DOMAIN/submit-form';
```

Then replace your existing `contact.html` on the live site with this one (it
also adds a hidden honeypot field for spam protection — don't remove it).

## 3. Deploying

- **Frontend**: keep it on Netlify as-is.
- **Backend**: needs a Node-compatible host since Netlify only serves static
  files/functions, not a long-running Express server. Good low-cost options:
  Railway, Render, Fly.io, or a small VPS. Point `API_URL` in `contact.html`
  at whatever domain you get, and add that same domain to `ALLOWED_ORIGINS`.
- The SQLite file (`database.sqlite`) is created automatically on first run
  next to `server.js`. Back it up periodically, or migrate to a hosted
  Postgres later if submission volume grows.

## 4. Privacy note

You're now storing visitor IP addresses and device/browser details. Add a
line to your site's Privacy Policy disclosing this, and never expose IPs in
any public-facing page — the `/submissions` endpoint is server-side only and
protected by `ADMIN_KEY`.
