import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { IntegrityService } from '@/lib/services/integrity.service';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function GET(req: NextRequest) {
  try {
    await authorizeRoles(req, ['ADMIN', 'AUDITOR']);

    const summary = await IntegrityService.getIntegritySummary();
    return apiSuccess(summary, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Failed to retrieve integrity reports', status);
  }
}

