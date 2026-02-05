import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Plus, Trash2, Users, UserCheck, AlertCircle, Shield, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { adminApi, type AdminUser, type AdminPlan } from '@/lib/admin-api';
import { formatCpfCnpj, validateCpfCnpj, normalizeCpfCnpj } from '@/lib/cpf-cnpj';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TruncatedText } from '@/components/ui/TruncatedText';

const DURATION_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

function planOfferLabel(plan: { name: string; durationType?: string }): string {
  const period = plan.durationType ? (DURATION_LABELS[plan.durationType] ?? plan.durationType) : '';
  if (period) return `${plan.name} - ${period}`;
  return plan.name;
}

function getStatus(user: AdminUser): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (user.role === 'admin') return { label: 'Ativo', variant: 'default' };
  const acc = user.account;
  if (!acc) return { label: '—', variant: 'secondary' };
  const trial = acc.trialEndsAt ? new Date(acc.trialEndsAt) : null;
  if (!trial) return { label: '—', variant: 'secondary' };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const trialDate = new Date(trial);
  trialDate.setHours(0, 0, 0, 0);
  if (trialDate >= now) return { label: 'Ativo', variant: 'default' };
  return { label: 'Vencido', variant: 'destructive' };
}

function getVencimento(user: AdminUser): string {
  if (user.role === 'admin') return '—';
  const trial = user.account?.trialEndsAt;
  if (!trial) return '—';
  return format(new Date(trial), 'dd/MM/yyyy', { locale: ptBR });
}

