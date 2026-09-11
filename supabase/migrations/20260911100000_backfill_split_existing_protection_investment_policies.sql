-- ============================================================================
-- تقسيم الوثائق الحالية (المُصدرة قبل ميزة التقسيم التلقائي) اللي مبلغ
-- تأمينها يتجاوز 50,000 جنيه، بنفس قاعدة التقسيم الجديدة بالظبط:
--   - القسط الصافي بينقسم تناسبياً حسب نسبة كل وثيقة فرعية من إجمالي
--     مبلغ التأمين (مش بالتساوي عشوائياً) — مطابق لمثال المستخدم
--     (100,000 -> وثيقتين، والقسط ينقسم على اثنين. 350,000 -> 7 وثائق
--     والقسط على السبعة).
--   - الأقساط التاريخية (الشهور المسددة فعلاً على الوثيقة الأصلية) ما
--     بتتلمسش خالص — بتفضل زي ما هي بالظبط على الوثيقة الأصلية.
--   - الأقساط اللي لسه معلّقة (pending/overdue) بس هي اللي بتتنقل للوثائق
--     الفرعية الجديدة بنفس رقم القسط وتاريخ الاستحقاق، لكن بالقيمة
--     المقسّمة — وبعدين بتتمسح من الوثيقة الأصلية عشان ميظهروش مكرّرين
--     فى التحصيل.
--   - الوثيقة الأصلية بترجع "ملغاة" (مش متعدّلة الأرقام) مع ملاحظة توضّح
--     إنها اتقسمت، عشان متفضلش ظاهرة كوثيقة نشطة منفصلة جنب الكارت الجديد.
--
-- ملحوظة: طُبّقت هذه العملية بالفعل يدوياً على قاعدة البيانات الحية بتاريخ
-- 2026-09-11 (3 وثائق تأثرت). هذا الملف موجود فقط لتوثيق العملية فى تاريخ
-- الـ migrations؛ لو اتشغّل تانى مش هيأثر على أي حاجة لأن الشرط
-- (policy_group_id IS NULL) بيستبعد الوثائق اللي اتقسمت خلاص.
-- ============================================================================

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS split_from_policy_id uuid REFERENCES policies(id),
  ADD COLUMN IF NOT EXISTS split_into_group_id uuid;

COMMENT ON COLUMN policies.split_from_policy_id IS 'للوثائق الفرعية الناتجة عن تقسيم رجعي (backfill) لوثيقة قديمة كانت مسجّلة كوثيقة واحدة بمبلغ تأمين > 50,000 — يشير للوثيقة الأصلية';
COMMENT ON COLUMN policies.split_into_group_id IS 'للوثيقة الأصلية بعد تقسيمها رجعياً (backfill) وإلغائها — يشير لـ policy_group_id الخاص بالوثائق الفرعية الجديدة';

DO $migration$
DECLARE
  v_old record;
  v_max CONSTANT numeric := 50000;
  v_full_count int;
  v_remainder numeric;
  v_count int;
  v_chunks numeric[];
  v_premiums numeric[];
  v_running_premium numeric;
  v_group_id uuid;
  v_new_policy_id uuid;
  v_new_numbers text[];
  v_pending record;
  i int;
