import { query } from '@/lib/database/db';
import { generateHash } from '@/lib/utils/reference-generator';
import { NextResponse } from 'next/server';

export interface IdempotencyCheckResult {
  cachedResponse?: NextResponse;
  key?: string;
}

export async function checkIdempotency(
  key: string | null | undefined,
  userId: string,
  endpoint: string,
  requestPayload: any
): Promise<IdempotencyCheckResult> {
  if (!key) return {};

  const requestHash = generateHash(requestPayload);

  // Check if key already exists
  const existing = await query<{
    id: string;
    request_hash: string;
    response_code: number | null;
    response_body: any;
    locked_at: string | null;
    expires_at: string;
  }>(`
    SELECT id, request_hash, response_code, response_body, locked_at, expires_at
    FROM idempotency_keys
    WHERE key = $1 AND user_id = $2;
  `, [key, userId]);

  if (existing.rows.length > 0) {
    const row = existing.rows[0];

    // If key has completed response, replay it
    if (row.response_code && row.response_body) {
      return {
        cachedResponse: NextResponse.json(row.response_body, {
          status: row.response_code,
          headers: { 'X-Cache-Lookup': 'HIT', 'X-Idempotency-Key': key }
        })
      };
    }

    // In-flight operation lock check (within past 60s)
    if (row.locked_at && (Date.now() - new Date(row.locked_at).getTime() < 60000)) {
      throw new Error('Conflict: A request with this Idempotency-Key is currently being processed.');
    }
  }

  // Lock or insert idempotency key
  await query(`
    INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, locked_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (key) DO UPDATE
    SET locked_at = NOW(), endpoint = $3, request_hash = $4;
  `, [key, userId, endpoint, requestHash]);

  return { key };
}

export async function saveIdempotencyResponse(
  key: string | null | undefined,
  userId: string,
  statusCode: number,
  responseBody: any
): Promise<void> {
  if (!key) return;

  try {
    await query(`
      UPDATE idempotency_keys
      SET response_code = $1,
          response_body = $2,
          locked_at = NULL
      WHERE key = $3 AND user_id = $4;
    `, [statusCode, JSON.stringify(responseBody), key, userId]);
  } catch (err) {
    console.error('Failed to save idempotency response:', err);
  }
}

