import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Trash2, Pencil, Car, DollarSign, TrendingUp, Package, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
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
import { TruncatedText } from '@/components/ui/TruncatedText';
import { RegisterSaleModal } from '@/components/modals/RegisterSaleModal';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { SaleReceiptModal } from '@/components/modals/SaleReceiptModal';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Vendas = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<{ id: string; vehicleName: string } | null>(null);
  const [saleToViewReceipt, setSaleToViewReceipt] = useState<Sale | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [profitFilter, setProfitFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  
  const { data: salesData, isLoading, isError, error, refetch } = useSales({ 
    search: searchTerm || undefined,
    page,
    limit
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
      filtered = filtered.filter((v) => v.paymentMethod === paymentFilter);
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
                <p className="text-sm font-medium text-muted-foreground">Veículos vendidos</p>
                <Car className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-foreground">
                  {stats.totalSold}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de veículos vendidos</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Faturamento total</p>
                <DollarSign className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-success">
                  <HiddenValue value={formatCurrencyValue(stats.totalRevenue)} />
                </p>
                <p className="text-xs text-muted-foreground mt-2">Soma de todas as vendas</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Lucro total</p>
                <TrendingUp className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-info">
                  <HiddenValue value={formatCurrencyValue(stats.totalProfit)} />
                </p>
                <p className="text-xs text-muted-foreground mt-2">Lucro acumulado de todas as vendas</p>
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


      {/* Filtros e Busca */}
      <div className="card-elevated p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
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
          <div className="flex flex-wrap gap-2">
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

      {/* Tabela de Vendas — scroll horizontal no mobile */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
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
                      <TruncatedText 
                        text={vehicleName}
                        maxWidth="200px"
                      >
                        {vehicleName}
                      </TruncatedText>
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
                          "font-medium text-white",
                          hasProfit ? "bg-success" : "bg-destructive"
                        )}
                      >
                        <HiddenValue value={formatCurrencyValue(Math.abs(venda.profit))} />
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(venda.saleDate).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-medium">
                        {venda.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

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
                  value={limit.toString()}
                  onValueChange={(value) => {
                    setLimit(parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((l) => (
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
