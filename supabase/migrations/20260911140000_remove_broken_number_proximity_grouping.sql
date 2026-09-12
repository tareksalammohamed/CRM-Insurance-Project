-- اكتشفنا فى قاعدة البيانات (بدون أي migration مطابق فى المستودع، يعني
-- كانت اتعملت مباشرة على الداتابيز) trigger وثلاث دوال بتحاول تجمّع وثائق
-- "حماية واستثمار" تلقائياً بناءً على قرب أرقامها من بعض (فرق ≤ 10) لنفس
-- الوكيل — بغض النظر عن العميل! ده أدى فعلياً لدمج عملاء مختلفين تمامًا فى
-- نفس المجموعة (لقينا مجموعة واحدة فيها 8 عملاء مختلفين بالكامل، ومجموعتين
-- تانيين فيهم عميلين مختلفين فى كل واحدة) لمجرد إن أرقام وثائقهم متتالية.
--
-- الميكانيزم ده بيتعارض بالكامل مع قاعدة التجميع الصحيحة (نفس العميل + نفس
-- الوكيل فقط — راجع policyGrouping.ts)، وبقى زيادة مالوش لازمة أصلاً لأن
-- شاشتي الوثائق والتحصيل بقوا بيحسبوا التجميع مباشرة من (customer_id +
-- owner_id) وقت العرض، من غير أي اعتماد على policy_group_id.

DROP TRIGGER IF EXISTS trg_rebuild_pi_groups ON public.policies;
DROP FUNCTION IF EXISTS public._trigger_rebuild_pi_groups();
DROP FUNCTION IF EXISTS public.rebuild_protection_investment_implicit_groups(numeric);
DROP FUNCTION IF EXISTS public._validate_and_assign_pi_cluster(uuid[], numeric[]);

-- تنظيف الضرر اللي حصل فعلاً: أي مجموعة (policy_group_id) بتضم أكتر من
-- عميل واحد كانت اتعملت غلط بالميكانيزم القديم ده — نرجّع وثائقها لحالتها
-- الطبيعية (مفردة، من غير ربط وهمي) بدل ما تفضل بيانات فاسدة فى الجدول.
WITH bad_groups AS (
  SELECT policy_group_id
  FROM policies
  WHERE policy_group_id IS NOT NULL
  GROUP BY policy_group_id
  HAVING count(DISTINCT customer_id) > 1
)
UPDATE policies
SET policy_group_id = NULL,
    group_sequence = NULL,
    group_size = NULL,
    group_total_sum_assured = NULL
WHERE policy_group_id IN (SELECT policy_group_id FROM bad_groups);
