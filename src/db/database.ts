import * as SQLite from 'expo-sqlite';
import { AssetAllocation, MFFund, MFTransaction, Stock, StockTransaction } from '../types';

const DB_NAME = 'investments.db';
let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
    initDatabase(dbInstance);
  }
  return dbInstance;
}

function initDatabase(database: SQLite.SQLiteDatabase) {
  database.execSync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS asset_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_type TEXT UNIQUE NOT NULL,
      current_value REAL NOT NULL DEFAULT 0,
      invested_amount REAL NOT NULL DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mf_funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      folio_number TEXT,
      scheme_code TEXT,
      current_value REAL NOT NULL DEFAULT 0,
      current_nav REAL DEFAULT 0,
      nav_date TEXT,
      status TEXT DEFAULT 'ACTIVE',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mf_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      nav REAL,
      units REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(fund_id) REFERENCES mf_funds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      symbol TEXT,
      current_value REAL NOT NULL DEFAULT 0,
      current_price REAL DEFAULT 0,
      price_date TEXT,
      day_change_pct REAL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      price REAL NOT NULL,
      quantity REAL NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(stock_id) REFERENCES stocks(id) ON DELETE CASCADE
    );
  `);

  // Migration: Ensure current_value, scheme_code, current_nav, nav_date, and updated_at columns exist
  try {
    database.execSync(`ALTER TABLE mf_funds ADD COLUMN current_value REAL NOT NULL DEFAULT 0;`);
  } catch {
    // Column already exists
  }
  try {
    database.execSync(`ALTER TABLE mf_funds ADD COLUMN scheme_code TEXT;`);
  } catch {
    // Column already exists
  }
  try {
    database.execSync(`ALTER TABLE mf_funds ADD COLUMN nav_date TEXT;`);
  } catch {
    // Column already exists
  }
  try {
    database.execSync(`ALTER TABLE mf_funds ADD COLUMN updated_at TEXT;`);
  } catch {
    // Column already exists
  }

  // Migration: Ensure stocks have price tracking columns
  try {
    database.execSync(`ALTER TABLE stocks ADD COLUMN current_price REAL DEFAULT 0;`);
  } catch {
    // Column already exists
  }
  try {
    database.execSync(`ALTER TABLE stocks ADD COLUMN price_date TEXT;`);
  } catch {
    // Column already exists
  }
  try {
    database.execSync(`ALTER TABLE stocks ADD COLUMN day_change_pct REAL;`);
  } catch {
    // Column already exists
  }

  // Check if asset allocations need seeding
  const assetCount = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM asset_allocations;'
  );

  if (!assetCount || assetCount.count === 0) {
    seedDatabase(database);
  }

  // Remove any previously seeded dummy funds if no transactions were recorded for them
  // (Fulfills: "initially there should not be any mutual fund option")
  const txCount = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM mf_transactions;'
  );
  if (!txCount || txCount.count === 0) {
    const dummyFunds = [
      'Parag Parikh Flexi Cap Fund Direct',
      'Axis Small Cap Fund Direct Growth',
      'Nippon India Growth Mid Cap Fund Direct Growth',
      'Bandhan Small Cap Fund Direct Growth',
      'ICICI Prudential Technology Direct Plan Growth',
      'Quant Small Cap Fund Growth Option Direct Plan',
    ];
    for (const name of dummyFunds) {
      database.runSync('DELETE FROM mf_funds WHERE name = ?;', [name]);
    }
  }

  // Always keep Mutual Fund and Stock allocations in asset_allocations in sync with transactions and holdings
  syncMutualFundAssetAllocation(database);
  syncStockAssetAllocation(database);
}

function seedDatabase(database: SQLite.SQLiteDatabase) {
  // Mutual Fund and Stock start at 0 invested and 0 current value until user enters them.
  const initialAssets = [
    { type: 'Mutual Fund', invested: 0, current: 0 },
    { type: 'Stock', invested: 0, current: 0 },
    { type: 'EPF', invested: 230000, current: 249444 },
    { type: 'Gold', invested: 80000, current: 90682 },
    { type: 'TI ESPP', invested: 42000, current: 48000 },
    { type: 'PPF', invested: 8500, current: 9263 },
    { type: 'Crypto', invested: 2500, current: 2524 },
  ];

  database.withTransactionSync(() => {
    for (const a of initialAssets) {
      database.runSync(
        `INSERT INTO asset_allocations (asset_type, invested_amount, current_value, updated_at)
         VALUES (?, ?, ?, datetime('now'));`,
        [a.type, a.invested, a.current]
      );
    }
  });
}

/**
 * Synchronizes the 'Mutual Fund' entry in asset_allocations:
 * - invested_amount is dynamically calculated as the net sum of all buy/sell transactions
 * - current_value is dynamically calculated as the sum of current_value across all mutual funds
 */
export function syncMutualFundAssetAllocation(database: SQLite.SQLiteDatabase) {
  const totalInvestedResult = database.getFirstSync<{ total_invested: number }>(`
    SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN amount WHEN type = 'SELL' THEN -amount ELSE 0 END), 0) as total_invested
    FROM mf_transactions;
  `);
  const totalInvested = totalInvestedResult?.total_invested ?? 0;

  const totalCurrentResult = database.getFirstSync<{ total_current: number }>(`
    SELECT COALESCE(SUM(current_value), 0) as total_current
    FROM mf_funds;
  `);
  const totalCurrent = totalCurrentResult?.total_current ?? 0;

  database.runSync(
    `UPDATE asset_allocations 
     SET invested_amount = ?, current_value = ?, updated_at = datetime('now')
     WHERE asset_type = 'Mutual Fund';`,
    [totalInvested, totalCurrent]
  );
}

/**
 * Synchronizes the 'Stock' entry in asset_allocations:
 * - invested_amount is dynamically calculated as the net sum of all buy/sell transactions
 * - current_value is dynamically calculated as the sum of current_value across all stocks
 */
export function syncStockAssetAllocation(database: SQLite.SQLiteDatabase) {
  const totalInvestedResult = database.getFirstSync<{ total_invested: number }>(`
    SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN amount WHEN type = 'SELL' THEN -amount WHEN type = 'DIVIDEND' THEN -amount ELSE 0 END), 0) as total_invested
    FROM stock_transactions;
  `);
  const totalInvested = totalInvestedResult?.total_invested ?? 0;

  const totalCurrentResult = database.getFirstSync<{ total_current: number }>(`
    SELECT COALESCE(SUM(current_value), 0) as total_current
    FROM stocks;
  `);
  const totalCurrent = totalCurrentResult?.total_current ?? 0;

  database.runSync(
    `UPDATE asset_allocations 
     SET invested_amount = ?, current_value = ?, updated_at = datetime('now')
     WHERE asset_type = 'Stock';`,
    [totalInvested, totalCurrent]
  );
}

// Asset Operations
export function fetchAssetAllocations(): AssetAllocation[] {
  const database = getDatabase();
  return database.getAllSync<AssetAllocation>(
    'SELECT * FROM asset_allocations ORDER BY current_value DESC;'
  );
}

export function updateAssetValuation(id: number, currentValue: number, investedAmount?: number) {
  const database = getDatabase();
  if (investedAmount !== undefined) {
    database.runSync(
      `UPDATE asset_allocations 
       SET current_value = ?, invested_amount = ?, updated_at = datetime('now') 
       WHERE id = ?;`,
      [currentValue, investedAmount, id]
    );
  } else {
    database.runSync(
      `UPDATE asset_allocations 
       SET current_value = ?, updated_at = datetime('now') 
       WHERE id = ?;`,
      [currentValue, id]
    );
  }
}

// Mutual Fund Operations
export function fetchFunds(): MFFund[] {
  const database = getDatabase();
  return database.getAllSync<MFFund>(`
    SELECT 
      f.id,
      f.name,
      f.folio_number,
      f.scheme_code,
      f.current_value,
      f.current_nav,
      f.nav_date,
      f.status,
      f.updated_at,
      COALESCE(SUM(CASE WHEN t.type = 'BUY' THEN t.amount WHEN t.type = 'SELL' THEN -t.amount ELSE 0 END), 0) as total_invested,
      COALESCE(SUM(CASE 
        WHEN t.type = 'BUY' THEN COALESCE(t.units, CASE WHEN t.nav > 0 THEN t.amount / t.nav ELSE 0 END)
        WHEN t.type = 'SELL' THEN -COALESCE(t.units, CASE WHEN t.nav > 0 THEN t.amount / t.nav ELSE 0 END)
        ELSE 0 
      END), 0) as total_units,
      COUNT(t.id) as transaction_count
    FROM mf_funds f
    LEFT JOIN mf_transactions t ON f.id = t.fund_id
    GROUP BY f.id
    ORDER BY f.name ASC;
  `);
}

export function createFund(
  name: string,
  folioNumber: string,
  currentValue: number = 0,
  schemeCode?: string,
  currentNav?: number,
  navDate?: string
): number {
  const database = getDatabase();
  let newId = 0;
  database.withTransactionSync(() => {
    const res = database.runSync(
      `INSERT INTO mf_funds (name, folio_number, scheme_code, current_value, current_nav, nav_date, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now', 'localtime'));`,
      [
        name,
        folioNumber,
        schemeCode || null,
        currentValue,
        currentNav || null,
        navDate || null,
      ]
    );
    newId = Number(res.lastInsertRowId);
    syncMutualFundAssetAllocation(database);
  });
  return newId;
}

