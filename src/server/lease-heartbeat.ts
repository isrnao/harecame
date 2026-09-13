import { AppError } from './errors';

// Keep external operations inside a live lease even while awaiting providers.
// After a failed renewal no further fenced saves or provider mutations may start.
export function leaseHeartbeat(renew: () => Promise<void>, intervalMs = 30000) {
  let lost = false;
  let pending: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (pending || lost) return;
    pending = renew().catch(() => { lost = true; }).finally(() => { pending = undefined; });
  }, intervalMs);
  return {
    assertOwned() {
      if (lost) throw new AppError(409, '配信処理のロックが失効しました。状態を再確認してください');
    },
    async stop() { clearInterval(timer); await pending; },
  };
}
