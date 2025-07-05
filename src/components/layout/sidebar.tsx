'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, LineChart, Users, Cpu, BrainCircuit, Landmark, BarChart, Wallet } from 'lucide-react';
import { Logo } from '@/components/icons';
import { cn } from '@/lib/utils';

export const NAV_LINKS = [
  { href: '/', icon: Home, label: 'Tableau de Bord' },
  { href: '/portfolio', icon: Wallet, label: 'Portefeuille' },
  { href: '/trading', icon: LineChart, label: 'Trading' },
  { href: '/markets', icon: BarChart, label: 'Marché des Paris' },
  { href: '/mining', icon: Cpu, label: 'Minage de Crypto' },
  { href: '/companies', icon: Landmark, label: 'Entreprises' },
  { href: '/ai-investor', icon: BrainCircuit, label: 'Investisseur IA' },
  { href: '/profile', icon: Users, label: 'Profil' },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          href="/"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <Logo className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">SimuBourse</span>
        </Link>
        <TooltipProvider>
          {NAV_LINKS.map((link) => (
            <Tooltip key={link.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={link.href}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                    { 'bg-accent text-accent-foreground': pathname === link.href }
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  <span className="sr-only">{link.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{link.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>
    </aside>
  );
}
