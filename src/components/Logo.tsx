import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getRouterBasename } from '@/lib/app-config';

interface LogoProps {
  /**
   * Tamanho do logo
   * @default "default" - tamanho padrão para sidebar
   */
  size?: 'small' | 'default' | 'large';
  /**
   * Se deve incluir o texto ao lado do logo
   * @default true
   */
  showText?: boolean;
  /**
   * Se deve ser um link clicável
   * @default true
   */
  linkable?: boolean;
  /**
   * URL para onde o logo deve redirecionar (quando linkable=true)
   * @default "/"
   */
  href?: string;
  /**
   * Classes CSS adicionais para a imagem
   */
  className?: string;
  /**
   * Classe CSS para o container do logo
   */
  containerClassName?: string;
  /**
   * Classe CSS para o texto
   */
  textClassName?: string;
}

const sizeConfig = {
  small: {
    image: 'h-10 w-auto max-w-[140px]',
    gap: 'gap-0',
  },
  default: {
    image: 'h-14 w-auto max-w-[180px]',
    gap: 'gap-0',
  },
  large: {
    image: 'h-20 w-auto max-w-[240px]',
    gap: 'gap-0',
  },
};

export function Logo({
  size = 'default',
  showText = false,
  linkable = true,
  href = '/',
  className,
  containerClassName,
  textClassName,
}: LogoProps) {
  const config = sizeConfig[size];
  const basename = getRouterBasename() || '';
  const logoPath = `${basename}/logo.webp`;

  const [imageError, setImageError] = React.useState(false);

  const handleImageError = () => {
    console.error('[Logo] Erro ao carregar logo:', logoPath);
    console.error('[Logo] Basename:', basename);
    console.error('[Logo] Caminho completo esperado:', logoPath);
    setImageError(true);
  };

  const logoContent = (
    <div className={cn('flex items-center justify-center', config.gap, containerClassName)}>
      {!imageError ? (
        <img
          src={logoPath}
          alt="DescomplicAR"
          className={cn('object-contain flex-shrink-0', config.image, className)}
          loading="lazy"
          onError={handleImageError}
        />
      ) : (
        <div className={cn('flex items-center justify-center bg-primary/10 rounded-lg', config.image, className)}>
          <span className={cn('font-bold text-primary', size === 'small' ? 'text-xs' : size === 'large' ? 'text-lg' : 'text-sm')}>
            DC
          </span>
        </div>
      )}
      {showText && (
        <span className={cn('font-bold tracking-tight', textClassName || 'text-sidebar-primary')}>
          Descompli<span className="text-primary">CAR</span>
        </span>
      )}
    </div>
  );

  if (linkable) {
    return (
      <Link to={href} className="flex items-center">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
