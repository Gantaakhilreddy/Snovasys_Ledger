import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { AuditService } from '@/lib/services/audit.service';
import { paginationSchema } from '@/lib/validations/common.schema';
import { apiPaginated, apiError } from '@/lib/utils/response';

export async function GET(req: NextRequest) {
  try {
    await authorizeRoles(req, ['ADMIN', 'AUDITOR']);

    const { searchParams } = new URL(req.url);
    const pagination = paginationSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined
    });

    const userId = searchParams.get('userId') || undefined;
    const action = searchParams.get('action') || undefined;

    const { logs, total } = await AuditService.listLogs({
      userId,
      action,
      status: pagination.status,
      startDate: pagination.startDate,
      endDate: pagination.endDate,
      page: pagination.page,
      limit: pagination.limit
    });

    return apiPaginated(logs, { page: pagination.page, limit: pagination.limit, total });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to list audit logs', status);
  }
}

