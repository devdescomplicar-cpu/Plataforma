import { useState, useMemo, useEffect } from 'react';
import { Search, Car, CheckCircle2, Clock, ClipboardCheck, Plus, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVehicles } from '@/hooks/useVehicles';
import { useChecklists, useCreateChecklist, useCreateChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem } from '@/hooks/useChecklists';
import { useSettings } from '@/hooks/useSettings';
import { QueryErrorState } from '@/components/QueryErrorState';
import { cn, toPublicImageUrl } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { VEHICLE_COLORS } from '@/components/ui/ColorSelect';

type FilterType = 'all' | 'in_progress' | 'completed';

const Checklist = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [customTaskInputs, setCustomTaskInputs] = useState<Record<string, string>>({});
  const [addingCustomTask, setAddingCustomTask] = useState<Record<string, boolean>>({});

  const cardLimits = [12, 24, 48, 96];

  // Buscar apenas veículos em estoque (não vendidos)
  const { data: vehiclesData, isLoading: isLoadingVehicles, isError: isErrorVehicles, error: errorVehicles, refetch: refetchVehicles } = useVehicles({ 
    status: 'available',
    limit: 1000
  });
  
  const { data: checklistsData, isLoading: isLoadingChecklists, refetch: refetchChecklists } = useChecklists();
  const { data: settingsData } = useSettings();
  const createChecklistMutation = useCreateChecklist();
  const createChecklistItemMutation = useCreateChecklistItem();
  const updateChecklistItemMutation = useUpdateChecklistItem();
  const deleteChecklistItemMutation = useDeleteChecklistItem();

  const vehicles = vehiclesData?.data || [];
  const checklists = checklistsData?.data || [];
  
  // Obter itens padrão das configurações (apenas os habilitados)
  const defaultChecklistItems = useMemo(() => {
    const items = settingsData?.settings?.defaultChecklist || [];
    return items.filter(item => item.enabled).map(item => item.name);
  }, [settingsData]);

  // Criar mapa de checklists por vehicleId
  const checklistsByVehicleId = useMemo(() => {
    const map = new Map<string, typeof checklists[0]>();
    checklists.forEach((checklist) => {
      map.set(checklist.vehicleId, checklist);
    });
    return map;
  }, [checklists]);

  // Calcular estatísticas e status de cada veículo
  const vehiclesWithStatus = useMemo(() => {
    return vehicles.map((vehicle) => {
      const checklist = checklistsByVehicleId.get(vehicle.id);
      const allItems = checklist?.items || [];
      
      // Garantir que todos os itens padrão existam
      const defaultItems = defaultChecklistItems.map((name) => {
        const item = allItems.find((i) => i.name === name);
        return {
          name,
          id: item?.id || '',
          done: item?.done || false,
          exists: !!item,
        };
      });
      
      const customItems = allItems.filter(
        (i) => !defaultChecklistItems.includes(i.name)
      );
      
      const completedDefault = defaultItems.filter((i) => i.done).length;
      const completedCustom = customItems.filter((i) => i.done).length;
      const totalDefault = defaultItems.length;
      const totalCustom = customItems.length;
      const totalCompleted = completedDefault + completedCustom;
      const totalItems = totalDefault + totalCustom;
      const progress = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0;
      
      // Status: "completed" se todos os itens padrão estão concluídos E não há itens customizados pendentes
      // OU se todos os itens (padrão + customizados) estão concluídos
      const isCompleted = totalItems > 0 && 
        defaultItems.every((i) => i.done) && 
        customItems.every((i) => i.done);
      
      const status: 'completed' | 'in_progress' = isCompleted ? 'completed' : 'in_progress';
      
      return {
        vehicle,
        checklist,
        defaultItems,
        customItems,
        totalCompleted,
        totalItems,
        progress,
        status,
      };
    });
  }, [vehicles, checklistsByVehicleId, defaultChecklistItems]);

  // Filtrar veículos por busca e filtro
  const filteredVehiclesWithStatus = useMemo(() => {
    let filtered = vehiclesWithStatus;
    
    // Aplicar filtro de busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(({ vehicle }) => 
        vehicle.brand.toLowerCase().includes(search) ||
        vehicle.model.toLowerCase().includes(search) ||
        vehicle.year.toString().includes(search) ||
        (vehicle.plate && vehicle.plate.toLowerCase().includes(search))
      );
    }
    
    // Aplicar filtro de status
    if (filter !== 'all') {
      filtered = filtered.filter(({ status }) => status === filter);
    }
    
    // Ordenar: incompletos primeiro, completos por último
    filtered.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return 0;
    });
    
    return filtered;
  }, [vehiclesWithStatus, searchTerm, filter]);

  // Paginação
  const totalPages = Math.ceil(filteredVehiclesWithStatus.length / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedVehicles = filteredVehiclesWithStatus.slice(startIndex, endIndex);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filter]);

  // Calcular estatísticas gerais
  const stats = useMemo(() => {
    const total = vehiclesWithStatus.length;
    const completed = vehiclesWithStatus.filter((v) => v.status === 'completed').length;
    const inProgress = vehiclesWithStatus.filter((v) => v.status === 'in_progress').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    return {
      total,
      completed,
      inProgress,
      progress,
    };
  }, [vehiclesWithStatus]);

  // Função para obter ou criar checklist
  const getOrCreateChecklist = async (vehicleId: string) => {
    let checklist = checklistsByVehicleId.get(vehicleId);
    
    if (!checklist) {
      try {
        const newChecklist = await createChecklistMutation.mutateAsync({
          vehicleId,
          items: defaultChecklistItems.map((name) => ({ name, done: false })),
          status: 'pending',
        });
        await refetchChecklists();
        return newChecklist;
      } catch (error) {
        toast({
          title: 'Erro ao criar checklist',
          description: error instanceof Error ? error.message : 'Tente novamente.',
          variant: 'destructive',
        });
        return null;
      }
    }
    
    return checklist;
  };

  // Função para garantir que todos os itens padrão existam
  const ensureDefaultItemsForChecklist = async (checklist: typeof checklists[0]) => {
    const existingItems = checklist.items.map((i) => i.name);
    const missingItems = defaultChecklistItems.filter((name) => !existingItems.includes(name));
    
    if (missingItems.length > 0) {
      const promises = missingItems.map((itemName) =>
        createChecklistItemMutation.mutateAsync({
          checklistId: checklist.id,
          name: itemName,
        }).catch((error) => {
          console.error(`Erro ao criar item ${itemName}:`, error);
        })
      );
      await Promise.all(promises);
      await refetchChecklists();
    }
  };

  // Função para adicionar tarefa personalizada
  const handleAddCustomTask = async (vehicleId: string) => {
    const taskName = customTaskInputs[vehicleId]?.trim();
    if (!taskName) return;

    setAddingCustomTask((prev) => ({ ...prev, [vehicleId]: true }));

    try {
      let checklist = checklistsByVehicleId.get(vehicleId);
      
      if (!checklist) {
        checklist = await getOrCreateChecklist(vehicleId);
        if (!checklist) {
          setAddingCustomTask((prev) => ({ ...prev, [vehicleId]: false }));
          return;
        }
      }

      await createChecklistItemMutation.mutateAsync({
        checklistId: checklist.id,
        name: taskName,
      });

      setCustomTaskInputs((prev) => ({ ...prev, [vehicleId]: '' }));
      await refetchChecklists();
    } catch (error) {
      toast({
        title: 'Erro ao adicionar tarefa',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setAddingCustomTask((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  // Função para atualizar checkbox
  const handleCheckboxChange = async (vehicleId: string, itemId: string, checked: boolean) => {
    const checklist = checklistsByVehicleId.get(vehicleId);
    if (!checklist) {
      const newChecklist = await getOrCreateChecklist(vehicleId);
      if (!newChecklist) return;
      
      const item = newChecklist.items.find((i) => i.id === itemId);
      if (item) {
        await updateChecklistItemMutation.mutateAsync({
          checklistId: newChecklist.id,
          itemId: item.id,
          done: checked,
        });
      }
      return;
    }

    await updateChecklistItemMutation.mutateAsync({
      checklistId: checklist.id,
      itemId,
      done: checked,
    });
    
    // Refetch e verificar conclusão
    await refetchChecklists();
    
    if (checked) {
      // Aguardar um pouco para o backend processar
      setTimeout(() => {
        const currentChecklist = checklistsByVehicleId.get(vehicleId);
        if (currentChecklist) {
          const allItems = currentChecklist.items;
          const allDone = allItems.length > 0 && allItems.every((i) => i.done);
          if (allDone) {
            toast({
              title: '🎉 Veículo pronto para venda!',
              description: 'Todos os itens do checklist foram concluídos.',
            });
          }
        }
      }, 500);
    }
  };

  // Função para remover tarefa personalizada
  const handleRemoveCustomTask = async (vehicleId: string, itemId: string) => {
    const checklist = checklistsByVehicleId.get(vehicleId);
    if (!checklist) return;

    try {
      await deleteChecklistItemMutation.mutateAsync({
        checklistId: checklist.id,
        itemId,
      });
      await refetchChecklists();
      toast({
        title: 'Tarefa removida',
        description: 'A tarefa foi removida do checklist.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao remover tarefa',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const isLoading = isLoadingVehicles || isLoadingChecklists;
  const isError = isErrorVehicles;
  const error = errorVehicles;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Checklist</h1>
          <p className="text-muted-foreground mt-1">Acompanhe a preparação dos veículos em estoque</p>
        </div>
      </div>

      {/* Cards de Estatísticas — 2 por linha no mobile; card sozinho estica */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-4">
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Veículos em Estoque</p>
            <Car className="w-8 h-8 text-foreground" />
          </div>
          <div className="flex-1 flex flex-col justify-center mt-4">
            <p className="card-value-number text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-2">Total de veículos cadastrados</p>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Veículos Prontos</p>
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <div className="flex-1 flex flex-col justify-center mt-4">
            <p className="card-value-number text-success">{stats.completed}</p>
            <p className="text-xs text-muted-foreground mt-2">Checklist completo</p>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Em Preparação</p>
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <div className="flex-1 flex flex-col justify-center mt-4">
            <p className="card-value-number text-warning">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground mt-2">Aguardando conclusão</p>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Progresso Geral</p>
            <ClipboardCheck className="w-8 h-8 text-info" />
          </div>
          <div className="flex-1 flex flex-col justify-center mt-4">
            <p className="card-value-number text-info">{Math.round(stats.progress)}%</p>
            <p className="text-xs text-muted-foreground mt-2">Taxa de conclusão</p>
          </div>
        </div>
      </div>

      {/* Barra de Progresso Geral */}
      <div className="card-elevated p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Preparação Geral</h3>
            <span className="text-sm font-medium text-foreground">
              {stats.completed} / {stats.total} veículos prontos
            </span>
          </div>
          <Progress value={stats.progress} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {stats.completed} de {stats.total} veículos com checklist completo
          </p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="card-elevated p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar veículo por marca, modelo, ano ou placa..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={filter === 'in_progress' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('in_progress')}
            >
              Em Preparação
            </Button>
            <Button
              variant={filter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('completed')}
            >
              Prontos
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Veículos */}
      {isError ? (
        <QueryErrorState message={error?.message} onRetry={() => refetchVehicles()} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredVehiclesWithStatus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Car className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum veículo encontrado</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedVehicles.map(({ vehicle, checklist, defaultItems, customItems, totalCompleted, totalItems, progress, status }) => {
            const imageUrl = toPublicImageUrl(vehicle.image);

            return (
              <div key={vehicle.id} className="card-elevated p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate" title={`${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''}`}>
                      {vehicle.brand} {vehicle.model}
                      {vehicle.version ? ` ${vehicle.version}` : ''}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
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
                            if (!colorData && /^#[0-9A-F]{6}$/i.test(vehicle.color)) {
                              colorHex = vehicle.color;
                            }
                            return (
                              <div 
                                className="w-2.5 h-2.5 rounded-full border border-border flex-shrink-0" 
                                style={{ backgroundColor: colorHex }} 
                              />
                            );
                          })()}
                          <span>{vehicle.color}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      {status === 'completed' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-success/10 text-success border border-success/20">
                          Pronto
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                          Em Preparação
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progresso Individual */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-foreground">Checklist</span>
                    <span className="text-xs font-semibold text-foreground">
                      {totalCompleted} / {totalItems}
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}% concluído</p>
                </div>

                {/* Itens Padrão */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-semibold text-foreground mb-2">Tarefas Padrão</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {defaultItems.map((item) => {
                      const handleChange = async (checked: boolean) => {
                        if (!item.exists && checked) {
                          const newChecklist = await getOrCreateChecklist(vehicle.id);
                          if (newChecklist) {
                            await ensureDefaultItemsForChecklist(newChecklist);
                            await refetchChecklists();
                            
                            const updatedChecklist = checklistsByVehicleId.get(vehicle.id);
                            const existingItem = updatedChecklist?.items.find((i) => i.name === item.name);
                            if (existingItem) {
                              await handleCheckboxChange(vehicle.id, existingItem.id, checked);
                            }
                          }
                        } else if (item.exists) {
                          await handleCheckboxChange(vehicle.id, item.id, checked);
                        }
                      };

                      return (
                        <div
                          key={item.name}
                          role="button"
                          tabIndex={0}
                          className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/30 transition-all cursor-pointer group"
                          onClick={() => handleChange(!item.done)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleChange(!item.done);
                            }
                          }}
                        >
                          <Checkbox 
                            checked={item.done} 
                            className="data-[state=checked]:bg-success data-[state=checked]:border-success w-4 h-4 pointer-events-none" 
                          />
                          <span className={cn(
                            "text-xs font-medium flex-1 select-none",
                            item.done ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {item.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tarefas Personalizadas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-foreground">Tarefas Personalizadas</h4>
                  </div>
                  
                  {customItems.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {customItems.map((item) => (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/30 transition-all cursor-pointer group"
                          onClick={() => handleCheckboxChange(vehicle.id, item.id, !item.done)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCheckboxChange(vehicle.id, item.id, !item.done);
                            }
                          }}
                        >
                          <Checkbox 
                            checked={item.done} 
                            className="data-[state=checked]:bg-success data-[state=checked]:border-success w-4 h-4 pointer-events-none" 
                          />
                          <span className={cn(
                            "text-xs font-medium flex-1 select-none",
                            item.done ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {item.name}
                          </span>
                          <button
                            type="button"
                            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-transparent focus:outline-none focus:ring-0 shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveCustomTask(vehicle.id, item.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Adicionar Nova Tarefa Personalizada */}
                  <div className="flex items-center gap-2 p-2 rounded-md border border-dashed border-border">
                    <Input
                      placeholder="Adicionar tarefa..."
                      value={customTaskInputs[vehicle.id] || ''}
                      onChange={(e) => setCustomTaskInputs((prev) => ({ ...prev, [vehicle.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddCustomTask(vehicle.id);
                        }
                      }}
                      className="flex-1 h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddCustomTask(vehicle.id)}
                      disabled={!customTaskInputs[vehicle.id]?.trim() || addingCustomTask[vehicle.id]}
                      className="gap-1 h-8 px-2"
                    >
                      {addingCustomTask[vehicle.id] ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Paginação */}
          {filteredVehiclesWithStatus.length > 0 && totalPages > 0 && (
            <div className="card-elevated p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Informações e seletor de limite */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    <span className="hidden sm:inline">Mostrando {startIndex + 1} - {Math.min(endIndex, filteredVehiclesWithStatus.length)} de {filteredVehiclesWithStatus.length} veículos</span>
                    <span className="sm:hidden">{filteredVehiclesWithStatus.length} veículos</span>
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
                        {cardLimits.map((l) => (
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
                      disabled={page <= 1}
                      className="hidden sm:inline-flex"
                    >
                      Primeira
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <span className="text-sm text-muted-foreground px-2 whitespace-nowrap">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <span className="hidden sm:inline">Próxima</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page >= totalPages}
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
  );
};

export default Checklist;
