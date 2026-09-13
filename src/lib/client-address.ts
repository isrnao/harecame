import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

// Only an authenticated reverse proxy may supply a per-client rate-limit key.
// Direct requests share a bucket; arbitrary forwarded headers cannot bypass it.
export function clientAddress(headers: Headers): string {
  const secret = process.env.TRUSTED_PROXY_SECRET;
  const presented = headers.get('x-harecame-proxy-secret') ?? '';
  if (!secret || Buffer.byteLength(presented) !== Buffer.byteLength(secret) ||
    !timingSafeEqual(Buffer.from(presented), Buffer.from(secret))) return 'shared';
  const address = headers.get('x-harecame-client-ip')?.trim() ?? '';
  return isIP(address) ? address : 'shared';
}
