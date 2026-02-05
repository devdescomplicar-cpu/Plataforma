import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, RefreshCw } from 'lucide-react';
import { adminApi, type AuditLogEntry } from '@/lib/admin-api';
import { formatDateTimeBR } from '@/lib/date-br';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function parseDevice(userAgent: string | null): string {
  if (!userAgent || !userAgent.trim()) return '—';
  const ua = userAgent.toLowerCase();
  let browser = 'Navegador';
  if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('samsungbrowser')) browser = 'Samsung Internet';
  else if (ua.includes('brave')) browser = 'Brave';
  else if (ua.includes('vivaldi')) browser = 'Vivaldi';
  else if (ua.includes('yandex')) browser = 'Yandex';
  else if (ua.includes('firefox') || ua.includes('fxios')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium')) browser = 'Safari';
  else if (ua.includes('chrome') || ua.includes('crios')) browser = 'Chrome';
  let os = 'Sistema';
  if (ua.includes('windows nt')) os = 'Windows';
  else if (ua.includes('mac os x') || ua.includes('macintosh')) os = 'Mac';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('cros')) os = 'Chrome OS';
  else if (ua.includes('linux')) os = 'Linux';
  const mobile = /mobile|android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(ua)
    ? 'Mobile'
    : 'Desktop';
  return `${browser} / ${os} / ${mobile}`;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    login: 'Login',
    create: 'Criar',
    update: 'Alterar',
    delete: 'Excluir',
    soft_delete: 'Exclusão (reversível)',
    permanent_delete: 'Exclusão permanente',
    password_reset: 'Reset de senha',
    password_change: 'Alteração de senha',
    plan_change: 'Troca de plano',
    webhook_register: 'Cadastro via webhook',
    notification_send: 'Notificação push enviada',
    notification_test: 'E-mail de teste (template)',
  };
  return map[action] ?? action;
}

interface AuditChangeItem {
  field: string;
  label: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

function payloadSummary(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'description' in payload && typeof (payload as { description: unknown }).description === 'string') {
    return (payload as { description: string }).description;
  }
  if (payload && typeof payload === 'object' && 'summary' in payload && typeof (payload as { summary: unknown }).summary === 'string') {
    return (payload as { summary: string }).summary;
  }
  if (payload && typeof payload === 'object' && 'changes' in payload) {
    const changes = (payload as { changes?: AuditChangeItem[] }).changes;
    if (Array.isArray(changes) && changes.length > 0) {
      return changes.map((c) => c.label).join(', ');
    }
  }
  return null;
}

function payloadDescription(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'description' in payload && typeof (payload as { description: unknown }).description === 'string') {
    return (payload as { description: string }).description;
  }
  return null;
}

