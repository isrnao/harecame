import { browserPolicy } from '../browser-policy';
import { clientAddress } from '../client-address';
import { listEvents, updateEvent } from '@/server/events';
import { EventService } from '../database';
import type { Actor } from '@/server/access';
jest.mock('../database', () => ({ EventService: { list: jest.fn(), getById: jest.fn(), update: jest.fn() } }));
jest.mock('../auth', () => ({}));
jest.mock('next/headers', () => ({}));
jest.mock('@/server/stream-store', () => ({ readSession: jest.fn() }));
const actor = { type: 'organizer', sub: 'organizer', eventId: 'event-a' } as Actor;
afterEach(() => { jest.clearAllMocks(); delete process.env.TRUSTED_PROXY_SECRET; });
it('restores CSP and production HSTS without upgrading development HTTP', () => {
  expect(browserPolicy(true)['Content-Security-Policy']).toContain("object-src 'none'");
  expect(browserPolicy(true)['Strict-Transport-Security']).toContain('max-age=');
  expect(browserPolicy(false)['Content-Security-Policy']).not.toContain('upgrade-insecure-requests');
  expect(browserPolicy(false)['Strict-Transport-Security']).toBeUndefined();
});
it('ignores spoofed forwarded IPs and requires a proxy secret for a distinct client bucket', () => {
  const headers = new Headers({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '1.2.3.4', 'x-harecame-client-ip': '1.2.3.4' });
  expect(clientAddress(headers)).toBe('shared');
  process.env.TRUSTED_PROXY_SECRET = 'trusted';
  headers.set('x-harecame-proxy-secret', 'spoofed'); expect(clientAddress(headers)).toBe('shared');
  headers.set('x-harecame-proxy-secret', 'trusted'); expect(clientAddress(headers)).toBe('1.2.3.4');
});
it('keeps anonymous event discovery disabled and bounds admin listings', async () => {
  await expect(listEvents(null)).rejects.toThrow('ログイン');
  await listEvents({ ...actor, type: 'admin' });
  expect(EventService.list).toHaveBeenCalledWith({ limit: 20, offset: 0 });
});
it('honors status and offset for event-scoped organizers', async () => {
  jest.mocked(EventService.getById).mockResolvedValue({ id: 'event-a', status: 'scheduled' } as never);
  expect(await listEvents(actor, { status: 'ended' })).toEqual([]);
  expect(await listEvents(actor, { offset: 1 })).toEqual([]);
  expect(await listEvents(actor, { status: 'scheduled' })).toHaveLength(1);
});
it('returns a not-found error before updating a missing event', async () => {
  jest.mocked(EventService.getById).mockResolvedValue(null);
  await expect(updateEvent(actor, 'event-a', { title: 'Updated' })).rejects.toMatchObject({ status: 404 });
  expect(EventService.update).not.toHaveBeenCalled();
});
