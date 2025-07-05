import type { Asset } from '@/context/portfolio-context';

export interface DetailedAsset extends Asset {
    description: string;
    marketCap: string;
    change24h: string;
}

export const assets: DetailedAsset[] = [
    { name: 'Apple Inc.', ticker: 'AAPL', price: 207.69, type: 'Stock', description: 'Designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.', marketCap: '$3.18T', change24h: '+1.24%' },
    { name: 'Microsoft Corp.', ticker: 'MSFT', price: 442.57, type: 'Stock', description: 'Develops, licenses, and supports software, services, devices, and solutions worldwide.', marketCap: '$3.29T', change24h: '+0.92%' },
    { name: 'Amazon.com, Inc.', ticker: 'AMZN', price: 183.63, type: 'Stock', description: 'Engages in the retail sale of consumer products and subscriptions in North America and internationally.', marketCap: '$1.91T', change24h: '-0.10%' },
    { name: 'Bitcoin', ticker: 'BTC', price: 67120.50, type: 'Crypto', description: 'A decentralized digital currency, without a central bank or single administrator.', marketCap: '$1.32T', change24h: '+2.10%' },
    { name: 'Ethereum', ticker: 'ETH', price: 3450.78, type: 'Crypto', description: 'A decentralized, open-source blockchain with smart contract functionality.', marketCap: '$414.5B', change24h: '-1.50%' },
    { name: 'Gold Spot', ticker: 'XAU', price: 2320.50, type: 'Commodity', description: 'Represents the price for one troy ounce of gold on the spot market.', marketCap: '$15.8T', change24h: '+0.50%' },
    { name: 'EUR/USD', ticker: 'EURUSD', price: 1.0712, type: 'Forex', description: 'The currency exchange rate for the Euro and the U.S. Dollar.', marketCap: 'N/A', change24h: '-0.21%' },
    { name: 'NVIDIA Corporation', ticker: 'NVDA', price: 120.89, type: 'Stock', description: 'Provides graphics, and compute and networking solutions in the United States, Taiwan, China, and internationally.', marketCap: '$2.97T', change24h: '+8.97%' },
    { name: 'Tesla, Inc.', ticker: 'TSLA', price: 177.46, type: 'Stock', description: 'Designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems.', marketCap: '$565.4B', change24h: '+5.42%' },
];

export const getAssetByTicker = (ticker: string) => {
    return assets.find(a => a.ticker === ticker);
}

export const generateHistoricalData = (basePrice: number, days: number) => {
    const data = [];
    let price = basePrice;
    const now = new Date();
    const minutesPerPoint = 10;
    const totalMinutes = days * 24 * 60;
    const pointsToGenerate = totalMinutes / minutesPerPoint;

    for (let i = 0; i < pointsToGenerate; i++) {
        const date = new Date(now.getTime() - (pointsToGenerate - i - 1) * minutesPerPoint * 60 * 1000);
        
        // Increased volatility for more dynamic charts
        const fluctuation = (Math.random() - 0.5) * price * 0.01;
        price += fluctuation;
        price = Math.max(price, 0.1); 
        
        data.push({
            date: date.toISOString(),
            price: parseFloat(price.toFixed(2)),
        });
    }
    return data;
};
