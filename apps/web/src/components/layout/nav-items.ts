import {
  ArrowLeftRight,
  Building2,
  CandlestickChart,
  LayoutDashboard,
  ListOrdered,
  MessagesSquare,
  Pickaxe,
  PieChart,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@alvora/shared';

/**
 * The single source of truth for navigation.
 *
 * The sidebar, the mobile tab bar, the mobile drawer and the command palette all
 * read this list, so a route added here appears everywhere at once and the three
 * surfaces can never drift apart.
 */

export type NavSectionId = 'apercu' | 'trading' | 'patrimoine' | 'communaute' | 'compte';

export interface NavSection {
  id: NavSectionId;
  /** `null` renders the group without a heading (the first group). */
  label: string | null;
}

export interface NavItem {
  /** Stable key, also used as the command-palette option id. */
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavSectionId;
  /** Shown in the collapsed sidebar tooltip and in the palette. */
  description: string;
  /** Extra path prefixes that should light this item up (e.g. /trade for Marchés). */
  alsoMatches?: readonly string[];
  /** Hidden from everyone but administrators. */
  adminOnly?: boolean;
  /** Position in the mobile bottom tab bar; absent means "drawer only". */
  mobileOrder?: number;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { id: 'apercu', label: null },
  { id: 'trading', label: 'Trading' },
  { id: 'patrimoine', label: 'Patrimoine' },
  { id: 'communaute', label: 'Communauté' },
  { id: 'compte', label: 'Compte' },
];

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
    section: 'apercu',
    description: 'Vue d’ensemble de vos positions et du marché',
    mobileOrder: 1,
  },
  {
    id: 'markets',
    label: 'Marchés',
    href: '/markets',
    icon: CandlestickChart,
    section: 'trading',
    description: 'Cours en direct de tous les actifs cotés',
    alsoMatches: ['/trade'],
    mobileOrder: 2,
  },
  {
    id: 'orders',
    label: 'Ordres',
    href: '/orders',
    icon: ListOrdered,
    section: 'trading',
    description: 'Ordres en cours et historique d’exécution',
    mobileOrder: 4,
  },
  {
    id: 'otc',
    label: 'Gré à gré',
    href: '/otc',
    icon: ArrowLeftRight,
    section: 'trading',
    description: 'Échanges directs entre joueurs, sous séquestre',
  },
  {
    id: 'predictions',
    label: 'Prédictions',
    href: '/predictions',
    icon: Target,
    section: 'trading',
    description: 'Marchés de prédiction et paris sur événements',
  },
  {
    id: 'portfolio',
    label: 'Portefeuille',
    href: '/portfolio',
    icon: PieChart,
    section: 'patrimoine',
    description: 'Positions, performance et allocation',
    mobileOrder: 3,
  },
  {
    id: 'wallet',
    label: 'Portefeuilles crypto',
    href: '/wallet',
    icon: Wallet,
    section: 'patrimoine',
    description: 'Adresses on-chain, transferts et staking',
  },
  {
    id: 'mining',
    label: 'Minage',
    href: '/mining',
    icon: Pickaxe,
    section: 'patrimoine',
    description: 'Machines, hashrate et récompenses de blocs',
  },
  {
    id: 'companies',
    label: 'Entreprises',
    href: '/companies',
    icon: Building2,
    section: 'communaute',
    description: 'Sociétés fondées par les joueurs et introductions en bourse',
  },
  {
    id: 'leaderboard',
    label: 'Classement',
    href: '/leaderboard',
    icon: Trophy,
    section: 'communaute',
    description: 'Les meilleures valeurs nettes de la plateforme',
  },
  {
    id: 'chat',
    label: 'Discussions',
    href: '/chat',
    icon: MessagesSquare,
    section: 'communaute',
    description: 'Salons de discussion en temps réel',
  },
  {
    id: 'profile',
    label: 'Profil',
    href: '/profile',
    icon: UserRound,
    section: 'compte',
    description: 'Votre profil public et vos succès',
  },
  {
    id: 'settings',
    label: 'Paramètres',
    href: '/settings',
    icon: Settings,
    section: 'compte',
    description: 'Compte, sécurité et préférences',
  },
  {
    id: 'admin',
    label: 'Administration',
    href: '/admin',
    icon: ShieldCheck,
    section: 'compte',
    description: 'Supervision de la plateforme',
    adminOnly: true,
  },
];

/** True when `pathname` is the item's route or one of its sub-routes. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const candidates = [item.href, ...(item.alsoMatches ?? [])];
  return candidates.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function visibleNavItems(role: UserRole | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');
}

/** The navigation grouped for the sidebar and the mobile drawer, empty groups dropped. */
export function navSectionsFor(role: UserRole | null | undefined): Array<{ section: NavSection; items: NavItem[] }> {
  const items = visibleNavItems(role);
  return NAV_SECTIONS.map((section) => ({
    section,
    items: items.filter((item) => item.section === section.id),
  })).filter((group) => group.items.length > 0);
}

/** The four routes reachable from the mobile tab bar, in bar order. */
export const MOBILE_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => item.mobileOrder !== undefined).sort(
  (a, b) => (a.mobileOrder ?? 0) - (b.mobileOrder ?? 0),
);

/** Fuzzy-free, accent-insensitive label match used by the command palette. */
export function matchNavItems(term: string, role: UserRole | null | undefined): NavItem[] {
  const needle = normalize(term);
  if (!needle) return [];
  return visibleNavItems(role).filter(
    (item) => normalize(item.label).includes(needle) || normalize(item.description).includes(needle),
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
