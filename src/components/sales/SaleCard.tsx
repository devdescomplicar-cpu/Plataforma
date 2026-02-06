import { useState } from 'react';
import { Car, FileText, MoreHorizontal, Pencil, Trash2, User, UserCircle, Calendar, CreditCard, Plus, Minus, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HiddenValue } from '@/contexts/AppContext';
import { cn, toPublicImageUrl } from '@/lib/utils';
import { formatDateBR } from '@/lib/date-br';
import type { Sale } from '@/hooks/useSales';

function parsePaymentMethods(paymentMethod: string): string[] {
  if (!paymentMethod) return [];
  if (!paymentMethod.includes(',')) {
    if (paymentMethod.includes(':')) {
      const [method] = paymentMethod.split(':').map((s) => s.trim());
      return [method];
    }
    return [paymentMethod];
  }
  return paymentMethod
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(':') ? part.split(':').map((s) => s.trim())[0] : part));
}

function parsePaymentMethodsWithValues(
  paymentMethod: string
): Array<{ method: string; value: number }> {
  if (!paymentMethod) return [];
  if (!paymentMethod.includes(',')) {
    if (paymentMethod.includes(':')) {
      const [method, valueStr] = paymentMethod.split(':').map((s) => s.trim());
      const value = valueStr ? parseFloat(valueStr) : 0;
      return [{ method, value }];
    }
    return [{ method: paymentMethod, value: 0 }];
  }
  return paymentMethod
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.includes(':')) {
        const [method, valueStr] = part.split(':').map((s) => s.trim());
        const value = valueStr ? parseFloat(valueStr) : 0;
        return { method, value };
      }
      return { method: part, value: 0 };
    });
}

export interface SaleCardProps {
  sale: Sale;
  formatCurrency: (value: number) => string;
  onViewReceipt: (sale: Sale) => void;
  onEdit?: (sale: Sale) => void;
  onCancel?: (sale: Sale) => void;
  canEditOrDelete: boolean;
}

/** Par título (em cima) + valor (logo abaixo) — garante valor abaixo do seu título */
function LabelValueBlock({
  label,
  icon: Icon,
  value,
  valueClassName,
}: {
  label: string;
  icon?: React.ElementType;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <div className={valueClassName}>{value}</div>
    </div>
  );
}

export function SaleCard({
  sale,
  formatCurrency,
  onViewReceipt,
  onEdit,
  onCancel,
  canEditOrDelete,
}: SaleCardProps) {
  const vehicleName = sale.vehicle
    ? `${sale.vehicle.brand} ${sale.vehicle.model} ${sale.vehicle.year}`
    : 'N/A';
  const hasProfit = sale.profit >= 0;
  const methods = parsePaymentMethods(sale.paymentMethod);
  const methodsWithValues = parsePaymentMethodsWithValues(sale.paymentMethod);
  const paymentLabel =
    methods.length > 1
      ? `${methods[0]} + ${methods.length - 1} outra${methods.length > 2 ? 's' : ''}`
      : methods[0] || '—';
  const hasMultiplePayments = methods.length >= 2;
  const imageUrl = toPublicImageUrl(sale.vehicle?.image ?? '') ?? sale.vehicle?.image;
  const [paymentTooltipOpen, setPaymentTooltipOpen] = useState(false);

  return (
    <div className="card-interactive relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md">
      {/* Imagem do veículo */}
      <div className="relative h-36 shrink-0 bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={vehicleName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/80">
            <Car className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 shadow-sm"
                aria-label="Abrir menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border border-border">
              <DropdownMenuItem className="gap-2" onClick={() => onViewReceipt(sale)}>
                <FileText className="h-4 w-4" />
                Ver Comprovante
              </DropdownMenuItem>
              {canEditOrDelete && (
                <>
                  <DropdownMenuItem className="gap-2" onClick={() => onEdit?.(sale)}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-destructive"
                    onClick={() => onCancel?.(sale)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancelar venda
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conteúdo: duas colunas com divisão (estilo card veículos) */}
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-base font-semibold text-foreground mb-4">
          {vehicleName}
        </p>

        {/* 3 linhas × 2 colunas: cada célula = título em cima, valor logo abaixo */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border/60 pt-4 min-w-0">
          {/* Coluna esquerda */}
          <div className="space-y-4 pr-4 border-r border-border/40 min-w-0 overflow-hidden">
            <LabelValueBlock
              label="Vendido por"
              icon={User}
              value={
                <p className="truncate text-sm font-medium text-foreground">
                  {sale.registeredBy?.name ?? '—'}
                </p>
              }
            />
            <LabelValueBlock
              label="Comprador"
              icon={UserCircle}
              value={
                <p className="truncate text-sm font-medium text-foreground">
                  {sale.client?.name ?? 'Não informado'}
                </p>
              }
            />
            <LabelValueBlock
              label="Data da venda"
              icon={Calendar}
              value={
                <p className="text-sm font-medium text-foreground">
                  {formatDateBR(sale.saleDate)}
                </p>
              }
            />
          </div>
          {/* Coluna direita */}
          <div className="space-y-4 pl-4 min-w-0 overflow-hidden">
            <LabelValueBlock
              label="Valor da venda"
              icon={DollarSign}
              value={
                <p className="text-sm font-bold text-foreground">
                  <HiddenValue value={formatCurrency(sale.salePrice)} />
                </p>
              }
            />
            <LabelValueBlock
              label={hasProfit ? 'Lucro' : 'Prejuízo'}
              icon={hasProfit ? TrendingUp : TrendingDown}
              value={
                <p className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', hasProfit ? 'text-success' : 'text-destructive')}>
                  {hasProfit ? (
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <HiddenValue value={formatCurrency(Math.abs(sale.profit))} />
                </p>
              }
            />
            <LabelValueBlock
              label="Pagamento"
              icon={CreditCard}
              value={
                <TooltipProvider delayDuration={300} skipDelayDuration={0}>
                  {hasMultiplePayments ? (
                    <Tooltip
                      open={paymentTooltipOpen}
                      onOpenChange={setPaymentTooltipOpen}
                    >
                      <TooltipTrigger asChild>
                        <span
                          role="button"
                          tabIndex={0}
                          className="inline-block cursor-help truncate text-sm font-medium text-foreground underline decoration-dashed underline-offset-2 touch-manipulation"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPaymentTooltipOpen((prev) => !prev);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPaymentTooltipOpen((prev) => !prev);
                            }
                          }}
                        >
                          {paymentLabel}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="start"
                        className="max-w-[260px] p-3 z-[9999]"
                        sideOffset={6}
                        onPointerDownOutside={() => setPaymentTooltipOpen(false)}
                      >
                        <div className="space-y-2">
                          <p className="font-semibold text-xs text-foreground">
                            Formas de pagamento
                          </p>
                          {methodsWithValues.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="font-medium truncate flex-1 min-w-0">
                                {item.method}
                              </span>
                              {item.value > 0 ? (
                                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                                  R${' '}
                                  {item.value.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px] shrink-0">
                                  —
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="truncate text-sm font-medium text-foreground">
                      {paymentLabel}
                    </span>
                  )}
                </TooltipProvider>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
