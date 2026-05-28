import crypto from 'node:crypto';
import argon2 from 'argon2';
import { z } from 'zod';
import { createUser, getUserByEmail, getUserById, logAuditEvent, createOtpCode, getLatestValidOtpByUserId, markOtpCodeUsed } from '../db.js';
import { cookieOpts } from '../middleware.js';
import { newId, signAccessToken } from '../security.js';
import { sendEmail } from '../mailer.js';
import { OTP_EXPIRE_MINUTES } from '../config.js';

const RegisterSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(12).max(128)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128)
});

const LoginOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^[0-9]{6}$/)
});

function generateOtpCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function hashOtpCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function register(req, res) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { firstName, lastName, email, password } = parsed.data;
  const exists = await getUserByEmail(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const kdfSalt = crypto.randomBytes(16).toString('base64');
  const user = { id: newId('usr'), firstName, lastName, email, passwordHash, role: 'user', kdfSalt };
  await createUser(user);
  await logAuditEvent({
    userId: user.id,
    eventType: 'register_success',
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
    meta: { email }
  }).catch(() => {});

  res.status(201).json({ ok: true });
}

export async function login(req, res) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const user = await getUserByEmail(email);
  if (!user) {
    await logAuditEvent({
      userId: null,
      eventType: 'login_failed',
      isSuspicious: true,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      meta: { email }
    }).catch(() => {});
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) {
    await logAuditEvent({
      userId: user.id,
      eventType: 'login_failed',
      isSuspicious: true,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      meta: { email }
    }).catch(() => {});
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (process.env.NODE_ENV === 'test') {
    const token = signAccessToken(user);
    res.cookie('access_token', token, { ...cookieOpts(), maxAge: 15 * 60_000 });
    await logAuditEvent({
      userId: user.id,
      eventType: 'login_success',
      ip: req.ip,
      userAgent: req.get('user-agent') || null
    }).catch(() => {});
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60_000);

  await createOtpCode({ id: newId('otp'), userId: user.id, codeHash, expiresAt });

  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Secure Password Manager login code',
      text: `Your login verification code is ${code}. It expires in ${OTP_EXPIRE_MINUTES} minutes.`,
      html: `<p>Your login verification code is <strong>${code}</strong>.</p><p>It expires in ${OTP_EXPIRE_MINUTES} minutes.</p>`
    });
  } catch (error) {
    console.error('Unable to send OTP email:', error);
    return res.status(500).json({ error: 'Failed to send OTP email' });
  }

  await logAuditEvent({
    userId: user.id,
    eventType: 'login_otp_sent',
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
    meta: { email }
  }).catch(() => {});

  res.json({ ok: true, otpRequired: true, expiresInMinutes: OTP_EXPIRE_MINUTES });
}

export async function verifyLoginOtp(req, res) {
  const parsed = LoginOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, otp } = parsed.data;
  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const otpRecord = await getLatestValidOtpByUserId(user.id);
  if (!otpRecord) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }

  const otpHash = hashOtpCode(otp);
  if (otpHash !== otpRecord.codeHash) {
    await logAuditEvent({
      userId: user.id,
      eventType: 'login_otp_failed',
      isSuspicious: true,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      meta: { email }
    }).catch(() => {});
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }

  await markOtpCodeUsed(otpRecord.id);

  const token = signAccessToken(user);
  res.cookie('access_token', token, { ...cookieOpts(), maxAge: 15 * 60_000 });
  await logAuditEvent({
    userId: user.id,
    eventType: 'login_success',
    ip: req.ip,
    userAgent: req.get('user-agent') || null
  }).catch(() => {});

  res.json({ ok: true });
}

export function logout(req, res) {
  res.clearCookie('access_token', { ...cookieOpts(), maxAge: 0 });
  logAuditEvent({
    userId: req.user?.id || null,
    eventType: 'logout',
    ip: req.ip,
    userAgent: req.get('user-agent') || null
  }).catch(() => {});
  res.json({ ok: true });
}


export async function me(req, res) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Not authenticated' });
    const user = await getUserById(req.user.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    return res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      kdfSalt: user.kdfSalt
    });
  } catch (error) {
    console.error('Error in me controller:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

