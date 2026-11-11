import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { TransactionService } from '@/lib/services/transaction.service';
import { uuidSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    uuidSchema.parse(id);

    const auth = await authenticateRequest(req);
    const data = await TransactionService.getTransactionById(id, auth.user.role, auth.user.id);

    if (!data) {
      return apiError('Transaction not found', 404);
    }

    return apiSuccess(data, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to fetch transaction', status);
  }
}

