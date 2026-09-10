import { memo, useState } from 'react';
import type { Policy } from '../../../lib/supabase';
import { Pagination } from '../../../components/ui/Pagination';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { PolicyCard } from './PolicyCard';
import { GroupedPolicyCard } from './GroupedPolicyCard';
import { PolicyGroupMembersDialog } from './dialogs/PolicyGroupMembersDialog';
import { groupPoliciesForDisplay } from '../business/policyGrouping';
import type { ActionMenuAnchor } from '../../../components/ui/AppBottomSheet';

interface PoliciesListProps {
  isInitialLoading: boolean;
  policies: Policy[];
  hasActiveFilters: boolean;
  onResetAll: () => void;
  onAddPolicy: () => void;
  onOpenDetails: (policy: Policy) => void;
  onOpenMoreMenu: (policy: Policy, anchor: ActionMenuAnchor) => void;
  page: number;
  setPage: (updater: (p: number) => number) => void;
  totalPages: number;
}

function PoliciesListImpl({
  isInitialLoading,
  policies,
  hasActiveFilters,
  onResetAll,
  onAddPolicy,
  onOpenDetails,
  onOpenMoreMenu,
  page,
  setPage,
  totalPages,
}: PoliciesListProps) {
  // الوثيقة/الوثائق المعروضة حالياً فى مودال "عرض كل الوثائق" لمجموعة تقسيم
  // تلقائي (وثيقة "حماية واستثمار" بمبلغ تأمين > 50,000) — راجع
  // business/policyGrouping.ts
  const [openGroupMembers, setOpenGroupMembers] = useState<Policy[] | null>(null);

  if (isInitialLoading) {
    return <LoadingState />;
  }

  if (policies.length === 0) {
    return (
      <EmptyState
        hasActiveFilters={hasActiveFilters}
        onResetAll={onResetAll}
        onAddPolicy={onAddPolicy}
      />
    );
  }

  const entries = groupPoliciesForDisplay(policies);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry) =>
          entry.kind === 'group' ? (
            <GroupedPolicyCard
              key={entry.key}
              members={entry.members}
              onOpenMembers={setOpenGroupMembers}
            />
          ) : (
            <PolicyCard
              key={entry.key}
              policy={entry.policy}
              onOpenDetails={onOpenDetails}
              onOpenMoreMenu={onOpenMoreMenu}
            />
          )
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {openGroupMembers && (
        <PolicyGroupMembersDialog
          members={openGroupMembers}
          onClose={() => setOpenGroupMembers(null)}
          onOpenDetails={(policy) => {
            setOpenGroupMembers(null);
            onOpenDetails(policy);
          }}
        />
      )}
    </>
  );
}

// React.memo: يمنع إعادة رسم كل بطاقات الوثائق عند إعادة رسم الصفحة لأسباب
// لا علاقة لها بالقائمة (فتح مودال، تغيير حالة أخرى..)
export const PoliciesList = memo(PoliciesListImpl);
