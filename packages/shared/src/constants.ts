/**
 * Alvora economy constants.
 *
 * Every tunable of the simulation lives here so the game can be balanced in one
 * place instead of being scattered across components the way the legacy app did it.
 * Values are plain integers/bps; convert with the helpers in `decimal.ts`.
 */

export const PLATFORM_NAME = 'Alvora';
export const PLATFORM_TAGLINE = 'Alvora Bourse';

// --- Onboarding -------------------------------------------------------------

/** Starting cash for a new account, in whole currency units. */
export const STARTING_CASH = 100_000;

/** Daily login bonus, in whole currency units. */
export const DAILY_BONUS = 250;

/** The platform's fiat currency. */
export const CURRENCY_CODE = 'ALV';
export const CURRENCY_SYMBOL = '₳';

// --- Fees (basis points: 100 bps = 1%) --------------------------------------

export const FEES = {
  /** Taker fee on spot trades. */
  spotTakerBps: 20,
  /** Maker fee — lower, to reward resting liquidity. */
  spotMakerBps: 5,
  /** Fee on peer-to-peer OTC settlements. */
  otcBps: 10,
  /** Fee taken from a prediction-market pool on settlement. */
  predictionMarketBps: 200,
  /** Fee charged when a company issues shares to the public (IPO). */
  ipoBps: 150,
  /** Cut taken from crypto swaps, on top of slippage. */
  swapBps: 30,
  /** Minimum fee charged on any trade, in whole currency units. */
  minimumFee: 0.01,
} as const;

// --- Market engine ----------------------------------------------------------

export const ENGINE = {
  /** Milliseconds between price ticks. One authoritative loop, server side. */
  tickIntervalMs: 2_000,
  /** Milliseconds between order-book matching passes for resting orders. */
  matchIntervalMs: 1_000,
  /** How often OHLCV candles are flushed to the database. */
  candleFlushMs: 5_000,
  /** How often the engine persists prices (batched, not once per tick). */
  persistIntervalMs: 10_000,
  /** Maximum candles returned by a single history request. */
  maxCandles: 1_500,
  /** Ticks of price history kept in memory per symbol for the sparkline. */
  sparklineLength: 60,
  /**
   * Strength of order-flow price impact. A net buy of `impactReferenceVolume`
   * moves the price by `impactBps` basis points. This is what makes the market
   * genuinely multiplayer: players move prices, not just the random walk.
   */
  impactBps: 25,
  impactReferenceVolume: 250_000,
  /** Mean reversion pull toward the anchor price, per tick, in bps. */
  meanReversionBps: 3,
  /** Hard circuit breaker: a single tick can never move a price more than this. */
  maxTickMoveBps: 800,
  /** Price floor as a fraction of the anchor price, in bps (prevents zero/negative). */
  priceFloorBps: 100,
  /** Price ceiling as a multiple of the anchor price, in bps. */
  priceCeilingBps: 2_000_000,
} as const;

/** Per-asset-class volatility (bps of standard deviation per tick) and drift. */
export const VOLATILITY = {
  Stock: { sigmaBps: 45, driftBps: 1 },
  Crypto: { sigmaBps: 160, driftBps: 2 },
  Forex: { sigmaBps: 12, driftBps: 0 },
  Commodity: { sigmaBps: 35, driftBps: 1 },
  Index: { sigmaBps: 28, driftBps: 1 },
  ETF: { sigmaBps: 30, driftBps: 1 },
  Bond: { sigmaBps: 6, driftBps: 0 },
  Company: { sigmaBps: 70, driftBps: 0 },
} as const;

export type AssetClass = keyof typeof VOLATILITY;

export const ASSET_CLASSES = Object.keys(VOLATILITY) as AssetClass[];

// --- Trading limits ---------------------------------------------------------

export const TRADING = {
  /** Smallest tradable quantity, in whole units of the asset. */
  minQuantity: '0.00000001',
  /** Largest notional a single order may carry, in whole currency units. */
  maxOrderNotional: 500_000_000,
  /** Maximum open orders a single account may hold. */
  maxOpenOrdersPerUser: 200,
  /** Maximum price bands for a limit order, in bps around the last trade. */
  limitPriceBandBps: 50_000,
  /** How long a resting order lives before expiring, in hours (0 = never). */
  defaultOrderTtlHours: 0,
  /** Slippage protection applied to market orders, in bps. */
  marketOrderSlippageBps: 500,
} as const;

