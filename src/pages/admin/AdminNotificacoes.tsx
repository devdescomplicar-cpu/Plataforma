import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Bell, History, Send, Loader2 } from "lucide-react";

const TARGET_OPTIONS = [
  { value: "all", label: "Todos (inclui admin)" },
  { value: "active", label: "Somente ativos" },
  { value: "vencido", label: "Somente vencidos" },
] as const;

export default function AdminNotificacoes() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetFilter, setTargetFilter] = useState<"all" | "active" | "vencido">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["admin", "notifications", "log"],
    queryFn: async () => {
      const res = await adminApi.notifications.log({ limit: 100 });
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return (res.data ?? []) as import("@/lib/admin-api").PushNotificationLogEntry[];
    },
    staleTime: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApi.notifications.send({
        title: title.trim(),
        body: body.trim(),
        targetFilter,
      });
      if (!res.success) throw new Error(res.error?.message ?? "Erro");
      return res.data!;
    },
    onSuccess: (data) => {
      toast({
        title: "Notificação enviada",
        description: `${data.sent} de ${data.total} dispositivo(s) (navegador/PWA) — ${TARGET_OPTIONS.find((o) => o.value === data.targetFilter)?.label ?? data.targetFilter}.`,
      });
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "log"] });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Erro ao enviar", description: e.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({ variant: "destructive", title: "Preencha título e mensagem" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notificações</h1>
        <p className="text-muted-foreground mt-1">
          Envie notificações push para usuários com o app instalado (PWA). Escolha o público pelo status da conta.
        </p>
      </div>

      <Tabs defaultValue="send" className="space-y-4">
        <TabsList>
          <TabsTrigger value="send" className="gap-2">
            <Send className="size-4" />
            Enviar
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="send" className="space-y-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Nova notificação
          </CardTitle>
          <CardDescription>
            Título e mensagem serão exibidos no navegador ou no app instalado (PWA).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Lembrete importante"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Mensagem</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Texto da notificação..."
                rows={4}
                maxLength={500}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Enviar para</Label>
              <Select
                value={targetFilter}
                onValueChange={(v) => setTargetFilter(v as "all" | "active" | "vencido")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={sendMutation.isPending} className="gap-2">
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Enviar notificação
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5" />
                Histórico de notificações
              </CardTitle>
              <CardDescription>
                Todos os envios de notificação push (sucesso e falhas por dispositivo)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs && <p className="text-muted-foreground text-sm">Carregando...</p>}
              {!loadingLogs && logs.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma notificação enviada ainda.</p>
              )}
              {!loadingLogs && logs.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="max-w-[200px]">Mensagem</TableHead>
                        <TableHead>Público</TableHead>
                        <TableHead className="text-right">Enviadas</TableHead>
                        <TableHead className="text-right">Falhas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                            {new Date(entry.createdAt).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="font-medium">{entry.title}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground" title={entry.body}>
                            {entry.body}
                          </TableCell>
                          <TableCell>
                            {TARGET_OPTIONS.find((o) => o.value === entry.targetFilter)?.label ?? entry.targetFilter}
                          </TableCell>
                          <TableCell className="text-right">{entry.sentCount}</TableCell>
                          <TableCell className="text-right">{entry.failedCount ?? 0}</TableCell>
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
    </div>
  );
}
