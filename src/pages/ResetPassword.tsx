import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Loader2 } from 'lucide-react';
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
import { apiClient } from '@/lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!token) {
      setError('Link inválido. Solicite uma nova redefinição na tela de login.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ data?: { message: string } }>('/auth/reset-password', {
        token,
        newPassword: password,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Erro ao redefinir senha.');
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true, state: { message: 'Senha alterada. Faça login com a nova senha.' } }), 2000);
    } catch {
      setError('Erro ao redefinir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle className="text-muted-foreground hover:text-foreground" />
        </div>
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="text-center">
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>
              Este link de redefinição está incompleto ou expirado. Use &quot;Esqueci a senha&quot; na tela de login para solicitar um novo.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Ir para o login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle className="text-muted-foreground hover:text-foreground" />
        </div>
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Car className="w-6 h-6 text-primary" />
              </div>
            </div>
            <CardTitle>Senha alterada</CardTitle>
            <CardDescription>
              Redirecionando para o login...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle className="text-muted-foreground hover:text-foreground" />
      </div>
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Nova senha</CardTitle>
          <CardDescription>Defina uma nova senha (mínimo 6 caracteres)</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive text-center" role="alert">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className={error ? 'border-destructive' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                className={error ? 'border-destructive' : ''}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Redefinir senha'
              )}
            </Button>
          </CardFooter>
        </form>
        <p className="text-center pb-4">
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Voltar ao login
          </button>
        </p>
      </Card>
    </div>
  );
}
