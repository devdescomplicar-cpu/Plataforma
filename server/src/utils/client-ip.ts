import type { Request } from 'express';

/**
 * Returns the client's public IP from the request.
 * Prefers X-Forwarded-For (first hop = client), then X-Real-IP, CF-Connecting-IP (Cloudflare), then req.socket or req.ip.
 * Use with app.set('trust proxy', 1) when behind nginx/reverse proxy.
 */
export function getClientPublicIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    const ip = first?.trim();
    if (ip) return ip;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') return realIp.trim();
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') return cfIp.trim();
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}
