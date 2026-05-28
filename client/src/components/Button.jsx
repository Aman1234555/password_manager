import React from 'react';

export function Button(props) {
  return (
    <button
      {...props}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1.5px solid #bbb',
        background: '#f5f5f5',
        color: '#222',
        fontWeight: 500,
        fontSize: 15,
        cursor: 'pointer',
        transition: 'background 0.2s',
        ...((props.style || {}) && props.style)
      }}
    />
  );
}

