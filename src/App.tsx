import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BranchProvider } from './lib/branchContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HeadManager } from './components/HeadManager';
import { Login } from './pages/Login';
import { useAppStore } from './store/appStore';
import clsx from 'clsx';
import { fetchLockState, type SubscriptionLockState } from './features/subscriptions/services/subscriptionService';
import { SubscriptionLockScreen } from './features/subscriptions/components/SubscriptionLockScreen';
import { OfflineToast } from './components/OfflineToast';
import { NotifyProvider } from './lib/notify';
import { initOfflineSync, stopOfflineSync } from './lib/offlineSync';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireRole } from './components/RequireRole';
import { isNotAgent, canAccessDailyReports } from './config/navigation';
import { canManageUsers, canViewOrgStructure, canViewSettings, canViewMonthlyClosing, canManageBranches, canManageAI } from './lib/supabase';
import { HelpProvider } from './features/help/HelpContext';
import { HelpPanel } from './features/help/HelpPanel';
import { Tour } from './features/help/Tour';
import { useFirstRunTour } from './features/help/useFirstRunTour';
import { UpdateAvailablePrompt } from './components/UpdateAvailablePrompt';
import { PushNotificationPrompt } from './components/PushNotificationPrompt';



const Dashboard    = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Customers    = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Policies     = lazy(() => import('./pages/Policies').then(m => ({ default: m.Policies })));
const PolicyDetail = lazy(() => import('./pages/PolicyDetail').then(m => ({ default: m.PolicyDetail })));
const Collection   = lazy(() => import('./pages/Collection').then(m => ({ default: m.Collection })));
const Commissions  = lazy(() => import('./pages/Commissions').then(m => ({ default: m.Commissions })));
const Users        = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Reports      = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const MonthlyClosing = lazy(() => import('./pages/MonthlyClosing').then(m => ({ default: m.MonthlyClosing })));
const Cancellations = lazy(() => import('./pages/Cancellations').then(m => ({ default: m.Cancellations })));
const OrgStructure  = lazy(() => import('./pages/OrgStructure').then(m => ({ default: m.OrgStructure })));
const ActivityLog  = lazy(() => import('./pages/ActivityLog').then(m => ({ default: m.ActivityLog })));
const DataImport   = lazy(() => import('./pages/DataImport').then(m => ({ default: m.DataImport })));
const Profile      = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Settings     = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const SubscriptionsAdminPage = lazy(() => import('./features/subscriptions/pages/SubscriptionsAdminPage').then(m => ({ default: m.SubscriptionsAdminPage })));
const BranchesAdminPage = lazy(() => import('./features/branches/pages/BranchesAdminPage').then(m => ({ default: m.BranchesAdminPage })));
const AISettingsPage = lazy(() => import('./features/aiSettings/pages/AISettingsPage').then(m => ({ default: m.AISettingsPage })));
const PriceCalculator = lazy(() => import('./pages/PriceCalculator').then(m => ({ default: m.PriceCalculator })));
const DailyReports   = lazy(() => import('./pages/DailyReports').then(m => ({ default: m.DailyReports })));
const HelpCenterPage = lazy(() => import('./features/help/HelpCenterPage'));

/**
 * هيكل تحميل عام لصفحات الـlazy loading — يحاكى شكل الصفحة الحقيقى
 * (رأس + شبكة مؤشرات + قائمة) بدل الـspinner المجرد، فالتطبيق يبان أسرع
 * وأقل "قفزة" بصرية لحظة ظهور المحتوى.
 */
