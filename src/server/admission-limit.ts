import 'server-only';
import { createHash } from 'node:crypto';
import { database } from './stream-store';
import { AppError } from './errors';
export async function limitAdmission(headers: Headers) {
  // The deployment proxy must overwrite, not append user-supplied forwarding headers.
  const address = headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = createHash('sha256').update(`camera-admission:${address}`).digest('hex');
  const { data, error } = await database().rpc('consume_admission_limit', { p_key: key });
  if (error) throw new AppError(503, '参加受付の状態を確認できません');
  if (!data) throw new AppError(429, '参加操作が多すぎます。1分ほど待ってお試しください');
}
