'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/icons';
import { NAV_LINKS } from './sidebar';
import { cn } from '@/lib/utils';

// The four destinations pinned to the bottom bar on phones; everything else
// lives behind the "Plus" sheet so nothing is unreachable.
const PRIMARY_HREFS = ['/', '/trading', '/portfolio', '/markets'];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const primary = PRIMARY_HREFS
    .map((href) => NAV_LINKS.find((l) => l.href === href))
    .filter((l): l is (typeof NAV_LINKS)[number] => Boolean(l));

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background sm:hidden">
      <div className="grid grid-cols-5">
        {primary.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors',
              isActive(link.href) && 'text-primary'
            )}
          >
            <link.icon className="h-5 w-5" />
            <span className="leading-none">{link.label.split(' ')[0]}</span>
          </Link>
        ))}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
            <span className="leading-none">Plus</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader className="mb-4 flex-row items-center gap-2 space-y-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Logo className="h-4 w-4" />
              </span>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 pb-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive(link.href) && 'border-primary text-primary'
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  <span className="leading-tight">{link.label}</span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
