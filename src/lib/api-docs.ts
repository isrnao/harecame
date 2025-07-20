// API Documentation and OpenAPI specification for Harecame API

export const API_DOCUMENTATION = {
  openapi: '3.0.0',
  info: {
    title: 'Harecame API',
    version: '1.0.0',
    description: 'Live streaming service API for multi-camera events',
    contact: {
      name: 'Harecame Support',
      email: 'support@harecame.com',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
      description: 'Development server',
    },
  ],
  paths: {
    '/events': {
      get: {
        summary: 'List events',
        description: 'Retrieve a paginated list of events',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Number of events to return (1-100)',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of events to skip',
            schema: { type: 'integer', minimum: 0, default: 0 },
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by event status',
            schema: { type: 'string', enum: ['scheduled', 'live', 'ended'] },
          },
        ],
        responses: {
          200: {
            description: 'List of events',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Event' },
                    },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        summary: 'Create event',
        description: 'Create a new streaming event',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEventRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Event created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Event' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/events/{eventId}': {
      get: {
        summary: 'Get event details',
        description: 'Retrieve detailed information about a specific event',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'include_cameras',
            in: 'query',
            description: 'Include camera connections',
            schema: { type: 'boolean', default: false },
          },
          {
            name: 'include_status',
            in: 'query',
            description: 'Include stream status',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          200: {
            description: 'Event details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        event: { $ref: '#/components/schemas/Event' },
                        cameras: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/CameraConnection' },
                        },
                        streamStatus: { $ref: '#/components/schemas/StreamStatus' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      put: {
        summary: 'Update event',
        description: 'Update event information (requires authentication)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateEventRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Event updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Event' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        summary: 'Delete event',
        description: 'Delete an event (requires authentication, cannot delete live events)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Event deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/events/{eventId}/join': {
      post: {
        summary: 'Join event as camera operator',
        description: 'Join an event as a camera operator and receive LiveKit access token',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JoinEventRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Successfully joined event',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/JoinEventResponse' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/events/{eventId}/status': {
      get: {
        summary: 'Get stream status',
        description: 'Get comprehensive stream status for an event',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Stream status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/StreamStatus' },
                    cameras: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CameraConnection' },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      put: {
        summary: 'Update stream status',
        description: 'Update stream status (requires authentication)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateStreamStatusRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Stream status updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/StreamStatus' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/events/{eventId}/cameras': {
      get: {
        summary: 'Get camera connections',
        description: 'Get all camera connections for an event',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Camera connections',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CameraConnection' },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/events/{eventId}/cameras/{cameraId}/status': {
      put: {
        summary: 'Update camera status',
        description: 'Update the status of a camera connection',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'cameraId',
            in: 'path',
            required: true,
            description: 'Camera connection UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateCameraStatusRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Camera status updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/CameraConnection' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimit' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/events/{eventId}/stream': {
      get: {
        summary: 'Server-Sent Events stream',
        description: 'Real-time event stream using Server-Sent Events',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            description: 'Event UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Event stream',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  description: 'Server-Sent Events stream',
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          scheduledAt: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', enum: ['scheduled', 'live', 'ended'] },
          participationCode: { type: 'string' },
          youtubeStreamUrl: { type: 'string', nullable: true },
          youtubeStreamKey: { type: 'string', nullable: true },
          youtubeVideoId: { type: 'string', nullable: true },
          livekitRoomName: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CameraConnection: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          eventId: { type: 'string', format: 'uuid' },
          participantId: { type: 'string' },
          participantName: { type: 'string', nullable: true },
          deviceInfo: { type: 'object' },
          streamQuality: { type: 'object' },
          status: { type: 'string', enum: ['connecting', 'active', 'inactive', 'error'] },
          joinedAt: { type: 'string', format: 'date-time' },
          lastActiveAt: { type: 'string', format: 'date-time' },
          disconnectedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      StreamStatus: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          eventId: { type: 'string', format: 'uuid' },
          isLive: { type: 'boolean' },
          activeCameraCount: { type: 'integer' },
          totalCameraCount: { type: 'integer' },
          currentActiveCamera: { type: 'string', format: 'uuid', nullable: true },
          youtubeViewerCount: { type: 'integer' },
          streamHealth: { type: 'string', enum: ['excellent', 'good', 'poor', 'critical', 'unknown'] },
          lastSwitchAt: { type: 'string', format: 'date-time', nullable: true },
          lastUpdated: { type: 'string', format: 'date-time' },
        },
      },
      CreateEventRequest: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          scheduledAt: { type: 'string', format: 'date-time' },
        },
      },
      UpdateEventRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', maxLength: 1000 },
          scheduledAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['scheduled', 'live', 'ended'] },
          youtubeStreamUrl: { type: 'string', format: 'uri' },
          youtubeStreamKey: { type: 'string' },
          youtubeVideoId: { type: 'string' },
        },
      },
      JoinEventRequest: {
        type: 'object',
        required: ['participantId'],
        properties: {
          participantId: { type: 'string', minLength: 1, maxLength: 100 },
          participantName: { type: 'string', maxLength: 100 },
          deviceInfo: {
            type: 'object',
            properties: {
              userAgent: { type: 'string' },
              screenResolution: { type: 'string' },
              connectionType: { type: 'string' },
              platform: { type: 'string' },
              browser: { type: 'string' },
            },
          },
        },
      },
      JoinEventResponse: {
        type: 'object',
        properties: {
          eventId: { type: 'string', format: 'uuid' },
          roomToken: { type: 'string' },
          roomName: { type: 'string' },
          cameraConnectionId: { type: 'string', format: 'uuid' },
          event: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
      UpdateCameraStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['connecting', 'active', 'inactive', 'error'] },
          streamQuality: {
            type: 'object',
            properties: {
              resolution: { type: 'string' },
              frameRate: { type: 'integer', minimum: 1, maximum: 120 },
              bitrate: { type: 'integer', minimum: 1, maximum: 50000 },
              codec: { type: 'string' },
            },
          },
        },
      },
      UpdateStreamStatusRequest: {
        type: 'object',
        properties: {
          isLive: { type: 'boolean' },
          activeCameraCount: { type: 'integer', minimum: 0, maximum: 10 },
          currentActiveCamera: { type: 'string', format: 'uuid' },
          youtubeViewerCount: { type: 'integer', minimum: 0 },
          streamHealth: { type: 'string', enum: ['excellent', 'good', 'poor', 'critical', 'unknown'] },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          details: { type: 'object' },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Conflict: {
        description: 'Resource conflict',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      RateLimit: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
        headers: {
          'Retry-After': {
            description: 'Seconds to wait before retrying',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Limit': {
            description: 'Request limit per window',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests in window',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Reset': {
            description: 'Window reset time (Unix timestamp)',
            schema: { type: 'integer' },
          },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
} as const;

// API Documentation endpoint
export function generateAPIDocumentation() {
  return API_DOCUMENTATION;
}

// Helper function to generate API client code examples
export const API_EXAMPLES = {
  javascript: {
    listEvents: `
// List events
const response = await fetch('/api/events?limit=10&status=live');
const { success, data } = await response.json();

if (success) {
  console.log('Events:', data);
}`,
    
    createEvent: `
// Create event
const response = await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'School Sports Day',
    description: 'Annual sports event',
    scheduledAt: '2024-12-01T10:00:00Z'
  })
});

const { success, data } = await response.json();
if (success) {
  console.log('Event created:', data);
}`,
    
    joinEvent: `
// Join event as camera operator
const response = await fetch('/api/events/{eventId}/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    participantId: 'camera-001',
    participantName: 'Parent Camera',
    deviceInfo: {
      userAgent: navigator.userAgent,
      screenResolution: \`\${screen.width}x\${screen.height}\`,
      platform: navigator.platform
    }
  })
});

const { success, data } = await response.json();
if (success) {
  const { roomToken, roomName } = data;
  // Use roomToken to connect to LiveKit
}`,
    
    updateCameraStatus: `
// Update camera status
const response = await fetch('/api/events/{eventId}/cameras/{cameraId}/status', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'active',
    streamQuality: {
      resolution: '1280x720',
      frameRate: 30,
      bitrate: 2500,
      codec: 'H264'
    }
  })
});

const { success, data } = await response.json();
if (success) {
  console.log('Camera status updated:', data);
}`,
    
    serverSentEvents: `
// Listen to real-time events
const eventSource = new EventSource('/api/events/{eventId}/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time event:', data);
  
  switch (data.type) {
    case 'camera-joined':
      console.log('New camera joined:', data.participantId);
      break;
    case 'stream-switched':
      console.log('Stream switched to:', data.data.toCamera);
      break;
    case 'heartbeat':
      console.log('Connection alive');
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};`,
  },
  
  curl: {
    listEvents: `
# List events
curl -X GET "http://localhost:3000/api/events?limit=10&status=live" \\
  -H "Accept: application/json"`,
    
    createEvent: `
# Create event
curl -X POST "http://localhost:3000/api/events" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "School Sports Day",
    "description": "Annual sports event",
    "scheduledAt": "2024-12-01T10:00:00Z"
  }'`,
    
    joinEvent: `
# Join event as camera operator
curl -X POST "http://localhost:3000/api/events/{eventId}/join" \\
  -H "Content-Type: application/json" \\
  -d '{
    "participantId": "camera-001",
    "participantName": "Parent Camera",
    "deviceInfo": {
      "platform": "MacIntel",
      "browser": "Chrome"
    }
  }'`,
    
    updateCameraStatus: `
# Update camera status
curl -X PUT "http://localhost:3000/api/events/{eventId}/cameras/{cameraId}/status" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "active",
    "streamQuality": {
      "resolution": "1280x720",
      "frameRate": 30,
      "bitrate": 2500,
      "codec": "H264"
    }
  }'`,
    
    serverSentEvents: `
# Listen to real-time events
curl -N -H "Accept: text/event-stream" \\
  "http://localhost:3000/api/events/{eventId}/stream"`,
  },
};

// Rate limiting documentation
export const RATE_LIMIT_DOCS = {
  description: 'API endpoints are rate limited to prevent abuse',
  limits: {
    'Default endpoints': '100 requests per minute',
    'Event creation': '5 requests per 5 minutes',
    'Join event': '10 requests per minute',
    'Status updates': '200 requests per minute',
    'Analytics': '500 requests per minute',
    'Error reporting': '50 requests per minute',
  },
  headers: {
    'X-RateLimit-Limit': 'Request limit per window',
    'X-RateLimit-Remaining': 'Remaining requests in current window',
    'X-RateLimit-Reset': 'Window reset time (Unix timestamp)',
    'Retry-After': 'Seconds to wait before retrying (when rate limited)',
  },
};

// Authentication documentation
export const AUTH_DOCS = {
  description: 'Some endpoints require authentication using Bearer tokens',
  protectedEndpoints: [
    'PUT /api/events/{eventId}',
    'DELETE /api/events/{eventId}',
    'PUT /api/events/{eventId}/status',
  ],
  usage: {
    header: 'Authorization: Bearer <token>',
    example: 'Authorization: Bearer your-admin-token-here',
  },
  notes: [
    'Admin token is configured via ADMIN_TOKEN environment variable',
    'Camera operators do not need authentication for joining events',
    'LiveKit tokens are generated automatically when joining events',
  ],
};