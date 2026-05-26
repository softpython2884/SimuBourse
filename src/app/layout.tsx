import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});
import { Toaster } from "@/components/ui/toaster";
import { AppSidebar } from '@/components/layout/sidebar';
import { AppHeader } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { AuthProvider } from '@/context/auth-context';
import { PortfolioProvider } from '@/context/portfolio-context';
import { MarketDataProvider } from '@/context/market-data-context';

export const metadata: Metadata = {
  title: 'SimuBourse',
  description: 'An immersive financial simulation platform.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <body className="font-body antialiased">
        <AuthProvider>
          <MarketDataProvider>
            <PortfolioProvider>
              <div className="flex min-h-screen w-full flex-col bg-muted/40">
                <AppSidebar />
                <div className="flex flex-col sm:pl-14">
                  <AppHeader />
                  <main className="flex-1 p-4 pb-20 sm:px-6 sm:py-6 sm:pb-6">
                    {children}
                  </main>
                </div>
              </div>
              <MobileNav />
              <Toaster />
            </PortfolioProvider>
          </MarketDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
