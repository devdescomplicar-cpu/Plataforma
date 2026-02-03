import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QueryErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
  /** Use "inline" for table cells / compact areas, "block" for full-width cards */
  variant?: 'inline' | 'block';
}

/**
 * Exibe estado de erro de query (API/timeout) com mensagem e botão "Tentar novamente".
 * Evita que a UI fique presa em "Carregando..." quando o backend não responde.
 */
export function QueryErrorState({
  message = 'Não foi possível carregar. Verifique se o servidor está rodando e tente novamente.',
  onRetry,
  className,
  variant = 'block',
}: QueryErrorStateProps) {
  const isInline = variant === 'inline';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        isInline ? 'py-6' : 'py-12',
        className
      )}
    >
      <AlertCircle className="h-10 w-10 text-destructive/80" />
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
