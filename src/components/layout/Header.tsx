import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Search, Eye, EyeOff, Bell, BellOff, LogOut, Download, User, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useApp } from '@/contexts/AppContext';
import { usePwaInstallContext } from '@/contexts/PwaInstallContext';
import { useUser } from '@/hooks/useUser';
import { requestAndSubscribePush } from '@/hooks/usePushSubscribe';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/Logo';

export function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const { hideValues, toggleHideValues } = useApp();
  const { showInstructions, isStandalone } = usePwaInstallContext();
  const { data: userData } = useUser();
  const user = userData?.user;
  const initials = user?.name ? user.name.trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U';
  const [pushLoading, setPushLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const isLightTheme = resolvedTheme === 'light';
  const canAskPush =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    Notification.permission === 'default' &&
    !pushEnabled;

  const handleEnableNotifications = async () => {
    setPushLoading(true);
    try {
      const ok = await requestAndSubscribePush();
      if (ok) setPushEnabled(true);
    } finally {
      setPushLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.setToken(null);
    queryClient.removeQueries({ queryKey: ['user', 'me'] });
    navigate('/login', { replace: true });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30 w-full bg-card/95 backdrop-blur-sm border-b border-border lg:left-56 lg:w-[calc(100%-14rem)] xl:left-64 xl:w-[calc(100%-16rem)] pt-[env(safe-area-inset-top,0px)] supports-[padding:max(0px)]:pt-[max(0px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between h-16 px-3 sm:px-4 md:px-5 lg:px-6 overflow-visible">
        {/* Left Section — Logo no mobile/tablet + Search no desktop */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo - visível apenas em mobile e tablet (até lg) */}
          <div className="lg:hidden flex-shrink-0">
            <Logo href="/" linkable showText={false} size="small" variant={isLightTheme ? 'light' : 'default'} />
          </div>
          {/* Search - visível apenas em desktop (lg+) */}
          <div className="hidden lg:flex relative w-48 xl:w-64 2xl:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar veículos, clientes..." 
              className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 text-sm"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Hide Values Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleHideValues}
            className="relative"
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {hideValues ? (
              <EyeOff className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </Button>

          <ThemeToggle className="text-muted-foreground hover:text-foreground" />

          {/* Notifications - sem dados mockados; lista vazia até existir API de notificações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-popover border border-border">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border border-border">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.name ?? 'Usuário'}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user?.email ?? '—'}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!isStandalone && (
                <DropdownMenuItem onClick={showInstructions} className="gap-2">
                  <Download className="w-4 h-4" />
                  Instalar app
                </DropdownMenuItem>
              )}
              {canAskPush && (
                <DropdownMenuItem
                  onClick={handleEnableNotifications}
                  disabled={pushLoading}
                  className="gap-2"
                >
                  {pushLoading ? (
                    <span className="text-muted-foreground">Aguardando...</span>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Ativar notificações
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'denied' && (
                  <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                    <BellOff className="w-4 h-4" />
                    Notificações bloqueadas
                  </DropdownMenuItem>
                )}
              <DropdownMenuItem onClick={() => navigate('/perfil')} className="gap-2">
                <User className="w-4 h-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracoes')} className="gap-2">
                <Settings className="w-4 h-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive gap-2" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