export function updateFundCurrentValue(
  fundId: number,
  currentValue: number,
  navDate?: string,
  currentNav?: number
) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    if (currentNav !== undefined && navDate !== undefined) {
      database.runSync(
        `UPDATE mf_funds 
         SET current_value = ?, current_nav = ?, nav_date = ?, updated_at = datetime('now', 'localtime') 
         WHERE id = ?;`,
        [currentValue, currentNav, navDate, fundId]
      );
    } else {
      database.runSync(
        `UPDATE mf_funds 
         SET current_value = ?, updated_at = datetime('now', 'localtime') 
         WHERE id = ?;`,
        [currentValue, fundId]
      );
    }
    syncMutualFundAssetAllocation(database);
  });
}

export function updateFundDetails(
  fundId: number,
  data: {
    name?: string;
    folio_number?: string;
    scheme_code?: string;
    current_value?: number;
    current_nav?: number;
    nav_date?: string;
  }
) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    const existing = database.getFirstSync<MFFund>(
      'SELECT * FROM mf_funds WHERE id = ?;',
      [fundId]
    );
    if (!existing) return;

    const name = data.name !== undefined ? data.name : existing.name;
    const folio = data.folio_number !== undefined ? data.folio_number : existing.folio_number;
    const scheme = data.scheme_code !== undefined ? data.scheme_code : existing.scheme_code;
    const curVal = data.current_value !== undefined ? data.current_value : existing.current_value;
    const curNav = data.current_nav !== undefined ? data.current_nav : existing.current_nav;
    const navDate = data.nav_date !== undefined ? data.nav_date : existing.nav_date;

    database.runSync(
      `UPDATE mf_funds 
       SET name = ?, folio_number = ?, scheme_code = ?, current_value = ?, current_nav = ?, nav_date = ?, updated_at = datetime('now', 'localtime') 
       WHERE id = ?;`,
      [name, folio, scheme || null, curVal, curNav || null, navDate || null, fundId]
    );
    syncMutualFundAssetAllocation(database);
  });
}