function LoadingSpinner() {
  return (
    <div className="space-y-5" role="status" aria-label="جارٍ تحميل الصفحة">
      <div className="space-y-2">
        <div className="h-3 w-24 skeleton-bar" />
        <div className="h-7 w-52 skeleton-bar" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi-card">
            <div className="flex items-start justify-between gap-3">
              <div className="h-3 w-16 skeleton-bar" />
              <div className="h-10 w-10 skeleton-bar !rounded-xl" />
            </div>
            <div className="h-7 w-20 skeleton-bar mt-3" />
          </div>
        ))}
      </div>
      <div className="card space-y-3">
        <div className="h-4 w-32 skeleton-bar" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-full skeleton-bar" />
        ))}
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { sidebarCollapsed }   = useAppStore();
  const location = useLocation();
  const [lockState, setLockState] = useState<SubscriptionLockState | null>(null);
  const [checkingLock, setCheckingLock] = useState(true);
  useFirstRunTour();

  useEffect(() => {
    if (!user) {
      setCheckingLock(false);
      return;
    }
    setCheckingLock(true);
    fetchLockState()
      .then(setLockState)
      .finally(() => setCheckingLock(false));
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      initOfflineSync(user.id);
    } else {
      stopOfflineSync();
    }
  }, [user?.id]);

  if (loading || (user && checkingLock)) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-secondary-50" role="status" aria-label="جارٍ التحميل">
        <div className="animate-spin rounded-full h-9 w-9 border-2 border-secondary-200 border-t-primary-600" />
        <p className="text-xs font-bold text-secondary-500">جارٍ التحميل...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  if (lockState?.is_locked) {
    return (
      <SubscriptionLockScreen
        user={user}
        status={lockState.status}
        periodEnd={lockState.period_end}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className="app-shell min-h-screen min-h-[100dvh] bg-secondary-50">
      {/* تخطّى عناصر التنقّل المتكرّرة (الهيدر/القائمة) للوصول مباشرة للمحتوى — لمستخدمى الكيبورد وقارئات الشاشة */}
      <a href="#main-content" className="skip-link">تخطَّ إلى المحتوى الرئيسى</a>
      <Sidebar />
      <Header />
      <PushNotificationPrompt />

      <main id="main-content" tabIndex={-1} className={clsx(
        'transition-all duration-300 focus:outline-none',
        // ===== Desktop: يتحرك مع الـ sidebar =====
        sidebarCollapsed ? 'md:mr-20' : 'md:mr-64',
        // ===== Mobile: padding top للـ header + bottom للـ bottom nav =====
        'pt-14 md:pt-16',
        // مساحة أسفل الصفحة تكفى Bottom Navigation + المنطقة الآمنة للأجهزة
        // ذات الـhome indicator، حتى لا يُحجب آخر عنصر فى أى صفحة
        'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10',
        // padding أفقي مدمج على 320px ويتوسّع تدريجيًا
        'app-main px-3 sm:px-4 md:px-6 lg:px-8'
      )}>
        <div key={location.pathname} className="app-content max-w-7xl mx-auto mt-4 md:mt-6 animate-pageEnter">
          <ErrorBoundary boundaryName={location.pathname}>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/"                element={<Dashboard />} />
                <Route path="/customers"       element={<Customers />} />
                <Route path="/policies"        element={<Policies />} />
                <Route path="/policies/:id"    element={<PolicyDetail />} />
                <Route path="/collection"      element={<Collection />} />
                <Route path="/commissions"     element={<Commissions />} />
                <Route path="/users"           element={<RequireRole check={canManageUsers}><Users /></RequireRole>} />
                <Route path="/reports"         element={<RequireRole check={isNotAgent}><Reports /></RequireRole>} />
                <Route path="/monthly-closing" element={<RequireRole check={canViewMonthlyClosing}><MonthlyClosing /></RequireRole>} />
                <Route path="/cancellations"   element={<Cancellations />} />
                <Route path="/org-structure"   element={<RequireRole check={canViewOrgStructure}><OrgStructure /></RequireRole>} />
                <Route path="/activity-log"    element={<RequireRole check={isNotAgent}><ActivityLog /></RequireRole>} />
                <Route path="/data-import"     element={<RequireRole check={isNotAgent}><DataImport /></RequireRole>} />
                <Route path="/profile"         element={<Profile />} />
                <Route path="/subscriptions-admin" element={<RequireRole check={canViewSettings}><SubscriptionsAdminPage /></RequireRole>} />
                <Route path="/branches"        element={<RequireRole check={canManageBranches}><BranchesAdminPage /></RequireRole>} />
                <Route path="/settings"        element={<RequireRole check={canViewSettings}><Settings /></RequireRole>} />
                <Route path="/ai-settings"     element={<RequireRole check={canManageAI}><AISettingsPage /></RequireRole>} />
                <Route path="/price-calculator" element={<PriceCalculator />} />
                <Route path="/daily-reports"    element={<RequireRole check={canAccessDailyReports}><DailyReports /></RequireRole>} />
                <Route path="/help"             element={<HelpCenterPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <div className="print:hidden">
        <OfflineToast />
        <HelpPanel />
        <Tour />
      </div>
    </div>
  );
}

function App() {
  return (
    <NotifyProvider>
      <UpdateAvailablePrompt />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary boundaryName="root">
            <AuthProvider>
              <BranchProvider>
                <HeadManager />
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/*"     element={<HelpProvider><AppLayout /></HelpProvider>} />
                </Routes>
              </BranchProvider>
            </AuthProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </NotifyProvider>
  );
}

export default App;
