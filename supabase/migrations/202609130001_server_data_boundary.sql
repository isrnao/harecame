-- App JWTs are intentionally not Supabase Auth JWTs. All data is accessed
-- through authorized server services using the service role. Never grant anon
-- a catch-all policy; public views are explicit DTOs in the application.
BEGIN;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.camera_connections;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.stream_status;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.event_logs;
REVOKE ALL ON public.events, public.camera_connections, public.stream_status, public.event_logs FROM anon, authenticated;
-- Serialize partial updates without resetting unrelated fields.
CREATE OR REPLACE FUNCTION public.patch_stream_status(p_event_id uuid, p_patch jsonb)
RETURNS public.stream_status LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result public.stream_status;
BEGIN
  INSERT INTO public.stream_status(event_id) VALUES (p_event_id) ON CONFLICT (event_id) DO NOTHING;
  UPDATE public.stream_status SET
    is_live = CASE WHEN p_patch ? 'is_live' THEN (p_patch->>'is_live')::boolean ELSE is_live END,
    active_camera_count = CASE WHEN p_patch ? 'active_camera_count' THEN (p_patch->>'active_camera_count')::integer ELSE active_camera_count END,
    current_active_camera = CASE WHEN p_patch ? 'current_active_camera' THEN (p_patch->>'current_active_camera')::uuid ELSE current_active_camera END,
    youtube_viewer_count = CASE WHEN p_patch ? 'youtube_viewer_count' THEN (p_patch->>'youtube_viewer_count')::integer ELSE youtube_viewer_count END,
    stream_health = CASE WHEN p_patch ? 'stream_health' THEN p_patch->>'stream_health' ELSE stream_health END
  WHERE event_id = p_event_id RETURNING * INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.patch_stream_status(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_stream_status(uuid, jsonb) TO service_role;
COMMIT;
