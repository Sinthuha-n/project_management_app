import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import React from "react";
import { Inter, Outfit, Arimo } from 'next/font/google'
import "./globals.css";
import "react-international-phone/style.css";

import { NavigationProvider } from "@/lib/navigation-context";
import { ToastProvider } from "@/components/ui/Toast";
import { GlobalNotificationProvider } from "@/components/providers/GlobalNotificationProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import KeyboardShortcutsProvider from "@/components/providers/KeyboardShortcutsProvider";
import AuthBootstrapProvider from "@/components/providers/AuthBootstrapProvider";
import SWRProvider from "@/components/providers/SWRProvider";
import TimeZoneProvider from "@/components/providers/TimeZoneProvider";
import TaskCacheProvider from "@/components/providers/TaskCacheProvider";
import IOSInstallPrompt from "@/components/pwa/IOSInstallPrompt";
import { OnlineStatusProvider } from "@/components/pwa/OnlineStatusProvider";
import PWARegistration from "@/components/pwa/PWARegistration";
import PWAUpdateToast from "@/components/pwa/PWAUpdateToast";
import NextTopLoader from 'nextjs-toploader';
import Script from 'next/script';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  preload: false,
  display: 'swap',
})
const outfit = Outfit({ 
  subsets: ['latin'], 
  variable: '--font-outfit', 
  preload: false,
  display: 'swap',
})
const arimo = Arimo({ 
  subsets: ['latin'], 
  variable: '--font-arimo', 
  preload: false,
  display: 'swap',
})


export const metadata: Metadata = {
  applicationName: 'Planora',
  title: 'Planora — Plan · Track · Ship',
  description: 'Planora is a project management platform for modern teams.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Planora',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Planora',
    description: 'Project management for modern teams.',
    siteName: 'Planora',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#155DFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} ${arimo.variable} antialiased font-inter bg-cu-bg-secondary`}>
        <Script id="planora-theme-init" strategy="beforeInteractive">
          {`try{var p=location.pathname;var a=p==='/'||/^\\/(login|register|signup|forgot-password|reset-password|verify-email)(\\/|$)/.test(p);var t=localStorage.getItem('planora-theme');document.documentElement.classList.toggle('dark',!a&&t==='dark');}catch(e){}`}
        </Script>
        <NextTopLoader
          color="#9810FA"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #2563EB,0 0 5px #2563EB"
        />
        <NavigationProvider>
          <SWRProvider>
            <AuthBootstrapProvider>
              <TimeZoneProvider>
              <TaskCacheProvider>
              <ThemeProvider>
                <ToastProvider>
                  <OnlineStatusProvider>
                    <GlobalNotificationProvider>
                      <PWARegistration />
                      <PWAUpdateToast />
                      <IOSInstallPrompt />
                      <KeyboardShortcutsProvider />
                      <Suspense fallback={null}>
                        {children}
                      </Suspense>
                    </GlobalNotificationProvider>
                  </OnlineStatusProvider>
                </ToastProvider>
              </ThemeProvider>
              </TaskCacheProvider>
              </TimeZoneProvider>
            </AuthBootstrapProvider>
          </SWRProvider>
        </NavigationProvider>
      </body>
    </html>
  );
}
