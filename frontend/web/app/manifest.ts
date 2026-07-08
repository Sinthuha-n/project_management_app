import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Planora - Plan, Track, Ship',
    short_name: 'Planora',
    description: 'Planora is a project management platform for modern teams.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#155DFC',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
