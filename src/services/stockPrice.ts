export interface StockPriceResult {
  symbol: string;
  price: number;
  changePct?: number;
  priceDate: string;
  currency: string;
}

/**
 * Fetches the latest live market price (CMP) for an Indian stock (NSE / BSE).
 */
export async function fetchStockPrice(rawSymbol: string): Promise<StockPriceResult | null> {
  const sym = rawSymbol.trim().toUpperCase();
  if (!sym) return null;

  // Determine tickers to attempt (default to NSE .NS first, fallback to BSE .BO)
  const tickersToTry: string[] = [];
  if (sym.endsWith('.NS') || sym.endsWith('.BO')) {
    tickersToTry.push(sym);
  } else {
    tickersToTry.push(`${sym}.NS`);
    tickersToTry.push(`${sym}.BO`);
  }

  for (const ticker of tickersToTry) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker
      )}?interval=1d&range=1d`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const data = await response.json();
      const meta = data?.chart?.result?.[0]?.meta;

      if (meta && typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0) {
        let dateStr = new Date().toISOString().split('T')[0];
        if (meta.regularMarketTime) {
          const d = new Date(meta.regularMarketTime * 1000);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
          }
        }

        return {
          symbol: sym,
          price: Math.round(meta.regularMarketPrice * 100) / 100,
          changePct:
            typeof meta.regularMarketChangePercent === 'number'
              ? Math.round(meta.regularMarketChangePercent * 100) / 100
              : undefined,
          priceDate: dateStr,
          currency: meta.currency || 'INR',
        };
      }
    } catch {
      // Try next ticker or fallback
    }
  }

  return null;
}
