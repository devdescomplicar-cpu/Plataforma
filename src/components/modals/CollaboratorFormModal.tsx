import { useState, useEffect } from 'react';
import { Loader2, User, Mail, Lock, Percent, DollarSign, UserCog } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateCollaborator, useUpdateCollaborator, type Collaborator, type CreateCollaboratorInput } from '@/hooks/useCollaborators';
import { toast } from '@/hooks/use-toast';

interface CollaboratorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaboratorToEdit?: Collaborator | null;
}

export function CollaboratorFormModal({
  open,
  onOpenChange,
  collaboratorToEdit,
}: CollaboratorFormModalProps) {
  const isEditMode = !!collaboratorToEdit;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'manager' | 'seller'>('seller');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [commissionType, setCommissionType] = useState<'fixed' | 'percent'>('percent');
  const [commissionValue, setCommissionValue] = useState<string>('');
  const [error, setError] = useState('');

  const createMutation = useCreateCollaborator();
  const updateMutation = useUpdateCollaborator();

  useEffect(() => {
    if (open) {
      setError('');
      if (collaboratorToEdit) {
        setName(collaboratorToEdit.name);
        setEmail(collaboratorToEdit.email);
        setPassword('');
        setRole(collaboratorToEdit.role);
        setStatus(collaboratorToEdit.status);
        setCommissionType((collaboratorToEdit.commissionType as 'fixed' | 'percent') ?? 'percent');
        setCommissionValue(
          collaboratorToEdit.commissionValue != null ? String(collaboratorToEdit.commissionValue) : ''
        );
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('seller');
        setStatus('active');
        setCommissionType('percent');
        setCommissionValue('');
      }
    }
  }, [open, collaboratorToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const nameTrim = name.trim();
    const emailTrim = email.trim();
    if (!nameTrim) {
      setError('Nome é obrigatório.');
      return;
    }
    if (!emailTrim) {
      setError('E-mail é obrigatório.');
      return;
    }
    if (!isEditMode && !password) {
      setError('Senha é obrigatória ao criar colaborador.');
      return;
    }
    if (!isEditMode && password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (role === 'seller') {
      const val = parseFloat(commissionValue.replace(',', '.'));
      if (Number.isNaN(val) || val < 0) {
        setError('Informe um valor de comissão válido.');
        return;
      }
      if (commissionType === 'percent' && val > 100) {
        setError('Comissão percentual não pode ser maior que 100%.');
        return;
      }
    }

    try {
      if (isEditMode && collaboratorToEdit) {
        await updateMutation.mutateAsync({
          id: collaboratorToEdit.id,
          input: {
            name: nameTrim,
            email: emailTrim,
            role,
            status,
            ...(role === 'seller' && {
              commissionType,
              commissionValue: parseFloat(commissionValue.replace(',', '.')),
            }),
          },
        });
        toast({ title: 'Colaborador atualizado', description: `${nameTrim} foi atualizado.` });
      } else {
        const input: CreateCollaboratorInput = {
          name: nameTrim,
          email: emailTrim,
          password,
          role,
          status,
        };
        if (role === 'seller') {
          input.commissionType = commissionType;
          input.commissionValue = parseFloat(commissionValue.replace(',', '.'));
        }
        await createMutation.mutateAsync(input);
        toast({ title: 'Colaborador criado', description: `${nameTrim} foi adicionado.` });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      setError(message);
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            {isEditMode ? 'Editar colaborador' : 'Novo colaborador'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Altere os dados do colaborador. A comissão afeta apenas vendas futuras.'
              : 'Preencha os dados para adicionar um novo colaborador à conta.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="collab-name">Nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="collab-name"
                className="pl-9"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collab-email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="collab-email"
                type="email"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                disabled={isEditMode}
              />
            </div>
            {isEditMode && (
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
            )}
          </div>

          {!isEditMode && (
            <div className="space-y-2">
              <Label htmlFor="collab-password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="collab-password"
                  type="password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'manager' | 'seller')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Vendedor</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {role === 'seller' && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">Comissão (vendas futuras)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={commissionType}
                    onValueChange={(v) => setCommissionType(v as 'fixed' | 'percent')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo por veículo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <div className="relative">
                    {commissionType === 'percent' ? (
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    ) : (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                    )}
                    <Input
                      type="text"
                      inputMode="decimal"
                      className={commissionType === 'percent' ? 'pl-9' : 'pl-10'}
                      value={commissionValue}
                      onChange={(e) => setCommissionValue(e.target.value.replace(/[^0-9,.]/g, ''))}
                      placeholder={commissionType === 'percent' ? 'Ex: 5' : 'Ex: 500'}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {commissionType === 'percent' ? 'Percentual sobre o valor da venda' : 'Valor em R$ por venda'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEditMode ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
