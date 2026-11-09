export default function CatalogLoading() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ height: 52, width: '100%', borderRadius: 12, marginBottom: '1rem', background: '#e2e8f0', animation: 'lbPulse 1.5s infinite' }}></div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'hidden' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 36, width: 110, borderRadius: 999, background: '#ffffff', border: '1px solid #e2e8f0', animation: 'lbPulse 1.5s infinite', flexShrink: 0 }}></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 210, borderRadius: 14, background: '#ffffff', border: '1px solid #e2e8f0', animation: 'lbPulse 1.5s infinite' }}></div>
        ))}
      </div>
      <style>{`
        @keyframes lbPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
