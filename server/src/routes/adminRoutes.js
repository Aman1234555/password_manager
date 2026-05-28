import express from 'express';
import { authRequired, requireRole } from '../middleware.js';
import { getUserProfile, listSuspicious, listUsers } from '../controllers/adminController.js';

export const adminRoutes = express.Router();

adminRoutes.get('/users', authRequired, requireRole('admin'), listUsers);
adminRoutes.get('/users/:id', authRequired, requireRole('admin'), getUserProfile);
adminRoutes.get('/suspicious', authRequired, requireRole('admin'), listSuspicious);