// --- Crypto wallets & chains ------------------------------------------------

/**
 * Simulated chains. Each has its own address format, block time and fee model,
 * so a wallet feels meaningfully different from a brokerage position.
 */
export const CHAINS = {
  BTC: {
    name: 'Bitcoin',
    symbol: 'BTC',
    addressPrefix: 'alv1q',
    addressLength: 38,
    blockTimeSeconds: 60,
    confirmationsRequired: 3,
    /** Base network fee in whole units of the chain's native coin. */
    baseFee: '0.00004000',
    feeVarianceBps: 4_000,
    mineable: true,
    stakeable: false,
    /** Annual percentage yield for staking, in bps. */
    stakingApyBps: 0,
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'ETH',
    addressPrefix: '0xa1',
    addressLength: 42,
    blockTimeSeconds: 12,
    confirmationsRequired: 12,
    baseFee: '0.00080000',
    feeVarianceBps: 6_000,
    mineable: false,
    stakeable: true,
    stakingApyBps: 380,
  },
  SOL: {
    name: 'Solana',
    symbol: 'SOL',
    addressPrefix: 'ALV',
    addressLength: 44,
    blockTimeSeconds: 1,
    confirmationsRequired: 32,
    baseFee: '0.00001000',
    feeVarianceBps: 1_500,
    mineable: false,
    stakeable: true,
    stakingApyBps: 620,
  },
  DOGE: {
    name: 'Dogecoin',
    symbol: 'DOGE',
    addressPrefix: 'ALVD',
    addressLength: 34,
    blockTimeSeconds: 60,
    confirmationsRequired: 6,
    baseFee: '0.50000000',
    feeVarianceBps: 2_000,
    mineable: true,
    stakeable: false,
    stakingApyBps: 0,
  },
} as const;

export type ChainSymbol = keyof typeof CHAINS;
export const CHAIN_SYMBOLS = Object.keys(CHAINS) as ChainSymbol[];

export const WALLET = {
  /** Minimum staking lock, in hours. */
  minStakeHours: 24,
  /** Penalty for unstaking early, in bps of the staked amount. */
  earlyUnstakePenaltyBps: 500,
  /** Maximum wallet transfers a user may send per hour (anti-spam / anti-wash). */
  maxTransfersPerHour: 30,
  /** How often the simulated chains produce a block, in ms. */
  blockTickMs: 1_000,
} as const;

// --- Mining -----------------------------------------------------------------

/**
 * Mining rigs. Reward is shared: a miner earns `blockReward × (their hashrate /
 * total network hashrate)`, so every rig bought by any player dilutes everyone.
 * The legacy version paid a flat rate per rig, which made it free money.
 */
export const MINING_RIGS = [
  { id: 'usb-asic', name: 'USB ASIC Stick', price: 250, hashrate: 5, powerWatts: 8, chain: 'BTC' },
  { id: 'antminer-s9', name: 'Antminer S9', price: 1_200, hashrate: 32, powerWatts: 1_350, chain: 'BTC' },
  { id: 'antminer-s19', name: 'Antminer S19 Pro', price: 6_500, hashrate: 190, powerWatts: 3_250, chain: 'BTC' },
  { id: 'whatsminer-m50', name: 'Whatsminer M50S', price: 9_800, hashrate: 280, powerWatts: 3_900, chain: 'BTC' },
  { id: 'hydro-farm', name: 'Hydro Immersion Farm', price: 48_000, hashrate: 1_500, powerWatts: 18_000, chain: 'BTC' },
  { id: 'datacenter-pod', name: 'Datacenter Pod', price: 250_000, hashrate: 9_000, powerWatts: 96_000, chain: 'BTC' },
  { id: 'doge-scrypt-l7', name: 'Scrypt Miner L7', price: 14_000, hashrate: 420, powerWatts: 3_400, chain: 'DOGE' },
] as const;

export type MiningRigId = (typeof MINING_RIGS)[number]['id'];

export const MINING = {
  /** Coins minted per block, per chain, in whole units. */
  blockReward: { BTC: '0.05000000', DOGE: '250.00000000' } as Record<string, string>,
  /** How often a block is mined and rewards distributed, in ms. */
  blockIntervalMs: 60_000,
  /** Baseline network hashrate so a lone early miner does not take everything. */
  baselineHashrate: 2_000,
  /** Electricity cost per watt-hour, in whole currency units. */
  electricityCostPerWh: 0.00018,
  /** Rig resale value as a fraction of purchase price, in bps. */
  resaleValueBps: 6_000,
  /** Maximum rigs of a single model a user may own. */
  maxRigsPerModel: 500,
} as const;

