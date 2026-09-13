'use client';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import EgressHelper from '@livekit/egress-sdk';
import { parseCameraLayout, selectCamera } from '@/lib/compositor';

// This page is rendered by LiveKit's recorder. Only the chosen camera's
// video AND audio are attached; other participants never enter the program.
export default function EgressPage() {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('url') || !params.get('token')) return;
    const room = new Room();
    let disposed = false;
    let layout = parseCameraLayout(EgressHelper.getLayout());
    let attached: Track[] = [];
    let selectedIdentity: string | null = null;
    let selectedTracks = '';
    const render = () => {
      if (disposed) return;
      const participants = [...room.remoteParticipants.values()];
      const available = new Set(participants.filter(p => [...p.videoTrackPublications.values()].some(t => t.track && !t.isMuted)).map(p => p.identity));
      const identity = selectCamera(layout, available);
      const participant = participants.find(p => p.identity === identity);
      const tracks = participant ? [...participant.trackPublications.values()].filter(p => p.track && !p.isMuted).map(p => p.track!) : [];
      const signature = tracks.map(t => t.sid).join(',');
      if (identity === selectedIdentity && signature === selectedTracks) return;
      attached.forEach(t => t.detach());
      if (video.current) video.current.srcObject = null;
      if (audio.current) audio.current.srcObject = null;
      selectedIdentity = identity;
      selectedTracks = signature;
      attached = tracks;
      tracks.forEach(t => {
        if (t.kind === Track.Kind.Video && video.current) t.attach(video.current);
        if (t.kind === Track.Kind.Audio && audio.current) t.attach(audio.current);
      });
      setWaiting(!identity);
    };
    const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ParticipantDisconnected];
    events.forEach(e => room.on(e, render));
    EgressHelper.onLayoutChanged(value => { layout = parseCameraLayout(value); render(); });
    void room.connect(EgressHelper.getLiveKitURL(), EgressHelper.getAccessToken()).then(() => {
      if (disposed) { void room.disconnect(); return; }
      EgressHelper.setRoom(room);
      render();
      EgressHelper.startRecording();
    }).catch(() => setWaiting(true));
    return () => { disposed = true; attached.forEach(t => t.detach()); void room.disconnect(); };
  }, []);
  return <main style={{ position: 'fixed', inset: 0, background: '#101820', color: 'white', zIndex: 99999 }}>
    <video ref={video} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    <audio ref={audio} autoPlay />
    {waiting && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 40 }}>映像の復旧をお待ちください</div>}
  </main>;
}