export default function AdminUsuarios() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState('');
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    phone: string;
    cpfCnpj: string;
    role: string;
    accountName: string;
    trialEndsAt: string;
    planId: string;
    subscriptionEndDate: string;
  }>({ name: '', email: '', phone: '', cpfCnpj: '', role: 'user', accountName: '', trialEndsAt: '', planId: '', subscriptionEndDate: '' });
  const [cpfCnpjError, setCpfCnpjError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    email: string;
    password: string;
    phone: string;
    cpfCnpj: string;
    role: string;
    accountName: string;
    trialEndsAt: string;
  }>({ name: '', email: '', password: '', phone: '', cpfCnpj: '', role: 'user', accountName: '', trialEndsAt: '' });
  const [createCpfError, setCreateCpfError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usersStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: async () => {
      const res = await adminApi.users.stats();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao carregar estatísticas');
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'users', search, roleFilter, page],
    queryFn: async () => {
      const res = await adminApi.users.list({ search: search || undefined, page, limit: 20 });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao listar usuários');
      const raw = (res.data ?? []) as AdminUser[];
      let data: AdminUser[] = raw.map((u) => ({
        ...u,
        phone: u.phone ?? null,
        cpfCnpj: u.cpfCnpj ?? null,
      }));
      
      // Filter by role
      if (roleFilter !== 'all') {
        data = data.filter((u) => u.role === roleFilter);
      }
      
      return { data, pagination: res.pagination };
    },
    staleTime: 30 * 1000,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await adminApi.users.delete(userId);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao excluir usuário');
      return res;
    },
    onSuccess: async () => {
      toast({ title: 'Usuário excluído', description: 'Usuário e todos os dados relacionados foram removidos permanentemente do banco.' });
      setDeleteUserId(null);
      setDeleteUserName('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Parameters<typeof adminApi.users.update>[1] }) => {
      const res = await adminApi.users.update(id, body);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao atualizar');
      return res;
    },
    onSuccess: async () => {
      toast({ title: 'Usuário atualizado' });
      setEditUser(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ accountId, planId, endDate }: { accountId: string; planId: string; endDate?: string | null }) => {
      const res = await adminApi.users.changePlan(accountId, planId, endDate);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao alterar plano');
      return res;
    },
    onSuccess: () => {
      toast({ title: 'Plano/Oferta atualizado' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao alterar plano', description: err.message });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (body: Parameters<typeof adminApi.users.create>[0]) => {
      const res = await adminApi.users.create(body);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao criar usuário');
      return res;
    },
    onSuccess: async () => {
      toast({ title: 'Usuário criado' });
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', phone: '', cpfCnpj: '', role: 'user', accountName: '', trialEndsAt: '' });
      setCreateCpfError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    },
  });

  const users = data?.data ?? [];
  const pagination = data?.pagination;

  const { data: plans = [] } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const res = await adminApi.plans.list();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao listar planos');
      return (res.data ?? []) as AdminPlan[];
    },
    staleTime: 60_000,
  });

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    const rawCpf = u.cpfCnpj ?? '';
    // Capturar endDate da subscription e formatar corretamente (apenas data, sem hora)
    const subscriptionEndDate = u.account?.subscription?.endDate 
      ? format(new Date(u.account.subscription.endDate), 'yyyy-MM-dd') 
      : '';
    setEditForm({
      name: u.name,
      email: u.email,
      phone: u.phone ?? '',
      cpfCnpj: rawCpf ? formatCpfCnpj(rawCpf) : '',
      role: u.role ?? 'user',
      accountName: u.account?.name ?? '',
      trialEndsAt: u.account?.trialEndsAt ? format(new Date(u.account.trialEndsAt), 'yyyy-MM-dd') : '',
      planId: u.account?.subscription?.plan?.id ?? '',
      subscriptionEndDate,
    });
    setCpfCnpjError(null);
    setPlanOfferOpen(false);
  };

  const handleCpfCnpjBlur = () => {
    const raw = editForm.cpfCnpj.trim();
    if (!raw) {
      setCpfCnpjError(null);
      return;
    }
    if (!validateCpfCnpj(raw)) {
      setCpfCnpjError('CPF deve ter 11 dígitos ou CNPJ 14 dígitos (válidos).');
    } else {
      setCpfCnpjError(null);
    }
  };

  const handleSaveEdit = () => {
    if (!editUser) return;
    const rawCpf = editForm.cpfCnpj.trim();
    if (rawCpf && !validateCpfCnpj(rawCpf)) {
      setCpfCnpjError('CPF ou CNPJ inválido.');
      return;
    }
    const isAdmin = editForm.role === 'admin';
    const accountId = editUser.account?.id;
    const previousPlanId = editUser.account?.subscription?.plan?.id ?? '';
    const planChanged = !!accountId && !!editForm.planId && editForm.planId !== previousPlanId;

    const nameTrimmed = editForm.name.trim();
    updateUserMutation.mutate(
      {
        id: editUser.id,
        body: {
          name: nameTrimmed,
          email: editForm.email.trim(),
          phone: editForm.phone.trim() || null,
          cpfCnpj: rawCpf ? normalizeCpfCnpj(rawCpf) : null,
          role: editForm.role,
          accountName: nameTrimmed || undefined,
          trialEndsAt: isAdmin ? undefined : (editForm.trialEndsAt || null),
        },
      },
      {
        onSuccess: () => {
          if (planChanged && accountId && editForm.planId) {
            // Manter o endDate atual da subscription ao alterar o plano
            const endDateToKeep = editForm.subscriptionEndDate || null;
            changePlanMutation.mutate({ accountId, planId: editForm.planId, endDate: endDateToKeep });
          }
        },
      }
    );
  };

  const handleCreateCpfBlur = () => {
    const raw = createForm.cpfCnpj.trim();
    if (!raw) {
      setCreateCpfError(null);
      return;
    }
    setCreateCpfError(validateCpfCnpj(raw) ? null : 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos (válidos).');
  };

  const handleCreateUser = () => {
    const rawCpf = createForm.cpfCnpj.trim();
    if (rawCpf && !validateCpfCnpj(rawCpf)) {
      setCreateCpfError('CPF ou CNPJ inválido.');
      return;
    }
    if (!createForm.name.trim() || !createForm.email.trim() || createForm.password.length < 6) {
      toast({ variant: 'destructive', title: 'Preencha nome, e-mail e senha (mín. 6 caracteres)' });
      return;
    }
    const isAdmin = createForm.role === 'admin';
    createUserMutation.mutate({
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password,
      phone: createForm.phone.trim() || null,
      cpfCnpj: rawCpf ? normalizeCpfCnpj(rawCpf) : null,
      role: createForm.role,
      accountName: createForm.accountName.trim() || undefined,
      trialEndsAt: isAdmin ? undefined : (createForm.trialEndsAt || null),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie usuários, data de vencimento e planos
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Adicionar usuário
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      {isLoadingStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-elevated p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : usersStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total de usuários</p>
                <Users className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-foreground">
                  {usersStats.totalUsers}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de usuários cadastrados</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Usuários ativos</p>
                <UserCheck className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-success">
                  {usersStats.activeUsers}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Usuários com vencimento válido</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Vencendo em 7 dias</p>
                <AlertCircle className="w-8 h-8 text-warning" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-warning">
                  {usersStats.expiringIn7Days}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Usuários que vão vencer em breve</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Usuário com mais vendas</p>
                <TrendingUp className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {usersStats.topUserBySales ? (
                  <>
                    <p className="text-2xl font-bold text-info">
                      {usersStats.topUserBySales.salesCount}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 truncate" title={usersStats.topUserBySales.name}>
                      {usersStats.topUserBySales.name}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                    <p className="text-xs text-muted-foreground mt-2">Nenhuma venda registrada</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Lista de usuários</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail, telefone ou CPF/CNPJ..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 w-64"
              />
            </div>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Telefone</TableHead>
                    <TableHead className="font-semibold">CPF/CNPJ</TableHead>
                    <TableHead className="font-semibold">Plano/Oferta</TableHead>
                    <TableHead className="font-semibold">Data de Cadastro</TableHead>
                    <TableHead className="font-semibold">Data de Vencimento</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right w-[140px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: AdminUser) => {
                    const status = getStatus(u);
                    const plan = u.account?.subscription?.plan;
                    return (
                      <TableRow key={u.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {u.role === 'admin' && (
                              <Shield className="w-4 h-4 text-info flex-shrink-0" />
                            )}
                            <TruncatedText 
                              text={u.name}
                              maxWidth="200px"
                            >
                              {u.name}
                            </TruncatedText>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TruncatedText 
                            text={u.email}
                            maxWidth="200px"
                          >
                            {u.email}
                          </TruncatedText>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.phone ? (
                            <TruncatedText 
                              text={u.phone}
                              maxWidth="150px"
                            >
                              {u.phone}
                            </TruncatedText>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.cpfCnpj ? formatCpfCnpj(u.cpfCnpj) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {plan ? planOfferLabel(plan) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(u.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getVencimento(u)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={status.variant}
                            className={status.variant === 'destructive' ? 'bg-destructive text-white' : status.variant === 'default' ? 'bg-success text-white' : ''}
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 h-8"
                              onClick={() => openEdit(u)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="hidden sm:inline">Editar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                              onClick={() => {
                                setDeleteUserId(u.id);
                                setDeleteUserName(u.name);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">Excluir</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {pagination && pagination.totalPages > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {pagination.total} usuário(s) • Página {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Excluir */}
      <Dialog
        open={!!deleteUserId}
        onOpenChange={(open) => !open && (setDeleteUserId(null), setDeleteUserName(''))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Excluir &quot;{deleteUserName}&quot;? Todos os dados do usuário (conta, veículos, vendas, clientes, etc.) serão removidos permanentemente do banco, como se nunca tivesse sido cadastrado. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => (setDeleteUserId(null), setDeleteUserName(''))}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Altere os dados do usuário. CPF/CNPJ deve ser válido.</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="grid gap-2">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={editForm.cpfCnpj}
                  onChange={(e) => setEditForm((f) => ({ ...f, cpfCnpj: e.target.value }))}
                  onBlur={handleCpfCnpjBlur}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                />
                {cpfCnpjError && (
                  <p className="text-xs text-destructive">{cpfCnpjError}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Tipo de usuário</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User (comum)</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.role !== 'admin' && editUser.account && (
                <div className="grid gap-2">
                  <Label>Plano/Oferta</Label>
                  <Select
                    value={editForm.planId || '_none'}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, planId: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o plano/oferta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Nenhum / manter —</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {planOfferLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editForm.role !== 'admin' && (
                <div className="grid gap-2">
                  <Label>Data de vencimento</Label>
                  <Input
                    type="date"
                    value={editForm.trialEndsAt}
                    onChange={(e) => setEditForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    O status será calculado automaticamente: Ativo se a data for maior ou igual a hoje, Vencido caso contrário.
                  </p>
                </div>
              )}
              {editForm.role === 'admin' && (
                <p className="text-xs text-muted-foreground">
                  Usuários admin não expiram; vencimento não se aplica.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!!cpfCnpjError || updateUserMutation.isPending || changePlanMutation.isPending}
            >
              {updateUserMutation.isPending || changePlanMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar usuário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados. Nome, e-mail e senha são obrigatórios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label>Senha (mín. 6 caracteres)</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="grid gap-2">
              <Label>CPF/CNPJ</Label>
              <Input
                value={createForm.cpfCnpj}
                onChange={(e) => setCreateForm((f) => ({ ...f, cpfCnpj: e.target.value }))}
                onBlur={handleCreateCpfBlur}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
              />
              {createCpfError && (
                <p className="text-xs text-destructive">{createCpfError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Tipo de usuário</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (comum)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Nome da conta</Label>
              <Input
                value={createForm.accountName}
                onChange={(e) => setCreateForm((f) => ({ ...f, accountName: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            {createForm.role !== 'admin' && (
              <div className="grid gap-2">
                <Label>Data de vencimento</Label>
                <Input
                  type="date"
                  value={createForm.trialEndsAt}
                  onChange={(e) => setCreateForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  O status será calculado automaticamente: Ativo se a data for maior ou igual a hoje, Vencido caso contrário.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={!!createCpfError || createUserMutation.isPending || createForm.password.length < 6}
            >
              {createUserMutation.isPending ? 'Criando...' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
