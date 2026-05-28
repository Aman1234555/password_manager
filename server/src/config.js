export const PORT = Number(process.env.PORT || 3001);
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'false') === 'true';

export const EMAIL_SMTP_HOST = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST || '';
export const EMAIL_SMTP_PORT = Number(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || 587);
export const EMAIL_SMTP_SECURE = String(process.env.EMAIL_SMTP_SECURE || process.env.SMTP_SECURE || 'false') === 'true';
export const EMAIL_SMTP_USER = process.env.EMAIL_SMTP_USER || process.env.SMTP_USER || '';
export const EMAIL_SMTP_PASS = process.env.EMAIL_SMTP_PASS || process.env.SMTP_PASS || '';
export const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'Secure Password Manager <noreply@example.com>';
export const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
export const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
export const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
export const MAILGUN_API_BASE = process.env.MAILGUN_API_BASE || 'https://api.mailgun.net/v3';
export const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 15);

// Optional: auto-create admin on startup (simple + good for demo).
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';


