import { supabase, type User, type UserRole } from '../../../lib/supabase';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import type { QuickFilter, SubType, InstallmentWithRelations, OwnerFilter } from '../types';
import { groupInstallmentsForDisplay } from '../business/collectionGrouping';
import {
  fetchInstallmentsByPolicyId, payInstallment, cancelInstallmentPayment,
} from '../../../features/installments/installmentsService';
import { dalRead } from '../../../lib/dataAccessLayer';
import { fetchUserSubtreeIdsBranchAware } from '../../../lib/branchHierarchy';
import { classifyYear2Status } from '../year2/year2CollectionService';

const PAGE_SIZE = 10;

export interface FetchInstallmentsParams {
  quickFilter: QuickFilter;
  subType: SubType;
  ownerFilter: OwnerFilter;
  page: number;
  searchQuery: string;
  // الفرع الحالي المختار (BranchProvider العام) — فاضي/null يعني بدون فلترة
  // إضافية (السلوك القديم، معتمد على RLS بس)
  branchId?: string | null;
  // شهر لوحة التحكم المطلوب عرضه في drill-down؛ غياب القيمة يعني الشهر الحالي.
  monthStart?: string | null;
}

// ===================================
// فريق المستخدم الحالي — لملء فلتر "الفريق" بأسماء حقيقية
// ===================================
// نفس الدالة المستخدمة أصلاً فى صفحة العملاء (fetchAgentsForCurrentUser):
// بترجع المستخدم نفسه + كل من هو تحته فى الهيكل الإداري فقط، فى نطاق الفرع
// الحالي المختار لو موجود (get_user_subtree_branch_aware)، عشان كل درجة
// وظيفية تفلتر بأسماء فريقها الفعلي فقط (رئيس مجموعة يشوف وكلاءه، مراقب
// يشوف رؤساء مجموعاته، مدير تطوير يشوف كل من تحته... إلخ) بدل قائمة ثابتة
// من الأدوار تشمل كل مستخدمي النظام بغض النظر عن الهيكل.
export async function fetchTeamForCurrentUser(user: User, branchId: string | null = null): Promise<{ id: string; name: string; role: UserRole; is_active: boolean }[]> {
  if (user.role === 'agent' || user.role === 'premium_agent') {
    return [];
  }

  const result = await dalRead(
    `collection:team:${user.id}:${branchId ?? 'none'}`,
    async () => {
      const allIds = await fetchUserSubtreeIdsBranchAware('collection', user.id, branchId);

      // ملحوظة: من غير فلترة is_active — لازم يظهروا فى فلتر "الفريق" حتى لو
      // غير نشطين، عشان يقدر رئيس المجموعة/المراقب يشوف تحصيلاتهم القديمة
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, is_active')
        .in('id', allIds)
        .order('name');

      if (error) throw error;

      return [...(data || [])].sort((a, b) => {
        if (a.id === user.id) return -1;
        if (b.id === user.id) return 1;
        // النشطين أولاً، ثم الغير نشطين فى الآخر
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.name.localeCompare(b.name, 'ar');
      });
    },
    { emptyValue: [] as { id: string; name: string; role: UserRole; is_active: boolean }[] },
  );
  return result.data;
}

export interface FetchInstallmentsResult {
  installments: InstallmentWithRelations[];
  totalCount: number;
  totalPages: number;
}

// ===================================
// تحميل الأقساط — مُصحَّح
// ===================================
// تُستدعى مرة عند فتح صفحة التحصيل: تُلغي أي وثيقة (نشطة/موقوفة) عندها قسط
// غير مسدد فات على استحقاقه 3 شهور كاملة أو أكثر — قبل حساب فلتر "المتأخر"،
// عشان الوثائق دي تخرج من "المتأخر" أول ما توصل للحد ده مباشرة.
export async function cancelSeverelyOverduePolicies(): Promise<void> {
  const { error } = await supabase.rpc('cancel_severely_overdue_policies');
  if (error) throw error;
}

