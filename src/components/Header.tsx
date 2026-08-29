import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BellRing, Search, X, CircleUserRound, Settings2, LogOut, Menu, WalletCards, HelpCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { supabase, Notification } from '../lib/supabase';
import { dalRead } from '../lib/dataAccessLayer';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BrandMark } from './BrandMark';
import { PAGE_TITLES } from '../config/navigation';
import { BranchSelector } from './BranchSelector';
import { HelpButton } from '../features/help/HelpButton';
import { useNotify } from '../lib/notify';
import { subscribeToPush } from '../lib/pushNotifications';

export function Header() {
  const { user, signOut }  = useAuth();
  const notify = useNotify();
  const navigate           = useNavigate();
  const location           = useLocation();
  const { sidebarCollapsed, toggleMobileMenu, closeMobileMenu } = useAppStore();

  const [searchOpen,        setSearchOpen]        = useState(false);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications,     setNotifications]     = useState<Notification[]>([]);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [profileOpen,       setProfileOpen]        = useState(false);
  const [pushSettingsSaving, setPushSettingsSaving] = useState(false);
  // يستخدم فقط لإضافة كلاس بصري (ظل/خلفية أوضح) عند التمرير — بدون أى تأثير
  // على البيانات أو المنطق
  const [scrolled,          setScrolled]           = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef      = useRef<HTMLDivElement>(null);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return PAGE_TITLES['/'];
    const key = Object.keys(PAGE_TITLES).find((k) => k !== '/' && path.startsWith(k));
    return key ? PAGE_TITLES[key] : 'CRM';
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotificationsOpen(false);
      if (profileRef.current      && !profileRef.current.contains(e.target as Node))      setProfileOpen(false);
    };
    // Escape يغلق أى قائمة منسدلة مفتوحة — سلوك متوقّع لمستخدمى الكيبورد
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setNotificationsOpen(false);
      setProfileOpen(false);
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // إغلاق الـ drawer والبحث عند تغيير الصفحة
  useEffect(() => { closeMobileMenu(); setSearchOpen(false); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // حالة بصرية فقط: الهيدر يصبح مصمتًا بظل خفيف بعد بداية التمرير حتى لا
  // يتشوّش نص الصفحة خلف الخلفية الشفافة
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // useCallback بيعتمد على `user` فقط (نفس اللي كان معلن على الـeffect تحت)،
  // فمرجعها ثابت طول ما المستخدم ثابت — الاشتراك فى القناة ما بيتعادش بناؤه.
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const result = await dalRead(
      `header:notifications:${user.id}`,
      async () => {
        const { data, error } = await supabase.from('notifications').select('*')
          .eq('user_id', user.id)
          .not('type', 'in', '(new_message,message_mention)')
          .order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        return (data as Notification[]) || [];
      },
      { emptyValue: [] as Notification[] },
    );
    // نتجاهل استبدال الحالة الحالية بقائمة فاضية أوفلاين لو فيه بيانات ظاهرة
    // بالفعل على الشاشة (لا داعي لإخفاء إشعارات كانت ظاهرة قبل انقطاع الاتصال)
    if (result.data.length > 0 || result.status === 'online') {
      setNotifications(result.data);
      setUnreadCount(result.data.filter((n) => !n.is_read).length);
    }
  }, [user]);

  // اتنقل تحت تعريف fetchNotifications عشان يقدر يعلنها كـdependency صحيحة
  // (مرجعها مستقر بفضل useCallback فوق، فالقناة ما بتتبنى من جديد بلا داعٍ).
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // نشترك في INSERT (إشعار جديد) وUPDATE (تعليم كمقروء من جهاز/تبويب آخر) عشان الحالة تتزامن لحظياً بدون أي تحديث يدوي للصفحة
    const ch = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchNotifications)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchNotifications)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchNotifications]);

  const markAsRead    = async (id: string) => { await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id); fetchNotifications(); };
  const markAllAsRead = async () => { if (!user) return; await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false); fetchNotifications(); };

  // تحديد الصفحة المرتبطة بالإشعار (إن وجدت) بالاعتماد على نفس المسارات القائمة في التطبيق
  const getNotificationLink = (n: Notification): string | null => {
    switch (n.entity_type) {
      case 'policy':         return n.entity_id ? `/policies/${n.entity_id}` : '/policies';
      case 'customer':       return '/customers';
      case 'installment':    return '/collection';
      case 'user':           return '/users';
      case 'monthly_closing':return '/monthly-closing';
      default:                return null;
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    setNotificationsOpen(false);
    const link = getNotificationLink(n);
    if (link) navigate(link);
  };

  const handlePushSettings = async () => {
    if (!user || pushSettingsSaving) return;
    setProfileOpen(false);
    setPushSettingsSaving(true);
    const result = await subscribeToPush(user.id);
    setPushSettingsSaving(false);

    if (result.status === 'subscribed') {
      notify.success('تم تفعيل إشعارات الهاتف لهذا الجهاز');
    } else if (result.status === 'needs-install') {
      notify.error('على iPhone ثبّت التطبيق على الشاشة الرئيسية أولًا ثم فعّل الإشعارات');
    } else if (result.status === 'denied') {
      notify.error('الإشعارات مرفوضة. افتح إعدادات الموقع في المتصفح واختر السماح بالإشعارات');
    } else if (result.status === 'unsupported') {
      notify.error('هذا المتصفح لا يدعم إشعارات الهاتف');
    } else if (result.status === 'error') {
      notify.error(result.message);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) { navigate(`/customers?search=${encodeURIComponent(searchQuery.trim())}`); setSearchOpen(false); setSearchQuery(''); }
  };

  const getNotifColor = (type: string) => {
    if (['due_today','due_this_week','month_closing_upcoming'].includes(type)) return 'bg-warning-100 text-warning-600';
    if (['overdue','policy_suspended','policy_cancelled','payment_cancelled','user_disabled','user_deleted','subscription_rejected','subscription_expired'].includes(type)) return 'bg-error-100 text-error-600';
    if (['payment_received','policy_reactivated','user_enabled','month_closing_completed','subscription_approved'].includes(type)) return 'bg-success-100 text-success-600';
    return 'bg-info-100 text-info-600';
  };

  if (!user) return null;

  return (
    <>
      {/* ===========================  HEADER BAR  =========================== */}
      <header className={clsx(
        'app-header fixed top-0 left-0 right-0 h-14 md:h-16 z-30',
        'flex items-center gap-2 px-2 md:px-4 transition-all duration-300',
        'print:hidden',
        scrolled && 'is-scrolled',
        sidebarCollapsed ? 'md:mr-20' : 'md:mr-64'
      )}>
        {/* ===== يمين (بداية السطر فى RTL): القائمة ثم عنوان الصفحة =====
            الأولوية على الموبايل: زر القائمة ← عنوان الصفحة ← أدوات (بحث/إشعارات) */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button onClick={toggleMobileMenu} aria-label="فتح القائمة" className="icon-button md:hidden flex-shrink-0">
            <Menu className="w-[22px] h-[22px]" />
          </button>
          <BrandMark className="w-6 h-6 md:hidden flex-shrink-0" />
          <div className="min-w-0 flex items-baseline gap-2">
            <h1 className="truncate">{getPageTitle()}</h1>
            <span className="hidden lg:inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700">
              لوحة التشغيل
            </span>
          </div>
        </div>

        {/* ===== يسار: الأدوات ===== */}
        <div className="flex items-center gap-0.5 md:gap-1.5 flex-shrink-0">

          {/* سلكتور الفرع — يظهر بس للمستخدمين اللي عندهم أكتر من فرع */}
          <BranchSelector />

          {/* بحث — على الديسكتوب حقل مدمج؛ وعلى الموبايل يفتح شريط بحث
              بعرض الشاشة كاملة (مساحة كتابة مريحة بدل حقل ضيق) */}
          {searchOpen ? (
            <form
              onSubmit={handleSearch}
              className={clsx(
                'flex items-center gap-1.5',
                'absolute inset-x-2 top-1/2 -translate-y-1/2 z-10 bg-white rounded-xl',
                'md:static md:inset-auto md:translate-y-0 md:bg-transparent'
              )}
            >
              <div className="relative flex-1 md:w-64 md:flex-none">
                <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن عميل..." className="input-field !min-h-10 pr-9 text-sm" autoFocus />
              </div>
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="إغلاق البحث" className="icon-button flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <button data-tour-id="header-search" onClick={() => setSearchOpen(true)} aria-label="البحث" className="icon-button">
              <Search className="w-[22px] h-[22px]" />
            </button>
          )}

          {/* مساعدة الصفحة الحالية (؟) — يظهر أعلى كل صفحة بالتطبيق */}
          <HelpButton />

          {/* إشعارات */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              data-tour-id="header-notifications"
              aria-haspopup="menu"
              aria-expanded={notificationsOpen}
              aria-label={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروءة` : 'الإشعارات'}
              className="icon-button relative"
            >
              <BellRing className="w-[22px] h-[22px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 left-1 min-w-[17px] h-[17px] px-1 bg-error-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="dropdown-menu w-[calc(100vw-1.5rem)] max-w-[22rem] sm:w-80 overflow-hidden left-0 right-auto !py-0">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-secondary-200">
                  <span className="section-heading">الإشعارات</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline">
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-[min(60dvh,20rem)] scrollbar-thin">
                  {notifications.length === 0
                    ? (
                      <div className="empty-state !py-8">
                        <span className="empty-state-icon !w-11 !h-11"><BellRing className="w-5 h-5" /></span>
                        <p className="empty-state-title">لا توجد إشعارات</p>
                        <p className="empty-state-desc">أى تحديث مهم على الوثائق أو التحصيل هيظهر هنا</p>
                      </div>
                    )
                    : notifications.map((n) => (
                      <button key={n.id} onClick={() => handleNotificationClick(n)}
                        className={clsx(
                          'w-full text-right px-3.5 py-3 border-b border-secondary-100 last:border-0 transition-colors',
                          'hover:bg-secondary-50',
                          !n.is_read && 'bg-primary-50/50'
                        )}>
                        <div className="flex items-start gap-2.5">
                          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', getNotifColor(n.type))}>
                            <BellRing className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-secondary-900 leading-snug">{n.title}</p>
                            <p className="text-xs text-secondary-600 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                            <p className="text-[10px] font-semibold text-secondary-400 mt-1">{format(new Date(n.created_at), 'dd MMM, HH:mm', { locale: ar })}</p>
                          </div>
                          {/* مؤشر "غير مقروء" — لا نعتمد على اللون وحده */}
                          {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-600 flex-shrink-0" aria-label="غير مقروء" />}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* بروفايل */}
          <div className="relative" ref={profileRef}>
            <button onClick={() => setProfileOpen(!profileOpen)} aria-label="فتح قائمة الحساب" aria-haspopup="menu" aria-expanded={profileOpen} data-tour-id="header-profile" className="flex min-h-11 items-center gap-2 rounded-xl p-1 pl-1.5 transition-colors hover:bg-secondary-100">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-primary-200">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-full object-cover" loading="lazy" decoding="async" />
                  : <span className="text-primary-700 font-bold text-sm">{user.name.charAt(0)}</span>}
              </div>
              <div className="hidden lg:block text-right max-w-[10rem]">
                <p className="text-[13px] font-bold text-secondary-900 leading-tight truncate">{user.name}</p>
                <p className="text-[11px] font-semibold text-secondary-500 leading-tight truncate">{ROLE_LABELS[user.role]}</p>
              </div>
            </button>
            {profileOpen && (
              <div className="dropdown-menu left-0 right-auto min-w-[13rem]">
                {/* بطاقة هوية المستخدم أعلى القائمة — تظهر على الموبايل حيث
                    الاسم غير ظاهر بجوار الصورة */}
                <div className="lg:hidden px-3.5 pt-2 pb-2.5 mb-1 border-b border-secondary-200">
                  <p className="text-sm font-bold text-secondary-900 truncate">{user.name}</p>
                  <p className="text-[11px] font-semibold text-secondary-500 mt-0.5 truncate">{ROLE_LABELS[user.role]}</p>
                </div>
                <button onClick={() => { setProfileOpen(false); navigate('/profile'); }} className="dropdown-item w-full"><CircleUserRound className="w-4 h-4" /><span>الملف الشخصي</span></button>
                <button onClick={handlePushSettings} disabled={pushSettingsSaving} className="dropdown-item w-full disabled:opacity-60">
                  {pushSettingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                  <span>{pushSettingsSaving ? 'جارٍ ضبط الإشعارات...' : 'ضبط إشعارات الهاتف'}</span>
                </button>
                <button onClick={() => { setProfileOpen(false); navigate('/help'); }} className="dropdown-item w-full"><HelpCircle className="w-4 h-4" /><span>دليل المستخدم</span></button>
                {user.role === 'super_admin' && (
                  <button onClick={() => { setProfileOpen(false); navigate('/subscriptions-admin'); }} className="dropdown-item w-full"><WalletCards className="w-4 h-4" /><span>الاشتراكات</span></button>
                )}
                {user.role === 'super_admin' && (
                  <button onClick={() => { setProfileOpen(false); navigate('/settings'); }} className="dropdown-item w-full"><Settings2 className="w-4 h-4" /><span>إعدادات النظام</span></button>
                )}
                <hr className="my-1 border-secondary-200" />
                <button onClick={() => { setProfileOpen(false); signOut(); }} className="dropdown-item w-full text-error-600"><LogOut className="w-4 h-4" /><span>تسجيل الخروج</span></button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
