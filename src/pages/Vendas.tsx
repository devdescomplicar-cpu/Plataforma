import { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Search, MoreHorizontal, Trash2, Pencil, Car, DollarSign, TrendingUp, Package, ChevronLeft, ChevronRight, FileText, User, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HiddenValue } from '@/contexts/AppContext';
import { useSales, useDeleteSale, useSalesStats, useSalesByMonth, Sale } from '@/hooks/useSales';
import { QueryErrorState } from '@/components/QueryErrorState';
import { cn, toPublicImageUrl } from '@/lib/utils';
import { formatDateBR } from '@/lib/date-br';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { RegisterSaleModal } from '@/components/modals/RegisterSaleModal';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { SaleReceiptModal } from '@/components/modals/SaleReceiptModal';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCollaborators } from '@/hooks/useCollaborators';
import { useUser } from '@/hooks/useUser';
import { SaleCard } from '@/components/sales/SaleCard';

type ViewMode = 'list' | 'card';

// Função para parsear formas de pagamento (apenas nomes)
const parsePaymentMethods = (paymentMethod: string): string[] => {
  if (!paymentMethod) return [];
  
  // Se não contém vírgula, é uma única forma de pagamento
  if (!paymentMethod.includes(',')) {
    // Verificar se tem formato METHOD:VALUE
    if (paymentMethod.includes(':')) {
      const [method] = paymentMethod.split(':').map(s => s.trim());
      return [method];
    }
    return [paymentMethod];
  }
  
  // Múltiplas formas de pagamento separadas por vírgula
  return paymentMethod
    .split(',')
    .map(part => part.trim())
    .filter(part => part)
    .map(part => {
      if (part.includes(':')) {
        const [method] = part.split(':').map(s => s.trim());
        return method;
      }
      return part;
    });
};

// Função para parsear formas de pagamento com valores
const parsePaymentMethodsWithValues = (paymentMethod: string): Array<{ method: string; value: number }> => {
  if (!paymentMethod) return [];
  
  // Se não contém vírgula, é uma única forma de pagamento
  if (!paymentMethod.includes(',')) {
    // Verificar se tem formato METHOD:VALUE
    if (paymentMethod.includes(':')) {
      const [method, valueStr] = paymentMethod.split(':').map(s => s.trim());
      const value = valueStr ? parseFloat(valueStr) : 0; // Valores já estão em reais
      return [{ method, value }];
    }
    return [{ method: paymentMethod, value: 0 }];
  }
  
  // Múltiplas formas de pagamento separadas por vírgula
  return paymentMethod
    .split(',')
    .map(part => part.trim())
    .filter(part => part)
    .map(part => {
      if (part.includes(':')) {
        const [method, valueStr] = part.split(':').map(s => s.trim());
        const value = valueStr ? parseFloat(valueStr) : 0; // Valores já estão em reais
        return { method, value };
      }
      return { method: part, value: 0 };
    });
};

const DESKTOP_BREAKPOINT = 1024;