export function recalculateFundCurrentValueFromNAV(
  fundId: number,
  latestNav: number,
  navDate: string
) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    const unitResult = database.getFirstSync<{ tx_count: number; total_units: number }>(`
      SELECT 
        COUNT(id) as tx_count,
        COALESCE(SUM(CASE 
          WHEN type = 'BUY' THEN COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
          WHEN type = 'SELL' THEN -COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
          ELSE 0 
        END), 0) as total_units
      FROM mf_transactions
      WHERE fund_id = ?;
    `, [fundId]);

    const txCount = unitResult?.tx_count || 0;
    const totalUnits = unitResult?.total_units || 0;

    let newValue = 0;
    if (txCount > 0) {
      newValue = totalUnits > 0 ? Math.round(totalUnits * latestNav * 100) / 100 : 0;
    } else {
      const existing = database.getFirstSync<{ current_value: number }>(
        'SELECT current_value FROM mf_funds WHERE id = ?;',
        [fundId]
      );
      newValue = existing?.current_value || 0;
    }

    database.runSync(
      `UPDATE mf_funds 
       SET current_nav = ?, nav_date = ?, current_value = ?, updated_at = datetime('now', 'localtime') 
       WHERE id = ?;`,
      [latestNav, navDate, newValue, fundId]
    );
    syncMutualFundAssetAllocation(database);
  });
}

