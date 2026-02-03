import { Link } from 'react-router-dom';
import { Users, CreditCard, BarChart3, Mail, Webhook, FileSearch, HardDrive, Bell, FileText, ArrowRight, CircleUser, Car, ShoppingCart, Image } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';

const sections = [
  { name: 'Usuários', href: '/admin/usuarios', icon: Users, desc: 'Gerenciar usuários e planos' },
  { name: 'Clientes', href: '/admin/clientes', icon: CircleUser, desc: 'Todos os clientes dos usuários' },
  { name: 'Planos', href: '/admin/planos', icon: CreditCard, desc: 'Criar e editar planos' },
  { name: 'Relatórios', href: '/admin/relatorios', icon: BarChart3, desc: 'Relatório geral' },
  { name: 'Notificações', href: '/admin/notificacoes', icon: Bell, desc: 'Notificações do sistema' },
  { name: 'Templates', href: '/admin/templates', icon: FileText, desc: 'Templates de e-mail e mensagens' },
  { name: 'SMTP', href: '/admin/smtp', icon: Mail, desc: 'Configurar e-mail' },
  { name: 'Webhooks', href: '/admin/webhooks', icon: Webhook, desc: 'Webhooks de recebimento' },
  { name: 'Auditoria', href: '/admin/auditoria', icon: FileSearch, desc: 'Registros e ações' },
  { name: 'Armazenamento', href: '/admin/armazenamento', icon: HardDrive, desc: 'Status S3' },
];

export default function AdminDashboard() {
  const { data: report, isLoading } = useQuery({
    queryKey: ['admin', 'report'],
    queryFn: async () => {
      const res = await adminApi.reports.general();
      if (!res.success || res.data == null) throw new Error('Falha ao carregar');
      return res.data;
    },
    staleTime: 60_000,
  });

  const { data: storageStats, isLoading: isLoadingStorage } = useQuery({
    queryKey: ['admin', 'storage', 'stats'],
    queryFn: async () => {
      const res = await adminApi.storage.stats();
      if (!res.success || res.data == null) throw new Error('Falha ao carregar');
      return res.data;
    },
    staleTime: 60_000,
  });

  const formatStorageSize = (mb: number): string => {
    if (mb < 1024) {
      return `${mb.toFixed(2)} MB`;
    }
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
          <p className="text-muted-foreground mt-1">Visão geral e áreas de administração</p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      {isLoading || isLoadingStorage ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-elevated p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : report ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Usuários</p>
                <Users className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-foreground">
                  {report.totalUsers}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de usuários cadastrados</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Espaço usado de imagens</p>
                <Image className="w-8 h-8 text-warning" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-warning">
                  {storageStats ? formatStorageSize(storageStats.totalSizeMb) : '0 MB'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de armazenamento utilizado</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Veículos</p>
                <Car className="w-8 h-8 text-info" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-info">
                  {report.totalVehicles}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de veículos cadastrados</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Vendas</p>
                <ShoppingCart className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-success">
                  {report.totalSales}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total de vendas realizadas</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cards de Navegação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Link key={s.href} to={s.href} className="group">
            <div className="card-elevated p-6 h-full hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
