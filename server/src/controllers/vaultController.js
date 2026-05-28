import { z } from 'zod';
import {
  createVaultItem as dbCreateVaultItem,
  deleteVaultItem as dbDeleteVaultItem,
  listVaultItemsByUser,
  logAuditEvent,
  updateVaultItem as dbUpdateVaultItem
} from '../db.js';
import { newId } from '../security.js';

const VaultItemSchema = z.object({
  name: z.string().min(1).max(200),
  payload: z.object({
    alg: z.literal('AES-256-GCM'),
    iv: z.string().min(1),
    ciphertext: z.string().min(1)
  })
});

export async function listVault(req, res) {
  const items = await listVaultItemsByUser(req.user.id);
  await logAuditEvent({
    userId: req.user.id,
    eventType: 'vault_list',
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
    meta: { count: items.length }
  }).catch(() => {});
  res.json({ items });
}

export async function createVaultItem(req, res) {
  const parsed = VaultItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const item = {
    id: newId('vlt'),
    userId: req.user.id,
    name: parsed.data.name,
    payload: parsed.data.payload
  };
  await dbCreateVaultItem(item);
  await logAuditEvent({
    userId: req.user.id,
    eventType: 'vault_create',
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
    meta: { vaultItemId: item.id }
  }).catch(() => {});
  res.status(201).json({ id: item.id });
}

export async function updateVaultItem(req, res) {
  const parsed = VaultItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const affected = await dbUpdateVaultItem({
    id: req.params.id,
    userId: req.user.id,
    name: parsed.data.name,
    payload: parsed.data.payload
  });
  if (!affected) return res.status(404).json({ error: 'Not found' });
  await logAuditEvent({
    userId: req.user.id,
    eventType: 'vault_update',
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
    meta: { vaultItemId: req.params.id }
  }).catch(() => {});
  res.json({ ok: true });
}

export async function deleteVaultItem(req, res) {
  const affected = await dbDeleteVaultItem({ id: req.params.id, userId: req.user.id });
  if (!affected) return res.status(404).json({ error: 'Not found' });
  await logAuditEvent({
    userId: req.user.id,
    eventType: 'vault_delete',
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
    meta: { vaultItemId: req.params.id }
  }).catch(() => {});
  res.json({ ok: true });
}