export function batchUpdateFundNAVs(
  updates: Array<{ fundId: number; latestNav: number; navDate: string }>
) {
  if (updates.length === 0) return;
  const database = getDatabase();
  database.withTransactionSync(() => {
    for (const update of updates) {
      const unitResult = database.getFirstSync<{ tx_count: number; total_units: number }>(`
        SELECT 
          COUNT(id) as tx_count,
          COALESCE(SUM(CASE 
            WHEN type = 'BUY' THEN COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
            WHEN type = 'SELL' THEN -COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
            ELSE 0 
          END), 0) as total_units
        FROM mf_transactions
        WHERE fund_id = ?;
      `, [update.fundId]);

      const txCount = unitResult?.tx_count || 0;
      const totalUnits = unitResult?.total_units || 0;

      let newValue = 0;
      if (txCount > 0) {
        newValue = totalUnits > 0 ? Math.round(totalUnits * update.latestNav * 100) / 100 : 0;
      } else {
        const existing = database.getFirstSync<{ current_value: number }>(
          'SELECT current_value FROM mf_funds WHERE id = ?;',
          [update.fundId]
        );
        newValue = existing?.current_value || 0;
      }

      database.runSync(
        `UPDATE mf_funds 
         SET current_nav = ?, nav_date = ?, current_value = ?, updated_at = datetime('now', 'localtime') 
         WHERE id = ?;`,
        [update.latestNav, update.navDate, newValue, update.fundId]
      );
    }
    syncMutualFundAssetAllocation(database);
  });
}

export function deleteFund(fundId: number) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM mf_funds WHERE id = ?;', [fundId]);
    syncMutualFundAssetAllocation(database);
  });
}

// Transaction Operations
export function fetchTransactions(): MFTransaction[] {
  const database = getDatabase();
  return database.getAllSync<MFTransaction>(`
    SELECT 
      t.id,
      t.fund_id,
      f.name as fund_name,
      t.date,
      t.type,
      t.amount,
      t.nav,
      t.units,
      t.created_at
    FROM mf_transactions t
    JOIN mf_funds f ON t.fund_id = f.id
    ORDER BY t.date DESC, t.id DESC;
  `);
}

/**
 * Synchronizes an individual mutual fund's current valuation:
 * - If no transactions remain for the fund, resets current_value to 0
 * - If current_nav is present (> 0), recalculates current_value = total_units * current_nav
 * - Otherwise preserves user-entered current_value
 */
export function syncFundCurrentValue(database: SQLite.SQLiteDatabase, fundId: number) {
  const fund = database.getFirstSync<MFFund>(
    'SELECT * FROM mf_funds WHERE id = ?;',
    [fundId]
  );
  if (!fund) return;

  const unitResult = database.getFirstSync<{ tx_count: number; total_units: number }>(`
    SELECT 
      COUNT(id) as tx_count,
      COALESCE(SUM(CASE 
        WHEN type = 'BUY' THEN COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
        WHEN type = 'SELL' THEN -COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
        ELSE 0 
      END), 0) as total_units
    FROM mf_transactions
    WHERE fund_id = ?;
  `, [fundId]);

  const txCount = unitResult?.tx_count || 0;
  const totalUnits = unitResult?.total_units || 0;

  let newValue = 0;
  if (txCount === 0 || totalUnits <= 0) {
    newValue = 0;
  } else if (fund.current_nav && fund.current_nav > 0) {
    newValue = Math.round(totalUnits * fund.current_nav * 100) / 100;
  } else {
    newValue = fund.current_value;
  }

  database.runSync(
    `UPDATE mf_funds 
     SET current_value = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?;`,
    [newValue, fundId]
  );
}

