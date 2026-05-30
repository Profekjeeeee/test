-- Шаг 5 ROADMAP: платежи, доработка счетов, основа для эквайринга

-- ─── Расширение bills ────────────────────────────────────────────────────────
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS due_date date;

COMMENT ON COLUMN public.bills.due_date IS 'Срок оплаты счёта; просрочка → status overdue.';

-- ─── payments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.dental_clients (id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'online'
    CHECK (method IN ('online', 'cash', 'card_terminal', 'transfer')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  provider text NOT NULL DEFAULT 'mock'
    CHECK (provider IN ('mock', 'yookassa', 'tinkoff', 'sberbank')),
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_bill ON public.payments (bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON public.payments (patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_completed ON public.payments (completed_at)
  WHERE status = 'succeeded';

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_provider_external
  ON public.payments (provider, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON TABLE public.payments IS 'Платежи по счетам; эквайринг пишет external_id провайдера.';

-- ─── Синхронизация bills ← payments ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_bill_from_payments(p_bill_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid numeric;
  v_bill_amount numeric;
  v_due date;
  v_new_status text;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM public.payments
  WHERE bill_id = p_bill_id
    AND status = 'succeeded';

  SELECT amount, due_date
  INTO v_bill_amount, v_due
  FROM public.bills
  WHERE id = p_bill_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_total_paid >= v_bill_amount THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSIF v_due IS NOT NULL AND v_due < CURRENT_DATE THEN
    v_new_status := 'overdue';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.bills
  SET
    paid_amount = v_total_paid,
    status = v_new_status,
    paid_at = CASE
      WHEN v_new_status = 'paid' AND paid_at IS NULL THEN now()
      WHEN v_new_status <> 'paid' THEN NULL
      ELSE paid_at
    END
  WHERE id = p_bill_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payments_sync_bill_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_bill_from_payments(COALESCE(NEW.bill_id, OLD.bill_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_bill ON public.payments;
CREATE TRIGGER payments_sync_bill
  AFTER INSERT OR UPDATE OF status, amount OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_sync_bill_trigger();

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ─── RLS: payments ───────────────────────────────────────────────────────────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_authenticated ON public.payments;
DROP POLICY IF EXISTS payments_insert_authenticated ON public.payments;
DROP POLICY IF EXISTS payments_update_authenticated ON public.payments;
DROP POLICY IF EXISTS payments_delete_authenticated ON public.payments;

CREATE POLICY payments_select_authenticated
  ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
    OR public.doctor_can_access_patient(patient_id::text)
  );

CREATE POLICY payments_insert_authenticated
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY payments_update_authenticated
  ON public.payments FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR public.is_staff_user()
    OR (
      public.subject_client_pk() IS NOT NULL
      AND patient_id::text IS NOT DISTINCT FROM public.subject_client_pk()
    )
  );

CREATE POLICY payments_delete_authenticated
  ON public.payments FOR DELETE TO authenticated
  USING (public.is_admin_user());

NOTIFY pgrst, 'reload schema';
