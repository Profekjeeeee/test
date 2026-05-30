-- Шаг 8 ROADMAP: Audit Trail — журнал изменений медицинских данных

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  patient_id uuid REFERENCES public.dental_clients (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  actor_id text,
  actor_role text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient ON public.audit_logs (patient_id)
  WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs (table_name, record_id);

COMMENT ON TABLE public.audit_logs IS
  'Неизменяемый журнал изменений медицинских данных (триггеры на med-таблицах).';

-- ─── RLS: только админ читает; запись — через SECURITY DEFINER триггеры ─────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;

CREATE POLICY audit_logs_select_admin
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- ─── Хелпер: субъект изменения (сотрудник или пациент) ───────────────────────
CREATE OR REPLACE FUNCTION public.audit_resolve_actor()
RETURNS TABLE (actor_id text, actor_role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id::text, e.role::text
  FROM public.dental_employees e
  WHERE auth.uid() IS NOT NULL AND e.auth_user_id = auth.uid()
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id::text, 'client'::text
  FROM public.dental_clients c
  WHERE auth.uid() IS NOT NULL
    AND (c.auth_user_id = auth.uid() OR c.id::text = auth.uid()::text)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_resolve_actor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_resolve_actor() TO authenticated;

-- ─── Вычисление изменённых полей (UPDATE) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_jsonb_changed_keys(p_old jsonb, p_new jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    array_agg(DISTINCT k ORDER BY k),
    '{}'::text[]
  )
  FROM (
    SELECT jsonb_object_keys(coalesce(p_old, '{}'::jsonb) || coalesce(p_new, '{}'::jsonb)) AS k
  ) keys
  WHERE coalesce(p_old, '{}'::jsonb) -> k IS DISTINCT FROM coalesce(p_new, '{}'::jsonb) -> k;
$$;

-- ─── Универсальный триггер для таблиц с patient_id ───────────────────────────
CREATE OR REPLACE FUNCTION public.audit_medical_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_patient_id uuid;
  v_record_id text;
  v_old jsonb;
  v_new jsonb;
  v_actor_id text;
  v_actor_role text;
BEGIN
  v_action := lower(TG_OP);

  SELECT a.actor_id, a.actor_role
  INTO v_actor_id, v_actor_role
  FROM public.audit_resolve_actor() a
  LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_patient_id := OLD.patient_id;
    v_record_id := OLD.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_patient_id := NEW.patient_id;
    v_record_id := NEW.id::text;
  ELSE
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_patient_id := NEW.patient_id;
    v_record_id := NEW.id::text;
  END IF;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    patient_id,
    action,
    actor_id,
    actor_role,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    v_patient_id,
    v_action,
    v_actor_id,
    v_actor_role,
    v_old,
    v_new,
    CASE
      WHEN v_action = 'update' THEN public.audit_jsonb_changed_keys(v_old, v_new)
      ELSE '{}'::text[]
    END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Триггер для dental_clients (formula_teeth, internal_notes) ───────────────
CREATE OR REPLACE FUNCTION public.audit_dental_client_medical_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := 'update';
  v_old jsonb;
  v_new jsonb;
  v_actor_id text;
  v_actor_role text;
  v_subset_old jsonb;
  v_subset_new jsonb;
BEGIN
  v_subset_old := jsonb_build_object(
    'formula_teeth', OLD.formula_teeth,
    'internal_notes', OLD.internal_notes
  );
  v_subset_new := jsonb_build_object(
    'formula_teeth', NEW.formula_teeth,
    'internal_notes', NEW.internal_notes
  );

  IF v_subset_old IS NOT DISTINCT FROM v_subset_new THEN
    RETURN NEW;
  END IF;

  SELECT a.actor_id, a.actor_role
  INTO v_actor_id, v_actor_role
  FROM public.audit_resolve_actor() a
  LIMIT 1;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    patient_id,
    action,
    actor_id,
    actor_role,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    'dental_clients',
    NEW.id::text,
    NEW.id,
    v_action,
    v_actor_id,
    v_actor_role,
    v_old,
    v_new,
    public.audit_jsonb_changed_keys(v_subset_old, v_subset_new)
  );

  RETURN NEW;
END;
$$;

-- ─── Подключение триггеров ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_medical_records ON public.medical_records;
CREATE TRIGGER audit_medical_records
  AFTER INSERT OR UPDATE OR DELETE ON public.medical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_medical_row_change();

DROP TRIGGER IF EXISTS audit_patient_visits ON public.patient_visits;
CREATE TRIGGER audit_patient_visits
  AFTER INSERT OR UPDATE OR DELETE ON public.patient_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_medical_row_change();

DROP TRIGGER IF EXISTS audit_patient_files ON public.patient_files;
CREATE TRIGGER audit_patient_files
  AFTER INSERT OR UPDATE OR DELETE ON public.patient_files
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_medical_row_change();

DROP TRIGGER IF EXISTS audit_treatment_plan_items ON public.treatment_plan_items;
CREATE TRIGGER audit_treatment_plan_items
  AFTER INSERT OR UPDATE OR DELETE ON public.treatment_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_medical_row_change();

DROP TRIGGER IF EXISTS audit_dental_clients_medical ON public.dental_clients;
CREATE TRIGGER audit_dental_clients_medical
  AFTER UPDATE OF formula_teeth, internal_notes ON public.dental_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_dental_client_medical_change();

NOTIFY pgrst, 'reload schema';
