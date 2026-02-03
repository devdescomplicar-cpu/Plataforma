import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, MoreHorizontal, Eye, Pencil, Trash2, Car, DollarSign, RotateCcw, Wrench, CheckCircle2, XCircle, LayoutGrid, List, Filter, X, Clock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { QueryErrorState } from '@/components/QueryErrorState';
import { HiddenValue } from '@/contexts/AppContext';
import { cn, toPublicImageUrl } from '@/lib/utils';
import { AddVehicleModal } from '@/components/modals/AddVehicleModal';
import { VehicleDetailsModal } from '@/components/modals/VehicleDetailsModal';
import { EditVehicleModal } from '@/components/modals/EditVehicleModal';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { RegisterSaleModal } from '@/components/modals/RegisterSaleModal';
import { AddExpenseModal } from '@/components/modals/AddExpenseModal';
import { VehicleExpensesCell } from '@/components/VehicleExpensesCell';
import { useVehicles, useDeleteVehicle, useUpdateVehicle } from '@/hooks/useVehicles';
import { useSales, useDeleteSale } from '@/hooks/useSales';
import { useVehiclesMetrics } from '@/hooks/useVehiclesMetrics';
import { useSettings } from '@/hooks/useSettings';
import { Vehicle, VehicleCard } from '@/components/dashboard/VehicleCard';
import { toast } from '@/hooks/use-toast';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { VEHICLE_COLORS } from '@/components/ui/ColorSelect';
import { ImageGalleryModal } from '@/components/modals/ImageGalleryModal';

type StatusFilter = 'all' | 'available' | 'sold';
type OriginFilter = 'all' | 'own' | 'consignment' | 'repass';
type ViewMode = 'list' | 'card';

