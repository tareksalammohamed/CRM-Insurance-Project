-- Security hardening
-- لا نغيّر منطق الأعمال؛ نثبت فقط سياق الدوال ذات الصلاحيات الموسعة
-- ونمنع المستخدم العادي من إنشاء إشعارات مزيفة لمستخدمين آخرين.

ALTER FUNCTION public.get_user_subtree(uuid) SET search_path = public;
ALTER FUNCTION public.create_due_notifications() SET search_path = public;
ALTER FUNCTION public.regenerate_installments() SET search_path = public;
ALTER FUNCTION public.generate_installments(uuid, date, public.payment_method, numeric) SET search_path = public;
ALTER FUNCTION public.set_daily_agent_stats_updated_at() SET search_path = public;
ALTER FUNCTION public.set_performance_activity_targets_updated_at() SET search_path = public;

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

-- لا تسمح للزائر غير المسجل باستدعاء دوال SECURITY DEFINER الحساسة.
-- الاستثناء الوحيد أدناه هو دالة البحث عن البريد برقم الهاتف المطلوبة لتدفق الدخول.
REVOKE EXECUTE ON FUNCTION public.ai_get_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_get_settings() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ai_set_enabled(p_enabled boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_set_enabled(p_enabled boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ai_upsert_provider(p_provider text, p_enabled boolean, p_priority integer, p_api_key text, p_account_id text, p_key_changed boolean, p_account_id_changed boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_upsert_provider(p_provider text, p_enabled boolean, p_priority integer, p_api_key text, p_account_id text, p_key_changed boolean, p_account_id_changed boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.approve_subscription_payment(p_payment_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_subscription_payment(p_payment_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.assign_initial_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_initial_subscription() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_overdue_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_cancel_overdue_policies() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.can_delete_customer(p_customer_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_customer(p_customer_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.can_delete_policy(p_policy_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_policy(p_policy_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cancel_payment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_payment() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cancel_severely_overdue_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_severely_overdue_policies() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.check_in_own_appointment(p_appointment_id uuid, p_latitude double precision, p_longitude double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_own_appointment(p_appointment_id uuid, p_latitude double precision, p_longitude double precision) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.check_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_webauthn_challenges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_webauthn_challenges() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_due_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_due_notifications() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_month_closing_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_month_closing_reminders() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.delete_policy_safe(p_policy_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_policy_safe(p_policy_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.find_ancestor_by_role_branch_aware(p_start_id uuid, p_branch_id uuid, p_target_role public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_ancestor_by_role_branch_aware(p_start_id uuid, p_branch_id uuid, p_target_role public.user_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.generate_installments(p_policy_id uuid, p_start_date date, p_payment_method public.payment_method, p_premium_amount numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_installments(p_policy_id uuid, p_start_date date, p_payment_method public.payment_method, p_premium_amount numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_collection_report(p_start_date date, p_end_date date, p_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_collection_report(p_start_date date, p_end_date date, p_user_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(p_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(p_user_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_manager_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_manager_name() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_manager_name_branch_aware(p_branch_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_manager_name_branch_aware(p_branch_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_subscription_lock_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_subscription_lock_state() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_org_node_production(p_user_ids uuid[], p_month_start date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_node_production(p_user_ids uuid[], p_month_start date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_org_node_production_branch_aware(p_user_ids uuid[], p_month_start date, p_branch_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_node_production_branch_aware(p_user_ids uuid[], p_month_start date, p_branch_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_payable_subordinates(p_payer_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payable_subordinates(p_payer_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_target_progress(p_user_id uuid, p_month date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_target_progress(p_user_id uuid, p_month date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_ancestors(p_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_ancestors(p_user_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_subtree(user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_subtree(user_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_subtree_branch_aware(user_id uuid, branch_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_subtree_branch_aware(user_id uuid, branch_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.import_policy_row(p_customer_name text, p_national_id text, p_phone text, p_address text, p_birth_date date, p_occupation text, p_marital_status text, p_agent_name text, p_policy_number text, p_policy_type text, p_sum_assured numeric, p_premium_amount numeric, p_payment_method text, p_start_date date, p_notes text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_policy_row(p_customer_name text, p_national_id text, p_phone text, p_address text, p_birth_date date, p_occupation text, p_marital_status text, p_agent_name text, p_policy_number text, p_policy_type text, p_sum_assured numeric, p_premium_amount numeric, p_payment_method text, p_start_date date, p_notes text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_month_closed(check_month date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_month_closed(check_month date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_activity(p_action public.action_type, p_entity_type text, p_entity_id uuid, p_old_values jsonb, p_new_values jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(p_action public.action_type, p_entity_type text, p_entity_id uuid, p_old_values jsonb, p_new_values jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_subscription_action(p_action text, p_target_user_id uuid, p_payment_id uuid, p_notes text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_subscription_action(p_action text, p_target_user_id uuid, p_payment_id uuid, p_notes text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.mark_historical_installments_paid(p_policy_id uuid, p_paid_by_user_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_historical_installments_paid(p_policy_id uuid, p_paid_by_user_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.notify_from_activity_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_from_activity_log() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.notify_users(p_user_ids uuid[], p_type public.notification_type, p_title text, p_message text, p_entity_type text, p_entity_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_users(p_user_ids uuid[], p_type public.notification_type, p_title text, p_message text, p_entity_type text, p_entity_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.prevent_self_privilege_escalation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_self_privilege_escalation() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reactivate_policy(p_policy_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_policy(p_policy_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_payment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.regenerate_installments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_installments() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reject_subscription_payment(p_payment_id uuid, p_reason text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(p_payment_id uuid, p_reason text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.suspend_policy(p_policy_id uuid, p_reason text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suspend_policy(p_policy_id uuid, p_reason text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.sync_primary_branch_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_primary_branch_role() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.transfer_user(p_user_id uuid, p_new_manager_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_user(p_user_id uuid, p_new_manager_id uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_overdue_installments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_overdue_installments() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.validate_user_branch_role_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_user_branch_role_manager() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(p_phone text) TO anon;
