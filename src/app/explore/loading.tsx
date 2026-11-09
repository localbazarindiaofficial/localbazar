export default function ExploreLoading() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ height: 50, width: '100%', borderRadius: 12, marginBottom: '1.25rem', background: '#e2e8f0', animation: 'lbPulse 1.5s infinite' }}></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ height: 92, width: '100%', borderRadius: 14, background: '#ffffff', border: '1px solid #e2e8f0', animation: 'lbPulse 1.5s infinite' }}></div>
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
