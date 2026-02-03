import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Car, Receipt, TrendingUp, List, LayoutGrid, DollarSign, Gauge, Fuel, BarChart3, Wrench, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useVehiclesWithExpenses, useExpenses, useDeleteExpense } from '@/hooks/useExpenses';
import { useSettings } from '@/hooks/useSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditExpenseModal } from '@/components/modals/EditExpenseModal';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { QueryErrorState } from '@/components/QueryErrorState';
import { cn } from '@/lib/utils';
import { HiddenValue } from '@/contexts/AppContext';
import { AddExpenseFromVehiclesModal } from '@/components/modals/AddExpenseFromVehiclesModal';
import { VEHICLE_COLORS } from '@/components/ui/ColorSelect';
import { getExpenseTypeColor } from '@/utils/expenseColors';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { VehicleExpensesModal } from '@/components/modals/VehicleExpensesModal';

type ViewMode = 'list' | 'card';

const Despesas = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; type: string; value: number; vehicleName: string } | null>(null);
  const [isExpensesSectionOpen, setIsExpensesSectionOpen] = useState(true);
  const [expensesModalVehicle, setExpensesModalVehicle] = useState<{ id: string; name: string } | null>(null);
  
  const { data: settingsData } = useSettings();
  
  // Obter categorias das configurações + "Outro"
  const expenseTypes = useMemo(() => {
    const categories = settingsData?.settings?.expenseCategories || [];
    return [...categories, 'Outro'] as const;
  }, [settingsData]);
  
  // Paginação para veículos
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const listLimits = [10, 25, 50, 100];
  const cardLimits = [12, 24, 48, 96];
  const defaultListLimit = 10;
  const defaultCardLimit = 12;
  const [listLimit, setListLimit] = useState(defaultListLimit);
  const [cardLimit, setCardLimit] = useState(defaultCardLimit);
  const currentVehiclesLimit = viewMode === 'list' ? listLimit : cardLimit;
  
  // Paginação para despesas
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesLimit, setExpensesLimit] = useState(10);
  const expensesLimits = [10, 25, 50, 100];
  
  // Resetar página quando mudar filtros ou modo de visualização
  useEffect(() => {
    setVehiclesPage(1);
  }, [searchTerm, viewMode, listLimit, cardLimit]);
  
  useEffect(() => {
    setExpensesPage(1);
  }, [searchTerm, expensesLimit]);
  
  const { data: vehiclesWithExpensesData, isLoading: isLoadingVehicles, isError: isErrorVehicles, error: errorVehicles, refetch: refetchVehicles } = useVehiclesWithExpenses();
  const { data: expensesData, isLoading: isLoadingExpenses, isError: isErrorExpenses, error: errorExpenses, refetch: refetchExpenses } = useExpenses({ 
    search: searchTerm || undefined,
    page: expensesPage,
    limit: expensesLimit
  });
  const deleteExpenseMutation = useDeleteExpense();
  
  const vehiclesWithExpenses = vehiclesWithExpensesData?.vehicles || [];
  const stats = vehiclesWithExpensesData?.stats;
  const despesas = expensesData?.data || [];
  const expensesPagination = expensesData?.pagination;

  // Paginação client-side para veículos (já que o endpoint não suporta paginação)
  const filteredVehicles = vehiclesWithExpenses.filter((vehicle) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      vehicle.brand.toLowerCase().includes(search) ||
      vehicle.model.toLowerCase().includes(search) ||
      vehicle.year.toString().includes(search) ||
      (vehicle.plate && vehicle.plate.toLowerCase().includes(search))
    );
  });
  
  // Calcular paginação client-side para veículos
  const vehiclesStartIndex = (vehiclesPage - 1) * currentVehiclesLimit;
  const vehiclesEndIndex = vehiclesStartIndex + currentVehiclesLimit;
  const paginatedVehicles = filteredVehicles.slice(vehiclesStartIndex, vehiclesEndIndex);
  const vehiclesTotalPages = Math.ceil(filteredVehicles.length / currentVehiclesLimit);


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
          <p className="text-muted-foreground mt-1">Controle as despesas dos seus veículos</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Cards de Estatísticas — 2 por linha no mobile; card sozinho estica */}
      {isLoadingVehicles ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-elevated p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : isErrorVehicles ? (
        <div className="card-elevated p-6">
          <QueryErrorState message={errorVehicles?.message} onRetry={() => refetchVehicles()} variant="inline" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Veículos com despesas</p>
                <Car className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-foreground">
                  {stats?.totalVehiclesWithExpenses || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de veículos com despesas cadastradas</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Valor total despesas</p>
                <Wrench className="w-8 h-8 text-destructive" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-destructive">
                  <HiddenValue value={formatCurrency(stats?.totalExpensesValue || 0)} />
                </p>
                <p className="text-xs text-muted-foreground mt-2">Soma de todas as despesas cadastradas</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Média de despesas por veículo</p>
                <BarChart3 className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="card-value-number text-info">
                  <HiddenValue value={formatCurrency(stats?.averageExpensesPerVehicle || 0)} />
                </p>
                <p className="text-xs text-muted-foreground mt-2">Valor médio gasto por veículo</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Veículo com maior despesa</p>
                <TrendingUp className="w-8 h-8 text-warning" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {stats?.vehicleWithHighestExpense ? (
                  <div>
                    <p className="text-lg font-semibold text-foreground truncate">
                      {stats.vehicleWithHighestExpense.brand} {stats.vehicleWithHighestExpense.model}
                      {stats.vehicleWithHighestExpense.version ? ` ${stats.vehicleWithHighestExpense.version}` : ''}
                    </p>
                    <p className="text-sm text-destructive font-medium mt-1">
                      <HiddenValue value={formatCurrency(stats.vehicleWithHighestExpense.expensesTotal)} />
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">Veículo com maior valor em despesas</p>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-muted-foreground">Nenhum</p>
                    <p className="text-xs text-muted-foreground mt-2">Nenhum veículo com despesas cadastradas</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros e Visualização */}
      <div className="card-elevated p-4">
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
      </div>

      {/* Lista/Card de Veículos */}
      {isLoadingVehicles ? (
        <div className="card-elevated p-8 text-center">
          <p className="text-muted-foreground">Carregando veículos...</p>
        </div>
      ) : isErrorVehicles ? (
        <div className="card-elevated p-8">
          <QueryErrorState message={errorVehicles?.message} onRetry={() => refetchVehicles()} variant="inline" />
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="card-elevated p-8 text-center">
          <Car className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum veículo com despesas encontrado</p>
        </div>
      ) : (
        <>
          {viewMode === 'list' ? (
      <div className="card-elevated overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Veículo</TableHead>
                    <TableHead className="font-semibold">Quantidade</TableHead>
                    <TableHead className="font-semibold">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id} className="group hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {vehicle.image ? (
                              <img
                                src={vehicle.image}
                                alt={`${vehicle.brand} ${vehicle.model}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Car className="w-5 h-5 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground">
                              {vehicle.brand} {vehicle.model}
                              {vehicle.version ? ` ${vehicle.version}` : ''}
                            </p>
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
                                      (c) => c.value.toLowerCase() === vehicle.color!.toLowerCase()
                                    );
                                    
                                    let colorHex = colorData?.hex || '#808080';
                                    
                                    // Se for um hex válido, usar diretamente
                                    if (!colorData && vehicle.color && /^#[0-9A-F]{6}$/i.test(vehicle.color)) {
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
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {vehicle.expensesCount} {vehicle.expensesCount === 1 ? 'despesa' : 'despesas'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-destructive">
                        <HiddenValue value={formatCurrency(vehicle.expensesTotal)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedVehicles.map((vehicle) => (
                <div key={vehicle.id} className="card-interactive overflow-hidden group">
                  <div className="relative h-40 bg-muted overflow-hidden">
                    {vehicle.image ? (
                      <img
                        src={vehicle.image}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-foreground truncate">
                        {vehicle.brand} {vehicle.model}
                        {vehicle.version ? ` ${vehicle.version}` : ''}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {vehicle.year} {vehicle.plate ? `• ${vehicle.plate}` : ''}
                      </p>
                    </div>
                    
                    {/* Details Row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {vehicle.km !== undefined && vehicle.km !== null && (
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5" />
                          {vehicle.km.toLocaleString('pt-BR')} km
                        </span>
                      )}
                      {vehicle.color && (
                        <span className="flex items-center gap-1">
                          {(() => {
                            const colorData = VEHICLE_COLORS.find(
                              (c) => c.value.toLowerCase() === vehicle.color!.toLowerCase()
                            );
                            
                            let colorHex = colorData?.hex || '#808080';
                            
                            // Se for um hex válido, usar diretamente
                            if (!colorData && vehicle.color && /^#[0-9A-F]{6}$/i.test(vehicle.color)) {
                              colorHex = vehicle.color;
                            }
                            
                            return (
                              <div 
                                className="w-3 h-3 rounded-full border border-border flex-shrink-0" 
                                style={{ backgroundColor: colorHex }} 
                              />
                            );
                          })()}
                          {vehicle.color}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Despesas</p>
                        <p className="text-sm font-semibold text-foreground">
                          {vehicle.expensesCount} {vehicle.expensesCount === 1 ? 'despesa' : 'despesas'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-sm font-semibold text-destructive">
                            <HiddenValue value={formatCurrency(vehicle.expensesTotal)} />
                          </p>
                        </div>
                        {vehicle.expensesCount > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground self-end"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpensesModalVehicle({
                                id: vehicle.id,
                                name: `${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''} ${vehicle.year}`,
                              });
                            }}
                            title="Ver despesas do veículo"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Paginação de Veículos */}
          {filteredVehicles.length > 0 && vehiclesTotalPages > 0 && (
            <div className="card-elevated p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    <span className="hidden sm:inline">Mostrando {vehiclesStartIndex + 1} - {Math.min(vehiclesEndIndex, filteredVehicles.length)} de {filteredVehicles.length} veículos</span>
                    <span className="sm:hidden">{filteredVehicles.length} veículos</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground hidden sm:inline">Itens por página:</span>
                    <span className="text-sm text-muted-foreground sm:hidden">Por página:</span>
                    <Select
                      value={currentVehiclesLimit.toString()}
                      onValueChange={(value) => {
                        const newLimit = parseInt(value);
                        if (viewMode === 'list') {
                          setListLimit(newLimit);
                        } else {
                          setCardLimit(newLimit);
                        }
                        setVehiclesPage(1);
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
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVehiclesPage(1)}
                      disabled={vehiclesPage <= 1}
                      className="hidden sm:inline-flex"
                    >
                      Primeira
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVehiclesPage((p) => Math.max(1, p - 1))}
                      disabled={vehiclesPage <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <span className="text-sm text-muted-foreground px-2 whitespace-nowrap">
                      {vehiclesPage} / {vehiclesTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVehiclesPage((p) => Math.min(vehiclesTotalPages, p + 1))}
                      disabled={vehiclesPage >= vehiclesTotalPages}
                    >
                      <span className="hidden sm:inline">Próxima</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVehiclesPage(vehiclesTotalPages)}
                      disabled={vehiclesPage >= vehiclesTotalPages}
                      className="hidden sm:inline-flex"
                    >
                      Última
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tabela de Despesas */}
      <div className="mt-8">
        <div className="card-elevated overflow-hidden">
          <button
            onClick={() => setIsExpensesSectionOpen(!isExpensesSectionOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-foreground">Todas as Despesas</h2>
            {isExpensesSectionOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          
          {isExpensesSectionOpen && (
            <>
              <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Veículo</TableHead>
              <TableHead className="font-semibold">Tipo</TableHead>
              <TableHead className="font-semibold">Valor</TableHead>
              <TableHead className="font-semibold">Data</TableHead>
                      <TableHead className="font-semibold w-[120px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                    {isErrorExpenses ? (
              <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <QueryErrorState message={errorExpenses?.message} onRetry={() => refetchExpenses()} variant="inline" />
                </TableCell>
              </TableRow>
                    ) : isLoadingExpenses ? (
              <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                  <p className="text-muted-foreground">Carregando despesas...</p>
                </TableCell>
              </TableRow>
            ) : despesas.length === 0 ? (
              <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                  <Receipt className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma despesa encontrada</p>
                </TableCell>
              </TableRow>
            ) : (
              despesas.map((despesa) => {
                const vehicleName = despesa.vehicle 
                  ? `${despesa.vehicle.brand} ${despesa.vehicle.model} ${despesa.vehicle.year}`
                  : 'Geral';
                return (
                <TableRow key={despesa.id} className="group hover:bg-muted/30">
                  <TableCell className="font-medium">
                              <TruncatedText 
                                text={vehicleName}
                                maxWidth="200px"
                              >
                                {vehicleName}
                              </TruncatedText>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                className={cn(
                                  "font-medium border",
                                  getExpenseTypeColor(despesa.type).bg,
                                  getExpenseTypeColor(despesa.type).text,
                                  getExpenseTypeColor(despesa.type).border,
                                  "hover:bg-transparent hover:text-current [&:hover]:bg-transparent [&:hover]:text-current"
                                )}
                              >
                                {despesa.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-destructive">
                    <HiddenValue value={despesa.value.toLocaleString('pt-BR')} prefix="R$ " />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(despesa.date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-transparent hover:text-foreground [&:hover]:bg-transparent [&:hover]:text-foreground [&:hover_svg]:text-foreground"
                                  onClick={() => setExpenseToEdit(despesa.id)}
                                  title="Editar despesa"
                                >
                                  <Pencil className="w-4 h-4" />
                        </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-transparent"
                                  onClick={() => setExpenseToDelete({
                                    id: despesa.id,
                                    type: despesa.type,
                                    value: despesa.value,
                                    vehicleName
                                  })}
                                  title="Excluir despesa"
                        >
                          <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                  </TableCell>
                </TableRow>
              );
            })
            )}
          </TableBody>
        </Table>
      </div>
              
              {/* Paginação de Despesas */}
              {expensesPagination && expensesPagination.totalPages > 0 && (
                <div className="p-4 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  <span className="hidden sm:inline">Mostrando {((expensesPagination.page - 1) * expensesPagination.limit) + 1} - {Math.min(expensesPagination.page * expensesPagination.limit, expensesPagination.total)} de {expensesPagination.total} despesas</span>
                  <span className="sm:hidden">{expensesPagination.total} despesas</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">Itens por página:</span>
                  <span className="text-sm text-muted-foreground sm:hidden">Por página:</span>
                  <Select
                    value={expensesLimit.toString()}
                    onValueChange={(value) => {
                      setExpensesLimit(parseInt(value));
                      setExpensesPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {expensesLimits.map((limit) => (
                        <SelectItem key={limit} value={limit.toString()}>
                          {limit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpensesPage(1)}
                    disabled={expensesPagination.page <= 1}
                    className="hidden sm:inline-flex"
                  >
                    Primeira
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpensesPage((p) => Math.max(1, p - 1))}
                    disabled={expensesPagination.page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <span className="text-sm text-muted-foreground px-2 whitespace-nowrap">
                    {expensesPagination.page} / {expensesPagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpensesPage((p) => Math.min(expensesPagination.totalPages, p + 1))}
                    disabled={expensesPagination.page >= expensesPagination.totalPages}
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpensesPage(expensesPagination.totalPages)}
                    disabled={expensesPagination.page >= expensesPagination.totalPages}
                    className="hidden sm:inline-flex"
                  >
                    Última
                  </Button>
                </div>
              </div>
            </div>
            </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Adicionar Despesa */}
      <AddExpenseFromVehiclesModal
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) {
            refetchVehicles();
            refetchExpenses();
          }
        }}
      />

      {/* Modal de Despesas do Veículo */}
      <VehicleExpensesModal
        open={!!expensesModalVehicle}
        onOpenChange={(open) => !open && setExpensesModalVehicle(null)}
        vehicleId={expensesModalVehicle?.id ?? null}
        vehicleName={expensesModalVehicle?.name ?? ''}
      />
      
      {/* Modal de Editar Despesa */}
      {expenseToEdit && (
        <EditExpenseModal
          open={!!expenseToEdit}
          onOpenChange={(open) => {
            if (!open) {
              setExpenseToEdit(null);
              refetchExpenses();
              refetchVehicles();
            }
          }}
          expenseId={expenseToEdit}
          expenseTypes={expenseTypes}
        />
      )}
      
      {/* Modal de Confirmar Exclusão de Despesa */}
      {expenseToDelete && (
        <ConfirmDialog
          open={!!expenseToDelete}
          onOpenChange={(open) => {
            if (!open) {
              setExpenseToDelete(null);
            }
          }}
          onConfirm={() => {
            if (expenseToDelete) {
              deleteExpenseMutation.mutate(expenseToDelete.id, {
                onSuccess: () => {
                  setExpenseToDelete(null);
                  refetchExpenses();
                  refetchVehicles();
                }
              });
            }
          }}
          title="Excluir Despesa"
          description={
            <div className="space-y-2">
              <p>Tem certeza que deseja excluir esta despesa?</p>
              <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">Veículo:</span> {expenseToDelete.vehicleName}
                </p>
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">Tipo:</span> {expenseToDelete.type}
                </p>
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">Valor:</span> R$ {expenseToDelete.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Esta ação não pode ser desfeita.</p>
            </div>
          }
          confirmText="Excluir"
          cancelText="Cancelar"
          variant="destructive"
          icon={Trash2}
        />
      )}
    </div>
  );
};

export default Despesas;
