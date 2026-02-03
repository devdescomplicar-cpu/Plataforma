import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  type NotificationTemplateEntry,
  type NotificationTemplateTrigger,
  type NotificationTemplateChannel,
  type NotificationTemplateCreate,
} from "@/lib/admin-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TEMPLATE_VARIABLES, getVariablePlaceholder } from "@/lib/template-variables";
import { ChevronDown, FileText, HelpCircle, History, Pencil, Send, Trash2 } from "lucide-react";

const TRIGGER_OPTIONS: { value: NotificationTemplateTrigger; label: string }[] = [
  { value: "welcome", label: "Bem-vindo (cliente cadastrado)" },
  { value: "subscription_expiring", label: "Assinatura vai expirar" },
  { value: "subscription_expired", label: "Assinatura expirada" },
  { value: "password_recovery", label: "Recuperação de senha" },
  {
    value: "non_renewal_warning",
    label: "Aviso de limpeza de dados (sem renovação)",
  },
];

const CHANNEL_OPTIONS: { value: NotificationTemplateChannel; label: string }[] = [
  { value: "pwa", label: "PWA (notificação no app)" },
  { value: "email", label: "E-mail" },
];

function triggerLabel(t: NotificationTemplateTrigger): string {
  return TRIGGER_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function channelLabel(c: NotificationTemplateChannel): string {
  return CHANNEL_OPTIONS.find((o) => o.value === c)?.label ?? c;
}

function daysOffsetLabel(trigger: NotificationTemplateTrigger, days: number | null): string {
  if (days === null) return "—";
  if (trigger === "subscription_expiring") return `${days} dia(s) antes`;
  if (trigger === "subscription_expired") return days === 0 ? "No dia" : `${days} dia(s) depois`;
  if (trigger === "non_renewal_warning")
    return days === 0 ? "No dia" : `${days} dia(s) depois`;
  return "—";
}

const emptyForm = {
  name: "",
  trigger: "welcome" as NotificationTemplateTrigger,
  channel: "pwa" as NotificationTemplateChannel,
  daysOffset: null as number | null,
  subject: "",
  title: "",
  body: "",
  active: true,
};

export default function AdminTemplates() {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null);
  const [testUserId, setTestUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [variablesOpen, setVariablesOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin", "templates"],
    queryFn: async () => {
      const res = await adminApi.templates.list();
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return (res.data ?? []) as NotificationTemplateEntry[];
    },
    staleTime: 30_000,
  });

  const { data: usersForTest = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users", "for-test", userSearch],
    queryFn: async () => {
      const res = await adminApi.users.list({
        search: userSearch.trim() || undefined,
        limit: 100,
      });
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return (res.data ?? []) as Array<{ id: string; name: string; email: string }>;
    },
    enabled: !!testTemplateId,
    staleTime: 30_000,
  });

  const { data: usageLogs = [], isLoading: usageLoading } = useQuery({
    queryKey: ["admin", "templates", "usage"],
    queryFn: async () => {
      const res = await adminApi.templates.getUsageLog({ limit: 100 });
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return (res.data ?? []) as import("@/lib/admin-api").TemplateUsageLogEntry[];
    },
    staleTime: 15_000,
  });

  const userOptions = usersForTest
    .filter((u) => u.email)
    .map((u) => ({
      value: u.id,
      label: `${u.name} (${u.email})`,
      searchText: `${u.name} ${u.email}`.toLowerCase(),
    }));

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!testTemplateId || !testUserId) throw new Error("Selecione um usuário");
      const res = await adminApi.templates.test(testTemplateId, testUserId);
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Teste enviado",
        description: data?.message ?? "E-mail enviado. Verifique a caixa de entrada.",
      });
      setTestTemplateId(null);
      setTestUserId("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "templates", "usage"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "smtp", "logs"] });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Falha no teste", description: e.message }),
  });

  useEffect(() => {
    if (editingId) {
      const t = templates.find((x) => x.id === editingId);
      if (t) {
        setForm({
          name: t.name ?? "",
          trigger: t.trigger,
          channel: t.channel,
          daysOffset: t.daysOffset,
          subject: t.subject ?? "",
          title: t.title ?? "",
          body: t.body,
          active: t.active,
        });
      }
    } else {
      setForm(emptyForm);
    }
  }, [editingId, templates]);

  const createMutation = useMutation({
    mutationFn: async (payload: NotificationTemplateCreate) => {
      const res = await adminApi.templates.create(payload);
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return res.data!;
    },
    onSuccess: () => {
      toast({ title: "Template criado" });
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["admin", "templates"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: NotificationTemplateCreate }) => {
      const res = await adminApi.templates.update(id, payload);
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return res.data!;
    },
    onSuccess: () => {
      toast({ title: "Template atualizado" });
      setEditingId(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["admin", "templates"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await adminApi.templates.delete(id);
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
    },
    onSuccess: () => {
      toast({ title: "Template removido" });
      setDeleteId(null);
      if (editingId) setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "templates"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const needsDaysOffset =
    form.trigger === "subscription_expiring" ||
    form.trigger === "subscription_expired" ||
    form.trigger === "non_renewal_warning";

  const buildPayload = (): NotificationTemplateCreate => ({
    name: form.name.trim() || null,
    trigger: form.trigger,
    channel: form.channel,
    daysOffset: needsDaysOffset
      ? form.daysOffset ??
        0
      : null,
    subject: form.channel === "email" ? (form.subject.trim() || null) : null,
    title: form.channel === "pwa" ? (form.title.trim() || null) : null,
    body: form.body.trim(),
    active: form.active,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.body.trim()) {
      toast({ variant: "destructive", title: "Mensagem é obrigatória" });
      return;
    }
    if (form.channel === "pwa" && !form.title.trim()) {
      toast({ variant: "destructive", title: "Título é obrigatório para PWA" });
      return;
    }
    if (form.channel === "email" && !form.subject.trim()) {
      toast({ variant: "destructive", title: "Assunto é obrigatório para e-mail" });
      return;
    }
    if (needsDaysOffset && form.daysOffset === null) {
      toast({ variant: "destructive", title: "Informe em quantos dias enviar" });
      return;
    }
    if (form.trigger === "subscription_expiring" && (form.daysOffset ?? 0) < 1) {
      toast({ variant: "destructive", title: "Para “vai expirar” use pelo menos 1 dia antes" });
      return;
    }
    if (
      (form.trigger === "subscription_expired" ||
        form.trigger === "non_renewal_warning") &&
      (form.daysOffset ?? -1) < 0
    ) {
      toast({
        variant: "destructive",
        title: "Para “expirada” e “sem renovação” use 0 ou mais dias depois",
      });
      return;
    }
    const payload = buildPayload();
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-muted-foreground mt-1">
          Personalize mensagens por gatilho e canal (PWA ou e-mail). Defina quando enviar (dias antes/depois) para
          assinatura.
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="size-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            {editingId ? "Editar template" : "Novo template"}
          </CardTitle>
          <CardDescription>
            Gatilhos: Bem-vindo (cadastro), Assinatura vai expirar (X dias antes), Assinatura expirada (X dias depois),
            Recuperação de senha (tela de login), Aviso de limpeza de dados (clientes que não renovaram em X dias).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gatilho</Label>
                <Select
                  value={form.trigger}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        trigger: v as NotificationTemplateTrigger,
                        daysOffset:
                          v === "welcome" || v === "password_recovery"
                            ? null
                            : f.daysOffset ??
                              (v === "subscription_expiring"
                                ? 3
                                : v === "non_renewal_warning"
                                  ? 30
                                  : 0),
                      }))
                    }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm((f) => ({ ...f, channel: v as NotificationTemplateChannel }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {needsDaysOffset && (
              <div className="space-y-2">
                <Label>
                  {form.trigger === "subscription_expiring"
                    ? "Enviar quantos dias antes do vencimento?"
                    :                     form.trigger === "non_renewal_warning"
                      ? "Enviar quantos dias após o vencimento? (0 = no dia)"
                      : "Enviar quantos dias após o vencimento? (0 = no dia)"}
                </Label>
                <Input
                  type="number"
                  min={
                    form.trigger === "subscription_expiring" ? 1 : 0
                  }
                  value={form.daysOffset ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const minVal =
                      form.trigger === "subscription_expiring" ? 1 : 0;
                    setForm((f) => ({
                      ...f,
                      daysOffset:
                        v === ""
                          ? null
                          : Math.max(minVal, parseInt(v, 10) || minVal),
                    }));
                  }}
                  placeholder={
                    form.trigger === "subscription_expiring"
                      ? "Ex: 3"
                      :                       form.trigger === "non_renewal_warning"
                        ? "Ex: 0, 30, 60"
                        : "Ex: 0, 3, 10"
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome (opcional)</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Bem-vindo e-mail"
              />
            </div>

            {form.channel === "pwa" && (
              <div className="space-y-2">
                <Label>Título (PWA)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Título da notificação"
                />
              </div>
            )}

            {form.channel === "email" && (
              <div className="space-y-2">
                <Label>Assunto (e-mail)</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Assunto do e-mail"
                />
              </div>
            )}

            <Collapsible open={variablesOpen} onOpenChange={setVariablesOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                >
                  <HelpCircle className="size-4" />
                  Variáveis disponíveis
                  <ChevronDown
                    className={`size-4 transition-transform ${variablesOpen ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="mb-2 text-muted-foreground">
                    Use <code className="rounded bg-muted px-1">{"{{var}}"}</code> no
                    título, assunto ou mensagem:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <div
                        key={v.key}
                        className="flex flex-col gap-0.5 rounded border bg-background p-2"
                      >
                        <code className="text-xs font-mono text-primary">
                          {getVariablePlaceholder(v.key)}
                        </code>
                        <span className="text-muted-foreground">{v.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Ex: Olá {{nome_usuario}}, sua assinatura vence em {{data_vencimento}}. Acesse {{link_planos}} para renovar."
                rows={5}
                className="resize-none font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <Label>Ativo</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {editingId ? "Atualizar" : "Criar template"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates cadastrados</CardTitle>
          <CardDescription>Gatilhos automáticos e envio por PWA ou e-mail</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground py-4">Carregando...</p>}
          {!isLoading && templates.length === 0 && (
            <p className="text-muted-foreground py-4">Nenhum template cadastrado.</p>
          )}
          {!isLoading && templates.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.name || triggerLabel(t.trigger)}
                    </TableCell>
                    <TableCell>{channelLabel(t.channel)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {daysOffsetLabel(t.trigger, t.daysOffset)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.active ? "default" : "secondary"}>{t.active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.channel === "email" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTestTemplateId(t.id);
                              setTestUserId("");
                            }}
                            title="Testar template"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingId(t.id)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(t.id)}
                          title="Remover"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5" />
                Histórico de gatilhos
              </CardTitle>
              <CardDescription>
                Todos os usos de templates (teste, recuperação de senha, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
              {!usageLoading && usageLogs.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhum gatilho utilizado ainda.</p>
              )}
              {!usageLoading && usageLogs.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Template / Gatilho</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="max-w-[180px]">Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                            {new Date(log.createdAt).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{log.templateName}</span>
                            <span className="ml-1 text-muted-foreground text-xs">({log.trigger})</span>
                          </TableCell>
                          <TableCell>{channelLabel(log.channel as NotificationTemplateChannel)}</TableCell>
                          <TableCell className="max-w-[160px] truncate text-muted-foreground" title={log.recipientInfo ?? ""}>
                            {log.recipientInfo ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.success ? "default" : "destructive"}>
                              {log.success ? "Sucesso" : "Erro"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-muted-foreground text-xs" title={log.errorMessage ?? ""}>
                            {log.errorMessage ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!testTemplateId}
        onOpenChange={(open) => {
          if (!open) {
            setTestTemplateId(null);
            setTestUserId("");
            setUserSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Testar template</DialogTitle>
            <DialogDescription>
              Selecione um usuário para enviar o e-mail de teste com os dados reais dele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <SearchableSelect
                  options={userOptions}
                  value={testUserId}
                  onValueChange={setTestUserId}
                  placeholder="Selecione um usuário..."
                  isLoading={usersLoading}
                  emptyMessage="Nenhum usuário com e-mail encontrado."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTestTemplateId(null);
                setTestUserId("");
                setUserSearch("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => testMutation.mutate()}
              disabled={!testUserId || testMutation.isPending}
            >
              <Send className="mr-2 size-4" />
              {testMutation.isPending ? "Enviando..." : "Enviar teste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template será desativado (exclusão lógica). Você pode criar outro depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
