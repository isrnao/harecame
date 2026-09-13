BEGIN;
GRANT ALL ON public.events, public.camera_connections, public.stream_status, public.event_logs,
  public.stream_sessions, public.provider_notifications TO service_role;
CREATE TABLE public.admission_limits (key_hash text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL);
ALTER TABLE public.admission_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admission_limits FROM anon, authenticated;
GRANT ALL ON public.admission_limits TO service_role;
CREATE INDEX admission_limits_expiry ON public.admission_limits(reset_at);
CREATE OR REPLACE FUNCTION public.consume_admission_limit(p_key text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE used integer;
BEGIN
  DELETE FROM public.admission_limits WHERE reset_at < now() - interval '1 hour';
  INSERT INTO public.admission_limits(key_hash, attempts, reset_at) VALUES(p_key, 1, now() + interval '1 minute')
  ON CONFLICT(key_hash) DO UPDATE SET
    attempts = CASE WHEN admission_limits.reset_at < now() THEN 1 ELSE admission_limits.attempts + 1 END,
    reset_at = CASE WHEN admission_limits.reset_at < now() THEN now() + interval '1 minute' ELSE admission_limits.reset_at END
  RETURNING attempts INTO used;
  RETURN used <= 10;
END $$;
REVOKE ALL ON FUNCTION public.consume_admission_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_admission_limit(text) TO service_role;
COMMIT;
