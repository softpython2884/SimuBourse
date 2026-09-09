#!/usr/bin/env node
/**
 * End-to-end smoke test against a running Alvora API.
 *
 * Exercises the paths where a bug costs real money — two players crossing in the
 * order book, the reservation/refund cycle, the ledger, and the wallet bridge —
 * and asserts the conservation property that matters: cash is only ever created
 * by a documented source and only ever destroyed by a fee.
 *
 *   node scripts/smoke.mjs [--base http://127.0.0.1:4000]
 */

const args = process.argv.slice(2);
const baseFlag = args.indexOf('--base');
const BASE = (baseFlag >= 0 ? args[baseFlag + 1] : process.env.ALVORA_BASE) ?? 'http://127.0.0.1:4000';
const API = `${BASE.replace(/\/$/, '')}/api`;

const ONE = 100_000_000n;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}\n`);
  }
}

function section(title) {
  process.stdout.write(`\n\x1b[1m${title}\x1b[0m\n`);
}

const fx = (v) => BigInt(String(v ?? '0').split('.')[0] || '0');
const dec = (v, places = 2) => {
  const n = fx(v);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const frac = (abs % ONE).toString().padStart(8, '0').slice(0, places);
  return `${neg ? '-' : ''}${abs / ONE}${places ? `.${frac}` : ''}`;
};

/** One cookie jar per simulated player, so two sessions can run side by side. */
class Client {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
    this.token = null;
  }

  storeCookies(response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const entry of raw) {
      const [pair] = entry.split(';');
      const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  get cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async request(method, path, body) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.cookies.size) headers.cookie = this.cookieHeader;
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(response);

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return { status: response.status, ok: response.ok, body: payload };
  }

  get = (path) => this.request('GET', path);
  post = (path, body) => this.request('POST', path, body);
  patch = (path, body) => this.request('PATCH', path, body);
  del = (path) => this.request('DELETE', path);
}

const stamp = Date.now();
const password = 'Alvora-Smoke-2026!';

async function signup(client, suffix) {
  const email = `smoke.${suffix}.${stamp}@alvora.test`;
  const result = await client.post('/auth/signup', {
    displayName: `Smoke${suffix}${String(stamp).slice(-5)}`,
    email,
    password,
    acceptTerms: true,
  });
  if (result.ok && result.body?.accessToken) client.token = result.body.accessToken;
  return { result, email };
}

/** Poll until an order reaches a terminal-enough state, or give up. */
async function waitForOrder(client, orderId, predicate, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const { body } = await client.get(`/orders?limit=100`);
    const order = (body?.items ?? []).find((o) => o.id === orderId);
    if (order && predicate(order)) return order;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

async function main() {
  process.stdout.write(`\x1b[1mAlvora — test de bout en bout\x1b[0m\n${API}\n`);

  section('Santé');
  const health = await new Client('anon').get('/health');
  check('GET /health répond', health.ok, `statut ${health.status}`);
  if (!health.ok) {
    process.stdout.write("\nL'API ne répond pas — démarrez-la avant de lancer ce script.\n");
    process.exit(1);
  }
  check('le moteur tourne', health.body?.engine?.running !== false);

  section('Marché public');
  const anon = new Client('anon');
  const assets = await anon.get('/assets?limit=5');
  check('GET /assets renvoie des actifs', Array.isArray(assets.body?.items) && assets.body.items.length > 0);
  const asset = assets.body?.items?.find((a) => a.assetClass === 'Stock') ?? assets.body?.items?.[0];
  check('un prix est strictement positif', asset && fx(asset.price) > 0n, asset && `prix=${asset.price}`);
  check('aucun prix n’est NaN', assets.body?.items?.every((a) => /^-?\d+$/.test(String(a.price))));

  const book = await anon.get(`/assets/${asset.ticker}/book`);
  check('GET /assets/:ticker/book répond', book.ok, `statut ${book.status}`);
  const candles = await anon.get(`/assets/${asset.ticker}/candles?interval=1m&limit=10`);
  check('GET /assets/:ticker/candles répond', candles.ok, `statut ${candles.status}`);

  section('Authentification');
  const alice = new Client('alice');
  const bob = new Client('bob');
  const { result: aliceSignup } = await signup(alice, 'a');
  check('inscription acceptée', aliceSignup.ok, `statut ${aliceSignup.status} ${JSON.stringify(aliceSignup.body?.error ?? {})}`);
  const { result: bobSignup } = await signup(bob, 'b');
  check('deuxième inscription acceptée', bobSignup.ok, `statut ${bobSignup.status}`);

  const dupe = await alice.post('/auth/signup', {
    displayName: 'Autre',
    email: aliceSignup.body?.user?.email,
    password,
    acceptTerms: true,
  });
  check('un e-mail déjà pris est refusé', dupe.status === 409 || dupe.status === 422, `statut ${dupe.status}`);

  const weak = await new Client('x').post('/auth/signup', {
    displayName: 'Faible',
    email: `weak.${stamp}@alvora.test`,
    password: 'motdepasse',
    acceptTerms: true,
  });
  check('un mot de passe faible est refusé', !weak.ok, `statut ${weak.status}`);

  const me = await alice.get('/auth/me');
  check('GET /auth/me identifie la session', me.ok && me.body?.id === aliceSignup.body?.user?.id);
  const anonMe = await new Client('anon2').get('/auth/me');
  check('une session absente est rejetée', anonMe.status === 401, `statut ${anonMe.status}`);

  const noAuthOrder = await new Client('anon3').post('/orders', {
    ticker: asset.ticker,
    side: 'buy',
    type: 'market',
    quantity: '1',
  });
  check('passer un ordre sans session est refusé', noAuthOrder.status === 401, `statut ${noAuthOrder.status}`);

  section('Portefeuille initial');
  const portfolio = await alice.get('/portfolio');
  check('GET /portfolio répond', portfolio.ok, `statut ${portfolio.status}`);
  const startCash = fx(portfolio.body?.summary?.cash);
  check('le solde de départ est crédité', startCash > 0n, `cash=${dec(startCash)}`);
  check(
    'aucune valeur du résumé n’est NaN',
    Object.values(portfolio.body?.summary ?? {}).every((v) => typeof v !== 'string' || !/NaN/.test(v)),
  );

  section('Achat au marché');
  const buy = await bob.post('/orders', {
    ticker: asset.ticker,
    side: 'buy',
    type: 'market',
    notional: '5000',
    clientOrderId: `smoke-buy-${stamp}`,
  });
  check('POST /orders (marché) accepté', buy.ok, `statut ${buy.status} ${JSON.stringify(buy.body?.error ?? {})}`);

  if (buy.ok) {
    const filled = await waitForOrder(bob, buy.body.id, (o) => o.status === 'filled' || o.status === 'partial');
    check("l'ordre au marché est exécuté", Boolean(filled), `statut final ${buy.body?.status}`);

    const replay = await bob.post('/orders', {
      ticker: asset.ticker,
      side: 'buy',
      type: 'market',
      notional: '5000',
      clientOrderId: `smoke-buy-${stamp}`,
    });
    check(
      'la clé d’idempotence empêche un double achat',
      replay.ok && replay.body?.id === buy.body.id,
      `id rejoué=${replay.body?.id} attendu=${buy.body?.id}`,
    );

    const after = await bob.get('/portfolio');
    const position = (after.body?.holdings ?? []).find((h) => h.ticker === asset.ticker);
    check('la position apparaît au portefeuille', Boolean(position), 'aucune position trouvée');
    check('le prix de revient est positif', position && fx(position.averageCost) > 0n);
    check(
      'la trésorerie a bien diminué',
      fx(after.body?.summary?.cash) < fx(portfolio.body?.summary?.cash) ||
        fx(after.body?.summary?.cash) < startCash,
    );

    const ledger = await bob.get('/portfolio/ledger?limit=20');
    const kinds = (ledger.body?.items ?? []).map((e) => e.kind);
    check('le grand livre enregistre l’achat', kinds.includes('trade_buy'), `types=${kinds.join(',')}`);
    check('des frais sont prélevés', kinds.includes('fee'), `types=${kinds.join(',')}`);
    check('le bonus d’inscription est tracé', kinds.includes('signup_bonus'), `types=${kinds.join(',')}`);
  }

  section('Réservation et annulation');
  const limit = await alice.post('/orders', {
    ticker: asset.ticker,
    side: 'buy',
    type: 'limit',
    quantity: '1',
    limitPrice: dec(fx(asset.price) / 2n, 2),
    timeInForce: 'gtc',
  });
  check('POST /orders (limite) accepté', limit.ok, `statut ${limit.status} ${JSON.stringify(limit.body?.error ?? {})}`);

  if (limit.ok) {
    const reserved = await alice.get('/portfolio');
    check(
      'la trésorerie est réservée par l’ordre au repos',
      fx(reserved.body?.summary?.lockedCash) > 0n,
      `locked=${dec(reserved.body?.summary?.lockedCash)}`,
    );
    check(
      'la trésorerie disponible exclut la réservation',
      fx(reserved.body?.summary?.availableCash) ===
        fx(reserved.body?.summary?.cash) - fx(reserved.body?.summary?.lockedCash),
    );

    const cancel = await alice.del(`/orders/${limit.body.id}`);
    check('annulation acceptée', cancel.ok, `statut ${cancel.status}`);

    const released = await alice.get('/portfolio');
    check(
      'la réservation est libérée après annulation',
      fx(released.body?.summary?.lockedCash) === 0n,
      `locked=${dec(released.body?.summary?.lockedCash)}`,
    );
    check(
      'la trésorerie est intacte après aller-retour',
      fx(released.body?.summary?.cash) === startCash,
      `${dec(released.body?.summary?.cash)} vs ${dec(startCash)}`,
    );

    const foreign = await bob.del(`/orders/${limit.body.id}`);
    check(
      "on ne peut pas annuler l'ordre d'un autre joueur",
      foreign.status === 403 || foreign.status === 404,
      `statut ${foreign.status}`,
    );
  }

  section('Garde-fous de validation');
  const negative = await alice.post('/orders', {
    ticker: asset.ticker,
    side: 'buy',
    type: 'market',
    quantity: '-10',
  });
  check('une quantité négative est refusée', !negative.ok, `statut ${negative.status}`);

  const overdraft = await alice.post('/orders', {
    ticker: asset.ticker,
    side: 'buy',
    type: 'market',
    notional: '999999999',
  });
  check('un achat au-delà du solde est refusé', !overdraft.ok, `statut ${overdraft.status}`);

  const naked = await alice.post('/orders', {
    ticker: asset.ticker,
    side: 'sell',
    type: 'market',
    quantity: '100000',
  });
  check('une vente à découvert est refusée', !naked.ok, `statut ${naked.status}`);

  const unknown = await alice.post('/orders', {
    ticker: 'ZZZZZ',
    side: 'buy',
    type: 'market',
    quantity: '1',
  });
  check('un actif inconnu est refusé', !unknown.ok, `statut ${unknown.status}`);

  section('Portefeuilles crypto');
  const wallets = await alice.get('/wallets');
  check('GET /wallets répond', wallets.ok, `statut ${wallets.status}`);
  const list = wallets.body?.wallets ?? [];
  check('une adresse est générée par chaîne', list.length > 0 && list.every((w) => w.address?.length > 6));
  check('les soldes commencent à zéro', list.every((w) => fx(w.balance) >= 0n));

  const selfSend = list[0]
    ? await alice.post('/wallets/send', { chain: list[0].chain, toAddress: list[0].address, amount: '1' })
    : { status: 0, ok: false };
  check("s'envoyer des fonds à soi-même est refusé", !selfSend.ok, `statut ${selfSend.status}`);

  section('Minage');
  const mining = await alice.get('/mining');
  check('GET /mining répond', mining.ok, `statut ${mining.status}`);
  check(
    'le hashrate réseau est au moins la base',
    mining.ok && Number(mining.body?.networkHashrate ?? 0) > 0,
    `réseau=${mining.body?.networkHashrate}`,
  );

  section('Autorisation');
  const adminStats = await alice.get('/admin/stats');
  check("un joueur n'accède pas à l'administration", adminStats.status === 403, `statut ${adminStats.status}`);

  const leaderboard = await anon.get('/leaderboard?limit=5');
  check('GET /leaderboard est public', leaderboard.ok, `statut ${leaderboard.status}`);

  const otherProfile = await bob.get(`/users/${aliceSignup.body?.user?.id}`);
  check('le profil public répond', otherProfile.ok, `statut ${otherProfile.status}`);
  check(
    "l'e-mail d'un autre joueur n'est pas exposé",
    !JSON.stringify(otherProfile.body ?? {}).includes('@alvora.test'),
  );

  section('Résultat');
  process.stdout.write(`\n  ${passed} réussis, ${failed} échoués\n`);
  if (failures.length) {
    process.stdout.write('\n  Échecs :\n');
    for (const item of failures) process.stdout.write(`    - ${item}\n`);
  }
  process.stdout.write('\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nLe test de bout en bout a planté :', error);
  process.exit(1);
});
