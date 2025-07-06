'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getAssets, AssetFromDb } from '@/lib/actions/assets';
import { getListedCompaniesForSimulation, CompanyForSimulation } from '@/lib/actions/companies';
import { subDays } from 'date-fns';

export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type AssetsMap = { [ticker: string]: AssetFromDb };
type HistoricalDataMap = { [ticker:string]: HistoricalDataPoint[] };

interface MarketDataContextType {
    assets: AssetFromDb[];
    getAssetByTicker: (ticker: string) => AssetFromDb | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
    refreshData: () => Promise<void>;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>({});
    const [initialAssets, setInitialAssets] = useState<AssetsMap>({});
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});
    const [listedCompanies, setListedCompanies] = useState<CompanyForSimulation[]>([]);

    const initializeMarket = useCallback(async () => {
        setLoading(true);
        const [assetsData, companiesData] = await Promise.all([
            getAssets(),
            getListedCompaniesForSimulation()
        ]);
        
        const assetsMap = assetsData.reduce((acc, asset) => {
            acc[asset.ticker] = asset;
            return acc;
        }, {} as AssetsMap);

        const initialAssetsMap = JSON.parse(JSON.stringify(assetsMap));

        setAssets(assetsMap);
        setInitialAssets(initialAssetsMap);
        setListedCompanies(companiesData);

        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        for (const ticker in assetsMap) {
            const asset = assetsMap[ticker];
            const oneDayAgo = subDays(now, 1);
            const data: HistoricalDataPoint[] = [];
            for (let i = 0; i < 48; i++) {
                const timestamp = oneDayAgo.getTime() + i * 30 * 60 * 1000;
                const priceFluctuation = asset.price * (1 + (Math.random() - 0.5) * 0.1);
                data.push({ date: new Date(timestamp).toISOString(), price: priceFluctuation });
            }
             data.push({ date: new Date(now).toISOString(), price: asset.price });
            initialHist[ticker] = data;
        }

        setHistoricalData(initialHist);
        setLoading(false);
    }, []);

    useEffect(() => {
        initializeMarket();
    }, [initializeMarket]);
    
    useEffect(() => {
        if (loading || Object.keys(initialAssets).length === 0) return;

        const simulationInterval = setInterval(() => {
            setAssets(currentAssets => {
                const newAssets = { ...currentAssets };
                const updatedTickers: { [ticker: string]: number } = {};
                
                // First, simulate regular assets
                for (const ticker in newAssets) {
                    const asset = { ...newAssets[ticker] };
                    if (asset.type === 'Company Share') continue;

                    const initialPrice = initialAssets[ticker]?.price;
                    if (!initialPrice) continue;

                    const volatility = asset.type === 'Crypto' || asset.type === 'Forex' ? 0.015 : 0.005;
                    const changeFactor = 1 + (Math.random() - 0.5) * 2 * volatility;
                    asset.price *= changeFactor;
                    updatedTickers[ticker] = asset.price;
                    
                    if (isNaN(asset.price) || !isFinite(asset.price) || asset.price <= 0) {
                        asset.price = initialPrice;
                    }

                    const change = asset.price - initialPrice;
                    const changePercent = (change / initialPrice) * 100;
                    asset.change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                    
                    newAssets[ticker] = asset;
                }

                // Now, update company share prices based on their NAV and market pressure
                for (const company of listedCompanies) {
                    const companyAsset = newAssets[company.ticker];
                    if (!companyAsset) continue;

                    const holdingsValue = company.holdings.reduce((sum, holding) => {
                        const assetPrice = newAssets[holding.ticker]?.price || 0;
                        return sum + (assetPrice * holding.quantity);
                    }, 0);

                    const btcPrice = newAssets['BTC']?.price || 0;
                    const unclaimedBtcValue = company.unclaimedBtc * btcPrice;
                    
                    const companyValue = company.cash + holdingsValue + company.miningRigsValue + unclaimedBtcValue;
                    const navPerShare = companyValue > 0 && company.totalShares > 0 ? companyValue / company.totalShares : 0;
                    
                    const marketPrice = companyAsset.price;
                    const noise = (Math.random() - 0.5) * marketPrice * 0.001; // +/- 0.05% noise
                    
                    // Gravitational pull towards NAV
                    const gravity = (navPerShare - marketPrice) * 0.01; // Pulls 1% towards NAV each tick

                    let newSharePrice = marketPrice + gravity + noise;

                    if (isNaN(newSharePrice) || newSharePrice <= 0) {
                        newSharePrice = marketPrice; // Revert if invalid
                    }

                    updatedTickers[company.ticker] = newSharePrice;
                    
                    const initialCompanyPrice = initialAssets[company.ticker]?.price || company.initialSharePrice;
                    const change = newSharePrice - initialCompanyPrice;
                    const changePercent = initialCompanyPrice > 0 ? (change / initialCompanyPrice) * 100 : 0;
                    
                    companyAsset.price = newSharePrice;
                    companyAsset.change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                    
                    const marketCap = newSharePrice * company.totalShares;
                    let marketCapString = `$${marketCap.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
                    if (marketCap >= 1e12) marketCapString = `$${(marketCap / 1e12).toFixed(2)}T`;
                    else if (marketCap >= 1e9) marketCapString = `$${(marketCap / 1e9).toFixed(2)}B`;
                    else if (marketCap >= 1e6) marketCapString = `$${(marketCap / 1e6).toFixed(2)}M`;
                    companyAsset.marketCap = marketCapString;
                }
                
                setHistoricalData(currentHistData => {
                    const newHistData = { ...currentHistData };
                    for (const ticker in updatedTickers) {
                        const newPrice = updatedTickers[ticker];
                        const newPoint = { date: new Date().toISOString(), price: newPrice };
                        const updatedHistory = [...(newHistData[ticker] || []), newPoint].slice(-100);
                        newHistData[ticker] = updatedHistory;
                    }
                    return newHistData;
                });
                
                return newAssets;
            });
        }, 3000);

        return () => clearInterval(simulationInterval);
    }, [loading, initialAssets, listedCompanies]);

    const getAssetByTicker = useCallback((ticker: string): AssetFromDb | undefined => {
        return assets[ticker];
    }, [assets]);

    const getHistoricalData = useCallback((ticker: string): HistoricalDataPoint[] => {
        return historicalData[ticker] || [];
    }, [historicalData]);
    
    const assetsArray = React.useMemo(() => Object.values(assets), [assets]);

    const value = {
        assets: assetsArray,
        getAssetByTicker,
        getHistoricalData,
        loading,
        refreshData: initializeMarket,
    };
    
    return (
        <MarketDataContext.Provider value={value}>
            {loading ? (
                <div className="flex h-screen w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                children
            )}
        </MarketDataContext.Provider>
    );
};

export const useMarketData = () => {
    const context = useContext(MarketDataContext);
    if (context === undefined) {
        throw new Error('useMarketData must be used within a MarketDataProvider');
    }
    return context;
};