BEGIN
  FOR v_old IN
    SELECT * FROM policies
    WHERE policy_type = 'protection_investment'
      AND sum_assured IS NOT NULL
      AND sum_assured > 50000
      AND policy_group_id IS NULL
      AND status = 'active'
    ORDER BY created_at
  LOOP
    v_full_count := floor(v_old.sum_assured / v_max)::int;
    v_remainder  := round(v_old.sum_assured - (v_full_count * v_max), 2);
    v_count      := v_full_count + (CASE WHEN v_remainder > 0 THEN 1 ELSE 0 END);

    v_chunks := ARRAY[]::numeric[];
    FOR i IN 1..v_full_count LOOP
      v_chunks := array_append(v_chunks, v_max);
    END LOOP;
    IF v_remainder > 0 THEN
      v_chunks := array_append(v_chunks, v_remainder);
    END IF;

    -- قسمة القسط الصافي تناسبياً حسب نسبة كل وثيقة من إجمالي مبلغ التأمين،
    -- مع إعطاء فرق التقريب للوثيقة الأخيرة عشان الإجمالي يفضل مطابق
    -- تماماً لقسط الوثيقة الأصلية (زي ما هو، من غير أي زيادة أو نقصان)
    v_premiums := ARRAY[]::numeric[];
    v_running_premium := 0;
    FOR i IN 1..v_count LOOP
      IF i < v_count THEN
        v_premiums := array_append(v_premiums, round(v_old.premium_amount * v_chunks[i] / v_old.sum_assured, 2));
        v_running_premium := v_running_premium + v_premiums[i];
      ELSE
        v_premiums := array_append(v_premiums, round(v_old.premium_amount - v_running_premium, 2));
      END IF;
    END LOOP;

    v_group_id := gen_random_uuid();
    v_new_numbers := ARRAY[]::text[];

    FOR i IN 1..v_count LOOP
      INSERT INTO policies (
        policy_number, customer_id, owner_id, policy_type, start_date, payment_method,
        premium_amount, status, notes, nature, sum_assured, branch_id,
        policy_group_id, group_sequence, group_size, group_total_sum_assured,
        split_from_policy_id
      ) VALUES (
        v_old.policy_number || '-' || i, v_old.customer_id, v_old.owner_id, v_old.policy_type, v_old.start_date, v_old.payment_method,
        v_premiums[i], 'active',
        trim(both ' ' from coalesce(v_old.notes, '') || ' — جزء ' || i || ' من ' || v_count || ' من تقسيم تلقائي رجعي للوثيقة رقم ' || v_old.policy_number),
        v_old.nature, v_chunks[i], v_old.branch_id,
        v_group_id, i, v_count, v_old.sum_assured,
        v_old.id
      )
      RETURNING id INTO v_new_policy_id;

      v_new_numbers := array_append(v_new_numbers, v_old.policy_number || '-' || i);

      -- ننقل بس الأقساط اللي لسه معلّقة (مش مسددة) من الوثيقة الأصلية —
      -- بنفس رقم القسط وتاريخ الاستحقاق، وبقيمة القسط المقسّمة الجديدة
      FOR v_pending IN
        SELECT installment_number, due_date FROM installments
        WHERE policy_id = v_old.id AND status IN ('pending', 'overdue')
        ORDER BY installment_number
      LOOP
        INSERT INTO installments (policy_id, installment_number, amount, due_date, is_first, status)
        VALUES (v_new_policy_id, v_pending.installment_number, v_premiums[i], v_pending.due_date, false, 'pending');
      END LOOP;
    END LOOP;

    -- نشيل الأقساط المعلّقة من الوثيقة الأصلية بعد ما اتنقلت للوثائق
    -- الفرعية — الأقساط المسددة فعلاً (تاريخية) تفضل زي ما هي من غير
    -- أي تغيير على الإطلاق
    DELETE FROM installments
    WHERE policy_id = v_old.id AND status IN ('pending', 'overdue');

    -- الوثيقة الأصلية بقت ملغاة لأنها اتقسمت لوثائق فرعية — كده مش هتفضل
    -- ظاهرة كوثيقة نشطة منفصلة جنب كارت المجموعة الجديد فى قائمة الوثائق
    UPDATE policies
    SET status = 'cancelled',
        cancelled_at = now(),
        split_into_group_id = v_group_id,
        notes = trim(both ' ' from coalesce(notes, '') || ' — تم تقسيمها تلقائياً (رجعياً) بتاريخ ' || to_char(now(), 'YYYY-MM-DD') || ' إلى ' || v_count || ' وثائق: ' || array_to_string(v_new_numbers, '، '))
    WHERE id = v_old.id;

    RAISE NOTICE 'Split policy % (%) into % sub-policies, group_id=%', v_old.policy_number, v_old.id, v_count, v_group_id;
  END LOOP;
END;
$migration$;
