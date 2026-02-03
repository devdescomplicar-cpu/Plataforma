import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Download, ChevronDown, Users, ShoppingBag, DollarSign, Eye } from 'lucide-react';
import { adminApi, type AdminClient, type AdminUser } from '@/lib/admin-api';
import { formatCpfCnpj } from '@/lib/cpf-cnpj';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TruncatedText } from '@/components/ui/TruncatedText';

const ALL_VALUE = '_all';

const BR_STATES = [
  { value: ALL_VALUE, label: 'Todos os estados' },
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function escapeCsvCell(value: string): string {
  const str = String(value ?? '').replace(/"/g, '""');
  return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
}

function clientsToCsv(clients: AdminClient[]): string {
  const headers = [
    'Cliente',
    'Contato',
    'E-mail',
    'Telefone',
    'CPF/CNPJ',
    'Cidade',
    'UF',
    'Veículos',
    'Total gasto',
    'Última compra',
    'Status',
    'Usuário',
    'Cadastro',
  ];
  const rows = clients.map((c) => {
    const contato = [c.email, c.phone].filter(Boolean).join(' / ');
    return [
      c.name,
      contato,
      c.email ?? '',
      c.phone ?? '',
      c.cpfCnpj ? formatCpfCnpj(c.cpfCnpj) : '',
      c.city ?? '',
      c.state ?? '',
      String(c.vehicleCount ?? 0),
      formatCurrency(c.totalSpent ?? 0),
      c.lastPurchaseDate
        ? format(new Date(c.lastPurchaseDate), 'dd/MM/yyyy', { locale: ptBR })
        : '',
      c.status ?? '',
      c.user ? `${c.user.name} (${c.user.email})` : '',
      format(new Date(c.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    ].map(escapeCsvCell);
  });
  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function downloadCsv(clients: AdminClient[], filename: string): void {
  const csv = clientsToCsv(clients);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminClientes() {
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState<string>(ALL_VALUE);
  const [stateFilter, setStateFilter] = useState<string>(ALL_VALUE);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState<'selected' | 'user' | 'all' | null>(null);
  const limit = 20;

  const { data: clientsStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin', 'clients', 'stats'],
    queryFn: async () => {
      const res = await adminApi.clients.stats();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao carregar estatísticas');
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const { data: clientsData, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'clients', search, userId, stateFilter, page],
    queryFn: async () => {
      const res = await adminApi.clients.list({
        search: search.trim() || undefined,
        userId: userId && userId !== ALL_VALUE ? userId : undefined,
        state: stateFilter && stateFilter !== ALL_VALUE ? stateFilter : undefined,
        page,
        limit,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao listar clientes');
      return { data: (res.data ?? []) as AdminClient[], pagination: res.pagination };
    },
    staleTime: 30 * 1000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users', 'list-all'],
    queryFn: async () => {
      const res = await adminApi.users.list({ limit: 500 });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao listar usuários');
      return (res.data ?? []) as AdminUser[];
    },
    staleTime: 60 * 1000,
  });

  const clients = clientsData?.data ?? [];
  const pagination = clientsData?.pagination;
  const users = usersData ?? [];

  const allOnPageSelected =
    clients.length > 0 && clients.every((c) => selectedIds.has(c.id));
  const someOnPageSelected = clients.some((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const c of clients) next.delete(c.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const c of clients) next.add(c.id);
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async (mode: 'selected' | 'user' | 'all') => {
    setExportLoading(mode);
    try {
      const params: { ids?: string[]; userId?: string; state?: string; search?: string } = {};
      if (mode === 'selected' && selectedIds.size > 0) {
        params.ids = Array.from(selectedIds);
      } else if (mode === 'user' && userId && userId !== ALL_VALUE) {
        params.userId = userId;
        if (stateFilter && stateFilter !== ALL_VALUE) params.state = stateFilter;
        if (search.trim()) params.search = search.trim();
      } else if (mode === 'all') {
        if (userId && userId !== ALL_VALUE) params.userId = userId;
        if (stateFilter && stateFilter !== ALL_VALUE) params.state = stateFilter;
        if (search.trim()) params.search = search.trim();
      }

      const res = await adminApi.clients.export(params);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao exportar');
      const data = (res.data ?? []) as AdminClient[];
      if (data.length === 0) {
        alert('Nenhum cliente encontrado para exportar.');
        return;
      }
      const filename = `clientes-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      downloadCsv(data, filename);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao exportar clientes.');
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Todos os clientes cadastrados pelos usuários. Filtre por usuário, estado ou pesquise por
            nome, e-mail, CPF ou telefone.
          </p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      {isLoadingStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-elevated p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : clientsStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total de clientes</p>
                <Users className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-foreground">
                  {clientsStats.totalClients}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de clientes cadastrados</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Mais compras</p>
                <ShoppingBag className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {clientsStats.topClientByPurchases ? (
                  <>
                    <p className="text-2xl font-bold text-success">
                      {clientsStats.topClientByPurchases.purchaseCount}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 truncate" title={clientsStats.topClientByPurchases.name}>
                      {clientsStats.topClientByPurchases.name}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                    <p className="text-xs text-muted-foreground mt-2">Nenhuma compra registrada</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Maior gasto</p>
                <DollarSign className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {clientsStats.topClientBySpent ? (
                  <>
                    <p className="text-2xl font-bold text-info">
                      {formatCurrency(clientsStats.topClientBySpent.totalSpent)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 truncate" title={clientsStats.topClientBySpent.name}>
                      {clientsStats.topClientBySpent.name}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                    <p className="text-xs text-muted-foreground mt-2">Nenhum gasto registrado</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <CardTitle>Lista de clientes</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
            <div className="relative flex-1 sm:w-72 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome, e-mail, CPF ou telefone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={userId}
              onValueChange={(v) => {
                setUserId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrar por usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos os usuários</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="truncate">{u.name} ({u.email})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={stateFilter}
              onValueChange={(v) => {
                setStateFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Estado (UF)" />
              </SelectTrigger>
              <SelectContent>
                {BR_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!!exportLoading}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleExport('selected')}
                  disabled={selectedIds.size === 0 || exportLoading !== null}
                >
                  Exportar selecionados ({selectedIds.size})
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport('user')}
                  disabled={userId === ALL_VALUE || !userId || !!exportLoading}
                >
                  Exportar usuário filtrado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('all')} disabled={!!exportLoading}>
                  Exportar todos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive py-4">
              {error instanceof Error ? error.message : 'Erro ao carregar'}
            </p>
          )}
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          )}
          {!isLoading && !isError && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            allOnPageSelected
                              ? true
                              : someOnPageSelected
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="font-semibold">Contato</TableHead>
                      <TableHead className="font-semibold">Veículos</TableHead>
                      <TableHead className="font-semibold">Total gasto</TableHead>
                      <TableHead className="font-semibold">Última compra</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Usuário</TableHead>
                      <TableHead className="font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhum cliente encontrado com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      clients.map((c) => (
                        <TableRow key={c.id} className="group hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(c.id)}
                              onCheckedChange={() => toggleSelect(c.id)}
                              aria-label={`Selecionar ${c.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <TruncatedText text={c.name} maxWidth="180px">
                              {c.name}
                            </TruncatedText>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-0.5">
                              {c.email && (
                                <TruncatedText text={c.email} maxWidth="180px">
                                  {c.email}
                                </TruncatedText>
                              )}
                              {c.phone && (
                                <TruncatedText text={c.phone} maxWidth="140px" className="text-muted-foreground">
                                  {c.phone}
                                </TruncatedText>
                              )}
                              {!c.email && !c.phone && <span className="text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {c.vehicleCount ?? 0}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums font-medium">
                            {formatCurrency(c.totalSpent ?? 0)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {c.lastPurchaseDate
                              ? format(new Date(c.lastPurchaseDate), 'dd/MM/yyyy', { locale: ptBR })
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                c.status === 'Cliente'
                                  ? 'bg-success text-white'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {c.status ?? 'Prospecto'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {c.user ? (
                              <div className="text-sm">
                                <div className="font-medium truncate max-w-[140px] text-foreground" title={c.user.name}>
                                  {c.user.name}
                                </div>
                                <div
                                  className="text-muted-foreground text-xs truncate max-w-[140px]"
                                  title={c.user.email}
                                >
                                  {c.user.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                // TODO: Implementar visualização do perfil do cliente
                                console.log('Visualizar cliente:', c.id);
                              }}
                              title="Visualizar perfil"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {pagination.total} cliente(s) • Página {pagination.page} de {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
