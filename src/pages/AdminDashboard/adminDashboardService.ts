import { supabase, supabaseUrl, type ActivityLog } from '../../lib/supabase';

export type AdminDashboardHealth = {
  database: { status: string; server_time: string; last_backup_export: string | null };
  ai: {
    enabled: boolean;
    models_updated_at: string | null;
    providers: Array<{
      provider: string;
      display_name: string;
      enabled: boolean;
      status: string;
      runtime: {
        success_count: number;
        failure_count: number;
        cooldown_until: string | null;
      };
    }>;
    usage?: {
      today: { requests: number; failures: number; capacity_errors: number; total_tokens: number };
      period: { requests: number; failures: number; capacity_errors: number; total_tokens: number };
    };
  };
  cron: Array<{
    jobid: number;
    jobname: string;
    active: boolean;
    last_run: { status: string; start_time: string | null } | null;
  }>;
};

export type AdminDashboardData = {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  branches: {
    total: number;
    active: number;
  };
  subscriptions: {
    active: number;
    trial: number;
    expired: number;
    suspended: number;
    pendingPayments: number;
  };
  recentActivity: Array<ActivityLog & { user?: { name?: string | null } | null }>;
  health: AdminDashboardHealth;
};

async function exactCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('الجلسة غير صالحة');

  const healthPromise = fetch(`${supabaseUrl}/functions/v1/system-health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'تعذر تحميل صحة النظام');
    }
    return result.data as AdminDashboardHealth;
  });

  const [
    usersTotal,
    usersActive,
    branchesTotal,
    branchesActive,
    subscriptionsActive,
    subscriptionsTrial,
    subscriptionsExpired,
    subscriptionsSuspended,
    pendingPayments,
    recentActivityResult,
    health,
  ] = await Promise.all([
    exactCount(supabase.from('users').select('id', { count: 'exact', head: true }).is('deleted_at', null)),
    exactCount(supabase.from('users').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true)),
    exactCount(supabase.from('branches').select('id', { count: 'exact', head: true })),
    exactCount(supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true)),
    exactCount(supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    exactCount(supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trial')),
    exactCount(supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired')),
    exactCount(supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'suspended')),
    exactCount(supabase.from('subscription_payments').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    supabase
      .from('activity_logs')
      .select('*, user:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(6),
    healthPromise,
  ]);

  if (recentActivityResult.error) throw recentActivityResult.error;

  return {
    users: {
      total: usersTotal,
      active: usersActive,
      inactive: Math.max(0, usersTotal - usersActive),
    },
    branches: {
      total: branchesTotal,
      active: branchesActive,
    },
    subscriptions: {
      active: subscriptionsActive,
      trial: subscriptionsTrial,
      expired: subscriptionsExpired,
      suspended: subscriptionsSuspended,
      pendingPayments,
    },
    recentActivity: (recentActivityResult.data || []) as AdminDashboardData['recentActivity'],
    health,
  };
}
