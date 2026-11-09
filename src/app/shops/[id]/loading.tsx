export default function ShopLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ height: 220, width: '100%', borderRadius: 16, background: '#e2e8f0', animation: 'lbPulse 1.5s infinite', marginBottom: '1rem' }}></div>
      <div style={{ height: 36, width: '60%', borderRadius: 10, background: '#e2e8f0', animation: 'lbPulse 1.5s infinite', marginBottom: '1rem' }}></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ height: 58, borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', animation: 'lbPulse 1.5s infinite' }}></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'hidden', marginBottom: '1.25rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 72, width: 72, borderRadius: 14, background: '#ffffff', border: '1px solid #e2e8f0', animation: 'lbPulse 1.5s infinite', flexShrink: 0 }}></div>
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
