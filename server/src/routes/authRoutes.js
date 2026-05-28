import express from 'express';
import { loginLimiter, csrfProtection, authRequired } from '../middleware.js';
import { login, verifyLoginOtp, logout, me, register } from '../controllers/authController.js';

export const authRoutes = express.Router();

authRoutes.get('/csrf', csrfProtection, (req, res) => res.json({ csrfToken: req.csrfToken() }));
authRoutes.post('/register', csrfProtection, register);
authRoutes.post('/login', loginLimiter, csrfProtection, login);
authRoutes.post('/login/verify', loginLimiter, csrfProtection, verifyLoginOtp);
authRoutes.post('/logout', authRequired, csrfProtection, logout);
authRoutes.get('/me', authRequired, me);

