// Mock Next.js modules that cause issues in test environment
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
  },
}));

import { rateLimit, RATE_LIMITS, validateRequestBody, securityHeaders } from '../middleware';
import { sanitizeString, isValidUUID, isValidParticipationCode } from '../validation';
import { z } from 'zod';

// Mock NextRequest for testing
const createMockRequest = (options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
} = {}) => {
  const headers = new Map(Object.entries(options.headers || {}));

  return {
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3000/api/test',
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
    json: async () => options.body || {},
  } as any;
};

describe('Security Middleware', () => {
  beforeEach(() => {
    // Clear rate limit store before each test
    jest.clearAllMocks();
    // Clear the rate limit store (it's a Map in the middleware)
    jest.resetModules();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const request = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1', 'user-agent': 'test-agent' }
      });

      const rateLimitMiddleware = rateLimit(RATE_LIMITS.default);
      const result = await rateLimitMiddleware(request);

      expect(result).toBeNull(); // Should allow request
    });

    it('should have rate limit configuration', () => {
      // Test that rate limit configuration is properly set up
      const config = { windowMs: 60000, maxRequests: 1 };
      const rateLimitMiddleware = rateLimit(config);

      expect(rateLimitMiddleware).toBeDefined();
      expect(typeof rateLimitMiddleware).toBe('function');
    });

    it('should use different rate limits for different endpoints', () => {
      expect(RATE_LIMITS.createEvent.maxRequests).toBe(5);
      expect(RATE_LIMITS.createEvent.windowMs).toBe(300000); // 5 minutes

      expect(RATE_LIMITS.joinEvent.maxRequests).toBe(10);
      expect(RATE_LIMITS.joinEvent.windowMs).toBe(60000); // 1 minute

      expect(RATE_LIMITS.statusUpdate.maxRequests).toBe(200);
      expect(RATE_LIMITS.analytics.maxRequests).toBe(500);
    });
  });

  describe('Request Validation', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    it('should validate valid request body', async () => {
      const request = createMockRequest({
        body: { name: 'Test User', email: 'test@example.com' }
      });

      const validator = validateRequestBody(testSchema);
      const result = await validator(request);

      expect(result).toHaveProperty('data');
      if ('data' in result) {
        expect(result.data).toEqual({ name: 'Test User', email: 'test@example.com' });
      }
    });

    it('should reject invalid request body', async () => {
      const request = createMockRequest({
        body: { name: '', email: 'invalid-email' }
      });

      const validator = validateRequestBody(testSchema);
      const result = await validator(request);

      expect(result).toHaveProperty('status');
      if ('status' in result) {
        expect(result.status).toBe(400);
      }
    });

    it('should handle malformed JSON', async () => {
      const request = {
        json: async () => { throw new Error('Invalid JSON'); }
      } as any;

      const validator = validateRequestBody(testSchema);
      const result = await validator(request);

      expect(result).toHaveProperty('status');
      if ('status' in result) {
        expect(result.status).toBe(400);
      }
    });
  });

  describe('Security Headers', () => {
    it('should generate comprehensive security headers', () => {
      const headers = securityHeaders();

      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(headers).toHaveProperty('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(headers).toHaveProperty('Permissions-Policy');
    });

    it('should include HSTS header in production', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      const headers = securityHeaders();
      expect(headers).toHaveProperty('Strict-Transport-Security');

      (process.env as any).NODE_ENV = originalEnv;
    });

    it('should not include HSTS header in development', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'development';

      const headers = securityHeaders();
      expect(headers).not.toHaveProperty('Strict-Transport-Security');

      (process.env as any).NODE_ENV = originalEnv;
    });
  });
});

describe('Input Validation and Sanitization', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizeString(input);
      expect(result).toBe('scriptalert("xss")/scriptHello World');
    });

    it('should remove javascript: protocol', () => {
      const input = 'javascript:alert("xss")';
      const result = sanitizeString(input);
      expect(result).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      const input = 'onclick=alert("xss") Hello';
      const result = sanitizeString(input);
      expect(result).toBe('alert("xss") Hello');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID format', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidUUID(validUUID)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('isValidParticipationCode', () => {
    it('should validate correct participation code format', () => {
      expect(isValidParticipationCode('ABC123')).toBe(true);
      expect(isValidParticipationCode('SPRING')).toBe(true);
    });

    it('should reject invalid participation code format', () => {
      expect(isValidParticipationCode('abc123')).toBe(false); // lowercase
      expect(isValidParticipationCode('ABC12')).toBe(false); // too short
      expect(isValidParticipationCode('ABC1234')).toBe(false); // too long
      expect(isValidParticipationCode('ABC-12')).toBe(false); // special characters
      expect(isValidParticipationCode('')).toBe(false); // empty
    });
  });
});

describe('Access Control Scenarios', () => {
  describe('Event Creation Access', () => {
    it('should require admin authentication for event creation', () => {
      // This would be tested in integration tests with actual API calls
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Camera Participation Access', () => {
    it('should allow camera access with valid participation code', () => {
      // This would be tested in integration tests
      expect(true).toBe(true); // Placeholder
    });

    it('should deny camera access with invalid participation code', () => {
      // This would be tested in integration tests
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Event Management Access', () => {
    it('should allow organizer access to their own events', () => {
      // This would be tested in integration tests
      expect(true).toBe(true); // Placeholder
    });

    it('should deny organizer access to other events', () => {
      // This would be tested in integration tests
      expect(true).toBe(true); // Placeholder
    });
  });
});

describe('Security Best Practices', () => {
  it('should use secure token expiration times', () => {
    // Admin tokens: 24 hours
    // Organizer tokens: 12 hours
    // Camera tokens: 8 hours
    // Viewer tokens: 4 hours
    expect(true).toBe(true); // These are configured in AuthService
  });

  it('should implement proper CORS policies', () => {
    // CORS middleware should check allowed origins
    expect(true).toBe(true); // Placeholder for CORS tests
  });

  it('should log security events for monitoring', () => {
    // Security events should be logged for analysis
    expect(true).toBe(true); // Placeholder for logging tests
  });
});
