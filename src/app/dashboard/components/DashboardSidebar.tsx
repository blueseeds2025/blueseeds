'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
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
  School,
  ClipboardList,
  Sliders
} from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { useAuth } from '@/lib/auth-context';

// ============================================================================
// 사이드바 컴포넌트
// ============================================================================

export function DashboardSidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  
  // 🆕 supabase client를 1회만 생성 (렌더마다 새로 만들지 않음)
  const supabase = useMemo(() => 
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), 
  []);

  // 🆕 로그아웃: replace + refresh 사용
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/auth/login');
    router.refresh();
  };

  const userRole = user?.role || null;
  const userName = user?.displayName || '';

  const menuItems = userRole ? [
    { 
      icon: Home, 
      label: '대시보드', 
      href: userRole === 'owner' ? '/dashboard/admin' : '/dashboard/teacher',
      show: true 
    },
    { 
      icon: Sliders, 
      label: '학원 설정', 
      href: '/dashboard/admin/settings',
      show: userRole === 'owner' 
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
      href: '/dashboard/teacher/feed-input',
      show: true 
    },
    { 
      icon: UserX,
      label: '결석·보강', 
      href: '/dashboard/absence',
      show: true 
    },
    { 
      icon: ClipboardList,
      label: '리포트', 
      href: userRole === 'owner' ? '/dashboard/admin/reports' : '/dashboard/teacher/reports',
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
      href: '/dashboard/admin/students',
      show: userRole === 'owner' 
    },
    { 
      icon: Users, 
      label: '학생 목록', 
      href: '/dashboard/teacher/students',
      show: userRole === 'teacher' 
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
  ] : [];

  return (
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

      {/* 메뉴 영역 - 🆕 Link 컴포넌트 사용 */}
      <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {menuItems.filter(item => item.show).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                isActive 
                  ? 'bg-[#6366F1]/10 text-[#6366F1]' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Icon size={20} />
              <span className={`${!isSidebarOpen && 'hidden'}`}>
                {item.label}
              </span>
            </Link>
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
  );
}

// ============================================================================
// 메인 콘텐츠 래퍼 (사이드바 상태에 따른 마진 처리)
// ============================================================================

export function DashboardContent({ children }: { children: React.ReactNode }) {
  // TODO: 사이드바 상태 공유가 필요하면 zustand 등 사용
  // 지금은 기본값(열림) 기준으로 마진 설정
  return (
    <main className="flex-1 ml-64 transition-all duration-300">
      <div className="p-8">
        {children}
      </div>
    </main>
  );
}
