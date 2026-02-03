import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  icon?: LucideIcon;
  iconClassName?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
  icon: Icon,
  iconClassName,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {Icon && (
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  variant === 'destructive'
                    ? 'bg-destructive/10'
                    : 'bg-primary/10',
                  iconClassName
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5',
                    variant === 'destructive' ? 'text-destructive' : 'text-primary'
                  )}
                />
              </div>
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              variant === 'destructive' && 'bg-destructive hover:bg-destructive/90 text-white'
            )}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
