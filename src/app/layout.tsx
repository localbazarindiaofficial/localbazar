import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import '@/styles/style.css';
import '@/styles/pwa.css';
import PwaInstallManager from '@/components/PwaInstallManager';
import NavigationProgressBar from '@/components/NavigationProgressBar';

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.localbazarindia.com'),
  title: {
    default: 'LocalBazar - Explore Your City | Local Shops, Doctors & Services',
    template: '%s | LocalBazar',
  },
  description: 'Explore verified local shops, clinics, offices, and services in your city on LocalBazar. Real-time timings, photos, and ratings.',
  keywords: [
    'LocalBazar',
    'LocalBazar India',
    'localbazarindia',
    'localbazar',
    'localbajar',
    'localbazzar',
    'local bazar app',
    'local shopping app India',
    'shop near me',
    'local shop near me',
    'best shops near me',
    'dokan near me',
    'best dokan in my town',
    'online shop',
    'online marketplace near me',
    'verified local business near me',
    'local business directory India',
    'local business directory West Bengal',
    'local shop contact number',
    'Grocery Store near me',
    'Clothing & Garments near me',
    'Footwear near me',
    'Jewellery Shop near me',
    'Books & Stationery near me',
    'Stationery & Variety Store near me',
    'Furniture Dokan near me',
    'Electrical & Electronics near me',
    'Mobile Store near me',
    'Bike Showroom near me',
    'Car Showroom near me',
    'Pharmacy & Medical Store near me',
    '24 hours pharmacy near me',
    'Hospital near me',
    'Doctor clinic near me',
    'Dentist & dental clinic near me',
    'Child specialist near me',
    'Eye clinic & optical shop near me',
    'chashmar dokan near me',
    'Pathology & Diagnostic Lab near me',
    'Blood test center near me',
    'Ambulance service near me',
    'Veterinary doctor & pet shop near me',
    'Restaurant & Foods near me',
    'Fast Food Center near me',
    'Sweets Shop near me',
    'Bakery & Cake Shop near me',
    'Tea Shop & Cafe near me',
    'Biryani hotel near me',
    'Fish market near me',
    'macher bazar near me',
    'Chicken & Mutton shop near me',
    'Vegetable market & sabji bazar near me',
    'Beauty Parlour near me',
    'Men\'s Saloon & Parlour near me',
    'Gym & Fitness center near me',
    'Ladies tailor & boutique near me',
    'Dry cleaner & laundry near me',
    'Photo studio & wedding photographer near me',
    'Catering service near me',
    'Tent house & sound box near me',
    'Flower shop & puja samagri near me',
    'Mobile repair shop near me',
    'display touch replacement near me',
    'laptop & computer repair near me',
    'AC service & repair near me',
    'fridge & washing machine repair near me',
    'bike mechanic & garage near me',
    'car mechanic near me',
    'puncture dokan near me',
    'electrician near me',
    'plumber near me',
    'carpenter near me',
    'painter near me',
    'cctv camera installation near me',
    'teacher near me',
    'tutor near me',
    'developer near me',
    'web developer near me',
    'cyber cafe near me',
    'xerox & printout shop near me',
    'online form fill up center near me',
    'bank near me',
    'ATM cash deposit near me',
    'courier service near me',
    'gas cylinder agency near me'
  ],
  authors: [{ name: 'LocalBazar Team' }],
  creator: 'LocalBazar',
  publisher: 'LocalBazar',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.png', sizes: '64x64', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' }
    ]
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://www.localbazarindia.com',
    siteName: 'LocalBazar',
    title: 'LocalBazar - Explore Your City',
    description: 'Explore verified local shops, clinics, offices, and services in your city on LocalBazar. Real-time timings, photos, and ratings.',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'LocalBazar Logo' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'HgOnruGg3u6gNFIp0H302UKqTFZ7CJ6rTIfy751eZDw',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  try {
                    localStorage.removeItem('lb_theme');
                    document.documentElement.classList.remove('dark-theme');
                    document.documentElement.removeAttribute('data-theme');
                  } catch(e) {}

                  // Defer heavy storage/cache cleanup to idle time so first paint is instant (0ms)
                  var deferCleanup = window.requestIdleCallback || function(cb) { setTimeout(cb, 1500); };
                  deferCleanup(function() {
                    try {
                      var heavyKeys = [
                        'lb_listings', 'lb_users', 'lb_user_listings', 'lb_empty_store_banners',
                        'lb_home_banners', 'lb_target_news_banners', 'lb_news_ticker',
                        'lb_listing_claims', 'lb_trust_requests', 'lb_trust_badge_settings',
                        'lb_mail', 'lb_city_requests', 'lb_category_requests', 'lb_cities',
                        'lb_categories', 'lb_news'
                      ];
                      for (var i = 0; i < heavyKeys.length; i++) {
                        try { localStorage.removeItem(heavyKeys[i]); } catch(e) {}
                      }
                      for (var j = localStorage.length - 1; j >= 0; j--) {
                        var k = localStorage.key(j);
                        if (k && (k.indexOf('lb_reviews_') === 0 || k.indexOf('lb_store_inbox_') === 0 || k.indexOf('lb_prod_reviews_') === 0)) {
                          try { localStorage.removeItem(k); } catch(e) {}
                        }
                      }
                      if ('caches' in window) {
                        caches.keys().then(function(keys) {
                          keys.forEach(function(k) {
                            if (k !== 'localbazar-pwa-v108') {
                              caches.delete(k);
                            }
                          });
                        }).catch(function() {});
                      }
                    } catch(e) {}
                  });
                } catch(e) {}
              })();
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body suppressHydrationWarning>
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        {children}
        <PwaInstallManager />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(reg) {
                  setTimeout(function() {
                    try { reg.update(); } catch(e) {}
                  }, 3500);
                }).catch(function() {});
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
