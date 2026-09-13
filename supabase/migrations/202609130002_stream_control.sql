BEGIN;
CREATE TABLE public.stream_sessions (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'idle' CHECK (phase IN ('idle','preparing','starting','live','stopping','stopped','failed')),
  desired text NOT NULL DEFAULT 'stopped' CHECK (desired IN ('live','stopped')),
  selected_camera uuid REFERENCES public.camera_connections(id),
  fallback_camera uuid REFERENCES public.camera_connections(id),
  egress_id text,
  broadcast_id text,
  youtube_stream_id text,
  ingestion_url text,
  stream_creation_attempted boolean NOT NULL DEFAULT false,
  broadcast_creation_attempted boolean NOT NULL DEFAULT false,
  egress_creation_attempted boolean NOT NULL DEFAULT false,
  last_error text,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stream_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stream_sessions FROM anon, authenticated;
CREATE TRIGGER stream_sessions_updated BEFORE UPDATE ON public.stream_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.acquire_stream_lease(p_event_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.stream_sessions(event_id) VALUES(p_event_id) ON CONFLICT DO NOTHING;
  UPDATE public.stream_sessions SET lease_token = p_token, lease_until = now() + interval '120 seconds'
  WHERE event_id = p_event_id AND (lease_until IS NULL OR lease_until < now());
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.acquire_stream_lease(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_stream_lease(uuid, uuid) TO service_role;

-- Serialize admission, including connecting reservations; retries reuse identity.
CREATE OR REPLACE FUNCTION public.join_camera(p_event_id uuid, p_identity text, p_name text, p_device jsonb)
RETURNS public.camera_connections LANGUAGE plpgsql SET search_path = public AS $$
DECLARE e public.events; c public.camera_connections;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF e.id IS NULL OR e.status = 'ended' THEN RAISE EXCEPTION 'event unavailable'; END IF;
  SELECT * INTO c FROM public.camera_connections WHERE event_id = p_event_id AND participant_id = p_identity
    ORDER BY joined_at DESC LIMIT 1;
  IF c.id IS NOT NULL AND c.status IN ('connecting','active') THEN RETURN c; END IF;
  -- Expired unconnected reservations do not occupy a slot forever.
  UPDATE public.camera_connections SET status = 'inactive', disconnected_at = now()
    WHERE event_id = p_event_id AND status = 'connecting' AND last_active_at < now() - interval '10 minutes';
  IF (SELECT count(*) FROM public.camera_connections WHERE event_id = p_event_id AND status IN ('connecting','active')) >= 10
    THEN RAISE EXCEPTION 'camera limit reached'; END IF;
  IF c.id IS NOT NULL THEN
    UPDATE public.camera_connections SET status = 'connecting', last_active_at = now(), disconnected_at = NULL,
      participant_name = p_name, device_info = p_device WHERE id = c.id RETURNING * INTO c;
  ELSE
    INSERT INTO public.camera_connections(event_id,participant_id,participant_name,device_info)
      VALUES(p_event_id,p_identity,p_name,p_device) RETURNING * INTO c;
  END IF;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.join_camera(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_camera(uuid,text,text,jsonb) TO service_role;

CREATE TABLE public.provider_notifications (
  id text PRIMARY KEY,
  room_name text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.provider_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_notifications FROM anon, authenticated;
COMMIT;
