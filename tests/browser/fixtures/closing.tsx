import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import { PrintReport } from '../../../src/pages/MonthlyClosing/components/PrintReport';
import type { PrintDetailRow, SupervisorAgg } from '../../../src/pages/MonthlyClosing/types';

// Render the real report under the same animated containers as App/MonthlyClosing.
// No authentication, production records, queries or payment writes are involved.
const supervisor: SupervisorAgg = {
  id: 's', name: 'مراقب تجريبي', role: 'supervisor',
  groupLeaders: [{ id: 'g', name: 'رئيس مجموعة', production: 100000, collection: 100000, total: 200000 }],
  production: 100000, collection: 100000, total: 200000,
  directGroupLeaderCount: 3, target: 120000, achievementRate: 166.7,
};
const rows: PrintDetailRow[] = Array.from({ length: 20 }, (_, index) => ({
  supervisorName: supervisor.name, supervisorRole: 'supervisor',
  groupLeaderName: 'رئيس مجموعة', agentName: 'وكيل تجريبي',
  customerName: `عميل تجريبي ${index + 1}`, policyNumber: `7010150696${219 + index}`,
  installmentNumber: index + 1, amount: 10000, type: index < 10 ? 'new' : 'collection',
}));
if (new URLSearchParams(location.search).has('dark')) document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <div className="app-shell min-h-screen min-h-[100dvh] bg-secondary-50">
    <header>واجهة التطبيق — لا تُطبع</header>
    <main className="app-main px-3 pt-14">
      <div className="app-content w-full max-w-[96rem] mx-auto mt-4 md:mt-6 animate-pageEnter">
        <div className="workspace-page workspace-page-monthly-closing space-y-6 animate-fadeIn">
          <div>شاشة الإقفال — لا تُطبع</div>
          <PrintReport
            supervisorName="مدير تجريبي" supervisorRoleLabel="مدير تطوير"
            monthLabel="أكتوبر 2026" closingDate="26/10/2026" branchName="فرع تجريبي"
            printSupervisors={[supervisor]} printDetailRows={rows}
            grandProduction={100000} grandCollection={100000} grandTotal={200000}
            formationUsers={[{ id: 'new-agent', name: 'وكيل جديد', role: 'agent', managerName: 'رئيس مجموعة' }]}
            formationDate="01/10/2026"
          />
        </div>
      </div>
    </main>
  </div>,
);
