import { NextRequest } from 'next/server';
import { loginSchema } from '@/lib/validations/auth.schema';
import { AuthService } from '@/lib/services/auth.service';
import { apiSuccess, apiError } from '@/lib/utils/response';
import { checkRateLimit } from '@/lib/security/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = checkRateLimit(ip, { keyPrefix: 'login', limit: 10, windowSeconds: 60 });
    if (!rateLimit.allowed) {
      return apiError(`Rate limit exceeded. Try again in ${rateLimit.resetInSeconds} seconds.`, 429);
    }

    const body = await req.json();
    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 400, validated.error.format());
    }

    const userAgent = req.headers.get('user-agent') || undefined;
    const result = await AuthService.login({
      ...validated.data,
      ipAddress: ip,
      userAgent
    });

    const response = apiSuccess(result, 200, 'Authentication successful');
    response.cookies.set('ledgerline_token', result.token, {
      httpOnly: false, // Accessible to client & server fetch
      secure: false,   // Allow on localhost HTTP development/demo
      sameSite: 'lax',
      maxAge: 86400,
      path: '/'
    });

    return response;
  } catch (error: any) {
    const status = error.message?.includes('locked') ? 423 : 401;
    return apiError(error.message || 'Authentication failed', status);
  }
}

