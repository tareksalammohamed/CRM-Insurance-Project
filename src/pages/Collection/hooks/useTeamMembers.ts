import { isAbortedRead } from '../../../lib/adaptiveReads';
import { useRequestGuard } from '../../../hooks/useRequestGuard';
import { directRead, type AdaptiveRead } from '../../../lib/adaptiveReads';
import { useCallback, useEffect, useState } from 'react';
import type { User, UserRole } from '../../../lib/supabase';
import { fetchTeamForCurrentUser } from '../services/collectionService';
import { useReconnectRefetch } from '../../../hooks/useReconnectRefetch';

// فريق المستخدم الحالي (هو نفسه + كل من تحته في الهيكل الإداري فقط، فى نطاق
// الفرع الحالي المختار لو موجود) — يُستخدم لملء فلتر "الفريق" بأسماء حقيقية
// مقيّدة بصلاحياته، بدل قائمة درجات وظيفية ثابتة تشمل كل مستخدمي النظام
export function useTeamMembers(user: User | null | undefined, branchId: string | null = null, read: AdaptiveRead = directRead) {
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; role: UserRole; is_active: boolean }[]>([]);

  const guard = useRequestGuard();
  const loadTeamMembers = useCallback(async () => {
    const request = guard.start();
    if (!user) return;
    try {
      const rows = await read(() => fetchTeamForCurrentUser(user, branchId), 1, () => guard.isCurrent(request));
      if (guard.isCurrent(request)) setTeamMembers(rows);
    } catch (error) {
      if (isAbortedRead(error)) return;
      console.error('Error loading team members:', error);
    }
  }, [user, branchId, read, guard]);

  useEffect(() => {
    setTeamMembers([]);
    void loadTeamMembers();
    return guard.invalidate;
  }, [loadTeamMembers, guard]);

  useReconnectRefetch(loadTeamMembers);

  return teamMembers;
}
