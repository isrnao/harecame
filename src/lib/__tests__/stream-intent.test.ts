import { reconcileEvent } from '@/server/streaming';
import { withStreamLease } from '@/server/stream-store';
import { EventService, CameraConnectionService } from '@/lib/database';
import { livekitServices } from '@/server/livekit';
jest.mock('livekit-server-sdk', () => ({ EgressStatus: {}, TrackType: {} }));
jest.mock('@/server/access', () => ({ authorize: jest.fn() }));
jest.mock('@/server/stream-store', () => ({ withStreamLease: jest.fn() }));
jest.mock('@/lib/database', () => ({ EventService: { getById: jest.fn() }, CameraConnectionService: { getByEventId: jest.fn() } }));
jest.mock('@/server/livekit', () => ({ livekitServices: jest.fn() }));
jest.mock('@/server/youtube', () => ({ YouTubeProvider: jest.fn() }));
it('persists a recoverable phase with the start intent before contacting the provider', async () => {
  const stored: Record<string, unknown> = { phase: 'idle', desired: 'stopped' };
  const listParticipants = jest.fn();
  jest.mocked(livekitServices).mockReturnValue({ rooms: { listParticipants } } as never);
  jest.mocked(EventService.getById).mockResolvedValue({ status: 'scheduled' } as never);
  jest.mocked(CameraConnectionService.getByEventId).mockResolvedValue([{ id: 'camera' }] as never);
  jest.mocked(withStreamLease).mockImplementation(async (_id, work) => work(stored as never, async patch => {
    Object.assign(stored, patch);
    throw new Error('Process interrupted immediately after durable save');
  }));
  await expect(reconcileEvent('event', { action: 'start', cameraId: 'camera' })).rejects.toThrow('Process interrupted');
  expect(stored).toMatchObject({ desired: 'live', phase: 'preparing', selected_camera: 'camera' });
  expect(listParticipants).not.toHaveBeenCalled();
});
