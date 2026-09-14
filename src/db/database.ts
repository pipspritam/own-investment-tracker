import * as SQLite from 'expo-sqlite';
import { AssetAllocation, MFFund, MFTransaction } from '../types';

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

  // Always keep Mutual Fund allocation in asset_allocations in sync with transactions and fund values
  syncMutualFundAssetAllocation(database);
}

function seedDatabase(database: SQLite.SQLiteDatabase) {
  // Other assets are seeded. Mutual Fund starts at 0 invested and 0 current value until user enters them.
  const initialAssets = [
    { type: 'Mutual Fund', invested: 0, current: 0 },
    { type: 'Stock', invested: 80000, current: 86529 },
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
    // Note: mf_funds is intentionally left empty so initially there are no mutual fund options
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

    // Recalculate fund current value if current_nav is present
    const fund = database.getFirstSync<MFFund>(
      'SELECT * FROM mf_funds WHERE id = ?;',
      [fundId]
    );
    if (fund && fund.current_nav && fund.current_nav > 0) {
      const unitResult = database.getFirstSync<{ total_units: number }>(`
        SELECT 
          COALESCE(SUM(CASE 
            WHEN type = 'BUY' THEN COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
            WHEN type = 'SELL' THEN -COALESCE(units, CASE WHEN nav > 0 THEN amount / nav ELSE 0 END)
            ELSE 0 
          END), 0) as total_units
        FROM mf_transactions
        WHERE fund_id = ?;
      `, [fundId]);

      const totalUnits = unitResult?.total_units || 0;
      const newValue = totalUnits > 0 ? Math.round(totalUnits * fund.current_nav * 100) / 100 : 0;
      database.runSync(
        `UPDATE mf_funds 
         SET current_value = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?;`,
        [newValue, fundId]
      );
    }

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
    database.runSync(
      `UPDATE mf_transactions
       SET date = ?, type = ?, amount = ?, nav = ?, units = ?
       WHERE id = ?;`,
      [tx.date, tx.type, tx.amount, tx.nav ?? null, tx.units ?? null, tx.id]
    );

    // Sync Mutual Fund allocation
    syncMutualFundAssetAllocation(database);
  });
}

export function deleteMFTransaction(transactionId: number) {
  const database = getDatabase();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM mf_transactions WHERE id = ?;', [transactionId]);

    // Sync Mutual Fund allocation
    syncMutualFundAssetAllocation(database);
  });
}
