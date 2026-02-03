import { Car, TrendingUp, DollarSign, Clock, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { HiddenValue } from '@/contexts/AppContext';
import { useDashboardMetrics } from '@/hooks/useDashboard';
import { QueryErrorState } from '@/components/QueryErrorState';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor?: string;
  prefix?: string;
  suffix?: string;
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeLabel = 'vs. mês anterior',
  icon: Icon,
  iconColor = 'bg-primary/10 text-primary',
  prefix = '',
  suffix = ''
}: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            isPositive && "bg-success-soft text-success",
            isNegative && "bg-destructive-soft text-destructive",
            !isPositive && !isNegative && "bg-muted text-muted-foreground"
          )}>
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : isNegative ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : null}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-2xl font-bold mt-1 text-foreground">
          <HiddenValue value={value} prefix={prefix} suffix={suffix} />
        </p>
        {changeLabel && change !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
        )}
      </div>
    </div>
  );
}

export function DashboardMetrics() {
  const { data: metricsData, isLoading, isError, error, refetch } = useDashboardMetrics();
  
  const metrics = metricsData ? [
    {
      title: 'Veículos em Estoque',
      value: metricsData.vehiclesInStock.toString(),
      change: undefined, // TODO: Calcular mudança vs mês anterior
      icon: Car,
      iconColor: 'bg-primary/10 text-primary',
    },
    {
      title: 'Lucro do Mês',
      value: metricsData.monthlyProfit.toLocaleString('pt-BR'),
      change: undefined, // TODO: Calcular mudança vs mês anterior
      icon: TrendingUp,
      iconColor: 'bg-success/10 text-success',
      prefix: 'R$ ',
    },
    {
      title: 'Vendas do Mês',
      value: metricsData.monthlySales.toString(),
      change: undefined, // TODO: Calcular mudança vs mês anterior
      icon: DollarSign,
      iconColor: 'bg-info/10 text-info',
    },
    {
      title: 'Tempo Médio em Estoque',
      value: metricsData.avgDaysInStock.toString(),
      change: undefined, // TODO: Calcular mudança vs mês anterior
      icon: Clock,
      iconColor: 'bg-warning/10 text-warning',
      suffix: ' dias',
    },
  ] : [];

  if (isError) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-full">
          <QueryErrorState message={error?.message} onRetry={refetch} variant="block" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}
