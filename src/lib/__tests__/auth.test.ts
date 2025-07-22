// Mock the database service first
jest.mock('../database', () => ({
  EventService: {
    getByParticipationCode: jest.fn(),
  },
}));

// Mock jose library
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: jest.fn(),
}));

import { AuthService } from '../auth';
import { EventService } from '../database';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAdminToken', () => {
    it('should generate admin token successfully', async () => {
      const userId = 'admin-123';
      const eventId = 'event-456';

      const token = await AuthService.generateAdminToken(userId, eventId);

      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('generateCameraToken', () => {
    it('should generate camera token successfully', async () => {
      const participantId = 'participant-123';
      const eventId = 'event-456';
      const participantName = 'Test User';

      const token = await AuthService.generateCameraToken(participantId, eventId, participantName);

      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('validateParticipationCodeAndGenerateToken', () => {
    it('should validate participation code and generate token', async () => {
      const mockEvent = {
        id: 'event-123',
        title: 'Test Event',
        status: 'scheduled',
        participationCode: 'ABC123',
      };

      (EventService.getByParticipationCode as jest.Mock).mockResolvedValue(mockEvent);

      const result = await AuthService.validateParticipationCodeAndGenerateToken(
        'ABC123',
        'participant-456',
        'Test User'
      );

      expect(result).toEqual({
        token: 'mock-jwt-token',
        event: mockEvent,
      });
      expect(EventService.getByParticipationCode).toHaveBeenCalledWith('ABC123');
    });

    it('should return null for invalid participation code', async () => {
      (EventService.getByParticipationCode as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.validateParticipationCodeAndGenerateToken(
        'INVALID',
        'participant-456',
        'Test User'
      );

      expect(result).toBeNull();
    });

    it('should return null for ended event', async () => {
      const mockEvent = {
        id: 'event-123',
        title: 'Test Event',
        status: 'ended',
        participationCode: 'ABC123',
      };

      (EventService.getByParticipationCode as jest.Mock).mockResolvedValue(mockEvent);

      const result = await AuthService.validateParticipationCodeAndGenerateToken(
        'ABC123',
        'participant-456',
        'Test User'
      );

      expect(result).toBeNull();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        type: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'harecame-app',
        aud: 'harecame-users',
      };

      const { jwtVerify } = require('jose');
      jwtVerify.mockResolvedValue({ payload: mockPayload });

      const result = await AuthService.verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
    });

    it('should return null for invalid token', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockRejectedValue(new Error('Invalid token'));

      const result = await AuthService.verifyToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('extractTokenFromRequest', () => {
    it('should extract token from Authorization header', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer test-token'),
        },
      } as any;

      const token = AuthService.extractTokenFromRequest(mockRequest);

      expect(token).toBe('test-token');
      expect(mockRequest.headers.get).toHaveBeenCalledWith('authorization');
    });

    it('should return null for missing Authorization header', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const token = AuthService.extractTokenFromRequest(mockRequest);

      expect(token).toBeNull();
    });

    it('should return null for invalid Authorization header format', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Invalid header'),
        },
      } as any;

      const token = AuthService.extractTokenFromRequest(mockRequest);

      expect(token).toBeNull();
    });
  });
});

describe('Authentication Middleware', () => {
  describe('requireAuth', () => {
    it('should allow access with valid admin token', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockResolvedValue({
        payload: {
          sub: 'admin-123',
          type: 'admin',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iss: 'harecame-app',
          aud: 'harecame-users',
        },
      });

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid-admin-token'),
        },
      } as any;

      const { requireAuth } = require('../auth');
      const middleware = requireAuth(['admin']);
      const result = await middleware(mockRequest);

      expect(result).toHaveProperty('payload');
      expect(result.payload.type).toBe('admin');
    });

    it('should deny access without token', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const { requireAuth } = require('../auth');
      const middleware = requireAuth(['admin']);
      const result = await middleware(mockRequest);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(401);
    });

    it('should deny access with insufficient permissions', async () => {
      const { jwtVerify } = require('jose');
      jwtVerify.mockResolvedValue({
        payload: {
          sub: 'camera-123',
          type: 'camera',
          eventId: 'event-456',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iss: 'harecame-app',
          aud: 'harecame-users',
        },
      });

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid-camera-token'),
        },
      } as any;

      const { requireAuth } = require('../auth');
      const middleware = requireAuth(['admin']);
      const result = await middleware(mockRequest);

      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBe(403);
    });
  });
});