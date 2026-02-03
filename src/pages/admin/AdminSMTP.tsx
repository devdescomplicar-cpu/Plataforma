import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { History, Send } from 'lucide-react';

const ORIGIN_LABEL: Record<string, string> = {
  smtp_test: 'Teste SMTP',
  template_test: 'Teste de template',
  password_recovery: 'Recuperação de senha',
  trigger: 'Gatilho',
};

export default function AdminSMTP() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [active, setActive] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'smtp'],
    queryFn: async () => {
      const res = await adminApi.smtp.get();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (config) {
      setHost(config.host);
      setPort(String(config.port));
      setSecure(config.secure);
      setUser(config.user ?? '');
      setFromEmail(config.fromEmail);
      setFromName(config.fromName ?? '');
      setActive(config.active);
    }
  }, [config]);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApi.smtp.test(testEmail.trim());
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Teste enviado',
        description: data?.message ?? 'E-mail de teste enviado. Verifique a caixa de entrada e o spam.',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'smtp', 'logs'] });
    },
    onError: (e: Error) =>
      toast({ variant: 'destructive', title: 'Falha no teste', description: e.message }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await adminApi.smtp.upsert({
        host,
        port: Number(port) || 587,
        secure,
        user: user || undefined,
        password: password || undefined,
        fromEmail,
        fromName: fromName || undefined,
        active,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return res;
    },
    onSuccess: async () => {
      toast({ title: 'Configuração SMTP salva' });
      setPassword('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'smtp'] });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
  });

  const { data: emailLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['admin', 'smtp', 'logs'],
    queryFn: async () => {
      const res = await adminApi.smtp.getLogs({ limit: 100 });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return (res.data ?? []) as import('@/lib/admin-api').EmailLogEntry[];
    },
    staleTime: 15_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SMTP</h1>
        <p className="text-muted-foreground mt-1">Configurar servidor SMTP para gatilhos e templates de e-mail</p>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="space-y-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configuração do servidor</CardTitle>
          <CardDescription>Host, porta, autenticação e remetente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-muted-foreground">Carregando...</p>}
          {!isLoading && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={secure} onCheckedChange={setSecure} />
                <Label>Conexão segura (TLS)</Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Usuário (opcional)</Label>
                  <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="user" />
                </div>
                <div className="space-y-2">
                  <Label>Senha (deixe em branco para manter)</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-mail remetente</Label>
                  <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label>Nome remetente (opcional)</Label>
                  <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="DescompliCAR" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <Label>Configuração ativa</Label>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !host.trim() || !fromEmail.trim()}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar configuração'}
                </Button>
                <div className="flex items-end gap-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm">Testar SMTP</Label>
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="w-56"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending || !testEmail.trim() || !testEmail.includes('@')}
                  >
                    <Send className="mr-2 size-4" />
                    {testMutation.isPending ? 'Enviando...' : 'Testar'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5" />
                Histórico de e-mails
              </CardTitle>
              <CardDescription>
                Todos os e-mails enviados (teste SMTP, templates, recuperação de senha)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
              {!logsLoading && emailLogs.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhum e-mail registrado ainda.</p>
              )}
              {!logsLoading && emailLogs.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Assunto</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="max-w-[200px]">Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                            {new Date(log.sentAt).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="font-medium">{log.to}</TableCell>
                          <TableCell className="max-w-[180px] truncate" title={log.subject}>
                            {log.subject}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground text-sm">
                              {ORIGIN_LABEL[log.origin ?? ''] ?? log.origin ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                              {log.status === 'success' ? 'Sucesso' : 'Erro'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs" title={log.errorMessage ?? ''}>
                            {log.errorMessage ?? '—'}
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
    </div>
  );
}
