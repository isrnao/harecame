import { NextRequest, NextResponse } from 'next/server';
import { AuthService, SessionService } from '@/lib/auth';
import { rateLimit, withErrorHandling, requestLogger } from '@/lib/middleware';
import { z } from 'zod';

// Admin login schema
const adminLoginSchema = z.object({
  adminKey: z.string().min(1, 'Admin key is required'),
  eventId: z.string().uuid('Invalid event ID').optional(),
});

// POST /api/auth/admin - Admin authentication
export const POST = withErrorHandling(async (request: NextRequest) => {
  requestLogger(request);
  
  // Apply rate limiting (more restrictive for admin login)
  const rateLimitResult = await rateLimit({
    windowMs: 300000, // 5 minutes
    maxRequests: 3, // 3 attempts per 5 minutes
  })(request);
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  
  // Validate request body
  const validation = adminLoginSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request data',
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { adminKey, eventId } = validation.data;
  
  // Verify admin key
  const expectedAdminKey = process.env.ADMIN_KEY;
  if (!expectedAdminKey || adminKey !== expectedAdminKey) {
    // Add delay to prevent brute force attacks
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid admin credentials',
      },
      { status: 401 }
    );
  }

  // Generate admin token
  const adminId = `admin-${Date.now()}`;
  const token = await AuthService.generateAdminToken(adminId, eventId);

  // Create session cookie
  const sessionCookie = SessionService.createSessionCookie(token);

  // Return success response with token
  const response = NextResponse.json({
    success: true,
    data: {
      token,
      user: {
        id: adminId,
        type: 'admin',
        eventId,
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    },
  });

  // Set session cookie
  response.headers.set('Set-Cookie', sessionCookie);

  return response;
});

// DELETE /api/auth/admin - Admin logout
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  requestLogger(request);
  
  // Clear session cookie
  const clearCookie = SessionService.clearSessionCookie();

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.headers.set('Set-Cookie', clearCookie);

  return response;
});