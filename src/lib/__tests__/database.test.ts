// Unit tests for database operations and data model validation
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { EventService, CameraConnectionService, StreamStatusService } from '../database';
import { DatabaseInitializer } from '../database-init';
import type { EventClient, CameraConnectionClient } from '@/types';

// Mock data for testing
const mockEventData = {
  title: 'Test Event',
  description: 'A test event for unit testing',
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
};

const mockCameraData = {
  participantId: 'test_participant',
  participantName: 'Test Participant',
  deviceInfo: {
    userAgent: 'Test User Agent',
    screenResolution: '1920x1080',
    connectionType: '4g',
    platform: 'mobile',
    browser: 'chrome',
  },
};

describe('Database Operations', () => {
  let testEvent: EventClient;
  let testCamera: CameraConnectionClient;

  beforeAll(async () => {
    // Check database health before running tests
    const health = await DatabaseInitializer.checkDatabaseHealth();
    if (!health.isHealthy) {
      console.warn('Database not properly initialized, some tests may fail');
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testEvent) {
      try {
        await EventService.delete(testEvent.id);
      } catch (error) {
        console.warn('Failed to cleanup test event:', error);
      }
    }
  });

  describe('EventService', () => {
    it('should create a new event', async () => {
      testEvent = await EventService.create(mockEventData);

      expect(testEvent).toBeDefined();
      expect(testEvent.id).toBeDefined();
      expect(testEvent.title).toBe(mockEventData.title);
      expect(testEvent.description).toBe(mockEventData.description);
      expect(testEvent.participationCode).toBeDefined();
      expect(testEvent.participationCode).toHaveLength(6);
      expect(testEvent.livekitRoomName).toBeDefined();
      expect(testEvent.status).toBe('scheduled');
    });

    it('should get event by ID', async () => {
      const retrievedEvent = await EventService.getById(testEvent.id);

      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent!.id).toBe(testEvent.id);
      expect(retrievedEvent!.title).toBe(testEvent.title);
    });

    it('should get event by participation code', async () => {
      const retrievedEvent = await EventService.getByParticipationCode(
        testEvent.participationCode
      );

      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent!.id).toBe(testEvent.id);
      expect(retrievedEvent!.participationCode).toBe(testEvent.participationCode);
    });

    it('should update event', async () => {
      const updatedTitle = 'Updated Test Event';
      const updatedEvent = await EventService.update(testEvent.id, {
        title: updatedTitle,
        status: 'live',
      });

      expect(updatedEvent.title).toBe(updatedTitle);
      expect(updatedEvent.status).toBe('live');
      expect(updatedEvent.updatedAt.getTime()).toBeGreaterThan(
        testEvent.updatedAt.getTime()
      );

      // Update testEvent reference for cleanup
      testEvent = updatedEvent;
    });

    it('should list events', async () => {
      const events = await EventService.list({ limit: 10 });

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      // Our test event should be in the list
      const foundEvent = events.find(e => e.id === testEvent.id);
      expect(foundEvent).toBeDefined();
    });

    it('should return null for non-existent event', async () => {
      const nonExistentEvent = await EventService.getById('non-existent-id');
      expect(nonExistentEvent).toBeNull();
    });
  });

  describe('CameraConnectionService', () => {
    beforeEach(() => {
      // Ensure we have a test event for camera connection tests
      if (!testEvent) {
        throw new Error('Test event not available for camera connection tests');
      }
    });

    it('should create a new camera connection', async () => {
      testCamera = await CameraConnectionService.create({
        eventId: testEvent.id,
        ...mockCameraData,
      });

      expect(testCamera).toBeDefined();
      expect(testCamera.id).toBeDefined();
      expect(testCamera.eventId).toBe(testEvent.id);
      expect(testCamera.participantId).toBe(mockCameraData.participantId);
      expect(testCamera.participantName).toBe(mockCameraData.participantName);
      expect(testCamera.status).toBe('connecting');
      expect(testCamera.deviceInfo).toEqual(mockCameraData.deviceInfo);
    });

    it('should get camera connections by event ID', async () => {
      const connections = await CameraConnectionService.getByEventId(testEvent.id);

      expect(Array.isArray(connections)).toBe(true);
      expect(connections.length).toBeGreaterThan(0);
      
      const foundConnection = connections.find(c => c.id === testCamera.id);
      expect(foundConnection).toBeDefined();
    });

    it('should update camera connection status', async () => {
      const updatedCamera = await CameraConnectionService.updateStatus(
        testCamera.id,
        'active',
        {
          resolution: '720p',
          frameRate: 30,
          bitrate: 2000,
          codec: 'h264',
        }
      );

      expect(updatedCamera.status).toBe('active');
      expect(updatedCamera.streamQuality.resolution).toBe('720p');
      expect(updatedCamera.lastActiveAt.getTime()).toBeGreaterThan(
        testCamera.lastActiveAt.getTime()
      );

      // Update testCamera reference
      testCamera = updatedCamera;
    });

    it('should set disconnected_at when status is inactive', async () => {
      const disconnectedCamera = await CameraConnectionService.updateStatus(
        testCamera.id,
        'inactive'
      );

      expect(disconnectedCamera.status).toBe('inactive');
      expect(disconnectedCamera.disconnectedAt).toBeDefined();
    });
  });

  describe('StreamStatusService', () => {
    it('should create/update stream status', async () => {
      const streamStatus = await StreamStatusService.upsert({
        eventId: testEvent.id,
        isLive: true,
        activeCameraCount: 1,
        currentActiveCamera: testCamera.id,
        youtubeViewerCount: 10,
        streamHealth: 'good',
      });

      expect(streamStatus).toBeDefined();
      expect(streamStatus.eventId).toBe(testEvent.id);
      expect(streamStatus.isLive).toBe(true);
      expect(streamStatus.activeCameraCount).toBe(1);
      expect(streamStatus.streamHealth).toBe('good');
    });

    it('should get stream status by event ID', async () => {
      const streamStatus = await StreamStatusService.getByEventId(testEvent.id);

      expect(streamStatus).toBeDefined();
      expect(streamStatus!.eventId).toBe(testEvent.id);
      expect(streamStatus!.isLive).toBe(true);
    });

    it('should return null for non-existent stream status', async () => {
      const nonExistentStatus = await StreamStatusService.getByEventId('non-existent-id');
      expect(nonExistentStatus).toBeNull();
    });
  });
});

