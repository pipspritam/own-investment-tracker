import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AssetAllocation, MFFund, MFTransaction, PortfolioSummary, Stock, StockTransaction } from '../types';
import * as db from '../db/database';
import { fetchFundDetails } from '../services/mfapi';
import { fetchStockPrice } from '../services/stockPrice';

interface InvestmentContextType {
  assets: AssetAllocation[];
  funds: MFFund[];
  transactions: MFTransaction[];
  stocks: Stock[];
  stockTransactions: StockTransaction[];
  portfolioSummary: PortfolioSummary;
  isRefreshingNAVs: boolean;
  isRefreshingStockPrices: boolean;
  refreshData: () => void;
  updateAsset: (id: number, currentValue: number, investedAmount?: number) => void;
  updateFundValue: (fundId: number, currentValue: number) => void;
  addNewTransaction: (tx: {
    fund_id: number;
    date: string;
    type: 'BUY' | 'SELL';
    amount: number;
    nav?: number;
    units?: number;
  }) => void;
  addBatchTransactions: (
    fundId: number,
    transactions: Array<{
      date: string;
      type: 'BUY' | 'SELL';
      amount: number;
      nav?: number;
      units?: number;
    }>
  ) => void;
  addNewFund: (
    name: string,
    folio: string,
    currentValue?: number,
    schemeCode?: string,
    currentNav?: number,
    navDate?: string
  ) => number;
  updateFundDetails: (
    fundId: number,
    data: {
      name?: string;
      folio_number?: string;
      scheme_code?: string;
      current_value?: number;
      current_nav?: number;
      nav_date?: string;
    }
  ) => void;
  recalculateFundFromNAV: (fundId: number, latestNav: number, navDate: string) => void;
  refreshAllFundNAVs: () => Promise<{ success: number; failed: number }>;
  refreshAllStockPrices: () => Promise<{ success: number; failed: number }>;
  removeFund: (fundId: number) => void;
  editTransaction: (tx: {
    id: number;
    date: string;
    type: 'BUY' | 'SELL';
    amount: number;
    nav?: number;
    units?: number;
  }) => void;
  deleteTransaction: (id: number) => void;

  // Stock operations
  addNewStock: (
    name: string,
    symbol?: string,
    currentValue?: number,
    currentPrice?: number,
    priceDate?: string,
    dayChangePct?: number
  ) => number;
  updateStockValue: (stockId: number, currentValue: number) => void;
  updateStockDetails: (
    stockId: number,
    data: { name?: string; symbol?: string; current_value?: number }
  ) => void;
  removeStock: (stockId: number) => void;
  addNewStockTransaction: (tx: {
    stock_id: number;
    date: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    price: number;
    quantity: number;
    amount?: number;
  }) => void;
  editStockTransaction: (tx: {
    id: number;
    date: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    price: number;
    quantity: number;
    amount?: number;
  }) => void;
  deleteStockTransaction: (id: number) => void;
}

const InvestmentContext = createContext<InvestmentContextType | undefined>(undefined);

