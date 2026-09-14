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
