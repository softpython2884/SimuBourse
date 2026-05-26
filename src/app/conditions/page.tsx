import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: "Conditions d'utilisation — SimuBourse",
  description: "Conditions générales d'utilisation de la plateforme SimuBourse.",
};

export default function ConditionsPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation" updatedAt="26 mai 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions générales d'utilisation (les « CGU ») régissent l'accès et l'utilisation
        de la plateforme <strong>SimuBourse</strong> (le « Service »). En créant un compte ou en utilisant
        le Service, vous acceptez sans réserve les présentes CGU.
      </p>

      <h2>2. Nature du Service : simulation</h2>
      <p>
        SimuBourse est un <strong>jeu de simulation financière à but ludique et éducatif</strong>.
        L'ensemble des actifs (actions, cryptomonnaies, devises, matières premières, marchés de
        prédiction, entreprises virtuelles, minage, etc.) ainsi que les soldes et gains sont{' '}
        <strong>entièrement fictifs et n'ont aucune valeur monétaire réelle</strong>.
      </p>
      <ul>
        <li>Aucun versement, dépôt ou retrait d'argent réel n'est possible.</li>
        <li>Le Service ne fournit aucun conseil en investissement et ne constitue pas une incitation à investir.</li>
        <li>Les prix et données affichés sont simulés et ne reflètent pas les marchés réels.</li>
      </ul>

      <h2>3. Compte utilisateur</h2>
      <p>
        La création d'un compte nécessite une adresse e-mail valide, un nom d'utilisateur et un mot de
        passe. Vous êtes responsable de la confidentialité de vos identifiants et de toute activité
        réalisée depuis votre compte. Vous vous engagez à fournir des informations exactes et à ne pas
        usurper l'identité d'un tiers.
      </p>

      <h2>4. Règles d'utilisation</h2>
      <p>En utilisant le Service, vous vous engagez à ne pas :</p>
      <ul>
        <li>tenter de contourner, exploiter ou perturber le fonctionnement de la plateforme (failles, robots, scripts automatisés) ;</li>
        <li>accéder à des comptes ou données qui ne vous appartiennent pas ;</li>
        <li>publier des contenus illicites, injurieux, diffamatoires ou contraires à l'ordre public (par exemple via les noms d'entreprises ou de marchés) ;</li>
        <li>porter atteinte aux droits d'autrui ou à la sécurité du Service.</li>
      </ul>

      <h2>5. Contenus générés par les utilisateurs</h2>
      <p>
        Vous êtes seul responsable des contenus que vous créez (noms d'entreprises, marchés de prédiction,
        nom d'utilisateur, etc.). L'éditeur se réserve le droit de supprimer tout contenu inapproprié et,
        le cas échéant, de suspendre le compte concerné.
      </p>

      <h2>6. Disponibilité et données</h2>
      <p>
        Le Service est fourni « en l'état » et « selon disponibilité ». L'éditeur ne garantit pas un
        fonctionnement ininterrompu ou exempt d'erreurs. Les données de simulation peuvent être
        réinitialisées, modifiées ou supprimées à tout moment, notamment pour des raisons de maintenance
        ou d'équilibrage du jeu, sans que cela n'ouvre droit à indemnisation (aucune valeur réelle
        n'étant en jeu).
      </p>

      <h2>7. Limitation de responsabilité</h2>
      <p>
        Le Service étant une simulation sans valeur réelle, l'éditeur ne saurait être tenu responsable
        d'une quelconque perte financière. Sa responsabilité ne saurait être engagée pour les dommages
        indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le Service.
      </p>

      <h2>8. Données personnelles</h2>
      <p>
        Le traitement de vos données personnelles est décrit dans notre{' '}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
      </p>

      <h2>9. Modification des CGU</h2>
      <p>
        L'éditeur peut modifier les présentes CGU à tout moment. La version applicable est celle en
        vigueur lors de votre utilisation du Service. En cas de modification substantielle, les
        utilisateurs en seront informés par un moyen approprié.
      </p>

      <h2>10. Résiliation</h2>
      <p>
        Vous pouvez cesser d'utiliser le Service à tout moment. L'éditeur peut suspendre ou supprimer un
        compte en cas de manquement aux présentes CGU.
      </p>

      <h2>11. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. À défaut de résolution amiable, tout litige
        relèvera de la compétence des juridictions françaises.
      </p>
    </LegalPage>
  );
}