// Data model validation tests
describe('Data Model Validation', () => {
  it('should validate Event interface structure', () => {
    const event: EventClient = {
      id: 'test-id',
      title: 'Test Event',
      description: 'Test Description',
      scheduledAt: new Date(),
      status: 'scheduled',
      participationCode: 'TEST01',
      youtubeStreamUrl: 'https://youtube.com/watch?v=test',
      youtubeStreamKey: 'test-key',
      youtubeVideoId: 'test-video-id',
      livekitRoomName: 'test-room',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Type checking ensures the interface is properly structured
    expect(event.id).toBeDefined();
    expect(event.title).toBeDefined();
    expect(['scheduled', 'live', 'ended']).toContain(event.status);
  });

  it('should validate CameraConnection interface structure', () => {
    const camera: CameraConnectionClient = {
      id: 'test-id',
      eventId: 'event-id',
      participantId: 'participant-id',
      participantName: 'Test Participant',
      deviceInfo: {
        userAgent: 'Test Agent',
        screenResolution: '1920x1080',
        connectionType: '4g',
        platform: 'mobile',
        browser: 'chrome',
      },
      streamQuality: {
        resolution: '720p',
        frameRate: 30,
        bitrate: 2000,
        codec: 'h264',
      },
      status: 'active',
      joinedAt: new Date(),
      lastActiveAt: new Date(),
    };

    expect(camera.id).toBeDefined();
    expect(camera.eventId).toBeDefined();
    expect(['connecting', 'active', 'inactive', 'error']).toContain(camera.status);
  });

  it('should validate participation code format', () => {
    const validCodes = ['ABC123', 'XYZ789', 'TEST01'];
    const invalidCodes = ['abc123', '12345', 'TOOLONG', 'A'];

    validCodes.forEach(code => {
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    invalidCodes.forEach(code => {
      expect(code).not.toMatch(/^[A-Z0-9]{6}$/);
    });
  });
});