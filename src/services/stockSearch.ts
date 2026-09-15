import { BUNDLED_INDIAN_STOCKS, ListedStockItem } from '../data/indianStocks';

/**
 * Searches the local bundled Indian stocks dataset instantly (0ms).
 */
export function searchLocalStocks(query: string, limit: number = 15): ListedStockItem[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const matched: ListedStockItem[] = [];

  // 1. Exact symbol match first
  for (const stock of BUNDLED_INDIAN_STOCKS) {
    if (stock.symbol.toUpperCase() === q) {
      matched.push(stock);
    }
  }

  // 2. Starts-with symbol match
  for (const stock of BUNDLED_INDIAN_STOCKS) {
    if (stock.symbol.toUpperCase().startsWith(q) && !matched.some((m) => m.symbol === stock.symbol)) {
      matched.push(stock);
      if (matched.length >= limit) return matched;
    }
  }

  // 3. Name starts-with or word match
  const qLower = query.trim().toLowerCase();
  for (const stock of BUNDLED_INDIAN_STOCKS) {
    if (matched.some((m) => m.symbol === stock.symbol)) continue;
    const nameLower = stock.name.toLowerCase();
    if (nameLower.includes(qLower) || stock.symbol.toLowerCase().includes(qLower)) {
      matched.push(stock);
      if (matched.length >= limit) return matched;
    }
  }

  return matched;
}

/**
 * Live search for Indian listed companies via Yahoo Finance API (.NS / .BO).
 */
export async function searchLiveIndianStocks(query: string): Promise<ListedStockItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      trimmed
    )}&quotesCount=12&newsCount=0`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const data = await response.json();
    if (!data || !Array.isArray(data.quotes)) return [];

    const results: ListedStockItem[] = [];

    for (const quote of data.quotes) {
      const sym = quote.symbol as string;
      if (!sym) continue;

      const isNSE = sym.endsWith('.NS') || quote.exchange === 'NSI' || quote.exchDisp === 'NSE';
      const isBSE = sym.endsWith('.BO') || quote.exchange === 'BSE' || quote.exchDisp === 'BSE';

      if (isNSE || isBSE) {
        // Strip .NS / .BO
        const cleanSymbol = sym.replace(/\.NS$/i, '').replace(/\.BO$/i, '');
        const companyName = quote.longname || quote.shortname || cleanSymbol;
        const exchange = isNSE ? 'NSE' : 'BSE';
        const sector = quote.sector || quote.industry || undefined;

        results.push({
          symbol: cleanSymbol.toUpperCase(),
          name: companyName,
          exchange,
          sector,
        });
      }
    }

    return results;
  } catch (err) {
    // Network failure or timeout; gracefully fall back
    return [];
  }
}

/**
 * Hybrid Search: Instantly gets local matches, and asynchronously enriches with live API.
 */
export async function searchHybridIndianStocks(query: string): Promise<ListedStockItem[]> {
  const localResults = searchLocalStocks(query, 15);

  // If local results already have enough strong matches, still fetch live in background to catch obscure tickers
  try {
    const liveResults = await searchLiveIndianStocks(query);

    // Merge & deduplicate by symbol
    const merged: ListedStockItem[] = [...localResults];
    const existingSymbols = new Set(localResults.map((s) => s.symbol.toUpperCase()));

    for (const live of liveResults) {
      if (!existingSymbols.has(live.symbol.toUpperCase())) {
        merged.push(live);
        existingSymbols.add(live.symbol.toUpperCase());
      }
    }

    return merged;
  } catch {
    return localResults;
  }
}
