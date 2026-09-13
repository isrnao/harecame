import 'server-only';
import { cookies } from 'next/headers';
import { AuthService, type JWTPayload, type TokenType } from '@/lib/auth';
import { AppError } from './errors';

export type Actor = JWTPayload;

export async function requestActor(request: Request, cameraEventId?: string): Promise<Actor | null> {
  const bearer = request.headers.get('authorization');
  const values = request.headers.get('cookie')?.split(';').map(v => v.trim()) ?? [];
  const readCookie = (name: string) => values.find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);
  const cookie = (cameraEventId ? readCookie(`harecame-camera-${cameraEventId}`) : undefined) ?? readCookie('harecame-session');
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : cookie;
  return token ? AuthService.verifyToken(token) : null;
}

export async function sessionActor(): Promise<Actor | null> {
  const token = (await cookies()).get('harecame-session')?.value;
  return token ? AuthService.verifyToken(token) : null;
}

export function authorize(actor: Actor | null, types: TokenType[], eventId?: string): asserts actor is Actor {
  if (!actor) throw new AppError(401, 'ログインが必要です');
  if (actor.type === 'admin') return;
  if (!types.includes(actor.type) || (eventId !== undefined && actor.eventId !== eventId)) {
    throw new AppError(403, 'この操作を行う権限がありません');
  }
}
