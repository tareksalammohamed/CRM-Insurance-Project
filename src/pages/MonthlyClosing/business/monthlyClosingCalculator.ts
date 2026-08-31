import { getRoleLevel, ROLE_LABELS, type UserRole } from '../../../lib/supabase';
import type { BranchRoleInfo } from '../../../lib/branchHierarchy';
import type {
  AgentSummary, GroupSummary, SupervisorSummary,
  GroupLeaderAgg, SupervisorAgg, PrintDetailRow, PaymentRow, BasicUser,
} from '../types';

/** التسمية المستخدمة لصف "الإنتاج الشخصي" (لما صاحب الإنتاج يكون رئيس مجموعة
 * أو مراقب فما فوق باع/حصّل بنفسه) بدل اسم وكيل عادي — مُصدَّرة عشان تُستخدم
 * فى التقرير المطبوع لتمييز هذه الصفوف وعرض اسم صاحبها الفعلي بجانبها */
export const PERSONAL_PRODUCTION_LABEL = 'إنتاج شخصي';

/** تسمية احتياطية (fallback) فقط — الوكيل التابع لمستوى إدارى مباشرة (من غير
 * رئيس مجموعة بينهم) بقى بياخد صف/عنوان باسمه الحقيقي مع تصنيف يوضّح تبعيته
 * المباشرة والمستوى الناقص، بدل تجميع الكل تحت عنوان عام مجهول الهوية.
 * التسمية دي مستخدمة بس لو الاسم نفسه مش موجود فى بيانات المستخدمين. */
export const DIRECT_AGENTS_LABEL = 'وكلاء مباشرون';

/** المسميات المستخدمة عند ذكر "مستوى إداري ناقص" داخل نص التصنيف — بصيغة
 * نكرة (بدون "ال") لأنها بتيجي بعد كلمة "بدون"، فتقرأ سليمة نحويًا:
 * "بدون رئيس مجموعة" مش "بدون رئيس المجموعة". مفاتيحها هى الدرجة الرقمية
 * للمستوى (نفس أرقام getRoleLevel). */
const MISSING_LEVEL_LABELS: Record<number, string> = {
  2: 'مدير تطوير',
  3: 'مراقب عام',
  4: 'مراقب',
  5: 'رئيس مجموعة',
};

/** بترجع نص المستويات الإدارية اللى "اتقفزت" فعليًا بين المرؤوس ومديره —
 * مثلاً وكيل (6) تابع مراقب (4) مباشرة معناها إن مستوى رئيس المجموعة (5)
 * ناقص → "بدون رئيس مجموعة"؛ ووكيل تابع مراقب عام (3) مباشرة معناها إن
 * مستويين ناقصين → "بدون رئيس مجموعة أو مراقب". بترجع undefined لو مفيش
 * أى مستوى ناقص. */
function missingLevelsNote(subordinateRole: UserRole, managerRole: UserRole): string | undefined {
  const missing: string[] = [];
  for (let lvl = getRoleLevel(managerRole) + 1; lvl <= getRoleLevel(subordinateRole) - 1; lvl += 1) {
    const label = MISSING_LEVEL_LABELS[lvl];
    if (label) missing.push(label);
  }
  if (missing.length === 0) return undefined;
  return `بدون ${missing.join(' أو ')}`;
}

// لو حد (وكيل / رئيس مجموعة / مراقب... إلخ) ظاهر فى صف تجميعة تحت مدير
// مش المدير المباشر "المتوقع" له فى الهرم الطبيعي (يعني فى مستوى إداري
// اتقفز)، بيتحط فى نفس جدول ناس أعلى منه فى الدرجة الوظيفية من غير ما يبان
// ده واضح. الدالة دي بتبني نص التصنيف اللي بيوضح علاقته الحقيقية بمديره
// وكذلك المستوى/المستويات الإدارية الناقصة (مثلاً "وكيل يتبع المراقب
// مباشرة — بدون رئيس مجموعة")، وترجع undefined لو مفيش قفزة (يعني
// المدير هو نفسه المستوى المتوقع طبيعيًا).
function hierarchySkipNote(
  subordinateRole: UserRole,
  managerRole: UserRole,
  plural = false,
  managerName?: string,
): string | undefined {
  const expectedManagerLevel = getRoleLevel(subordinateRole) - 1;
  if (getRoleLevel(managerRole) >= expectedManagerLevel) return undefined;
  const subordinateLabel = subordinateRole === 'agent' && plural ? 'وكلاء' : ROLE_LABELS[subordinateRole];
  const verb = plural ? 'يتبعون' : 'يتبع';
  // بعد الدرجة الوظيفية للمدير بيتكتب اسمه الحقيقي — "وكيل يتبع المراقب
  // أحمد محمد مباشرة" بدل "وكيل يتبع المراقب مباشرة" اللى ما كانش بيوضّح
  // مين المراقب المقصود بالظبط لما التقرير بيجمع أكتر من مراقب.
  const managerLabel = managerName?.trim()
    ? `${ROLE_LABELS[managerRole]} ${managerName.trim()}`
    : ROLE_LABELS[managerRole];
  const base = `${subordinateLabel} ${verb} ${managerLabel} مباشرة`;
  const missing = missingLevelsNote(subordinateRole, managerRole);
  return missing ? `${base} — ${missing}` : base;
}

