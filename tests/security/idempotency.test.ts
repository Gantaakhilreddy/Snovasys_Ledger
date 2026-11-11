import { describe, it, expect } from 'vitest';
import { checkIdempotency, saveIdempotencyResponse } from '@/lib/middleware/idempotency.middleware';
import { query } from '@/lib/database/db';

describe('Idempotency & Duplicate Prevention Tests', () => {
  let adminId: string;
  const testKey = `idemp_test_${Date.now()}`;

  it('setup admin', async () => {
    const admin = await query<{ id: string }>('SELECT id FROM profiles WHERE role = $1 LIMIT 1', ['ADMIN']);
    adminId = admin.rows[0].id;
  });

  it('should allow first request with new idempotency key', async () => {
    const check1 = await checkIdempotency(testKey, adminId, '/api/v1/test', { amount: 100 });
    expect(check1.cachedResponse).toBeUndefined();
    expect(check1.key).toBe(testKey);

    // Save response
    await saveIdempotencyResponse(testKey, adminId, 200, { success: true, txnId: 'TXN-123' });
  });

  it('should return cached response on replay of the same idempotency key', async () => {
    const check2 = await checkIdempotency(testKey, adminId, '/api/v1/test', { amount: 100 });
    expect(check2.cachedResponse).toBeDefined();

    const data = await check2.cachedResponse!.json();
    expect(data.success).toBe(true);
    expect(data.txnId).toBe('TXN-123');
  });
});

