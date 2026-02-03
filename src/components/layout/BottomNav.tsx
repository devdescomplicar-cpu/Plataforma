import { Link, useLocation } from 'react-router-dom';
import { prefetchRoute } from '@/routes/LazyRoutes';
import { LayoutDashboard, Car, Receipt, ClipboardCheck, TrendingUp, MoreHorizontal, Users, CircleUser, CreditCard, BarChart3, ArrowLeft } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

const items = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Veículos', href: '/veiculos', icon: Car },
  { name: 'Despesas', href: '/despesas', icon: Receipt },
  { name: 'Checklist', href: '/checklist', icon: ClipboardCheck },
  { name: 'Vendas', href: '/vendas', icon: TrendingUp },
];

// Primeiros 5 itens da sidebar admin na mesma ordem
const adminItems = [
  { name: 'Visão geral', href: '/admin', icon: LayoutDashboard },
  { name: 'Usuários', href: '/admin/usuarios', icon: Users },
  { name: 'Clientes', href: '/admin/clientes', icon: CircleUser },
  { name: 'Planos', href: '/admin/planos', icon: CreditCard },
  { name: 'Relatórios', href: '/admin/relatorios', icon: BarChart3 },
];

export function BottomNav() {
  const location = useLocation();
  const { setSidebarOpen } = useApp();
  const isAdminArea = location.pathname.startsWith('/admin');

  // Se estiver na área admin, mostra "Dashboard Cliente" + 4 itens do admin + "Mais"
  if (isAdminArea) {
    // Pega apenas os primeiros 4 itens do admin (já que vamos adicionar "Dashboard Cliente" no início)
    const adminItemsToShow = adminItems.slice(0, 4);
    
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-lg lg:hidden px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
        aria-label="Navegação admin"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          transform: 'translateZ(0)',
          margin: 0,
          top: 'auto',
        } as CSSProperties}
      >
        {/* Botão Dashboard Cliente - primeiro item */}
        <Link
          to="/"
          onMouseEnter={() => prefetchRoute('/')}
          onFocus={() => prefetchRoute('/')}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 mx-0.5 my-1 py-1.5 px-2 rounded-xl transition-all touch-manipulation',
            'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium truncate w-full text-center">Dashboard Cliente</span>
        </Link>
        
        {/* Itens do admin */}
        {adminItemsToShow.map((item) => {
          const isActive = item.href === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onMouseEnter={() => prefetchRoute(item.href)}
              onFocus={() => prefetchRoute(item.href)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 mx-0.5 my-1 py-1.5 px-2 rounded-xl transition-all touch-manipulation',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', isActive && 'text-primary-foreground')} aria-hidden />
              <span className={cn('text-[10px] font-medium truncate w-full text-center', isActive && 'text-primary-foreground')}>
                {item.name}
              </span>
            </Link>
          );
        })}
        
        {/* Botão Mais - último item */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 mx-0.5 my-1 py-1.5 px-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all touch-manipulation"
          aria-label="Abrir menu completo"
        >
          <MoreHorizontal className="w-5 h-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium truncate w-full text-center">Mais</span>
        </button>
      </nav>
    );
  }

  // Menu normal para área do cliente
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-lg lg:hidden px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      aria-label="Navegação principal"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transform: 'translateZ(0)',
        margin: 0,
        top: 'auto',
      } as CSSProperties}
    >
      {items.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            onMouseEnter={() => prefetchRoute(item.href)}
            onFocus={() => prefetchRoute(item.href)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 mx-0.5 my-1 py-1.5 px-2 rounded-xl transition-all touch-manipulation',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <item.icon className={cn('w-5 h-5 shrink-0', isActive && 'text-primary-foreground')} aria-hidden />
            <span className={cn('text-[10px] font-medium truncate w-full text-center', isActive && 'text-primary-foreground')}>
              {item.name}
            </span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 mx-0.5 my-1 py-1.5 px-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all touch-manipulation"
        aria-label="Abrir menu completo"
      >
        <MoreHorizontal className="w-5 h-5 shrink-0" aria-hidden />
        <span className="text-[10px] font-medium truncate w-full text-center">Mais</span>
      </button>
    </nav>
  );
}
