// Sends a notification email via Resend (https://resend.com) whenever a form is submitted.
// Uses the built-in fetch available in Node 18+, so no extra HTTP client dependency is needed.

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendNotificationEmail(submission) {
  const { RESEND_API_KEY, EMAIL_FROM, EMAIL_TO } = process.env;

  if (!RESEND_API_KEY || !EMAIL_FROM || !EMAIL_TO) {
    console.warn('[email] Skipping email — RESEND_API_KEY, EMAIL_FROM or EMAIL_TO not set in .env');
    return { skipped: true };
  }

  const rows = [
    ['Name', submission.name],
    ['Company', submission.company],
    ['Email', submission.email],
    ['Phone', submission.phone],
    ['Subject', submission.subject],
    ['Message', submission.message],
    ['IP Address', submission.ip_address],
    ['Location', [submission.city, submission.region, submission.country].filter(Boolean).join(', ')],
    ['Browser', [submission.browser, submission.browser_version].filter(Boolean).join(' ')],
    ['OS', [submission.os, submission.os_version].filter(Boolean).join(' ')],
    ['Device', submission.device_type],
    ['Page', submission.referrer],
    ['Submitted', submission.submitted_at],
  ].filter(([, value]) => value);

  const html = `
    <h2 style="font-family:sans-serif;">New Contact Form Submission</h2>
    <table style="font-family:sans-serif; border-collapse:collapse;">
      ${rows
        .map(
          ([label, value]) => `
        <tr>
          <td style="padding:6px 12px; font-weight:600; vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 12px; white-space:pre-wrap;">${escapeHtml(value)}</td>
        </tr>`
        )
        .join('')}
    </table>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: EMAIL_TO.split(',').map((s) => s.trim()),
      reply_to: submission.email,
      subject: `New Contact Form: ${submission.subject || submission.name}`,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API error (${response.status}): ${text}`);
  }

  return response.json();
}

module.exports = { sendNotificationEmail };
