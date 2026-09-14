export interface ParsedCSVOrder {
  id: string; // unique key for UI rendering
  date: string; // normalized YYYY-MM-DD
  type: 'BUY' | 'SELL';
  nav?: number;
  units?: number;
  amount: number;
  isValid: boolean;
  error?: string;
  raw: string;
}

export interface CSVParseResult {
  orders: ParsedCSVOrder[];
  totalInvested: number;
  totalUnits: number;
  validCount: number;
  invalidCount: number;
  errors: string[];
}

/**
 * Normalizes various date formats to ISO YYYY-MM-DD
 * Supports: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY
 */
export function normalizeDate(rawDate: string): string | null {
  if (!rawDate) return null;
  const cleaned = rawDate.trim().replace(/['"]/g, '');

  // Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback to Date object parsing
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parses numeric strings removing currency symbols and thousand separator commas
 */
export function cleanNumber(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const cleaned = val.replace(/[₹$,\s]/g, '').trim();
  if (!cleaned) return undefined;
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Splits a CSV line handling quoted values with commas
 */
export function splitCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map((v) => v.replace(/^"(.*)"$/, '$1').trim());
}

/**
 * Parses CSV text containing mutual fund transaction orders
 * Expects columns: date, type, nav, unit, total amount
 */
export function parseCSVOrders(csvText: string): CSVParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      orders: [],
      totalInvested: 0,
      totalUnits: 0,
      validCount: 0,
      invalidCount: 0,
      errors: ['The CSV file is empty.'],
    };
  }

  const firstLineCols = splitCSVLine(lines[0]).map((c) => c.toLowerCase());

  // Check if first line is a header
  let dateIdx = -1;
  let typeIdx = -1;
  let navIdx = -1;
  let unitIdx = -1;
  let amountIdx = -1;

  firstLineCols.forEach((col, idx) => {
    if (col.includes('date')) dateIdx = idx;
    else if (col.includes('type') || col.includes('trans')) typeIdx = idx;
    else if (col.includes('nav') || col.includes('price') || col.includes('rate')) navIdx = idx;
    else if (col.includes('unit') || col.includes('qty') || col.includes('quantity')) unitIdx = idx;
    else if (col.includes('amount') || col.includes('total') || col.includes('value')) amountIdx = idx;
  });

  const hasHeader = dateIdx !== -1 || typeIdx !== -1 || amountIdx !== -1;
  let dataLines = lines;

  if (hasHeader) {
    dataLines = lines.slice(1);
    // If some columns weren't matched in header, default by position
    if (dateIdx === -1) dateIdx = 0;
    if (typeIdx === -1) typeIdx = 1;
    if (navIdx === -1) navIdx = 2;
    if (unitIdx === -1) unitIdx = 3;
    if (amountIdx === -1) amountIdx = 4;
  } else {
    // Default position assumption: date, type, nav, unit, total amount
    dateIdx = 0;
    typeIdx = 1;
    navIdx = 2;
    unitIdx = 3;
    amountIdx = 4;
  }

  const orders: ParsedCSVOrder[] = [];
  const errors: string[] = [];
  let totalInvested = 0;
  let totalUnits = 0;
  let validCount = 0;
  let invalidCount = 0;

  dataLines.forEach((line, index) => {
    const cols = splitCSVLine(line);
    if (cols.length === 0 || cols.every((c) => c === '')) return;

    const rowNum = index + (hasHeader ? 2 : 1);
    const rawDate = cols[dateIdx] || '';
    const rawType = (cols[typeIdx] || '').toUpperCase();
    const rawNav = cols[navIdx];
    const rawUnit = cols[unitIdx];
    const rawAmount = cols[amountIdx];

    const normalizedDate = normalizeDate(rawDate);
    const navVal = cleanNumber(rawNav);
    let unitVal = cleanNumber(rawUnit);
    let amountVal = cleanNumber(rawAmount);

    // Normalize transaction type (BUY / SELL)
    let type: 'BUY' | 'SELL' = 'BUY';
    if (
      rawType.includes('SELL') ||
      rawType.includes('RED') || // Redeem / Redemption
      rawType.includes('OUT')
    ) {
      type = 'SELL';
    } else {
      type = 'BUY';
    }

    // Auto-calculate missing values if other 2 are present
    if (amountVal === undefined && unitVal !== undefined && navVal !== undefined && navVal > 0) {
      amountVal = Math.round(unitVal * navVal * 100) / 100;
    }
    if (unitVal === undefined && amountVal !== undefined && navVal !== undefined && navVal > 0) {
      unitVal = Math.round((amountVal / navVal) * 1000) / 1000;
    }
    if (navVal === undefined && amountVal !== undefined && unitVal !== undefined && unitVal > 0) {
      // nav can be derived: amount / unit
    }

    // Validation
    let isValid = true;
    let rowError = '';

    if (!normalizedDate) {
      isValid = false;
      rowError = `Row ${rowNum}: Invalid date "${rawDate}". Use YYYY-MM-DD or DD-MM-YYYY.`;
    } else if (amountVal === undefined || amountVal <= 0) {
      isValid = false;
      rowError = `Row ${rowNum}: Invalid or missing transaction amount.`;
    }

    if (isValid && amountVal !== undefined) {
      validCount++;
      if (type === 'BUY') {
        totalInvested += amountVal;
        if (unitVal) totalUnits += unitVal;
      } else {
        totalInvested -= amountVal;
        if (unitVal) totalUnits -= unitVal;
      }
    } else {
      invalidCount++;
      if (rowError) errors.push(rowError);
    }

    orders.push({
      id: `row-${rowNum}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date: normalizedDate || rawDate,
      type,
      nav: navVal,
      units: unitVal,
      amount: amountVal || 0,
      isValid,
      error: rowError || undefined,
      raw: line,
    });
  });

  return {
    orders,
    totalInvested: Math.max(0, Math.round(totalInvested * 100) / 100),
    totalUnits: Math.max(0, Math.round(totalUnits * 1000) / 1000),
    validCount,
    invalidCount,
    errors,
  };
}

/**
 * Returns a ready-to-use sample CSV template string for the user
 */
export function getSampleCSVTemplate(): string {
  return `date,type,nav,unit,total amount
2024-01-15,BUY,45.20,110.619,5000
2024-02-15,BUY,46.50,107.526,5000
2024-03-15,BUY,48.10,103.950,5000
2024-04-15,BUY,49.80,100.401,5000
2024-06-20,SELL,54.20,50.000,2710`;
}
