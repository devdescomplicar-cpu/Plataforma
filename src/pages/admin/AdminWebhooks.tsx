import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, Edit, List, LayoutGrid, MoreVertical, Search, Settings, Wrench, Power, Play } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { adminApi, type WebhookItem, type WebhookLogEntry, type WebhookFieldMapping } from '@/lib/admin-api';
import { useToast } from '@/hooks/use-toast';

const systemFields = [
  { value: 'name', label: 'Nome', description: 'Nome do usuário', category: 'user' },
  { value: 'email', label: 'Email', description: 'Email do usuário (obrigatório)', category: 'user' },
  { value: 'phone', label: 'Telefone', description: 'Telefone do usuário', category: 'user' },
  { value: 'cpfCnpj', label: 'CPF/CNPJ', description: 'CPF ou CNPJ (apenas números)', category: 'user' },
  { value: 'plan', label: 'Plano', description: 'Produto base. Selecione o plano do sistema (apenas nome).', category: 'account', planDropdown: true },
  { value: 'offer', label: 'Oferta', description: 'Recorrência: mapeie o campo do JSON (mensal, P3M, interval+interval_count, etc.). Detectado automaticamente.', category: 'account' },
  { value: 'quantity', label: 'Quantidade', description: 'Multiplicador de períodos. Mapeie do JSON ou use 1 como padrão. Editável manualmente.', category: 'account' },
  { value: 'status', label: 'Status', description: 'Status da conta. Apenas Ativo ou Vencido (não mapeia do JSON).', category: 'account', statusDropdown: true },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'vencido', label: 'Vencido' },
] as const;

const WEBHOOKS_VIEW_KEY = 'admin-webhooks-view';
type WebhooksViewMode = 'list' | 'cards';

function getStoredViewMode(): WebhooksViewMode {
  try {
    const v = localStorage.getItem(WEBHOOKS_VIEW_KEY);
    if (v === 'list' || v === 'cards') return v;
  } catch {
    // ignore
  }
  return 'list';
}

function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function extractAllFields(
  obj: unknown,
  prefix = '',
  result: Array<{ path: string; value: unknown }> = []
): Array<{ path: string; value: unknown }> {
  if (obj === null || obj === undefined) return result;
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractAllFields(item, prefix ? `${prefix}[${index}]` : `[${index}]`, result);
    });
    return result;
  }
  if (typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) extractAllFields(value, fullPath, result);
      else if (value !== null && typeof value === 'object') extractAllFields(value, fullPath, result);
      else result.push({ path: fullPath, value });
    });
    return result;
  }
  result.push({ path: prefix, value: obj });
  return result;
}

function getFieldValue(body: Record<string, unknown>, path: string): string {
  const keys = path.split(/[.[\]]+/).filter((k) => k !== '');
  let value: unknown = body;
  for (const key of keys) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && key in (value as object)) value = (value as Record<string, unknown>)[key];
    else return '';
  }
  return String(value ?? '');
}

/** One entry per plan base name (product); value is first plan id for that name. No period/offer type in label. */
function plansByBaseName(plans: { id: string; name: string; active?: boolean }[]): { id: string; name: string }[] {
  const active = plans.filter((p) => p.active !== false);
  const byName = new Map<string, string>();
  for (const p of active) {
    if (!byName.has(p.name)) byName.set(p.name, p.id);
  }
  return Array.from(byName.entries()).map(([name, id]) => ({ id, name }));
}

/** Resolve selected plan id to the representative id (first of same name) so Select value matches options. */
function representativePlanId(
  planId: string | undefined,
  plans: { id: string; name: string }[],
  uniquePlans: { id: string; name: string }[]
): string {
  if (!planId) return '';
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return planId;
  const rep = uniquePlans.find((u) => u.name === plan.name);
  return rep?.id ?? planId;
}

