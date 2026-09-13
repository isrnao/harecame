'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLoginForm } from '@/components/auth/AdminLoginForm';
import { apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enter = async () => {
    setBusy(true); setError(null);
    try { const data = await apiRequest<{ eventId: string }>('/api/auth/organizer', { method: 'POST', body: JSON.stringify({ token: token.trim() }) });
      router.push(`/events/${data.eventId}/dashboard`); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'ログインできません'); }
    finally { setBusy(false); }
  };
  return <main className="container mx-auto p-8 space-y-8">
    <AdminLoginForm onSuccess={() => { router.push('/events'); router.refresh(); }} />
    <form className="mx-auto max-w-md space-y-3 rounded-lg border p-6" onSubmit={e => { e.preventDefault(); void enter(); }}>
      <h2 className="text-xl font-semibold">当日の主催者ログイン</h2>
      <label htmlFor="organizer-token">担当者から受け取ったログインコード</label>
      <input id="organizer-token" type="password" className="w-full rounded border p-2" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" required />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !token.trim()}>イベントを開く</Button>
    </form>
  </main>;
}
