import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth.middleware';
import { AuthService } from '@/lib/services/auth.service';
import { apiSuccess, apiError } from '@/lib/utils/response';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const ip = req.headers.get('x-forwarded-for') || undefined;
    await AuthService.logout(auth.user.id, ip);

    const response = apiSuccess({ loggedOut: true }, 200, 'Successfully logged out');
    response.cookies.delete('ledgerline_token');
    return response;
  } catch (error: any) {
    return apiError(error.message || 'Logout failed', 400);
  }
}

