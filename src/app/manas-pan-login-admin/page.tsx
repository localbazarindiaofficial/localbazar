'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyAdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/manas-pan-admin-login');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ width: 40, height: 40, border: '3.5px solid #334155', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
      <style>{`@keyframes lbSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
