import { describe, it, expect } from 'vitest';
import { paiseToRupees, rupeesToPaise, formatINR, validatePaise } from '@/lib/utils/currency';

describe('Currency Utilities', () => {
  it('should accurately convert paise to rupees', () => {
    expect(paiseToRupees(100)).toBe(1);
    expect(paiseToRupees(10050)).toBe(100.50);
    expect(paiseToRupees('5000000')).toBe(50000);
    expect(paiseToRupees(0)).toBe(0);
  });

  it('should accurately convert rupees to integer paise without floating point error', () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(100.50)).toBe(10050);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(19.99)).toBe(1999);
  });

  it('should format INR currency properly', () => {
    const formatted = formatINR(10000000); // 100,000 INR
    expect(formatted).toContain('1,00,000.00');
  });

  it('should validate integer paise strictly', () => {
    expect(validatePaise(1000)).toBe(true);
    expect(validatePaise(0)).toBe(true);
    expect(validatePaise(-10)).toBe(false);
    expect(validatePaise(10.5)).toBe(false);
    expect(validatePaise('1000')).toBe(true);
    expect(validatePaise('invalid')).toBe(false);
  });
});

