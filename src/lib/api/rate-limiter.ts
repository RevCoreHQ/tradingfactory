interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const PROVIDER_LIMITS: Record<string, RateLimitConfig> = {
  finnhub: { maxRequests: 55, windowMs: 60_000 },
  alphavantage: { maxRequests: 5, windowMs: 60_000 },
  newsapi: { maxRequests: 90, windowMs: 86_400_000 },
  fred: { maxRequests: 100, windowMs: 60_000 },
  coingecko: { maxRequests: 25, windowMs: 60_000 },
  gemini: { maxRequests: 14, windowMs: 60_000 },
  openai: { maxRequests: 50, windowMs: 60_000 },
  anthropic: { maxRequests: 45, windowMs: 60_000 },
  twelvedata: { maxRequests: 8, windowMs: 60_000 },
};

const requestLog: Record<string, number[]> = {};

export function checkRateLimit(provider: string): { allowed: boolean; retryAfterMs: number } {
  const config = PROVIDER_LIMITS[provider];
  if (!config) return { allowed: true, retryAfterMs: 0 };

  const now = Date.now();
  if (!requestLog[provider]) requestLog[provider] = [];

  requestLog[provider] = requestLog[provider].filter((t) => now - t < config.windowMs);

  if (requestLog[provider].length >= config.maxRequests) {
    const oldest = requestLog[provider][0];
    return { allowed: false, retryAfterMs: config.windowMs - (now - oldest) };
  }

  requestLog[provider].push(now);
  return { allowed: true, retryAfterMs: 0 };
}

export function getRateLimitStatus(provider: string): { used: number; max: number; windowMs: number } {
  const config = PROVIDER_LIMITS[provider];
  if (!config) return { used: 0, max: Infinity, windowMs: 0 };

  const now = Date.now();
  const recent = (requestLog[provider] || []).filter((t) => now - t < config.windowMs);
  return { used: recent.length, max: config.maxRequests, windowMs: config.windowMs };
}
