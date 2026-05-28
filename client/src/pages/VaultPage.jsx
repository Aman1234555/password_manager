import React, { useMemo, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { Field } from '../components/Field.jsx';
import { api, getCsrfToken } from '../lib/api.js';
import { decryptJson, encryptJson } from '../lib/crypto.js';

export function VaultPage({ cryptoKey, items, setItems, setMsg }) {
  const [selectedId, setSelectedId] = useState(null);
  const [entryName, setEntryName] = useState('');
  const [site, setSite] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [csrf, setCsrf] = useState('');

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  async function loadVault() {
    try {
      const v = await api('/api/vault');
      setItems(v.items);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function selectItem(id) {
    try {
      setSelectedId(id);
      const item = items.find((i) => i.id === id);
      if (!item) return;
      if (!cryptoKey) return setMsg('Session key missing. Login again.');

      const plain = await decryptJson(cryptoKey, item.payload);
      setEntryName(item.name);
      setSite(String(plain.site || ''));
      setUsername(String(plain.username || ''));
      setSecret(String(plain.password || ''));
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function saveNew() {
    try {
      setMsg('');
      if (!cryptoKey) return setMsg('Login again (crypto key missing).');
      const csrfToken = csrf || (await getCsrfToken());
      setCsrf(csrfToken);

      const payload = await encryptJson(cryptoKey, { site, username, password: secret });
      const created = await api('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ name: entryName || 'Untitled', payload })
      });
      await loadVault();
      setSelectedId(created.id);
      setMsg('Saved.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function updateSelected() {
    try {
      setMsg('');
      if (!selected) return;
      if (!cryptoKey) return setMsg('Login again (crypto key missing).');
      const csrfToken = csrf || (await getCsrfToken());
      setCsrf(csrfToken);

      const payload = await encryptJson(cryptoKey, { site, username, password: secret });
      await api(`/api/vault/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ name: entryName || 'Untitled', payload })
      });
      await loadVault();
      setMsg('Updated.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteSelected() {
    try {
      setMsg('');
      if (!selected) return;
      const csrfToken = csrf || (await getCsrfToken());
      setCsrf(csrfToken);
      await api(`/api/vault/${selected.id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': csrfToken } });
      await loadVault();
      setSelectedId(null);
      setEntryName('');
      setSite('');
      setUsername('');
      setSecret('');
      setMsg('Deleted.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret);
    setMsg('Copied to clipboard (will clear in 20s).');
    window.setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch {
        // ignore
      }
    }, 20_000);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
      <div style={{ border: '1.5px solid #e0e0e0', borderRadius: 12, background: '#fff', boxShadow: '0 1px 8px #0001' }}>
        <div style={{ padding: 12, borderBottom: '1.5px solid #e0e0e0', fontWeight: 600, background: '#f7f8fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>Vault</div>
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          <Button
            onClick={() => {
              setSelectedId(null);
              setEntryName('');
              setSite('');
              setUsername('');
              setSecret('');
              setMsg('');
            }}
          >
            + New entry
          </Button>
          <div style={{ display: 'grid', gap: 6 }}>
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => void selectItem(it.id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1.5px solid #e0e0e0',
                  background: it.id === selectedId ? '#e3e8f0' : '#fff',
                  color: '#222',
                  cursor: 'pointer',
                  fontWeight: it.id === selectedId ? 600 : 400
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{new Date(it.updatedAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: '1.5px solid #e0e0e0', borderRadius: 12, background: '#fff', boxShadow: '0 1px 8px #0001' }}>
        <div style={{ padding: 12, borderBottom: '1.5px solid #e0e0e0', fontWeight: 600, background: '#f7f8fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          {selected ? 'Edit entry' : 'New entry'}
        </div>
        <div style={{ padding: 12, display: 'grid', gap: 12 }}>
          <Field label="Entry name" value={entryName} onChange={setEntryName} autoComplete="off" />
          <Field label="Website" value={site} onChange={setSite} autoComplete="off" />
          <Field label="Username" value={username} onChange={setUsername} autoComplete="off" />
          <Field label="Password" type="password" value={secret} onChange={setSecret} autoComplete="off" />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {selected ? (
              <>
                <Button onClick={updateSelected}>Save changes</Button>
                <Button onClick={deleteSelected} style={{ borderColor: '#e53935', color: '#e53935', background: '#fff' }}>
                  Delete
                </Button>
              </>
            ) : (
              <Button onClick={saveNew}>Save entry</Button>
            )}
            <Button onClick={copySecret} style={{ opacity: 0.9 }}>
              Copy password
            </Button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
            Security UX: clipboard is cleared after 20 seconds.
          </div>
        </div>
      </div>
    </div>
  );
}

