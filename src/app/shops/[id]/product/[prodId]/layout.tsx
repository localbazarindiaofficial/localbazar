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
  const fallbackImg = 'https://localbazarindia.vercel.app/app-logo-hd-512.png';

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
        // Resolve 1st image of the product
        let rawImg =
          (foundProd.images && foundProd.images.length > 0 && foundProd.images[0]) ||
          foundProd.image ||
          foundProd.img ||
          shop.image ||
          fallbackImg;

        // Ensure absolute URL (WhatsApp requires absolute https:// URLs)
        let absoluteImgUrl = rawImg;
        if (!absoluteImgUrl.startsWith('http://') && !absoluteImgUrl.startsWith('https://')) {
          absoluteImgUrl = `https://localbazarindia.vercel.app${absoluteImgUrl.startsWith('/') ? '' : '/'}${absoluteImgUrl}`;
        }

        const priceFormatted = foundProd.price
          ? foundProd.price.startsWith('₹')
            ? foundProd.price
            : `₹${foundProd.price}`
          : '';

        const title = `${foundProd.name}${priceFormatted ? ` (${priceFormatted})` : ''} - ${shop.name} | LocalBazar`;
        const description = `Buy ${foundProd.name}${priceFormatted ? ` for ${priceFormatted}` : ''} at ${shop.name}, ${shop.city || 'India'}. Check verified photos, store timings, and customer reviews on LocalBazar.`;
        const pageUrl = `https://localbazarindia.vercel.app/shops/${encodeURIComponent(shopId)}/product/${encodeURIComponent(prodId)}`;

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: pageUrl,
            siteName: 'LocalBazar',
            images: [
              {
                url: absoluteImgUrl,
                width: 1000,
                height: 1000,
                alt: foundProd.name,
              },
            ],
            type: 'website',
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