export function addMFTransaction(tx: {
  fund_id: number;
  date: string;
  type: 'BUY' | 'SELL';
  amount: number;
  nav?: number;
  units?: number;
}) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    database.runSync(
      `INSERT INTO mf_transactions (fund_id, date, type, amount, nav, units)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [tx.fund_id, tx.date, tx.type, tx.amount, tx.nav ?? null, tx.units ?? null]
    );

    // Immediately recalculate fund valuation & units from current NAV
    syncFundCurrentValue(database, tx.fund_id);

    // Sync Mutual Fund allocation
    syncMutualFundAssetAllocation(database);
  });
}

export function addMFTransactionsBatch(
  fundId: number,
  transactions: Array<{
    date: string;
    type: 'BUY' | 'SELL';
    amount: number;
    nav?: number;
    units?: number;
  }>
) {
  if (transactions.length === 0) return;
  const database = getDatabase();
  database.withTransactionSync(() => {
    for (const tx of transactions) {
      database.runSync(
        `INSERT INTO mf_transactions (fund_id, date, type, amount, nav, units)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [fundId, tx.date, tx.type, tx.amount, tx.nav ?? null, tx.units ?? null]
      );
    }

    // Immediately recalculate fund valuation & units from current NAV
    syncFundCurrentValue(database, fundId);

    // Sync Mutual Fund allocation
    syncMutualFundAssetAllocation(database);
  });
}

export function updateMFTransaction(tx: {
  id: number;
  date: string;
  type: 'BUY' | 'SELL';
  amount: number;
  nav?: number;
  units?: number;
}) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    const row = database.getFirstSync<{ fund_id: number }>(
      'SELECT fund_id FROM mf_transactions WHERE id = ?;',
      [tx.id]
    );

    database.runSync(
      `UPDATE mf_transactions
       SET date = ?, type = ?, amount = ?, nav = ?, units = ?
       WHERE id = ?;`,
      [tx.date, tx.type, tx.amount, tx.nav ?? null, tx.units ?? null, tx.id]
    );

    if (row) {
      syncFundCurrentValue(database, row.fund_id);
    }

    // Sync Mutual Fund allocation
    syncMutualFundAssetAllocation(database);
  });
}

export function deleteMFTransaction(transactionId: number) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    const row = database.getFirstSync<{ fund_id: number }>(
      'SELECT fund_id FROM mf_transactions WHERE id = ?;',
      [transactionId]
    );

    database.runSync('DELETE FROM mf_transactions WHERE id = ?;', [transactionId]);

    if (row) {
      syncFundCurrentValue(database, row.fund_id);
    }

    // Sync Mutual Fund allocation
    syncMutualFundAssetAllocation(database);
  });
}

// ==========================================
// Stock Operations
// ==========================================

export function fetchStocks(): Stock[] {
  const database = getDatabase();
  return database.getAllSync<Stock>(`
    SELECT 
      s.id,
      s.name,
      s.symbol,
      s.current_value,
      s.current_price,
      s.price_date,
      s.day_change_pct,
      s.updated_at,
      COALESCE(SUM(CASE WHEN t.type = 'BUY' THEN t.amount WHEN t.type = 'SELL' THEN -t.amount WHEN t.type = 'DIVIDEND' THEN -t.amount ELSE 0 END), 0) as total_invested,
      COALESCE(SUM(CASE WHEN t.type = 'BUY' THEN t.quantity WHEN t.type = 'SELL' THEN -t.quantity ELSE 0 END), 0) as total_quantity,
      COUNT(t.id) as transaction_count
    FROM stocks s
    LEFT JOIN stock_transactions t ON s.id = t.stock_id
    GROUP BY s.id
    ORDER BY s.name ASC;
  `);
}

export function createStock(
  name: string,
  symbol?: string,
  currentValue: number = 0,
  currentPrice: number = 0,
  priceDate?: string,
  dayChangePct?: number
): number {
  const database = getDatabase();
  let newId = 0;
  database.withTransactionSync(() => {
    const res = database.runSync(
      `INSERT INTO stocks (name, symbol, current_value, current_price, price_date, day_change_pct, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'));`,
      [name, symbol || null, currentValue, currentPrice, priceDate || null, dayChangePct || null]
    );
    newId = Number(res.lastInsertRowId);
    syncStockAssetAllocation(database);
  });
  return newId;
}

