import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AssetAllocation, MFFund, MFTransaction, PortfolioSummary } from '../types';
import * as db from '../db/database';
import { fetchFundDetails } from '../services/mfapi';

interface InvestmentContextType {
  assets: AssetAllocation[];
  funds: MFFund[];
  transactions: MFTransaction[];
  portfolioSummary: PortfolioSummary;
  isRefreshingNAVs: boolean;
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
}

const InvestmentContext = createContext<InvestmentContextType | undefined>(undefined);

export const InvestmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<AssetAllocation[]>([]);
  const [funds, setFunds] = useState<MFFund[]>([]);
  const [transactions, setTransactions] = useState<MFTransaction[]>([]);
  const [isRefreshingNAVs, setIsRefreshingNAVs] = useState(false);

  const refreshData = useCallback(() => {
    try {
      const freshAssets = db.fetchAssetAllocations();
      const freshFunds = db.fetchFunds();
      const freshTransactions = db.fetchTransactions();
      setAssets(freshAssets);
      setFunds(freshFunds);
      setTransactions(freshTransactions);
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

  // 1. Initial local load & automatic background NAV fetch when app opens
  useEffect(() => {
    refreshData();
    // Automatically fetch latest NAVs for all mutual funds when the app opens
    refreshAllFundNAVs();
  }, [refreshData, refreshAllFundNAVs]);

  // 2. Automatically refresh NAVs when the app returns to the foreground
  useEffect(() => {
    let lastRefreshTime = Date.now();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const now = Date.now();
        // Throttle auto-refresh on foreground resume to at least 2 minutes apart
        if (now - lastRefreshTime > 2 * 60 * 1000) {
          lastRefreshTime = now;
          refreshAllFundNAVs();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshAllFundNAVs]);

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

  const totalNetWorth = assets.reduce((sum, a) => sum + a.current_value, 0);
  const totalInvested = assets.reduce((sum, a) => sum + a.invested_amount, 0);
  const absoluteReturn = totalNetWorth - totalInvested;
  const percentageReturn = totalInvested > 0 ? (absoluteReturn / totalInvested) * 100 : 0;

  return (
    <InvestmentContext.Provider
      value={{
        assets,
        funds,
        transactions,
        portfolioSummary: {
          totalNetWorth,
          totalInvested,
          absoluteReturn,
          percentageReturn,
        },
        isRefreshingNAVs,
        refreshData,
        updateAsset,
        updateFundValue,
        addNewTransaction,
        addBatchTransactions,
        addNewFund,
        updateFundDetails,
        recalculateFundFromNAV,
        refreshAllFundNAVs,
        removeFund,
        editTransaction,
        deleteTransaction,
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
