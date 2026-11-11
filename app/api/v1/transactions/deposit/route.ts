import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { TransactionService } from '@/lib/services/transaction.service';
import { depositSchema } from '@/lib/validations/transaction.schema';
import { checkIdempotency, saveIdempotencyResponse } from '@/lib/middleware/idempotency.middleware';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeRoles(req, ['ADMIN', 'ACCOUNT_HOLDER']);

    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
    const body = await req.json();

    const idempCheck = await checkIdempotency(
      idempotencyKey,
      auth.user.id,
      '/api/v1/transactions/deposit',
      body
    );
    if (idempCheck.cachedResponse) {
      return idempCheck.cachedResponse;
    }

    const validated = depositSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    let result;
    let message = 'Deposit processed successfully';
    let statusCode = 200;

    if (auth.user.role === 'ACCOUNT_HOLDER') {
      // User deposit request enters Admin Pending Approvals queue
      result = await TransactionService.requestDeposit(
        { ...validated.data, idempotencyKey: idempotencyKey || undefined },
        auth.user.id
      );
      message = 'Deposit request submitted successfully. Awaiting administrative approval.';
      statusCode = 201;
    } else {
      // Admin executes direct authorized deposit
      result = await TransactionService.deposit(
        { ...validated.data, idempotencyKey: idempotencyKey || undefined },
        auth.user.id
      );
    }

    const responseBody = {
      success: true,
      message,
      data: result,
      timestamp: new Date().toISOString()
    };

    if (idempotencyKey) {
      await saveIdempotencyResponse(idempotencyKey, auth.user.id, statusCode, responseBody);
    }

    return apiSuccess(result, statusCode, message);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized')
      ? 401
      : error.message?.includes('Forbidden')
      ? 403
      : error.message?.includes('Conflict')
      ? 409
      : 400;

    return apiError(error.message || 'Deposit failed', status);
  }
}

