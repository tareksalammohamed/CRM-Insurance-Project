-- إصلاحين مترابطين فى الاستيراد:
--
-- 1) مبلغ التأمين الأقصى لوثيقة "حماية واستثمار" الواحدة (50,000) قاعدة
--    أساسية فى نوع الوثيقة نفسه، مش قيد خاص بشاشة الإصدار اليدوي بس — فأي
--    صف مستورد بمبلغ أكبر من كده لازم يترفض، والعميل يدخل كل وثيقة فرعية
--    حقيقية كصف مستقل بنفسه (بدل ما البرنامج يخترع تقسيم أو أرقام تلقائية).
--
-- 2) عشان الصفوف المنفصلة دي تتظبط لنفس العميل فعلاً (مش تترفض بسبب تكرار
--    الرقم القومي)، الدالة بقت تدوّر على عميل موجود بنفس الرقم القومي
--    وتستخدمه بدل ما تحاول تنشئ عميل جديد وترفض الصف. التجميع فى كارت واحد
--    فى شاشتي الوثائق والتحصيل بيحصل تلقائياً بعد كده لأي وثائق "حماية
--    واستثمار" لنفس (العميل + الوكيل) — راجع policyGrouping.ts.
--
--    الاستيراد بيشتغل بـ 5 نداءات متوازية (IMPORT_CONCURRENCY فى
--    dataImportService.ts)، يعني ممكن صفين لنفس العميل الجديد (مالوش سجل
--    لسه) يوصلوا فى نفس اللحظة بالظبط — استخدام SELECT للتحقق ثم INSERT
--    منفصل كان هيسيب فجوة سباق (Race Condition) بين الاتنين. الحل: INSERT
--    واحد بـ ON CONFLICT (national_id) DO NOTHING ذرّي بالكامل، ولو اترفض
--    (لأن صف تاني سبقه بالفعل) نجيب العميل الموجود بدل ما نفشل.