// --- Companies --------------------------------------------------------------

export const COMPANY = {
  /** Cost to found a company, in whole currency units. */
  creationCost: 25_000,
  /** Shares issued at founding, all held by the founder. */
  foundingShares: 1_000_000,
  /** Minimum treasury required before a company may go public. */
  ipoMinimumTreasury: 50_000,
  /** Minimum age of a company before IPO, in hours. */
  ipoMinimumAgeHours: 24,
  /** Fraction of shares that must be floated at IPO, in bps. */
  ipoMinimumFloatBps: 1_000,
  ipoMaximumFloatBps: 7_500,
  /** Company revenue is generated every this many ms. */
  revenueIntervalMs: 300_000,
  /** Maximum members in a company. */
  maxMembers: 50,
  /** Maximum companies a single user may found. */
  maxCompaniesPerUser: 5,
  /** Dividend payouts may not exceed this share of treasury, in bps. */
  maxDividendBps: 5_000,
  /** Cooldown between dividend distributions, in hours. */
  dividendCooldownHours: 24,
  /** Ticker constraints. */
  tickerMinLength: 2,
  tickerMaxLength: 5,
} as const;

/**
 * Industries a company can operate in. `marginBps` drives passive revenue,
 * `volatilityBps` drives how strongly its share price reacts to market events.
 */
export const INDUSTRIES = [
  { id: 'tech', name: 'Technologie', marginBps: 320, volatilityBps: 90, capitalIntensity: 140 },
  { id: 'finance', name: 'Finance', marginBps: 240, volatilityBps: 70, capitalIntensity: 200 },
  { id: 'energy', name: 'Énergie', marginBps: 280, volatilityBps: 110, capitalIntensity: 260 },
  { id: 'retail', name: 'Commerce', marginBps: 150, volatilityBps: 50, capitalIntensity: 90 },
  { id: 'industry', name: 'Industrie', marginBps: 190, volatilityBps: 60, capitalIntensity: 220 },
  { id: 'health', name: 'Santé', marginBps: 260, volatilityBps: 80, capitalIntensity: 180 },
  { id: 'media', name: 'Médias & Divertissement', marginBps: 210, volatilityBps: 100, capitalIntensity: 70 },
  { id: 'crypto', name: 'Crypto & Web3', marginBps: 400, volatilityBps: 180, capitalIntensity: 120 },
  { id: 'luxury', name: 'Luxe', marginBps: 350, volatilityBps: 75, capitalIntensity: 160 },
  { id: 'transport', name: 'Transport & Logistique', marginBps: 170, volatilityBps: 65, capitalIntensity: 240 },
] as const;

export type IndustryId = (typeof INDUSTRIES)[number]['id'];

/** Company roles, ordered from most to least privileged. */
export const COMPANY_ROLES = ['ceo', 'director', 'trader', 'member'] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

/** What each role is allowed to do. Checked server-side on every mutation. */
export const COMPANY_PERMISSIONS: Record<CompanyRole, readonly string[]> = {
  ceo: [
    'company:update', 'company:delete', 'company:ipo', 'company:dividend',
    'treasury:deposit', 'treasury:withdraw', 'trade:execute', 'mining:manage',
    'members:invite', 'members:remove', 'members:role', 'shares:issue', 'shares:buyback',
  ],
  director: [
    'company:update', 'company:dividend', 'treasury:deposit', 'treasury:withdraw',
    'trade:execute', 'mining:manage', 'members:invite',
  ],
  trader: ['treasury:deposit', 'trade:execute', 'mining:manage'],
  member: ['treasury:deposit'],
};

// --- Prediction markets -----------------------------------------------------

export const PREDICTION = {
  /** Cost to open a market, in whole currency units. */
  creationCost: 500,
  minOutcomes: 2,
  maxOutcomes: 8,
  minBet: 10,
  maxBet: 1_000_000,
  /** How far in the future a market may close, in hours. */
  minDurationHours: 1,
  maxDurationHours: 24 * 90,
  /** Share of the losing pool paid to the market creator, in bps. */
  creatorCutBps: 100,
  /** A market with no bets on the winning side refunds everyone. */
  refundOnEmptyWinner: true,
} as const;

