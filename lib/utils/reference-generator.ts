import crypto from 'crypto';
import { AccountType } from '@/types/account';

export function generateAccountNumber(type: AccountType = 'SAVINGS'): string {
  const prefixMap: Record<AccountType, string> = {
    SAVINGS: 'LL-SAV',
    CHECKING: 'LL-CHK',
    BUSINESS: 'LL-BIZ',
    SYSTEM_RESERVE: 'SYS-RES'
  };

  const prefix = prefixMap[type] || 'LL-ACC';
  const randomNumeric = Math.floor(10000000 + Math.random() * 90000000); // 8 digit unique number
  return `${prefix}-${randomNumeric}`;
}

export function generateTransactionReference(prefix: string = 'TXN'): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${dateStr}-${randomHex}`;
}

export function generateHash(data: any): string {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

