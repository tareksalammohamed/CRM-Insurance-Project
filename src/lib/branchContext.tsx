import { createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchMyBranches, type MyBranchMembership } from './myBranches';
import { filterVisibleMemberships } from './branchVisibility';
import { getRoleLevel, type UserRole } from './supabase';

// الأدوار اللي بطبيعتها بتشرف على أكتر من فرع فى نفس الوقت (مش وضع وظيفي
// مقصور على فرع واحد بالتعريف) — حتى لو حاليًا عندها صف واحد بس فى
// user_branch_roles (يعني لسه معندهاش أكتر من وضع وظيفي فعلي مسجل).
// getRoleLevel: super_admin=1, development_manager=2, general_supervisor=3،
// وأي درجة من دول لازم تشوف كل الفروع تحت هرمها افتراضيًا، مش تتقيّد بفرع
// الـ backfill/التسجيل بتاعها.
function isCrossBranchByNature(role: UserRole | null): boolean {
  if (!role) return false;
  return getRoleLevel(role) <= 3;
}

// ===================================
// "سياق الفرع" (Branch Context) — المرحلة الثانية من دعم تعدد الفروع.
//
// المبدأ الأساسي: مستخدم عنده وضع وظيفي واحد بس (الحالة الطبيعية لغالبية
// المستخدمين) يفضل يشتغل بالظبط زي ما كان قبل هذه المرحلة — من غير ما
// يشوف أي سلكتور فرع أو أي فرق فى تجربة الاستخدام إطلاقًا. الـ Context ده
// بيحسب currentBranchId تلقائيًا فى الحالة دي، وبيسيب عرض السلكتور (فى
// الهيدر) مقصور فقط على المستخدمين اللي عندهم أكتر من وضع وظيفي.
//
// اختيار "الفرع الحالي" لمستخدم متعدد الفروع بيتحفظ فى الـ session
// (sessionStorage) بس — مش localStorage — عشان يتصفّر تلقائيًا لو المستخدم
// قفل التبويب/المتصفح، مطابقةً للمطلوب حرفيًا ("يحفظ اختيار الفرع الحالي
// فى الـ session").
// ===================================

function sessionKey(userId: string): string {
  return `crm:current-branch:${userId}`;
}

interface BranchContextValue {
  /** كل الفروع اللي المستخدم الحالي عضو فيها (helper fetchMyBranches تحت) */
  branches: MyBranchMembership[];
  /** true فقط لو عنده أكتر من وضع وظيفي — ده الشرط الوحيد لإظهار أي سلكتور */
  hasMultipleBranches: boolean;
  /** لسه بيحمّل بيانات الفروع بتاعة المستخدم */
  loading: boolean;
  /** الفرع الحالي المختار (أو الفرع الوحيد تلقائيًا لو عنده وضع واحد بس) */
  currentBranchId: string | null;
  /** لاستخدام سلكتور الفرع بس — بيحفظ الاختيار فى الـ session */
  setCurrentBranchId: (branchId: string) => void;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<MyBranchMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBranchId, setCurrentBranchIdState] = useState<string | null>(null);

  // الاعتماد مقصود على (id, role) فقط بدل كائن `user` بالكامل: البروفايل
  // بيتعاد جلبه دوريًا فبيتغيّر مرجعه من غير تغيير فعلي، ولو اعتمدنا على
  // الكائن هنعيد جلب فروع المستخدم بلا داعٍ. `role` مضاف عشان بيتقرا فعلاً
  // جوّا الـeffect (filterVisibleMemberships + شرط super_admin).
  const userId = user?.id ?? null;
  const userRole = user?.role ?? null;

  useEffect(() => {
    if (!userId) {
      setBranches([]);
      setCurrentBranchIdState(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchMyBranches(userId).then((allRoles) => {
      if (cancelled) return;
      // إخفاء "الفرع الرئيسي" عن أي حد غير سوبر أدمن — حتى من ضمن أوضاعه
      // الوظيفية بتاعته هو نفسه، فمش هيشوفه كخيار فى السلكتور ولا يتحسب كجزء
      // من "عنده أكتر من فرع" أصلاً.
      const roles = filterVisibleMemberships(allRoles, userRole ?? undefined);
      setBranches(roles);

      if (isCrossBranchByNature(userRole)) {
        // super_admin / development_manager / general_supervisor: دول
        // بطبيعة درجتهم الوظيفية بيشرفوا على أكتر من فرع فى نفس الوقت، حتى
        // لو حاليًا مسجلين بوضع وظيفي واحد بس (صف واحد فى user_branch_roles
        // — مثلاً فرع الـ backfill/التسجيل الافتراضي بتاعهم). لو قيّدناهم
        // بفرعهم الوحيد ده زي أي مستخدم عادي، هيفقدوا رؤية باقي الفروع
        // اللي فعليًا تحت إشرافهم (ده كان سبب اختفاء بيانات كاملة — إنتاج
        // وتحصيل وتارجت — لما مراقب عام يفتح نفس التقرير اللي مراقب الفرع
        // فاتحه). currentBranchId = null يرجّعهم لسلوك get_user_subtree
        // الأصلي العابر للفروع (كل من تحتهم فى الهرم بغض النظر عن الفرع).
        setCurrentBranchIdState(null);
        setLoading(false);
        return;
      }

      if (roles.length <= 1) {
        // وضع وظيفي واحد بس (أو صفر - حالة نادرة جدًا، قبل أي backfill):
        // فرع تلقائي بدون أي اختيار فى الواجهة.
        setCurrentBranchIdState(roles[0]?.branchId ?? null);
      } else {
        // أكتر من وضع وظيفي: نرجع لآخر اختيار محفوظ فى الـ session لنفس
        // المستخدم لو لسه صالح (لسه من ضمن فروعه)، وإلا الفرع الأساسي
        // (is_primary)، وإلا أول فرع فى القائمة.
        let saved: string | null = null;
        try {
          saved = sessionStorage.getItem(sessionKey(userId));
        } catch {
          // بيئة بدون sessionStorage (نادر) — نتجاهل ونكمل بالقيمة الافتراضية
        }
        const validSaved = saved && roles.some((r) => r.branchId === saved) ? saved : null;
        const primary = roles.find((r) => r.isPrimary)?.branchId ?? null;
        setCurrentBranchIdState(validSaved ?? primary ?? roles[0].branchId);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, userRole]);

  const setCurrentBranchId = useCallback((branchId: string) => {
    setCurrentBranchIdState(branchId);
    if (userId) {
      try {
        sessionStorage.setItem(sessionKey(userId), branchId);
      } catch {
        // تجاهل فشل الحفظ (بيئة بدون sessionStorage) — الاختيار هيفضل شغال
        // فى نفس الجلسة الحالية على الأقل عن طريق الـ state
      }
    }
  }, [userId]);

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      hasMultipleBranches: branches.length > 1,
      loading,
      currentBranchId,
      setCurrentBranchId,
    }),
    [branches, loading, currentBranchId, setCurrentBranchId],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranchContext(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (ctx === undefined) {
    throw new Error('useBranchContext must be used within a BranchProvider');
  }
  return ctx;
}
