import type { UserRole } from '../../lib/supabase';

// ─── types ────────────────────────────────────────────────
export interface PaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  installment: {
    installment_number: number;
    is_first: boolean;
    policy: {
      policy_number: string;
      owner_id: string;
      customer: { name: string };
    };
  };
}

export interface AgentSummary {
  id: string;
  name: string;
  role: UserRole;
  manager_id: string | null;
  production: number;
  collection: number;
  total: number;
  details: {
    customerName: string;
    policyNumber: string;
    installmentNumber: number;
    type: 'new' | 'collection';
    amount: number;
    paidAt: string;
  }[];
}

export interface GroupSummary {
  leaderId: string;
  leaderName: string;
  leaderRole: UserRole;
  production: number;
  collection: number;
  total: number;
  agents: AgentSummary[];
  agentCount: number;
}

export interface SupervisorSummary {
  supervisorId: string;
  supervisorName: string;
  supervisorRole: UserRole;
  production: number;
  collection: number;
  total: number;
  groups: GroupSummary[];
}

export interface GroupLeaderAgg {
  id: string;
  name: string;
  production: number;
  collection: number;
  total: number;
  // لو الصف ده بيمثل حد درجته الوظيفية الحقيقية أقل من اللي المفروض يكون
  // فى نفس مستوى الصف ده (مثلاً وكيل ظاهر فى عمود "رئيس المجموعة" لأنه تابع
  // مراقب مباشرة من غير رئيس مجموعة بينهم) — بنوضح تصنيفه الحقيقي هنا عشان
  // يبان واضح إنه اتحط جنب ناس أعلى منه فى الدرجة الوظيفية وليه.
  roleNote?: string;
}

export interface SupervisorAgg {
  id: string;
  name: string;
  // الدرجة الوظيفية الحقيقية لصاحب هذا الصف — بتُستخدم فى التقرير المطبوع
  // لعرض المسمى الوظيفي الصحيح (مراقب / مراقب عام / مدير تطوير...) بدل ما
  // يتثبت على "المراقب" دايمًا.
  role: UserRole;
  groupLeaders: GroupLeaderAgg[];
  production: number;
  collection: number;
  total: number;
  // true لو الصف ده بيمثل تجميع المستخدم المسجّل دخوله نفسه (مثلاً رئيس
  // مجموعة بيشوف صفحة تجميعاته الشخصية) — فبالتالي مفيش داعي نكرر اسمه
  // كعنوان "المراقب" فوق الجدول، لأنه ظاهر أصلاً في ترويسة الصفحة.
  isSelfReport?: boolean;
}

export interface PrintDetailRow {
  supervisorName: string;
  // الدرجة الوظيفية الحقيقية لصاحب اسم "المراقب" فى الصف ده (مراقب / مراقب
  // عام / مدير تطوير...) — عشان التقرير المطبوع يوضّح اللقب الصحيح لكل واحد
  // بدل ما يفترض إن كل الأسماء فى عمود المراقب لهم نفس درجة صاحب التقرير.
  supervisorRole: UserRole;
  groupLeaderName: string;
  agentName: string;
  /** تصنيف يوضّح التبعية الحقيقية لصاحب الاسم المكتوب فى مستوى "رئيس
   * المجموعة" (groupLeaderName) لما يكون تابعًا لمستوى إداري أعلى من المتوقع
   * مباشرة — مثلاً وكيل تابع المراقب من غير رئيس مجموعة، أو رئيس مجموعة تابع
   * المراقب العام من غير مراقب. بيتعرض كسطر صغير تحت الاسم فى صفحات التفاصيل
   * بدل عنوان عام مجهول الهوية زى "وكلاء مباشرون". */
  groupLevelNote?: string;
  /** true لو الاسم المكتوب فى مستوى "رئيس المجموعة" هو صاحب الإنتاج نفسه
   * (وكيل تابع لمستوى إدارى مباشرة من غير رئيس مجموعة) — وقتها مفيش داعى
   * لتكرار نفس الاسم فى سطر الوكيل تحته. */
  groupLevelIsOwner?: boolean;
  customerName: string;
  policyNumber: string;
  installmentNumber: number;
  amount: number;
  type: 'new' | 'collection';
}

export interface BasicUser {
  id: string;
  name: string;
  role: UserRole;
  manager_id: string | null;
  /** حالة الحساب تُستخدم لاستبعاد الوكيل غير النشط من شاشة الإقفال فقط.
   * التقرير المطبوع يتعمد الاحتفاظ به لإظهار التحصيلات التاريخية. */
  is_active?: boolean;
  deleted_at?: string | null;
}
