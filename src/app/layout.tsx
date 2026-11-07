import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import '@/styles/style.css';
import '@/styles/explore.css';
import '@/styles/listing-detail.css';
import '@/styles/store-category.css';
import '@/styles/auth.css';
import '@/styles/account.css';
import '@/styles/admin.css';
import '@/styles/pwa.css';
import '@/styles/dark-theme.css';
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
  title: 'LocalBazar - Explore Your City',
  description: 'Explore verified local shops, clinics, offices, and services in your city on LocalBazar. Real-time timings, photos, and ratings.',
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
  }
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
                  var saved = localStorage.getItem('lb_theme');
                  if (saved === 'dark') {
                    document.documentElement.classList.add('dark-theme');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }
                  // Auto-clean heavy legacy localStorage keys, leaving ONLY active user session & theme
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
                        if (k !== 'localbazar-pwa-v105') {
                          caches.delete(k);
                        }
                      });
                    }).catch(function() {});
                  }
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('lb_theme');
                  if (saved === 'dark') {
                    document.body.classList.add('dark-theme');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        {children}
        <PwaInstallManager />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(reg) {
                  try { reg.update(); } catch(e) {}
                }).catch(function() {});
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