const Vendas = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<{ id: string; vehicleName: string } | null>(null);
  const [saleToViewReceipt, setSaleToViewReceipt] = useState<Sale | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [profitFilter, setProfitFilter] = useState<string>('all');
  const [collaboratorFilter, setCollaboratorFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT ? 'list' : 'card'
  );
  const listLimits = [10, 25, 50, 100];
  const cardLimits = [12, 24, 48, 96];
  const [listLimit, setListLimit] = useState(10);
  const [cardLimit, setCardLimit] = useState(12);
  const currentLimit = viewMode === 'list' ? listLimit : cardLimit;

  useEffect(() => {
    setPage(1);
  }, [viewMode, listLimit, cardLimit]);

  const { data: userData } = useUser();
  // Buscar colaboradores apenas se for dono da conta
  const { data: collaborators = [], isLoading: isLoadingCollaborators } = useCollaborators();
  
  // Mostrar apenas colaboradores ATIVOS (vendedores e gerentes)
  // Também incluir o próprio usuário se ele não for dono (colaborador)
  const allCollaborators = useMemo(() => {
    // Filtrar apenas colaboradores ativos
    const active = collaborators
      .filter((c) => c.status === 'active')
      .map((c) => ({
        userId: c.userId,
        name: c.name,
        role: c.role,
        status: c.status,
      }));
    
    // Se o usuário atual não é dono e não está na lista de colaboradores, adicionar ele mesmo
    if (userData?.user && !userData.isAccountOwner && !active.find((c) => c.userId === userData.user.id)) {
      return [
        {
          userId: userData.user.id,
          name: userData.user.name,
          role: 'seller' as const,
          status: 'active' as const,
        },
        ...active,
      ];
    }
    
    // Se for dono, adicionar ele mesmo na lista
    if (userData?.user && userData.isAccountOwner && !active.find((c) => c.userId === userData.user.id)) {
      return [
        {
          userId: userData.user.id,
          name: userData.user.name,
          role: 'manager' as const,
          status: 'active' as const,
        },
        ...active,
      ];
    }
    
    return active;
  }, [collaborators, userData]);
  const { data: salesData, isLoading, isError, error, refetch } = useSales({ 
    search: searchTerm || undefined,
    page,
    limit: currentLimit,
    registeredById: collaboratorFilter !== 'all' ? collaboratorFilter : undefined,
  });
  const { data: statsData, isLoading: isLoadingStats } = useSalesStats();
  const deleteSaleMutation = useDeleteSale();
  
  const vendas = salesData?.data || [];
  const pagination = salesData?.pagination;
  const stats = statsData || {
    totalSold: 0,
    totalRevenue: 0,
    totalProfit: 0,
    vehiclesInStock: 0,
  };

  // Filtrar vendas (filtros client-side para payment e profit)
  const filteredSales = useMemo(() => {
    let filtered = vendas;

    if (paymentFilter !== 'all') {
      filtered = filtered.filter((v) => {
        const methods = parsePaymentMethods(v.paymentMethod);
        return methods.includes(paymentFilter);
      });
    }

    if (profitFilter === 'profit') {
      filtered = filtered.filter((v) => v.profit > 0);
    } else if (profitFilter === 'loss') {
      filtered = filtered.filter((v) => v.profit < 0);
    }

    return filtered;
  }, [vendas, paymentFilter, profitFilter]);

  const handleDeleteSale = async () => {
    if (!saleToDelete) return;

    try {
      await deleteSaleMutation.mutateAsync(saleToDelete.id);
      toast({
        title: 'Venda cancelada',
        description: 'A venda foi cancelada e o veículo retornou ao estoque.',
      });
      setSaleToDelete(null);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.response?.data?.error?.message || 'Erro ao excluir venda',
        variant: 'destructive',
      });
    }
  };

  const formatCurrencyValue = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const isSeller = userData?.collaboratorRole === 'seller';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas vendas e visualize resultados</p>
        </div>
        <Button onClick={() => setIsRegisterModalOpen(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Registrar Venda
        </Button>
      </div>

      {/* Cards de Estatísticas — 2 por linha no mobile; card sozinho estica */}
      {isLoadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-elevated p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {isSeller ? 'Meus veículos vendidos' : 'Veículos vendidos'}
                </p>
                <Car className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-foreground">
                  {stats.totalSold}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {isSeller ? 'Total de veículos que você vendeu' : 'Total de veículos vendidos'}
                </p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {isSeller ? 'Meu faturamento total' : 'Faturamento total'}
                </p>
                <DollarSign className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-success">
                  <HiddenValue value={formatCurrencyValue(stats.totalRevenue)} />
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {isSeller ? 'Soma de todas as suas vendas' : 'Soma de todas as vendas'}
                </p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {isSeller ? 'Minha comissão' : 'Lucro total'}
                </p>
                <TrendingUp className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-info">
                  <HiddenValue value={formatCurrencyValue(stats.totalProfit)} />
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {isSeller ? 'Comissão acumulada de todas as suas vendas' : 'Lucro acumulado de todas as vendas'}
                </p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Veículos em estoque</p>
                <Package className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-foreground">
                  {stats.vehiclesInStock}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Veículos disponíveis para venda</p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Filtros e Busca: desktop = toggle à direita; mobile = busca + toggle na mesma linha */}
      <div className="card-elevated p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-0 max-w-md order-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por veículo, cliente..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-md border border-border p-1 bg-muted/30 order-2 md:order-3">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
              title="Modo Lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('card')}
              title="Modo Card"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 order-3 md:order-2 md:w-auto md:flex-1">
            {(allCollaborators.length > 0 || userData?.user) && (
              <Select
                value={collaboratorFilter}
                onValueChange={(value) => {
                  setCollaboratorFilter(value);
                  setPage(1);
                }}
                disabled={isLoadingCollaborators}
              >
                <SelectTrigger className="w-full min-w-0 sm:w-[240px]">
                  <SelectValue placeholder="Todos os colaboradores">
                    {collaboratorFilter === 'all' 
                      ? 'Todos os colaboradores'
                      : (() => {
                          const selected = allCollaborators.find(c => c.userId === collaboratorFilter);
                          if (!selected) return 'Todos os colaboradores';
                          const isOwner = userData?.isAccountOwner && selected.userId === userData.user.id;
                          const isCurrentUser = !userData?.isAccountOwner && selected.userId === userData?.user?.id;
                          return isOwner ? `${selected.name} (Dono)` : isCurrentUser ? `${selected.name} (Você)` : selected.name;
                        })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">Todos os colaboradores</SelectItem>
                  {allCollaborators.map((collaborator) => {
                    const isOwner = userData?.isAccountOwner && collaborator.userId === userData.user.id;
                    const isCurrentUser = !userData?.isAccountOwner && collaborator.userId === userData?.user?.id;
                    const roleLabel = collaborator.role === 'manager' ? 'Gerente' : 'Vendedor';
                    const displayText = isOwner 
                      ? `${collaborator.name} (Dono)`
                      : isCurrentUser 
                        ? `${collaborator.name} (Você)`
                        : `${collaborator.name} - ${roleLabel}`;
                    
                    return (
                      <SelectItem key={collaborator.userId} value={collaborator.userId} className="py-2">
                        {displayText}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            <Select
              value={paymentFilter}
              onValueChange={(value) => {
                setPaymentFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full min-w-0 sm:w-[200px]">
                <SelectValue placeholder="Forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pagamentos</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="DINHEIRO">DINHEIRO</SelectItem>
                <SelectItem value="CARTÃO DE CRÉDITO">CARTÃO DE CRÉDITO</SelectItem>
                <SelectItem value="FINANCIAMENTO">FINANCIAMENTO</SelectItem>
                <SelectItem value="TROCA">TROCA</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={profitFilter}
              onValueChange={(value) => {
                setProfitFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full min-w-0 sm:w-[150px]">
                <SelectValue placeholder="Lucro/Prejuízo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="profit">Com lucro</SelectItem>
                <SelectItem value="loss">Com prejuízo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Conteúdo: Lista ou Cards */}
      {viewMode === 'list' ? (
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold w-[80px]"></TableHead>
              <TableHead className="font-semibold">Veículo</TableHead>
              <TableHead className="font-semibold">Comprador</TableHead>
              <TableHead className="font-semibold">Valor da venda</TableHead>
              <TableHead className="font-semibold">Custo</TableHead>
              <TableHead className="font-semibold">Lucro/Prejuízo</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
              <TableHead className="font-semibold">Pagamento</TableHead>
              <TableHead className="font-semibold w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <QueryErrorState message={error?.message} onRetry={() => refetch()} variant="inline" />
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">Carregando vendas...</p>
                </TableCell>
              </TableRow>
            ) : filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma venda encontrada</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((venda) => {
                const vehicleName = venda.vehicle 
                  ? `${venda.vehicle.brand} ${venda.vehicle.model} ${venda.vehicle.year}`
                  : 'N/A';
                const hasProfit = venda.profit >= 0;
                const vehicleImage = venda.vehicle?.image;
                
                // Componente interno para tooltip com controle manual
                const PaymentMethodsTooltip = ({ methods, methodsWithValues }: { methods: string[], methodsWithValues: Array<{ method: string; value: number }> }) => {
                  const [open, setOpen] = useState(false);
                  
                  return (
                    <Tooltip open={open} onOpenChange={setOpen}>
                      <TooltipTrigger asChild>
                        <span 
                          className="inline-block"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpen(!open);
                          }}
                        >
                          <Badge 
                            variant="outline" 
                            className="font-medium text-xs whitespace-nowrap shrink-0 cursor-pointer touch-manipulation"
                          >
                            +{methods.length - 1}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="top" 
                        align="end" 
                        className="max-w-[240px] p-2 z-[9999]" 
                        sideOffset={5}
                        alignOffset={-40}
                        onPointerDownOutside={() => setOpen(false)}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-xs mb-1.5">Formas de Pagamento:</p>
                          {methodsWithValues.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium truncate flex-1 min-w-0">{item.method}</span>
                              {item.value > 0 ? (
                                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                                  R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px] shrink-0">—</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                };
                
                return (
                  <TableRow key={venda.id} className="group hover:bg-muted/30">
                    <TableCell>
                      {vehicleImage ? (
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img
                            src={vehicleImage}
                            alt={vehicleName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <Car className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="space-y-1.5">
                        <TruncatedText 
                          text={vehicleName}
                          maxWidth="200px"
                        >
                          {vehicleName}
                        </TruncatedText>
                        {venda.registeredBy?.name && (
                          <div className="flex min-w-0 max-w-full items-center justify-start mt-1.5">
                            <Badge variant="secondary" className="text-xs font-normal px-2.5 py-1 bg-primary/10 text-primary border-primary/20 max-w-[220px] flex items-center min-w-0">
                              <User className="w-3 h-3 mr-1.5 shrink-0" />
                              <span className="truncate min-w-0">Vendido por: {venda.registeredBy.name}</span>
                            </Badge>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TruncatedText 
                        text={venda.client?.name ?? 'N/A'}
                        maxWidth="150px"
                      >
                        {venda.client?.name ?? 'N/A'}
                      </TruncatedText>
                    </TableCell>
                    <TableCell className="font-medium">
                      <HiddenValue value={formatCurrencyValue(venda.salePrice)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <HiddenValue value={formatCurrencyValue(venda.salePrice - venda.profit)} />
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={cn(
                          "font-medium text-white gap-1.5",
                          hasProfit ? "bg-success" : "bg-destructive"
                        )}
                      >
                        {hasProfit ? (
                          <Plus className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <HiddenValue value={formatCurrencyValue(Math.abs(venda.profit))} />
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateBR(venda.saleDate)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const methods = parsePaymentMethods(venda.paymentMethod);
                        const methodsWithValues = parsePaymentMethodsWithValues(venda.paymentMethod);
                        
                        if (methods.length === 0) {
                          return (
                            <Badge variant="secondary" className="font-medium">
                              {venda.paymentMethod || '—'}
                            </Badge>
                          );
                        }
                        
                        // Se for apenas uma forma de pagamento, exibir normalmente
                        if (methods.length === 1) {
                          return (
                            <Badge variant="secondary" className="font-medium whitespace-nowrap">
                              {methods[0]}
                            </Badge>
                          );
                        }
                        
                        // Múltiplas formas (2+): exibir primeira forma + badge "+N" com tooltip
                        return (
                          <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                            <Badge 
                              variant="secondary" 
                              className="font-medium text-xs whitespace-nowrap shrink-0"
                            >
                              {methods[0].length > 12 ? `${methods[0].substring(0, 10)}...` : methods[0]}
                            </Badge>
                            <PaymentMethodsTooltip methods={methods} methodsWithValues={methodsWithValues} />
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Verificar se é vendedor e se a venda foi registrada por ele
                        const isSeller = userData?.collaboratorRole === 'seller';
                        const isOwnSale = venda.registeredBy?.id === userData?.user?.id;
                        const canEditOrDelete = !isSeller || isOwnSale;
                        
                        return (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border border-border">
                              <DropdownMenuItem 
                                className="gap-2"
                                onClick={() => setSaleToViewReceipt(venda)}
                              >
                                <FileText className="w-4 h-4" />
                                Ver Comprovante
                              </DropdownMenuItem>
                              {canEditOrDelete && (
                                <>
                                  <DropdownMenuItem 
                                    className="gap-2"
                                    onClick={() => setSaleToEdit(venda)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="gap-2 text-destructive"
                                    onClick={() => setSaleToDelete({ id: venda.id, vehicleName })}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Cancelar venda
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </TooltipProvider>
        </div>
      </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isError ? (
          <div className="col-span-full">
            <QueryErrorState message={error?.message} onRetry={() => refetch()} variant="inline" />
          </div>
        ) : isLoading ? (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">Carregando vendas...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Car className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">Nenhuma venda encontrada</p>
            <p className="text-sm text-muted-foreground max-w-md text-center">Ajuste os filtros ou registre uma nova venda.</p>
          </div>
        ) : (
          filteredSales.map((venda) => {
            const vehicleName = venda.vehicle
              ? `${venda.vehicle.brand} ${venda.vehicle.model} ${venda.vehicle.year}`
              : 'N/A';
            const isSeller = userData?.collaboratorRole === 'seller';
            const isOwnSale = venda.registeredBy?.id === userData?.user?.id;
            const canEditOrDelete = !isSeller || isOwnSale;
            return (
              <SaleCard
                key={venda.id}
                sale={venda}
                formatCurrency={formatCurrencyValue}
                onViewReceipt={setSaleToViewReceipt}
                onEdit={setSaleToEdit}
                onCancel={() => setSaleToDelete({ id: venda.id, vehicleName })}
                canEditOrDelete={canEditOrDelete}
              />
            );
          })
        )}
      </div>
      )}

      {/* Paginação */}
      {pagination && pagination.totalPages > 0 && (
        <div className="card-elevated p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Informações e seletor de limite */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                <span className="hidden sm:inline">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} vendas
                </span>
                <span className="sm:hidden">{pagination.total} vendas</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">Itens por página:</span>
                <span className="text-sm text-muted-foreground sm:hidden">Por página:</span>
                <Select
                  value={currentLimit.toString()}
                  onValueChange={(value) => {
                    const newLimit = parseInt(value);
                    if (viewMode === 'list') setListLimit(newLimit);
                    else setCardLimit(newLimit);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(viewMode === 'list' ? listLimits : cardLimits).map((l) => (
                      <SelectItem key={l} value={l.toString()}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Controles de navegação */}
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={pagination.page <= 1}
                  className="hidden sm:inline-flex"
                >
                  Primeira
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <span className="text-sm text-muted-foreground px-2 whitespace-nowrap">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(pagination.totalPages)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="hidden sm:inline-flex"
                >
                  Última
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RegisterSaleModal 
        open={isRegisterModalOpen || !!saleToEdit} 
        onOpenChange={(open) => {
          if (!open) {
            setIsRegisterModalOpen(false);
            setSaleToEdit(null);
          } else {
            setIsRegisterModalOpen(true);
          }
        }}
        preselectedVehicleId={saleToEdit?.vehicleId || null}
        saleToEdit={saleToEdit}
      />
      
      <ConfirmDialog
        open={!!saleToDelete}
        onOpenChange={(open) => !open && setSaleToDelete(null)}
        title="Cancelar venda"
        description={`Tem certeza que deseja cancelar a venda do veículo "${saleToDelete?.vehicleName}"? A venda será cancelada e o veículo retornará ao estoque.`}
        onConfirm={handleDeleteSale}
        confirmText="Cancelar venda"
        variant="destructive"
      />

      <SaleReceiptModal
        open={!!saleToViewReceipt}
        onOpenChange={(open) => !open && setSaleToViewReceipt(null)}
        sale={saleToViewReceipt}
      />
    </div>
  );
};

export default Vendas;
