'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, Track } from 'livekit-client';
import { apiRequest } from '@/lib/api-client';
export type CameraPhase = 'preview' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export function useCameraSession(eventId: string) {
  const [phase, setPhase] = useState<CameraPhase>('preview');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const generation = useRef(0);
  const media = useRef<MediaStream | null>(null);
  const acquiring = useRef<Promise<MediaStream> | null>(null);
  const tracks = useRef<{ video: LocalVideoTrack; audio: LocalAudioTrack } | null>(null);
  const room = useRef<Room | null>(null);
  const busy = useRef(false);
  const clearMedia = useCallback(() => {
    tracks.current?.video.stop(); tracks.current?.audio.stop(); tracks.current = null;
    media.current?.getTracks().forEach(t => t.stop()); media.current = null;
  }, []);
  const initialize = useCallback(async () => {
    if (media.current) return media.current;
    if (acquiring.current) return acquiring.current;
    const version = generation.current;
    let expired = false;
    let timeout: ReturnType<typeof setTimeout>;
    const request = navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'environment' }, audio: true,
    }).then(stream => {
      if (expired || generation.current !== version) { stream.getTracks().forEach(t => t.stop()); throw new Error('接続を中止しました'); }
      media.current = stream; setPreview(stream); return stream;
    });
    const operation = Promise.race([request, new Promise<MediaStream>((_, reject) => {
      timeout = setTimeout(() => { expired = true; reject(new Error('カメラの許可待ちがタイムアウトしました')); }, 15000);
    })]).finally(() => { clearTimeout(timeout); if (acquiring.current === operation) acquiring.current = null; });
    acquiring.current = operation;
    return operation;
  }, []);
  const previewCamera = useCallback(async () => {
    setError(null);
    try { await initialize(); }
    catch (e) { setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'カメラ・マイクへのアクセスが拒否されました' : 'カメラ・マイクを起動できません'); }
  }, [initialize]);
  useEffect(() => {
    ++generation.current;
    const connection = new Room(); room.current = connection;
    const onReconnecting = () => setPhase('reconnecting');
    const onReconnected = () => { setPhase('connected'); setError(null); };
    const onDisconnected = () => {
      if (room.current !== connection) return;
      clearMedia(); setPreview(null); setPhase('disconnected');
      setError('接続が終了しました。イベントが継続中なら再接続できます');
    };
    connection.on(RoomEvent.Reconnecting, onReconnecting);
    connection.on(RoomEvent.Reconnected, onReconnected);
    connection.on(RoomEvent.Disconnected, onDisconnected);
    // Preview is local; publishing starts only after an explicit action.
    void previewCamera();
    return () => {
      // This ref is a cancellation sequence, not a DOM node: invalidate all pending work.
      generation.current++; busy.current = false; acquiring.current = null;
      connection.off(RoomEvent.Reconnecting, onReconnecting);
      connection.off(RoomEvent.Reconnected, onReconnected);
      connection.off(RoomEvent.Disconnected, onDisconnected);
      clearMedia(); void connection.disconnect(); room.current = null;
    };
  }, [clearMedia, previewCamera]);
  const connect = useCallback(async () => {
    if (busy.current || !room.current) return;
    busy.current = true; setError(null); setPhase('connecting');
    const version = generation.current;
    const connection = room.current;
    try {
      const stream = await initialize();
      const grant = await apiRequest<{ roomToken: string; cameraConnectionId: string }>(`/api/events/${eventId}/join`, { method: 'POST', body: '{}' }, eventId);
      if (generation.current !== version) return;
      const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!url) throw new Error('配信サーバーが未設定です');
      await connection.connect(url, grant.roomToken);
      if (generation.current !== version) { await connection.disconnect(); return; }
      const video = stream.getVideoTracks()[0], audio = stream.getAudioTracks()[0];
      if (!video || !audio) throw new Error('カメラ・マイクが見つかりません');
      const publishing = { video: new LocalVideoTrack(video), audio: new LocalAudioTrack(audio) };
      tracks.current = publishing;
      await connection.localParticipant.publishTrack(publishing.video, { source: Track.Source.Camera });
      if (generation.current !== version) return;
      await connection.localParticipant.publishTrack(publishing.audio, { source: Track.Source.Microphone });
      if (generation.current !== version) return;
      setMuted(false); setVideoMuted(false); setPhase('connected');
    } catch (e) {
      if (generation.current !== version) return;
      clearMedia(); await connection.disconnect();
      if (generation.current === version) {
        setPreview(null); setPhase('disconnected'); setError(e instanceof Error ? e.message : '接続に失敗しました');
      }
    } finally { busy.current = false; }
  }, [eventId, initialize, clearMedia]);
  const disconnect = useCallback(async () => {
    generation.current++; clearMedia(); setPreview(null);
    await room.current?.disconnect(); setPhase('disconnected'); setError(null);
  }, [clearMedia]);
  const toggleAudio = useCallback(async () => {
    const audio = tracks.current?.audio;
    if (!audio) return;
    try { if (audio.isMuted) await audio.unmute(); else await audio.mute(); setMuted(audio.isMuted); }
    catch { setError('マイクの切り替えに失敗しました'); }
  }, []);
  const toggleVideo = useCallback(async () => {
    const video = tracks.current?.video;
    if (!video) return;
    try { if (video.isMuted) await video.unmute(); else await video.mute(); setVideoMuted(video.isMuted); }
    catch { setError('カメラの切り替えに失敗しました'); }
  }, []);
  return { phase, error, preview, muted, videoMuted, connect, disconnect, previewCamera, toggleAudio, toggleVideo };
}
