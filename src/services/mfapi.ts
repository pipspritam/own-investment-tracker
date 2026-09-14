export interface MFAPIMeta {
  fund_house: string;
  scheme_type: string;
  scheme_category: string;
  scheme_code: number | string;
  scheme_name: string;
  isin_growth?: string;
  isin_div_reinvestment?: string;
}

export interface MFAPINAVEntry {
  date: string; // DD-MM-YYYY
  nav: string;
}

export interface MFAPIFundResponse {
  meta: MFAPIMeta;
  data: MFAPINAVEntry[];
  status: string;
}

export interface MFAPISearchResult {
  schemeCode: number;
  schemeName: string;
}

/**
 * Fetches fund metadata and latest NAV from MFAPI.in (AMFI source)
 * Example: fetchFundDetails('147946')
 */
export async function fetchFundDetails(schemeCode: string | number): Promise<{
  schemeName: string;
  latestNav: number;
  navDate: string;
  meta: MFAPIMeta;
} | null> {
  try {
    const code = String(schemeCode).trim();
    if (!code) return null;

    const response = await fetch(`https://api.mfapi.in/mf/${code}`);
    if (!response.ok) return null;

    const json: MFAPIFundResponse = await response.json();
    if (json.status === 'SUCCESS' && json.data && json.data.length > 0) {
      const latest = json.data[0];
      return {
        schemeName: json.meta.scheme_name,
        latestNav: parseFloat(latest.nav),
        navDate: latest.date,
        meta: json.meta,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching MF details for scheme ${schemeCode}:`, error);
    return null;
  }
}

/**
 * Searches for Indian mutual funds by name to obtain scheme codes
 * Example: searchFunds('Bandhan Small Cap') or searchFunds('147946')
 */
export async function searchFunds(query: string): Promise<MFAPISearchResult[]> {
  try {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    // If query is digits, treat as direct AMFI Scheme Code lookup
    if (/^\d{3,7}$/.test(q)) {
      const details = await fetchFundDetails(q);
      if (details) {
        return [
          {
            schemeCode: Number(q),
            schemeName: details.schemeName,
          },
        ];
      }
    }

    const response = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];

    const results: MFAPISearchResult[] = await response.json();
    if (!Array.isArray(results)) return [];

    // Sort to place "Direct" plans first for better convenience
    const sorted = [...results].sort((a, b) => {
      const aDirect = a.schemeName.toLowerCase().includes('direct');
      const bDirect = b.schemeName.toLowerCase().includes('direct');
      if (aDirect && !bDirect) return -1;
      if (!aDirect && bDirect) return 1;
      return 0;
    });

    return sorted.slice(0, 15);
  } catch (error) {
    console.error('Error searching MF schemes:', error);
    return [];
  }
}
