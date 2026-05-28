import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { api } from '../lib/api.js';

export function AdminPage({ setMsg }) {
  const [users, setUsers] = useState([]);
  const [suspicious, setSuspicious] = useState([]);

  async function load() {
    setMsg('');
    const u = await api('/api/admin/users');
    setUsers(u.users || []);
    const s = await api('/api/admin/suspicious');
    setSuspicious(s.events || []);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ border: '1.5px solid #e0e0e0', borderRadius: 12, background: '#fff', boxShadow: '0 1px 8px #0001' }}>
        <div style={{ padding: 12, borderBottom: '1.5px solid #e0e0e0', fontWeight: 600, background: '#f7f8fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>Users</div>
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          <Button onClick={() => load().catch((e) => setMsg(e.message))} style={{ width: 'fit-content' }}>
            Refresh
          </Button>
          <div style={{ display: 'grid', gap: 6 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', background: '#fff' }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.email}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  id: {u.id} • role: {u.role}
                </div>
              </div>
            ))}
            {users.length === 0 ? <div style={{ opacity: 0.7 }}>No users found.</div> : null}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
            Admin can view users and suspicious events, but cannot view passwords because vault items are stored as ciphertext.
          </div>
        </div>
      </div>

      <div style={{ border: '1.5px solid #e0e0e0', borderRadius: 12, background: '#fff', boxShadow: '0 1px 8px #0001' }}>
        <div style={{ padding: 12, borderBottom: '1.5px solid #e0e0e0', fontWeight: 600, background: '#f7f8fa', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>Suspicious activity</div>
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {suspicious.map((e) => (
              <div
                key={e.id}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', background: '#fff' }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{e.eventType}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  userId: {e.userId || 'n/a'} • ip: {e.ip || 'n/a'}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{new Date(e.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {suspicious.length === 0 ? <div style={{ opacity: 0.7 }}>No suspicious events yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

