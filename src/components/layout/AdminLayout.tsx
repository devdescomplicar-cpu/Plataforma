import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { useUser, isAdmin } from '@/hooks/useUser';
import { apiClient } from '@/lib/api';

export function AdminLayout() {
  const navigate = useNavigate();
  const { data: userData, isError, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;
    if (isError) {
      apiClient.setToken(null);
      navigate('/login', { replace: true });
      return;
    }
    if (userData?.user && !isAdmin(userData.user.role)) {
      navigate('/', { replace: true });
    }
  }, [userData, isError, isLoading, navigate]);

  if (isLoading || isError || (userData?.user && !isAdmin(userData.user.role))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-layout-viewport h-full min-h-dvh bg-background w-full overflow-x-clip flex flex-col">
      <AdminSidebar />
      <div className="lg:pl-56 xl:pl-64 flex-1 flex flex-col min-h-0 w-full">
        <Header />
        {/* Espaçamento para compensar header fixo: h-16 (64px) + safe-area-inset-top */}
        <div className="header-spacer shrink-0" />
        <main className="flex-1 min-h-0 w-full max-w-full xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-3 py-4 sm:px-4 md:px-5 lg:px-6 lg:py-6 mobile-bottom-nav-padding lg:pb-6 overflow-y-auto overflow-x-clip">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
