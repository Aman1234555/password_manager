import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';

function base64url(buf) {
  return buf
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function newId(prefix) {
  return `${prefix}_${base64url(crypto.randomBytes(16))}`;
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

