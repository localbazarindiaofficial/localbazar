export default function ProductLoading() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ height: 260, width: '100%', borderRadius: 16, background: '#e2e8f0', animation: 'lbPulse 1.5s infinite', marginBottom: '1rem' }}></div>
      <div style={{ height: 32, width: '70%', borderRadius: 8, background: '#e2e8f0', animation: 'lbPulse 1.5s infinite', marginBottom: '0.75rem' }}></div>
      <div style={{ height: 24, width: '40%', borderRadius: 8, background: '#e2e8f0', animation: 'lbPulse 1.5s infinite', marginBottom: '1.5rem' }}></div>
      <div style={{ height: 50, width: '100%', borderRadius: 12, background: '#e2e8f0', animation: 'lbPulse 1.5s infinite' }}></div>
      <style>{`
        @keyframes lbPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
