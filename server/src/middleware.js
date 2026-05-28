import csurf from 'csurf';
import rateLimit from 'express-rate-limit';
import { COOKIE_SECURE } from './config.js';
import { logAuditEvent } from './db.js';
import { verifyAccessToken } from './security.js';

export function cookieOpts() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    path: '/'
  };
}

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res, _next, options) => {
    await logAuditEvent({
      userId: req.user?.id || null,
      eventType: 'rate_limited',
      isSuspicious: true,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      meta: { path: req.path, limit: options.limit, windowMs: options.windowMs }
    }).catch(() => {});
    res.status(429).json(options.message || { error: 'Too many requests' });
  }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
  handler: async (req, res, _next, options) => {
    await logAuditEvent({
      userId: null,
      eventType: 'login_rate_limited',
      isSuspicious: true,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      meta: { path: req.path, limit: options.limit, windowMs: options.windowMs }
    }).catch(() => {});
    res.status(429).json(options.message || { error: 'Too many login attempts' });
  }
});

export const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict'
  }
});

export function authRequired(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

