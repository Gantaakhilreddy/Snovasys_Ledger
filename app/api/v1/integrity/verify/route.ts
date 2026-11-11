import { NextRequest } from 'next/server';
import { authorizeRoles } from '@/lib/middleware/auth.middleware';
import { IntegrityService } from '@/lib/services/integrity.service';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeRoles(req, ['ADMIN', 'AUDITOR']);

    const report = await IntegrityService.verifyIntegrity(auth.user.id);
    return apiSuccess({ report }, 200, 'Integrity verification completed');
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : error.message?.includes('Forbidden') ? 403 : 400;
    return apiError(error.message || 'Integrity verification failed', status);
  }
}

