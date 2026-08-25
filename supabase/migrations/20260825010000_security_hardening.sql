-- Security hardening
-- لا نغيّر منطق الأعمال؛ نثبت فقط سياق الدوال ذات الصلاحيات الموسعة
-- ونمنع المستخدم العادي من إنشاء إشعارات مزيفة لمستخدمين آخرين.

ALTER FUNCTION public.get_user_subtree(uuid) SET search_path = public;
ALTER FUNCTION public.create_due_notifications() SET search_path = public;

DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_system" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

COMMENT ON POLICY "notifications_insert_system" ON public.notifications IS
  'Notifications are created only by trusted SECURITY DEFINER functions; clients may read and mark their own notifications as read.';

-- سياسة RLS لا تقيّد الأعمدة؛ لذلك نستخدم trigger دفاعياً لمنع تصعيد
-- الصلاحيات عبر UPDATE على صف المستخدم نفسه من عميل المتصفح.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id THEN
    IF NEW.email IS DISTINCT FROM OLD.email
      OR NEW.role IS DISTINCT FROM OLD.role
      OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
      OR NEW.target IS DISTINCT FROM OLD.target
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'لا يمكن للمستخدم تعديل حقول الصلاحيات الخاصة به';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_changes ON public.users;
CREATE TRIGGER trg_prevent_self_privilege_changes
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_privilege_changes();
