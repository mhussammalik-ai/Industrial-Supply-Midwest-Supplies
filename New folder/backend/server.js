require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { UAParser } = require('ua-parser-js');

const { saveSubmission, listSubmissions } = require('./db');
const { sendNotificationEmail } = require('./email');
const { lookupLocation } = require('./geolocation');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Trust the reverse proxy (Netlify/Nginx/etc.) so req.ip is the real visitor IP ---
app.set('trust proxy', true);

// --- CORS: only allow your own site(s) to call this API ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server / curl requests with no origin header
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '20kb' }));

// --- Basic spam / abuse protection: 5 submissions per 10 minutes per IP ---
const formLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions. Please try again later.' },
});

function getClientIp(req) {
  // req.ip already respects "trust proxy" + X-Forwarded-For
  return req.ip;
}

// --- POST /submit-form ---
app.post('/submit-form', formLimiter, async (req, res) => {
  try {
    const body = req.body || {};

    // Honeypot field: real users never fill this in (it should be hidden via CSS in the form).
    // Bots that auto-fill every field will trip it.
    if (body.website) {
      // Pretend success so bots don't learn the trap worked; don't store or email it.
      return res.json({ ok: true });
    }

    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const message = (body.message || '').trim();

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'Name, email, and message are required.' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ ok: false, error: 'Please provide a valid email address.' });
    }

    const ip = getClientIp(req);
    const userAgentRaw = req.headers['user-agent'] || '';
    const parsed = new UAParser(userAgentRaw).getResult();
    const location = await lookupLocation(ip);

    const submission = {
      name,
      company: (body.company || '').trim() || null,
      email,
      phone: (body.phone || '').trim() || null,
      subject: (body.subject || body.topic || '').trim() || null,
      message,
      ip_address: ip || null,
      country: location.country,
      region: location.region,
      city: location.city,
      browser: parsed.browser.name || null,
      browser_version: parsed.browser.version || null,
      os: parsed.os.name || null,
      os_version: parsed.os.version || null,
      device_type: parsed.device.type || 'desktop',
      user_agent_raw: userAgentRaw || null,
      referrer: (body.pageUrl || req.headers.referer || '').trim() || null,
    };

    const id = saveSubmission(submission);

    // Don't let an email hiccup fail the whole request — the submission is already saved.
    try {
      await sendNotificationEmail({ ...submission, submitted_at: new Date().toISOString() });
    } catch (emailErr) {
      console.error('[email] Failed to send notification:', emailErr.message);
    }

    return res.json({ ok: true, id });
  } catch (err) {
    console.error('[submit-form] error:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

// --- GET /submissions — simple protected view of stored leads ---
// Protect with a shared secret so randoms can't read your leads.
app.get('/submissions', (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  return res.json({ ok: true, submissions: listSubmissions({ limit, offset }) });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Midwest Supplies contact API running on port ${PORT}`);
});
