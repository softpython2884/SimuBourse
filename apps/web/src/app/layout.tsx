import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';
import type { SessionUser } from '@alvora/shared';
import { Providers } from '@/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Alvora — Bourse & marchés simulés', template: '%s · Alvora' },
  description:
    "Alvora Bourse : simulation boursière multijoueur en temps réel. Actions, cryptomonnaies, portefeuilles on-chain, entreprises cotées et marchés de prédiction.",
  applicationName: 'Alvora',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Alvora', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'Alvora Bourse',
    description: 'Tradez, fondez votre entreprise, minez et pariez — en temps réel, avec de vrais joueurs.',
    siteName: 'Alvora',
    type: 'website',
    locale: 'fr_FR',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#08090f' },
  ],
};

/**
 * Resolve the session on the server so the first paint already knows whether the
 * visitor is signed in. Without this the shell flashes its logged-out state on
 * every navigation.
 */
async function loadUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  const origin = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api';
  try {
    const response = await fetch(`${origin}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as SessionUser;
  } catch {
    // The API being down must not blank the whole site.
    return null;
  }
}

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('alvora-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var m=t==='dark'||(t!=='light'&&d);var r=document.documentElement;r.classList.toggle('dark',m);r.setAttribute('data-theme',m?'dark':'light');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await loadUser();
  await headers();

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applied before first paint, so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-contrast"
        >
          Aller au contenu
        </a>
        <Providers initialUser={user}>{children}</Providers>
      </body>
    </html>
  );
}
