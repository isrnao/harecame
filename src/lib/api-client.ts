'use client';
export async function apiRequest<T>(url: string, init: RequestInit = {}, cameraEventId?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (cameraEventId) {
    const token = sessionStorage.getItem(`harecame_camera_auth_${cameraEventId}`);
    if (!token) throw new Error('参加セッションがありません。参加コードから入り直してください');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.error || '通信に失敗しました。もう一度お試しください');
  return body.data as T;
}
