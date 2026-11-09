import React from 'react';

export default function RootLoading() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.85rem',
        padding: '2rem',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '3px solid #e2e8f0',
          borderTopColor: '#2563eb',
          animation: 'lbGlobalSpin 0.65s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.01em' }}>
        Loading...
      </span>
      <style>{`
        @keyframes lbGlobalSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
