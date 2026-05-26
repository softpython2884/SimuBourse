import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — SimuBourse',
  description: 'Comment SimuBourse collecte et traite vos données personnelles.',
};

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="26 mai 2026">
      <p>
        La présente politique décrit la manière dont <strong>SimuBourse</strong> collecte et traite vos
        données personnelles, conformément au Règlement général sur la protection des données (RGPD) et à
        la loi « Informatique et Libertés ».
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l'éditeur du site, identifié dans les{' '}
        <a href="/mentions-legales">mentions légales</a>. Pour toute demande relative à vos données :{' '}
        <strong>[À COMPLÉTER : adresse e-mail de contact]</strong>.
      </p>

      <h2>2. Données collectées</h2>
      <p>Dans le cadre de la création et de l'utilisation de votre compte, nous traitons :</p>
      <ul>
        <li><strong>Adresse e-mail</strong> — identification du compte et connexion ;</li>
        <li><strong>Nom d'utilisateur (pseudo)</strong> — affichage public dans le jeu ;</li>
        <li><strong>Mot de passe</strong> — stocké uniquement sous forme de condensat chiffré (hachage bcrypt), jamais en clair ;</li>
        <li><strong>Numéro de téléphone</strong> — facultatif, si vous choisissez de le renseigner dans votre profil ;</li>
        <li><strong>Données de jeu</strong> — portefeuille fictif, transactions, paris, entreprises et historique d'activité (sans valeur monétaire réelle).</li>
      </ul>
      <p>Nous ne collectons aucune donnée bancaire, aucun moyen de paiement réel.</p>

      <h2>3. Finalités et bases légales</h2>
      <ul>
        <li>Création et gestion de votre compte — <strong>exécution du contrat</strong> (les présentes conditions d'utilisation) ;</li>
        <li>Fonctionnement du jeu et de ses fonctionnalités — <strong>exécution du contrat</strong> ;</li>
        <li>Sécurité, prévention des abus et bon fonctionnement du Service — <strong>intérêt légitime</strong>.</li>
      </ul>

      <h2>4. Cookies</h2>
      <p>
        SimuBourse utilise un unique cookie strictement nécessaire au fonctionnement : un{' '}
        <strong>cookie de session</strong> (signé, <code>httpOnly</code>), qui maintient votre connexion.
        Il ne sert pas à des fins publicitaires ou de suivi. Étant essentiel au service, il ne requiert
        pas de consentement préalable. Aucun cookie de traçage ou de publicité tiers n'est déposé.
      </p>

      <h2>5. Fonctionnalités d'intelligence artificielle</h2>
      <p>
        Certaines fonctionnalités optionnelles (conseiller IA, génération d'actualités simulées) s'appuient
        sur un service tiers d'IA (Google). Lorsque vous utilisez ces fonctionnalités, le texte que vous
        soumettez peut être transmis à ce prestataire pour traitement. N'y insérez pas d'informations
        personnelles sensibles.
      </p>

      <h2>6. Destinataires</h2>
      <p>
        Vos données sont destinées à l'éditeur et, le cas échéant, à ses sous-traitants techniques
        (hébergeur, prestataire d'IA) agissant pour son compte. Elles ne sont ni vendues ni cédées à des
        tiers à des fins commerciales.
      </p>

      <h2>7. Durée de conservation</h2>
      <p>
        Vos données sont conservées tant que votre compte est actif. Elles sont supprimées en cas de
        suppression du compte, sous réserve des durées de conservation imposées par la loi.
      </p>

      <h2>8. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez des droits d'accès, de rectification, d'effacement, de
        limitation, d'opposition et de portabilité de vos données. Vous pouvez les exercer en écrivant à
        l'adresse de contact indiquée ci-dessus. Vous disposez également du droit d'introduire une
        réclamation auprès de la <strong>CNIL</strong> (
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
      </p>

      <h2>9. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques appropriées pour protéger vos données : hachage des
        mots de passe, cookies de session sécurisés et signés, et chiffrement des échanges (HTTPS).
      </p>

      <h2>10. Modifications</h2>
      <p>
        La présente politique peut être mise à jour. La date de dernière mise à jour figure en tête de
        page.
      </p>
    </LegalPage>
  );
}
