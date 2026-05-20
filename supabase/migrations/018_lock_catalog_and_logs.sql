-- 1. Создаем функции для проверки ролей
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin';
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'role') IN ('admin', 'doctor');
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Удаляем старые дырявые политики
DROP POLICY IF EXISTS "doctors_anon_rw" ON public.doctors;
DROP POLICY IF EXISTS "services_anon_rw" ON public.services;
DROP POLICY IF EXISTS "app_logs_anon_rw" ON public.app_logs;

-- 3. Настраиваем безопасный доступ к услугам
CREATE POLICY services_select_authenticated
  ON public.services FOR SELECT TO authenticated
  USING (is_visible = true OR public.is_staff_user());

CREATE POLICY services_write_admin
  ON public.services FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- 4. Настраиваем безопасный доступ к логам
CREATE POLICY app_logs_insert_authenticated
  ON public.app_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY app_logs_select_admin
  ON public.app_logs FOR SELECT TO authenticated
  USING (public.is_admin_user());