const Veiculos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [page, setPage] = useState(1);
  
  // Limites diferentes para lista e card
  const listLimits = [10, 25, 50, 100];
  const cardLimits = [12, 24, 48, 96];
  const defaultListLimit = 10;
  const defaultCardLimit = 12;
  
  const [listLimit, setListLimit] = useState(defaultListLimit);
  const [cardLimit, setCardLimit] = useState(defaultCardLimit);
  
  // Limite atual baseado no modo de visualização
  const currentLimit = viewMode === 'list' ? listLimit : cardLimit;
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [vehicleToMarkAsSold, setVehicleToMarkAsSold] = useState<{ id: string; name: string; salePrice?: number } | null>(null);
  const [vehicleToView, setVehicleToView] = useState<string | null>(null);
  const [vehicleToEdit, setVehicleToEdit] = useState<string | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [vehicleToAddExpense, setVehicleToAddExpense] = useState<{ id: string; name: string } | null>(null);
  const [galleryVehicle, setGalleryVehicle] = useState<{ id: string; images: Array<{ id: string; url: string; key: string; order: number }> } | null>(null);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  
  // Resetar página quando mudar filtros ou modo de visualização
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, originFilter, viewMode, listLimit, cardLimit]);
  
  const { data: vehiclesData, isLoading, isError, error, refetch } = useVehicles({ 
    search: searchTerm || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    origin: originFilter === 'all' ? undefined : originFilter,
    page,
    limit: currentLimit
  });
  const { data: metrics } = useVehiclesMetrics();
  const { data: settingsData } = useSettings();
  const deleteVehicleMutation = useDeleteVehicle();
  const updateVehicleMutation = useUpdateVehicle();
  const deleteSaleMutation = useDeleteSale();
  const { data: allSalesData } = useSales();

  const vehicles = vehiclesData?.data || [];
  const pagination = vehiclesData?.pagination;
  const filteredVehicles = vehicles; // Filtro já é feito no backend

  const expenseTypes = useMemo(() => {
    const categories = settingsData?.settings?.expenseCategories || [];
    return [...categories, 'Outro'] as const;
  }, [settingsData]);

  const handleReturnToStock = useCallback(
    async (vehicleId: string) => {
      const allSales = allSalesData?.data || [];
      const vehicleSale = allSales.find((sale) => sale.vehicleId === vehicleId);

      if (vehicleSale) {
        try {
          await deleteSaleMutation.mutateAsync(vehicleSale.id);
          toast({
            title: (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Venda cancelada</span>
              </div>
            ),
            description: "A venda foi cancelada e o veículo retornou ao estoque.",
          });
        } catch (err: unknown) {
          const message = err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
            : undefined;
          toast({
            title: "Erro ao cancelar venda",
            description: message || "Tente novamente.",
            variant: "destructive",
          });
        }
      } else {
        updateVehicleMutation.mutate(
          { id: vehicleId, status: "available" },
          {
            onSuccess: () => {
              toast({
                title: (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Veículo retornado ao estoque</span>
                  </div>
                ),
                description: "O veículo está disponível novamente para venda.",
              });
            },
            onError: (err) => {
              toast({
                title: "Erro ao atualizar",
                description: err instanceof Error ? err.message : "Tente novamente.",
                variant: "destructive",
              });
            },
          }
        );
      }
    },
    [allSalesData?.data, deleteSaleMutation, updateVehicleMutation, toast]
  );

  const statusConfig = {
    available: { label: 'Em estoque', className: 'bg-info text-white' },
    reserved: { label: 'Reservado', className: 'bg-warning-soft text-warning' },
    sold: { label: 'Vendido', className: 'bg-green-600 text-white' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu estoque de veículos</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Novo Veículo
        </Button>
      </div>

      {/* Metrics Cards — 2 por linha no mobile; card sozinho estica */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total de Veículos</p>
                <Car className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-foreground">{metrics.totalVehicles}</p>
                <p className="text-xs text-muted-foreground mt-2">Total de veículos cadastrados no sistema</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Vendidos</p>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-green-600">{metrics.totalSold}</p>
                <p className="text-xs text-muted-foreground mt-2">Veículos vendidos e finalizados</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Em Estoque</p>
                <Car className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-info">{metrics.totalInStock}</p>
                <p className="text-xs text-muted-foreground mt-2">Veículos disponíveis para venda</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio</p>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-purple-500">{metrics.avgDaysInStock}</p>
                <p className="text-xs text-muted-foreground mt-2">Tempo médio em estoque (dias)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search, Filters and View Toggle Container */}
      <div className="card-elevated p-4 space-y-4">
        {/* Search Bar + View Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por marca, modelo ou placa..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
          
          {/* View Mode Toggle - Alinhado à direita */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
              title="Modo Lista"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('card')}
              title="Modo Card"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Status Tabs + Advanced Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Status Filters - Tabs principais */}
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger 
                value="all"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Todos
              </TabsTrigger>
              <TabsTrigger 
                value="available"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Em Estoque
              </TabsTrigger>
              <TabsTrigger 
                value="sold"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Vendidos
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Advanced Filters Button */}
          <Popover>
            <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
                Filtros Avançados
                {originFilter !== 'all' && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-primary" />
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-3">Filtros Avançados</h4>
                  
                  {/* Origin Filter */}
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="origin-filter">Origem</Label>
                    <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as OriginFilter)}>
                      <SelectTrigger id="origin-filter">
                        <SelectValue placeholder="Todas as Origens" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Origens</SelectItem>
                        <SelectItem value="own">Próprio</SelectItem>
                        <SelectItem value="consignment">Consignado</SelectItem>
                        <SelectItem value="repass">Repasse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters */}
                  {originFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-4"
                      onClick={() => {
                        setOriginFilter('all');
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpar Filtros
        </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Content - List or Card View */}
      {viewMode === 'list' ? (
        /* Table View — scroll horizontal no mobile */
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Veículo</TableHead>
              <TableHead className="font-semibold">Placa</TableHead>
              <TableHead className="font-semibold">Preço Compra</TableHead>
              <TableHead className="font-semibold">Despesas</TableHead>
              <TableHead className="font-semibold">Preço Venda</TableHead>
              <TableHead className="font-semibold">FIPE</TableHead>
              <TableHead className="font-semibold">Lucro</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Dias</TableHead>
              <TableHead className="font-semibold w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <QueryErrorState message={error?.message} onRetry={() => refetch()} variant="inline" />
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <p className="text-muted-foreground">Carregando veículos...</p>
                </TableCell>
              </TableRow>
            ) : filteredVehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Car className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-lg font-medium text-foreground mb-2">Nenhum veículo encontrado</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {searchTerm || statusFilter !== 'all' || originFilter !== 'all'
                        ? 'Tente ajustar os filtros de busca para encontrar veículos.'
                        : 'Comece adicionando seu primeiro veículo ao estoque.'}
                    </p>
                    {!searchTerm && statusFilter === 'all' && originFilter === 'all' && (
                      <Button
                        onClick={() => setIsAddModalOpen(true)}
                        className="mt-4 gap-2"
                        variant="outline"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Primeiro Veículo
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredVehicles.map((vehicle) => {
              const status = statusConfig[vehicle.status];
              return (
                <TableRow key={vehicle.id} className="group hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          // Sempre usar as imagens mais recentes do veículo
                          const currentImages = vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0
                            ? [...vehicle.images].sort((a, b) => (a.order || 0) - (b.order || 0))
                            : vehicle.image
                            ? [{ id: 'main', url: vehicle.image, key: '', order: 0 }]
                            : [];
                          
                          if (currentImages.length > 0) {
                            setGalleryVehicle({ id: vehicle.id, images: currentImages });
                            setGalleryInitialIndex(0);
                          }
                        }}
                      >
                        {(() => {
                          const imageUrl = toPublicImageUrl(vehicle.image);
                          return imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={`${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Car className="w-6 h-6 text-muted-foreground" />
                          </div>
                          );
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <TruncatedText 
                          text={`${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''}`}
                          maxWidth="250px"
                          className="font-medium text-foreground"
                        />
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <span>{vehicle.year}</span>
                          {vehicle.plate && (
                            <span className="flex items-center gap-1">
                              <span>•</span>
                              <span>{vehicle.plate}</span>
                            </span>
                          )}
                          {vehicle.km !== undefined && vehicle.km !== null && (
                            <span className="flex items-center gap-1">
                              <span>•</span>
                              <span>{vehicle.km.toLocaleString('pt-BR')} km</span>
                            </span>
                          )}
                          {vehicle.color && (
                            <span className="flex items-center gap-1">
                              <span>•</span>
                              {(() => {
                                const colorData = VEHICLE_COLORS.find(
                                  (c) => c.value.toLowerCase() === vehicle.color.toLowerCase()
                                );
                                
                                let colorHex = colorData?.hex || '#808080';
                                
                                // Se for um hex válido, usar diretamente
                                if (!colorData && /^#[0-9A-F]{6}$/i.test(vehicle.color)) {
                                  colorHex = vehicle.color;
                                }
                                
                                return (
                                  <div 
                                    className="w-3 h-3 rounded-full border border-border flex-shrink-0" 
                                    style={{ backgroundColor: colorHex }} 
                                  />
                                );
                              })()}
                              <span>{vehicle.color}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{vehicle.plate || '—'}</TableCell>
                  <TableCell>
                    {vehicle.purchasePrice ? (
                    <HiddenValue 
                      value={vehicle.purchasePrice.toLocaleString('pt-BR')} 
                      prefix="R$ " 
                    />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <VehicleExpensesCell vehicleId={vehicle.id} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {vehicle.salePrice ? (
                    <HiddenValue 
                      value={vehicle.salePrice.toLocaleString('pt-BR')} 
                      prefix="R$ " 
                    />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {vehicle.fipePrice ? (
                      <HiddenValue 
                        value={vehicle.fipePrice.toLocaleString('pt-BR')} 
                        prefix="R$ " 
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {vehicle.profit !== undefined && vehicle.profitPercent !== undefined ? (
                      <>
                    <span className="text-success font-medium">
                      <HiddenValue 
                        value={vehicle.profit.toLocaleString('pt-BR')} 
                        prefix="+R$ " 
                      />
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                          ({vehicle.profitPercent.toFixed(1)}%)
                    </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-medium pointer-events-none", status.className)}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "text-sm font-medium",
                      vehicle.daysInStock > 30 ? "text-warning" : "text-muted-foreground"
                    )}>
                      {vehicle.daysInStock}d
                    </span>
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
                          onClick={() => setVehicleToView(vehicle.id)}
                        >
                          <Eye className="w-4 h-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => setVehicleToEdit(vehicle.id)}
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                          onClick={() => {
                            setVehicleToAddExpense({
                              id: vehicle.id,
                              name: `${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''} ${vehicle.year}`,
                            });
                          }}
                        >
                          <Wrench className="w-4 h-4" />
                          <span className="font-medium">Adicionar Despesa</span>
                        </DropdownMenuItem>
                        {vehicle.status !== 'sold' ? (
                          <DropdownMenuItem 
                            className="gap-2 text-success focus:text-success focus:bg-success/10"
                            onClick={() => {
                              setVehicleToMarkAsSold({
                                id: vehicle.id,
                                name: `${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''} ${vehicle.year}`,
                                salePrice: vehicle.salePrice,
                              });
                            }}
                          >
                            <DollarSign className="w-4 h-4" />
                            <span className="font-medium">Marcar como Vendido</span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            className="gap-2 text-info focus:text-info focus:bg-info/10"
                            onClick={() => handleReturnToStock(vehicle.id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span className="font-medium">Voltar para Estoque</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="gap-2 text-destructive focus:text-destructive"
                          onClick={() => {
                            setVehicleToDelete({
                              id: vehicle.id,
                              name: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
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
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isError ? (
            <div className="col-span-full">
              <QueryErrorState message={error?.message} onRetry={() => refetch()} variant="inline" />
            </div>
          ) : isLoading ? (
            <div className="col-span-full text-center py-8">
              <p className="text-muted-foreground">Carregando veículos...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Car className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-medium text-foreground mb-2">Nenhum veículo encontrado</p>
              <p className="text-sm text-muted-foreground max-w-md text-center mb-4">
                {searchTerm || statusFilter !== 'all' || originFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca para encontrar veículos.'
                  : 'Comece adicionando seu primeiro veículo ao estoque.'}
              </p>
              {!searchTerm && statusFilter === 'all' && originFilter === 'all' && (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="gap-2"
                  variant="outline"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Primeiro Veículo
                </Button>
              )}
          </div>
          ) : (
            filteredVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={{
                  ...vehicle,
                  version: vehicle.version,
                  totalExpenses: vehicle.totalExpenses,
                  images: vehicle.images,
                } as Vehicle}
                onView={(id) => setVehicleToView(id)}
                onEdit={(id) => setVehicleToEdit(id)}
                onDelete={(id) => {
                  setVehicleToDelete({
                    id,
                    name: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`
                  });
                }}
                onAddExpense={(id) => {
                  setVehicleToAddExpense({
                    id,
                    name: `${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''} ${vehicle.year}`,
                  });
                }}
                onMarkAsSold={(id) => {
                  setVehicleToMarkAsSold({
                    id,
                    name: `${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''} ${vehicle.year}`,
                    salePrice: vehicle.salePrice,
                  });
                }}
                onReturnToStock={(id) => handleReturnToStock(id)}
              />
            ))
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
                <span className="hidden sm:inline">Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} veículos</span>
                <span className="sm:hidden">{pagination.total} veículos</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">Itens por página:</span>
                <span className="text-sm text-muted-foreground sm:hidden">Por página:</span>
                <Select
                  value={currentLimit.toString()}
                  onValueChange={(value) => {
                    const newLimit = parseInt(value);
                    if (viewMode === 'list') {
                      setListLimit(newLimit);
                    } else {
                      setCardLimit(newLimit);
                    }
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(viewMode === 'list' ? listLimits : cardLimits).map((limit) => (
                      <SelectItem key={limit} value={limit.toString()}>
                        {limit}
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

      {/* Image Gallery Modal */}
      {galleryVehicle && (
        <ImageGalleryModal
          key={`gallery-${galleryVehicle.id}-${galleryVehicle.images.length}-${galleryVehicle.images.map(img => img.id || img.url).join('-')}`}
          open={!!galleryVehicle}
          onOpenChange={(open) => !open && setGalleryVehicle(null)}
          images={galleryVehicle.images}
          initialIndex={galleryInitialIndex}
        />
      )}

      <AddVehicleModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      
      {/* Modal de Detalhes */}
      <VehicleDetailsModal 
        open={!!vehicleToView} 
        onOpenChange={(open) => !open && setVehicleToView(null)}
        vehicleId={vehicleToView}
      />

      {/* Modal de Edição */}
      <EditVehicleModal 
        open={!!vehicleToEdit} 
        onOpenChange={(open) => !open && setVehicleToEdit(null)}
        vehicleId={vehicleToEdit}
      />

      {/* Add Expense Modal */}
      <AddExpenseModal
        open={!!vehicleToAddExpense}
        onOpenChange={(open) => !open && setVehicleToAddExpense(null)}
        vehicleId={vehicleToAddExpense?.id || ''}
        expenseTypes={expenseTypes}
      />

      {/* Register Sale Modal */}
      <RegisterSaleModal
        open={!!vehicleToMarkAsSold}
        onOpenChange={(open) => !open && setVehicleToMarkAsSold(null)}
        preselectedVehicleId={vehicleToMarkAsSold?.id || null}
      />

      {/* Dialog de confirmação para excluir */}
      <ConfirmDialog
        open={!!vehicleToDelete}
        onOpenChange={(open) => !open && setVehicleToDelete(null)}
        onConfirm={() => {
          if (vehicleToDelete) {
            deleteVehicleMutation.mutate(vehicleToDelete.id, {
              onSuccess: () => {
                toast({
                  title: 'Veículo excluído',
                  description: `${vehicleToDelete.name} foi excluído com sucesso.`,
                });
                setVehicleToDelete(null);
              },
            });
          }
        }}
        title="Excluir Veículo"
        description={
          <>
            Tem certeza que deseja excluir o veículo <strong>{vehicleToDelete?.name}</strong>?
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              Esta ação não pode ser desfeita. O veículo será removido permanentemente do sistema.
            </span>
          </>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        icon={Trash2}
      />
    </div>
  );
};

export default Veiculos;
