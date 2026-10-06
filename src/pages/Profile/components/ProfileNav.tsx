import { User, Lock, CreditCard } from 'lucide-react';
import clsx from 'clsx';

interface ProfileNavProps {
  activeTab: 'personal' | 'security' | 'subscription';
  setActiveTab: (tab: 'personal' | 'security' | 'subscription') => void;
  canSeeSubscription: boolean;
}

export function ProfileNav({ activeTab, setActiveTab, canSeeSubscription }: ProfileNavProps) {
  return (
    <div className="card profile-section-nav p-2">
      <button
        aria-pressed={activeTab === 'personal'} onClick={() => setActiveTab('personal')}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium',
          activeTab === 'personal' ? 'bg-primary-600 text-white shadow-sm' : 'text-secondary-600 hover:bg-secondary-50'
        )}
      >
        <User className="w-5 h-5" />
        المعلومات الشخصية
      </button>
      <button
        aria-pressed={activeTab === 'security'} onClick={() => setActiveTab('security')}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium mt-1',
          activeTab === 'security' ? 'bg-primary-600 text-white shadow-sm' : 'text-secondary-600 hover:bg-secondary-50'
        )}
      >
        <Lock className="w-5 h-5" />
        الأمان وكلمة المرور
      </button>
      {canSeeSubscription && (
        <button
          aria-pressed={activeTab === 'subscription'} onClick={() => setActiveTab('subscription')}
          className={clsx(
            'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium mt-1',
            activeTab === 'subscription' ? 'bg-primary-600 text-white shadow-sm' : 'text-secondary-600 hover:bg-secondary-50'
          )}
        >
          <CreditCard className="w-5 h-5" />
          الاشتراك
        </button>
      )}
    </div>
  );
}
