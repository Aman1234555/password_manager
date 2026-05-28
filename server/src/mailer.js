import nodemailer from 'nodemailer';
import {
  EMAIL_SMTP_HOST,
  EMAIL_SMTP_PORT,
  EMAIL_SMTP_SECURE,
  EMAIL_SMTP_USER,
  EMAIL_SMTP_PASS,
  EMAIL_FROM,
  BREVO_API_KEY,
  SENDGRID_API_KEY,
  MAILGUN_API_KEY,
  MAILGUN_DOMAIN,
  MAILGUN_API_BASE
} from './config.js';

const mailTransport = nodemailer.createTransport({
  host: EMAIL_SMTP_HOST,
  port: EMAIL_SMTP_PORT,
  secure: EMAIL_SMTP_SECURE,
  auth: EMAIL_SMTP_USER && EMAIL_SMTP_PASS ? { user: EMAIL_SMTP_USER, pass: EMAIL_SMTP_PASS } : undefined
});

function parseEmailFrom(raw) {
  const match = raw.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'Secure Password Manager', email: raw.trim() };
}

export async function sendEmail({ to, subject, text, html }) {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_EMAIL === 'true') {
    // Disable external email delivery during automated tests.
    return;
  }

  if (BREVO_API_KEY) {
    if (BREVO_API_KEY.startsWith('xsmtpsib-') || BREVO_API_KEY.startsWith('smtp')) {
      throw new Error('Brevo API key appears to be an SMTP password. Use a Brevo API key from the Transactional API section, not the SMTP password.');
    }

    const sender = parseEmailFrom(EMAIL_FROM);
    const body = {
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    };

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
        'x-api-key': BREVO_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let message = `Brevo API returned ${resp.status}`;
      try {
        const json = await resp.json();
        if (json && json.message) message = `${message}: ${json.message}`;
      } catch {
        // ignore parse failures
      }
      throw new Error(message);
    }

    return;
  }

  if (SENDGRID_API_KEY) {
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: parseEmailFrom(EMAIL_FROM),
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    };

    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SENDGRID_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let message = `SendGrid API returned ${resp.status}`;
      try {
        const json = await resp.json();
        if (json && json.errors && json.errors.length) {
          message = `${message}: ${json.errors.map((e) => e.message).join(', ')}`;
        }
      } catch {
        // ignore parse failures
      }
      throw new Error(message);
    }

    return;
  }

  if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
    const params = new URLSearchParams();
    const from = parseEmailFrom(EMAIL_FROM);
    params.append('from', `${from.name} <${from.email}>`);
    params.append('to', to);
    params.append('subject', subject);
    params.append('text', text);
    params.append('html', html);

    const resp = await fetch(`${MAILGUN_API_BASE}/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!resp.ok) {
      let message = `Mailgun API returned ${resp.status}`;
      try {
        const json = await resp.json();
        if (json && json.message) message = `${message}: ${json.message}`;
      } catch {
        // ignore parse failures
      }
      throw new Error(message);
    }

    return;
  }

  if (!EMAIL_SMTP_HOST) {
    throw new Error('Email transport is not configured. Set EMAIL_SMTP_HOST in environment or provide BREVO_API_KEY.');
  }

  await mailTransport.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html
  });
}
