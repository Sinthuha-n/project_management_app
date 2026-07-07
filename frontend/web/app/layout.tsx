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
  title: 'Planora — Plan · Track · Ship',
  description: 'Planora is a project management platform for modern teams.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
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
              <ThemeProvider>
                <ToastProvider>
                  <GlobalNotificationProvider>
                    <KeyboardShortcutsProvider />
                    <Suspense fallback={null}>
                      {children}
                    </Suspense>
                  </GlobalNotificationProvider>
                </ToastProvider>
              </ThemeProvider>
            </AuthBootstrapProvider>
          </SWRProvider>
        </NavigationProvider>
      </body>
    </html>
  );
}