export function updateStockCurrentValue(stockId: number, currentValue: number) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    database.runSync(
      `UPDATE stocks 
       SET current_value = ?, updated_at = datetime('now', 'localtime') 
       WHERE id = ?;`,
      [currentValue, stockId]
    );
    syncStockAssetAllocation(database);
  });
}

export function updateStockDetails(
  stockId: number,
  data: {
    name?: string;
    symbol?: string;
    current_value?: number;
  }
) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    const existing = database.getFirstSync<Stock>(
      'SELECT * FROM stocks WHERE id = ?;',
      [stockId]
    );
    if (!existing) return;

    const name = data.name !== undefined ? data.name : existing.name;
    const symbol = data.symbol !== undefined ? data.symbol : existing.symbol;
    const curVal = data.current_value !== undefined ? data.current_value : existing.current_value;

    database.runSync(
      `UPDATE stocks 
       SET name = ?, symbol = ?, current_value = ?, updated_at = datetime('now', 'localtime') 
       WHERE id = ?;`,
      [name, symbol || null, curVal, stockId]
    );
    syncStockAssetAllocation(database);
  });
}

export function deleteStock(stockId: number) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM stocks WHERE id = ?;', [stockId]);
    syncStockAssetAllocation(database);
  });
}

// ==========================================
// Stock Transaction Operations
// ==========================================

export function fetchStockTransactions(): StockTransaction[] {
  const database = getDatabase();
  return database.getAllSync<StockTransaction>(`
    SELECT 
      t.id,
      t.stock_id,
      s.name as stock_name,
      s.symbol as stock_symbol,
      t.date,
      t.type,
      t.price,
      t.quantity,
      t.amount,
      t.created_at
    FROM stock_transactions t
    JOIN stocks s ON t.stock_id = s.id
    ORDER BY t.date DESC, t.id DESC;
  `);
}

