export interface DetailedAsset {
    ticker: string;
    name: string;
    type: 'Stock' | 'Crypto' | 'Forex' | 'Commodity';
    price: number;
    description: string;
    marketCap: string;
    change24h: string;
}

// These are only used to seed the database the very first time.
// The source of truth is then Firestore.
export const assets: DetailedAsset[] = [
    // Tech Giants
    { name: 'Apple Inc.', ticker: 'AAPL', price: 210.00, type: 'Stock', description: 'Designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.', marketCap: '$3.2T', change24h: '+0.00%' },
    { name: 'Microsoft Corp.', ticker: 'MSFT', price: 445.00, type: 'Stock', description: 'Develops, licenses, and supports software, services, devices, and solutions worldwide.', marketCap: '$3.3T', change24h: '+0.00%' },
    { name: 'Amazon.com, Inc.', ticker: 'AMZN', price: 185.00, type: 'Stock', description: 'Engages in the retail sale of consumer products and subscriptions in North America and internationally.', marketCap: '$1.9T', change24h: '+0.00%' },
    { name: 'NVIDIA Corporation', ticker: 'NVDA', price: 125.00, type: 'Stock', description: 'Provides graphics, and compute and networking solutions in the United States, Taiwan, China, and internationally.', marketCap: '$3.0T', change24h: '+0.00%' },
    { name: 'Alphabet Inc. (Google)', ticker: 'GOOGL', price: 179.00, type: 'Stock', description: 'An American multinational conglomerate holding company. It is the parent company of Google.', marketCap: '$2.2T', change24h: '+0.00%' },
    { name: 'Meta Platforms, Inc.', ticker: 'META', price: 500.00, type: 'Stock', description: 'Engages in the development of social media applications. It builds technology that helps people connect, find communities, and grow businesses.', marketCap: '$1.2T', change24h: '+0.00%' },
    { name: 'Tesla, Inc.', ticker: 'TSLA', price: 180.00, type: 'Stock', description: 'Designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems.', marketCap: '$570B', change24h: '+0.00%' },
    { name: 'Samsung Electronics', ticker: 'SMSG', price: 1550.00, type: 'Stock', description: 'A South Korean multinational electronics corporation headquartered in Yeongtong-gu, Suwon.', marketCap: '$450B', change24h: '+0.00%' },
    { name: 'Intel Corporation', ticker: 'INTC', price: 30.00, type: 'Stock', description: 'Engages in the design, manufacture, and sale of computer products and technologies.', marketCap: '$130B', change24h: '+0.00%' },
    { name: 'IBM', ticker: 'IBM', price: 170.00, type: 'Stock', description: 'An American multinational technology corporation providing hosting and consulting services.', marketCap: '$157B', change24h: '+0.00%' },
    { name: 'Nokia Corporation', ticker: 'NOK', price: 3.80, type: 'Stock', description: 'A Finnish multinational telecommunications, information technology, and consumer electronics company.', marketCap: '$21B', change24h: '+0.00%' },
    
    // Crypto
    { name: 'Bitcoin', ticker: 'BTC', price: 68000.00, type: 'Crypto', description: 'A decentralized digital currency, without a central bank or single administrator.', marketCap: '$1.3T', change24h: '+0.00%' },
    { name: 'Ethereum', ticker: 'ETH', price: 3500.00, type: 'Crypto', description: 'A decentralized, open-source blockchain with smart contract functionality.', marketCap: '$420B', change24h: '+0.00%' },
    { name: 'Solana', ticker: 'SOL', price: 150.00, type: 'Crypto', description: 'A high-performance blockchain supporting builders around the world creating crypto apps that scale.', marketCap: '$69B', change24h: '+0.00%' },
    { name: 'Dogecoin', ticker: 'DOGE', price: 0.15, type: 'Crypto', description: 'An open source peer-to-peer digital currency, favored by Shiba Inus worldwide.', marketCap: '$21B', change24h: '+0.00%' },
    
    // French Tech & Industry
    { name: 'OVH Groupe', ticker: 'OVH', price: 10.00, type: 'Stock', description: 'A French cloud computing company that offers VPS, dedicated servers and other web services.', marketCap: '€1.7B', change24h: '+0.00%' },
    { name: 'Dassault Systèmes', ticker: 'DSY', price: 35.00, type: 'Stock', description: 'A French software company that develops 3D design, 3D digital mock-up, and product lifecycle management (PLM) software.', marketCap: '€46B', change24h: '+0.00%' },
    { name: 'Capgemini SE', ticker: 'CAP', price: 200.00, type: 'Stock', description: 'A French multinational information technology services and consulting company.', marketCap: '€34B', change24h: '+0.00%' },
    { name: 'Ubisoft Entertainment', ticker: 'UBI', price: 22.00, type: 'Stock', description: 'A French video game company, known for publishing games in several acclaimed video game franchises.', marketCap: '€2.8B', change24h: '+0.00%' },
    { name: 'Kering SA', ticker: 'KER', price: 325.00, type: 'Stock', description: 'A French-based multinational corporation specializing in luxury goods.', marketCap: '€40B', change24h: '+0.00%' },
    { name: 'LVMH Moët Hennessy', ticker: 'LVMH', price: 730.00, type: 'Stock', description: 'A French multinational luxury goods conglomerate headquartered in Paris.', marketCap: '€365B', change24h: '+0.00%' },

    // Entertainment & Gaming
    { name: 'The Walt Disney Company', ticker: 'DIS', price: 102.00, type: 'Stock', description: 'A multinational mass media and entertainment conglomerate.', marketCap: '$186B', change24h: '+0.00%' },
    { name: 'Netflix, Inc.', ticker: 'NFLX', price: 670.00, type: 'Stock', description: 'A subscription streaming service and production company.', marketCap: '$290B', change24h: '+0.00%' },
    { name: 'Nintendo Co., Ltd.', ticker: 'NTDOY', price: 13.50, type: 'Stock', description: 'A Japanese multinational video game company that develops, publishes, and releases video games and gaming consoles.', marketCap: '$65B', change24h: '+0.00%' },
    { name: 'Take-Two Interactive', ticker: 'TTWO', price: 160.00, type: 'Stock', description: 'An American video game holding company that owns publishers Rockstar Games and 2K.', marketCap: '$27B', change24h: '+0.00%' },
    { name: 'Spotify Technology S.A.', ticker: 'SPOT', price: 315.00, type: 'Stock', description: 'A Swedish audio streaming and media services provider.', marketCap: '$62B', change24h: '+0.00%' },

    // Global Brands & Services
    { name: 'Uber Technologies, Inc.', ticker: 'UBER', price: 70.00, type: 'Stock', description: 'A technology company that offers services including ride-hailing, food delivery (Uber Eats), and freight transport.', marketCap: '$145B', change24h: '+0.00%' },
    { name: 'Starbucks Corporation', ticker: 'SBUX', price: 80.00, type: 'Stock', description: 'An American multinational chain of coffeehouses and roastery reserves.', marketCap: '$90B', change24h: '+0.00%' },
    { name: 'McDonald\'s Corp.', ticker: 'MCD', price: 260.00, type: 'Stock', description: 'Operates and franchises McDonald\'s restaurants worldwide.', marketCap: '$186B', change24h: '+0.00%' },
    { name: 'The Coca-Cola Company', ticker: 'KO', price: 63.00, type: 'Stock', description: 'A beverage company that manufactures, markets, and sells various nonalcoholic beverages worldwide.', marketCap: '$270B', change24h: '+0.00%' },
    { name: 'NIKE, Inc.', ticker: 'NKE', price: 95.00, type: 'Stock', description: 'Engages in the design, development, marketing, and sale of athletic footwear, apparel, equipment, and accessories.', marketCap: '$143B', change24h: '+0.00%' },
    
    // Automotive
    { name: 'Toyota Motor Corp.', ticker: 'TM', price: 205.00, type: 'Stock', description: 'A Japanese multinational automotive manufacturer.', marketCap: '$270B', change24h: '+0.00%' },
    { name: 'Ford Motor Company', ticker: 'F', price: 12.00, type: 'Stock', description: 'An American multinational automobile manufacturer.', marketCap: '$48B', change24h: '+0.00%' },
    { name: 'BMW Group', ticker: 'BMW', price: 90.00, type: 'Stock', description: 'A German multinational company which produces automobiles and motorcycles.', marketCap: '€58B', change24h: '+0.00%' },

    // Finance
    { name: 'JPMorgan Chase & Co.', ticker: 'JPM', price: 198.00, type: 'Stock', description: 'An American multinational financial services company.', marketCap: '$570B', change24h: '+0.00%' },
    { name: 'The Goldman Sachs Group', ticker: 'GS', price: 458.00, type: 'Stock', description: 'An American multinational investment bank and financial services company.', marketCap: '$148B', change24h: '+0.00%' },
    
    // Commodities & Forex
    { name: 'Gold Spot', ticker: 'XAU', price: 2350.00, type: 'Commodity', description: 'Represents the price for one troy ounce of gold on the spot market.', marketCap: '$15.8T', change24h: '+0.00%' },
    { name: 'Crude Oil (WTI)', ticker: 'OIL', price: 80.00, type: 'Commodity', description: 'West Texas Intermediate crude oil, a benchmark in oil pricing.', marketCap: 'N/A', change24h: '+0.00%' },
    { name: 'GBP/JPY', ticker: 'GBPJPY', price: 200.50, type: 'Forex', description: 'The currency exchange rate for the British Pound and the Japanese Yen.', marketCap: 'N/A', change24h: '+0.00%' },
];
