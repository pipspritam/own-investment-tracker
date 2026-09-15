export interface AssetAllocation {
  id: number;
  asset_type: string;
  current_value: number;
  invested_amount: number;
  updated_at?: string;
}

export interface MFFund {
  id: number;
  name: string;
  folio_number: string;
  scheme_code?: string; // AMFI Scheme Code (e.g. 147946 for Bandhan Small Cap)
  current_value: number; // Given by the user or calculated from (total_units * current_nav)
  current_nav?: number; // Latest NAV from MFAPI
  nav_date?: string; // Date of latest NAV
  status: 'ACTIVE' | 'REDEEMED';
  total_invested?: number; // Calculated from transaction history
  total_units?: number; // Calculated from transactions (units or amount/nav)
  transaction_count?: number;
  updated_at?: string; // Last updated date of current_value
}

export interface MFTransaction {
  id: number;
  fund_id: number;
  fund_name?: string;
  date: string; // YYYY-MM-DD
  type: 'BUY' | 'SELL';
  amount: number;
  nav?: number;
  units?: number;
  created_at?: string;
}

export interface PortfolioSummary {
  totalNetWorth: number;
  totalInvested: number;
  absoluteReturn: number;
  percentageReturn: number;
}

export interface Stock {
  id: number;
  name: string;
  symbol?: string; // Ticker e.g. RELIANCE, TCS, INFY
  current_value: number; // Calculated from (total_quantity * current_price) or user-entered
  current_price?: number; // Latest market price / CMP per share
  price_date?: string; // Date of latest price
  day_change_pct?: number; // Day change %
  updated_at?: string;
  total_invested?: number; // Calculated from transaction history: SUM(BUY) - SUM(SELL) - SUM(DIVIDEND)
  total_quantity?: number; // Calculated from transactions: SUM(BUY qty) - SUM(SELL qty)
  transaction_count?: number;
  avg_buy_price?: number; // Calculated: total_invested / total_quantity
}

export interface StockTransaction {
  id: number;
  stock_id: number;
  stock_name?: string;
  stock_symbol?: string;
  date: string; // YYYY-MM-DD
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  price: number; // Buy/Sale price per share or Dividend per share
  quantity: number; // Number of stock / shares
  amount: number; // Auto-calculated: price * quantity
  created_at?: string;
}

export interface PPFTransaction {
  id: number;
  date: string; // YYYY-MM-DD
  type: 'INVEST' | 'WITHDRAW';
  amount: number;
  notes?: string;
  created_at?: string;
}

export interface PPFAccount {
  id: number;
  account_number?: string;
  bank_name?: string;
  current_value: number; // Manual input by user
  total_invested: number; // Auto-calculated: SUM(INVEST) - SUM(WITHDRAW)
  transaction_count: number;
  updated_at?: string;
}

export interface EPFTransaction {
  id: number;
  date: string; // YYYY-MM-DD
  type: 'INVEST' | 'WITHDRAW';
  amount: number;
  notes?: string;
  created_at?: string;
}

export interface EPFAccount {
  id: number;
  uan?: string; // Universal Account Number
  company_name?: string; // Current employer / company
  current_value: number; // Manual input by user from EPFO passbook
  total_invested: number; // Auto-calculated: SUM(INVEST) - SUM(WITHDRAW)
  transaction_count: number;
  updated_at?: string;
}

export interface CategoryVisibility {
  mutualfunds: boolean;
  stocks: boolean;
  ppf: boolean;
  epf: boolean;
}



