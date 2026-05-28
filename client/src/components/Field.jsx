import React from 'react';

export function Field({ label, type, value, onChange, autoComplete, error, right, disabled }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type={type || 'text'}
          value={value}
          autoComplete={autoComplete}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: error ? '1.5px solid #e53935' : '1.5px solid #bbb',
            background: disabled ? '#f1f1f1' : '#fff',
            color: '#222',
            width: '100%',
            fontSize: 15,
            outline: error ? '1.5px solid #e53935' : undefined
          }}
        />
        {right ? (
          <span style={{ position: 'absolute', right: 10 }}>{right}</span>
        ) : null}
      </div>
      {error ? <span style={{ color: '#e53935', fontSize: 12, marginTop: 2 }}>{error}</span> : null}
    </label>
  );
}

