-- PIN для Supabase Auth: profiles.pin_hash, RPC set_user_pin / verify_user_pin.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  pin_hash text,
  pin_failed_attempts integer NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Профиль Auth-пользователя: PIN-хэш и блокировка.';
COMMENT ON COLUMN public.profiles.pin_hash IS 'bcrypt-хэш PIN (pgcrypto crypt).';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_insert_own
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user_profile();

CREATE OR REPLACE FUNCTION public.ensure_profile_row(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.profiles (id) VALUES (p_user_id) ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_pin(p_user_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  digits := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  IF length(digits) < 4 OR length(digits) > 6 THEN
    RAISE EXCEPTION 'PIN must be 4–6 digits' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ensure_profile_row(p_user_id);

  UPDATE public.profiles
  SET
    pin_hash = crypt(digits, gen_salt('bf', 8)),
    pin_failed_attempts = 0,
    pin_locked_until = NULL,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits text;
  row public.profiles%ROWTYPE;
  remaining integer;
  max_attempts constant integer := 5;
  lock_minutes constant integer := 15;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  digits := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  IF length(digits) < 4 OR length(digits) > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_format', 'remaining', max_attempts);
  END IF;

  SELECT * INTO row FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR row.pin_hash IS NULL OR row.pin_hash = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_pin');
  END IF;

  IF row.pin_locked_until IS NOT NULL AND row.pin_locked_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'locked',
      'locked_until', row.pin_locked_until,
      'remaining', 0
    );
  END IF;

  IF row.pin_hash = crypt(digits, row.pin_hash) THEN
    UPDATE public.profiles
    SET pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = now()
    WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  remaining := GREATEST(0, max_attempts - (row.pin_failed_attempts + 1));

  IF row.pin_failed_attempts + 1 >= max_attempts THEN
    UPDATE public.profiles
    SET
      pin_failed_attempts = max_attempts,
      pin_locked_until = now() + (lock_minutes || ' minutes')::interval,
      updated_at = now()
    WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'locked',
      'locked_until', now() + (lock_minutes || ' minutes')::interval,
      'remaining', 0
    );
  END IF;

  UPDATE public.profiles
  SET pin_failed_attempts = pin_failed_attempts + 1, updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', false, 'error', 'wrong_pin', 'remaining', remaining);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile_row(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_user_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_pin(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.verify_user_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(uuid, text) TO authenticated;