// البحث عن معرّفات الوثائق (policy_id) التي تطابق نص البحث في: رقم الوثيقة،
// اسم العميل، رقم الهاتف، الرقم القومي، أو اسم الوكيل (المسؤول عن الوثيقة).
// هذا امتداد لواجهة البحث فقط — لا يغيّر أي منطق حساب أو فلترة للتحصيل.
async function resolveSearchPolicyIds(searchQuery: string): Promise<string[] | null> {
  const q = searchQuery.trim();
  if (!q) return null;

  const [byNumber, byCustomer, byAgent] = await Promise.all([
    supabase.from('policies').select('id').ilike('policy_number', `%${q}%`),
    supabase.from('customers').select('id').or(`name.ilike.%${q}%,phone.ilike.%${q}%,national_id.ilike.%${q}%`),
    supabase.from('users').select('id').ilike('name', `%${q}%`),
  ]);

  const ids = new Set<string>();
  (byNumber.data || []).forEach((p) => ids.add(p.id));

  const customerIds = (byCustomer.data || []).map((c) => c.id);
  const agentIds = (byAgent.data || []).map((a) => a.id);

  const extraLookups: Promise<void>[] = [];
  if (customerIds.length) {
    extraLookups.push(
      Promise.resolve(
        supabase.from('policies').select('id').in('customer_id', customerIds)
      ).then(({ data }) => {
        (data || []).forEach((p) => ids.add(p.id));
      })
    );
  }
  if (agentIds.length) {
    extraLookups.push(
      Promise.resolve(
        supabase.from('policies').select('id').in('owner_id', agentIds)
      ).then(({ data }) => {
        (data || []).forEach((p) => ids.add(p.id));
      })
    );
  }
  await Promise.all(extraLookups);

  return Array.from(ids);
}

// البحث عن معرّفات الوثائق (policy_id) التي وكيلها (owner) هو الشخص المختار
// فى فلتر "الفريق" نفسه أو أي شخص تحته فى الهيكل الإداري (get_user_subtree_branch_aware
// الخاصة بالشخص المختار، مش المستخدم الحالي، وفى نطاق نفس الفرع المختار لو
// موجود). بالطريقة دي اختيار رئيس مجموعة واحد بيجيب معاه تلقائياً مستحقات
// كل وكلائه، واختيار مراقب بيجيب معاه كل رؤساء المجموعات والوكلاء تحته...
// إلخ. يُستخدم فقط عند اختيار شخص محدد بخلاف "الكل" — لا يغيّر أي فلتر أو
// منطق حساب آخر.
async function resolveOwnerFilterPolicyIds(ownerFilter: OwnerFilter, branchId: string | null = null): Promise<string[]> {
  if (ownerFilter === 'all') return [];

  const ownerIds = await fetchUserSubtreeIdsBranchAware('collection', ownerFilter, branchId);

  let query = supabase.from('policies').select('id').in('owner_id', ownerIds);
  if (branchId) query = query.eq('branch_id', branchId);
  const { data: policyRows, error: policyErr } = await query;
  if (policyErr) throw policyErr;

  return (policyRows || []).map((p) => p.id);
}

const EMPTY_INSTALLMENTS_RESULT: FetchInstallmentsResult = { installments: [], totalCount: 0, totalPages: 1 };

export async function fetchInstallments({ quickFilter, subType, ownerFilter, page, searchQuery, branchId = null, monthStart = null }: FetchInstallmentsParams): Promise<FetchInstallmentsResult> {
  const cacheKey = `collection:installments:${quickFilter}:${subType}:${ownerFilter}:${page}:${searchQuery.trim()}:${branchId ?? 'none'}:${monthStart ?? 'current'}`;

  const result = await dalRead(
    cacheKey,
    async () => {
      return         fetchInstallmentsOnline({ quickFilter, subType, ownerFilter, page, searchQuery, branchId, monthStart });
    },
    { emptyValue: EMPTY_INSTALLMENTS_RESULT },
  );
  return result.data;
}

