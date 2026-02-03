import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type FinancialReport, type UsersReport, type SubscriptionsReport, type PlatformUsageReport } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, TrendingUp, Users, CreditCard, Activity, Car, ShoppingCart, Receipt, CheckSquare, Award, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

type PeriodType = 'current-month' | 'last-month' | '3m' | '6m' | 'custom';

export default function AdminRelatorios() {
  const [period, setPeriod] = useState<PeriodType>('current-month');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [revenueChartType, setRevenueChartType] = useState<'day' | 'month'>('day');

  const getReportParams = () => {
    if (period === 'custom' && startDate && endDate) {
      return {
        period: undefined,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }
    return { period };
  };

  const params = getReportParams();

  const { data: financialData, isLoading: isLoadingFinancial } = useQuery({
    queryKey: ['admin', 'reports', 'financial', params],
    queryFn: async () => {
      const res = await adminApi.reports.financial(params);
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 30_000,
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin', 'reports', 'users', params],
    queryFn: async () => {
      const res = await adminApi.reports.users(params);
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 30_000,
  });

  const { data: subscriptionsData, isLoading: isLoadingSubscriptions } = useQuery({
    queryKey: ['admin', 'reports', 'subscriptions', params],
    queryFn: async () => {
      const res = await adminApi.reports.subscriptions(params);
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 30_000,
  });

  const { data: platformUsageData, isLoading: isLoadingPlatformUsage } = useQuery({
    queryKey: ['admin', 'reports', 'platform-usage', params],
    queryFn: async () => {
      const res = await adminApi.reports.platformUsage(params);
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 30_000,
  });

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const formatLTV = (months: number): string => {
    if (months < 1) {
      const days = Math.floor(months * 30);
      return `${days} ${days === 1 ? 'dia' : 'dias'}`;
    }
    const wholeMonths = Math.floor(months);
    const days = Math.floor((months - wholeMonths) * 30);
    if (days === 0) {
      return `${wholeMonths} ${wholeMonths === 1 ? 'mês' : 'meses'}`;
    }
    return `${wholeMonths} ${wholeMonths === 1 ? 'mês' : 'meses'} e ${days} ${days === 1 ? 'dia' : 'dias'}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Análise completa da performance da plataforma
        </p>
      </div>

      {/* Period Filter - Fixed at top */}
      <div className="card-elevated p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(value) => {
              setPeriod(value as PeriodType);
              if (value !== 'custom') {
                setStartDate(undefined);
                setEndDate(undefined);
              }
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Mês atual</SelectItem>
                <SelectItem value="last-month">Mês passado</SelectItem>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !startDate && !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate && endDate ? (
                      <>
                        {format(startDate, "dd/MM/yyyy", { locale: ptBR })} - {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
                      </>
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => {
                      setStartDate(range?.from);
                      setEndDate(range?.to);
                      if (range?.from && range?.to) {
                        setIsDatePickerOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Todos os dados abaixo respeitam o período selecionado.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financial" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="platform-usage">Uso da Plataforma</TabsTrigger>
        </TabsList>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          {isLoadingFinancial ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : financialData ? (
            <>
              {/* Primary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Faturamento Total</p>
                      <DollarSign className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-primary">
                        {formatCurrency(financialData.totalRevenue)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Receita no período</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">MRR</p>
                      <TrendingUp className="w-8 h-8 text-success" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-success">
                        {formatCurrency(financialData.mrr)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Receita recorrente mensal</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">ARPU</p>
                      <Users className="w-8 h-8 text-info" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-info">
                        {formatCurrency(financialData.arpu)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Receita média por usuário</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">LTV</p>
                      <Clock className="w-8 h-8 text-warning" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-warning">
                        {formatLTV(financialData.ltv)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Média de tempo ativo</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Assinaturas Ativas</p>
                      <CreditCard className="w-8 h-8 text-success" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-success">
                        {financialData.activeSubscriptions}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Total de assinaturas ativas</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Assinaturas Canceladas</p>
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-destructive">
                        {financialData.cancelledSubscriptions}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Cancelamentos no período</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Taxa de Churn</p>
                      <TrendingUp className="w-8 h-8 text-warning rotate-180" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-warning">
                        {formatPercent(financialData.churnRate)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Taxa de cancelamento</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Taxa de Inadimplência</p>
                      <AlertCircle className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-muted-foreground">
                        {formatPercent(0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Em desenvolvimento</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Revenue Over Time */}
                <Card className="card-elevated">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Faturamento no Tempo</CardTitle>
                        <CardDescription>Evolução da receita</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={revenueChartType === 'day' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRevenueChartType('day')}
                        >
                          Dia
                        </Button>
                        <Button
                          variant={revenueChartType === 'month' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRevenueChartType('month')}
                        >
                          Mês
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={financialData.revenueOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => {
                            try {
                              return format(new Date(value), "dd/MM", { locale: ptBR });
                            } catch {
                              return value;
                            }
                          }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label), "dd/MM/yyyy", { locale: ptBR });
                            } catch {
                              return label;
                            }
                          }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={{ r: 5, fill: 'hsl(var(--primary))' }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* MRR Over Time */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>MRR no Tempo</CardTitle>
                    <CardDescription>Evolução mensal do MRR</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={financialData.mrrOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => {
                            try {
                              return format(new Date(value), "MM/yyyy", { locale: ptBR });
                            } catch {
                              return value;
                            }
                          }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'MRR']}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label), "MM/yyyy", { locale: ptBR });
                            } catch {
                              return label;
                            }
                          }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--success))"
                          strokeWidth={3}
                          dot={{ r: 5, fill: 'hsl(var(--success))' }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Revenue by Plan */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Faturamento por Plano</CardTitle>
                    <CardDescription>Distribuição da receita</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={financialData.revenueByPlan} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="planName" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* LTV by Plan */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>LTV Médio por Plano</CardTitle>
                    <CardDescription>Lifetime Value por plano</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={financialData.ltvByPlan} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="planName" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => formatLTV(value)}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatLTV(value), 'LTV']}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="ltv" fill="hsl(var(--warning))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {isLoadingUsers ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : usersData ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Usuários Totais</p>
                      <Users className="w-8 h-8 text-foreground" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-foreground">
                        {usersData.totalUsers}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Total de usuários cadastrados</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Usuários Ativos</p>
                      <Users className="w-8 h-8 text-success" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-success">
                        {usersData.activeUsers}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Usuários com conta ativa</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Usuários Inativos</p>
                      <Users className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-muted-foreground">
                        {usersData.inactiveUsers}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Usuários sem conta ativa</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Novos Usuários</p>
                      <TrendingUp className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-primary">
                        {usersData.newUsers}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Novos no período</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Highlights */}
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
                {usersData.topUserBySales && (
                  <div className="card-elevated p-6">
                    <div className="flex flex-col gap-4 h-full">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Usuário que Mais Vendeu</p>
                        <Award className="w-8 h-8 text-success" />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <p className="text-2xl font-bold text-success">
                          {usersData.topUserBySales.salesCount}
                        </p>
                        <p className="text-sm font-medium mt-2">{usersData.topUserBySales.userName}</p>
                        <p className="text-xs text-muted-foreground">{usersData.topUserBySales.userEmail}</p>
                      </div>
                    </div>
                  </div>
                )}

                {usersData.topUserByVehicles && (
                  <div className="card-elevated p-6">
                    <div className="flex flex-col gap-4 h-full">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Usuário com Mais Veículos</p>
                        <Car className="w-8 h-8 text-info" />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <p className="text-2xl font-bold text-info">
                          {usersData.topUserByVehicles.vehiclesCount}
                        </p>
                        <p className="text-sm font-medium mt-2">{usersData.topUserByVehicles.userName}</p>
                        <p className="text-xs text-muted-foreground">{usersData.topUserByVehicles.userEmail}</p>
                      </div>
                    </div>
                  </div>
                )}

                {usersData.oldestActiveUser && (
                  <div className="card-elevated p-6">
                    <div className="flex flex-col gap-4 h-full">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">Usuário Ativo Mais Antigo</p>
                        <Clock className="w-8 h-8 text-warning" />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <p className="text-2xl font-bold text-warning">
                          {usersData.oldestActiveUser.daysActive} dias
                        </p>
                        <p className="text-sm font-medium mt-2">{usersData.oldestActiveUser.userName}</p>
                        <p className="text-xs text-muted-foreground">{usersData.oldestActiveUser.userEmail}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Novos Usuários no Tempo</CardTitle>
                    <CardDescription>Evolução diária</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={usersData.newUsersOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => {
                            try {
                              return format(new Date(value), "dd/MM", { locale: ptBR });
                            } catch {
                              return value;
                            }
                          }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [value, 'Novos Usuários']}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label), "dd/MM/yyyy", { locale: ptBR });
                            } catch {
                              return label;
                            }
                          }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={{ r: 5, fill: 'hsl(var(--primary))' }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Usuários por Plano</CardTitle>
                    <CardDescription>Distribuição por plano</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={usersData.usersByPlan} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="planName" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [value, 'Usuários']}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--info))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-6">
          {isLoadingSubscriptions ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : subscriptionsData ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Assinaturas Ativas</p>
                      <CreditCard className="w-8 h-8 text-success" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-success">
                        {subscriptionsData.activeSubscriptions}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Total de assinaturas ativas</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Novas Assinaturas</p>
                      <TrendingUp className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-primary">
                        {subscriptionsData.newSubscriptions}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Novas no período</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Cancelamentos</p>
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-destructive">
                        {subscriptionsData.cancellations}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Cancelamentos no período</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Upgrades / Downgrades</p>
                      <Activity className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-muted-foreground">
                        0
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Em desenvolvimento</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Assinaturas Ativas x Canceladas</CardTitle>
                    <CardDescription>Evolução mensal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={subscriptionsData.subscriptionsOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => {
                            try {
                              return format(new Date(value), "MM/yyyy", { locale: ptBR });
                            } catch {
                              return value;
                            }
                          }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [value, 'Assinaturas']}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label), "MM/yyyy", { locale: ptBR });
                            } catch {
                              return label;
                            }
                          }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="active"
                          stroke="hsl(var(--success))"
                          strokeWidth={3}
                          dot={{ r: 5, fill: 'hsl(var(--success))' }}
                          activeDot={{ r: 7 }}
                          name="Ativas"
                        />
                        <Line
                          type="monotone"
                          dataKey="cancelled"
                          stroke="hsl(var(--destructive))"
                          strokeWidth={3}
                          dot={{ r: 5, fill: 'hsl(var(--destructive))' }}
                          activeDot={{ r: 7 }}
                          name="Canceladas"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Churn no Tempo</CardTitle>
                    <CardDescription>Taxa de cancelamento</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={subscriptionsData.churnOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => {
                            try {
                              return format(new Date(value), "MM/yyyy", { locale: ptBR });
                            } catch {
                              return value;
                            }
                          }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => formatPercent(value)}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatPercent(value), 'Churn']}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label), "MM/yyyy", { locale: ptBR });
                            } catch {
                              return label;
                            }
                          }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="churnRate"
                          stroke="hsl(var(--warning))"
                          strokeWidth={3}
                          dot={{ r: 5, fill: 'hsl(var(--warning))' }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Assinaturas por Plano</CardTitle>
                    <CardDescription>Distribuição por plano</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={subscriptionsData.subscriptionsByPlan} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="planName" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [value, 'Assinaturas']}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Platform Usage Tab */}
        <TabsContent value="platform-usage" className="space-y-6">
          {isLoadingPlatformUsage ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : platformUsageData ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Veículos Cadastrados</p>
                      <Car className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-primary">
                        {platformUsageData.vehiclesCreated}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Veículos cadastrados no período</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Vendas Registradas</p>
                      <ShoppingCart className="w-8 h-8 text-success" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-success">
                        {platformUsageData.salesCreated}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Vendas registradas no período</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Despesas Lançadas</p>
                      <Receipt className="w-8 h-8 text-warning" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-warning">
                        {platformUsageData.expensesCreated}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Despesas lançadas no período</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Checklists Concluídos</p>
                      <CheckSquare className="w-8 h-8 text-info" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-3xl font-bold text-info">
                        {platformUsageData.checklistsCompleted}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Checklists concluídos no período</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Atividade Diária por Tipo</CardTitle>
                    <CardDescription>Evolução das atividades</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={platformUsageData.dailyActivity} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => {
                            try {
                              return format(new Date(value), "dd/MM", { locale: ptBR });
                            } catch {
                              return value;
                            }
                          }}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [value, 'Atividades']}
                          labelFormatter={(label) => {
                            try {
                              return format(new Date(label), "dd/MM/yyyy", { locale: ptBR });
                            } catch {
                              return label;
                            }
                          }}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="vehicles"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                          activeDot={{ r: 6 }}
                          name="Veículos"
                        />
                        <Line
                          type="monotone"
                          dataKey="sales"
                          stroke="hsl(var(--success))"
                          strokeWidth={3}
                          dot={{ r: 4, fill: 'hsl(var(--success))' }}
                          activeDot={{ r: 6 }}
                          name="Vendas"
                        />
                        <Line
                          type="monotone"
                          dataKey="expenses"
                          stroke="hsl(var(--warning))"
                          strokeWidth={3}
                          dot={{ r: 4, fill: 'hsl(var(--warning))' }}
                          activeDot={{ r: 6 }}
                          name="Despesas"
                        />
                        <Line
                          type="monotone"
                          dataKey="checklists"
                          stroke="hsl(var(--info))"
                          strokeWidth={3}
                          dot={{ r: 4, fill: 'hsl(var(--info))' }}
                          activeDot={{ r: 6 }}
                          name="Checklists"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle>Top Usuários Mais Ativos</CardTitle>
                    <CardDescription>Usuários com mais atividade</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {platformUsageData.topActiveUsers.slice(0, 10).map((user, index) => (
                        <div
                          key={user.userId}
                          className="flex items-center justify-between p-2 rounded border"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              #{index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium">{user.userName}</p>
                              <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {user.activityCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
