'use client';
import { Toaster } from 'sonner'; 
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Users, 
  Calendar, 
  Bell, 
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Package,
  UserX,
  GraduationCap,
  School
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, display_name')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUserRole(profile.role);
          setUserName(profile.display_name);
        }
      }
    };
    getUserInfo();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const menuItems = [
    { 
      icon: Home, 
      label: '대시보드', 
      href: userRole === 'owner' ? '/dashboard/admin' : '/dashboard/teacher',
      show: true 
    },
    { 
      icon: Settings,  
      label: '피드 설정', 
      href: '/dashboard/admin/feed-settings',
      show: userRole === 'owner'
    },
    { 
      icon: FileText, 
      label: '피드 입력', 
      href: '/dashboard/feeds',
      show: true 
    },
    { 
      icon: UserX,
      label: '결석·보강', 
      href: '/dashboard/absence',
      show: true 
    },
    { 
      icon: School,
      label: '반 관리', 
      href: '/dashboard/admin/classes',
      show: userRole === 'owner'
    },
    { 
      icon: GraduationCap,
      label: '교사 관리', 
      href: '/dashboard/admin/teachers',
      show: userRole === 'owner'
    },
    { 
      icon: Users, 
      label: '학생 관리', 
      href: '/dashboard/students',
      show: userRole === 'owner' 
    },
    { 
      icon: Calendar, 
      label: '시간표', 
      href: '/dashboard/timetable',
      show: true 
    },
    { 
      icon: Bell, 
      label: '공지사항', 
      href: '/dashboard/notices',
      show: true 
    },
    { 
      icon: Package, 
      label: '재고 관리', 
      href: '/dashboard/inventory',
      show: userRole === 'owner' 
    },
    { 
      icon: Settings, 
      label: '설정', 
      href: '/dashboard/settings',
      show: userRole === 'owner' 
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <aside className={`${
        isSidebarOpen ? 'w-64' : 'w-16'
      } bg-white shadow-lg transition-all duration-300 fixed h-full z-10`}>
        
        <div className="p-4 border-b flex justify-between items-center">
          <h1 className={`font-bold text-xl ${!isSidebarOpen && 'hidden'}`}>
            리드앤톡
          </h1>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 rounded hover:bg-gray-100"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="p-4 border-b">
          <div className={`text-sm text-gray-600 ${!isSidebarOpen && 'hidden'}`}>
            {userName}
          </div>
          <div className={`text-xs text-gray-400 ${!isSidebarOpen && 'hidden'}`}>
            {userRole === 'owner' ? '원장' : '교사'}
          </div>
        </div>

        <nav className="p-4">
          {menuItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Icon size={20} />
                <span className={`${!isSidebarOpen && 'hidden'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            className={`w-full ${!isSidebarOpen && 'px-2'}`}
          >
            <LogOut size={20} />
            <span className={`ml-2 ${!isSidebarOpen && 'hidden'}`}>
              로그아웃
            </span>
          </Button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className={`flex-1 ${isSidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300`}>
        <div className="p-8">
          <Toaster position="top-center" richColors toastOptions={{ duration: 2000 }} />
          {children}
        </div>
      </main>
    </div>
  );
}