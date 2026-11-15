import { cache } from 'react';
import type { Metadata } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Deduplicate server-side Firestore fetch between generateMetadata and ShopLayout
const getShopData = cache(async (id: string) => {
  try {
    const snap = await getDoc(doc(db, 'listings', id));
    if (snap.exists()) {
      return snap.data();
    }
  } catch {}
  return null;
});

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = decodeURIComponent(params.id || '');
  const shop = await getShopData(id);
  if (shop) {
    const name = shop.name || 'Local Shop';
    const category = shop.category || 'Business';
    const city = shop.city || shop.district || 'India';
    const desc = shop.desc || shop.description || `Visit ${name} in ${city}. Check verified store timings, address, catalog & reviews on LocalBazar.`;
    const img = shop.bannerUrl || shop.imageUrl || shop.logoUrl || 'https://www.localbazarindia.com/icon-512.png';

    return {
      title: `${name} - Best ${category} in ${city} | LocalBazar`,
      description: desc.slice(0, 160),
      keywords: [name, category, `${category} in ${city}`, `${city} shops`, 'LocalBazar'],
      openGraph: {
        title: `${name} - ${category} in ${city}`,
        description: desc.slice(0, 160),
        url: `https://www.localbazarindia.com/shops/${encodeURIComponent(id)}`,
        images: [{ url: img, width: 800, height: 600, alt: name }],
      },
    };
  }

  return {
    title: 'Local Shop Details | LocalBazar',
    description: 'Explore verified local shops, doctors, and services on LocalBazar.',
  };
}

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id || '');
  let jsonLd: Record<string, any> | null = null;

  const s = await getShopData(id);
  if (s) {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: s.name || 'Local Shop',
      image: s.bannerUrl || s.imageUrl || s.logoUrl || 'https://www.localbazarindia.com/icon-512.png',
      telephone: s.phone || s.contactPhone || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: s.address || undefined,
        addressLocality: s.city || s.district || 'India',
        addressRegion: s.state || 'West Bengal',
        postalCode: s.pincode || s.pinCode || undefined,
        addressCountry: 'IN',
      },
      url: `https://www.localbazarindia.com/shops/${encodeURIComponent(id)}`,
      priceRange: s.priceRange || '₹₹',
    };

    if (s.rating && Number(s.rating) > 0) {
      jsonLd.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: String(s.rating),
        reviewCount: String(s.ratingCount || s.reviewsCount || 1),
      };
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
