import { leaseHeartbeat } from '@/server/lease-heartbeat';
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it('renews during a provider operation longer than the initial lease and stops its timer', async () => {
  const renew = jest.fn().mockResolvedValue(undefined);
  const heartbeat = leaseHeartbeat(renew);
  await jest.advanceTimersByTimeAsync(150000);
  expect(renew).toHaveBeenCalledTimes(5);
  expect(() => heartbeat.assertOwned()).not.toThrow();
  await heartbeat.stop();
  await jest.advanceTimersByTimeAsync(60000);
  expect(renew).toHaveBeenCalledTimes(5);
});
it('fences further work after renewal fails', async () => {
  const heartbeat = leaseHeartbeat(jest.fn().mockRejectedValue(new Error('DB unavailable')));
  await jest.advanceTimersByTimeAsync(30000);
  expect(() => heartbeat.assertOwned()).toThrow('ロックが失効');
  await heartbeat.stop();
});
it('does not issue overlapping renewals and waits for the in-flight renewal when stopping', async () => {
  let finish!: () => void;
  const renew = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const heartbeat = leaseHeartbeat(renew);
  await jest.advanceTimersByTimeAsync(90000);
  expect(renew).toHaveBeenCalledTimes(1);
  const stopped = heartbeat.stop(); finish(); await stopped;
});