export interface CurrentUserRef {
  id: string;
  name: string;
  role: UserRole;
}

export interface MonthlyClosingSummary {
  supervisors: SupervisorSummary[];
  directAgents: AgentSummary[];
  grandProduction: number;
  grandCollection: number;
  printSupervisors: SupervisorAgg[];
  printDetailRows: PrintDetailRow[];
}

// نفس منطق التجميع الأصلي بالكامل، مع إضافة "سياق الفرع": لو branchId
// وbranchRoles اتمررت، بناء الهرم (childrenOf) ودرجة/مدير كل شخص بيتحدد من
// user_branch_roles الخاصة بهذا الفرع تحديدًا بدل الاعتماد المباشر على
// users.manager_id/users.role العامين. لو من غير branchId (أو branchRoles
// فاضية — أي استدعاء قديم لسه ما اتحدّثش)، السلوك بيرجع تلقائيًا لبالظبط
// نفس المنطق الأصلي (توافق كامل مع الخلف).
// ملاحظة: `_branchId` غير مستخدم داخل الحساب عن قصد — سياق الفرع بالكامل
// جاي فعليًا من `branchRoles` (خريطة user_branch_roles للفرع المطلوب، تُبنى
// فى طبقة الاستدعاء)، والمعامل باقٍ فى البصمة للتوثيق وللحفاظ على نفس نداء
// الشاشة الحالي دون أي تغيير فى النتيجة.
export function buildMonthlyClosingSummary(
  user: CurrentUserRef,
  usersData: BasicUser[],
  payments: PaymentRow[],
  _branchId?: string | null,
  branchRoles?: Map<string, BranchRoleInfo>,
): MonthlyClosingSummary {
  const usersMap = new Map<string, BasicUser>(usersData.map((u) => [u.id, u]));
  const branchRoleMap = branchRoles ?? new Map<string, BranchRoleInfo>();

  // "درجة"/"مدير" كل شخص فى سياق الفرع المطلوب — بيرجع لقيمته العامة
  // (users.role/users.manager_id) تلقائيًا لو مفيش صف مطابق فى الفرع
  // (بما فى ذلك حالة عدم تمرير أي فرع أصلاً)، فمستخدم بوضع وظيفي واحد
  // بس بيحصل بالظبط على نفس النتيجة القديمة سواء اتمرر الفرع أو لأ.
  const roleOf = (id: string): UserRole =>
    branchRoleMap.get(id)?.role ?? (usersMap.get(id)?.role as UserRole);
  const managerOf = (id: string): string | null =>
    branchRoleMap.has(id) ? branchRoleMap.get(id)!.manager_id : (usersMap.get(id)?.manager_id ?? null);

  // درجة المستخدم الحالي (صاحب التقرير) فى سياق نفس الفرع — بترجع لقيمة
  // user.role الممرّرة تلقائيًا لو مفيش فرع محدد (نفس السلوك القديم بالظبط).
  const userRole = branchRoleMap.get(user.id)?.role ?? user.role;

  // 4. تجميع على مستوى الوكيل
  const agentMap = new Map<string, AgentSummary>();

  for (const p of payments) {
    const ownerId = p.installment.policy.owner_id;
    if (!agentMap.has(ownerId)) {
      const u = usersMap.get(ownerId);
      if (!u) continue;
      agentMap.set(ownerId, {
        id: u.id, name: u.name, role: roleOf(u.id), manager_id: managerOf(u.id),
        production: 0, collection: 0, total: 0, details: [],
      });
    }
    const agent = agentMap.get(ownerId)!;
    const isNew = p.installment.is_first;
    if (isNew) agent.production += Number(p.amount);
    else        agent.collection += Number(p.amount);
    agent.total += Number(p.amount);
    agent.details.push({
      customerName:      p.installment.policy.customer.name,
      policyNumber:      p.installment.policy.policy_number,
      installmentNumber: p.installment.installment_number,
      type:              isNew ? 'new' : 'collection',
      amount:            Number(p.amount),
      paidAt:            p.paid_at,
    });
  }

  // 5. بناء هيكل الهرم حسب الـ role
  const supervisorList: SupervisorSummary[] = [];
  const directAgentList: AgentSummary[]     = [];

  const childrenOf = new Map<string, string[]>();
  for (const u of usersMap.values()) {
    const mgr = managerOf(u.id);
    if (!mgr) continue;
    if (!childrenOf.has(mgr)) childrenOf.set(mgr, []);
    childrenOf.get(mgr)!.push(u.id);
  }

  const getAgentsUnder = (managerId: string): AgentSummary[] => {
    const result: AgentSummary[] = [];
    const children = childrenOf.get(managerId) || [];
    for (const cid of children) {
      const cu = usersMap.get(cid);
      if (!cu) continue;
      if (getRoleLevel(roleOf(cid)) >= 6) {
        if (agentMap.has(cid)) result.push(agentMap.get(cid)!);
        else result.push({ id: cu.id, name: cu.name, role: roleOf(cid), manager_id: managerOf(cid), production: 0, collection: 0, total: 0, details: [] });
      } else {
        result.push(...getAgentsUnder(cid));
      }
    }
    return result;
  };

  const buildGroup = (leaderId: string): GroupSummary => {
    const leader = usersMap.get(leaderId)!;
    const agents = getAgentsUnder(leaderId);
    // لو رئيس المجموعة نفسه مالك وثائق (باع/حصّل بنفسه)، بياناته الشخصية
    // موجودة في agentMap. بنضيفها كصف مستقل باسم "إنتاج شخصي" ضمن قائمة
    // الوكلاء اللي بتظهر لما توسّع الصف، عشان تبان لوحدها وتتحسب فى الإجمالي بردو.
    const ownEntry = agentMap.get(leaderId);
    const finalAgents = ownEntry ? [...agents, { ...ownEntry, id: leaderId + '_own', name: 'إنتاج شخصي' }] : agents;
    const prod = finalAgents.reduce((s, a) => s + a.production, 0);
    const coll = finalAgents.reduce((s, a) => s + a.collection, 0);
    return { leaderId, leaderName: leader.name, leaderRole: roleOf(leaderId), production: prod, collection: coll, total: prod + coll, agents: finalAgents, agentCount: agents.length };
  };

  const buildSupervisor = (supId: string): SupervisorSummary => {
    const sup = usersMap.get(supId)!;
    const children = childrenOf.get(supId) || [];
    const groups: GroupSummary[] = [];
    const directA: AgentSummary[] = [];

    for (const cid of children) {
      const cu = usersMap.get(cid);
      if (!cu) continue;
      const lvl = getRoleLevel(roleOf(cid));
      if (lvl === 5) {
        groups.push(buildGroup(cid));
      } else if (lvl >= 6) {
        if (agentMap.has(cid)) directA.push(agentMap.get(cid)!);
        else directA.push({ id: cu.id, name: cu.name, role: roleOf(cid), manager_id: managerOf(cid), production: 0, collection: 0, total: 0, details: [] });
      } else {
        // مستوى إداري متداخل فوق رئيس المجموعة (مراقب تحت مراقب عام، مراقب عام
        // تحت مدير تطوير... إلخ) — كان بيتفقد بالكامل قبل كده. بنبنيه بنفس منطق
        // المراقب (بما فيه رقمه الشخصي) وبندمج مجموعاته هنا عشان الأرقام تتجمع
        // هرميًا مهما زاد عدد المستويات الإدارية بين المستخدم الحالي والوكلاء.
        const nested = buildSupervisor(cid);
        groups.push(...nested.groups);
      }
    }

    if (directA.length > 0) {
      // لو وكيل واحد بس مباشر تحت المراقب (من غير رئيس مجموعة)، بيتكتب اسمه
      // الحقيقي بدل تسميته "وكلاء مباشرون" — التسمية العامة دي بتفضل مستخدمة
      // بس لما يكون فى أكتر من وكيل مجمّعين مع بعض.
      const directLeaderName = directA.length === 1 ? directA[0].name : 'وكلاء مباشرون';
      groups.push({
        leaderId: supId + '_direct', leaderName: directLeaderName,
        leaderRole: 'agent' as UserRole,
        production: directA.reduce((s, a) => s + a.production, 0),
        collection: directA.reduce((s, a) => s + a.collection, 0),
        total: directA.reduce((s, a) => s + a.total, 0),
        agents: directA,
        agentCount: directA.length,
      });
    }

    // لو المراقب نفسه مالك وثائق (باع/حصّل بنفسه)، بياناته الشخصية موجودة في
    // agentMap. بنضيفها كصف مستقل باسم "إنتاج شخصي" تحت المراقب (بدل ما تندمج
    // في الإجمالي من غير ما تظهر)، عشان تبان لوحدها فى الشاشة وتتحسب فى الإجمالي بردو.
    const supOwn = agentMap.get(supId);
    if (supOwn) {
      groups.push({
        leaderId: supId + '_own',
        leaderName: 'إنتاج شخصي',
        leaderRole: roleOf(supId),
        production: supOwn.production,
        collection: supOwn.collection,
        total: supOwn.total,
        agents: [supOwn],
        agentCount: 0,
      });
    }

    const prod = groups.reduce((s, g) => s + g.production, 0);
    const coll = groups.reduce((s, g) => s + g.collection, 0);
    return { supervisorId: supId, supervisorName: sup.name, supervisorRole: roleOf(supId), production: prod, collection: coll, total: prod + coll, groups };
  };

  const myChildren = childrenOf.get(user.id) || [];
  const myDirectGroups: GroupSummary[] = [];
  for (const cid of myChildren) {
    const cu = usersMap.get(cid);
    if (!cu) continue;
    const lvl = getRoleLevel(roleOf(cid));
    if (lvl <= 4) {
      supervisorList.push(buildSupervisor(cid));
    } else if (lvl === 5) {
      myDirectGroups.push(buildGroup(cid));
    } else {
      if (agentMap.has(cid)) directAgentList.push(agentMap.get(cid)!);
      else directAgentList.push({ id: cu.id, name: cu.name, role: roleOf(cid), manager_id: managerOf(cid), production: 0, collection: 0, total: 0, details: [] });
    }
  }

  // لو المستخدم الحالي (لما يفتح هو نفسه صفحة إقفال الشهر، مش حد فوقه بيشوف
  // فريقه) عنده وثائق باعها/حصّلها بنفسه، بياناته الشخصية موجودة في agentMap.
  // بنضيفها كصف مستقل باسم "إنتاج شخصي" بدل ما تندمج في الإجمالي من غير ما تظهر.
  const myOwn = agentMap.get(user.id);
  if (myOwn) {
    myDirectGroups.push({
      leaderId: user.id + '_own',
      leaderName: 'إنتاج شخصي',
      leaderRole: userRole,
      production: myOwn.production,
      collection: myOwn.collection,
      total: myOwn.total,
      agents: [myOwn],
      agentCount: 0,
    });
  }

  if (myDirectGroups.length > 0) {
    supervisorList.unshift({
      supervisorId: user.id,
      supervisorName: user.name,
      supervisorRole: userRole,
      production: myDirectGroups.reduce((s, g) => s + g.production, 0),
      collection: myDirectGroups.reduce((s, g) => s + g.collection, 0),
      total: myDirectGroups.reduce((s, g) => s + g.total, 0),
      groups: myDirectGroups,
    });
  }

  const totalProd = supervisorList.reduce((s, sv) => s + sv.production, 0)
                  + directAgentList.reduce((s, a) => s + a.production, 0);
  const totalColl = supervisorList.reduce((s, sv) => s + sv.collection, 0)
                  + directAgentList.reduce((s, a) => s + a.collection, 0);

  // ── بيانات التقرير المطبوع (هيكل إداري بحت) ──
  const isSupervisorPrinter = userRole === 'supervisor';

  /**
   * التقرير المطبوع بيعرض بس اللى عندهم حركة فعلية فى الشهر — أى حد
   * (وكيل / رئيس مجموعة / مراقب / مراقب عام... إلخ) مالوش ولا مليم إنتاج
   * جديد ولا تحصيل مابيتكتبش اسمه خالص فى الورق، بدل ما ياخد صف بأصفار
   * يطوّل التقرير ويشغل صفحات من غير أى معلومة.
   *
   * بنفحص الإنتاج والتحصيل كل واحد لوحده (مش الإجمالي) عشان لو حصل عمليات
   * متعاكسة (مبلغ موجب وسالب بيلغوا بعض) يفضل الصف ظاهر لأن فيه حركة فعلية
   * تستحق المراجعة، مش سكوت تام.
   *
   * ملحوظة مهمة: الفلتر ده على العرض بس. الإجماليات الكبرى (grandProduction /
   * grandCollection) محسوبة من شجرة البيانات الأصلية مش من الصفوف المعروضة،
   * والصفوف المحجوبة أصفار أصلاً — فالأرقام مابتتأثرش بحرف.
   */
  const hasMovement = (r: { production: number; collection: number }): boolean =>
    r.production !== 0 || r.collection !== 0;

  const getAgentIdsUnder = (managerId: string): string[] => {
    const result: string[] = [];
    const kids = childrenOf.get(managerId) || [];
    for (const kid of kids) {
      const ku = usersMap.get(kid);
      if (!ku) continue;
      if (getRoleLevel(roleOf(kid)) >= 6) result.push(kid);
      else result.push(...getAgentIdsUnder(kid));
    }
    return result;
  };

  const sumAgentIds = (idsToSum: string[]) => {
    let production = 0, collection = 0, total = 0;
    for (const id of idsToSum) {
      const a = agentMap.get(id);
      if (a) { production += a.production; collection += a.collection; total += a.total; }
    }
    return { production, collection, total };
  };

  const buildGroupLeaderAgg = (glId: string, managerRole: UserRole, managerName?: string): GroupLeaderAgg[] => {
    const gl = usersMap.get(glId)!;
    const ids = getAgentIdsUnder(glId);
    const agentsSum = sumAgentIds(ids);
    // بيانات رئيس المجموعة الشخصية لو باع/حصّل بنفسه بتتحسب ضمن صفه هو
    // مباشرة (بدون صف تفصيلي مستقل) — لأن صفحة التجميعات صفحة إجمالي فقط.
    const own = agentMap.get(glId);
    const production = agentsSum.production + (own?.production ?? 0);
    const collection = agentsSum.collection + (own?.collection ?? 0);
    const total = agentsSum.total + (own?.total ?? 0);
    const roleNote = hierarchySkipNote('group_leader', managerRole, false, managerName);
    return [{ id: glId, name: gl.name, production, collection, total, roleNote }];
  };

  /** أقرب مدير فى السلسلة الإدارية فوق userId درجته الفعلية "مراقب عام" —
   * بيدوّر بس ضمن usersMap المجلوبة أصلاً لهذا التقرير (بدون أى fetch
   * إضافي)؛ لو النطاق الحالي ما بيوصلش لمراقب عام (تقرير مقصور على فريق
   * مراقب واحد بمعزل عن مديره)، بترجع undefined ومذكرة التوصية بتسيب اسم
   * الموقّع فاضي للتعبئة اليدوية بدل اختلاق اسم. */
  const findGeneralSupervisor = (userId: string): { id: string; name: string } | undefined => {
    let cur = managerOf(userId);
    let hops = 0;
    while (cur && hops < 8) {
      const m = usersMap.get(cur);
      if (!m) return undefined;
      if (roleOf(cur) === 'general_supervisor') return { id: cur, name: m.name };
      cur = managerOf(cur);
      hops += 1;
    }
    return undefined;
  };

  const buildSupervisorAgg = (supId: string, nameOverride?: string): SupervisorAgg => {
    const sup = usersMap.get(supId);
    const kids = childrenOf.get(supId) || [];
    const groupLeaders: GroupLeaderAgg[] = [];
    const directAgentIds: string[] = [];
    // عدد رؤساء المجموعات التابعين مباشرة هيكليًا (بغض النظر عن حركتهم فى
    // الشهر ده) — لمذكرة التوصية (شرط "3 رؤساء مجموعات")، مختلف عمدًا عن
    // groupLeaders.length النهائي اللى بيتفلتر لاحقًا بـ hasMovement.
    let directGroupLeaderCount = 0;

    const supRole: UserRole = roleOf(supId) ?? sup?.role ?? 'supervisor';

    for (const kid of kids) {
      const ku = usersMap.get(kid);
      if (!ku) continue;
      const kuRole = roleOf(kid);
      const lvl = getRoleLevel(kuRole);
      if (kuRole === 'group_leader') {
        directGroupLeaderCount += 1;
        groupLeaders.push(...buildGroupLeaderAgg(kid, supRole, sup?.name));
      } else if (lvl >= 6) {
        directAgentIds.push(kid);
      } else if (lvl === getRoleLevel(supRole) + 1) {
        // مستوى إداري متداخل طبيعي (المستوى المتوقع مباشرة تحت الحالي، زي
        // مراقب عام تحت مدير تطوير) — بندمج مجموعات رؤساء المجموعات بتاعته
        // هنا عشان التقرير المطبوع يتطابق مع المعروض على الشاشة.
        const nested = buildSupervisorAgg(kid);
        groupLeaders.push(...nested.groupLeaders);
      } else {
        // مستوى إداري اتقفز (مثلاً مراقب تابع مدير تطوير مباشرة من غير
        // مراقب عام بينهم) — بيتحط كصف مستقل بإجمالي فريقه كله (بدل ما يتفكك
        // لرؤساء مجموعاته منفردين وسط قائمة رؤساء مجموعات المستوى ده)،
        // وبيتوضح جنبه تصنيفه الحقيقي عشان يبان إنه اتحط جنب حد أعلى منه.
        const nested = buildSupervisorAgg(kid);
        groupLeaders.push({
          id: kid,
          name: nested.name,
          production: nested.production,
          collection: nested.collection,
          total: nested.total,
          roleNote: hierarchySkipNote(kuRole, supRole, false, sup?.name),
        });
      }
    }
    // كل وكيل تابع للمستوى الإداري ده مباشرة (من غير رئيس مجموعة بينهم)
    // بياخد صف مستقل باسمه الحقيقي + تصنيف يوضّح إنه يتبع الدرجة الوظيفية
    // دي مباشرة والمستوى الناقص — بدل ما يتجمّعوا كلهم فى صف واحد مجهول
    // اسمه "وكلاء مباشرون".
    for (const aid of directAgentIds) {
      groupLeaders.push({
        id: aid,
        name: usersMap.get(aid)?.name ?? DIRECT_AGENTS_LABEL,
        ...sumAgentIds([aid]),
        roleNote: hierarchySkipNote(roleOf(aid), supRole, false, sup?.name),
      });
    }

    // بيانات المراقب الشخصية لو باع/حصّل بنفسه — بتتحط كصف مستقل باسم
    // "إنتاج شخصي" مع درجته الوظيفية الحقيقية جنب صفوف رؤساء المجموعات
    // (زي "إنتاج شخصي — المراقب العام")، عشان تبان لوحدها ويتوضح صاحبها
    // بالظبط لو التقرير بيجمع أكتر من مستوى إداري.
    const supOwn = agentMap.get(supId);
    if (supOwn) {
      groupLeaders.push({
        id: supId + '_own',
        // بنضيف اسم صاحب الإنتاج (sup?.name) دايمًا مع الدرجة الوظيفية —
        // لأن الصف ده ممكن يتدمج لاحقًا (فى الحالة أعلاه lvl === level+1)
        // جوه groupLeaders بتاع مراقب أعلى منه (مراقب عام / مدير تطوير)،
        // وساعتها لو مفيش اسم هيبقى فيه أكتر من صف بنفس النص من غير ما
        // تعرف كل صف تبع مين.
        name: `${PERSONAL_PRODUCTION_LABEL} — ${ROLE_LABELS[supRole]}: ${sup?.name ?? ''}`,
        production: supOwn.production,
        collection: supOwn.collection,
        total: supOwn.total,
      });
    }

    // الإجماليات بتتحسب من القائمة الكاملة قبل أى حجب، فحجب صفوف الأصفار
    // مستحيل يأثر على أى رقم — والصفوف المحجوبة أصفار أصلاً.
    const totals = groupLeaders.reduce((acc, g) => ({
      production: acc.production + g.production,
      collection: acc.collection + g.collection,
      total: acc.total + g.total,
    }), { production: 0, collection: 0, total: 0 });

    const target = Number(sup?.target || 0);
    const generalSupervisor = findGeneralSupervisor(supId);

    return {
      id: supId, name: nameOverride ?? sup?.name ?? '', role: supRole,
      // اللى مالوش حركة فى الشهر مابياخدش صف فى الورق (طلب صريح: مايتكتبش
      // اسمه خالص لو مفيش إنتاج جديد ولا تحصيل).
      groupLeaders: groupLeaders.filter(hasMovement),
      ...totals,
      target,
      achievementRate: target > 0 ? Math.round((totals.total / target) * 100) : 0,
      directGroupLeaderCount,
      generalSupervisorId: generalSupervisor?.id,
      generalSupervisorName: generalSupervisor?.name,
    };
  };

  const printSupervisorList: SupervisorAgg[] = [];

  if (isSupervisorPrinter) {
    printSupervisorList.push(buildSupervisorAgg(user.id, user.name));
  } else {
    const kids = childrenOf.get(user.id) || [];
    const directGroupLeaderIds: string[] = [];
    const directAgentIds: string[] = [];

    for (const kid of kids) {
      const ku = usersMap.get(kid);
      if (!ku) continue;
      const lvl = getRoleLevel(roleOf(kid));
      if (lvl <= 4) {
        // أي مستوى إداري من "مراقب" فما فوق (مراقب، مراقب عام، مدير تطوير، مدير
        // نظام) — كان بيتلقط الدور "supervisor" حرفيًا بس، فكانت المستويات
        // الإدارية الأعلى بتتفقد بالكامل من التقرير.
        printSupervisorList.push(buildSupervisorAgg(kid));
      } else if (roleOf(kid) === 'group_leader') {
        directGroupLeaderIds.push(kid);
      } else if (lvl >= 6) {
        directAgentIds.push(kid);
      }
    }

    if (directGroupLeaderIds.length > 0 || directAgentIds.length > 0 || agentMap.has(user.id)) {
      const groupLeaders: GroupLeaderAgg[] = directGroupLeaderIds.flatMap((id) => buildGroupLeaderAgg(id, userRole, user.name));
      if (directAgentIds.length > 0) {
        if (userRole === 'group_leader') {
          // لو رئيس مجموعة بيشوف تجميعاته الشخصية، الوكلاء المباشرين دول هما
          // فريقه هو نفسه (وضع طبيعي مش قفزة فى الهرم)، فبيتجمّعوا فى صف
          // واحد اسمه "إنتاج شخصي" من غير تصنيف — نفس السلوك السابق بالظبط.
          groupLeaders.push({
            id: user.id + '_direct',
            name: PERSONAL_PRODUCTION_LABEL,
            ...sumAgentIds(directAgentIds),
          });
        } else {
          // مراقب فما فوق: كل وكيل تابع له مباشرة (من غير رئيس مجموعة) بياخد
          // صف مستقل باسمه الحقيقي + تصنيف يوضّح تبعيته المباشرة والمستوى
          // الناقص، بدل صف واحد مجهول اسمه "وكلاء مباشرون".
          for (const aid of directAgentIds) {
            groupLeaders.push({
              id: aid,
              name: usersMap.get(aid)?.name ?? DIRECT_AGENTS_LABEL,
              ...sumAgentIds([aid]),
              roleNote: hierarchySkipNote(roleOf(aid), userRole, false, user.name),
            });
          }
        }
      }
      // بيانات المستخدم الحالي الشخصية لو باع/حصّل بنفسه — بتتحط كصف
      // مستقل باسم "إنتاج شخصي" زي أي صف تاني، عشان تبان لوحدها. لو هو
      // نفسه رئيس مجموعة بيشوف تجميعاته الشخصية، فريقه أصلاً بيتسمى
      // "إنتاج شخصي" فوق (سطر directLabel)، فبنجمع إنتاجه الشخصي عليه
      // بدل ما يتكرر نفس الاسم فى صفين.
      const myOwn = agentMap.get(user.id);
      if (myOwn) {
        const ownTeamRow = userRole === 'group_leader'
          ? groupLeaders.find((g) => g.id === user.id + '_direct')
          : undefined;
        if (ownTeamRow) {
          ownTeamRow.production += myOwn.production;
          ownTeamRow.collection += myOwn.collection;
          ownTeamRow.total += myOwn.total;
        } else {
          groupLeaders.push({
            id: user.id + '_own',
            name: `${PERSONAL_PRODUCTION_LABEL} — ${ROLE_LABELS[userRole]}: ${user.name}`,
            production: myOwn.production,
            collection: myOwn.collection,
            total: myOwn.total,
          });
        }
      }
      // نفس الملحوظة: الإجماليات من القائمة الكاملة قبل الحجب.
      const totals = groupLeaders.reduce((acc, g) => ({
        production: acc.production + g.production,
        collection: acc.collection + g.collection,
        total: acc.total + g.total,
      }), { production: 0, collection: 0, total: 0 });
      printSupervisorList.push({
        id: user.id, name: user.name, role: userRole,
        groupLeaders: groupLeaders.filter(hasMovement),
        ...totals,
        isSelfReport: userRole === 'group_leader',
      });
    }
  }

  // مراقب/مراقب عام فريقه كله مالوش أى حركة فى الشهر — بلوكه بالكامل
  // (عنوانه + جدوله + صف إجماليه) مابيتطبعش خالص، عشان الورق ما يمتليش
  // بجداول أصفار. الإجماليات الكبرى محسوبة برّه القائمة دى فمابتتأثرش.
  const visiblePrintSupervisors = printSupervisorList.filter(
    (sv) => hasMovement(sv) || sv.groupLeaders.length > 0
  );

  // ── تفاصيل العمليات المسددة — قائمة مسطّحة ──

  /**
   * تصنيف رئيس المجموعة نفسه، محسوب من مديره الفعلي فى الشجرة (مش من صاحب
   * التقرير) — عشان نفس رئيس المجموعة يطلع بنفس التصنيف بالحرف فى كل صفوفه:
   * صف إنتاجه الشخصي وصفوف وكلائه على حدٍ سواء.
   * `fallbackManagerRole`/`fallbackManagerName` بيُستخدموا بس لو مدير رئيس
   * المجموعة نفسه غير موجود فى بيانات المستخدمين (بيانات ناقصة) — فبنرجع
   * لسلوك أقرب مستوى معروف.
   */
  const groupLeaderOwnNote = (
    groupLeaderId: string,
    fallbackManagerRole: UserRole,
    fallbackManagerName?: string,
  ): string | undefined => {
    const managerId = managerOf(groupLeaderId);
    const manager = managerId ? usersMap.get(managerId) : undefined;
    const managerRole = managerId ? roleOf(managerId) : undefined;
    return managerRole
      ? hierarchySkipNote('group_leader', managerRole, false, manager?.name)
      : hierarchySkipNote('group_leader', fallbackManagerRole, false, fallbackManagerName);
  };

  const resolveHierarchyNames = (agentId: string) => {
    const agent = usersMap.get(agentId);
    const agentName = agent?.name || '';
    const agentRole = agent ? roleOf(agentId) : undefined;
    const ownerLevel = agent ? getRoleLevel(agentRole!) : 6;

    if (isSupervisorPrinter) {
      // صاحب الإنتاج نفسه رئيس مجموعة (إنتاج شخصي) — اسمه يتحط فى عموده
      // الوظيفي الحقيقي "رئيس المجموعة"، وعمود "الوكيل" يتكتب فيه
      // "إنتاج شخصي" بدل تكرار اسمه فيه.
      if (agentRole === 'group_leader') {
        return {
          supervisorName: user.name, supervisorRole: userRole,
          groupLeaderName: agentName, agentName: PERSONAL_PRODUCTION_LABEL,
          groupLevelNote: groupLeaderOwnNote(agentId, userRole, user.name),
        };
      }
      // صاحب الإنتاج نفسه مراقب (اللي بيطبع التقرير) وباع/حصّل بنفسه —
      // اسمه أصلاً فى عمود المراقب، والعمودين التاليين "إنتاج شخصي".
      if (ownerLevel <= 4) {
        return { supervisorName: agentName, supervisorRole: agentRole!, groupLeaderName: PERSONAL_PRODUCTION_LABEL, agentName: PERSONAL_PRODUCTION_LABEL };
      }

      // بندوّر على رئيس المجموعة بين الوكيل والمراقب. لو مفيش (الوكيل تابع
      // للمراقب مباشرة)، بنكتب اسم الوكيل نفسه فى مستوى "رئيس المجموعة" مع
      // تصنيف يوضّح تبعيته المباشرة — بدل عنوان عام "وكلاء مباشرون".
      let groupLeaderName = '';
      let groupLeaderId: string | null = null;
      let cur = agent ? managerOf(agentId) : null;
      while (cur && cur !== user.id) {
        const m = usersMap.get(cur);
        if (!m) break;
        if (roleOf(cur) === 'group_leader') { groupLeaderName = m.name; groupLeaderId = cur; break; }
        cur = managerOf(cur);
      }
      if (!groupLeaderName) {
        return {
          supervisorName: user.name, supervisorRole: userRole,
          groupLeaderName: agentName, agentName,
          groupLevelNote: hierarchySkipNote(agentRole!, userRole, false, user.name),
          groupLevelIsOwner: true,
        };
      }
      return {
        supervisorName: user.name, supervisorRole: userRole, groupLeaderName, agentName,
        // تصنيف رئيس المجموعة نفسه (لو تابع لمستوى أعلى من المتوقع مباشرة) —
        // بيتحسب من مديره الفعلي عشان يفضل ثابت فى كل صفوفه، سواء كان الصف
        // ده لأحد وكلائه أو لإنتاجه الشخصي.
        groupLevelNote: groupLeaderId ? groupLeaderOwnNote(groupLeaderId, userRole, user.name) : undefined,
      };
    }

    // صاحب الإنتاج نفسه رئيس مجموعة (إنتاج شخصي) فى تقرير مستخدم أعلى منه —
    // نفس الفكرة: اسمه فى عمود "رئيس المجموعة"، وعمود "الوكيل" = "إنتاج شخصي".
    if (agentRole === 'group_leader') {
      let supervisorName = '';
      let supervisorRole: UserRole = userRole;
      let cur = managerOf(agentId);
      while (cur) {
        const m = usersMap.get(cur);
        if (!m) break;
        const mRole = roleOf(cur);
        if (!supervisorName && getRoleLevel(mRole) <= 4) { supervisorName = m.name; supervisorRole = mRole; }
        if (cur === user.id) break;
        cur = managerOf(cur);
      }
      if (!supervisorName) { supervisorName = user.name; supervisorRole = userRole; }
      return {
        supervisorName, supervisorRole,
        groupLeaderName: agentName, agentName: PERSONAL_PRODUCTION_LABEL,
        // رئيس مجموعة تابع للمراقب العام (أو أعلى) مباشرة من غير مراقب —
        // بيتوضح تحت اسمه بدل ما يبان وكأنه تحت مراقب عادي.
        groupLevelNote: groupLeaderOwnNote(agentId, supervisorRole, supervisorName),
      };
    }

    // صاحب الإنتاج نفسه مراقب (أو مستوى إدارى أعلى) — اسمه فى عمود
    // المراقب، والعمودين التاليين "إنتاج شخصي".
    if (ownerLevel <= 4) {
      return { supervisorName: agentName, supervisorRole: agentRole!, groupLeaderName: PERSONAL_PRODUCTION_LABEL, agentName: PERSONAL_PRODUCTION_LABEL };
    }

    let groupLeaderName = '';
    let groupLeaderId: string | null = null;
    let supervisorName = '';
    let supervisorRole: UserRole = userRole;
    let cur = agent ? managerOf(agentId) : null;
    while (cur) {
      const m = usersMap.get(cur);
      if (!m) break;
      const mRole = roleOf(cur);
      if (!groupLeaderName && mRole === 'group_leader') { groupLeaderName = m.name; groupLeaderId = cur; }
      // أول مستوى إدارى (مراقب فما فوق) فوق الوكيل هو اللى بيتكتب فى مستوى
      // "المراقب" — قبل كده كان بيتلقط دور 'supervisor' حرفيًا بس، فوكيل
      // تابع لمراقب عام مباشرة كان بياخد اسم صاحب التقرير بالغلط.
      if (!supervisorName && getRoleLevel(mRole) <= 4) { supervisorName = m.name; supervisorRole = mRole; }
      if (cur === user.id) break;
      cur = managerOf(cur);
    }
    if (!supervisorName) { supervisorName = user.name; supervisorRole = userRole; }
    if (!groupLeaderName) {
      // وكيل تابع لمستوى إدارى مباشرة من غير رئيس مجموعة: اسمه هو نفسه
      // اللى بيتكتب فى مستوى "رئيس المجموعة" + تصنيف تبعيته المباشرة.
      return {
        supervisorName, supervisorRole,
        groupLeaderName: agentName, agentName,
        groupLevelNote: hierarchySkipNote(agentRole!, supervisorRole, false, supervisorName),
        groupLevelIsOwner: true,
      };
    }
    return {
      supervisorName, supervisorRole, groupLeaderName, agentName,
      // نفس التصنيف اللى بيظهر تحت اسم رئيس المجموعة فى صف إنتاجه الشخصي —
      // بيتكرر هنا فى صفوف وكلائه عشان الشجرة تبان متسقة فى كل الصفحة.
      groupLevelNote: groupLeaderId ? groupLeaderOwnNote(groupLeaderId, supervisorRole, supervisorName) : undefined,
    };
  };

  const detailRows: PrintDetailRow[] = payments.map((p) => {
    const ownerId = p.installment.policy.owner_id;
    const { supervisorName, supervisorRole, groupLeaderName, agentName, groupLevelNote, groupLevelIsOwner } = resolveHierarchyNames(ownerId);
    return {
      supervisorName,
      supervisorRole,
      groupLeaderName,
      agentName,
      groupLevelNote,
      groupLevelIsOwner,
      customerName: p.installment.policy.customer.name,
      policyNumber: p.installment.policy.policy_number,
      installmentNumber: p.installment.installment_number,
      amount: Number(p.amount),
      type: p.installment.is_first ? 'new' : 'collection',
    };
  });

  detailRows.sort((a, b) =>
    a.supervisorName.localeCompare(b.supervisorName, 'ar') ||
    a.groupLeaderName.localeCompare(b.groupLeaderName, 'ar') ||
    a.agentName.localeCompare(b.agentName, 'ar') ||
    a.customerName.localeCompare(b.customerName, 'ar')
  );

  return {
    supervisors: supervisorList,
    directAgents: directAgentList,
    grandProduction: totalProd,
    grandCollection: totalColl,
    printSupervisors: visiblePrintSupervisors,
    printDetailRows: detailRows,
  };
}
