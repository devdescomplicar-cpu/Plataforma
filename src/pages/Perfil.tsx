import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/hooks/useUser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatCpfCnpj } from '@/lib/cpf-cnpj';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  // email, phone e cpfCnpj são apenas para exibição, não são validados
  email: z.string().optional(),
  phone: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

const Perfil = () => {
  const { data: userData } = useUser();
  const user = userData?.user;
  const queryClient = useQueryClient();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: errorsProfile, isSubmitting: isSubmittingProfile },
    reset: resetProfile,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      cpfCnpj: user?.cpfCnpj ? formatCpfCnpj(user.cpfCnpj) : '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: errorsPassword, isSubmitting: isSubmittingPassword },
    reset: resetPassword,
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Atualizar valores do formulário quando o usuário mudar
  useEffect(() => {
    if (user) {
      resetProfile({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        cpfCnpj: user.cpfCnpj ? formatCpfCnpj(user.cpfCnpj) : '',
      });
    }
  }, [user, resetProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const response = await apiClient.put<{ data: { user: typeof user } }>('/auth/profile', {
        name: data.name,
        // email, phone e cpfCnpj não são enviados - não podem ser alterados
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram atualizadas com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar perfil',
        description: error?.response?.data?.error?.message || 'Ocorreu um erro ao atualizar seu perfil.',
        variant: 'destructive',
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      const response = await apiClient.put<{ data: { message: string } }>('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return response.data;
    },
    onSuccess: () => {
      resetPassword();
      setIsPasswordModalOpen(false);
      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi alterada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao alterar senha',
        description: error?.response?.data?.error?.message || 'Ocorreu um erro ao alterar sua senha.',
        variant: 'destructive',
      });
    },
  });

  const onProfileSubmit = (data: ProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordForm) => {
    changePasswordMutation.mutate(data);
  };


  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* Informações Pessoais */}
      <div className="card-elevated p-6">
        <h3 className="font-semibold text-foreground mb-6">Informações Pessoais</h3>
        
        <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                {...registerProfile('name')}
                disabled={isSubmittingProfile}
              />
              {errorsProfile.name && (
                <p className="text-sm text-destructive">{errorsProfile.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...registerProfile('email')}
                disabled={true}
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                {...registerProfile('phone')}
                disabled={true}
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">O telefone não pode ser alterado</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
              <Input
                id="cpfCnpj"
                placeholder="000.000.000-00"
                {...registerProfile('cpfCnpj')}
                disabled={true}
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">O CPF/CNPJ não pode ser alterado</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmittingProfile}>
              {isSubmittingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Segurança */}
      <div className="card-elevated p-6">
        <h3 className="font-semibold text-foreground mb-4">Segurança</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Senha</p>
              <p className="text-sm text-muted-foreground">Altere sua senha de acesso</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsPasswordModalOpen(true)}
            >
              Alterar senha
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Alterar Senha */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md space-y-6">
            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground text-xl">Alterar Senha</h3>
                <p className="text-sm text-muted-foreground mt-1">Digite sua senha atual e a nova senha</p>
              </div>
            </div>

            <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha atual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...registerPassword('currentPassword')}
                  disabled={isSubmittingPassword}
                />
                {errorsPassword.currentPassword && (
                  <p className="text-sm text-destructive">{errorsPassword.currentPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...registerPassword('newPassword')}
                  disabled={isSubmittingPassword}
                />
                {errorsPassword.newPassword && (
                  <p className="text-sm text-destructive">{errorsPassword.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...registerPassword('confirmPassword')}
                  disabled={isSubmittingPassword}
                />
                {errorsPassword.confirmPassword && (
                  <p className="text-sm text-destructive">{errorsPassword.confirmPassword.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    resetPassword();
                  }}
                  disabled={isSubmittingPassword}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmittingPassword}>
                  {isSubmittingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    'Alterar senha'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Perfil;
