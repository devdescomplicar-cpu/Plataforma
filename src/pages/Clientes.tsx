import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Trash2, Pencil, Users, Mail, MapPin, Eye, Star, UserPlus, DollarSign, Car, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useClients, useDeleteClient, useClientsStats, Client } from '@/hooks/useClients';
import { useSettings } from '@/hooks/useSettings';
import { QueryErrorState } from '@/components/QueryErrorState';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCpfCnpj } from '@/lib/cpf-cnpj';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClientProfileModal } from '@/components/modals/ClientProfileModal';
import { ClientFormModal } from '@/components/modals/ClientFormModal';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { toast } from '@/hooks/use-toast';

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recurringFilter, setRecurringFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [clientToView, setClientToView] = useState<Client | null>(null);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const { data: clientsData, isLoading, isError, error, refetch } = useClients({ 
    search: searchTerm || undefined,
    page,
    limit
  });
  const { data: statsData, isLoading: isLoadingStats } = useClientsStats();
  const { data: settingsData } = useSettings();
  const deleteClientMutation = useDeleteClient();
  
  const clientes = clientsData?.data || [];
  const pagination = clientsData?.pagination;
  const stats = statsData || {
    totalClients: 0,
    recurringClients: 0,
    newClients: 0,
    topClient: null,
  };
  
  // Obter threshold de cliente recorrente das configurações
  const recurringThreshold = settingsData?.settings?.recurringClientThreshold || 2;

  // Filtrar clientes
  const filteredClients = useMemo(() => {
    let filtered = clientes;

    if (recurringFilter === 'recurring') {
      filtered = filtered.filter((c) => (c.purchases || 0) >= recurringThreshold);
    } else if (recurringFilter === 'novo') {
      filtered = filtered.filter((c) => (c.purchases || 0) === 1);
    } else if (recurringFilter === 'sem-compras') {
      filtered = filtered.filter((c) => (c.purchases || 0) === 0);
    }

    return filtered;
  }, [clientes, recurringFilter, recurringThreshold]);

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      await deleteClientMutation.mutateAsync(clientToDelete.id);
      toast({
        title: 'Cliente excluído',
        description: `${clientToDelete.name} foi excluído com sucesso.`,
      });
      setClientToDelete(null);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.response?.data?.error?.message || 'Erro ao excluir cliente',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getClientStatus = (client: Client): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string } => {
    const purchases = client.purchases || 0;
    const totalSpent = client.totalSpent || 0;
    
    if (purchases === 0) {
      return { label: 'Sem compras', variant: 'outline', className: 'bg-muted text-muted-foreground' };
    } else if (purchases === 1) {
      return { label: 'Novo', variant: 'outline', className: 'bg-info/10 text-info border-info/20' };
    } else if (purchases >= recurringThreshold && totalSpent >= 100000) {
      return { label: 'VIP', variant: 'default', className: 'bg-yellow-500 text-white hover:bg-yellow-500' };
    } else if (purchases >= recurringThreshold) {
      return { label: 'Recorrente', variant: 'default', className: 'bg-primary text-white' };
    } else {
      return { label: 'Novo', variant: 'outline', className: 'bg-info/10 text-info border-info/20' };
    }
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return 'N/A';
    return phone;
  };

  const getDaysSinceLastPurchase = (lastPurchase?: string | null) => {
    if (!lastPurchase) return null;
    const days = Math.floor((Date.now() - new Date(lastPurchase).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua base de clientes e histórico de compras</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Cards de Resumo */}
      {isLoadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-elevated p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total de clientes</p>
                <Users className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-foreground">
                  {stats.totalClients}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de clientes cadastrados</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Clientes recorrentes</p>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-yellow-500">
                  {stats.recurringClients}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Clientes com {recurringThreshold}+ compras</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Clientes novos</p>
                <UserPlus className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-info">
                  {stats.newClients}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Clientes com 1 compra</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Cliente que mais comprou</p>
                <DollarSign className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-xl font-bold text-foreground truncate">
                  {stats.topClient ? stats.topClient.name : 'N/A'}
                </p>
                {stats.topClient && (
                  <p className="text-2xl font-bold text-success mt-1">
                    {formatCurrency(stats.topClient.totalSpent)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">Maior valor total gasto</p>
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
              placeholder="Buscar por nome, email, telefone ou CPF/CNPJ..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={recurringFilter}
              onValueChange={(value) => {
                setRecurringFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="recurring">Recorrente</SelectItem>
                <SelectItem value="sem-compras">Sem compras</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabela de Clientes — scroll horizontal no mobile */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Cliente</TableHead>
              <TableHead className="font-semibold">Contato</TableHead>
              <TableHead className="font-semibold">Veículos</TableHead>
              <TableHead className="font-semibold">Total gasto</TableHead>
              <TableHead className="font-semibold">Última compra</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <QueryErrorState message={error?.message} onRetry={() => refetch()} variant="inline" />
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Carregando clientes...</p>
                </TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((cliente) => {
                const status = getClientStatus(cliente);
                const daysSince = getDaysSinceLastPurchase(cliente.lastPurchase);
                
                return (
                  <TableRow key={cliente.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="font-semibold">{cliente.name}</span>
                        {cliente.cpfCnpj && (
                          <span className="text-xs text-muted-foreground">
                            {formatCpfCnpj(cliente.cpfCnpj)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {cliente.phone && (
                          <a 
                            href={`https://wa.me/55${cliente.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            {formatPhone(cliente.phone)}
                          </a>
                        )}
                        {cliente.email && (
                          <a 
                            href={`mailto:${cliente.email}`}
                            className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            {cliente.email}
                          </a>
                        )}
                        {cliente.city && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {cliente.city}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{cliente.purchases || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {cliente.totalSpent ? formatCurrency(cliente.totalSpent) : 'R$ 0,00'}
                    </TableCell>
                    <TableCell>
                      {cliente.lastPurchase ? (
                        <div className="flex flex-col">
                          <span className="text-sm">{format(new Date(cliente.lastPurchase), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          {daysSince !== null && daysSince > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {daysSince} {daysSince === 1 ? 'dia' : 'dias'} atrás
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Nunca comprou</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={status.variant}
                        className={cn("font-medium border", status.className)}
                      >
                        {status.label}
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
                            onClick={() => setClientToView(cliente)}
                          >
                            <Eye className="w-4 h-4" />
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => setClientToEdit(cliente)}
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 text-destructive"
                            onClick={() => setClientToDelete(cliente)}
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

      {/* Paginação */}
      {pagination && pagination.totalPages > 0 && (
        <div className="card-elevated p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                <span className="hidden sm:inline">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} clientes
                </span>
                <span className="sm:hidden">{pagination.total} clientes</span>
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
      <ClientProfileModal
        open={!!clientToView}
        onOpenChange={(open) => !open && setClientToView(null)}
        clientId={clientToView?.id || ''}
      />

      <ClientFormModal
        open={isCreateModalOpen || !!clientToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setClientToEdit(null);
          } else {
            setIsCreateModalOpen(true);
          }
        }}
        clientToEdit={clientToEdit}
      />

      <ConfirmDialog
        open={!!clientToDelete}
        onOpenChange={(open) => !open && setClientToDelete(null)}
        title="Excluir Cliente"
        description={`Tem certeza que deseja excluir o cliente "${clientToDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteClient}
        confirmText="Excluir"
        variant="destructive"
      />
    </div>
  );
};

export default Clientes;
