import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.localbazarindia.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/manas-pan-admin-login',
        '/manas-pan-login-admin',
        '/api/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
