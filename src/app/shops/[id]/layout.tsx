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
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const id = decodeURIComponent(resolvedParams?.id || '');
  const shop = await getShopData(id);

  if (shop) {
    const name = shop.name || 'Local Shop';
    const category = shop.category || 'Business';
    const city = shop.city || shop.district || 'India';
    const address = shop.address ? ` • ${shop.address}` : '';
    const phone = shop.phone ? ` • Contact: ${shop.phone}` : '';
    
    // Clean and informative description for social preview (WhatsApp, Facebook, Twitter)
    const desc = (shop.desc && shop.desc.trim().length > 10)
      ? `${shop.desc.trim().slice(0, 150)}...`
      : `Visit ${name} (${category}) in ${city}${address}${phone}. Check verified store timings, live photos, catalog & customer reviews on LocalBazar.`;

    // Priority resolution for the listing's real photo
    const rawImg =
      shop.image ||
      (Array.isArray(shop.gallery) && shop.gallery.length > 0 && shop.gallery[0]) ||
      (Array.isArray(shop.images) && shop.images.length > 0 && shop.images[0]) ||
      (Array.isArray(shop.banners) && shop.banners.length > 0 && shop.banners[0]) ||
      shop.bannerUrl ||
      shop.imageUrl ||
      shop.logoUrl ||
      'https://www.localbazarindia.com/icon-512.png';

    // Ensure absolute URL (WhatsApp and Facebook strictly require absolute https:// URLs)
    let absoluteImgUrl = String(rawImg || '').trim();
    if (absoluteImgUrl && !absoluteImgUrl.startsWith('http://') && !absoluteImgUrl.startsWith('https://')) {
      absoluteImgUrl = `https://www.localbazarindia.com${absoluteImgUrl.startsWith('/') ? '' : '/'}${absoluteImgUrl}`;
    }
    if (!absoluteImgUrl) {
      absoluteImgUrl = 'https://www.localbazarindia.com/icon-512.png';
    }

    const shareTitle = `${name} - ${category} in ${city} | LocalBazar`;
    const shopUrl = `https://www.localbazarindia.com/shops/${encodeURIComponent(id)}`;

    return {
      title: `${name} - Best ${category} in ${city} | LocalBazar`,
      description: desc,
      keywords: [name, category, `${category} in ${city}`, `${city} shops`, 'LocalBazar'],
      openGraph: {
        title: shareTitle,
        description: desc,
        url: shopUrl,
        siteName: 'LocalBazar',
        locale: 'en_IN',
        type: 'website',
        images: [
          {
            url: absoluteImgUrl,
            width: 1200,
            height: 630,
            alt: name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: shareTitle,
        description: desc,
        images: [absoluteImgUrl],
      },
    };
  }

  return {
    title: 'Local Shop Details | LocalBazar',
    description: 'Explore verified local shops, doctors, and services on LocalBazar.',
    openGraph: {
      title: 'Local Shop Details | LocalBazar',
      description: 'Explore verified local shops, doctors, and services on LocalBazar.',
      images: [{ url: 'https://www.localbazarindia.com/icon-512.png', width: 512, height: 512, alt: 'LocalBazar' }],
    },
    twitter: {
      card: 'summary',
      title: 'Local Shop Details | LocalBazar',
      description: 'Explore verified local shops, doctors, and services on LocalBazar.',
      images: ['https://www.localbazarindia.com/icon-512.png'],
    },
  };
}

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = decodeURIComponent(resolvedParams?.id || '');
  let jsonLd: Record<string, any> | null = null;

  const s = await getShopData(id);
  if (s) {
    const rawImg =
      s.image ||
      (Array.isArray(s.gallery) && s.gallery.length > 0 && s.gallery[0]) ||
      (Array.isArray(s.images) && s.images.length > 0 && s.images[0]) ||
      (Array.isArray(s.banners) && s.banners.length > 0 && s.banners[0]) ||
      s.bannerUrl ||
      s.imageUrl ||
      s.logoUrl ||
      'https://www.localbazarindia.com/icon-512.png';

    let absoluteImgUrl = String(rawImg || '').trim();
    if (absoluteImgUrl && !absoluteImgUrl.startsWith('http://') && !absoluteImgUrl.startsWith('https://')) {
      absoluteImgUrl = `https://www.localbazarindia.com${absoluteImgUrl.startsWith('/') ? '' : '/'}${absoluteImgUrl}`;
    }

    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: s.name || 'Local Shop',
      image: absoluteImgUrl,
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
