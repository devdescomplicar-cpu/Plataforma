import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, UserCog, Shield, UserCheck, Users } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCollaborators, useRemoveCollaborator, type Collaborator } from '@/hooks/useCollaborators';
import { useUser } from '@/hooks/useUser';
import { QueryErrorState } from '@/components/QueryErrorState';
import { CollaboratorFormModal } from '@/components/modals/CollaboratorFormModal';
import { cn } from '@/lib/utils';

const Colaboradores = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [collaboratorToEdit, setCollaboratorToEdit] = useState<Collaborator | null>(null);

  const { data: userData } = useUser();
  const isOwner = userData?.isAccountOwner ?? false;
  const { data: collaborators = [], isLoading, isError, error, refetch } = useCollaborators();
  const removeCollaborator = useRemoveCollaborator();
  const [collaboratorToRemove, setCollaboratorToRemove] = useState<Collaborator | null>(null);

  const stats = useMemo(() => {
    const total = collaborators.length;
    const sellers = collaborators.filter((c) => c.role === 'seller').length;
    const managers = collaborators.filter((c) => c.role === 'manager').length;
    return { total, sellers, managers };
  }, [collaborators]);

  const filtered = collaborators.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleLabel = (role: string) => (role === 'manager' ? 'Gerente' : 'Vendedor');
  const statusLabel = (status: string) => (status === 'active' ? 'Ativo' : 'Inativo');
  const commissionDisplay = (c: Collaborator) => {
    if (c.role !== 'seller' || c.commissionType == null || c.commissionValue == null) return '—';
    return c.commissionType === 'percent'
      ? `${c.commissionValue}%`
      : `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c.commissionValue)}`;
  };

  if (!isOwner) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
        <div className="card-elevated p-8 text-center text-muted-foreground">
          <UserCog className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Apenas o dono da conta pode gerenciar colaboradores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie vendedores e gerentes que acessam esta conta
          </p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo colaborador
        </Button>
      </div>

      {/* Cards de Resumo */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-elevated p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total de colaboradores</p>
                <Users className="w-8 h-8 text-foreground" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-2">Total cadastrado</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Vendedores</p>
                <UserCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.sellers}</p>
                <p className="text-xs text-muted-foreground mt-2">Colaboradores vendedores</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Gerentes</p>
                <Shield className="w-8 h-8 text-success" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-3xl font-bold text-success">{stats.managers}</p>
                <p className="text-xs text-muted-foreground mt-2">Colaboradores gerentes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isError && (
          <div className="p-6">
            <QueryErrorState message={error?.message} onRetry={() => refetch()} />
          </div>
        )}

        {!isError && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Comissão</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-14 animate-pulse bg-muted/30" />
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Nenhum colaborador encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {c.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.role === 'manager' ? 'default' : 'secondary'}
                          className={cn(
                            c.role === 'manager' && 'bg-primary/90'
                          )}
                        >
                          {c.role === 'manager' ? (
                            <Shield className="w-3 h-3 mr-1" />
                          ) : (
                            <UserCheck className="w-3 h-3 mr-1" />
                          )}
                          {roleLabel(c.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium select-none',
                            c.status === 'active'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-400 text-white dark:bg-gray-500'
                          )}
                        >
                          {statusLabel(c.status)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {c.role === 'seller' ? commissionDisplay(c) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCollaboratorToEdit(c)}
                            aria-label="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50"
                            onClick={() => setCollaboratorToRemove(c)}
                            aria-label="Remover colaborador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CollaboratorFormModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
      <CollaboratorFormModal
        open={!!collaboratorToEdit}
        onOpenChange={(open) => !open && setCollaboratorToEdit(null)}
        collaboratorToEdit={collaboratorToEdit}
      />
      <AlertDialog open={!!collaboratorToRemove} onOpenChange={(open) => !open && setCollaboratorToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {collaboratorToRemove
                ? `${collaboratorToRemove.name} será removido desta conta. Ele não poderá mais acessar os dados. Esta ação pode ser revertida pelo suporte.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={async () => {
                if (collaboratorToRemove) {
                  await removeCollaborator.mutateAsync(collaboratorToRemove.id);
                  setCollaboratorToRemove(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Colaboradores;
