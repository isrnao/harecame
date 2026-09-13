import { authorize } from '@/server/access';
import { publicEvent } from '@/server/events';
import type { Actor } from '@/server/access';
import type { EventClient } from '@/types';
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/auth', () => ({}));
jest.mock('@/lib/database', () => ({}));
jest.mock('@/server/stream-store', () => ({}));
jest.mock('next/headers', () => ({}));

const actor = (type: Actor['type'], eventId = 'event-a') => ({ type, eventId, sub: 'user-a' }) as Actor;
describe('event authority and public data boundary', () => {
  it('rejects anonymous mutations and camera event administration', () => {
    expect(() => authorize(null, ['organizer'], 'event-a')).toThrow('ログイン');
    expect(() => authorize(actor('camera'), ['organizer'], 'event-a')).toThrow('権限');
  });
  it('allows an organizer only for the signed event', () => {
    expect(() => authorize(actor('organizer'), ['organizer'], 'event-a')).not.toThrow();
    expect(() => authorize(actor('organizer'), ['organizer'], 'event-b')).toThrow('権限');
    expect(() => authorize(actor('organizer'), [])).toThrow('権限');
  });
  it('allows the operator to administer events', () => {
    expect(() => authorize(actor('admin'), [], 'event-b')).not.toThrow();
  });
  it('never publishes invite codes, stream keys or future internal fields', () => {
    const result = publicEvent({ id: 'a', title: '試合', status: 'scheduled',
      participationCode: 'SECRET', youtubeStreamKey: 'KEY', livekitRoomName: 'internal',
      createdAt: new Date(), updatedAt: new Date(), futureSecret: 'do not serialize' } as EventClient);
    expect(result).toEqual({ id: 'a', title: '試合', status: 'scheduled', description: undefined,
      scheduledAt: undefined, youtubeStreamUrl: undefined, youtubeVideoId: undefined });
  });
});
