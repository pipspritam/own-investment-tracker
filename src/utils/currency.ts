export function formatINR(amount: number, options?: { showSign?: boolean; decimals?: number }): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const decimals = options?.decimals ?? 0;

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(absAmount);

  const sign = isNegative ? '- ' : options?.showSign && amount > 0 ? '+ ' : '';
  return `${sign}₹${formatted}`;
}

export function formatPercentage(val: number): string {
  const isPositive = val >= 0;
  const sign = isPositive ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

export function formatUnits(units: number | undefined | null): string {
  if (units === undefined || units === null || isNaN(units) || units === 0) {
    return '0.000';
  }
  return units.toFixed(3);
}

export function formatLastUpdated(dateStr: string | undefined | null): string {
  if (!dateStr) return 'Not updated yet';
  try {
    // Handle both ISO format and SQLite datetime format "YYYY-MM-DD HH:MM:SS"
    const parsed = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(parsed);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}
