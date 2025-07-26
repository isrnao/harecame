import { NextRequest, NextResponse } from 'next/server';
import { AuthService, type JWTPayload } from '@/lib/auth';

// Protected routes configuration
const PROTECTED_ROUTES = {
  // Admin routes - require admin authentication
  admin: [
    '/api/events', // POST (create event)
    '/api/events/[eventId]', // PUT, DELETE
    '/api/auth/admin',
  ],
  
  // Organizer routes - require organizer or admin authentication
  organizer: [
    '/api/events/[eventId]/status', // PUT
    '/api/events/[eventId]/cameras', // GET
  ],
  
  // Camera routes - require camera token authentication
  camera: [
    '/api/events/[eventId]/join', // POST
    '/api/events/[eventId]/cameras/[cameraId]/status', // PUT
  ],
  
  // Public routes - no authentication required
  public: [
    '/api/events', // GET (list events)
    '/api/events/[eventId]', // GET (event details)
    '/api/events/validate-code', // POST
    '/api/events/[eventId]/stream', // GET (SSE)
    '/api/health',
    '/api/docs',
    '/api/analytics',
    '/api/errors',
  ],
};

// Rate limiting configuration for different route types
const ROUTE_RATE_LIMITS = {
  '/api/auth/admin': { windowMs: 300000, maxRequests: 3 }, // 3 per 5 minutes
  '/api/events/validate-code': { windowMs: 60000, maxRequests: 10 }, // 10 per minute
  '/api/events/[eventId]/join': { windowMs: 60000, maxRequests: 5 }, // 5 per minute
  '/api/events': { windowMs: 60000, maxRequests: 20 }, // 20 per minute for event operations
  default: { windowMs: 60000, maxRequests: 100 }, // 100 per minute for other APIs
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Apply security headers to all responses
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=self, microphone=self, geolocation=(), payment=()');
  
  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https: blob:",
    "connect-src 'self' https: wss: ws:",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);

  // Skip authentication for non-API routes
  if (!pathname.startsWith('/api/')) {
    return response;
  }

  // Handle CORS for API routes
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Apply CORS headers to API responses
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Check if route requires authentication
  const routeType = getRouteType(pathname, request.method);
  
  if (routeType === 'public') {
    return response;
  }

  // Extract and verify authentication token
  const token = AuthService.extractTokenFromRequest(request);
  
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const payload = await AuthService.verifyToken(token);
  
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Check authorization based on route type
  const hasAccess = await checkRouteAccess(routeType, payload, pathname, request);
  
  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Add user info to request headers for downstream handlers
  response.headers.set('X-User-ID', payload.sub);
  response.headers.set('X-User-Type', payload.type);
  if (payload.eventId) {
    response.headers.set('X-Event-ID', payload.eventId);
  }

  return response;
}

// Route type definition for better type safety
type RouteType = 'admin' | 'organizer' | 'camera' | 'public';

// Determine route type based on pathname and method
function getRouteType(pathname: string, method: string): RouteType {
  // Admin routes
  if (pathname === '/api/events' && method === 'POST') return 'admin';
  if (pathname.match(/^\/api\/events\/[^/]+$/) && (method === 'PUT' || method === 'DELETE')) return 'admin';
  if (pathname === '/api/auth/admin') return 'admin';
  
  // Organizer routes
  if (pathname.match(/^\/api\/events\/[^/]+\/status$/) && method === 'PUT') return 'organizer';
  if (pathname.match(/^\/api\/events\/[^/]+\/cameras$/) && method === 'GET') return 'organizer';
  
  // Camera routes
  if (pathname.match(/^\/api\/events\/[^/]+\/join$/) && method === 'POST') return 'camera';
  if (pathname.match(/^\/api\/events\/[^/]+\/cameras\/[^/]+\/status$/) && method === 'PUT') return 'camera';
  
  // Default to public
  return 'public';
}

// Check if user has access to specific route
async function checkRouteAccess(
  routeType: RouteType,
  payload: JWTPayload,
  pathname: string,
  _request: NextRequest // Prefixed with _ to indicate intentionally unused
): Promise<boolean> {
  switch (routeType) {
    case 'admin':
      return payload.type === 'admin';
      
    case 'organizer':
      // Admin or organizer with matching event ID
      if (payload.type === 'admin') return true;
      if (payload.type === 'organizer') {
        const eventId = extractEventIdFromPath(pathname);
        return eventId === payload.eventId;
      }
      return false;
      
    case 'camera':
      // Admin, organizer, or camera operator with matching event ID
      if (payload.type === 'admin') return true;
      const eventId = extractEventIdFromPath(pathname);
      if (payload.type === 'organizer' && eventId === payload.eventId) return true;
      if (payload.type === 'camera' && eventId === payload.eventId) return true;
      return false;
      
    default:
      return true; // Public routes
  }
}

// Extract event ID from API path
function extractEventIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/api\/events\/([^/]+)/);
  return match ? match[1] : null;
}

// Configure which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};