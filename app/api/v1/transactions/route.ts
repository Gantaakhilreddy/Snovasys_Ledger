import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { TransactionService } from '@/lib/services/transaction.service';
import { paginationSchema } from '@/lib/validations/common.schema';
import { apiPaginated, apiError } from '@/lib/utils/response';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);

    const pagination = paginationSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined
    });

    const accountId = searchParams.get('accountId') || undefined;

    const { transactions, total } = await TransactionService.listTransactions(
      auth.user.role,
      auth.user.id,
      {
        accountId,
        type: pagination.type,
        status: pagination.status,
        startDate: pagination.startDate,
        endDate: pagination.endDate,
        search: pagination.search,
        page: pagination.page,
        limit: pagination.limit
      }
    );

    return apiPaginated(transactions, { page: pagination.page, limit: pagination.limit, total });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to list transactions', status);
  }
}

