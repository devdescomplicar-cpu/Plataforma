import { useEffect } from 'react';

/**
 * Hook para garantir que o BottomNav fique fixo em bottom: 0 no PWA.
 * Força reflow após montagem para garantir posicionamento correto.
 */
export function useViewportFix() {
  useEffect(() => {
    // Força reflow para garantir que position fixed seja aplicado corretamente
    const forceReflow = () => {
      // Encontra o BottomNav e força reflow
      const bottomNavs = document.querySelectorAll('nav[aria-label="Navegação principal"], nav[aria-label="Navegação admin"]');
      bottomNavs.forEach((nav) => {
        if (nav instanceof HTMLElement) {
          // Força reflow lendo uma propriedade
          void nav.offsetHeight;
          // Garante bottom: 0
          nav.style.bottom = '0px';
          nav.style.position = 'fixed';
        }
      });
    };

    // Executa após montagem
    forceReflow();
    
    // Executa após um pequeno delay para garantir no PWA
    const timeout = setTimeout(forceReflow, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, []);
}