export const InvestmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<AssetAllocation[]>([]);
  const [funds, setFunds] = useState<MFFund[]>([]);
  const [transactions, setTransactions] = useState<MFTransaction[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [isRefreshingNAVs, setIsRefreshingNAVs] = useState(false);
  const [isRefreshingStockPrices, setIsRefreshingStockPrices] = useState(false);

  const refreshData = useCallback(() => {
    try {
      const freshAssets = db.fetchAssetAllocations();
      const freshFunds = db.fetchFunds();
      const freshTransactions = db.fetchTransactions();
      const freshStocks = db.fetchStocks();
      const freshStockTransactions = db.fetchStockTransactions();
      setAssets(freshAssets);
      setFunds(freshFunds);
      setTransactions(freshTransactions);
      setStocks(freshStocks);
      setStockTransactions(freshStockTransactions);
    } catch (error) {
      console.error('Error refreshing investment data:', error);
    }
  }, []);

  const refreshAllFundNAVs = useCallback(async (): Promise<{ success: number; failed: number }> => {
    setIsRefreshingNAVs(true);
    let success = 0;
    let failed = 0;

    try {
      const currentFunds = db.fetchFunds();
      const linkedFunds = currentFunds.filter((f) => f.scheme_code && f.scheme_code.trim());
      if (linkedFunds.length === 0) {
        return { success: 0, failed: 0 };
      }

      // Concurrently fetch latest NAVs for all funds linked with AMFI scheme codes
      const results = await Promise.allSettled(
        linkedFunds.map(async (fund) => {
          const details = await fetchFundDetails(fund.scheme_code!.trim());
          if (details && details.latestNav > 0) {
            return {
              fundId: fund.id,
              latestNav: details.latestNav,
              navDate: details.navDate,
            };
          }
          throw new Error(`Failed to fetch NAV for ${fund.name}`);
        })
      );

      const updatesToApply: Array<{ fundId: number; latestNav: number; navDate: string }> = [];
      for (const res of results) {
        if (res.status === 'fulfilled') {
          updatesToApply.push(res.value);
          success++;
        } else {
          failed++;
        }
      }

      if (updatesToApply.length > 0) {
        db.batchUpdateFundNAVs(updatesToApply);
      }

      refreshData();
    } catch (err) {
      console.error('Error during refreshAllFundNAVs:', err);
    } finally {
      setIsRefreshingNAVs(false);
    }

    return { success, failed };
  }, [refreshData]);

  const refreshAllStockPrices = useCallback(async (): Promise<{ success: number; failed: number }> => {
    setIsRefreshingStockPrices(true);
    let success = 0;
    let failed = 0;

    try {
      const currentStocks = db.fetchStocks();
      const linkedStocks = currentStocks.filter((s) => s.symbol && s.symbol.trim());
      if (linkedStocks.length === 0) {
        return { success: 0, failed: 0 };
      }

      // Concurrently fetch latest market prices for all stocks with symbols
      const results = await Promise.allSettled(
        linkedStocks.map(async (stock) => {
          const details = await fetchStockPrice(stock.symbol!.trim());
          if (details && details.price > 0) {
            return {
              stockId: stock.id,
              currentPrice: details.price,
              priceDate: details.priceDate,
              dayChangePct: details.changePct,
            };
          }
          throw new Error(`Failed to fetch price for ${stock.name}`);
        })
      );

      const updatesToApply: Array<{
        stockId: number;
        currentPrice: number;
        priceDate?: string;
        dayChangePct?: number;
      }> = [];

      for (const res of results) {
        if (res.status === 'fulfilled') {
          updatesToApply.push(res.value);
          success++;
        } else {
          failed++;
        }
      }

      if (updatesToApply.length > 0) {
        db.batchUpdateStockPrices(updatesToApply);
      }

      refreshData();
    } catch (err) {
      console.error('Error during refreshAllStockPrices:', err);
    } finally {
      setIsRefreshingStockPrices(false);
    }

    return { success, failed };
  }, [refreshData]);

  // 1. Initial local load & automatic background NAV and Stock CMP fetch when app opens
  useEffect(() => {
    refreshData();
    // Automatically fetch latest NAVs and live Stock prices when the app opens
    refreshAllFundNAVs();
    refreshAllStockPrices();
  }, [refreshData, refreshAllFundNAVs, refreshAllStockPrices]);

  // 2. Automatically refresh NAVs & Stock Prices when the app returns to the foreground
  useEffect(() => {
    let lastRefreshTime = Date.now();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const now = Date.now();
        // Throttle auto-refresh on foreground resume to at least 2 minutes apart
        if (now - lastRefreshTime > 2 * 60 * 1000) {
          lastRefreshTime = now;
          refreshAllFundNAVs();
          refreshAllStockPrices();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshAllFundNAVs, refreshAllStockPrices]);

  const updateAsset = (id: number, currentValue: number, investedAmount?: number) => {
    db.updateAssetValuation(id, currentValue, investedAmount);
    refreshData();
  };

  const updateFundValue = (fundId: number, currentValue: number) => {
    db.updateFundCurrentValue(fundId, currentValue);
    refreshData();
  };

  const addNewTransaction = (tx: {
    fund_id: number;
    date: string;
    type: 'BUY' | 'SELL';
    amount: number;
    nav?: number;
    units?: number;
  }) => {
    db.addMFTransaction(tx);
    refreshData();
  };

  const addBatchTransactions = (
    fundId: number,
    transactions: Array<{
      date: string;
      type: 'BUY' | 'SELL';
      amount: number;
      nav?: number;
      units?: number;
    }>
  ) => {
    db.addMFTransactionsBatch(fundId, transactions);
    refreshData();
  };

  const addNewFund = (
    name: string,
    folio: string,
    currentValue: number = 0,
    schemeCode?: string,
    currentNav?: number,
    navDate?: string
  ): number => {
    const id = db.createFund(name, folio, currentValue, schemeCode, currentNav, navDate);
    refreshData();
    return id;
  };

  const updateFundDetails = (
    fundId: number,
    data: {
      name?: string;
      folio_number?: string;
      scheme_code?: string;
      current_value?: number;
      current_nav?: number;
      nav_date?: string;
    }
  ) => {
    db.updateFundDetails(fundId, data);
    refreshData();
  };

  const recalculateFundFromNAV = (fundId: number, latestNav: number, navDate: string) => {
    db.recalculateFundCurrentValueFromNAV(fundId, latestNav, navDate);
    refreshData();
  };

  const removeFund = (fundId: number) => {
    db.deleteFund(fundId);
    refreshData();
  };

  const editTransaction = (tx: {
    id: number;
    date: string;
    type: 'BUY' | 'SELL';
    amount: number;
    nav?: number;
    units?: number;
  }) => {
    db.updateMFTransaction(tx);
    refreshData();
  };

  const deleteTransaction = (id: number) => {
    db.deleteMFTransaction(id);
    refreshData();
  };

  // Stock operations
  const addNewStock = (
    name: string,
    symbol?: string,
    currentValue: number = 0,
    currentPrice: number = 0,
    priceDate?: string,
    dayChangePct?: number
  ): number => {
    const id = db.createStock(name, symbol, currentValue, currentPrice, priceDate, dayChangePct);
    refreshData();

    // If symbol provided and no initial price was passed, immediately fetch CMP in background
    if (symbol && symbol.trim() && currentPrice === 0) {
      fetchStockPrice(symbol.trim())
        .then((details) => {
          if (details && details.price > 0) {
            db.batchUpdateStockPrices([
              {
                stockId: id,
                currentPrice: details.price,
                priceDate: details.priceDate,
                dayChangePct: details.changePct,
              },
            ]);
            refreshData();
          }
        })
        .catch(() => {});
    }

    return id;
  };

  const updateStockValue = (stockId: number, currentValue: number) => {
    db.updateStockCurrentValue(stockId, currentValue);
    refreshData();
  };

  const updateStockDetails = (
    stockId: number,
    data: { name?: string; symbol?: string; current_value?: number }
  ) => {
    db.updateStockDetails(stockId, data);
    refreshData();
  };

  const removeStock = (stockId: number) => {
    db.deleteStock(stockId);
    refreshData();
  };

  const addNewStockTransaction = (tx: {
    stock_id: number;
    date: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    price: number;
    quantity: number;
    amount?: number;
  }) => {
    db.addStockTransaction(tx);
    refreshData();
  };

  const editStockTransaction = (tx: {
    id: number;
    date: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    price: number;
    quantity: number;
    amount?: number;
  }) => {
    db.updateStockTransaction(tx);
    refreshData();
  };

  const deleteStockTransaction = (id: number) => {
    db.deleteStockTransaction(id);
    refreshData();
  };

  // Net worth and invested totals are derived strictly from Mutual Fund and Stock
  const trackedAssets = assets.filter(
    (a) => a.asset_type === 'Mutual Fund' || a.asset_type === 'Stock'
  );
  const totalNetWorth = trackedAssets.reduce((sum, a) => sum + a.current_value, 0);
  const totalInvested = trackedAssets.reduce((sum, a) => sum + a.invested_amount, 0);
  const absoluteReturn = totalNetWorth - totalInvested;
  const percentageReturn = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

  return (
    <InvestmentContext.Provider
      value={{
        assets,
        funds,
        transactions,
        stocks,
        stockTransactions,
        portfolioSummary: {
          totalNetWorth,
          totalInvested,
          absoluteReturn,
          percentageReturn,
        },
        isRefreshingNAVs,
        isRefreshingStockPrices,
        refreshData,
        updateAsset,
        updateFundValue,
        addNewTransaction,
        addBatchTransactions,
        addNewFund,
        updateFundDetails,
        recalculateFundFromNAV,
        refreshAllFundNAVs,
        refreshAllStockPrices,
        removeFund,
        editTransaction,
        deleteTransaction,
        addNewStock,
        updateStockValue,
        updateStockDetails,
        removeStock,
        addNewStockTransaction,
        editStockTransaction,
        deleteStockTransaction,
      }}
    >
      {children}
    </InvestmentContext.Provider>
  );
};

export const useInvestment = () => {
  const context = useContext(InvestmentContext);
  if (!context) {
    throw new Error('useInvestment must be used within an InvestmentProvider');
  }
  return context;
};
