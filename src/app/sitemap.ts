import { MetadataRoute } from 'next';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.localbazarindia.com';

  // 1. Core static platform routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // 2. Dynamically pull all live shops from Cloud Firestore
  try {
    const snap = await getDocs(collection(db, 'listings'));
    const shopRoutes: MetadataRoute.Sitemap = [];

    snap.forEach((d) => {
      const data = d.data();
      const shopId = d.id;
      if (shopId) {
        shopRoutes.push({
          url: `${baseUrl}/shops/${encodeURIComponent(shopId)}`,
          lastModified: data?.updatedAt ? new Date(data.updatedAt) : new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    });

    return [...staticRoutes, ...shopRoutes];
  } catch {
    return staticRoutes;
  }
}