export function batchUpdateStockPrices(
  updates: Array<{
    stockId: number;
    currentPrice: number;
    priceDate?: string;
    dayChangePct?: number;
  }>
) {
  if (updates.length === 0) return;
  const database = getDatabase();
  database.withTransactionSync(() => {
    for (const update of updates) {
      const qtyResult = database.getFirstSync<{ total_quantity: number }>(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity WHEN type = 'SELL' THEN -quantity ELSE 0 END), 0) as total_quantity
        FROM stock_transactions
        WHERE stock_id = ?;
      `, [update.stockId]);

      const totalShares = qtyResult?.total_quantity || 0;
      let newValue = 0;
      if (totalShares > 0) {
        newValue = Math.round(totalShares * update.currentPrice * 100) / 100;
      } else {
        const existing = database.getFirstSync<{ current_value: number }>(
          'SELECT current_value FROM stocks WHERE id = ?;',
          [update.stockId]
        );
        newValue = existing?.current_value || 0;
      }

      database.runSync(
        `UPDATE stocks 
         SET current_price = ?, price_date = ?, day_change_pct = ?, current_value = ?, updated_at = datetime('now', 'localtime') 
         WHERE id = ?;`,
        [update.currentPrice, update.priceDate || null, update.dayChangePct || null, newValue, update.stockId]
      );
    }

    syncStockAssetAllocation(database);
  });
}

export function addStockTransaction(tx: {
  stock_id: number;
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  price: number;
  quantity: number;
  amount?: number;
}) {
  const database = getDatabase();
  const calculatedAmount =
    tx.amount !== undefined && tx.amount > 0
      ? tx.amount
      : Math.round(tx.price * tx.quantity * 100) / 100;

  database.withTransactionSync(() => {
    database.runSync(
      `INSERT INTO stock_transactions (stock_id, date, type, price, quantity, amount)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [tx.stock_id, tx.date, tx.type, tx.price, tx.quantity, calculatedAmount]
    );

    // Auto-update stock's current_value if current_price exists
    const stock = database.getFirstSync<Stock>('SELECT * FROM stocks WHERE id = ?;', [tx.stock_id]);
    if (stock && stock.current_price && stock.current_price > 0) {
      const qtyResult = database.getFirstSync<{ total_quantity: number }>(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity WHEN type = 'SELL' THEN -quantity ELSE 0 END), 0) as total_quantity
        FROM stock_transactions
        WHERE stock_id = ?;
      `, [tx.stock_id]);
      const totalShares = qtyResult?.total_quantity || 0;
      const newValue = totalShares > 0 ? Math.round(totalShares * stock.current_price * 100) / 100 : 0;
      database.runSync(
        `UPDATE stocks SET current_value = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;`,
        [newValue, tx.stock_id]
      );
    }

    syncStockAssetAllocation(database);
  });
}

export function updateStockTransaction(tx: {
  id: number;
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  price: number;
  quantity: number;
  amount?: number;
}) {
  const database = getDatabase();
  const calculatedAmount =
    tx.amount !== undefined && tx.amount > 0
      ? tx.amount
      : Math.round(tx.price * tx.quantity * 100) / 100;

  database.withTransactionSync(() => {
    database.runSync(
      `UPDATE stock_transactions
       SET date = ?, type = ?, price = ?, quantity = ?, amount = ?
       WHERE id = ?;`,
      [tx.date, tx.type, tx.price, tx.quantity, calculatedAmount, tx.id]
    );

    // Auto-update stock's current_value if current_price exists
    const row = database.getFirstSync<{ stock_id: number }>(
      'SELECT stock_id FROM stock_transactions WHERE id = ?;',
      [tx.id]
    );
    if (row) {
      const stock = database.getFirstSync<Stock>('SELECT * FROM stocks WHERE id = ?;', [row.stock_id]);
      if (stock) {
        const qtyResult = database.getFirstSync<{ tx_count: number; total_quantity: number }>(`
          SELECT 
            COUNT(id) as tx_count,
            COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity WHEN type = 'SELL' THEN -quantity ELSE 0 END), 0) as total_quantity
          FROM stock_transactions
          WHERE stock_id = ?;
        `, [row.stock_id]);
        const totalShares = qtyResult?.total_quantity || 0;
        const txCount = qtyResult?.tx_count || 0;

        let newValue = 0;
        if (txCount === 0 || totalShares <= 0) {
          newValue = 0;
        } else if (stock.current_price && stock.current_price > 0) {
          newValue = Math.round(totalShares * stock.current_price * 100) / 100;
        } else {
          newValue = stock.current_value;
        }

        database.runSync(
          `UPDATE stocks SET current_value = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;`,
          [newValue, row.stock_id]
        );
      }
    }

    syncStockAssetAllocation(database);
  });
}

export function deleteStockTransaction(transactionId: number) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    const row = database.getFirstSync<{ stock_id: number }>(
      'SELECT stock_id FROM stock_transactions WHERE id = ?;',
      [transactionId]
    );

    database.runSync('DELETE FROM stock_transactions WHERE id = ?;', [transactionId]);

    if (row) {
      const stock = database.getFirstSync<Stock>('SELECT * FROM stocks WHERE id = ?;', [row.stock_id]);
      if (stock) {
        const qtyResult = database.getFirstSync<{ tx_count: number; total_quantity: number }>(`
          SELECT 
            COUNT(id) as tx_count,
            COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity WHEN type = 'SELL' THEN -quantity ELSE 0 END), 0) as total_quantity
          FROM stock_transactions
          WHERE stock_id = ?;
        `, [row.stock_id]);
        const totalShares = qtyResult?.total_quantity || 0;
        const txCount = qtyResult?.tx_count || 0;

        let newValue = 0;
        if (txCount === 0 || totalShares <= 0) {
          newValue = 0;
        } else if (stock.current_price && stock.current_price > 0) {
          newValue = Math.round(totalShares * stock.current_price * 100) / 100;
        } else {
          newValue = stock.current_value;
        }

        database.runSync(
          `UPDATE stocks SET current_value = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;`,
          [newValue, row.stock_id]
        );
      }
    }

    syncStockAssetAllocation(database);
  });
}
