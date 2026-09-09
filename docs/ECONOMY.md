# Économie d'Alvora

Ce document explique **pourquoi** les règles économiques sont ce qu'elles sont. Les
valeurs elles-mêmes vivent toutes dans
[`packages/shared/src/constants.ts`](../packages/shared/src/constants.ts) — c'est le seul
fichier à modifier pour rééquilibrer le jeu.

Le fil conducteur : dans un jeu multijoueur, **toute source d'argent sans contrepartie
finit par tuer l'économie**. La version précédente d'Alvora en avait plusieurs, et une
partie longue finissait avec des joueurs à plusieurs milliards et des prix sans signification.

---

## Puits et sources de monnaie

| Source (crée de la monnaie) | Contrepoids |
| --- | --- |
| Solde de départ (100 000) | une seule fois par compte |
| Bonus quotidien (250) | plafonné à une fois par jour UTC |
| Intérêts sur l'épargne (1,20 %/an) | inférieurs à l'inflation d'un marché en croissance |
| Revenus d'entreprise | proportionnels au capital immobilisé, moins les dépenses du secteur |
| Récompenses de minage | diluées par le hashrate total, moins l'électricité |
| Récompenses de staking | plafonnées par le montant bloqué et la durée |

| Puits (détruit de la monnaie) | Rôle |
| --- | --- |
| Frais de transaction (5–20 pdb) | le principal puits ; il grandit avec l'activité |
| Frais de swap (30 pdb) et de gré à gré (10 pdb) | taxe l'arbitrage entre surfaces |
| Frais de réseau des chaînes | rend un transfert non gratuit |
| Électricité du minage | transforme le minage en décision, pas en rente |
| Coût de création (entreprise 25 000, marché 500) | freine le spam |
| Commission sur les marchés de prédiction (2 %) | ponctionne le pot |
| Intérêts d'emprunt (9 %/an) | prix du levier |
| Salaires versés depuis la trésorerie | redistribue sans créer |

Les frais sont **débités sans être crédités à personne** : ils quittent l'économie. C'est
ce qui empêche la masse monétaire de croître indéfiniment. Le tableau de bord
d'administration affiche la masse monétaire totale précisément pour qu'on puisse voir
l'inflation arriver.

---

## Formation des prix

Chaque tick (2 s), le prix d'un actif est le produit de quatre termes :

1. **Marche aléatoire** — un pas géométrique brownien, `dérive + σ·N(0,1)`, avec σ propre à
   la classe d'actif (6 pdb pour une obligation, 160 pour une crypto).
2. **Facteur de marché** — un tirage commun par classe, mélangé à ~35 %, pour que les
   actifs d'un même secteur bougent ensemble comme dans un vrai marché.
3. **Retour à la moyenne** — une traction vers le prix d'ancrage, sans laquelle une longue
   marche aléatoire finit par envoyer un cours à zéro ou à l'infini.
4. **Impact du flux d'ordres** — c'est le terme qui rend le marché *multijoueur*. Le volume
   net signé échangé depuis le tick précédent déplace le prix de
   `impactBps × flux / volumeRéférence`. Acheter fait monter, vendre fait baisser.

Un disjoncteur limite le mouvement d'un seul tick à 800 pdb, et un plancher/plafond
relatifs à l'ancrage empêchent un prix d'atteindre zéro — l'origine de plusieurs `$NaN`
dans la version précédente.

### Événements de marché

Les actualités sont générées **localement**, à partir de gabarits. La version précédente
appelait un modèle de langage pour chaque titre : le mouvement des prix n'était donc pas
reproductible, chaque tick coûtait de l'argent, et — le pire — le `impactScore` renvoyé
par le modèle n'était jamais lu par quoi que ce soit. Les actualités étaient purement
décoratives.

Ici, un événement exerce une **pression réelle** sur le cours, en points de base selon sa
magnitude (mineur 150 → choc 4 000), qui décroît géométriquement sur sa durée de vie.

---

## Exécution des ordres

- Priorité **prix-temps**. L'exécution se fait au prix de l'ordre **passif**, jamais à
  celui de l'agresseur : c'est ce qui donne un sens à un ordre à cours limité.
- **Prévention de l'auto-exécution** : un ordre ne peut pas croiser un ordre du même
  propriétaire. Sans cela, un joueur ferait monter son propre cours gratuitement.
- **Teneur de marché de synthèse** : quand le carnet est vide, un ordre au marché s'exécute
  contre le moteur avec un slippage croissant avec la taille. Sans lui, un instrument
  nouvellement coté serait tout simplement innégociable.
- Les frais distinguent l'agresseur (20 pdb) du passif (5 pdb), pour récompenser
  l'apport de liquidité.
- Un ordre à cours limité réserve la trésorerie au prix limite ; s'il s'exécute mieux, la
  différence est **rendue**. Un ordre de vente réserve la quantité, qui ne peut donc pas
  être vendue deux fois.

---

## Minage

La récompense d'un bloc est partagée au prorata du hashrate, contre un total réseau de
`hashrateDeBase + somme de tous les joueurs`.

C'est le correctif d'équilibrage le plus important du projet. La version précédente payait
un taux **fixe par machine** : le rendement était donc linéaire en dépense, sans plafond,
et le minage devenait une imprimante à billets. Ici, chaque machine achetée par n'importe
quel joueur dilue tout le monde — y compris son acheteur. L'interface l'affiche
explicitement plutôt que de le cacher.

L'électricité est facturée en continu. Un joueur qui ne peut plus la payer voit ses
machines désactivées, pas son solde passer sous zéro.

---

## Entreprises

Le cours d'une société cotée est ancré à ses **fondamentaux** : valeur comptable par action
(trésorerie + portefeuille + matériel), mélangée au prix découvert par le carnet d'ordres.
Le marché peut s'écarter de la valeur réelle — c'est tout l'intérêt — mais pas
indéfiniment.

Le retrait de trésorerie est le piège classique : sans garde-fou, un dirigeant vide la
caisse d'une société publique dont d'autres joueurs détiennent des actions. Le retrait est
donc limité à ce qui n'est pas dû aux actionnaires extérieurs, exige une permission, et est
journalisé.

Les dividendes utilisent une distribution au prorata **exacte** : la somme des versements
est égale au total annoncé, sans fuite d'arrondi.

---

## Marchés de prédiction

Parimutuels : les mises forment un pot, les gagnants se le partagent au prorata de leur
mise. La cote affichée est donc indicative — elle bouge à chaque nouvelle mise, et
l'interface le dit.

Si personne n'a misé sur l'issue gagnante, **tout le monde est remboursé** plutôt que de
voir le pot disparaître. Le règlement est idempotent et verrouille la ligne du marché : un
double appel ne peut pas payer deux fois.

---

## Ce qui a été délibérément retiré

| Retiré | Pourquoi |
| --- | --- |
| Génération d'actualités par IA | non reproductible, coûteuse, et son impact n'était jamais appliqué |
| Conseiller en investissement IA | dépendance externe à une clé d'API pour un texte décoratif |
| Historique de graphique fabriqué côté client | 48 points tirés au hasard autour du prix courant, sans autocorrélation — remplacé par de vraies bougies persistées |
| Récompense de minage à taux fixe | source de monnaie non bornée |
| Ordres automatiques stockés mais jamais exécutés | un joueur qui posait un stop-loss n'était en réalité pas protégé |
