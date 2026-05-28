import 'dotenv/config';

import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { ADMIN_EMAIL, ADMIN_PASSWORD, CLIENT_ORIGIN, COOKIE_SECURE } from './config.js';
import { createUser, getUserByEmail } from './db.js';
import { apiLimiter } from './middleware.js';
import { newId } from './security.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { vaultRoutes } from './routes/vaultRoutes.js';

export async function ensureAdminUser() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const exists = await getUserByEmail(ADMIN_EMAIL);
  if (exists) return;

  const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const user = {
    id: newId('usr'),
    firstName: 'Admin',
    lastName: 'User',
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
    kdfSalt: Buffer.from('admin-salt-not-used').toString('base64')
  };
  await createUser(user);
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' }
    })
  );

  app.use(
    cors({
      origin: CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token']
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/vault', vaultRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((err, _req, res, _next) => {
    // Log full error server-side for debugging/evidence.
    console.error(err);
    if (err?.code === 'EBADCSRFTOKEN') return res.status(403).json({ error: 'Bad CSRF token' });
    return res.status(500).json({ error: 'Server error' });
  });

  return app;
}

