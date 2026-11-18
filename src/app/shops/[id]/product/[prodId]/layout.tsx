import type { Metadata } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Listing, ProductItem } from '@/types';

type LayoutProps = {
  params: { id: string; prodId: string } | Promise<{ id: string; prodId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata(props: LayoutProps): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(props.params);
  const shopId = decodeURIComponent(resolvedParams?.id || '');
  const prodId = decodeURIComponent(resolvedParams?.prodId || '');

  const fallbackTitle = 'Product Details | LocalBazar';
  const fallbackDesc = 'Explore genuine products and verified local businesses on LocalBazar.';
  const fallbackImg = 'https://www.localbazarindia.com/icon-512.png';

  if (!shopId) {
    return {
      title: fallbackTitle,
      description: fallbackDesc,
    };
  }

  try {
    const docRef = doc(db, 'listings', String(shopId));
    // Fast 850ms timeout race so serverless Firestore never freezes or delays client page transition
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 850));
    const snap = await Promise.race([getDoc(docRef), timeoutPromise]);

    if (snap && snap.exists()) {
      const shop = snap.data() as Listing;
      const prods = (shop.products && Array.isArray(shop.products)) ? shop.products : [];

      const target = prodId.toLowerCase();
      const foundProd = prods.find((p: ProductItem) => {
        const pId = String(p.id || '').toLowerCase();
        const pName = String(p.name || '').toLowerCase();
        return pId === target || pName === target || encodeURIComponent(pName) === target;
      });

      if (foundProd) {
        // Resolve 1st image of the product, with cascading fallback to shop's own images
        const rawImg =
          (foundProd.images && foundProd.images.length > 0 && foundProd.images[0]) ||
          foundProd.image ||
          foundProd.img ||
          shop.image ||
          (Array.isArray(shop.gallery) && shop.gallery.length > 0 && shop.gallery[0]) ||
          (Array.isArray(shop.images) && shop.images.length > 0 && shop.images[0]) ||
          (Array.isArray(shop.banners) && shop.banners.length > 0 && shop.banners[0]) ||
          fallbackImg;

        // Ensure absolute URL (WhatsApp and Facebook strictly require absolute https:// URLs)
        let absoluteImgUrl = String(rawImg || '').trim();
        if (absoluteImgUrl && !absoluteImgUrl.startsWith('http://') && !absoluteImgUrl.startsWith('https://')) {
          absoluteImgUrl = `https://www.localbazarindia.com${absoluteImgUrl.startsWith('/') ? '' : '/'}${absoluteImgUrl}`;
        }
        if (!absoluteImgUrl) {
          absoluteImgUrl = fallbackImg;
        }

        const priceFormatted = foundProd.price
          ? foundProd.price.startsWith('₹')
            ? foundProd.price
            : `₹${foundProd.price}`
          : '';

        const title = `${foundProd.name}${priceFormatted ? ` (${priceFormatted})` : ''} - ${shop.name} | LocalBazar`;
        const description = `Buy ${foundProd.name}${priceFormatted ? ` for ${priceFormatted}` : ''} at ${shop.name}, ${shop.city || 'India'}. Check verified photos, store timings, and customer reviews on LocalBazar.`;
        const pageUrl = `https://www.localbazarindia.com/shops/${encodeURIComponent(shopId)}/product/${encodeURIComponent(prodId)}`;

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: pageUrl,
            siteName: 'LocalBazar',
            locale: 'en_IN',
            type: 'website',
            images: [
              {
                url: absoluteImgUrl,
                width: 1000,
                height: 1000,
                alt: foundProd.name,
              },
            ],
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [absoluteImgUrl],
          },
        };
      }
    }
  } catch (err) {
    console.warn('Error generating product metadata:', err);
  }

  return {
    title: fallbackTitle,
    description: fallbackDesc,
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
