import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { formatValidationErrors, generateCSPHeader } from './validation';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

// Default rate limit configurations for different endpoints
export const RATE_LIMITS = {
  // General API endpoints
  default: { windowMs: 60000, maxRequests: 100 }, // 100 requests per minute
  
  // Event creation (more restrictive)
  createEvent: { windowMs: 300000, maxRequests: 5 }, // 5 events per 5 minutes
  
  // Join event (moderate)
  joinEvent: { windowMs: 60000, maxRequests: 10 }, // 10 joins per minute
  
  // Status updates (frequent)
  statusUpdate: { windowMs: 60000, maxRequests: 200 }, // 200 updates per minute
  
  // Analytics (frequent)
  analytics: { windowMs: 60000, maxRequests: 500 }, // 500 analytics events per minute
  
  // Error reporting (moderate)
  errorReporting: { windowMs: 60000, maxRequests: 50 }, // 50 errors per minute
} as const;

// Rate limiting middleware
export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const key = config.keyGenerator ? config.keyGenerator(request) : getDefaultKey(request);
    const now = Date.now();
    
    // Clean up expired entries
    cleanupExpiredEntries(now);
    
    const entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      // First request or window expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return null; // Allow request
    }
    
    if (entry.count >= config.maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
          },
        }
      );
    }
    
    // Increment counter
    entry.count++;
    
    return null; // Allow request
  };
}

// Default key generator (IP + User-Agent hash)
function getDefaultKey(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${ip}:${hashString(userAgent)}`;
}

// Simple hash function for user agent
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Cleanup expired rate limit entries
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Request validation middleware
export function validateRequestBody<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest): Promise<{ data: T } | NextResponse> => {
    try {
      const body = await request.json();
      const result = schema.safeParse(body);
      
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request data',
            details: formatValidationErrors(result.error),
          },
          { status: 400 }
        );
      }
      
      return { data: result.data };
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }
  };
}

// Query parameter validation middleware
export function validateQueryParams<T>(schema: z.ZodSchema<T>) {
  return (request: NextRequest): { data: T } | NextResponse => {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    const result = schema.safeParse(params);
    
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: formatValidationErrors(result.error),
        },
        { status: 400 }
      );
    }
    
    return { data: result.data };
  };
}

// CORS middleware
export function corsMiddleware(request: NextRequest): NextResponse | null {
  // Allow requests from same origin
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  if (origin && host && !origin.includes(host)) {
    // Cross-origin request - apply CORS policy
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    if (!allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { success: false, error: 'CORS policy violation' },
        { status: 403 }
      );
    }
  }
  
  return null; // Allow request
}

// Security headers middleware
export function securityHeaders(): Record<string, string> {
  return {
    // Content Security Policy
    'Content-Security-Policy': generateCSPHeader(),
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // XSS protection
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions policy
    'Permissions-Policy': 'camera=self, microphone=self, geolocation=(), payment=()',
    
    // HSTS (only in production with HTTPS)
    ...(process.env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    }),
  };
}

// Authentication middleware (simple token-based)
export function requireAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  const token = authHeader.substring(7);
  
  // In a real application, validate the JWT token here
  // For now, we'll use a simple admin token check
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (adminToken && token !== adminToken) {
    return NextResponse.json(
      { success: false, error: 'Invalid authentication token' },
      { status: 401 }
    );
  }
  
  return null; // Allow request
}

// Middleware composer
export function composeMiddleware(...middlewares: Array<(request: NextRequest) => Promise<NextResponse | null> | NextResponse | null>) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    for (const middleware of middlewares) {
      const result = await middleware(request);
      if (result) {
        return result; // Middleware blocked the request
      }
    }
    return null; // All middleware passed
  };
}

// Error handling wrapper
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('API Error:', error);
      
      // Log error for monitoring
      if (process.env.NODE_ENV === 'production') {
        // In production, send to error monitoring service
        // await sendErrorToMonitoring(error);
      }
      
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && {
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
        { status: 500 }
      );
    }
  };
}

// Request logging middleware
export function requestLogger(request: NextRequest): null {
  const timestamp = new Date().toISOString();
  const method = request.method;
  const url = request.url;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  console.log(`[${timestamp}] ${method} ${url} - ${ip} - ${userAgent}`);
  
  return null; // Always allow request
}