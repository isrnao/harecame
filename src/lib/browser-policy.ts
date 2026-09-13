// Compatible with the Edge middleware and Node route handlers.
export function browserPolicy(production = process.env.NODE_ENV === 'production'): Record<string, string> {
  const csp = [
    "default-src 'self'", "script-src 'self' 'unsafe-inline'" + (production ? '' : " 'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'", "font-src 'self' data:", "img-src 'self' data: https: blob:",
    "media-src 'self' https: blob:", "connect-src 'self' https: wss: ws:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com", "worker-src 'self' blob:",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(production ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  return { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
    ...(production && { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }),
  };
}
