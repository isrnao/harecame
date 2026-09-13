'use client';
import { useEffect, useRef } from 'react';
import { useCameraSession } from '@/hooks/useCameraSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
interface Props { roomToken: string; roomName: string; eventId: string; eventTitle: string; participantName?: string; }
export function CameraStreamInterface({ eventId, eventTitle, participantName }: Props) {
  const session = useCameraSession(eventId);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (video.current) video.current.srcObject = session.preview; }, [session.preview]);
  const connected = session.phase === 'connected';
  const pending = session.phase === 'connecting' || session.phase === 'reconnecting';
  const label = { preview: 'プレビュー', connecting: '接続中', connected: '映像送信中', reconnecting: '再接続中', disconnected: '未接続' }[session.phase];
  return <div className="mx-auto max-w-3xl space-y-4">
    <h1 className="text-2xl font-bold">{eventTitle}</h1>
    {participantName && <p>{participantName}として参加中</p>}
    <Card><CardHeader><CardTitle>カメラプレビュー</CardTitle></CardHeader><CardContent className="space-y-4">
      <video ref={video} muted autoPlay playsInline className="aspect-video w-full rounded-lg bg-black object-contain" aria-label="カメラプレビュー" />
      <p role="status">{label}</p>
      <p className="text-sm text-muted-foreground">映像を送信すると、主催者が配信に使用できるようになります。</p>
      {session.error && <Alert variant="destructive"><AlertDescription>{session.error}</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-3">
        {!connected && <Button disabled={pending} onClick={() => void session.connect()}>{pending ? label : session.phase === 'disconnected' ? '再接続' : 'カメラを開始'}</Button>}
        {(connected || pending) && <Button variant="destructive" onClick={() => void session.disconnect()}>送信を停止</Button>}
        {connected && <><Button variant="outline" onClick={() => void session.toggleAudio()}>{session.muted ? 'マイクをオン' : 'マイクをミュート'}</Button>
          <Button variant="outline" onClick={() => void session.toggleVideo()}>{session.videoMuted ? '映像をオン' : '映像を停止'}</Button></>}
        {!session.preview && !pending && <Button variant="outline" onClick={() => void session.previewCamera()}>プレビューを再試行</Button>}
      </div>
    </CardContent></Card></div>;
}
