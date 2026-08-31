import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { canManageBranches } from '../../../lib/supabase';
import { Building2, Lock, Plus, Power, Loader2, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { deleteBranch, fetchBranches, setBranchActive } from '../services/branchesService';
import type { Branch } from '../types';
import { AddBranchModal } from '../components/AddBranchModal';
import { filterVisibleBranches } from '../../../lib/branchVisibility';

// شاشة إدارة الفروع (إضافة/تعطيل فرع فقط) — إدارة "الأوضاع الوظيفية" الخاصة
// بكل مستخدم انتقلت لقسم مخصص داخل شاشة تعديل المستخدم نفسها (Users/
// components/UserBranchRolesSection.tsx)، فمفيش داعي لتكرارها هنا (المرحلة 3).
export function BranchesAdminPage() {
  const { user } = useAuth();
  const canView = user ? canManageBranches(user.role) : false;

  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [togglingBranchId, setTogglingBranchId] = useState<string | null>(null);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [branchActionError, setBranchActionError] = useState<string | null>(null);

  const [showAddBranch, setShowAddBranch] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBranches();
      setBranches(filterVisibleBranches(data, user?.role));
    } catch (err) {
      console.error('Error loading branches admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { if (canView) loadAll(); }, [canView, loadAll]);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Lock className="w-16 h-16 text-secondary-300 mb-4" />
        <p className="text-secondary-500">ليس لديك صلاحية للوصول لهذه الصفحة</p>
      </div>
    );
  }

  const handleToggleBranch = async (branch: Branch) => {
    setBranchActionError(null);
    setTogglingBranchId(branch.id);
    try {
      await setBranchActive(branch.id, !branch.is_active);
      await loadAll();
    } catch (err) {
      console.error('Error toggling branch:', err);
    } finally {
      setTogglingBranchId(null);
    }
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (!window.confirm(`هل أنت متأكد من حذف فرع «${branch.name}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setBranchActionError(null);
    setDeletingBranchId(branch.id);
    try {
      await deleteBranch(branch.id);
      await loadAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حذف الفرع.';
      setBranchActionError(message);
    } finally {
      setDeletingBranchId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-secondary-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            إدارة الفروع
          </h2>
          <p className="text-sm text-secondary-500 mt-1">
            إضافة/تعطيل الفروع — إدارة الأوضاع الوظيفية لكل مستخدم من شاشة المستخدمين مباشرة
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-secondary-900">الفروع</h3>
            {branchActionError && (
              <p className="text-sm font-medium text-error-600" role="alert">{branchActionError}</p>
            )}
            <button onClick={() => setShowAddBranch(true)} className="btn btn-secondary">
              <Plus className="w-4 h-4" />
              <span>فرع جديد</span>
            </button>
          </div>

          {branches.length === 0 ? (
            <div className="text-center py-8 text-secondary-400">لا توجد فروع بعد</div>
          ) : (
            <div className="space-y-2">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-secondary-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium text-secondary-900 truncate">{b.name}</p>
                    <span className={clsx('badge', b.is_active ? 'bg-success-50 text-success-700' : 'bg-secondary-100 text-secondary-500')}>
                      {b.is_active ? 'مفعّل' : 'معطّل'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleBranch(b)}
                      disabled={togglingBranchId === b.id || deletingBranchId === b.id}
                      className="btn btn-ghost text-secondary-600"
                    >
                    {togglingBranchId === b.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                      <span className="hidden sm:inline">{b.is_active ? 'تعطيل' : 'تفعيل'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(b)}
                      disabled={togglingBranchId === b.id || deletingBranchId === b.id}
                      className="btn btn-ghost text-error-600"
                      title="حذف الفرع"
                      aria-label={`حذف فرع ${b.name}`}
                    >
                      {deletingBranchId === b.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddBranch && (
        <AddBranchModal
          onClose={() => setShowAddBranch(false)}
          onDone={() => { setShowAddBranch(false); loadAll(); }}
        />
      )}
    </div>
  );
}
