interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { keyPrefix: 'rl', limit: 10, windowSeconds: 60 }
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const key = `${options.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  const current = memoryStore.get(key);

  if (!current || now > current.resetTime) {
    memoryStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetInSeconds: options.windowSeconds
    };
  }

  if (current.count >= options.limit) {
    const resetInSeconds = Math.ceil((current.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds
    };
  }

  current.count += 1;
  const resetInSeconds = Math.ceil((current.resetTime - now) / 1000);
  return {
    allowed: true,
    remaining: options.limit - current.count,
    resetInSeconds
  };
}

