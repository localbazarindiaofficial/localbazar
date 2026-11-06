'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function StoreCategoryRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get('id') || '';
    const cat = searchParams.get('cat') || '';
    const prod = searchParams.get('product') || searchParams.get('prod') || '';

    if (id) {
      let url = `/shops/${encodeURIComponent(id)}/catalog`;
      const queryParts: string[] = [];
      if (cat) queryParts.push(`cat=${encodeURIComponent(cat)}`);
      if (prod) queryParts.push(`product=${encodeURIComponent(prod)}`);
      if (queryParts.length > 0) {
        url += `?${queryParts.join('&')}`;
      }
      router.replace(url);
    } else {
      router.replace('/explore');
    }
  }, [router, searchParams]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 40, height: 40, border: '3.5px solid #e2e8f0', borderTopColor: '#1a73e8', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
      <style>{`@keyframes lbSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function StoreCategoryRedirect() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: 40, height: 40, border: '3.5px solid #e2e8f0', borderTopColor: '#1a73e8', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
      </div>
    }>
      <StoreCategoryRedirectContent />
    </Suspense>
  );
}
