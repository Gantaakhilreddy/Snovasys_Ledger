import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { SecurityService } from '@/lib/services/security.service';
import { paginationSchema } from '@/lib/validations/common.schema';
import { apiPaginated, apiError } from '@/lib/utils/response';
import { AlertStatus, AlertSeverity } from '@/types/security';

export async function GET(req: NextRequest) {
  try {
    await authorizeRoles(req, ['ADMIN', 'AUDITOR']);

    const { searchParams } = new URL(req.url);
    const pagination = paginationSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit')
    });

    const status = (searchParams.get('status') as AlertStatus) || undefined;
    const severity = (searchParams.get('severity') as AlertSeverity) || undefined;

    const { alerts, total } = await SecurityService.listAlerts({
      status,
      severity,
      page: pagination.page,
      limit: pagination.limit
    });

    return apiPaginated(alerts, { page: pagination.page, limit: pagination.limit, total });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to list security alerts', status);
  }
}

