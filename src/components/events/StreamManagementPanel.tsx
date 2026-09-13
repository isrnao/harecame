'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { CameraConnectionClient, StreamStatusClient } from '@/types';
interface Props { eventId: string; cameras: CameraConnectionClient[]; streamStatus: StreamStatusClient | null;
  activeCamera: CameraConnectionClient | null; onActiveCameraChange(camera: CameraConnectionClient | null): void; }
interface Control { phase: string; desired: string; selectedCamera: string | null; fallbackCamera: string | null; lastError: string | null; updatedAt?: string | null; watchUrl?: string | null; }
const labels: Record<string, string> = { idle: '未開始', preparing: '配信を準備中', starting: '配信先の確認中', live: '配信中', stopping: '配信を停止中', stopped: '終了', failed: '要確認' };
export function StreamManagementPanel({ eventId, cameras, activeCamera }: Props) {
  const initialized = useRef<string | null>(null);
  const [state, setState] = useState<Control | null>(null);
  const [primary, setPrimary] = useState('');
  const [backup, setBackup] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const load = useCallback(async () => {
    const current = await apiRequest<Control>(`/api/events/${eventId}/control`);
    setState(current);
    if (initialized.current !== eventId) {
      setPrimary(current.selectedCamera ?? ''); setBackup(current.fallbackCamera ?? '');
      initialized.current = eventId;
    }
  }, [eventId]);
  useEffect(() => {
    let stopped = false;
    const poll = async () => { try { if (!stopped) await load(); } catch { if (!stopped) setError('配信状態を確認できません'); } };
    void poll(); const timer = setInterval(poll, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [load]);
  const command = async (action: string) => {
    setBusy(true); setError(null);
    try {
      const current = await apiRequest<Control>(`/api/events/${eventId}/control`, { method: 'POST', body: JSON.stringify({ action,
        ...(['start','select'].includes(action) && { cameraId: primary, fallbackCameraId: backup || null }) }) });
      setState(current);
      // The parent dashboard uses provider-observed currentActiveCamera, not the configured primary.
    } catch (e) { setError(e instanceof Error ? e.message : '操作に失敗しました'); await load().catch(() => {}); }
    finally { setBusy(false); }
  };
  const handoff = async () => {
    try { const value = await apiRequest<{ token: string }>(`/api/events/${eventId}/organizer-token`, { method: 'POST', body: '{}' }); setAccessToken(value.token); }
    catch (e) { setError(e instanceof Error ? e.message : '管理者としてログインしてください'); }
  };
  return <Card><CardHeader><CardTitle>配信操作</CardTitle></CardHeader><CardContent className="space-y-4">
    <p role="status">{state ? labels[state.phase] ?? state.phase : '状態を確認中'}</p>
    {activeCamera && <p>使用中のカメラ: {activeCamera.participantName || activeCamera.participantId}</p>}
    {state?.updatedAt && state.phase !== 'idle' && state.phase !== 'stopped' && Date.now() - new Date(state.updatedAt).getTime() > 90000 && <p role="alert">状態の確認が遅れています。配信状態を再確認してください。</p>}
    {(error || state?.lastError) && <Alert variant="destructive"><AlertDescription>{error || state?.lastError}</AlertDescription></Alert>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-2">メインカメラ<select aria-label="メインカメラ" className="w-full rounded border p-2" value={primary} onChange={e => { initialized.current = eventId; setPrimary(e.target.value); if (e.target.value === backup) setBackup(''); }}>
        <option value="">カメラを選択</option>{cameras.map(c => <option key={c.id} value={c.id}>{c.participantName || c.participantId}（{c.status === 'active' ? '映像あり' : '待機'}）</option>)}
      </select></label>
      <label className="space-y-2">予備カメラ<select aria-label="予備カメラ" className="w-full rounded border p-2" value={backup} onChange={e => { initialized.current = eventId; setBackup(e.target.value); }}>
        <option value="">使用しない</option>{cameras.filter(c => c.id !== primary).map(c => <option key={c.id} value={c.id}>{c.participantName || c.participantId}</option>)}
      </select></label>
    </div>
    <p className="text-sm text-muted-foreground">予備カメラはメインの映像が途切れたときに使用します。復旧するとメインに戻ります。新しく参加したカメラへ自動で切り替わることはありません。</p>
    <div className="flex flex-wrap gap-3">
      <Button disabled={busy || !primary || state?.phase === 'stopped' || state?.phase === 'stopping'} onClick={() => void command(state?.desired === 'live' ? 'select' : 'start')}>{state?.desired === 'live' ? 'カメラ選択を反映' : '配信を開始'}</Button>
      <Button variant="outline" disabled={busy} onClick={() => void command('reconcile')}>状態を再確認</Button>
      <Button variant="destructive" disabled={busy || state?.phase === 'stopped'} onClick={() => void command('stop')}>配信を終了</Button>
    </div>
    <p className="text-sm text-muted-foreground">終了操作は番組を終了し、配信出力とカメラ接続を停止します。再度配信する場合は新しいイベントを作成してください。</p>
    {state?.watchUrl && <a href={state.watchUrl} target="_blank" rel="noreferrer" className="underline">YouTubeで配信・アーカイブを確認</a>}
    <div className="border-t pt-4 space-y-2"><Button variant="outline" onClick={() => void handoff()}>当日の主催者用ログインコードを発行</Button>
      <p className="text-sm text-muted-foreground">管理者のみ発行できます。このイベントだけを操作でき、有効期間は12時間です。</p>
      {accessToken && <><textarea readOnly aria-label="主催者用ログインコード" className="w-full rounded border p-2" value={accessToken} /><p className="text-sm">このコードを担当者に安全な方法で渡し、ログイン画面で入力してもらってください。</p></>}
    </div>
  </CardContent></Card>;
}
