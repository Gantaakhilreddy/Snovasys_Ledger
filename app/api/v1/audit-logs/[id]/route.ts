import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { AuditService } from '@/lib/services/audit.service';
import { uuidSchema } from '@/lib/validations/common.schema';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await authorizeRoles(req, ['ADMIN', 'AUDITOR']);
    const { id } = await context.params;
    uuidSchema.parse(id);

    const log = await AuditService.getLogById(id);
    if (!log) {
      return apiError('Audit log entry not found', 404);
    }

    return apiSuccess({ log }, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to fetch audit log', status);
  }
}

