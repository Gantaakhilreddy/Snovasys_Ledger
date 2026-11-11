/**
 * Currency Utilities for LedgerLine
 * 
 * Strict rule: All financial balances and calculations are stored and processed 
 * in integer paise (1 INR = 100 paise) to prevent any floating-point rounding errors.
 */

export function paiseToRupees(paise: string | number | bigint): number {
  const p = typeof paise === 'bigint' ? Number(paise) : typeof paise === 'string' ? parseInt(paise, 10) : paise;
  if (isNaN(p)) return 0;
  return p / 100;
}

export function rupeesToPaise(rupees: number): number {
  if (typeof rupees !== 'number' || isNaN(rupees)) {
    throw new Error('Invalid rupee amount');
  }
  return Math.round(rupees * 100);
}

export function formatINR(paise: string | number | bigint): string {
  const rs = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rs);
}

export function validatePaise(paise: any): boolean {
  if (typeof paise === 'number') {
    return Number.isInteger(paise) && paise >= 0 && Number.isSafeInteger(paise);
  }
  if (typeof paise === 'string') {
    return /^\d+$/.test(paise) && BigInt(paise) >= 0n;
  }
  if (typeof paise === 'bigint') {
    return paise >= 0n;
  }
  return false;
}

