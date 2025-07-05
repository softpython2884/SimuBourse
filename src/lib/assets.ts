import type { Asset } from '@/context/portfolio-context';

export interface DetailedAsset extends Asset {
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

    // Crypto
    { name: 'Bitcoin', ticker: 'BTC', price: 68000.00, type: 'Crypto', description: 'A decentralized digital currency, without a central bank or single administrator.', marketCap: '$1.3T', change24h: '+0.00%' },
    { name: 'Ethereum', ticker: 'ETH', price: 3500.00, type: 'Crypto', description: 'A decentralized, open-source blockchain with smart contract functionality.', marketCap: '$420B', change24h: '+0.00%' },
    { name: 'Solana', ticker: 'SOL', price: 150.00, type: 'Crypto', description: 'A high-performance blockchain supporting builders around the world creating crypto apps that scale.', marketCap: '$69B', change24h: '+0.00%' },
    { name: 'Dogecoin', ticker: 'DOGE', price: 0.15, type: 'Crypto', description: 'An open source peer-to-peer digital currency, favored by Shiba Inus worldwide.', marketCap: '$21B', change24h: '+0.00%' },
    
    // French Tech & Industry
    { name: 'OVH Groupe', ticker: 'OVH', price: 10.00, type: 'Stock', description: 'A French cloud computing company that offers VPS, dedicated servers and other web services.', marketCap: '€1.7B', change24h: '+0.00%' },
    { name: 'Dassault Systèmes', ticker: 'DSY', price: 35.00, type: 'Stock', description: 'A French software company that develops 3D design, 3D digital mock-up, and product lifecycle management (PLM) software.', marketCap: '€46B', change24h: '+0.00%' },
    { name: 'Capgemini SE', ticker: 'CAP', price: 200.00, type: 'Stock', description: 'A French multinational information technology services and consulting company.', marketCap: '€34B', change24h: '+0.00%' },

    // Global Brands
    { name: 'McDonald\'s Corp.', ticker: 'MCD', price: 260.00, type: 'Stock', description: 'Operates and franchises McDonald\'s restaurants worldwide.', marketCap: '$186B', change24h: '+0.00%' },
    { name: 'The Coca-Cola Company', ticker: 'KO', price: 63.00, type: 'Stock', description: 'A beverage company that manufactures, markets, and sells various nonalcoholic beverages worldwide.', marketCap: '$270B', change24h: '+0.00%' },
    { name: 'NIKE, Inc.', ticker: 'NKE', price: 95.00, type: 'Stock', description: 'Engages in the design, development, marketing, and sale of athletic footwear, apparel, equipment, and accessories.', marketCap: '$143B', change24h: '+0.00%' },
    { name: 'LVMH Moët Hennessy', ticker: 'LVMH', price: 730.00, type: 'Stock', description: 'A French multinational luxury goods conglomerate headquartered in Paris.', marketCap: '€365B', change24h: '+0.00%' },
    { name: 'Toyota Motor Corp.', ticker: 'TM', price: 205.00, type: 'Stock', description: 'A Japanese multinational automotive manufacturer.', marketCap: '$270B', change24h: '+0.00%' },

    // Commodities & Forex
    { name: 'Gold Spot', ticker: 'XAU', price: 2350.00, type: 'Commodity', description: 'Represents the price for one troy ounce of gold on the spot market.', marketCap: '$15.8T', change24h: '+0.00%' },
    { name: 'Crude Oil (WTI)', ticker: 'OIL', price: 80.00, type: 'Commodity', description: 'West Texas Intermediate crude oil, a benchmark in oil pricing.', marketCap: 'N/A', change24h: '+0.00%' },
    { name: 'EUR/USD', ticker: 'EURUSD', price: 1.07, type: 'Forex', description: 'The currency exchange rate for the Euro and the U.S. Dollar.', marketCap: 'N/A', change24h: '+0.00%' },
    { name: 'GBP/JPY', ticker: 'GBPJPY', price: 200.50, type: 'Forex', description: 'The currency exchange rate for the British Pound and the Japanese Yen.', marketCap: 'N/A', change24h: '+0.00%' },
];