export default function AdminWebhooks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [selectedTestLog, setSelectedTestLog] = useState<WebhookLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState<Record<string, string>>({});
  const [createName, setCreateName] = useState('');
  const [viewMode, setViewMode] = useState<WebhooksViewMode>(() => getStoredViewMode());
  const [searchWebhook, setSearchWebhook] = useState('');
  const [duplicateSource, setDuplicateSource] = useState<WebhookItem | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookItem | null>(null);
  const [selectedHistoryLog, setSelectedHistoryLog] = useState<WebhookLogEntry | null>(null);
  const [searchHistory, setSearchHistory] = useState('');

  const setViewModeAndPersist = (mode: WebhooksViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(WEBHOOKS_VIEW_KEY, mode);
    } catch {
      // ignore
    }
  };

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['admin', 'webhooks'],
    queryFn: async () => {
      const res = await adminApi.webhooks.list();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return (res.data ?? []) as WebhookItem[];
    },
    staleTime: 30_000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['admin', 'webhook-logs', editingWebhook?.id],
    queryFn: async () => {
      if (!editingWebhook?.id) return [];
      const res = await adminApi.webhooks.getLogs(editingWebhook.id, 2);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return (res.data ?? []) as WebhookLogEntry[];
    },
    enabled: !!editingWebhook?.id,
  });

  const { data: allLogs = [], isLoading: allLogsLoading } = useQuery({
    queryKey: ['admin', 'webhook-logs-all'],
    queryFn: async () => {
      const res = await adminApi.webhooks.getAllLogs({ limit: 100 });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return (res.data ?? []) as WebhookLogEntry[];
    },
    staleTime: 15_000,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const res = await adminApi.plans.list();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return (res.data ?? []) as { id: string; name: string; active?: boolean }[];
    },
    staleTime: 60_000,
  });

  const planOptionsByBaseName = plansByBaseName(plans);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await adminApi.webhooks.create({
        name,
        fieldMappings: [],
        isActive: false,
        testMode: true,
        actions: [],
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
      setIsCreateOpen(false);
      setCreateName('');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ source, name }: { source: WebhookItem; name: string }) => {
      const res = await adminApi.webhooks.create({
        name: name.trim(),
        fieldMappings: [...(source.fieldMappings ?? [])],
        isActive: false,
        testMode: true,
        actions: source.actions ?? [],
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return res.data!;
    },
    onSuccess: (newWebhook) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
      setDuplicateSource(null);
      setDuplicateName('');
      setEditingWebhook(newWebhook);
      toast({ title: 'Webhook duplicado', description: 'Ajuste o mapeamento se necessário.' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      data: Partial<WebhookItem>;
      closeAfterSuccess?: boolean;
    }) => {
      const { id, data } = vars;
      const res = await adminApi.webhooks.update(id, data);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return res.data!;
    },
    onSuccess: (updated, variables) => {
      const { id, closeAfterSuccess } = variables;
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhook-logs', id] });
      if (closeAfterSuccess) {
        setEditingWebhook(null);
        setSelectedTestLog(null);
      } else if (editingWebhook?.id === id) {
        setEditingWebhook(updated);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminApi.webhooks.delete(id);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
    },
    onSuccess: (_, id) => {
      if (editingWebhook?.id === id) setEditingWebhook(null);
      queryClient.setQueryData<WebhookItem[]>(['admin', 'webhooks'], (old) =>
        old ? old.filter((w) => w.id !== id) : []
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminApi.webhooks.reprocess(id);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao reprocessar');
      return res;
    },
    onSuccess: () => {
      toast({ title: 'Reprocessado', description: 'Payload processado em produção. O usuário deve aparecer na Lista de usuários.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks', 'logs'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao reprocessar', description: err.message });
    },
  });

  const copyUrl = (url: string, id: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'URL copiada' });
  };

  const handleToggleActive = (w: WebhookItem) => {
    const nextActive = !w.isActive;
    updateMutation.mutate({
      id: w.id,
      data: {
        isActive: nextActive,
        testMode: nextActive ? false : true,
      },
    });
  };

  const handleOpenEdit = (w: WebhookItem) => {
    setEditingWebhook({ ...w });
    setSelectedTestLog(null);
    if (!w.testMode) {
      updateMutation.mutate({ id: w.id, data: { testMode: true } });
    }
  };

  const handleCloseEdit = () => {
    if (editingWebhook?.testMode) {
      updateMutation.mutate({
        id: editingWebhook.id,
        data: { testMode: false, isActive: editingWebhook.isActive },
      });
    }
    setEditingWebhook(null);
    setSelectedTestLog(null);
  };

  const handleMapField = (
    systemField: string,
    webhookField: string,
    prefix?: string,
    suffix?: string
  ) => {
    if (!editingWebhook) return;
    const label = systemFields.find((f) => f.value === systemField)?.label ?? systemField;
    const existing = editingWebhook.fieldMappings.find((m) => m.systemField === systemField);
    const newMappings: WebhookFieldMapping[] = existing
      ? editingWebhook.fieldMappings.map((m) =>
          m.systemField === systemField
            ? { ...m, webhookField, label, prefix, suffix }
            : m
        )
      : [
          ...editingWebhook.fieldMappings,
          { webhookField, systemField, label, prefix, suffix },
        ];
    setEditingWebhook({ ...editingWebhook, fieldMappings: newMappings });
    updateMutation.mutate({ id: editingWebhook.id, data: { fieldMappings: newMappings } });
  };

  const handleRemoveMapping = (systemField: string) => {
    if (!editingWebhook) return;
    const newMappings = editingWebhook.fieldMappings.filter((m) => m.systemField !== systemField);
    setEditingWebhook({ ...editingWebhook, fieldMappings: newMappings });
    updateMutation.mutate({ id: editingWebhook.id, data: { fieldMappings: newMappings } });
  };

  const handleUpdatePrefixSuffix = (systemField: string, prefix: string, suffix: string) => {
    if (!editingWebhook) return;
    const m = editingWebhook.fieldMappings.find((x) => x.systemField === systemField);
    if (!m) return;
    handleMapField(systemField, m.webhookField, prefix || undefined, suffix || undefined);
  };

  const filteredWebhooks = webhooks.filter(
    (w) => !searchWebhook.trim() || w.name.toLowerCase().includes(searchWebhook.trim().toLowerCase())
  );

  const filteredHistoryLogs = allLogs.filter(
    (log) =>
      !searchHistory.trim() ||
      JSON.stringify(log.body).toLowerCase().includes(searchHistory.trim().toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho da página — padrão do painel admin */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure integrações e acompanhe o histórico de payloads recebidos
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm w-full sm:w-auto shrink-0">
              <Plus className="h-4 w-4" />
              Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Webhook</DialogTitle>
              <DialogDescription>Nome do webhook. A URL será gerada automaticamente.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Ex: Webhook Principal"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!createName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(createName.trim())}
              >
                {createMutation.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="webhooks" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-[280px] grid-cols-2 h-10 p-1 bg-muted/50">
          <TabsTrigger value="webhooks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-6 mt-0">
          {/* Barra: busca, visualização e botão — padrão card */}
          <div className="card-elevated p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar webhooks..."
                  value={searchWebhook}
                  onChange={(e) => setSearchWebhook(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewModeAndPersist('list')}
                  title="Modo Lista"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewModeAndPersist('cards')}
                  title="Modo Cards"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="card-elevated overflow-hidden rounded-xl">
              <div className="p-4 sm:p-5 border-b border-border">
                <h3 className="font-semibold text-foreground">Lista de webhooks</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredWebhooks.length} webhook{filteredWebhooks.length !== 1 ? 's' : ''} encontrado{filteredWebhooks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ativo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">URL</TableHead>
                    <TableHead className="hidden md:table-cell">Criado em</TableHead>
                    <TableHead className="w-12 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWebhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="w-12">
                        <Label className="sr-only">Ativo</Label>
                        <Switch
                          checked={webhook.isActive}
                          onCheckedChange={() => handleToggleActive(webhook)}
                          disabled={updateMutation.isPending}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{webhook.name}</div>
                        <div className="flex items-center gap-2 mt-1 sm:hidden">
                          <Badge variant={webhook.testMode ? 'outline' : 'default'} className={webhook.testMode ? 'border-amber-500 text-amber-600' : ''}>
                            {webhook.testMode ? (
                              <><Wrench className="h-3 w-3 mr-1" /> Teste</>
                            ) : (
                              <><Power className="h-3 w-3 mr-1" /> Produção</>
                            )}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={webhook.testMode ? 'outline' : 'default'} className={webhook.testMode ? 'border-amber-500 text-amber-600' : 'bg-emerald-600'}>
                          {webhook.testMode ? <Wrench className="h-3 w-3 mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                          {webhook.testMode ? 'Teste' : 'Produção'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell max-w-[200px]">
                        <div className="flex items-center gap-1">
                          <code className="text-xs break-all">{webhook.serverUrl}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyUrl(webhook.serverUrl, webhook.id)}>
                            {copiedId === webhook.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {formatDate(webhook.createdAt)}
                      </TableCell>
                      <TableCell className="w-12 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Abrir menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(webhook)}>
                              <Settings className="h-4 w-4 mr-2" />
                              Configurar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!webhook.lastTestPayload || !webhook.fieldMappings?.length || reprocessMutation.isPending}
                              onClick={() => reprocessMutation.mutate(webhook.id)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Reprocessar em produção
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDuplicateSource(webhook);
                                setDuplicateName(`Cópia de ${webhook.name}`);
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyUrl(webhook.serverUrl, webhook.id)}>
                              {copiedId === webhook.id ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                              {copiedId === webhook.id ? 'Copiado' : 'Copiar URL'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setWebhookToDelete(webhook)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
      ) : (
        <div className="card-elevated overflow-hidden rounded-xl">
          <div className="p-4 sm:p-5 border-b border-border">
            <h3 className="font-semibold text-foreground">Lista de webhooks</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredWebhooks.length} webhook{filteredWebhooks.length !== 1 ? 's' : ''} encontrado{filteredWebhooks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredWebhooks.map((webhook) => (
              <Card key={webhook.id} className="card-elevated hover:shadow-md transition-shadow rounded-xl overflow-hidden border">
                <CardHeader className="p-3 pb-0 flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-semibold truncate">{webhook.name}</CardTitle>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant={webhook.isActive && !webhook.testMode ? 'default' : 'outline'} className={`text-xs px-2 py-0.5 ${webhook.isActive && !webhook.testMode ? 'bg-emerald-600' : 'border-amber-500 text-amber-600'}`}>
                        {webhook.isActive && !webhook.testMode ? 'Produção' : 'Teste'}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={webhook.isActive}
                    onCheckedChange={() => handleToggleActive(webhook)}
                    disabled={updateMutation.isPending}
                    className="shrink-0"
                  />
                </CardHeader>
                <CardContent className="p-3 pt-2 space-y-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <code className="text-xs break-all line-clamp-2 flex-1">{webhook.serverUrl}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyUrl(webhook.serverUrl, webhook.id)}>
                      {copiedId === webhook.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => handleOpenEdit(webhook)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      title="Reprocessar em produção"
                      disabled={!webhook.lastTestPayload || !webhook.fieldMappings?.length || reprocessMutation.isPending}
                      onClick={() => reprocessMutation.mutate(webhook.id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Reprocessar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setWebhookToDelete(webhook)}
                      disabled={deleteMutation.isPending}
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="historico" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[420px]">
            <div className="lg:col-span-1 flex flex-col card-elevated rounded-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border">
                <h3 className="font-semibold text-foreground mb-3">Payloads recebidos</h3>
                <Input
                  placeholder="Buscar no histórico..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="h-9"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {filteredHistoryLogs.length} payloads encontrados
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {allLogsLoading ? (
                  <p className="text-sm text-muted-foreground p-4">Carregando...</p>
                ) : filteredHistoryLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Nenhum payload recebido ainda.</p>
                ) : (
                  filteredHistoryLogs.map((log) => (
                    <Card
                      key={log.id}
                      className={`cursor-pointer transition-colors rounded-lg ${
                        selectedHistoryLog?.id === log.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/30'
                      }`}
                      onClick={() => setSelectedHistoryLog(log)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-sm font-medium">
                            {formatDateTime(log.receivedAt)}
                          </span>
                          <Badge
                            variant={log.webhookTestMode ? 'outline' : 'default'}
                            className={log.webhookTestMode ? 'border-amber-500 text-amber-600' : 'bg-emerald-600'}
                          >
                            {log.webhookTestMode ? 'Teste' : 'Processada'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          IP: {log.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ?? log.headers?.['x-real-ip'] ?? '—'}
                        </p>
                        <p className="text-sm font-medium mt-1 truncate">{log.webhookName}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-col card-elevated rounded-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border shrink-0">
                <h3 className="font-semibold text-foreground">Detalhes do payload</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedHistoryLog ? 'Informações do payload selecionado' : 'Selecione um item na lista'}
                </p>
              </div>
              {selectedHistoryLog ? (
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {selectedHistoryLog.response?.data?.resumo && (() => {
                    const r = selectedHistoryLog.response.data.resumo as {
                      acaoLabel?: string;
                      usuario?: { nome: string; email: string; cpfCnpj?: string | null };
                      plano?: string;
                      oferta?: string;
                      dataVencimento?: string;
                      status?: string;
                    };
                    return (
                      <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
                        <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-3">Ação</h3>
                        <div className="text-sm space-y-1.5">
                          <p className="font-semibold">
                            {r.acaoLabel ?? '—'}: {r.usuario?.email ?? '—'}
                          </p>
                          <p><span className="text-muted-foreground">Nome:</span> {r.usuario?.nome ?? '—'}</p>
                          <p><span className="text-muted-foreground">CPF/CNPJ:</span> {r.usuario?.cpfCnpj ?? '—'}</p>
                          <p><span className="text-muted-foreground">Plano:</span> {r.plano ?? '—'}</p>
                          <p><span className="text-muted-foreground">Oferta:</span> {r.oferta ?? '—'}</p>
                          <p><span className="text-muted-foreground">Data de vencimento:</span> {r.dataVencimento ?? '—'}</p>
                          <p><span className="text-muted-foreground">Status:</span> {r.status ?? '—'}</p>
                        </div>
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="font-semibold mb-1">Payload completo recebido</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Dados completos recebidos do webhook
                    </p>
                    <pre className="text-xs bg-muted rounded-md p-4 overflow-auto max-h-[280px] whitespace-pre-wrap break-words border">
                      {JSON.stringify(selectedHistoryLog.body, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Resposta enviada</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Resposta HTTP enviada para o webhook após recebimento
                    </p>
                    <pre className="text-xs bg-muted rounded-md p-4 overflow-auto max-h-[120px] whitespace-pre-wrap break-words border">
                      {selectedHistoryLog.response != null
                        ? JSON.stringify(selectedHistoryLog.response, null, 2)
                        : selectedHistoryLog.error ?? '—'}
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Informações da requisição</h3>
                    <div className="text-sm space-y-1 border rounded-md p-4 bg-muted/30">
                      <p>
                        <span className="text-muted-foreground">Método:</span> {selectedHistoryLog.method}
                      </p>
                      <p>
                        <span className="text-muted-foreground">IP:</span>{' '}
                        {selectedHistoryLog.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
                          selectedHistoryLog.headers?.['x-real-ip'] ??
                          '—'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">User-Agent:</span>{' '}
                        {selectedHistoryLog.headers?.['user-agent'] ?? '—'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Recebido em:</span>{' '}
                        {formatDateTime(selectedHistoryLog.receivedAt)}
                      </p>
                      {selectedHistoryLog.statusCode != null && (
                        <p>
                          <span className="text-muted-foreground">Status HTTP:</span>{' '}
                          {selectedHistoryLog.statusCode}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
                  <p className="text-sm text-center">Selecione um payload na lista para ver os detalhes.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!webhookToDelete}
        onOpenChange={(open) => !open && setWebhookToDelete(null)}
        onConfirm={() => {
          if (webhookToDelete) {
            deleteMutation.mutate(webhookToDelete.id);
            setWebhookToDelete(null);
          }
        }}
        title="Excluir webhook"
        description="Desativar e excluir este webhook? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        icon={Trash2}
      />

      <Dialog open={!!duplicateSource} onOpenChange={(open) => !open && setDuplicateSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar webhook</DialogTitle>
            <DialogDescription>
              Será criada uma cópia com o mesmo mapeamento. Você poderá alterar o nome e ajustar os campos após criar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="duplicate-name">Nome da cópia</Label>
            <Input
              id="duplicate-name"
              placeholder="Ex: Cópia de Meu Webhook"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateSource(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!duplicateName.trim() || duplicateMutation.isPending}
              onClick={() => duplicateSource && duplicateMutation.mutate({ source: duplicateSource, name: duplicateName })}
            >
              {duplicateMutation.isPending ? 'Criando cópia...' : 'Criar cópia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingWebhook && (
        <Dialog open={!!editingWebhook} onOpenChange={(open) => !open && handleCloseEdit()}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Editar: {editingWebhook.name}</DialogTitle>
              <DialogDescription>Mapeie os campos do JSON de teste para os campos do sistema (user/account).</DialogDescription>
            </DialogHeader>
            <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden min-h-0">
              <div className="flex flex-col border rounded-lg overflow-hidden">
                <div className="p-4 border-b bg-muted">
                  <h3 className="font-semibold">Testes recebidos</h3>
                  <p className="text-sm text-muted-foreground">Clique em um teste para mapear campos. Em modo teste nenhum usuário é criado na Lista de usuários; ative em Produção e reenvie (ou use Reprocessar em produção).</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum teste ainda. Envie um POST para a URL do webhook em modo teste.</p>
                  ) : (
                    logs.map((log) => (
                      <Card
                        key={log.id}
                        className={`cursor-pointer ${selectedTestLog?.id === log.id ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => setSelectedTestLog(log)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">{formatDateTime(log.receivedAt)}</span>
                            {log.statusCode != null && log.statusCode >= 200 && log.statusCode < 300 ? (
                              <Badge className="bg-green-600">OK</Badge>
                            ) : (
                              <Badge variant="destructive">Erro</Badge>
                            )}
                          </div>
                          <pre className="text-xs overflow-auto max-h-24 whitespace-pre-wrap break-words">
                            {JSON.stringify(log.body, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-col border rounded-lg overflow-hidden">
                <div className="p-4 border-b bg-muted">
                  <h3 className="font-semibold">Campos do sistema</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTestLog ? 'Selecione um campo do JSON para mapear' : 'Selecione um teste à esquerda'}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {systemFields.map((field) => {
                    const mapping = editingWebhook.fieldMappings.find((m) => m.systemField === field.value);
                    const mappedVal = selectedTestLog && mapping ? getFieldValue(selectedTestLog.body, mapping.webhookField) : null;
                    const previewVal =
                      mapping && field.value === 'plan'
                        ? (planOptionsByBaseName.find((p) => p.id === (representativePlanId(mapping.webhookField, plans, planOptionsByBaseName) || mapping.webhookField))?.name ?? mapping.webhookField)
                        : mapping && field.value === 'status'
                          ? (STATUS_OPTIONS.find((o) => o.value === mapping.webhookField)?.label ?? mapping.webhookField)
                          : mappedVal;
                    return (
                      <Card key={field.value} className="p-4">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <Label className="font-semibold">{field.label}</Label>
                          {mapping && <Badge variant="outline">Mapeado</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
                        {selectedTestLog && (
                          <>
                            {mapping ? (
                              <div className="space-y-2">
                                <div className="text-sm">
                                  Campo: <code className="bg-muted px-1 rounded">{mapping.webhookField}</code>
                                </div>
                                {(previewVal !== null && previewVal !== '') && (
                                  <div className="text-sm p-2 bg-muted rounded border">
                                    Preview: {field.value === 'plan' || field.value === 'status' ? '' : (mapping.prefix ?? '')}
                                    <strong>{previewVal}</strong>
                                    {field.value === 'plan' || field.value === 'status' ? '' : (mapping.suffix ?? '')}
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Prefixo</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="+55"
                                      value={mapping.prefix ?? ''}
                                      onChange={(e) => handleUpdatePrefixSuffix(field.value, e.target.value, mapping.suffix ?? '')}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Sufixo</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder=""
                                      value={mapping.suffix ?? ''}
                                      onChange={(e) => handleUpdatePrefixSuffix(field.value, mapping.prefix ?? '', e.target.value)}
                                    />
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveMapping(field.value)}>
                                  Remover mapeamento
                                </Button>
                              </div>
                            ) : (field as { planDropdown?: boolean }).planDropdown ? (
                              <div className="space-y-2">
                                <Label className="text-xs">Selecione o plano (apenas nome do produto)</Label>
                                <Select
                                  value={representativePlanId(mapping?.webhookField, plans, planOptionsByBaseName) || ''}
                                  onValueChange={(planId) => handleMapField(field.value, planId)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione um plano" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {planOptionsByBaseName.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  Apenas o nome do plano. Oferta/recorrência é mapeada no campo Oferta.
                                </p>
                              </div>
                            ) : (field as { statusDropdown?: boolean }).statusDropdown ? (
                              <div className="space-y-2">
                                <Label className="text-xs">Status da conta (não mapeia do JSON)</Label>
                                <Select
                                  value={mapping?.webhookField ?? ''}
                                  onValueChange={(v) => handleMapField(field.value, v)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione o status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  Valor fixo: Ativo ou Vencido. Não é lido do payload.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Input
                                  className="text-xs"
                                  placeholder="Buscar campo no JSON..."
                                  value={fieldSearch[field.value] ?? ''}
                                  onChange={(e) => setFieldSearch((s) => ({ ...s, [field.value]: e.target.value }))}
                                />
                                <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                                  {extractAllFields(selectedTestLog.body)
                                    .filter(({ path, value }) => {
                                      const q = (fieldSearch[field.value] ?? '').toLowerCase();
                                      if (!q) return true;
                                      return path.toLowerCase().includes(q) || String(value).toLowerCase().includes(q);
                                    })
                                    .map(({ path, value }) => (
                                      <button
                                        key={path}
                                        type="button"
                                        className="w-full text-left p-2 rounded text-xs border hover:bg-accent"
                                        onClick={() => handleMapField(field.value, path)}
                                      >
                                        <span className="font-mono break-all">{path}</span>
                                        <span className="block truncate text-muted-foreground">{String(value)}</span>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {!selectedTestLog && <p className="text-xs italic text-muted-foreground">Selecione um teste para mapear</p>}
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseEdit}>
                Fechar
              </Button>
              <Button
                disabled={editingWebhook.fieldMappings.length === 0}
                onClick={() => {
                  updateMutation.mutate({
                    id: editingWebhook.id,
                    data: { isActive: true, testMode: false },
                    closeAfterSuccess: true,
                  });
                }}
              >
                Ativar e salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
