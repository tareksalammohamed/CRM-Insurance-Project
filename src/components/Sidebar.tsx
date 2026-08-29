import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { useSettings } from '../hooks/useSettings';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { BrandMark } from './BrandMark';
import { getBottomNavItems, getVisibleNavLayout, type NavGroup, type NavLayoutEntry, type NavItem } from '../config/navigation';
import clsx from 'clsx';

function isPathActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/';
  return pathname.startsWith(path);
}

export function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const {
    sidebarCollapsed, toggleSidebar,
    expandedSections, toggleSection, setSectionExpanded,
    mobileMenuOpen, openMobileMenu, closeMobileMenu,
  } = useAppStore();
  const { branding } = useSettings();

  const navLayout: NavLayoutEntry[] = user ? getVisibleNavLayout(user.role) : [];
  const bottomNavItems: NavItem[] = user ? getBottomNavItems(user.role) : [];

  // فتح القسم الذى يحتوي الصفحة الحالية تلقائياً عند كل تنقل، مع الحفاظ على
  // اختيار المستخدم اليدوي لباقي الأقسام (لا نعيد إغلاق أي قسم آخر فتحه بنفسه)
  useEffect(() => {
    const activeGroupEntry = navLayout.find(
      (entry) => entry.kind === 'group' && entry.group.items.some((item) => isPathActive(location.pathname, item.path))
    );
    if (activeGroupEntry && activeGroupEntry.kind === 'group') setSectionExpanded(activeGroupEntry.group.key, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.role]);

  // إغلاق الدرج تلقائياً عند تغيير الصفحة
  useEffect(() => { closeMobileMenu(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const isSectionExpanded = (key: string) => expandedSections[key] ?? true;

  // فلترة bottom nav الرئيسي (يعتمد على الدرجة الوظيفية — انظر getBottomNavItems)
  const isMoreActive = !bottomNavItems.some((item) => isPathActive(location.pathname, item.path));

  return (
    <div className="print:hidden">
      {/* =============================================
          DESKTOP SIDEBAR  (md وأكبر)
      ============================================= */}
      <aside
        className={clsx(
          'app-sidebar fixed top-0 right-0 h-full z-40',
          'transition-all duration-300 flex flex-col',
          'hidden md:flex',
          // العرض من متغيرات CSS (مصدر واحد): tablet مدمج → desktop زيادة بسيطة
          // حتى يظهر اسم الشركة كاملًا بدون قص
          sidebarCollapsed ? 'w-[var(--sidebar-w-collapsed)]' : 'w-[var(--sidebar-w)]'
        )}
      >
        <div
          data-tour-id="sidebar-brand"
          className={clsx(
          'sidebar-brand flex items-center min-h-16 py-2 px-3 flex-shrink-0',
          sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'
        )}>
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandMark className="w-9 h-9 flex-shrink-0" />
              {/* اسم الشركة يظهر كاملًا دائمًا — يُسمح له بالالتفاف على سطرين
                  بشكل أنيق بدل القص بالـ ellipsis */}
              <span className="font-extrabold text-[13.5px] lg:text-[14px] text-secondary-900 leading-[1.35] tracking-tight break-words min-w-0">
                {branding.company_name}
              </span>
            </div>
          ) : (
            <BrandMark className="w-9 h-9" />
          )}

          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-secondary-100 active:bg-secondary-200 transition-colors flex-shrink-0"
              title="طي القائمة"
              aria-label="طي القائمة"
            >
              <ChevronRight className="w-[18px] h-[18px] text-secondary-400" />
            </button>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="px-3 pt-3">
            <ConnectionStatusBadge variant="card" />
          </div>
        )}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="mx-auto mt-3 flex items-center justify-center w-9 h-9 rounded-lg hover:bg-secondary-100 active:bg-secondary-200 transition-colors"
            title="توسيع القائمة"
            aria-label="توسيع القائمة"
          >
            <ChevronLeft className="w-[18px] h-[18px] text-secondary-400" />
          </button>
        )}

        <Link
          to="/profile"
          className={clsx(
            'pressable mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-secondary-200 bg-secondary-50',
            'hover:bg-primary-50 hover:border-primary-200 transition-colors duration-150',
            sidebarCollapsed ? 'justify-center p-2 border-transparent bg-transparent' : 'p-2.5'
          )}
          title="الانتقال للملف الشخصي"
        >
          <div className="w-9 h-9 rounded-full bg-primary-100 ring-1 ring-primary-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-full object-cover" loading="lazy" decoding="async" />
              : <span className="text-primary-700 font-bold text-sm">{user.name.charAt(0)}</span>
            }
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-secondary-900 truncate leading-tight">{user.name}</p>
              <p className="text-[11px] font-semibold text-secondary-500 truncate mt-0.5">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
        </Link>

        {/* روابط التنقل — مقسّمة إلى أقسام قابلة للطي/الفتح */}
        <div data-tour-id="sidebar-nav" className="flex-1 overflow-y-auto py-3 px-2.5 mt-1 scrollbar-thin">
          {sidebarCollapsed ? (
            // فى وضع الطي (أيقونات فقط) نعرض كل الصفحات فى قائمة واحدة مسطحة
            <nav className="space-y-1">
              {navLayout.flatMap((entry) => (entry.kind === 'group' ? entry.group.items : [entry.item])).map((item) => {
                const Icon = item.icon;
                const active = isPathActive(location.pathname, item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'sidebar-collapsed-nav-row flex items-center justify-center h-11 px-0 rounded-xl transition-all duration-200',
                      active ? 'sidebar-collapsed-nav-row-active text-primary-700' : 'text-secondary-500 hover:bg-secondary-50'
                    )}
                    title={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon strokeWidth={active ? 2.2 : 1.8} className={clsx('w-[19px] h-[19px] flex-shrink-0', active ? 'text-primary-600' : 'text-secondary-400')} />
                  </Link>
                );
              })}
            </nav>
          ) : (
            <nav className="space-y-1">
              {navLayout.map((entry) =>
                entry.kind === 'group' ? (
                  <NavGroupSection
                    key={entry.group.key}
                    group={entry.group}
                    expanded={isSectionExpanded(entry.group.key)}
                    onToggle={() => toggleSection(entry.group.key)}
                    pathname={location.pathname}
                  />
                ) : (
                  <StandaloneNavLink key={entry.item.path} item={entry.item} pathname={location.pathname} />
                )
              )}
            </nav>
          )}
        </div>

        <div className="border-t border-secondary-200 p-2.5">
          <button
            onClick={signOut}
            title="تسجيل الخروج"
            className={clsx(
              'flex items-center h-11 gap-2.5 w-full px-3 rounded-xl text-[13px] font-bold',
              'text-error-600 hover:bg-error-50 active:bg-error-100 transition-colors duration-200',
              sidebarCollapsed && 'justify-center px-0'
            )}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!sidebarCollapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* =============================================
          MOBILE BOTTOM NAVIGATION  (أصغر من md) — يعتمد على الدرجة الوظيفية
      ============================================= */}
      <nav
        aria-label="التنقل السريع"
        className="mobile-bottom-nav md:hidden fixed bottom-0 right-0 left-0 z-40 safe-area-bottom"
      >
        <div className="flex items-stretch justify-around px-0.5 pb-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isPathActive(location.pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'mobile-nav-item pressable flex flex-col items-center justify-center gap-1 px-0.5 pt-2 pb-1 rounded-xl flex-1 min-w-0',
                  'transition-colors duration-200',
                  active && 'is-active'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <div className="flex items-center justify-center h-7 px-2.5 rounded-lg transition-all duration-200">
                  <Icon strokeWidth={active ? 2.2 : 1.8} className="w-[21px] h-[21px]" />
                </div>
                <span className="text-[10px] font-bold leading-none truncate max-w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* زر المزيد — يفتح Drawer بكل صفحات التطبيق منظمة داخل الأقسام الأربعة */}
          <button
            onClick={openMobileMenu}
            aria-label="المزيد من الصفحات"
            className={clsx(
              'mobile-nav-item pressable flex flex-col items-center justify-center gap-1 px-0.5 pt-2 pb-1 rounded-xl flex-1 min-w-0',
              'transition-colors duration-200',
              isMoreActive && 'is-active'
            )}
          >
            <div className="flex items-center justify-center h-7 px-2.5 rounded-lg transition-all duration-200">
              <Menu strokeWidth={isMoreActive ? 2.2 : 1.8} className="w-[21px] h-[21px]" />
            </div>
            <span className="text-[10px] font-bold leading-none truncate max-w-full">
              المزيد
            </span>
          </button>
        </div>
      </nav>

      {/* =============================================
          MOBILE FULL NAVIGATION DRAWER
          (يفتحه زر "المزيد" فى Bottom Nav أو زر ☰ فى الـ Header)
      ============================================= */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={closeMobileMenu}>
          <div className="absolute inset-0 bg-secondary-900/45 backdrop-blur-[2px] animate-fadeIn" />
          <div
            className="relative w-[76vw] min-w-[15.5rem] max-w-[19.5rem] h-full bg-white flex flex-col shadow-overlay animate-slideIn ml-auto mr-0 rounded-l-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس الدرج بلون الهوية العميق — يثبّت شعار الشركة واسمها */}
            <div className="relative flex items-center justify-between gap-2 px-3.5 min-h-[4.25rem] py-2.5 bg-primary-900 flex-shrink-0 overflow-hidden">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, rgb(197 237 88 / 0.16), transparent 55%)' }}
              />
              <div className="relative flex items-center gap-2.5 min-w-0">
                {branding.company_logo_url
                  ? <img src={branding.company_logo_url} alt={branding.company_name} className="w-9 h-9 rounded-xl object-contain bg-white/12 ring-1 ring-white/20 p-1 flex-shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : <div className="w-9 h-9 rounded-xl bg-white/12 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0"><BrandMark className="w-[22px] h-[22px]" /></div>}
                <span className="text-white font-extrabold text-[12.5px] leading-[1.4] tracking-tight break-words min-w-0">{branding.company_name}</span>
              </div>
              <button
                onClick={closeMobileMenu}
                aria-label="إغلاق القائمة"
                className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/12 hover:bg-white/20 active:bg-white/28 transition-colors flex-shrink-0"
              >
                <X className="w-[18px] h-[18px] text-white" />
              </button>
            </div>

            <div className="px-3 pt-2.5">
              <ConnectionStatusBadge variant="card" />
            </div>

            <Link
              to="/profile"
              onClick={closeMobileMenu}
              className="pressable mx-3 mt-2.5 flex items-center gap-2.5 p-2.5 rounded-2xl bg-secondary-50 border border-secondary-200 hover:bg-primary-50 hover:border-primary-200 active:scale-[0.99] transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 ring-1 ring-primary-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" />
                  : <span className="text-primary-700 font-bold text-sm">{user.name.charAt(0)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-secondary-900 text-[13px] truncate">{user.name}</p>
                <span className="badge badge-primary mt-0.5">{ROLE_LABELS[user.role]}</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-secondary-300 flex-shrink-0" />
            </Link>

            <nav className="flex-1 overflow-y-auto py-2.5 px-2.5 mt-1 space-y-1 scrollbar-thin">
              {navLayout.map((entry) =>
                entry.kind === 'group' ? (
                  <NavGroupSection
                    key={entry.group.key}
                    group={entry.group}
                    expanded={isSectionExpanded(entry.group.key)}
                    onToggle={() => toggleSection(entry.group.key)}
                    pathname={location.pathname}
                    onNavigate={closeMobileMenu}
                  />
                ) : (
                  <StandaloneNavLink key={entry.item.path} item={entry.item} pathname={location.pathname} onNavigate={closeMobileMenu} />
                )
              )}
            </nav>

            <div className="border-t border-secondary-200 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex-shrink-0">
              <button
                onClick={() => { closeMobileMenu(); signOut(); }}
                className="pressable flex items-center h-11 gap-2.5 w-full px-2.5 rounded-xl text-[13px] font-bold text-error-600 hover:bg-error-50 active:bg-error-100 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-error-50 flex-shrink-0">
                  <LogOut className="w-4 h-4" />
                </span>
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// قسم واحد قابل للطي/الفتح داخل الـ Sidebar (سطح المكتب فقط — فى درج
// الموبايل يظهر كل قسم مفتوحاً دائماً لتقليل عدد الضغطات للوصول لأي صفحة)
// ============================================================================
function NavGroupSection({
  group, expanded, onToggle, pathname, onNavigate,
}: {
  group: NavGroup;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate?: () => void;
}) {
  const GroupIcon = group.icon;

  return (
    <div className="pb-1.5">
      <button
        onClick={onToggle}
        className="sidebar-group-toggle flex items-center justify-between w-full h-8 px-2.5 rounded-lg transition-colors duration-150"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider">
          <GroupIcon strokeWidth={2.2} className="w-3.5 h-3.5" />
          {group.label}
        </span>
        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', expanded ? 'rotate-0' : '-rotate-90')} />
      </button>

      <div className={clsx('grid transition-all duration-200 ease-in-out', expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <div className="space-y-0.5 pt-1">
            {group.items.map((item) => (
              <NavLinkRow key={item.path} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// صف رابط تنقل واحد — أيقونة داخل حاوية دائرية (chip) بدل أيقونة عارية، مع
// شريط تمييز جانبي وخلفية متدرجة خفيفة للعنصر النشط. نفس المكوّن يُستخدم فى
// كل من NavGroupSection وStandaloneNavLink حتى يبقى شكل كل الروابط متطابقًا
// ============================================================================
function NavLinkRow({
  item, pathname, onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isPathActive(pathname, item.path);
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
        className={clsx(
          'sidebar-nav-row pressable relative flex items-center h-11 gap-2.5 pr-2 pl-2.5 rounded-xl text-[13px] transition-all duration-200',
          active
            ? 'sidebar-nav-row-active font-bold'
            : 'text-secondary-600 font-semibold hover:bg-secondary-50 hover:text-secondary-900'
        )}
        aria-current={active ? 'page' : undefined}
      >
      {/* مؤشر جانبي للعنصر النشط — تمييز لا يعتمد على اللون وحده */}
      {active && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary-600" aria-hidden="true" />
      )}
      <span
        className={clsx(
          'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors',
          active ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-500'
        )}
      >
        <Icon strokeWidth={active ? 2.2 : 1.8} className="w-[17px] h-[17px]" />
      </span>
      <span className="flex items-baseline gap-1.5 min-w-0 truncate">
        <span className="truncate">{item.label}</span>
        {item.subLabel && (
          <span className="text-[10px] font-semibold text-secondary-400 truncate">{item.subLabel}</span>
        )}
      </span>
    </Link>
  );
}

// ============================================================================
// رابط مستقل خارج أي قسم (مثل "حاسبة الأسعار") — يظهر بين قسمين مباشرة بدون
// عنوان قسم وبدون طي/فتح، بنفس شكل روابط الأقسام تماماً لثبات التصميم
// ============================================================================
function StandaloneNavLink({
  item, pathname, onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="pb-1">
      <NavLinkRow item={item} pathname={pathname} onNavigate={onNavigate} />
    </div>
  );
}