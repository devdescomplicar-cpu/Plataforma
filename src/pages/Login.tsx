import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Download } from 'lucide-react';
import { usePwaInstallContext } from '@/contexts/PwaInstallContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';

const AUTH_TOKEN_KEY = 'auth_token';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showInstructions, isStandalone } = usePwaInstallContext();
  const from = (location.state as { from?: { pathname: string }; contaVencida?: boolean })?.from?.pathname ?? '/';
  const contaVencidaState = (location.state as { contaVencida?: boolean })?.contaVencida ?? false;
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<{ message: string; email?: string } | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      navigate(from, { replace: true });
    }
  }, [from, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess(null);
    const input = forgotInput.trim();
    if (!input) {
      setForgotError('Informe o e-mail ou CPF/CNPJ');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiClient.post<{ message: string; email?: string }>('/auth/forgot-password', {
        emailOrCpfCnpj: input,
      });
      if (!res.success) {
        setForgotError(res.error?.message ?? 'Erro ao solicitar redefinição.');
        return;
      }
      setForgotSuccess({
        message: res.data?.message ?? 'Se o e-mail estiver cadastrado, você receberá as instruções em breve.',
        email: res.data?.email,
      });
    } catch {
      setForgotError('Erro ao processar. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  }

  function closeForgot() {
    setForgotOpen(false);
    setForgotInput('');
    setForgotError('');
    setForgotSuccess(null);
  }

  async function onSubmit(values: LoginForm) {
    try {
      const response = await apiClient.post<{
        token: string;
        user: { id: string; email: string; name: string };
        account: { id: string; name: string };
      }>('/auth/login', values);

      if (!response.success || !response.data?.token) {
        setError('root', { message: response.error?.message ?? 'Erro ao fazer login' });
        return;
      }

      apiClient.setToken(response.data.token);
      queryClient.removeQueries({ queryKey: ['user', 'me'] });
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Credenciais inválidas';
      setError('root', { message });
    }
  }

  const showContaVencida = contaVencidaState || (errors.root?.message?.includes('Conta vencida') ?? false);
  const contaVencidaMessage = 'Seu plano venceu. Entre em contato com o suporte para renovar.';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4 relative">
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4">
        <ThemeToggle className="text-muted-foreground hover:text-foreground" />
      </div>
      {showContaVencida && (
        <div
          className="w-full max-w-md mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-center text-sm font-medium"
          role="alert"
        >
          {contaVencidaMessage}
        </div>
      )}
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex justify-center w-full">
            <Logo size="large" showText={false} linkable={false} />
          </div>
          <CardDescription>Entre com seu email e senha para acessar o sistema</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {errors.root && !showContaVencida && (
              <p className="text-sm text-destructive text-center" role="alert">
                {errors.root.message}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-sm text-muted-foreground hover:text-foreground h-auto py-0"
              onClick={() => setForgotOpen(true)}
            >
              Esqueci a senha
            </Button>
          </CardFooter>
        </form>
        {!isStandalone && (
          <p className="text-center pt-2 pb-4">
            <Button
              type="button"
              variant="ghost"
              className="text-sm text-muted-foreground hover:text-foreground h-auto py-0 inline-flex gap-1.5"
              onClick={showInstructions}
            >
              <Download className="w-4 h-4" />
              Instalar no seu dispositivo
            </Button>
          </p>
        )}
      </Card>

      <Dialog open={forgotOpen} onOpenChange={(open) => !open && closeForgot()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe o e-mail ou CPF/CNPJ cadastrado. Enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          {forgotSuccess ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-foreground">
                {forgotSuccess.email ? (
                  <>
                    O e-mail foi enviado para <strong>{forgotSuccess.email}</strong>. Verifique sua caixa de entrada (e o spam).
                  </>
                ) : (
                  forgotSuccess.message
                )}
              </p>
              <DialogFooter>
                <Button onClick={closeForgot}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={onForgotSubmit}>
              <div className="grid gap-4 py-4">
                {forgotError && (
                  <p className="text-sm text-destructive" role="alert">
                    {forgotError}
                  </p>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="forgot-input">E-mail ou CPF/CNPJ</Label>
                  <Input
                    id="forgot-input"
                    type="text"
                    placeholder="seu@email.com ou 000.000.000-00"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeForgot}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