async function fetchInstallmentsOnline({ quickFilter, subType, ownerFilter, page, searchQuery, branchId = null, monthStart: monthStartParam = null }: FetchInstallmentsParams): Promise<FetchInstallmentsResult> {
  const requestedMonth = monthStartParam ? parseISO(monthStartParam) : new Date();
  const now        = isValid(requestedMonth) ? requestedMonth : new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr   = format(monthEnd,   'yyyy-MM-dd');

  // حدود فلتر "المتأخر": من شهر فات لحد شهرين فاتوا على تاريخ الاستحقاق
  // (شهر فات = يبدأ يظهر، شهرين = أقصى مدة، بعد كده تتلغي الوثيقة ولا يظهر
  // القسط هنا أصلاً - راجع cancelSeverelyOverduePolicies أعلاه)
  const overdueRangeStartStr = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'); // بداية شهر -2 (أقصى مدة قبل الإلغاء)
  const overdueRangeEndExclusiveStr = format(startOfMonth(now), 'yyyy-MM-dd'); // بداية الشهر الحالي (أي قسط قبله يُعتبر "فاته شهر" على الأقل)

  const needsPaymentsJoin = quickFilter === 'paid';

  // !inner على policy_id ضروري عشان نقدر نفلتر لاحقاً على policy.status أو
  // policy.branch_id (مسموح دايماً هنا لأن installments.policy_id مفتاح
  // أجنبي إلزامي، فكل قسط له وثيقة مؤكد — استخدام !inner دايماً بغض النظر
  // عن needsPaymentsJoin لا يُسقط أي صف كان ظاهر قبل كده)
  //
  // نفس نصوص الـselect بالحرف زي ما كانت، بس مكتوبة كـ literals ثابتة لكل
  // فرع على حدة بدل تمرير اتحاد نصوص لـ .select(): محلّل أنواع PostgREST
  // بيحلّل النص وقت الترجمة، والاتحاد بيمنعه من استنتاج شكل الصف (وهو سبب
  // الحاجة السابقة لتأكيد نوع غير آمن على النتيجة).
  const installmentsTable = supabase.from('installments');

  let query = needsPaymentsJoin
    ? installmentsTable.select(
        `*,
           policy:policy_id!inner(
             *,
             customer:customer_id(name, phone, national_id),
             owner:owner_id(name)
           ),
           payments!inner(payment_month, is_cancelled)`,
        { count: 'exact' },
      )
    : installmentsTable.select(
        `*,
           policy:policy_id!inner(
             *,
             customer:customer_id(name, phone, national_id),
             owner:owner_id(name)
           )`,
        { count: 'exact' },
      );

  // الوثيقة الملغاة لا تُعرض في أي من قوائم التحصيل، حتى لو بقيت أقساط
  // قديمة مرتبطة بها في قاعدة البيانات.
  query = query.neq('policy.status', 'cancelled');

  // فلتر الفرع الحالي (BranchProvider العام) — فاضي/null يعني بدون فلترة
  // إضافية (السلوك القديم، معتمد على RLS بس)
  if (branchId) {
    query = query.eq('policy.branch_id', branchId);
  }

  // ===== فلتر سريع (quickFilter) =====
  // نفس معايير الحساب الأصلية بالضبط (نفس المتغيرات الزمنية والحالات)، وكل
  // ما تغيّر هو تجميع تبويبي "الإنتاج الجديد" و"التحصيل الدوري" السابقين تحت
  // فلتر واحد ("الشهر" / "تم السداد")، مع إمكانية تضييقهما اختيارياً عبر
  // subType لو احتاج المستخدم يفرّق بينهما.
  switch (quickFilter) {
    case 'month':
      // كل قسط "مستحق" خلال الشهر الحالي (لسه معلّق) — إنتاج جديد + تحصيل دوري معاً
      query = query
        .eq('status', 'pending')
        .gte('due_date', monthStartStr)
        .lte('due_date', monthEndStr);
      break;
    case 'overdue':
      // بيُحسب مباشرة من تاريخ الاستحقاق (مش من عمود status المخزّن، لأنه
      // محتاج جدولة دورية مش متوفرة حالياً) — يعرض بس اللي فاته شهر لحد
      // شهرين، ويستبعد أي وثيقة اتلغت فعلاً (احتياطاً، رغم إننا بنلغيها قبل
      // النداء ده مباشرة في نفس تحميل الصفحة)
      // status ممكن يكون 'pending' (لسه ما اتحدّثش) أو 'overdue' (بعد ما فنكشن
      // update_overdue_installments في القاعدة تحدّثه تلقائياً) — لازم الفلتر
      // يقبل الاتنين مع بعض، وإلا الأقساط اللي القاعدة حدّثت status بتاعها
      // بتختفي من هنا رغم إنها لسه متأخرة وغير مسدد
      query = query
        .in('status', ['pending', 'overdue'])
        .gte('due_date', overdueRangeStartStr)
        .lt('due_date', overdueRangeEndExclusiveStr)
        .neq('policy.status', 'cancelled');
      break;
    case 'paid':
      // مسدد فعلاً في الشهر الحالي تحديداً (حسب تاريخ السداد الفعلي payment_month
      // مش تاريخ الاستحقاق) — مش كل سداد تاريخي من أول ما الوثيقة اتعملت
      query = query
        .eq('status', 'paid')
        .eq('payments.payment_month', monthStartStr)
        .eq('payments.is_cancelled', false);
      break;
  }

  // فلتر فرعي اختياري: تحديد إنتاج جديد فقط أو تحصيل دوري فقط (نفس عمود
  // is_first المستخدم أصلاً في النظام، بدون أي تغيير في تفسيره)
  if (subType === 'new') {
    query = query.eq('is_first', true);
  } else if (subType === 'periodic') {
    query = query.eq('is_first', false);
  }

  // البحث الفوري — يغطي رقم الوثيقة، اسم العميل، رقم الهاتف، الرقم القومي،
  // واسم الوكيل. يتم حل معرّفات الوثائق المطابقة أولاً (Supabase لا يدعم
  // البحث المباشر عبر علاقات متداخلة بـ or())
  // البحث وفلتر "الفريق" مستقلان تمامًا عن بعضهما — تنفيذهما بالتوازي بدل
  // التسلسل يقلّل زمن الاستجابة دون أي تغيير فى النتيجة النهائية
  const [searchIds, ownerFilterIds] = await Promise.all([
    resolveSearchPolicyIds(searchQuery),
    ownerFilter !== 'all' ? resolveOwnerFilterPolicyIds(ownerFilter, branchId) : Promise.resolve(null),
  ]);

  let combinedIds: string[] | null = null;
  if (searchIds !== null && ownerFilterIds !== null) {
    const ownerFilterSet = new Set(ownerFilterIds);
    combinedIds = searchIds.filter((id) => ownerFilterSet.has(id));
  } else if (searchIds !== null) {
    combinedIds = searchIds;
  } else if (ownerFilterIds !== null) {
    combinedIds = ownerFilterIds;
  }

  if (combinedIds !== null) {
    if (combinedIds.length === 0) {
      return { installments: [], totalCount: 0, totalPages: 1 };
    }
    query = query.in('policy_id', combinedIds);
  }

  const { data, error } = await query
    .order('due_date', { ascending: true })
    .limit(10000);

  if (error) throw error;

  const allInstallments = (data as InstallmentWithRelations[]) || [];
  const entries = groupInstallmentsForDisplay(allInstallments);
  const from = (page - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(from, from + PAGE_SIZE);
  const pageInstallments = pageEntries.flatMap((entry) =>
    entry.kind === 'group' ? entry.members : [entry.installment]
  );

  // عدد الأقساط المسددة لكل وثيقة — يُحسب فقط لوثائق الصفحة الحالية (بعد
  // التقسيم لصفحات أعلاه)، مش كل الوثائق فى النظام، عشان يفضل الاستعلام خفيف
  const pagePolicyIds = [...new Set(pageInstallments.map((i) => i.policy_id))];
  const paidCountByPolicy = new Map<string, number>();
  if (pagePolicyIds.length > 0) {
    const { data: paidRows, error: paidCountError } = await supabase
      .from('installments')
      .select('policy_id')
      .eq('status', 'paid')
      .in('policy_id', pagePolicyIds);
    if (paidCountError) throw paidCountError;
    for (const row of (paidRows as { policy_id: string }[]) || []) {
      paidCountByPolicy.set(row.policy_id, (paidCountByPolicy.get(row.policy_id) || 0) + 1);
    }
  }
  const enrichedInstallments = pageInstallments.map((inst) => ({
    ...inst,
    paid_installments_count: paidCountByPolicy.get(inst.policy_id) || 0,
  }));

  return {
    installments: enrichedInstallments,
    totalCount: entries.length,
    totalPages: Math.max(1, Math.ceil(entries.length / PAGE_SIZE)),
  };
}

// ===================================
// بطاقات الإحصائيات السريعة أعلى الصفحة — قراءة فقط، لا تدخل في أي حساب
// تارجت أو محقق، وتخص السنة الأولى فقط (نفس فصل السنة الثانية القائم أصلاً)
// ===================================
export interface CollectionQuickStats {
  // "المستحق" — إجمالي الأقساط المستحقة (status='pending') خلال الشهر الحالي
  // بالكامل، بنفس منطق فلتر "الشهر" السريع أعلاه تماماً (بدون subType)،
  // وليس مستحقات اليوم فقط كما كانت سابقاً.
  dueMonthAmount: number;
  dueMonthCount: number;
  // "إجمالي المستحق" — كل الأقساط التي تاريخ استحقاقها خلال الشهر الحالي
  // بغض النظر عن حالتها (سواء لسه معلّقة/متأخرة أو تم سدادها بالفعل)، أي
  // dueMonthAmount نفسه + ما تم سداده فعلاً من أقساط هذا الشهر. تُستخدم
  // لعرض "المستحق X من إجمالي Y" أسفل بطاقة "المستحق".
  totalDueMonthAmount: number;
  collectedTodayAmount: number;
  collectedTodayCount: number;
  // "إجمالي المسدد خلال الشهر الحالي" — قيمة الأقساط التي تم سدادها فعلياً
  // خلال الشهر الحالي (حسب payment_month)، بنفس منطق فلتر "تم السداد" تماماً.
  collectedMonthAmount: number;
  // مؤشرات تذكيرية لتحصيلات السنة الثانية وما بعدها — مستقلة عن السنة الأولى.
  year2EligiblePoliciesCount: number;
  // نفس تصنيف شاشة السنة الثانية نفسها: مستحق + متأخر = يحتاج تحصيل.
  // مؤشرات عرض/تذكير فقط ولا تدخل في أي تارجت أو محقق.
  year2DuePoliciesCount: number;
  year2OverduePoliciesCount: number;
  year2AttentionPoliciesCount: number;
  year2CollectedMonthAmount: number;
  year2CollectedMonthCount: number;
  year2TotalCollectedAmount: number;
}

const EMPTY_COLLECTION_QUICK_STATS: CollectionQuickStats = {
  dueMonthAmount: 0,
  dueMonthCount: 0,
  totalDueMonthAmount: 0,
  collectedTodayAmount: 0,
  collectedTodayCount: 0,
  collectedMonthAmount: 0,
  year2EligiblePoliciesCount: 0,
  year2DuePoliciesCount: 0,
  year2OverduePoliciesCount: 0,
  year2AttentionPoliciesCount: 0,
  year2CollectedMonthAmount: 0,
  year2CollectedMonthCount: 0,
  year2TotalCollectedAmount: 0,
};

export async function fetchCollectionQuickStats(branchId: string | null = null): Promise<CollectionQuickStats> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
  const dayStartIso = startOfDay(now).toISOString();
  const dayEndIso   = endOfDay(now).toISOString();

  const result = await dalRead(
    `collection:quickStats:${monthStartStr}:${format(now, 'yyyy-MM-dd')}:${branchId ?? 'none'}`,
    async () => {
      // فلتر الفرع الحالي (لو موجود): بنجيب معه عمود الفرع المرتبط (مباشرة
      // على installments عبر policy، أو على مستوى أعمق على payments عبر
      // installment.policy) ونفلتر النتيجة فى الجافاسكريبت — أبسط وأضمن من
      // فلتر PostgREST متداخل على علاقتين، ونفس أسلوب الفلترة المستخدم أصلاً
      // فى باقي النظام
      const installmentsBranchSelect = branchId ? ', policy:policy_id!inner(branch_id,status)' : ', policy:policy_id!inner(status)';
      const paymentsBranchSelect = branchId ? ', installment:installment_id!inner(policy:policy_id!inner(branch_id,status))' : ', installment:installment_id!inner(policy:policy_id!inner(status))';
      const matchesBranch = (row: any, path: 'policy' | 'installment'): boolean => {
        if (!branchId) return true;
        const branch = path === 'policy' ? row.policy?.branch_id : row.installment?.policy?.branch_id;
        return branch === branchId;
      };

      let year2PoliciesQuery = supabase
        .from('policies')
        .select('id, start_date')
        .eq('status', 'active')
        .lte('start_date', format(subMonths(now, 12), 'yyyy-MM-dd'));
      if (branchId) year2PoliciesQuery = year2PoliciesQuery.eq('branch_id', branchId);

      let year2PaymentsQuery = supabase
        .from('year2_payments')
        .select('policy_id, amount, payment_month, policy:policy_id!inner(start_date,status,branch_id)')
        .eq('is_cancelled', false)
        .eq('policy.status', 'active')
        .lte('policy.start_date', format(subMonths(now, 12), 'yyyy-MM-dd'));
      if (branchId) year2PaymentsQuery = year2PaymentsQuery.eq('policy.branch_id', branchId);

      const [dueRes, totalDueRes, collectedRes, collectedMonthRes, year2PoliciesRes, year2PaymentsRes] = await Promise.all([
        // نفس منطق فلتر "الشهر" السريع بالضبط: status='pending' وتاريخ الاستحقاق
        // خلال الشهر الحالي بالكامل (إنتاج جديد + تحصيل دوري معاً)
        supabase
          .from('installments')
          .select(`amount${installmentsBranchSelect}`)
          .eq('status', 'pending')
          .eq('policy.status', 'active')
          .gte('due_date', monthStartStr)
          .lte('due_date', monthEndStr),
        // نفس النطاق الزمني لكن بدون فلتر الحالة — كل قسط تاريخ استحقاقه هذا
        // الشهر سواء اتسدد أو لسه، عشان نحسب "إجمالي المستحق" الكلي للشهر
        supabase
          .from('installments')
          .select(`amount${installmentsBranchSelect}`)
          .eq('policy.status', 'active')
          .gte('due_date', monthStartStr)
          .lte('due_date', monthEndStr),
        supabase
          .from('payments')
          .select(`amount${paymentsBranchSelect}`)
          .eq('is_cancelled', false)
          .eq('installment.policy.status', 'active')
          .gte('paid_at', dayStartIso)
          .lte('paid_at', dayEndIso),
        // نفس منطق فلتر "تم السداد" بالضبط: مسدد فعلياً خلال الشهر الحالي حسب
        // تاريخ السداد الفعلي (payment_month) وليس تاريخ الاستحقاق
        supabase
          .from('payments')
          .select(`amount${paymentsBranchSelect}`)
          .eq('is_cancelled', false)
          .eq('installment.policy.status', 'active')
          .eq('payment_month', monthStartStr),
        year2PoliciesQuery,
        year2PaymentsQuery,
      ]);

      if (dueRes.error) throw dueRes.error;
      if (totalDueRes.error) throw totalDueRes.error;
      if (collectedRes.error) throw collectedRes.error;
      if (collectedMonthRes.error) throw collectedMonthRes.error;
      if (year2PoliciesRes.error) throw year2PoliciesRes.error;
      if (year2PaymentsRes.error) throw year2PaymentsRes.error;

      const dueRows = (dueRes.data || []).filter((r: any) => matchesBranch(r, 'policy'));
      const totalDueRows = (totalDueRes.data || []).filter((r: any) => matchesBranch(r, 'policy'));
      const collectedRows = (collectedRes.data || []).filter((r: any) => matchesBranch(r, 'installment'));
      const collectedMonthRows = (collectedMonthRes.data || []).filter((r: any) => matchesBranch(r, 'installment'));

      const dueMonthAmount = dueRows.reduce((sum, r: any) => sum + Number(r.amount), 0);
      const totalDueMonthAmount = totalDueRows.reduce((sum, r: any) => sum + Number(r.amount), 0);
      const collectedTodayAmount = collectedRows.reduce((sum, r: any) => sum + Number(r.amount), 0);
      const collectedMonthAmount = collectedMonthRows.reduce((sum, r: any) => sum + Number(r.amount), 0);
      const year2CollectedMonthRows = (year2PaymentsRes.data || []) as any[];
      const year2CollectedMonthRowsForCurrentMonth = year2CollectedMonthRows.filter(
        (row) => row.payment_month === monthStartStr,
      );
      const year2CollectedMonthAmount = year2CollectedMonthRowsForCurrentMonth.reduce((sum, r) => sum + Number(r.amount), 0);
      const year2TotalCollectedAmount = year2CollectedMonthRows.reduce((sum, r) => sum + Number(r.amount), 0);

      // تنبيه السنة الثانية مبني على نفس classifier المستخدم في شاشة السنة
      // الثانية نفسها. لا ننشئ "أقساط" افتراضية ولا نغيّر أي قاعدة حسابية.
      const lastPaidMonthByPolicy = new Map<string, string>();
      for (const row of year2CollectedMonthRows) {
        const policyId = String(row.policy_id || '');
        if (!policyId) continue;
        const current = lastPaidMonthByPolicy.get(policyId);
        if (!current || row.payment_month > current) {
          lastPaidMonthByPolicy.set(policyId, row.payment_month);
        }
      }

      let year2DuePoliciesCount = 0;
      let year2OverduePoliciesCount = 0;
      for (const policy of (year2PoliciesRes.data || []) as Array<{ id: string; start_date: string }>) {
        const status = classifyYear2Status(
          policy.start_date,
          lastPaidMonthByPolicy.get(policy.id) ?? null,
          now,
        );
        if (status === 'month') year2DuePoliciesCount += 1;
        if (status === 'overdue') year2OverduePoliciesCount += 1;
      }
      const year2AttentionPoliciesCount = year2DuePoliciesCount + year2OverduePoliciesCount;

      return {
        dueMonthAmount,
        dueMonthCount: dueRows.length,
        totalDueMonthAmount,
        collectedTodayAmount,
        collectedTodayCount: collectedRows.length,
        collectedMonthAmount,
        year2EligiblePoliciesCount: year2PoliciesRes.data?.length || 0,
        year2DuePoliciesCount,
        year2OverduePoliciesCount,
        year2AttentionPoliciesCount,
        year2CollectedMonthAmount,
        year2CollectedMonthCount: year2CollectedMonthRowsForCurrentMonth.length,
        year2TotalCollectedAmount,
      };
    },
    { emptyValue: EMPTY_COLLECTION_QUICK_STATS },
  );
  return result.data;
}

// ===================================
// تحميل أقساط وثيقة معينة (مودال) — يفوّض مباشرة لنفس الدالة المشتركة
// المستخدمة فى صفحة تفاصيل الوثيقة وصفحة العملاء (بدون تكرار الاستعلام)
// ===================================
export async function fetchPolicyInstallments(policyId: string) {
  return fetchInstallmentsByPolicyId(policyId);
}

// ===================================
// تسجيل السداد وإلغاء السداد — مصدر واحد مشترك مع صفحة تفاصيل الوثيقة
// وصفحة العملاء (راجع src/features/installments/installmentsService.ts
// لنفس منطق العمل بالضبط، شامل إصلاح الوثائق القديمة)
// ===================================
export const processPayment = payInstallment;
export const cancelPayment = cancelInstallmentPayment;
