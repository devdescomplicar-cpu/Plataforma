import { Link, useLocation, useNavigate } from 'react-router-dom';
import { prefetchRoute } from '@/routes/LazyRoutes';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  LayoutDashboard,
  Car,
  Receipt,
  ClipboardCheck,
  TrendingUp,
  Users,
  BarChart3,
  Settings,
  LogOut,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useUser, isAdmin } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Veículos', href: '/veiculos', icon: Car },
  { name: 'Despesas', href: '/despesas', icon: Receipt },
  { name: 'Checklist', href: '/checklist', icon: ClipboardCheck },
  { name: 'Vendas', href: '/vendas', icon: TrendingUp },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
];

const bottomNavigation = [
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sidebarOpen, setSidebarOpen } = useApp();
  const { data: userData } = useUser();
  const user = userData?.user;
  const initials = user?.name ? user.name.trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

  const handleLogout = () => {
    apiClient.setToken(null);
    queryClient.removeQueries({ queryKey: ['user', 'me'] });
    setSidebarOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 w-56 lg:w-64 bg-sidebar z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] overflow-hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 lg:px-5 py-4 lg:py-6 shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-primary tracking-tight">
              Descompli<span className="text-primary">CAR</span>
            </span>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable navigation area - sidebar-scroll garante scroll no iOS */}
        <div className="sidebar-scroll scrollbar-thin">
          <nav className="px-2 lg:px-3 py-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  className={cn(
                    "nav-item",
                    isActive && "active"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <Separator className="bg-sidebar-border w-full" />

          {/* Admin (only for admin role) */}
          {userData?.user && isAdmin(userData.user.role) && (
            <nav className="px-2 lg:px-3 py-2 space-y-1">
              <Link
                to="/admin"
                onClick={() => setSidebarOpen(false)}
                onMouseEnter={() => prefetchRoute('/admin')}
                onFocus={() => prefetchRoute('/admin')}
                className={cn(
                  'nav-item',
                  location.pathname.startsWith('/admin') && 'active'
                )}
              >
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">Painel Admin</span>
              </Link>
            </nav>
          )}

          <Separator className="bg-sidebar-border w-full" />

          <nav className="px-3 py-2 space-y-1 pb-2">
            {bottomNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  className={cn(
                    "nav-item",
                    isActive && "active"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile - fixed at bottom */}
        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 ring-2 ring-sidebar-accent">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-primary truncate">{user?.name ?? 'Usuário'}</p>
              <p className="text-xs text-sidebar-muted truncate">{user?.email ?? '—'}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
