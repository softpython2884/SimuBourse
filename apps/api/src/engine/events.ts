import { sql } from 'drizzle-orm';
import { EVENTS, type EventMagnitude, type MarketEvent } from '@alvora/shared';
import { marketEvents, type Database } from '@alvora/db';
import { Random } from '../lib/random.js';
import type { AssetState, EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

type Sentiment = MarketEvent['sentiment'];
type Source = MarketEvent['source'];

/** Editorial families. Several asset classes share a voice, so they share templates. */
type Family = 'equity' | 'crypto' | 'commodity' | 'macro';

interface Template {
  headline: string;
  body: string;
}

const FAMILY_BY_CLASS: Record<string, Family> = {
  Stock: 'equity',
  Company: 'equity',
  Index: 'equity',
  ETF: 'equity',
  Crypto: 'crypto',
  Forex: 'commodity',
  Commodity: 'commodity',
  Bond: 'macro',
};

/**
 * How a whole asset class is named in a market-wide headline. Every label is a
 * singular collective noun so the templates, which are written for one subject,
 * stay grammatical when the subject is a whole compartment.
 */
const CLASS_LABEL: Record<string, string> = {
  Stock: 'le marché actions',
  Company: 'le compartiment des sociétés cotées',
  Index: 'le segment indiciel',
  ETF: 'le compartiment des ETF',
  Crypto: 'le marché des cryptoactifs',
  Forex: 'le marché des changes',
  Commodity: 'le marché des matières premières',
  Bond: 'le marché obligataire',
};

const ACTORS: Record<Family, readonly string[]> = {
  equity: [
    'un analyste de Banque Ravel',
    'le cabinet Vernier & Associés',
    'un fonds activiste américain',
    'le bureau de recherche de Delcourt Capital',
    'la direction financière',
  ],
  crypto: [
    'une baleine restée anonyme',
    'le principal contributeur du protocole',
    'une plateforme d’échange de premier plan',
    'le régulateur européen des marchés',
    'un fonds spécialisé en actifs numériques',
  ],
  commodity: [
    'le cartel des pays producteurs',
    'un armateur de premier plan',
    'l’agence internationale de l’énergie',
    'le principal négociant de la place',
    'un consortium d’acheteurs industriels',
  ],
  macro: [
    'la banque centrale',
    'l’institut national de la statistique',
    'le ministère des Finances',
    'le Fonds monétaire international',
    'le comité de politique monétaire',
  ],
};

/**
 * Headline corpus.
 *
 * The legacy app asked Google Gemini for every headline: each tick cost money,
 * added latency to the simulation loop and made price movement impossible to
 * reproduce when investigating a complaint. Templates are free, instant and
 * deterministic given the generator's seed.
 */
const TEMPLATES: Record<Sentiment, Record<Family, readonly Template[]>> = {
  positive: {
    equity: [
      {
        headline: '{asset} bondit de {pct} % après un relèvement d’objectif',
        body: '{actor} relève son objectif de cours sur {asset} ({ticker}) et salue une exécution nettement supérieure au consensus. Les volumes s’étoffent dès l’ouverture et le carnet reste déséquilibré à l’achat.',
      },
      {
        headline: 'Résultats trimestriels : {asset} dépasse le consensus',
        body: '{asset} publie une marge opérationnelle en progression et relève sa prévision annuelle. {actor} évoque un point d’inflexion durable ; le titre gagne {pct} % dans les premiers échanges.',
      },
      {
        headline: '{asset} décroche un contrat pluriannuel majeur',
        body: 'Le carnet de commandes de {asset} s’alourdit d’un contrat structurant sur cinq ans. {actor} estime que la visibilité ainsi gagnée justifie une prime de {pct} % sur la valorisation actuelle.',
      },
      {
        headline: 'Rachat d’actions : {asset} soutient son cours',
        body: '{actor} accueille favorablement le programme de rachat portant sur {pct} % du capital de {asset}. La réduction du flottant améliore mécaniquement le bénéfice par action.',
      },
    ],
    crypto: [
      {
        headline: '{ticker} s’envole de {pct} % sur fond d’afflux institutionnels',
        body: 'Les entrées nettes sur les produits adossés à {asset} atteignent un plus haut de plusieurs mois. {actor} y voit une allocation structurelle plutôt qu’un mouvement spéculatif.',
      },
      {
        headline: 'Mise à jour réseau réussie pour {asset}',
        body: 'La montée de version s’est déroulée sans interruption de service : frais réduits, débit en hausse. {actor} confirme que l’activité on-chain progresse de {pct} % depuis le déploiement.',
      },
      {
        headline: '{asset} progresse de {pct} % sur fond d’accumulation',
        body: 'Les adresses détenant les plus gros soldes de {asset} n’ont jamais été aussi nombreuses. {actor} constate que l’offre disponible sur les plateformes recule semaine après semaine.',
      },
      {
        headline: 'Nouvelle cotation : {asset} accessible à de nouveaux marchés',
        body: '{actor} ouvre l’accès à {asset} ({ticker}) pour l’ensemble de sa clientèle. L’élargissement de la base d’acheteurs se traduit par une prime immédiate de {pct} % sur le comptant.',
      },
    ],
    commodity: [
      {
        headline: 'Tensions d’approvisionnement : {asset} gagne {pct} %',
        body: 'Les stocks disponibles reculent pour la sixième semaine consécutive. {actor} anticipe un déficit d’offre durable et les acheteurs industriels sécurisent leurs volumes à terme.',
      },
      {
        headline: '{asset} soutenu par une demande industrielle robuste',
        body: 'La consommation apparente dépasse les prévisions dans les principales zones importatrices. {actor} relève sa fourchette de prix de {pct} % pour le trimestre en cours.',
      },
      {
        headline: '{actor} réduit ses quotas, {asset} en hausse',
        body: 'La décision retire une part significative de l’offre du marché mondial. Les contrats à terme sur {asset} s’apprécient de {pct} % et la courbe repasse en déport.',
      },
      {
        headline: 'Reflux du dollar : {asset} reprend {pct} %',
        body: 'L’affaiblissement du billet vert rend {asset} plus abordable pour les acheteurs hors zone dollar. {actor} note un retour net des positions acheteuses.',
      },
    ],
    macro: [
      {
        headline: 'Inflation en repli : les marchés saluent la détente',
        body: '{actor} confirme un net ralentissement des prix. La perspective d’un assouplissement monétaire redonne de l’appétit pour le risque et {asset} progresse de {pct} %.',
      },
      {
        headline: '{actor} abaisse ses taux directeurs',
        body: 'La baisse, plus marquée qu’attendu, réduit le coût du capital pour l’ensemble de la cote. {asset} réagit favorablement, avec une avance de {pct} %.',
      },
      {
        headline: 'Croissance révisée à la hausse',
        body: '{actor} relève sa prévision d’activité pour l’exercice en cours. Les secteurs cycliques mènent la hausse et {asset} gagne {pct} % dans le sillage de la révision.',
      },
      {
        headline: 'Accord commercial : optimisme sur les places financières',
        body: 'La levée des barrières tarifaires annoncée par {actor} rouvre des débouchés considérables. {asset} s’inscrit en hausse de {pct} % sur la nouvelle.',
      },
    ],
  },
  negative: {
    equity: [
      {
        headline: '{asset} chute de {pct} % après un avertissement sur résultats',
        body: 'La direction de {asset} révise à la baisse ses objectifs annuels et évoque une demande atone. {actor} abaisse sa recommandation dans la foulée.',
      },
      {
        headline: '{actor} dégrade sa recommandation sur {asset}',
        body: 'La note passe à sous-performance : marges sous pression et concurrence accrue sur les prix. Le titre {ticker} abandonne {pct} % et le carnet se creuse à la vente.',
      },
      {
        headline: 'Enquête réglementaire ouverte sur {asset}',
        body: '{actor} confirme l’ouverture d’une procédure visant les pratiques commerciales de {asset}. L’incertitude juridique ampute la valorisation de {pct} %.',
      },
      {
        headline: 'Départ surprise à la tête de {asset}',
        body: 'La démission immédiate du directeur général prive {asset} de sa feuille de route. {actor} juge la transition risquée ; le marché sanctionne le titre de {pct} %.',
      },
    ],
    crypto: [
      {
        headline: 'Liquidations en cascade : {ticker} perd {pct} %',
        body: 'Le franchissement d’un support majeur a déclenché la fermeture forcée des positions à effet de levier. {actor} évoque le plus fort volume de liquidations du trimestre.',
      },
      {
        headline: 'Faille exploitée sur une passerelle liée à {asset}',
        body: 'Les fonds détournés se comptent en millions et les retraits sont suspendus. {actor} appelle à la prudence ; {asset} recule de {pct} %.',
      },
      {
        headline: '{actor} durcit le cadre applicable à {asset}',
        body: 'Le nouveau régime impose des obligations de conservation et de déclaration coûteuses. Les intermédiaires réduisent leur exposition et {asset} cède {pct} %.',
      },
      {
        headline: 'Transfert massif détecté sur {asset}',
        body: '{actor} a déplacé une position considérable vers une plateforme d’échange, geste habituellement lu comme une intention de vente. Le comptant perd {pct} %.',
      },
    ],
    commodity: [
      {
        headline: '{asset} recule de {pct} % sur des stocks pléthoriques',
        body: 'Les réserves commerciales ressortent très au-dessus de leur moyenne saisonnière. {actor} anticipe un excédent d’offre prolongé et la courbe repasse en report.',
      },
      {
        headline: 'Demande en berne : {asset} sous pression',
        body: 'Les indicateurs avancés de l’industrie se dégradent dans les principales zones consommatrices. {actor} abaisse ses prévisions de {pct} % pour l’année.',
      },
      {
        headline: '{actor} relâche ses réserves stratégiques',
        body: 'La mise sur le marché de volumes supplémentaires casse net la dynamique haussière. {asset} abandonne {pct} % et la volatilité implicite bondit.',
      },
      {
        headline: 'Dollar ferme : {asset} abandonne {pct} %',
        body: 'Le renchérissement du billet vert pénalise les acheteurs hors zone dollar. {actor} constate un allègement marqué des positions acheteuses sur {asset}.',
      },
    ],
    macro: [
      {
        headline: '{actor} relève ses taux directeurs',
        body: 'Le resserrement, justifié par une inflation persistante, renchérit le financement de toute la cote. {asset} recule de {pct} % à l’annonce.',
      },
      {
        headline: 'Risque de récession : les places financières décrochent',
        body: '{actor} avertit d’un ralentissement plus marqué qu’anticipé. {asset} abandonne {pct} % dans une rotation générale vers les actifs défensifs.',
      },
      {
        headline: 'Tensions géopolitiques : aversion au risque généralisée',
        body: 'L’escalade constatée ce matin ravive la prime de risque sur toutes les classes d’actifs. {actor} appelle à la prudence ; {asset} perd {pct} % dans des volumes nourris.',
      },
      {
        headline: 'Choc budgétaire : {actor} alourdit la fiscalité',
        body: 'Le tour de vis annoncé ampute les perspectives de bénéfices. {asset} s’inscrit en baisse de {pct} % et les investisseurs réduisent la voilure.',
      },
    ],
  },
  neutral: {
    equity: [
      {
        headline: '{asset} : assemblée générale sans surprise',
        body: 'Toutes les résolutions présentées par le conseil ont été adoptées. {actor} ne modifie pas son scénario ; l’écart de cours reste contenu sous {pct} %.',
      },
      {
        headline: '{asset} confirme son calendrier de publication',
        body: 'Aucun élément nouveau n’a été communiqué à cette occasion. Le titre {ticker} évolue sans direction claire, dans une bande de {pct} %.',
      },
      {
        headline: 'Revue d’indice : {asset} conserve sa place',
        body: '{actor} maintient la pondération de {asset} à l’issue de la revue trimestrielle. Les arbitragistes ajustent à la marge, pour un impact limité à {pct} %.',
      },
      {
        headline: '{asset} nomme un nouveau directeur financier',
        body: 'La nomination était attendue et s’inscrit dans la continuité de la stratégie annoncée. {actor} juge l’effet neutre sur la trajectoire de {asset}.',
      },
    ],
    crypto: [
      {
        headline: '{asset} : activité réseau stable',
        body: 'Le nombre de transactions et les frais médians restent proches de leur moyenne mensuelle. {actor} n’observe aucun flux directionnel notable ; l’amplitude reste sous {pct} %.',
      },
      {
        headline: 'Report de la mise à jour de {asset}',
        body: 'Les développeurs privilégient une phase de test supplémentaire. {actor} rappelle que le calendrier initial n’était pas engageant ; {ticker} varie de {pct} %.',
      },
      {
        headline: '{actor} publie son rapport de réserves',
        body: 'L’audit confirme la couverture intégrale des avoirs de la clientèle. Le marché de {asset} accueille l’information sans réaction marquée.',
      },
      {
        headline: 'Consolidation technique sur {asset}',
        body: 'Après plusieurs séances de hausse, {asset} évolue latéralement dans un couloir de {pct} %. {actor} attend un catalyseur pour se repositionner.',
      },
    ],
    commodity: [
      {
        headline: '{asset} : stocks conformes aux attentes',
        body: 'La publication hebdomadaire ressort en ligne avec le consensus. {actor} ne modifie pas ses prévisions et {asset} oscille dans une plage de {pct} %.',
      },
      {
        headline: 'Maintenance planifiée chez un producteur de {asset}',
        body: 'L’arrêt technique, annoncé de longue date, était déjà intégré aux prix. {actor} n’anticipe aucune tension durable sur l’offre.',
      },
      {
        headline: '{actor} maintient ses quotas inchangés',
        body: 'La décision, conforme aux attentes, laisse le marché de {asset} sans catalyseur. Les écarts de séance restent inférieurs à {pct} %.',
      },
      {
        headline: 'Séance sans tendance sur {asset}',
        body: 'Les opérateurs restent en retrait avant les statistiques de fin de semaine. {actor} note des volumes inférieurs à la moyenne sur {ticker}.',
      },
    ],
    macro: [
      {
        headline: '{actor} laisse ses taux inchangés',
        body: 'La décision était unanimement anticipée et le communiqué reprend les termes du précédent. {asset} varie de moins de {pct} %.',
      },
      {
        headline: 'Statistiques d’emploi conformes au consensus',
        body: '{actor} publie des créations de postes en ligne avec les prévisions. Le scénario de politique monétaire reste inchangé et {asset} demeure stable.',
      },
      {
        headline: 'Réunion de {actor} : aucune annonce nouvelle',
        body: 'Les discussions se poursuivront lors de la prochaine session. Faute de catalyseur, {asset} évolue dans une bande étroite de {pct} %.',
      },
      {
        headline: 'Marchés attentistes avant les publications',
        body: '{actor} dévoilera ses projections en fin de semaine. Les opérateurs réduisent la voilure et {asset} termine proche de l’équilibre, à {pct} % près.',
      },
    ],
  },
};

/** Relative frequency of each magnitude. A shock must stay a genuine surprise. */
const MAGNITUDE_WEIGHTS: ReadonlyArray<readonly [EventMagnitude, number]> = [
  ['minor', 62],
  ['moderate', 26],
  ['major', 9],
  ['shock', 3],
];

const SENTIMENT_WEIGHTS: ReadonlyArray<readonly [Sentiment, number]> = [
  ['positive', 40],
  ['negative', 40],
  ['neutral', 20],
];

/** Probability that an opportunity produces a market-wide event rather than a single name. */
const MARKET_WIDE_CHANCE = 0.12;

/**
 * A sector-wide headline applied at full strength to twenty instruments at once
 * would move the whole index further than any single-name shock, so the pressure
 * each member receives is damped.
 */
const MARKET_WIDE_DAMPING = 0.6;

/** A neutral headline still nudges the tape, in either direction, but barely. */
const NEUTRAL_STRENGTH = 0.25;

/** Impact jitter so a given magnitude does not always print the same percentage. */
const JITTER_MIN = 0.7;
const JITTER_SPAN = 0.6;

const OPPORTUNITY_INTERVAL_MS = 5_000;
const CLEANUP_INTERVAL_MS = 3_600_000;

/** Opportunities evaluated per round, scaled so a large market still feels alive. */
const ASSETS_PER_OPPORTUNITY = 10;
const MAX_OPPORTUNITIES = 6;

/** What an event's pressure is applied to. */
type Scope =
  | { kind: 'asset'; ticker: string }
  | { kind: 'class'; assetClass: string }
  | { kind: 'market' };

export interface ManualEventInput {
  /** Null publishes a market-wide event affecting every tradable instrument. */
  ticker: string | null;
  headline: string;
  body: string;
  sentiment: Sentiment;
  magnitude: EventMagnitude;
  source?: Source;
  /** Overrides the signed impact derived from the magnitude, in bps. */
  impactBps?: number;
}

/**
 * Market news, generated locally.
 *
 * Events are the narrative layer over the random walk: every headline carries a
 * signed pressure that the price simulator releases over the event's lifetime, so
 * the story on screen and the move on the chart are the same thing.
 */
export class EventGenerator implements EngineModule {
  readonly name = 'events';

  private readonly ctx: EngineContext;
  private readonly engine: Engine;
  /**
   * A generator of its own, deliberately not the shared instance used by the
   * price walk: drawing news from the same stream would make the price sequence
   * depend on how many headlines happened to fire.
   */
  private readonly random = new Random();

  private timer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(ctx: EngineContext, engine: Engine) {
    this.ctx = ctx;
    this.engine = engine;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.round(), OPPORTUNITY_INTERVAL_MS);
    this.cleanupTimer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.ctx.log.info({ chancePerMille: EVENTS.chancePerMille }, 'event generator started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.timer = null;
    this.cleanupTimer = null;
  }

  // -------------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------------

  private async round(): Promise<void> {
    // Never let a slow insert stack rounds: doubling up would double the event rate.
    if (this.busy) return;
    const candidates = this.engine.all().filter((state) => state.isTradable);
    if (candidates.length === 0) return;

    const opportunities = Math.min(
      MAX_OPPORTUNITIES,
      Math.max(1, Math.round(candidates.length / ASSETS_PER_OPPORTUNITY)),
    );
    const probability = EVENTS.chancePerMille / 1_000;

    this.busy = true;
    try {
      for (let i = 0; i < opportunities; i += 1) {
        if (!this.random.chance(probability)) continue;
        await this.fire(candidates);
      }
    } catch (error) {
      this.ctx.log.error({ err: error }, 'market event generation failed');
    } finally {
      this.busy = false;
    }
  }

  private async fire(candidates: AssetState[]): Promise<void> {
    const sentiment = weighted(this.random, SENTIMENT_WEIGHTS);
    const magnitude = weighted(this.random, MAGNITUDE_WEIGHTS);
    const impactBps = this.signedImpact(sentiment, magnitude);

    let family: Family;
    let assetLabel: string;
    let tickerLabel: string;
    let scope: Scope;
    let ticker: string | null;

    if (this.random.chance(MARKET_WIDE_CHANCE)) {
      const assetClass = this.pickClass(candidates);
      family = 'macro';
      assetLabel = CLASS_LABEL[assetClass] ?? 'le marché';
      tickerLabel = assetClass;
      scope = { kind: 'class', assetClass };
      ticker = null;
    } else {
      const state = this.random.pick(candidates);
      family = FAMILY_BY_CLASS[state.assetClass] ?? 'equity';
      assetLabel = state.name;
      tickerLabel = state.ticker;
      scope = { kind: 'asset', ticker: state.ticker };
      ticker = state.ticker;
    }

    const values = {
      asset: assetLabel,
      ticker: tickerLabel,
      actor: this.random.pick(ACTORS[family]),
      pct: formatPercent(impactBps),
    };
    const template = this.random.pick(TEMPLATES[sentiment][family]);

    await publish(this.ctx.db, this.engine, {
      scope,
      ticker,
      headline: fill(template.headline, values),
      body: fill(template.body, values),
      sentiment,
      magnitude,
      impactBps,
      source: 'engine',
    });
  }

  /** Pick an asset class that actually has something tradable in it. */
  private pickClass(candidates: AssetState[]): string {
    const classes = [...new Set(candidates.map((state) => state.assetClass))];
    return this.random.pick(classes);
  }

  private signedImpact(sentiment: Sentiment, magnitude: EventMagnitude): number {
    const base = EVENTS.magnitudeBps[magnitude];
    const jittered = base * (JITTER_MIN + this.random.next() * JITTER_SPAN);
    if (sentiment === 'positive') return Math.max(1, Math.round(jittered));
    if (sentiment === 'negative') return -Math.max(1, Math.round(jittered));
    // Neutral news is not no news: it still moves the tape a little, either way.
    const direction = this.random.chance(0.5) ? 1 : -1;
    return direction * Math.max(1, Math.round(jittered * NEUTRAL_STRENGTH));
  }

  /**
   * Keep only the most recent headlines per instrument. Events are append-only
   * and the table would otherwise grow without bound for the whole life of the
   * simulation, for data nobody reads past the first page.
   */
  private async cleanup(): Promise<void> {
    try {
      await this.ctx.db.execute(sql`
        DELETE FROM market_events WHERE id IN (
          SELECT id FROM (
            SELECT id, row_number() OVER (PARTITION BY ticker ORDER BY created_at DESC, id DESC) AS rn
            FROM market_events
          ) ranked WHERE ranked.rn > ${EVENTS.historyPerAsset}
        )
      `);
    } catch (error) {
      this.ctx.log.error({ err: error }, 'failed to prune market events');
    }
  }
}

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

interface PublishInput {
  scope: Scope;
  ticker: string | null;
  headline: string;
  body: string;
  sentiment: Sentiment;
  magnitude: EventMagnitude;
  impactBps: number;
  source: Source;
}

/**
 * Single path from a headline to a price move: persist, pressure, broadcast.
 * The admin route goes through it too, so a hand-written event behaves exactly
 * like a generated one instead of being a second, subtly different code path.
 */
async function publish(db: Database, engine: Engine, input: PublishInput): Promise<MarketEvent> {
  const expiresAt = new Date(Date.now() + EVENTS.durationMs[input.magnitude]);

  const [row] = await db
    .insert(marketEvents)
    .values({
      ticker: input.ticker,
      headline: input.headline,
      body: input.body,
      sentiment: input.sentiment,
      magnitude: input.magnitude,
      impactBps: input.impactBps,
      source: input.source,
      expiresAt,
    })
    .returning();

  if (!row) throw new Error('Failed to persist market event');

  applyPressure(engine, input.scope, input.impactBps);

  const event: MarketEvent = {
    id: row.id,
    ticker: row.ticker,
    headline: row.headline,
    body: row.body,
    sentiment: row.sentiment,
    magnitude: row.magnitude,
    impactBps: row.impactBps,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
  engine.bus.emit('marketEvent', event);
  return event;
}

function applyPressure(engine: Engine, scope: Scope, impactBps: number): void {
  if (scope.kind === 'asset') {
    engine.applyPressure(scope.ticker, impactBps);
    return;
  }
  const damped = Math.round(impactBps * MARKET_WIDE_DAMPING);
  if (damped === 0) return;
  for (const state of engine.all()) {
    if (!state.isTradable) continue;
    if (scope.kind === 'class' && state.assetClass !== scope.assetClass) continue;
    engine.applyPressure(state.ticker, damped);
  }
}

/**
 * Publish an operator-written event (admin console, company announcement) through
 * the same pressure and broadcast path as the generator.
 */
export async function createManualEvent(
  db: Database,
  engine: Engine,
  input: ManualEventInput,
): Promise<MarketEvent> {
  const ticker = input.ticker ? input.ticker.toUpperCase() : null;
  const base = EVENTS.magnitudeBps[input.magnitude];
  const impactBps =
    input.impactBps ??
    (input.sentiment === 'positive' ? base : input.sentiment === 'negative' ? -base : Math.round(base * NEUTRAL_STRENGTH));

  const scope: Scope = ticker ? { kind: 'asset', ticker } : { kind: 'market' };

  return publish(db, engine, {
    scope,
    ticker,
    headline: input.headline,
    body: input.body,
    sentiment: input.sentiment,
    magnitude: input.magnitude,
    impactBps,
    source: input.source ?? 'admin',
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fill(template: string, values: Record<'asset' | 'ticker' | 'actor' | 'pct', string>): string {
  const filled = template
    .replace(/\{(asset|ticker|actor|pct)\}/g, (_, key: keyof typeof values) => values[key])
    // Substitution can leave "de Airbus"; elide it. Restricted to vowels because
    // an aspirated h ("de Honda") must not be elided.
    .replace(/\bde (?=[AEIOUYÀÂÉÈÊÎÔÛaeiouyàâéèêîôû])/g, 'd’');
  // Placeholders carry their natural lower case ("un analyste de..."), so a
  // sentence that opens on one would otherwise start with a lower-case letter.
  return filled.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

/** French copy uses a decimal comma; "1.5 %" in a headline reads as a typo. */
function formatPercent(impactBps: number): string {
  return (Math.abs(impactBps) / 100).toFixed(1).replace('.', ',');
}

function weighted<T>(random: Random, entries: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random.next() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}
