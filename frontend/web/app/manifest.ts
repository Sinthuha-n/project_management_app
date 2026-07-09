import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
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
    screenshots: [
      {
        src: '/screenshots/planora-dashboard-wide.svg',
        sizes: '1280x720',
        type: 'image/svg+xml',
        form_factor: 'wide',
        label: 'Planora dashboard on desktop',
      },
      {
        src: '/screenshots/planora-dashboard-mobile.svg',
        sizes: '390x844',
        type: 'image/svg+xml',
        form_factor: 'narrow',
        label: 'Planora dashboard on mobile',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Open your Planora dashboard.',
        url: '/dashboard?source=pwa-shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Spaces',
        short_name: 'Spaces',
        description: 'Open all project spaces.',
        url: '/spaces?source=pwa-shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Inbox',
        short_name: 'Inbox',
        description: 'Open workspace messages.',
        url: '/inbox?source=pwa-shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Create Project',
        short_name: 'Create',
        description: 'Start a new project.',
        url: '/createProject?source=pwa-shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
