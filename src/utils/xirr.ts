export interface CashFlow {
  amount: number;
  date: string | Date;
}

/**
 * Calculates the Extended Internal Rate of Return (XIRR).
 * Cash flows must have at least one positive amount (inflow/current valuation)
 * and at least one negative amount (outflow/investment).
 * Returns percentage (e.g., 14.5 for 14.5%), or null if undefined/non-convergent.
 */
export function calculateXIRR(cashFlows: CashFlow[]): number | null {
  if (!cashFlows || cashFlows.length < 2) return null;

  // Filter out zero amounts
  const validFlows = cashFlows
    .filter((c) => Math.abs(c.amount) > 0.0001)
    .map((c) => ({
      amount: c.amount,
      time: typeof c.date === 'string' ? new Date(c.date).getTime() : c.date.getTime(),
    }));

  if (validFlows.length < 2) return null;

  const hasPositive = validFlows.some((c) => c.amount > 0);
  const hasNegative = validFlows.some((c) => c.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  // Sort chronologically
  validFlows.sort((a, b) => a.time - b.time);

  const t0 = validFlows[0].time;
  const tn = validFlows[validFlows.length - 1].time;
  const totalDays = (tn - t0) / (1000 * 60 * 60 * 24);

  // If less than 1 day between transactions, rate of return is not meaningful
  if (totalDays < 1) return null;

  const timesInYears = validFlows.map((c) => (c.time - t0) / (1000 * 60 * 60 * 24 * 365));

  // Net Present Value function: f(r) = sum(C_i / (1 + r)^t_i)
  const npv = (r: number): number => {
    let sum = 0;
    for (let i = 0; i < validFlows.length; i++) {
      const C = validFlows[i].amount;
      const t = timesInYears[i];
      const factor = Math.pow(1 + r, t);
      if (!isFinite(factor) || factor === 0) return NaN;
      sum += C / factor;
    }
    return sum;
  };

  // Derivative of NPV: f'(r) = sum(-t_i * C_i / (1 + r)^(t_i + 1))
  const dNpv = (r: number): number => {
    let sum = 0;
    for (let i = 0; i < validFlows.length; i++) {
      const C = validFlows[i].amount;
      const t = timesInYears[i];
      const factor = Math.pow(1 + r, t + 1);
      if (!isFinite(factor) || factor === 0) return NaN;
      sum += (-t * C) / factor;
    }
    return sum;
  };

  // 1. Try Newton-Raphson with multiple starting guesses
  const guesses = [0.1, 0.2, 0.0, -0.1, 0.5, -0.5, 1.0];

  for (const guess of guesses) {
    let r = guess;
    for (let iter = 0; iter < 60; iter++) {
      const f = npv(r);
      const df = dNpv(r);

      if (isNaN(f) || isNaN(df) || Math.abs(df) < 1e-12) break;
      if (Math.abs(f) < 1e-5) {
        return r * 100;
      }

      const step = f / df;
      let nextR = r - step;

      // Bound rate to greater than -100%
      if (nextR <= -0.999) {
        nextR = (r - 0.999) / 2;
      }

      r = nextR;
    }
  }

  // 2. Fallback: Bisection search in [-0.99, 10.0]
  let low = -0.99;
  let high = 10.0;
  let fLow = npv(low);
  let fHigh = npv(high);

  if (isNaN(fLow) || isNaN(fHigh) || fLow * fHigh > 0) {
    // Try wider upper bracket if needed
    high = 100.0;
    fHigh = npv(high);
  }

  if (!isNaN(fLow) && !isNaN(fHigh) && fLow * fHigh <= 0) {
    for (let iter = 0; iter < 80; iter++) {
      const mid = (low + high) / 2;
      const fMid = npv(mid);

      if (Math.abs(fMid) < 1e-5 || (high - low) / 2 < 1e-5) {
        return mid * 100;
      }

      if (fLow * fMid <= 0) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }
  }

  return null;
}

export function formatXIRR(xirr: number | null): string {
  if (xirr === null || isNaN(xirr)) {
    return 'N/A';
  }
  const isPositive = xirr >= 0;
  const sign = isPositive ? '+' : '';
  return `${sign}${xirr.toFixed(2)}%`;
}
