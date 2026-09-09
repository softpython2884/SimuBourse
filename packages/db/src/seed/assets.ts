/**
 * The Alvora asset universe.
 *
 * Prices are the anchor the simulation mean-reverts toward; they are fictional
 * reference points for a game, not live market data.
 */
export interface SeedAsset {
  ticker: string;
  name: string;
  assetClass: 'Stock' | 'Crypto' | 'Forex' | 'Commodity' | 'Index' | 'ETF' | 'Bond';
  description: string;
  price: string;
  circulatingSupply?: string;
  chain?: string;
  sigmaBps?: number;
  driftBps?: number;
}

export const SEED_ASSETS: SeedAsset[] = [
  // --- Technology ----------------------------------------------------------
  { ticker: 'APLE', name: 'Aplex Devices', assetClass: 'Stock', price: '212.40', circulatingSupply: '15200000000', description: "Conçoit et vend des smartphones, ordinateurs et objets connectés dans le monde entier." },
  { ticker: 'MCSF', name: 'Macrosoft Systems', assetClass: 'Stock', price: '441.80', circulatingSupply: '7400000000', description: 'Éditeur de systèmes d’exploitation, de logiciels professionnels et de services cloud.' },
  { ticker: 'NVDR', name: 'Nividar Graphics', assetClass: 'Stock', price: '128.90', circulatingSupply: '24600000000', description: 'Processeurs graphiques et accélérateurs de calcul pour l’intelligence artificielle.', sigmaBps: 90 },
  { ticker: 'ALPH', name: 'Alphaline Holdings', assetClass: 'Stock', price: '178.20', circulatingSupply: '12300000000', description: 'Moteur de recherche, publicité en ligne et infrastructure cloud.' },
  { ticker: 'MTAV', name: 'Metavia Social', assetClass: 'Stock', price: '498.10', circulatingSupply: '2500000000', description: 'Réseaux sociaux, messagerie et plateformes de réalité mixte.', sigmaBps: 75 },
  { ticker: 'ZMZN', name: 'Zamazon Commerce', assetClass: 'Stock', price: '186.75', circulatingSupply: '10400000000', description: 'Commerce en ligne, logistique et hébergement cloud.' },
  { ticker: 'INTL', name: 'Intelia Semiconductors', assetClass: 'Stock', price: '31.20', circulatingSupply: '4200000000', description: 'Conception et fabrication de processeurs pour serveurs et postes de travail.' },
  { ticker: 'OVHX', name: 'Ovhex Cloud', assetClass: 'Stock', price: '10.45', circulatingSupply: '190000000', description: 'Hébergeur européen de serveurs dédiés et de cloud souverain.', sigmaBps: 80 },
  { ticker: 'DSSY', name: 'Dassium Systems', assetClass: 'Stock', price: '35.60', circulatingSupply: '1320000000', description: 'Logiciels de conception 3D et de gestion du cycle de vie produit.' },
  { ticker: 'CPGM', name: 'Capgemio Consulting', assetClass: 'Stock', price: '198.30', circulatingSupply: '172000000', description: 'Conseil en transformation numérique et intégration de systèmes.' },

  // --- Automotive & industry ----------------------------------------------
  { ticker: 'TSLR', name: 'Teslar Motors', assetClass: 'Stock', price: '181.60', circulatingSupply: '3180000000', description: 'Véhicules électriques, batteries et systèmes de stockage d’énergie.', sigmaBps: 110 },
  { ticker: 'TOYT', name: 'Toyoda Motor', assetClass: 'Stock', price: '204.90', circulatingSupply: '1320000000', description: 'Constructeur automobile généraliste et pionnier de l’hybride.' },
  { ticker: 'FRDM', name: 'Fordham Automotive', assetClass: 'Stock', price: '12.35', circulatingSupply: '3970000000', description: 'Véhicules utilitaires, pick-ups et motorisations électriques.' },
  { ticker: 'BMWG', name: 'Bavaria Motor Group', assetClass: 'Stock', price: '91.20', circulatingSupply: '638000000', description: 'Automobiles et motocycles haut de gamme.' },
  { ticker: 'ARBS', name: 'Airbase Aerospace', assetClass: 'Stock', price: '148.70', circulatingSupply: '786000000', description: 'Avions commerciaux, hélicoptères et systèmes spatiaux.' },
  { ticker: 'SIEM', name: 'Siemera Industrie', assetClass: 'Stock', price: '172.40', circulatingSupply: '800000000', description: 'Automatisation industrielle, mobilité et technologies médicales.' },

  // --- Consumer & luxury ---------------------------------------------------
  { ticker: 'LVMX', name: 'Lumex Moët Group', assetClass: 'Stock', price: '728.50', circulatingSupply: '500000000', description: 'Maroquinerie, mode, vins et spiritueux de luxe.' },
  { ticker: 'KERN', name: 'Kerning Luxe', assetClass: 'Stock', price: '321.80', circulatingSupply: '123000000', description: 'Groupe de maisons de mode et d’accessoires de luxe.' },
  { ticker: 'NIKA', name: 'Nikara Sportswear', assetClass: 'Stock', price: '94.60', circulatingSupply: '1510000000', description: 'Chaussures, vêtements et équipements de sport.' },
  { ticker: 'COKA', name: 'Colava Beverages', assetClass: 'Stock', price: '62.90', circulatingSupply: '4310000000', description: 'Boissons non alcoolisées distribuées mondialement.', sigmaBps: 25 },
  { ticker: 'MCDL', name: 'McDonalds Restaurants', assetClass: 'Stock', price: '259.40', circulatingSupply: '720000000', description: 'Chaîne mondiale de restauration rapide en franchise.', sigmaBps: 28 },
  { ticker: 'STRB', name: 'Starbrew Coffee', assetClass: 'Stock', price: '79.80', circulatingSupply: '1130000000', description: 'Torréfaction et réseau international de cafés.' },

  // --- Media & entertainment ----------------------------------------------
  { ticker: 'NFLIX', name: 'Netflax Streaming', assetClass: 'Stock', price: '668.20', circulatingSupply: '430000000', description: 'Abonnement de streaming vidéo et production de contenus originaux.', sigmaBps: 70 },
  { ticker: 'DSNY', name: 'Disnara Entertainment', assetClass: 'Stock', price: '101.60', circulatingSupply: '1820000000', description: 'Studios, parcs à thème et distribution de contenus.' },
  { ticker: 'SPFY', name: 'Spotifly Audio', assetClass: 'Stock', price: '313.40', circulatingSupply: '198000000', description: 'Streaming musical et podcasts sur abonnement.', sigmaBps: 85 },
  { ticker: 'UBSF', name: 'Ubisoftware Games', assetClass: 'Stock', price: '21.70', circulatingSupply: '128000000', description: 'Édition de jeux vidéo et licences interactives.', sigmaBps: 120 },
  { ticker: 'TTWI', name: 'Take-Twice Interactive', assetClass: 'Stock', price: '158.90', circulatingSupply: '170000000', description: 'Studios de jeux vidéo et franchises à succès.', sigmaBps: 95 },
  { ticker: 'NTDO', name: 'Nintenda Interactive', assetClass: 'Stock', price: '13.65', circulatingSupply: '1160000000', description: 'Consoles de jeu et licences familiales emblématiques.' },

  // --- Finance & health ----------------------------------------------------
  { ticker: 'JPMG', name: 'JP Morgen Bank', assetClass: 'Stock', price: '196.30', circulatingSupply: '2870000000', description: 'Banque universelle, gestion d’actifs et banque d’investissement.' },
  { ticker: 'GDSX', name: 'Goldsax Group', assetClass: 'Stock', price: '455.10', circulatingSupply: '325000000', description: 'Banque d’investissement et courtage institutionnel.' },
  { ticker: 'AXAS', name: 'Axastra Assurance', assetClass: 'Stock', price: '34.80', circulatingSupply: '2260000000', description: 'Assurance dommages, santé et gestion d’épargne.', sigmaBps: 30 },
  { ticker: 'PFZR', name: 'Pfizor Pharma', assetClass: 'Stock', price: '28.40', circulatingSupply: '5650000000', description: 'Recherche pharmaceutique, vaccins et traitements spécialisés.' },
  { ticker: 'SNFI', name: 'Sanofia Santé', assetClass: 'Stock', price: '92.10', circulatingSupply: '1250000000', description: 'Médicaments de prescription et santé grand public.' },

  // --- Energy --------------------------------------------------------------
  { ticker: 'TTLE', name: 'Totalia Energies', assetClass: 'Stock', price: '61.40', circulatingSupply: '2350000000', description: 'Pétrole, gaz, électricité et énergies renouvelables.' },
  { ticker: 'ORNO', name: 'Orano Nucléaire', assetClass: 'Stock', price: '45.90', circulatingSupply: '380000000', description: 'Cycle du combustible nucléaire et démantèlement.' },
  { ticker: 'SOLR', name: 'Solaris Renewables', assetClass: 'Stock', price: '18.25', circulatingSupply: '640000000', description: 'Parcs solaires, éoliens et stockage réseau.', sigmaBps: 105 },

  // --- Crypto (each mirrors a simulated chain) -----------------------------
  { ticker: 'BTC', name: 'Bitcoin', assetClass: 'Crypto', chain: 'BTC', price: '67850.00', circulatingSupply: '19700000', description: 'La première monnaie numérique décentralisée, sécurisée par preuve de travail.' },
  { ticker: 'ETH', name: 'Ethereum', assetClass: 'Crypto', chain: 'ETH', price: '3480.00', circulatingSupply: '120200000', description: 'Chaîne programmable exécutant des contrats intelligents.' },
  { ticker: 'SOL', name: 'Solana', assetClass: 'Crypto', chain: 'SOL', price: '148.60', circulatingSupply: '465000000', description: 'Chaîne à haut débit optimisée pour les applications à faible latence.', sigmaBps: 200 },
  { ticker: 'DOGE', name: 'Dogecoin', assetClass: 'Crypto', chain: 'DOGE', price: '0.1512', circulatingSupply: '144000000000', description: 'Cryptomonnaie communautaire née d’un mème, inflationniste par conception.', sigmaBps: 240 },
  { ticker: 'XRPL', name: 'Rippex', assetClass: 'Crypto', price: '0.5240', circulatingSupply: '55000000000', description: 'Réseau de règlement interbancaire à confirmation rapide.', sigmaBps: 180 },
  { ticker: 'ADAX', name: 'Cardana', assetClass: 'Crypto', price: '0.4180', circulatingSupply: '35000000000', description: 'Chaîne à preuve d’enjeu fondée sur des méthodes formelles.', sigmaBps: 175 },
  { ticker: 'AVAX', name: 'Avalancia', assetClass: 'Crypto', price: '27.35', circulatingSupply: '395000000', description: 'Réseau de sous-chaînes interopérables à finalité immédiate.', sigmaBps: 210 },
  { ticker: 'LINX', name: 'Chainlinx', assetClass: 'Crypto', price: '14.80', circulatingSupply: '620000000', description: 'Oracles décentralisés reliant les contrats aux données externes.', sigmaBps: 190 },

  // --- Forex (quoted against the platform currency) ------------------------
  { ticker: 'EURUSD', name: 'Euro / Dollar US', assetClass: 'Forex', price: '1.0842', description: 'Taux de change entre l’euro et le dollar américain.', sigmaBps: 10 },
  { ticker: 'GBPUSD', name: 'Livre sterling / Dollar US', assetClass: 'Forex', price: '1.2715', description: 'Taux de change entre la livre sterling et le dollar américain.', sigmaBps: 12 },
  { ticker: 'USDJPY', name: 'Dollar US / Yen', assetClass: 'Forex', price: '157.20', description: 'Taux de change entre le dollar américain et le yen japonais.', sigmaBps: 14 },
  { ticker: 'GBPJPY', name: 'Livre sterling / Yen', assetClass: 'Forex', price: '199.85', description: 'Croisement volatil très suivi par les cambistes.', sigmaBps: 18 },
  { ticker: 'USDCHF', name: 'Dollar US / Franc suisse', assetClass: 'Forex', price: '0.8940', description: 'Paire refuge très corrélée à l’aversion au risque.', sigmaBps: 11 },
  { ticker: 'AUDUSD', name: 'Dollar australien / Dollar US', assetClass: 'Forex', price: '0.6650', description: 'Paire sensible aux matières premières et à la demande asiatique.', sigmaBps: 13 },

  // --- Commodities ---------------------------------------------------------
  { ticker: 'XAU', name: 'Or (once troy)', assetClass: 'Commodity', price: '2348.00', description: 'Prix au comptant d’une once troy d’or, valeur refuge historique.', sigmaBps: 25 },
  { ticker: 'XAG', name: 'Argent (once troy)', assetClass: 'Commodity', price: '29.40', description: 'Métal précieux à double usage, monétaire et industriel.', sigmaBps: 45 },
  { ticker: 'WTI', name: 'Pétrole brut WTI', assetClass: 'Commodity', price: '79.80', description: 'Référence du brut léger américain.', sigmaBps: 60 },
  { ticker: 'BRNT', name: 'Pétrole Brent', assetClass: 'Commodity', price: '83.10', description: 'Référence mondiale du brut de mer du Nord.', sigmaBps: 58 },
  { ticker: 'NGAS', name: 'Gaz naturel', assetClass: 'Commodity', price: '2.640', description: 'Contrat de gaz naturel, très sensible à la météo.', sigmaBps: 120 },
  { ticker: 'CPPR', name: 'Cuivre', assetClass: 'Commodity', price: '4.520', description: 'Métal industriel baromètre de la croissance mondiale.', sigmaBps: 40 },
  { ticker: 'WHET', name: 'Blé', assetClass: 'Commodity', price: '5.890', description: 'Contrat céréalier de référence.', sigmaBps: 50 },

  // --- Indices -------------------------------------------------------------
  { ticker: 'ALV40', name: 'Alvora 40', assetClass: 'Index', price: '7820.00', description: 'Indice phare regroupant les 40 plus grandes capitalisations d’Alvora.', sigmaBps: 22 },
  { ticker: 'ALVTC', name: 'Alvora Tech 100', assetClass: 'Index', price: '18420.00', description: 'Indice des cent premières valeurs technologiques.', sigmaBps: 34 },
  { ticker: 'ALVEU', name: 'Alvora Europe 600', assetClass: 'Index', price: '512.40', description: 'Indice large européen toutes capitalisations.', sigmaBps: 20 },
  { ticker: 'ALVCR', name: 'Alvora Crypto 10', assetClass: 'Index', price: '1284.60', description: 'Panier pondéré des dix premières cryptomonnaies.', sigmaBps: 130 },

  // --- ETFs ----------------------------------------------------------------
  { ticker: 'EWLD', name: 'ETF Monde Actions', assetClass: 'ETF', price: '412.30', description: 'Fonds indiciel répliquant un panier mondial d’actions.', sigmaBps: 24 },
  { ticker: 'ETEC', name: 'ETF Technologie', assetClass: 'ETF', price: '268.90', description: 'Fonds indiciel concentré sur le secteur technologique.', sigmaBps: 38 },
  { ticker: 'EGLD', name: 'ETF Or physique', assetClass: 'ETF', price: '221.70', description: 'Fonds adossé à de l’or physique conservé en coffre.', sigmaBps: 24 },
  { ticker: 'EEMG', name: 'ETF Marchés émergents', assetClass: 'ETF', price: '48.60', description: 'Fonds indiciel sur les marchés émergents.', sigmaBps: 36 },

  // --- Bonds ---------------------------------------------------------------
  { ticker: 'OAT10', name: 'Obligation d’État 10 ans', assetClass: 'Bond', price: '98.40', description: 'Emprunt souverain de référence à dix ans.', sigmaBps: 6 },
  { ticker: 'CORPA', name: 'Obligation corporate AA', assetClass: 'Bond', price: '101.20', description: 'Dette d’entreprise très bien notée, faible risque de défaut.', sigmaBps: 8 },
  { ticker: 'HYLD', name: 'Obligation haut rendement', assetClass: 'Bond', price: '92.70', description: 'Dette spéculative offrant un coupon élevé contre un risque accru.', sigmaBps: 18 },
];
