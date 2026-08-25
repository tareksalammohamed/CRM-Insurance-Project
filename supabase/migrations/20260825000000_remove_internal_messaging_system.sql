-- ============================================================================
-- إزالة نظام الرسائل الداخلي بالكامل
--
-- يحذف بيانات الرسائل والمحادثات وحالات القراءة/الكتابة والاتصال، ثم يزيل
-- الجداول والدوال والـ realtime publication الخاصة بالنظام فقط.
-- لا يلمس users أو customers أو policies أو notifications التشغيلية الأخرى.
-- ============================================================================

BEGIN;

-- إيقاف مهمة الاحتفاظ القديمة إن كانت موجودة.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'unschedule' AND pronamespace = 'cron'::regnamespace) THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'purge-old-messages';
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_function OR undefined_object THEN
    NULL;
END;
$$;

-- إزالة الجداول من Realtime قبل حذفها، مع دعم قواعد لا تحتوي publication أو بعض الجداول.
DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'conversations', 'conversation_members', 'messages', 'message_reads',
      'typing_status', 'online_status', 'team_room_messages', 'team_room_read_state'
    ] LOOP
      IF to_regclass('public.' || table_name) IS NOT NULL THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', table_name);
        EXCEPTION WHEN OTHERS THEN
          -- قد لا تكون كل الجداول مضافة إلى publication؛ حذف الجدول لاحقاً يظل آمناً.
          NULL;
        END;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- حذف الإشعارات وسجل النشاط الناتجين عن نظام الرسائل فقط.
DELETE FROM public.notifications
WHERE type::text IN ('new_message', 'message_mention')
   OR entity_type IN ('conversation', 'message', 'team_room', 'team_room_message');

DELETE FROM public.activity_logs
WHERE action_type::text = 'message_delete_all'
   OR entity_type = 'message';

-- إزالة trigger مزامنة محادثات الفريق الذي أُنشئ خصيصاً لنظام الرسائل.
DROP TRIGGER IF EXISTS sync_hierarchy_groups_on_users_change ON public.users;

-- إزالة كل الدوال العامة الخاصة بنظام الرسائل.
DROP FUNCTION IF EXISTS public.can_message(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.list_messageable_users() CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_direct_conversation(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.send_message(uuid, text, uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.edit_message(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.delete_message_for_self(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.delete_message_for_everyone(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.toggle_pin_message(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.toggle_pin_conversation(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.forward_message(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_conversation_read(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_typing_status(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.set_online_status(boolean) CASCADE;
DROP FUNCTION IF EXISTS public.search_messages(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_unread_messages_count() CASCADE;
DROP FUNCTION IF EXISTS public.sync_hierarchy_group_conversation(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_sync_hierarchy_groups() CASCADE;
DROP FUNCTION IF EXISTS public.purge_old_messages() CASCADE;
DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.toggle_mute_conversation(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.toggle_archive_conversation(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.hide_conversation_for_self(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_conversation_partners_info(uuid[]) CASCADE;

-- دوال غرفة الفريق الجماعية القديمة، إن كانت موجودة في قاعدة الإنتاج.
DROP FUNCTION IF EXISTS public.compute_team_room_visible_to(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.delete_team_room_message(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.edit_team_room_message(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_team_room_participants_info(uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.get_team_room_unread_count() CASCADE;
DROP FUNCTION IF EXISTS public.mark_team_room_read() CASCADE;
DROP FUNCTION IF EXISTS public.send_team_room_message(text, uuid) CASCADE;

-- حذف الجداول التابعة ثم الجداول الأساسية. CASCADE يزيل سياساتها وفهارسها.
DROP TABLE IF EXISTS public.message_reads CASCADE;
DROP TABLE IF EXISTS public.typing_status CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.online_status CASCADE;
DROP TABLE IF EXISTS public.team_room_read_state CASCADE;
DROP TABLE IF EXISTS public.team_room_messages CASCADE;

COMMIT;

-- ملاحظة: قيم enum القديمة new_message/message_mention/message_delete_all لا يمكن
-- إسقاطها مباشرة من PostgreSQL بأمان؛ بعد حذف الجداول والدوال والبيانات لا توجد
-- أي واجهة أو عملية يمكنها استخدامها، وبقاء labels غير المستخدمة لا يحتفظ برسائل.
-- نهاية migration
