-- Шаг 7 ROADMAP: KPI врачей, аналитика пациентов

-- ─── doctor_metrics (кэш KPI по врачам) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_metrics (
  doctor_key text PRIMARY KEY,
  doctor_id text,
  doctor_name text NOT NULL,
  specialization text NOT NULL DEFAULT '',
  appointments_month integer NOT NULL DEFAULT 0,
  appointments_total integer NOT NULL DEFAULT 0,
  completed_month integer NOT NULL DEFAULT 0,
  cancelled_month integer NOT NULL DEFAULT 0,
  unique_patients_month integer NOT NULL DEFAULT 0,
  revenue_month numeric NOT NULL DEFAULT 0,
  revenue_total numeric NOT NULL DEFAULT 0,
  completion_rate numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_metrics_revenue_month ON public.doctor_metrics (revenue_month DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_metrics_doctor_id ON public.doctor_metrics (doctor_id)
  WHERE doctor_id IS NOT NULL AND doctor_id <> '';

COMMENT ON TABLE public.doctor_metrics IS
  'KPI врачей; обновляются через refresh_doctor_metrics().';

-- ─── Обновление KPI врачей ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_doctor_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_month_start date := date_trunc('month', CURRENT_DATE)::date;
  v_month_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
BEGIN
  DELETE FROM public.doctor_metrics;

  INSERT INTO public.doctor_metrics (
    doctor_key,
    doctor_id,
    doctor_name,
    specialization,
    appointments_month,
    appointments_total,
    completed_month,
    cancelled_month,
    unique_patients_month,
    revenue_month,
    revenue_total,
    completion_rate,
    updated_at
  )
  WITH apt_base AS (
    SELECT
      COALESCE(NULLIF(TRIM(a.doctor_id), ''), '') AS doctor_id,
      COALESCE(NULLIF(TRIM(a.doctor_name), ''), 'Врач') AS doctor_name,
      a.client_id,
      a.appointment_date::date AS apt_date,
      a.status
    FROM public.appointments a
  ),
  apt_agg AS (
    SELECT
      doctor_id,
      doctor_name,
      count(*) FILTER (
        WHERE apt_date >= v_month_start AND apt_date <= v_month_end
      )::integer AS appointments_month,
      count(*)::integer AS appointments_total,
      count(*) FILTER (
        WHERE apt_date >= v_month_start
          AND apt_date <= v_month_end
          AND status IN ('completed', 'done')
      )::integer AS completed_month,
      count(*) FILTER (
        WHERE apt_date >= v_month_start
          AND apt_date <= v_month_end
          AND status IN ('cancelled', 'canceled')
      )::integer AS cancelled_month,
      count(DISTINCT client_id) FILTER (
        WHERE apt_date >= v_month_start AND apt_date <= v_month_end
      )::integer AS unique_patients_month
    FROM apt_base
    GROUP BY doctor_id, doctor_name
  ),
  rev_agg AS (
    SELECT
      COALESCE(NULLIF(TRIM(a.doctor_id), ''), '') AS doctor_id,
      COALESCE(NULLIF(TRIM(a.doctor_name), ''), 'Врач') AS doctor_name,
      COALESCE(
        sum(p.amount) FILTER (
          WHERE p.completed_at >= v_month_start::timestamptz
            AND p.completed_at < (v_month_end + interval '1 day')::timestamptz
        ),
        0
      ) AS revenue_month,
      COALESCE(sum(p.amount), 0) AS revenue_total
    FROM public.payments p
    JOIN public.bills b ON b.id = p.bill_id
    LEFT JOIN public.appointments a ON a.id = b.appointment_id
    WHERE p.status = 'succeeded'
    GROUP BY 1, 2
  ),
  merged AS (
    SELECT
      COALESCE(a.doctor_id, r.doctor_id, '') AS doctor_id,
      COALESCE(a.doctor_name, r.doctor_name, 'Врач') AS doctor_name,
      COALESCE(a.appointments_month, 0) AS appointments_month,
      COALESCE(a.appointments_total, 0) AS appointments_total,
      COALESCE(a.completed_month, 0) AS completed_month,
      COALESCE(a.cancelled_month, 0) AS cancelled_month,
      COALESCE(a.unique_patients_month, 0) AS unique_patients_month,
      COALESCE(r.revenue_month, 0) AS revenue_month,
      COALESCE(r.revenue_total, 0) AS revenue_total
    FROM apt_agg a
    FULL OUTER JOIN rev_agg r
      ON a.doctor_id IS NOT DISTINCT FROM r.doctor_id
     AND a.doctor_name = r.doctor_name
  )
  SELECT
    CASE
      WHEN m.doctor_id <> '' THEN m.doctor_id
      ELSE 'name:' || md5(lower(m.doctor_name))
    END,
    NULLIF(m.doctor_id, ''),
    m.doctor_name,
    COALESCE(d.specialization, ''),
    m.appointments_month,
    m.appointments_total,
    m.completed_month,
    m.cancelled_month,
    m.unique_patients_month,
    m.revenue_month,
    m.revenue_total,
    CASE
      WHEN m.appointments_month > 0
        THEN round((m.completed_month::numeric / m.appointments_month::numeric) * 100, 1)
      ELSE 0
    END,
    now()
  FROM merged m
  LEFT JOIN public.doctors d
    ON lower(trim(d.name)) = lower(trim(m.doctor_name));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_doctor_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_doctor_metrics() TO authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.doctor_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctor_metrics_select ON public.doctor_metrics;
CREATE POLICY doctor_metrics_select ON public.doctor_metrics FOR SELECT TO authenticated
  USING (public.is_admin_user() OR public.is_staff_user());

NOTIFY pgrst, 'reload schema';