CREATE OR REPLACE FUNCTION public.import_policy_row(
    p_customer_name text,
    p_national_id text,
    p_phone text,
    p_address text,
    p_birth_date date,
    p_occupation text,
    p_marital_status text,
    p_agent_name text,
    p_policy_number text,
    p_policy_type text,
    p_sum_assured numeric,
    p_premium_amount numeric,
    p_payment_method text,
    p_start_date date,
    p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_id     uuid := auth.uid();
    v_caller_role   user_role;
    v_agent_id      uuid;
    v_customer_id   uuid;
    v_policy_id     uuid;
    v_national_id   text;
    v_max CONSTANT numeric := 50000;
    v_reused_customer boolean := false;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول';
    END IF;

    SELECT role INTO v_caller_role FROM users WHERE id = v_caller_id;
    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: مستخدم غير معروف';
    END IF;

    IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
        RAISE EXCEPTION 'اسم العميل مطلوب';
    END IF;
    IF p_agent_name IS NULL OR btrim(p_agent_name) = '' THEN
        RAISE EXCEPTION 'اسم الوكيل مطلوب';
    END IF;
    IF p_policy_number IS NULL OR btrim(p_policy_number) = '' THEN
        RAISE EXCEPTION 'رقم الوثيقة مطلوب';
    END IF;
    IF p_policy_type IS NULL OR btrim(p_policy_type) = '' THEN
        RAISE EXCEPTION 'نوع الوثيقة مطلوب';
    END IF;
    IF p_sum_assured IS NULL THEN
        RAISE EXCEPTION 'مبلغ التأمين مطلوب';
    END IF;
    IF p_policy_type = 'protection_investment' AND p_sum_assured > v_max THEN
        RAISE EXCEPTION 'مبلغ التأمين لوثيقة "حماية واستثمار" لا يتجاوز 50,000 جنيه — سجّل كل وثيقة فرعية حقيقية كصف مستقل بنفس الرقم القومي، وهيتم تجميعها تلقائياً';
    END IF;
    IF p_premium_amount IS NULL THEN
        RAISE EXCEPTION 'قيمة القسط مطلوبة';
    END IF;
    IF p_payment_method IS NULL OR btrim(p_payment_method) = '' THEN
        RAISE EXCEPTION 'طريقة السداد مطلوبة';
    END IF;
    IF p_start_date IS NULL THEN
        RAISE EXCEPTION 'تاريخ بداية التأمين مطلوب';
    END IF;

    SELECT id INTO v_agent_id
    FROM users
    WHERE btrim(lower(name)) = btrim(lower(p_agent_name))
      AND is_active = true
      AND role IN ('agent', 'premium_agent')
      AND id = ANY(get_user_subtree(v_caller_id))
    LIMIT 1;

    IF v_agent_id IS NULL THEN
        RAISE EXCEPTION 'اسم الوكيل غير موجود: %', p_agent_name;
    END IF;

    v_national_id := NULLIF(btrim(coalesce(p_national_id, '')), '');

    IF v_national_id IS NOT NULL THEN
        -- إدراج ذرّي بـ ON CONFLICT بدل SELECT-ثم-INSERT منفصلين، عشان يفضل
        -- صحيح حتى لو صفين لنفس العميل الجديد اتنفذوا فى نفس اللحظة بالظبط
        -- (الاستيراد بيشتغل بعدة نداءات متوازية)
        BEGIN
            INSERT INTO customers (
                name, national_id, phone, address, birth_date, occupation, marital_status, owner_id, is_imported
            ) VALUES (
                btrim(p_customer_name),
                v_national_id,
                NULLIF(btrim(coalesce(p_phone, '')), ''),
                NULLIF(btrim(coalesce(p_address, '')), ''),
                p_birth_date,
                NULLIF(btrim(coalesce(p_occupation, '')), ''),
                NULLIF(btrim(coalesce(p_marital_status, '')), '')::marital_status,
                v_agent_id,
                true
            )
            ON CONFLICT (national_id) DO NOTHING
            RETURNING id INTO v_customer_id;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'قيمة الحالة الاجتماعية غير صحيحة: %', p_marital_status;
        END;

        IF v_customer_id IS NULL THEN
            -- الإدراج اترفض لأن الرقم القومي مسجّل بالفعل (صف سابق فى نفس
            -- الاستيراد، أو عميل قديم من قبل) — نستخدم نفس العميل بشرط إنه
            -- تابع لنفس الوكيل، وإلا الصف يترفض بوضوح
            SELECT id INTO v_customer_id
            FROM customers
            WHERE national_id = v_national_id AND owner_id = v_agent_id
            LIMIT 1;

            IF v_customer_id IS NULL THEN
                RAISE EXCEPTION 'الرقم القومي مستخدم من قبل لعميل آخر';
            END IF;

            v_reused_customer := true;
        END IF;
    ELSE
        -- مفيش رقم قومي فى الصف ده، فمنقدرش نتأكد إنه نفس عميل صف تاني
        -- بأمان — بننشئ عميل جديد دايماً زي السلوك القديم
        BEGIN
            INSERT INTO customers (
                name, national_id, phone, address, birth_date, occupation, marital_status, owner_id, is_imported
            ) VALUES (
                btrim(p_customer_name),
                NULL,
                NULLIF(btrim(coalesce(p_phone, '')), ''),
                NULLIF(btrim(coalesce(p_address, '')), ''),
                p_birth_date,
                NULLIF(btrim(coalesce(p_occupation, '')), ''),
                NULLIF(btrim(coalesce(p_marital_status, '')), '')::marital_status,
                v_agent_id,
                true
            )
            RETURNING id INTO v_customer_id;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'قيمة الحالة الاجتماعية غير صحيحة: %', p_marital_status;
        END;
    END IF;

    BEGIN
        INSERT INTO policies (
            policy_number, customer_id, owner_id, policy_type, start_date,
            payment_method, premium_amount, sum_assured, status, notes, nature
        ) VALUES (
            btrim(p_policy_number),
            v_customer_id,
            v_agent_id,
            p_policy_type::policy_type,
            p_start_date,
            p_payment_method::payment_method,
            p_premium_amount,
            p_sum_assured,
            'active',
            NULLIF(btrim(coalesce(p_notes, '')), ''),
            'existing'
        )
        RETURNING id INTO v_policy_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'رقم الوثيقة مستخدم من قبل';
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'نوع الوثيقة أو طريقة السداد غير صحيحة';
    END;

    PERFORM generate_installments(v_policy_id, p_start_date, p_payment_method::payment_method, p_premium_amount);

    PERFORM mark_historical_installments_paid(v_policy_id);

    IF NOT v_reused_customer THEN
        PERFORM log_activity('customer_create', 'customer', v_customer_id);
    END IF;
    PERFORM log_activity('policy_create', 'policy', v_policy_id);

    RETURN jsonb_build_object(
        'customer_id', v_customer_id,
        'policy_id', v_policy_id,
        'agent_id', v_agent_id,
        'reused_customer', v_reused_customer
    );
END;
$function$;
