import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface ServiceWorkerUpdateState {
  updateAvailable: boolean;
  isUpdating: boolean;
  skipWaiting: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

/**
 * Hook para gerenciar atualizações automáticas do Service Worker.
 * Detecta quando há uma nova versão disponível e aplica automaticamente.
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const toastShownRef = useRef(false);

  // Verifica se há atualização disponível
  const checkForUpdates = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      setRegistration(reg);

      // Verifica se há um service worker esperando para ativar
      if (reg.waiting) {
        setUpdateAvailable(true);
        if (!toastShownRef.current) {
          toastShownRef.current = true;
          toast.info('Nova versão disponível', {
            description: 'Atualizando automaticamente...',
            duration: 2000,
          });
        }
        return;
      }

      // Verifica se há um service worker instalando
      if (reg.installing) {
        reg.installing.addEventListener('statechange', () => {
          if (reg.waiting) {
            setUpdateAvailable(true);
            if (!toastShownRef.current) {
              toastShownRef.current = true;
              toast.info('Nova versão disponível', {
                description: 'Atualizando automaticamente em alguns segundos...',
                duration: 4000,
              });
            }
          }
        });
        return;
      }

      // Registra listener para quando um novo service worker for instalado
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && reg.waiting) {
            setUpdateAvailable(true);
            if (!toastShownRef.current) {
              toastShownRef.current = true;
              toast.info('Nova versão disponível', {
                description: 'Atualizando automaticamente em alguns segundos...',
                duration: 4000,
              });
            }
          }
        });
      });

      // Verifica atualizações imediatamente
      await reg.update();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug('[SW Update] Check failed:', error);
      }
    }
  }, []);

  // Aplica a atualização imediatamente
  const skipWaiting = useCallback(async () => {
    if (!registration?.waiting) return;

    setIsUpdating(true);
    toastShownRef.current = false; // Reset para permitir novo toast após atualização
    
    try {
      toast.loading('Aplicando atualização...', {
        duration: 2000,
      });

      // Envia mensagem para o service worker para pular a espera
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Recarrega a página após um breve delay para garantir que o novo SW seja ativado
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('[SW Update] Failed to skip waiting:', error);
      setIsUpdating(false);
      toast.error('Erro ao atualizar', {
        description: 'Tente recarregar a página manualmente.',
      });
    }
  }, [registration]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Verifica atualizações ao montar
    checkForUpdates();

    // Verifica atualizações periodicamente (a cada 30 segundos para atualização quase em tempo real)
    const interval = setInterval(checkForUpdates, 30 * 1000);
    
    // Verifica quando a página ganha foco (usuário volta para o app)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Verifica quando volta online
    const handleOnline = () => {
      checkForUpdates();
    };
    window.addEventListener('online', handleOnline);

    // Listener para quando o service worker controlador mudar (nova versão ativada)
    const handleControllerChange = () => {
      // Recarrega apenas se não estivermos já atualizando
      if (!isUpdating) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [checkForUpdates, isUpdating]);

  // Auto-aplica atualização quando disponível (quase imediatamente)
  useEffect(() => {
    if (!updateAvailable || isUpdating) return;

    // Aplica imediatamente após um pequeno delay para garantir que o toast seja exibido
    const timer = setTimeout(() => {
      skipWaiting();
    }, 500); // Aguarda apenas 500ms para atualização quase em tempo real

    return () => clearTimeout(timer);
  }, [updateAvailable, isUpdating, skipWaiting]);

  return {
    updateAvailable,
    isUpdating,
    skipWaiting,
    checkForUpdates,
  };
}
