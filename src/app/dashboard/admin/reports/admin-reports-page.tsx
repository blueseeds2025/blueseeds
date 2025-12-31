import { RoleGuard } from '@/components/RoleGuard';
import { WeeklyReportClient } from './WeeklyReportClient';

export default function AdminReportsPage() {
  return (
    <RoleGuard allowedRoles={['owner']}>
      <div className="p-6 max-w-6xl mx-auto">
        <WeeklyReportClient />
      </div>
    </RoleGuard>
  );
}
