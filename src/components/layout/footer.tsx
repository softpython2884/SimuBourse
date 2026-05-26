import Link from 'next/link';

const LEGAL_LINKS = [
  { href: '/conditions', label: "Conditions d'utilisation" },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/mentions-legales', label: 'Mentions légales' },
];

export function AppFooter() {
  return (
    <footer className="mt-auto border-t bg-background px-4 py-6 pb-24 text-sm text-muted-foreground sm:px-6 sm:pb-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="text-center sm:text-left">
          © {new Date().getFullYear()} SimuBourse — Simulation ludique, sans valeur monétaire réelle.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
