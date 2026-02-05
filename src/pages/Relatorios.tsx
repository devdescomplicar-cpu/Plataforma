import { useState } from 'react';
import { TrendingUp, DollarSign, Car, Users, Download, Percent, Calendar, X, Clock, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HiddenValue } from '@/contexts/AppContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { useReports, useReportsCollaborators, useReportCollaboratorById, type SellerReportData, type CollaboratorReportData } from '@/hooks/useReports';
import { useSettings } from '@/hooks/useSettings';
import { useUser } from '@/hooks/useUser';
import { QueryErrorState } from '@/components/QueryErrorState';
import { toPublicImageUrl } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type PeriodType = 'current-month' | 'last-month' | '3m' | '6m' | 'custom';

const Relatorios = () => {
  const [period, setPeriod] = useState<PeriodType>('current-month');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [salesChartType, setSalesChartType] = useState<'vendas' | 'lucro'>('vendas');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [reportTab, setReportTab] = useState<'negocio' | 'colaboradores'>('negocio');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);

  // Calcular período baseado na seleção
  const getReportParams = () => {
    if (period === 'custom' && startDate && endDate) {
      return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      };
    }
    return { period };
  };

  const { data: userData } = useUser();
  const isSeller = userData?.collaboratorRole === 'seller';
  const isOwner = userData?.isAccountOwner ?? false;

  const { data, isLoading, isError, error, refetch } = useReports(getReportParams());
  const { data: collaboratorsReport = [] } = useReportsCollaborators(isOwner ? getReportParams() : undefined);
  const { data: collaboratorReport, isLoading: isLoadingCollaborator } = useReportCollaboratorById(
    selectedCollaboratorId,
    isOwner ? getReportParams() : undefined
  );
  const vendedores = collaboratorsReport.filter((r) => r.role === 'seller');
  const { data: settings } = useSettings();
  const storeName = settings?.store?.name ?? '';
  const storeLogoUrl = settings?.store?.logo ? (toPublicImageUrl(settings.store.logo) ?? settings.store.logo) : null;
  const reportResponsible = settings?.report?.responsible ?? '';
  const includeLegalNotice = settings?.report?.includeLegalNotice ?? true;
  const legalNoticeText = settings?.report?.legalNoticeText?.trim() || 'Este relatório é informativo e não substitui documentos fiscais.';

  const sellerData = data && 'vendas' in data && Array.isArray((data as SellerReportData).vendas) ? (data as SellerReportData) : null;

  const summary = data?.summary ?? {
    faturamentoTotal: 0,
    lucroLiquido: 0,
    margemLucro: 0,
    veiculosVendidos: 0,
    clientesRecorrentes: 0,
  };
  const vendasMensais = data && 'vendasMensais' in data ? (data.vendasMensais ?? []) : [];
  const topVeiculosLucrativos = data && 'topVeiculosLucrativos' in data ? (data.topVeiculosLucrativos ?? []) : [];
  const marcasLucrativas = data && 'marcasLucrativas' in data ? (data.marcasLucrativas ?? []) : [];
  const veiculosMaisTempoEstoque = data && 'veiculosMaisTempoEstoque' in data ? (data.veiculosMaisTempoEstoque ?? []) : [];
  const veiculosVendaRapida = data && 'veiculosVendaRapida' in data ? (data.veiculosVendaRapida ?? []) : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Preparar dados para gráfico de vendas
  const salesChartData = vendasMensais.map((v) => ({
    month: v.month,
    vendas: v.vendas,
    faturamento: v.faturamento,
    lucro: v.lucro,
  }));

  // Preparar dados para gráficos de rankings (barras horizontais)
  const veiculosChartData = topVeiculosLucrativos
    .slice()
    .reverse() // Inverter para mostrar o maior no topo
    .map((item, i) => ({
      name: item.name.length > 30 ? `${item.name.substring(0, 30)}...` : item.name,
      lucro: item.lucro,
      margem: item.margem,
      vendas: item.vendas,
      color: ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--primary))'][i % 5],
    }));

  const marcasChartData = marcasLucrativas
    .slice()
    .reverse() // Inverter para mostrar o maior no topo
    .map((item, i) => ({
      name: item.name.length > 30 ? `${item.name.substring(0, 30)}...` : item.name,
      lucro: item.lucro,
      margem: item.margem,
      color: ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--primary))'][i % 5],
    }));

  // Preparar dados para gráfico de veículos em estoque há mais tempo
  const estoqueChartData = veiculosMaisTempoEstoque
    .slice()
    .reverse() // Inverter para mostrar o maior no topo
    .map((item, i) => ({
      name: item.name.length > 30 ? `${item.name.substring(0, 30)}...` : item.name,
      dias: item.dias,
      color: item.color || ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--primary))'][i % 5],
    }));

  // Preparar dados para gráfico de veículos que venderam mais rápido
  const vendaRapidaChartData = veiculosVendaRapida
    .slice()
    .reverse() // Inverter para mostrar o menor no topo (mais rápido)
    .map((item, i) => ({
      name: item.name.length > 30 ? `${item.name.substring(0, 30)}...` : item.name,
      dias: item.dias,
      color: item.color || ['hsl(var(--success))', 'hsl(var(--info))', 'hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))'][i % 5],
    }));

  // Preparar dados para evolução do lucro (com cores)
  const profitChartData = vendasMensais.map((v, index) => {
    const prevLucro = index > 0 ? vendasMensais[index - 1].lucro : v.lucro;
    const isPositive = v.lucro >= prevLucro;
    return {
      month: v.month,
      lucro: v.lucro,
      isPositive,
    };
  });

  // Preparar dados para tempo médio em estoque
  const stockTimeData = vendasMensais.map((v) => ({
    month: v.month,
    dias: v.tempoMedioEstoque,
  }));

  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <QueryErrorState message={error?.message} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  // Relatório limitado do vendedor (sem custos, lucro, despesas)
  if (sellerData) {
    const sellerSummary = sellerData.summary as {
      veiculosVendidos: number;
      totalVendido?: number;
      totalComissaoReceber: number;
    };
    const totalVendido = sellerSummary.totalVendido ?? 0;
    const comissaoMensais = sellerData.comissaoMensais ?? [];
    const sellerCommissionChartData = comissaoMensais.map((m) => ({
      month: m.month,
      comissao: m.comissao,
      vendas: m.vendas,
      faturamento: m.faturamento,
    }));

    return (
      <div className="space-y-6 animate-fade-in">
        {(storeName || storeLogoUrl) && (
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            {storeLogoUrl && <img src={storeLogoUrl} alt="Logo" className="h-10 w-10 object-contain rounded" />}
            {storeName && <span className="text-lg font-semibold">{storeName}</span>}
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meu relatório</h1>
            <p className="text-muted-foreground mt-1">Suas vendas e comissão no período</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v) => { setPeriod(v as PeriodType); if (v !== 'custom') { setStartDate(undefined); setEndDate(undefined); } }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Período" /></SelectTrigger>
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
                    {startDate && endDate ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}` : 'Período'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-4 space-y-4">
                    <div><p className="text-sm font-medium mb-2">Data inicial</p><CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} /></div>
                    <div><p className="text-sm font-medium mb-2">Data final</p><CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} /></div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>Limpar</Button>
                      <Button size="sm" onClick={() => startDate && endDate && setIsDatePickerOpen(false)} disabled={!startDate || !endDate}>Aplicar</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Cards no mesmo padrão do relatório do dono */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-3">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Veículos Vendidos</p>
                <Car className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-foreground">{sellerSummary.veiculosVendidos}</p>
                <p className="text-xs text-muted-foreground mt-2">Quantidade no período</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Faturamento</p>
                <DollarSign className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-foreground">{formatCurrency(totalVendido)}</p>
                <p className="text-xs text-muted-foreground mt-2">Total das suas vendas</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Comissão a Receber</p>
                <TrendingUp className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-success">{formatCurrency(sellerSummary.totalComissaoReceber)}</p>
                <p className="text-xs text-muted-foreground mt-2">Sua comissão no período</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de evolução de comissão */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Evolução de comissão</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sellerCommissionChartData}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'comissao') return [formatCurrency(value), 'Comissão'];
                    if (name === 'faturamento') return [formatCurrency(value), 'Faturamento'];
                    return [value, 'Vendas'];
                  }}
                  labelFormatter={(label) => `Mês: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="comissao"
                  name="Comissão"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Histórico de vendas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Data</th>
                  <th className="text-left p-3 font-medium">Veículo</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Cliente</th>
                  <th className="text-right p-3 font-medium">Valor venda</th>
                  <th className="text-right p-3 font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {sellerData.vendas.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma venda no período.</td></tr>
                ) : (
                  sellerData.vendas.map((v) => (
                    <tr key={v.id} className="border-b">
                      <td className="p-3">{format(new Date(v.saleDate), 'dd/MM/yyyy', { locale: ptBR })}</td>
                      <td className="p-3">{v.vehicle ?? '—'}</td>
                      <td className="p-3 hidden sm:table-cell">{v.clientName ?? '—'}</td>
                      <td className="p-3 text-right">{formatCurrency(v.salePrice)}</td>
                      <td className="p-3 text-right">{v.commissionAmount != null ? formatCurrency(v.commissionAmount) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Identidade da loja (visível na impressão/export) */}
      {(storeName || storeLogoUrl) && (
        <div className="flex items-center gap-3 pb-2 border-b border-border print:flex print:pb-2">
          {storeLogoUrl && (
            <img
              src={storeLogoUrl}
              alt="Logo da loja"
              className="h-10 w-10 object-contain rounded print:h-12 print:w-12"
            />
          )}
          {storeName && (
            <span className="text-lg font-semibold text-foreground print:text-xl">{storeName}</span>
          )}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Análise de desempenho do seu negócio</p>
        </div>
        <div className="flex items-center gap-3">
          <Select 
            value={period} 
            onValueChange={(value) => {
              setPeriod(value as PeriodType);
              if (value !== 'custom') {
                setStartDate(undefined);
                setEndDate(undefined);
              }
            }}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
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
                <Button variant="outline" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {startDate && endDate
                    ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
                    : 'Selecionar período'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
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

          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {isOwner && (
        <Tabs value={reportTab} onValueChange={(v) => { setReportTab(v as 'negocio' | 'colaboradores'); if (v === 'colaboradores') setSelectedCollaboratorId(null); }} className="space-y-4">
          <TabsList className="grid w-full max-w-[280px] grid-cols-2">
            <TabsTrigger value="negocio">Negócio</TabsTrigger>
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          </TabsList>

          <TabsContent value="negocio" className="space-y-6 mt-4">
      {/* Summary Cards — 2 por linha no mobile; card sozinho estica */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-6 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-6">
        <div className="card-elevated p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Faturamento Total</p>
              <DollarSign className="w-8 h-8 text-foreground" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-foreground">
                <HiddenValue value={formatCurrency(summary.faturamentoTotal)} />
              </p>
              <p className="text-xs text-muted-foreground mt-2">Quanto entrou</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Lucro Líquido</p>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-success">
                <HiddenValue value={formatCurrency(summary.lucroLiquido)} />
              </p>
              <p className="text-xs text-muted-foreground mt-2">O que sobrou de verdade</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Margem de Lucro</p>
              <Percent className="w-8 h-8 text-info" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-info">
                {summary.margemLucro.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">Lucro ÷ faturamento</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Veículos Vendidos</p>
              <Car className="w-8 h-8 text-foreground" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-foreground">
                {summary.veiculosVendidos}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Quantidade no período</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Clientes Recorrentes</p>
              <Users className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-yellow-500">
                {summary.clientesRecorrentes}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Clientes com 2+ compras</p>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Tempo Médio em Estoque</p>
              <Clock className="w-8 h-8 text-info" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="card-value-number text-info">
                {summary.tempoMedioEstoque}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Dias médios (veículos vendidos)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
        {/* Vendas por Mês com Toggle */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Vendas por Mês</h3>
            <Tabs value={salesChartType} onValueChange={(v) => setSalesChartType(v as any)}>
              <TabsList>
                <TabsTrigger value="vendas" className="text-xs">Quantidade</TabsTrigger>
                <TabsTrigger value="lucro" className="text-xs">Lucro</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChartData}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => {
                    if (salesChartType === 'vendas') {
                      return [`${value}`, 'Vendas'];
                    }
                    return [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Lucro'];
                  }}
                />
                <Bar 
                  dataKey={salesChartType} 
                  fill={salesChartType === 'lucro' ? 'hsl(var(--success))' : 'hsl(var(--primary))'} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolução do Lucro */}
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4">Evolução do Lucro</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitChartData}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                  dataKey="lucro"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const dataIndex = props.payload?.index ?? props.index ?? 0;
                    const isPositive = profitChartData[dataIndex]?.isPositive ?? true;
                    const color = isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
                    return (
                      <circle
                        key={`dot-${props.index ?? dataIndex}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill={color}
                        stroke={color}
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={(props: any) => {
                    const dataIndex = props.payload?.index ?? props.index ?? 0;
                    const isPositive = profitChartData[dataIndex]?.isPositive ?? true;
                    const color = isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
                    return (
                      <circle
                        key={`activeDot-${props.index ?? dataIndex}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={6}
                        fill={color}
                        stroke={color}
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tempo Médio em Estoque */}
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4">Tempo Médio em Estoque</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockTimeData}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} label={{ value: 'Dias', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value} dias`, 'Tempo médio']}
                />
                <Bar dataKey="dias" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Faturamento por Mês */}
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4">Faturamento por Mês</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChartData}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Faturamento']}
                />
                <Line
                  type="monotone"
                  dataKey="faturamento"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
        {/* Veículos Mais Lucrativos */}
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4">Veículos Mais Lucrativos</h3>
          {veiculosChartData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={veiculosChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={120}
                    tick={{ fill: 'hsl(var(--foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    wrapperStyle={{
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `R$ ${Number(value).toLocaleString('pt-BR')}`,
                      `Lucro (Margem: ${props.payload.margem.toFixed(1)}%)`,
                    ]}
                    labelFormatter={(label) => `Veículo: ${label}`}
                    labelStyle={{
                      fontSize: '11px',
                      marginBottom: '4px',
                    }}
                  />
                  <Bar
                    dataKey="lucro"
                    radius={[0, 8, 8, 0]}
                  >
                    {veiculosChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
            </div>
          )}
        </div>

        {/* Marcas Mais Lucrativas */}
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4">Marcas Mais Lucrativas</h3>
          {marcasChartData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={marcasChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={120}
                    tick={{ fill: 'hsl(var(--foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    wrapperStyle={{
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `R$ ${Number(value).toLocaleString('pt-BR')}`,
                      `Lucro (Margem: ${props.payload.margem.toFixed(1)}%)`,
                    ]}
                    labelFormatter={(label) => `Marca: ${label}`}
                    labelStyle={{
                      fontSize: '11px',
                      marginBottom: '4px',
                    }}
                  />
                  <Bar
                    dataKey="lucro"
                    radius={[0, 8, 8, 0]}
                  >
                    {marcasChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
            </div>
          )}
        </div>
      </div>

      {/* Rankings Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
        {/* Veículos em Estoque há Mais Tempo */}
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4">Veículos em Estoque há Mais Tempo</h3>
          {estoqueChartData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={estoqueChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={120}
                    tick={{ fill: 'hsl(var(--foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    wrapperStyle={{
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    formatter={(value: number) => [
                      `${Number(value)} ${Number(value) === 1 ? 'dia' : 'dias'}`,
                      'Tempo em estoque',
                    ]}
                    labelFormatter={(label) => `Veículo: ${label}`}
                    labelStyle={{
                      fontSize: '11px',
                      marginBottom: '4px',
                    }}
                  />
                  <Bar
                    dataKey="dias"
                    radius={[0, 8, 8, 0]}
                  >
                    {estoqueChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-sm text-muted-foreground">Nenhum veículo em estoque</p>
            </div>
          )}
        </div>

        {/* Veículos que Venderam Mais Rápido */}
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4">Veículos que Venderam Mais Rápido</h3>
          {vendaRapidaChartData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={vendaRapidaChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={120}
                    tick={{ fill: 'hsl(var(--foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    wrapperStyle={{
                      maxWidth: 'calc(100vw - 40px)',
                    }}
                    formatter={(value: number) => [
                      `${Number(value)} ${Number(value) === 1 ? 'dia' : 'dias'}`,
                      'Tempo até venda',
                    ]}
                    labelFormatter={(label) => `Veículo: ${label}`}
                    labelStyle={{
                      fontSize: '11px',
                      marginBottom: '4px',
                    }}
                  />
                  <Bar
                    dataKey="dias"
                    radius={[0, 8, 8, 0]}
                  >
                    {vendaRapidaChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <p className="text-sm text-muted-foreground">Nenhuma venda no período</p>
            </div>
          )}
        </div>
      </div>

          </TabsContent>

          <TabsContent value="colaboradores" className="space-y-6 mt-4">
            <p className="text-muted-foreground">Relatório completo por vendedor. Selecione um vendedor para ver vendas, faturamento e evolução de comissão.</p>
            {vendedores.length === 0 ? (
              <div className="card-elevated p-8 text-center text-muted-foreground">
                <UserCog className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum vendedor cadastrado.</p>
              </div>
            ) : !selectedCollaboratorId ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {vendedores.map((row) => (
                  <button
                    key={row.userId}
                    type="button"
                    onClick={() => setSelectedCollaboratorId(row.userId)}
                    className="card-elevated p-4 text-left hover:bg-muted/30 transition-colors rounded-lg border border-border"
                  >
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="text-xs text-muted-foreground mb-2">{row.email}</div>
                    <div className="flex gap-4 text-sm">
                      <span><span className="text-muted-foreground">Vendas:</span> {row.vendasCount}</span>
                      <span><span className="text-muted-foreground">Total vendido:</span> {formatCurrency(row.totalVendido)}</span>
                      <span><span className="text-muted-foreground">Comissão:</span> {formatCurrency(row.totalComissao)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCollaboratorId(null)} className="gap-1">
                    <X className="w-4 h-4" />
                    Voltar aos vendedores
                  </Button>
                  {collaboratorReport && (
                    <span className="text-sm font-medium text-foreground">
                      {collaboratorReport.collaborator.name}
                    </span>
                  )}
                </div>
                {isLoadingCollaborator ? (
                  <p className="text-muted-foreground">Carregando relatório...</p>
                ) : collaboratorReport ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-3">
                      <div className="card-elevated p-6">
                        <div className="flex flex-col gap-4 h-full">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">Veículos Vendidos</p>
                            <Car className="w-8 h-8 text-foreground" />
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <p className="card-value-number text-foreground">{collaboratorReport.summary.veiculosVendidos}</p>
                            <p className="text-xs text-muted-foreground mt-2">Quantidade no período</p>
                          </div>
                        </div>
                      </div>
                      <div className="card-elevated p-6">
                        <div className="flex flex-col gap-4 h-full">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">Faturamento</p>
                            <DollarSign className="w-8 h-8 text-foreground" />
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <p className="card-value-number text-foreground">{formatCurrency(collaboratorReport.summary.totalVendido)}</p>
                            <p className="text-xs text-muted-foreground mt-2">Total das vendas</p>
                          </div>
                        </div>
                      </div>
                      <div className="card-elevated p-6">
                        <div className="flex flex-col gap-4 h-full">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">Comissão</p>
                            <TrendingUp className="w-8 h-8 text-success" />
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <p className="card-value-number text-success">{formatCurrency(collaboratorReport.summary.totalComissao)}</p>
                            <p className="text-xs text-muted-foreground mt-2">Comissão no período</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="card-elevated p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">Evolução de comissão</h3>
                      </div>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={collaboratorReport.comissaoMensais?.map((m) => ({ month: m.month, comissao: m.comissao })) ?? []}>
                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                              formatter={(value: number) => [formatCurrency(value), 'Comissão']}
                            />
                            <Line type="monotone" dataKey="comissao" name="Comissão" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="card-elevated overflow-hidden">
                      <div className="p-4 border-b border-border">
                        <h2 className="font-semibold text-foreground">Histórico de vendas</h2>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-medium">Data</th>
                              <th className="text-left p-3 font-medium">Veículo</th>
                              <th className="text-left p-3 font-medium hidden sm:table-cell">Cliente</th>
                              <th className="text-right p-3 font-medium">Valor venda</th>
                              <th className="text-right p-3 font-medium">Comissão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {collaboratorReport.vendas.length === 0 ? (
                              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma venda no período.</td></tr>
                            ) : (
                              collaboratorReport.vendas.map((v) => (
                                <tr key={v.id} className="border-b">
                                  <td className="p-3">{format(new Date(v.saleDate), 'dd/MM/yyyy', { locale: ptBR })}</td>
                                  <td className="p-3">{v.vehicle ?? '—'}</td>
                                  <td className="p-3 hidden sm:table-cell">{v.clientName ?? '—'}</td>
                                  <td className="p-3 text-right">{formatCurrency(v.salePrice)}</td>
                                  <td className="p-3 text-right">{v.commissionAmount != null ? formatCurrency(v.commissionAmount) : '—'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Rodapé: assinatura e aviso legal (impressão/export) */}
      {(reportResponsible || storeName || includeLegalNotice) && (
        <div className="border-t border-border pt-4 mt-6 space-y-2 print:mt-4">
          {(reportResponsible || storeName) && (
            <p className="text-sm text-muted-foreground text-center">
              Relatório emitido por: {reportResponsible || storeName}
            </p>
          )}
          {includeLegalNotice && (
            <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
              {legalNoticeText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Relatorios;
