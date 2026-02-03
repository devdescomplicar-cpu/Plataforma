import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { useUser } from '@/hooks/useUser';
import { usePushSubscribe } from '@/hooks/usePushSubscribe';
import { apiClient } from '@/lib/api';

export function AppLayout() {
  const navigate = useNavigate();
  const { isError } = useUser();
  usePushSubscribe();

  useEffect(() => {
    if (isError) {
      apiClient.setToken(null);
      navigate('/login', { replace: true });
    }
  }, [isError, navigate]);

  if (isError) {
    return null;
  }

  return (
    <div className="app-layout-viewport h-full min-h-dvh bg-background w-full overflow-x-clip flex flex-col">
      <Sidebar />

      {/* Coluna: header fixo + main com scroll próprio — conteúdo nunca passa por trás do header */}
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
