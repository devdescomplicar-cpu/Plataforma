import { useState } from 'react';
import { DollarSign, Car, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Award, Star, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddVehicleModal } from '@/components/modals/AddVehicleModal';
import { RegisterSaleModal } from '@/components/modals/RegisterSaleModal';
import { AddExpenseFromVehiclesModal } from '@/components/modals/AddExpenseFromVehiclesModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useDashboardData } from '@/hooks/useDashboard';
import { QueryErrorState } from '@/components/QueryErrorState';
import { HiddenValue } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type PeriodType = 'current-month' | 'last-month' | '3m' | '6m' | 'custom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodType>('current-month');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [chartView, setChartView] = useState<'month' | 'day'>('month');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isRegisterSaleOpen, setIsRegisterSaleOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  const getReportParams = () => {
    if (period === 'custom' && startDate && endDate) {
      return {
        period: undefined,
        startDate,
        endDate,
      };
    }
    return { period };
  };

  const params = getReportParams();
  const { data, isLoading, isError, error } = useDashboardData(
    params.period,
    params.startDate,
    params.endDate
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <QueryErrorState message={error?.message} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const dashboardData = data || {
    cards: {
      revenue: { value: 0, change: 0 },
      vehiclesSold: { count: 0, avgPerDay: 0, change: 0 },
      netProfit: { value: 0, change: 0 },
      avgTicket: { value: 0 },
    },
    dailyChart: [],
    monthlyChart: [],
    insights: {
      bestDay: null,
      topClient: null,
      topVehicle: null,
      recurrenceRate: 0,
    },
    lastSales: [],
  };

  const quickActionIcons = {
    carMoto: '/car-moto-icon.webp',
    checklist: '/checklist-icon.webp',
    handshake: '/handshake-icon.webp',
    expense: '/expense-icon.webp',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do seu negócio</p>
        </div>

        {/* Filtro de Período — ícone de data no tom verde da plataforma */}
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => {
            setPeriod(v as PeriodType);
            if (v !== 'custom') {
              setStartDate(undefined);
              setEndDate(undefined);
            }
          }}>
            <SelectTrigger className="w-full min-w-0 sm:w-[180px] gap-2">
              <Calendar className="w-4 h-4 shrink-0 text-primary" aria-hidden />
              <SelectValue />
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
                <Button variant="outline" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {startDate && endDate
                    ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
                    : 'Selecionar datas'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Data inicial</p>
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      locale={ptBR}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Data final</p>
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      locale={ptBR}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                    >
                      Limpar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (startDate && endDate) {
                          setIsDatePickerOpen(false);
                        }
                      }}
                      disabled={!startDate || !endDate}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Ações Rápidas — abaixo do filtro de data, ícones coloridos, texto centralizado no mobile */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Ações Rápidas</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Acesso rápido às principais funções</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setIsAddVehicleOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-background p-4 sm:p-5 text-center transition-colors hover:bg-muted/50 active:scale-[0.98] min-h-[120px] sm:min-h-[128px] touch-manipulation"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden">
              <img src={quickActionIcons.carMoto} alt="" className="h-10 w-10 object-contain object-center" />
            </span>
            <span className="font-semibold text-foreground text-sm sm:text-base">Cadastrar veículo</span>
            <span className="text-xs text-muted-foreground">Novo veículo</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/checklist')}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-background p-4 sm:p-5 text-center transition-colors hover:bg-muted/50 active:scale-[0.98] min-h-[120px] sm:min-h-[128px] touch-manipulation"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden">
              <img src={quickActionIcons.checklist} alt="" className="h-10 w-10 object-contain object-center" />
            </span>
            <span className="font-semibold text-foreground text-sm sm:text-base">Checklist</span>
            <span className="text-xs text-muted-foreground">Pendências</span>
          </button>
          <button
            type="button"
            onClick={() => setIsRegisterSaleOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-background p-4 sm:p-5 text-center transition-colors hover:bg-muted/50 active:scale-[0.98] min-h-[120px] sm:min-h-[128px] touch-manipulation"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden">
              <img src={quickActionIcons.handshake} alt="" className="h-10 w-10 object-contain object-center" />
            </span>
            <span className="font-semibold text-foreground text-sm sm:text-base">Registrar Venda</span>
            <span className="text-xs text-muted-foreground">Nova venda</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddExpenseOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-background p-4 sm:p-5 text-center transition-colors hover:bg-muted/50 active:scale-[0.98] min-h-[120px] sm:min-h-[128px] touch-manipulation"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden">
              <img src={quickActionIcons.expense} alt="" className="h-10 w-10 object-contain object-center" />
            </span>
            <span className="font-semibold text-foreground text-sm sm:text-base">Adicionar Despesa</span>
            <span className="text-xs text-muted-foreground">Novo gasto</span>
          </button>
        </div>
      </div>

      {/* Cards Principais — 2 por linha no mobile; card sozinho estica; verde degradê */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
        {/* Faturamento */}
        <div className="card-dashboard-gradient p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/90">Faturamento no período</p>
              <DollarSign className="w-8 h-8 text-white/90" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-white">
                <HiddenValue value={formatCurrency(dashboardData.cards.revenue.value)} />
              </p>
              <div className="flex items-center gap-1 mt-2">
                {dashboardData.cards.revenue.change >= 0 ? (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-white" />
                    <p className="text-sm font-medium text-white/95">
                      +{dashboardData.cards.revenue.change.toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-white/90" />
                    <p className="text-sm font-medium text-white/95">
                      {dashboardData.cards.revenue.change.toFixed(1)}%
                    </p>
                  </>
                )}
                <p className="text-xs text-white/80">vs período anterior</p>
              </div>
            </div>
          </div>
        </div>

        {/* Veículos Vendidos */}
        <div className="card-dashboard-gradient p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/90">Veículos vendidos</p>
              <Car className="w-8 h-8 text-white/90" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-white">
                {dashboardData.cards.vehiclesSold.count}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {dashboardData.cards.vehiclesSold.change !== undefined && (
                  <>
                    {dashboardData.cards.vehiclesSold.change >= 0 ? (
                      <>
                        <ArrowUpRight className="w-4 h-4 text-white" />
                        <p className="text-sm font-medium text-white/95">
                          +{dashboardData.cards.vehiclesSold.change.toFixed(1)}%
                        </p>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-4 h-4 text-white/90" />
                        <p className="text-sm font-medium text-white/95">
                          {dashboardData.cards.vehiclesSold.change.toFixed(1)}%
                        </p>
                      </>
                    )}
                    <p className="text-xs text-white/80">vs período anterior</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="card-dashboard-gradient p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/90">Lucro Líquido</p>
              <TrendingUp className="w-8 h-8 text-white/90" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-white">
                <HiddenValue value={formatCurrency(dashboardData.cards.netProfit.value)} />
              </p>
              <div className="flex items-center gap-1 mt-2">
                {dashboardData.cards.netProfit.change !== undefined && (
                  <>
                    {dashboardData.cards.netProfit.change >= 0 ? (
                      <>
                        <ArrowUpRight className="w-4 h-4 text-white" />
                        <p className="text-sm font-medium text-white/95">
                          +{dashboardData.cards.netProfit.change.toFixed(1)}%
                        </p>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-4 h-4 text-white/90" />
                        <p className="text-sm font-medium text-white/95">
                          {dashboardData.cards.netProfit.change.toFixed(1)}%
                        </p>
                      </>
                    )}
                    <p className="text-xs text-white/80">vs período anterior</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="card-dashboard-gradient p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/90">Ticket médio</p>
              <TrendingUp className="w-8 h-8 text-white/90" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-white">
                <HiddenValue value={formatCurrency(dashboardData.cards.avgTicket.value)} />
              </p>
              <p className="text-xs text-white/80 mt-2">por venda</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos — mesma largura dos cards no mobile (sem padding extra) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
        {/* Evolução (Faturamento) — sem tabs Faturamento/Veículos; toggle Mês/Dia */}
        <div className="card-elevated p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="font-semibold text-foreground">Faturamento</h3>
            <Tabs value={chartView} onValueChange={(v) => setChartView(v as 'month' | 'day')}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="month" className="text-xs flex-1 sm:flex-none">Mês</TabsTrigger>
                <TabsTrigger value="day" className="text-xs flex-1 sm:flex-none">Dia</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-[260px] sm:h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (chartView === 'month' ? dashboardData.monthlyChart : dashboardData.dailyChart).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartView === 'month' ? dashboardData.monthlyChart : dashboardData.dailyChart}>
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    angle={chartView === 'day' ? -45 : 0}
                    textAnchor={chartView === 'day' ? 'end' : 'middle'}
                    height={50}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Faturamento']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Nenhum dado disponível no período</p>
              </div>
            )}
          </div>
        </div>

        {/* Evolução do Lucro — toggle Mês/Dia */}
        <div className="card-elevated p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="font-semibold text-foreground">Evolução do Lucro</h3>
            <Tabs value={chartView} onValueChange={(v) => setChartView(v as 'month' | 'day')}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="month" className="text-xs flex-1 sm:flex-none">Mês</TabsTrigger>
                <TabsTrigger value="day" className="text-xs flex-1 sm:flex-none">Dia</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-[260px] sm:h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (chartView === 'month' ? dashboardData.monthlyChart : dashboardData.dailyChart).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartView === 'month' ? dashboardData.monthlyChart : dashboardData.dailyChart}>
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    angle={chartView === 'day' ? -45 : 0}
                    textAnchor={chartView === 'day' ? 'end' : 'middle'}
                    height={50}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Lucro']}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Nenhum dado disponível no período</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Insights Rápidos — 2 por linha no mobile; card sozinho estica */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
        {/* Melhor Dia */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-warning" />
            <p className="text-xs font-medium text-muted-foreground">Melhor dia do período</p>
          </div>
          {dashboardData.insights.bestDay ? (
            <>
              <p className="text-lg font-bold text-foreground">{dashboardData.insights.bestDay.day}</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(dashboardData.insights.bestDay.revenue)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>

        {/* Cliente Destaque */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-info" />
            <p className="text-xs font-medium text-muted-foreground">Cliente destaque</p>
          </div>
          {dashboardData.insights.topClient ? (
            <>
              <p className="text-lg font-bold text-foreground truncate">{dashboardData.insights.topClient.name}</p>
              <p className="text-sm text-muted-foreground">
                {dashboardData.insights.topClient.count} {dashboardData.insights.topClient.count === 1 ? 'veículo' : 'veículos'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>

        {/* Veículo Mais Vendido */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4 text-success" />
            <p className="text-xs font-medium text-muted-foreground">Veículo mais vendido</p>
          </div>
          {dashboardData.insights.topVehicle ? (
            <>
              <p className="text-lg font-bold text-foreground truncate">{dashboardData.insights.topVehicle.name}</p>
              <p className="text-sm text-muted-foreground">
                {dashboardData.insights.topVehicle.count} {dashboardData.insights.topVehicle.count === 1 ? 'unidade' : 'unidades'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>

        {/* Taxa de Recorrência */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Taxa de recorrência</p>
          </div>
          <p className="text-lg font-bold text-foreground">{dashboardData.insights.recurrenceRate}%</p>
          <p className="text-sm text-muted-foreground">dos clientes voltaram a comprar</p>
        </div>
      </div>

      {/* Últimas Vendas — cards no mobile (estilo app), tabela no desktop */}
      <div className="card-elevated p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Últimas Vendas</h3>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => navigate('/vendas')}
          >
            Ver todas
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : dashboardData.lastSales.length > 0 ? (
          <>
            {/* Mobile: lista em cards (estilo app) */}
            <div className="md:hidden space-y-3">
              {dashboardData.lastSales.map((sale) => (
                <div
                  key={sale.id}
                  className="rounded-xl border border-border/60 bg-muted/30 p-4 active:bg-muted/50 transition-colors touch-manipulation"
                >
                  <p className="font-semibold text-foreground truncate">{sale.client}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2" title={sale.vehicle}>
                    {sale.vehicle}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/50">
                    <span className="font-semibold text-primary">
                      <HiddenValue value={formatCurrency(sale.value)} />
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(sale.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.lastSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.client}</TableCell>
                      <TableCell>{sale.vehicle}</TableCell>
                      <TableCell>
                        <HiddenValue value={formatCurrency(sale.value)} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(sale.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
          </div>
        )}
      </div>

      {/* Modais das Ações Rápidas */}
      <AddVehicleModal open={isAddVehicleOpen} onOpenChange={setIsAddVehicleOpen} />
      <RegisterSaleModal open={isRegisterSaleOpen} onOpenChange={setIsRegisterSaleOpen} />
      <AddExpenseFromVehiclesModal open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen} />
    </div>
  );
};

export default Dashboard;