export default function AdminAuditoria() {
  const [userId, setUserId] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [userRole, setUserRole] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [detailLog, setDetailLog] = useState<AuditLogEntry | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', userId, entity, action, userRole, page],
    queryFn: async () => {
      const res = await adminApi.audit.list({
        userId: userId || undefined,
        entity: entity || undefined,
        action: action || undefined,
        userRole: userRole && userRole !== 'all' ? userRole : undefined,
        page,
        limit: 30,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Erro');
      return { data: (res.data ?? []) as AuditLogEntry[], pagination: res.pagination };
    },
    staleTime: 15_000,
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Auditoria do Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Visualize todos os logs de auditoria e ações do sistema
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Tipo de usuário</Label>
            <Select value={userRole} onValueChange={setUserRole}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todos os perfis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ação</Label>
            <Input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Ex: login, create..."
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label>Entidade</Label>
            <Input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="User, Account..."
              className="w-36"
            />
          </div>
          <div className="space-y-2">
            <Label>Usuário (ID ou e-mail)</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Opcional"
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-destructive py-4">
              {error instanceof Error ? error.message : 'Erro'}
            </p>
          )}
          {isLoading && <p className="text-muted-foreground py-4">Carregando...</p>}
          {!isLoading && !isError && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e Hora</TableHead>
                  <TableHead>E-mail do usuário</TableHead>
                  <TableHead>Tipo de usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>O que foi alterado</TableHead>
                  <TableHead>IP público</TableHead>
                  <TableHead className="w-[100px]">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateTimeBR(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.userEmail ?? (log.userId ? `— (${log.userId.slice(0, 8)}…)` : '—')}
                    </TableCell>
                    <TableCell>
                      {log.userRole ? (
                        <Badge variant={log.userRole === 'admin' ? 'default' : 'secondary'}>
                          {log.userRole === 'admin' ? 'Admin' : 'User'}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{actionLabel(log.action)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={payloadSummary(log.payload) ?? undefined}>
                      {payloadSummary(log.payload) ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ip ?? '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDetailLog(log)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log de Auditoria</DialogTitle>
            <DialogDescription>
              Informações completas sobre esta ação de auditoria
            </DialogDescription>
          </DialogHeader>
          {detailLog && (
            <div className="grid gap-4 sm:grid-cols-2 py-4">
              {payloadDescription(detailLog.payload) && (
                <div className="sm:col-span-2 rounded-lg border bg-muted/40 p-4">
                  <Label className="text-muted-foreground text-xs">Resumo da ação</Label>
                  <p className="text-sm font-medium mt-1">
                    {detailLog.userName
                      ? `${detailLog.userName} — `
                      : detailLog.userId
                        ? `${detailLog.userEmail ?? 'Usuário'} — `
                        : 'Sistema — '}
                    {payloadDescription(detailLog.payload)}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Nome do usuário</Label>
                <p className="text-sm font-medium">{detailLog.userName ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">E-mail do usuário</Label>
                <p className="text-sm font-medium">{detailLog.userEmail ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Tipo de usuário</Label>
                <p className="text-sm font-medium">
                  {detailLog.userRole ? (detailLog.userRole === 'admin' ? 'Admin' : 'User') : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Ação</Label>
                <p className="text-sm font-medium">{actionLabel(detailLog.action)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Data e Hora</Label>
                <p className="text-sm font-medium">
                  {formatDateTimeBR(detailLog.createdAt)}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">IP público</Label>
                <p className="text-sm font-medium font-mono">{detailLog.ip ?? '—'}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Dispositivo (navegador / SO / tipo)</Label>
                <p className="text-sm font-medium">
                  {parseDevice(detailLog.userAgent)}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Entidade</Label>
                <p className="text-sm font-medium">{detailLog.entity}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">ID da entidade</Label>
                <p className="text-sm font-medium font-mono text-xs truncate">
                  {detailLog.entityId ?? '—'}
                </p>
              </div>
              {(() => {
                const pl = detailLog.payload as { changes?: AuditChangeItem[] } | null;
                const changes = pl?.changes;
                if (!changes || !Array.isArray(changes) || changes.length === 0) return null;
                return (
                  <div className="space-y-2 sm:col-span-2 border rounded-lg p-4 bg-muted/30">
                    <Label className="text-muted-foreground text-xs">O que foi alterado</Label>
                    <div className="space-y-2">
                      {changes.map((c, i) => (
                        <div key={i} className="text-sm flex flex-wrap gap-x-2 gap-y-1">
                          <span className="font-medium text-muted-foreground shrink-0">{c.label}:</span>
                          <span className="truncate min-w-0" title={String(c.oldValue ?? '—')}>
                            {c.oldValue === null || c.oldValue === '' ? '—' : String(c.oldValue)}
                          </span>
                          <span className="shrink-0 text-muted-foreground">→</span>
                          <span className="truncate font-medium min-w-0" title={String(c.newValue ?? '—')}>
                            {c.newValue === null || c.newValue === '' ? '—' : String(c.newValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {detailLog.userAgent && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">User Agent (bruto)</Label>
                  <p className="text-xs text-muted-foreground break-all font-mono">
                    {detailLog.userAgent}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
