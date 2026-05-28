import React, { useEffect, useState } from 'react';
import { Button } from './components/Button.jsx';
import { api, getCsrfToken } from './lib/api.js';
import { deriveKey } from './lib/crypto.js';
import { AuthPage } from './pages/AuthPage.jsx';
import { VaultPage } from './pages/VaultPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

export function App() {
  const [me, setMe] = useState(null);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('vault'); // vault | admin
  const [msg, setMsg] = useState('');

  async function refreshMe(masterPassword) {
    const m = await api('/api/auth/me');
    setMe(m);
    if (masterPassword) {
      const k = await deriveKey(masterPassword, m.kdfSalt);
      setCryptoKey(k);
    }
  }

  async function loadVault() {
    const v = await api('/api/vault');
    setItems(v.items);
  }

  useEffect(() => {
    // Warm CSRF cookie early.
    getCsrfToken().catch(() => {});
  }, []);

  async function onLoggedIn({ masterPassword }) {
    try {
      await refreshMe(masterPassword);
      await loadVault();
      setTab('vault');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function doLogout() {
    setMsg('');
    const csrf = await getCsrfToken();
    await api('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf } });
    setMe(null);
    setCryptoKey(null);
    setItems([]);
    setTab('vault');
  }

  const isAuthed = Boolean(me);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f8fa',
        color: '#222',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        display: 'grid',
        placeItems: 'center',
        padding: 24
      }}
    >
      <div style={{ width: 'min(980px, 100%)', display: 'grid', gap: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px #0001', padding: '16px 20px', marginBottom: 8 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontWeight: 700, letterSpacing: 0.2, fontSize: 20 }}>Secure Password Manager</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Client-side AES-GCM vault encryption • Argon2 login • CSRF • Rate limiting • Audit logs
            </div>
          </div>
          {isAuthed ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{me.email}</div>
              <Button onClick={doLogout} style={{ background: '#f5f5f5', color: '#222' }}>Logout</Button>
            </div>
          ) : null}
        </header>

        {msg ? (
          <div style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, background: '#ffeaea', color: '#b00', marginBottom: 8 }}>
            {msg}
          </div>
        ) : null}

        {!isAuthed ? (
          <AuthPage
            onLoggedIn={async (x) => {
              try {
                await onLoggedIn(x);
              } catch (e) {
                setMsg(e.message);
              }
            }}
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px #0001', padding: '8px 12px' }}>
              <Button onClick={() => setTab('vault')} style={{ background: tab === 'vault' ? '#e3e8f0' : '#f5f5f5', color: '#222' }}>
                Vault
              </Button>
              {me.role === 'admin' ? (
                <Button onClick={() => setTab('admin')} style={{ background: tab === 'admin' ? '#e3e8f0' : '#f5f5f5', color: '#222' }}>
                  Admin
                </Button>
              ) : null}
            </div>

            {tab === 'admin' ? (
              <AdminPage setMsg={setMsg} />
            ) : (
              <VaultPage cryptoKey={cryptoKey} items={items} setItems={setItems} setMsg={setMsg} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

