import express from 'express';
import { authRequired, csrfProtection } from '../middleware.js';
import { createVaultItem, deleteVaultItem, listVault, updateVaultItem } from '../controllers/vaultController.js';

export const vaultRoutes = express.Router();

vaultRoutes.get('/', authRequired, listVault);
vaultRoutes.post('/', authRequired, csrfProtection, createVaultItem);
vaultRoutes.put('/:id', authRequired, csrfProtection, updateVaultItem);
vaultRoutes.delete('/:id', authRequired, csrfProtection, deleteVaultItem);

