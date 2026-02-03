import { Link, useLocation } from 'react-router-dom';
import { Users, CreditCard, BarChart3, Mail, Webhook, FileSearch, HardDrive, LayoutDashboard, X, ArrowLeft, Bell, FileText, CircleUser } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const adminNavigation = [
  { name: 'Visão geral', href: '/admin', icon: LayoutDashboard },
  { name: 'Usuários', href: '/admin/usuarios', icon: Users },
  { name: 'Clientes', href: '/admin/clientes', icon: CircleUser },
  { name: 'Planos', href: '/admin/planos', icon: CreditCard },
  { name: 'Relatórios', href: '/admin/relatorios', icon: BarChart3 },
  { name: 'Notificações', href: '/admin/notificacoes', icon: Bell },
  { name: 'Templates', href: '/admin/templates', icon: FileText },
  { name: 'SMTP', href: '/admin/smtp', icon: Mail },
  { name: 'Webhooks', href: '/admin/webhooks', icon: Webhook },
  { name: 'Auditoria', href: '/admin/auditoria', icon: FileSearch },
  { name: 'Armazenamento', href: '/admin/armazenamento', icon: HardDrive },
];

export function AdminSidebar() {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useApp();

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 w-56 lg:w-64 bg-sidebar z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] overflow-hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 lg:px-5 py-4 lg:py-6 shrink-0">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-primary tracking-tight">
              Painel <span className="text-primary">Admin</span>
            </span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="sidebar-scroll px-2 lg:px-3 py-2 space-y-1 scrollbar-thin">
          {adminNavigation.map((item) => {
            const isActive = item.href === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.href);
            return (
              <Link key={item.name} to={item.href} onClick={() => setSidebarOpen(false)} className={cn('nav-item', isActive && 'active')}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border shrink-0">
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <Button variant="outline" className="w-full justify-start gap-2 border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent text-sidebar-foreground">
              <ArrowLeft className="w-4 h-4" />
              Dashboard Cliente
            </Button>
          </Link>
        </div>
      </aside>
    </>
  );
}