// --- Loans & banking --------------------------------------------------------

export const BANK = {
  /** Annual interest on cash left idle, in bps. */
  savingsApyBps: 120,
  /** Annual interest charged on loans, in bps. */
  loanApyBps: 900,
  /** Maximum loan as a multiple of net worth, in bps. */
  maxLoanToNetWorthBps: 5_000,
  /** Minimum net worth before borrowing is allowed, in whole currency units. */
  minNetWorthToBorrow: 10_000,
  /** Loan term options, in days. */
  termDays: [7, 30, 90] as const,
  /** Interest is accrued this often. */
  accrualIntervalMs: 3_600_000,
  /** Loan is liquidated when collateral ratio falls below this, in bps. */
  liquidationThresholdBps: 11_000,
} as const;

// --- Social & anti-abuse ----------------------------------------------------

export const LIMITS = {
  displayNameMin: 3,
  displayNameMax: 24,
  passwordMin: 10,
  passwordMax: 200,
  chatMessageMax: 500,
  chatMessagesPerMinute: 10,
  bioMax: 500,
  watchlistMax: 100,
  priceAlertsMax: 50,
  /** Login attempts allowed per IP per 15 minutes. */
  loginAttemptsPer15Min: 10,
  /** Registrations allowed per IP per hour. */
  signupsPerHour: 5,
  /** Generic API requests per minute per IP. */
  requestsPerMinute: 300,
  /** Session lifetimes. */
  accessTokenMinutes: 15,
  refreshTokenDays: 30,
} as const;

export const LEADERBOARD = {
  /** How often ranks are recomputed, in ms. */
  refreshMs: 30_000,
  pageSize: 50,
} as const;

/** Chat rooms available to every player. */
export const CHAT_ROOMS = [
  { id: 'general', name: 'Général' },
  { id: 'trading', name: 'Trading' },
  { id: 'crypto', name: 'Crypto' },
  { id: 'companies', name: 'Entreprises' },
  { id: 'help', name: 'Entraide' },
] as const;

// --- Market events ----------------------------------------------------------

/**
 * Deterministic market-event generator weights. The legacy app called an LLM to
 * invent news, which made price movement unreproducible, slow and billable.
 * Alvora generates events locally and only *optionally* enriches the prose.
 */
export const EVENTS = {
  /** Probability an event fires on a given tick, per mille. */
  chancePerMille: 6,
  /** Impact of an event on the affected asset, in bps, by magnitude. */
  magnitudeBps: { minor: 150, moderate: 500, major: 1_500, shock: 4_000 },
  /** How long an event keeps pressuring the price, in ms. */
  durationMs: { minor: 60_000, moderate: 180_000, major: 600_000, shock: 1_800_000 },
  /** Number of headlines retained per asset. */
  historyPerAsset: 50,
} as const;

export type EventMagnitude = keyof typeof EVENTS.magnitudeBps;

// --- Achievements -----------------------------------------------------------

export const ACHIEVEMENTS = [
  { id: 'first-trade', name: 'Premier ordre', description: 'Exécuter votre première transaction.', reward: 100 },
  { id: 'first-profit', name: 'Dans le vert', description: 'Clôturer une position gagnante.', reward: 250 },
  { id: 'diversified', name: 'Diversifié', description: 'Détenir 10 actifs différents simultanément.', reward: 1_000 },
  { id: 'millionaire', name: 'Millionnaire', description: 'Atteindre 1 000 000 de valeur nette.', reward: 5_000 },
  { id: 'founder', name: 'Fondateur', description: 'Créer votre première entreprise.', reward: 500 },
  { id: 'public-company', name: 'Introduction en bourse', description: 'Introduire une entreprise en bourse.', reward: 2_500 },
  { id: 'miner', name: 'Mineur', description: 'Miner votre premier bloc.', reward: 250 },
  { id: 'whale', name: 'Baleine', description: 'Détenir 10 BTC.', reward: 10_000 },
  { id: 'oracle', name: 'Oracle', description: 'Gagner 5 paris de prédiction.', reward: 2_000 },
  { id: 'market-maker', name: 'Teneur de marché', description: 'Faire exécuter 50 ordres limites.', reward: 3_000 },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];
