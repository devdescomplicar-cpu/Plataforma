import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HardDrive,
  Database,
  FileStack,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  ImageIcon,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

/** Converts MB to GB when >= 1024, otherwise keeps in MB */
function formatStorageMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(2)} MB`;
}

export default function AdminArmazenamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, isError, error } = useQuery({
    queryKey: ['admin', 'storage'],
    queryFn: async () => {
      const res = await adminApi.storage.stats();
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 60_000,
  });

  const { data: growth, isLoading: growthLoading } = useQuery({
    queryKey: ['admin', 'storage', 'growth'],
    queryFn: async () => {
      const res = await adminApi.storage.growth({ granularity: 'day', limit: 90 });
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 120_000,
  });

  const { data: zombies } = useQuery({
    queryKey: ['admin', 'storage', 'zombies'],
    queryFn: async () => {
      const res = await adminApi.storage.zombies();
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 60_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['admin', 'storage', 'alerts'],
    queryFn: async () => {
      const res = await adminApi.storage.alerts();
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 60_000,
  });

  const { data: topConsumers } = useQuery({
    queryKey: ['admin', 'storage', 'top-consumers'],
    queryFn: async () => {
      const res = await adminApi.storage.topConsumers();
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 60_000,
  });

  const { data: cleanupHistory } = useQuery({
    queryKey: ['admin', 'storage', 'cleanup-history'],
    queryFn: async () => {
      const res = await adminApi.storage.cleanupHistory({ limit: 30 });
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 30_000,
  });

  const { data: quality } = useQuery({
    queryKey: ['admin', 'storage', 'quality'],
    queryFn: async () => {
      const res = await adminApi.storage.quality();
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro');
      return res.data;
    },
    staleTime: 60_000,
  });

  const cleanObsolete = useMutation({
    mutationFn: async () => {
      const res = await adminApi.storage.cleanObsolete();
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao limpar');
      return res.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'storage'] });
      toast({
        title: 'Limpeza concluída',
        description: data?.message ?? `${data?.deletedCount ?? 0} imagem(ns) obsoleta(s) removida(s).`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao limpar', description: err.message });
    },
  });

  const cleanZombies = useMutation({
    mutationFn: async (days: 30 | 90 | 180) => {
      const res = await adminApi.storage.cleanZombies(days);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao limpar zumbis');
      return res.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'storage'] });
      toast({
        title: 'Zumbis removidos',
        description: data?.message ?? `${data?.deletedCount ?? 0} arquivo(s) removido(s).`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao limpar zumbis', description: err.message });
    },
  });

  const chartData =
    growth?.map((p) => ({
      period: p.period,
      uso: Math.round(p.totalBytes / (1024 * 1024) * 100) / 100,
      arquivos: p.fileCount,
    })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Armazenamento</h1>
          <p className="text-muted-foreground mt-1">
            Métricas, tendências e limpeza do bucket de arquivos
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => cleanObsolete.mutate()}
          disabled={cleanObsolete.isPending || !stats?.available}
          className="shrink-0"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {cleanObsolete.isPending ? 'Limpando…' : 'Limpar obsoletos'}
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : 'Erro ao carregar'}</AlertDescription>
        </Alert>
      )}

      {/* Alertas automáticos */}
      {alerts && alerts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Alertas</h2>
          <div className="space-y-2">
            {alerts.map((a) => (
              <Alert
                key={a.type}
                variant={a.severity === 'danger' ? 'destructive' : 'default'}
                className={
                  a.severity === 'warning'
                    ? 'border-amber-500/50 bg-amber-500/5 [&>svg]:text-amber-600'
                    : a.severity === 'info'
                      ? 'border-info/50 bg-info/5 [&>svg]:text-info'
                      : undefined
                }
              >
                {a.severity === 'danger' && <AlertCircle className="h-4 w-4" />}
                {a.severity === 'warning' && <AlertTriangle className="h-4 w-4" />}
                {a.severity === 'info' && <Info className="h-4 w-4" />}
                <div>
                  <AlertTitle className="capitalize">{a.type.replace(/_/g, ' ')}</AlertTitle>
                  <AlertDescription>{a.message}</AlertDescription>
                </div>
              </Alert>
            ))}
          </div>
        </section>
      )}

      {/* Métricas principais */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Métricas principais</h2>
        {statsLoading && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}
        {stats && (
          <>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.available ? 'Disponível' : 'Indisponível'}</div>
                  <p className="text-xs text-muted-foreground">Servidor S3</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Espaço usado</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatStorageMb(stats.totalSizeMb)}</div>
                  <p className="text-xs text-muted-foreground">{stats.totalSizeBytes.toLocaleString('pt-BR')} bytes</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Espaço total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalSpaceMb != null ? formatStorageMb(stats.totalSpaceMb) : '—'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Espaço livre</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.freeSpaceMb != null ? formatStorageMb(stats.freeSpaceMb) : '—'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">% de uso</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.usagePercent != null ? `${stats.usagePercent}%` : '—'}
                  </div>
                  {stats.usagePercent != null && (
                    <Progress value={Math.min(100, stats.usagePercent)} className="mt-2 h-2" />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total de arquivos</CardTitle>
                  <FileStack className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.fileCount}</div>
                  <p className="text-xs text-muted-foreground">Bucket: {stats.bucketName}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total de imagens</CardTitle>
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalImages}</div>
                  <p className="text-xs text-muted-foreground">Registros no banco</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Tamanho médio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.avgFileSizeBytes != null ? formatBytes(stats.avgFileSizeBytes) : '—'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Maior arquivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.largestFileBytes != null ? formatBytes(stats.largestFileBytes) : '—'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Crescimento 30 dias</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.growth30DaysMb != null
                      ? (stats.growth30DaysMb >= 0 ? '+' : '-') + formatStorageMb(Math.abs(stats.growth30DaysMb))
                      : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground">Tendência</p>
                </CardContent>
              </Card>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Atualizado em: {new Date(stats.generatedAt).toLocaleString('pt-BR')}
            </p>
          </>
        )}
      </section>

      {/* Gráfico de crescimento */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Crescimento de armazenamento</h2>
        {growthLoading && <Skeleton className="h-72 rounded-xl" />}
        {!growthLoading && chartData.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" MB" />
                  <Tooltip
                    formatter={(value: number) => [value, 'Uso (MB)']}
                    labelFormatter={(label) => `Período: ${label}`}
                  />
                  <Line type="monotone" dataKey="uso" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {!growthLoading && chartData.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum dado de histórico ainda. Os snapshots são gerados ao carregar esta página.</p>
        )}
      </section>

      {/* Arquivos zumbis (contas inativas) */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Arquivos de contas inativas (zumbis)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Imagens de contas sem atividade há 90, 180 ou 360 dias. Limpar remove do servidor e libera espaço.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { days: 90 as const, label: '90 dias', key: 'zombie90' as const },
            { days: 180 as const, label: '180 dias', key: 'zombie180' as const },
            { days: 360 as const, label: '360 dias', key: 'zombie360' as const },
          ].map(({ days, label, key }) => {
            const z = zombies?.[key];
            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Conta inativa há {label}+</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{z?.count ?? 0}</span>
                    <span className="text-muted-foreground">arquivos</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{z ? formatBytes(z.bytes) : '0 B'} ocupados</p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(z?.count ?? 0) === 0 || cleanZombies.isPending}
                    onClick={() => cleanZombies.mutate(days)}
                  >
                    {cleanZombies.isPending ? 'Limpando…' : 'Limpar'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Top consumidores */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Top consumidores</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário / Cliente</TableHead>
                  <TableHead className="text-right">Arquivos</TableHead>
                  <TableHead className="text-right">Espaço usado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topConsumers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum dado
                    </TableCell>
                  </TableRow>
                )}
                {topConsumers?.map((c) => (
                  <TableRow key={c.accountId}>
                    <TableCell>
                      <div className="font-medium">{c.accountName}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.userName || c.userEmail || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{c.fileCount}</TableCell>
                    <TableCell className="text-right">{formatBytes(c.bytes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Lixeira / Histórico de exclusão */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Histórico de limpeza</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Arquivos removidos</TableHead>
                  <TableHead className="text-right">Espaço liberado</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cleanupHistory?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhuma limpeza registrada
                    </TableCell>
                  </TableRow>
                )}
                {cleanupHistory?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.cleanedAt).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{e.filesRemoved}</TableCell>
                    <TableCell className="text-right">{formatBytes(e.bytesFreed)}</TableCell>
                    <TableCell>{e.triggerType}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Qualidade dos arquivos */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Qualidade dos arquivos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Imagens com tamanho</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quality?.totalImagesWithSize ?? 0}</div>
              <p className="text-xs text-muted-foreground">Registros com sizeBytes (novos uploads)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">% acima de 2 MB</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quality?.percentOver2Mb ?? 0}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">% não otimizadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quality?.percentNotOptimized ?? 0}%</div>
              <p className="text-xs text-muted-foreground">&gt; 300 KB</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sugestão</CardTitle>
            </CardHeader>
            <CardContent>
              {quality?.message ? (
                <p className="text-sm text-muted-foreground">{quality.message}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma economia significativa sugerida.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="text-xs text-muted-foreground max-w-xl">
        &quot;Limpar obsoletos&quot; remove do S3 apenas imagens de veículos já excluídos (soft delete).
        &quot;Limpar&quot; zumbis remove imagens de veículos não atualizados há X dias. Ambas as ações fazem soft delete
        no banco e registram no histórico.
      </p>
    </div>
  );
}
