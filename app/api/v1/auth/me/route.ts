import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    return apiSuccess({ user: auth.user }, 200);
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 401 : 403;
    return apiError(error.message || 'Authentication required', status);
  }
}

