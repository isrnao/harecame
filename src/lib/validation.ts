import { z } from 'zod';

// Event validation schemas
export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'live', 'ended']).optional(),
  youtubeStreamUrl: z.string().url().optional(),
  youtubeStreamKey: z.string().optional(),
  youtubeVideoId: z.string().optional(),
});

// Camera connection validation schemas
export const joinEventSchema = z.object({
  participantId: z.string().min(1, 'Participant ID is required').max(100, 'Participant ID too long'),
  participantName: z.string().max(100, 'Participant name too long').optional(),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    screenResolution: z.string().optional(),
    connectionType: z.string().optional(),
    platform: z.string().optional(),
    browser: z.string().optional(),
  }).optional(),
});

export const updateCameraStatusSchema = z.object({
  status: z.enum(['connecting', 'active', 'inactive', 'error']),
  streamQuality: z.object({
    resolution: z.string().optional(),
    frameRate: z.number().min(1).max(120).optional(),
    bitrate: z.number().min(1).max(50000).optional(), // Max 50Mbps
    codec: z.string().optional(),
  }).optional(),
});

// Stream status validation schemas
export const updateStreamStatusSchema = z.object({
  isLive: z.boolean().optional(),
  activeCameraCount: z.number().min(0).max(10).optional(), // Max 10 cameras
  currentActiveCamera: z.string().optional(),
  youtubeViewerCount: z.number().min(0).optional(),
  streamHealth: z.enum(['excellent', 'good', 'poor', 'critical', 'unknown']).optional(),
});

// Participation code validation
export const participationCodeSchema = z.object({
  code: z.string().length(6, 'Participation code must be 6 characters').regex(/^[A-Z0-9]+$/, 'Invalid participation code format'),
});

// Query parameter validation schemas
export const listEventsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100, 'Limit must be between 1 and 100').optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional(),
  status: z.enum(['scheduled', 'live', 'ended']).optional(),
});

// Analytics validation schemas
export const performanceMetricSchema = z.object({
  name: z.string().min(1, 'Metric name is required'),
  value: z.number().min(0, 'Metric value must be non-negative'),
  id: z.string().min(1, 'Metric ID is required'),
  timestamp: z.number().min(0, 'Timestamp must be non-negative'),
  url: z.string().url('Invalid URL'),
  userAgent: z.string().min(1, 'User agent is required'),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const interactionEventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  eventId: z.string().uuid('Invalid event ID').optional(),
  userId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number().min(0, 'Timestamp must be non-negative'),
});

// Error reporting validation schema
export const errorReportSchema = z.object({
  message: z.string().min(1, 'Error message is required'),
  stack: z.string().optional(),
  url: z.string().url('Invalid URL'),
  userAgent: z.string().min(1, 'User agent is required'),
  timestamp: z.number().min(0, 'Timestamp must be non-negative'),
  userId: z.string().optional(),
  eventId: z.string().uuid('Invalid event ID').optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Validation helper functions
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

export function formatValidationErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors;
}

// Rate limiting validation
export const rateLimitSchema = z.object({
  windowMs: z.number().min(1000).max(3600000), // 1 second to 1 hour
  maxRequests: z.number().min(1).max(10000),
  // keyGenerator is optional and will be handled separately in TypeScript
});

// Security validation helpers
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidParticipationCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

// Content Security Policy helpers
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://www.youtube.com', 'https://www.google.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'media-src': ["'self'", 'https:', 'blob:'],
  'connect-src': ["'self'", 'https:', 'wss:', 'ws:'],
  'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
} as const;

export function generateCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}