import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Mentions légales — SimuBourse',
  description: 'Mentions légales de la plateforme SimuBourse.',
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updatedAt="26 mai 2026">
      <p>
        Conformément aux dispositions des articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004
        pour la confiance dans l'économie numérique (LCEN), les présentes mentions légales sont portées
        à la connaissance des utilisateurs du site <strong>SimuBourse</strong>, accessible à l'adresse{' '}
        <strong>https://bourse.forgenet.fr</strong>.
      </p>

      <h2>Éditeur du site</h2>
      <p>
        Le site est édité par : <strong>[À COMPLÉTER : nom de l'éditeur ou raison sociale]</strong>.
      </p>
      <ul>
        <li>Statut / forme juridique : [À COMPLÉTER]</li>
        <li>Adresse : [À COMPLÉTER]</li>
        <li>Adresse e-mail de contact : [À COMPLÉTER]</li>
        <li>Numéro SIREN/SIRET (le cas échéant) : [À COMPLÉTER]</li>
      </ul>

      <h2>Directeur de la publication</h2>
      <p>Le directeur de la publication est : <strong>[À COMPLÉTER : nom du responsable]</strong>.</p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par : <strong>[À COMPLÉTER : nom de l'hébergeur]</strong>.
      </p>
      <ul>
        <li>Adresse de l'hébergeur : [À COMPLÉTER]</li>
        <li>Contact de l'hébergeur : [À COMPLÉTER]</li>
      </ul>

      <h2>Nature du service</h2>
      <p>
        SimuBourse est une <strong>plateforme de simulation financière à but ludique et éducatif</strong>.
        Toutes les sommes, devises, cryptomonnaies, actions, entreprises et instruments présentés sont{' '}
        <strong>fictifs et dépourvus de toute valeur monétaire réelle</strong>. Aucun dépôt, retrait,
        achat ou gain en argent réel n'est possible. Le service ne constitue ni un service
        d'investissement, ni un service de paiement, ni un conseil financier au sens de la
        réglementation applicable.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble des éléments du site (structure, textes, interface, logos, graphismes) est protégé par
        le droit de la propriété intellectuelle. Toute reproduction ou représentation, totale ou
        partielle, sans autorisation préalable, est interdite.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative au site, vous pouvez écrire à l'adresse de contact indiquée
        ci-dessus.
      </p>
    </LegalPage>
  );
}
