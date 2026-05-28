const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

export async function api(path, init) {
  const r = await fetch(`${API_ORIGIN}${path}`, { ...(init || {}), credentials: 'include' });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = await r.json();
      if (j && j.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return r.json();
}

export async function getCsrfToken() {
  const r = await fetch(`${API_ORIGIN}/api/auth/csrf`, { credentials: 'include' });
  if (!r.ok) throw new Error('Failed to get CSRF token');
  const j = await r.json();
  return j.csrfToken;
}

