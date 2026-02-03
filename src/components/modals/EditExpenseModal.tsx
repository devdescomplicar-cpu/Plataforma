import { useState, useEffect } from 'react';
import { DollarSign, Loader2, Calendar as CalendarIcon, Wrench } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useExpense, useUpdateExpense } from '@/hooks/useExpenses';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EditExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  expenseTypes: readonly string[];
}

export function EditExpenseModal({
  open,
  onOpenChange,
  expenseId,
  expenseTypes,
}: EditExpenseModalProps) {
  const { data: expense, isLoading } = useExpense(expenseId, {
    enabled: !!expenseId && open,
  });
  const updateExpenseMutation = useUpdateExpense();
  
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (expense && open) {
      setType(expense.type);
      setValue(
        new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(expense.value)
      );
      setDescription(expense.description || '');
      setDate(expense.date ? new Date(expense.date) : new Date());
    } else if (!open) {
      setType('');
      setValue('');
      setDescription('');
      setDate(undefined);
      setError('');
    }
  }, [expense, open]);

  const formatCurrency = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const number = parseFloat(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  };

  const parseCurrency = (value: string): number => {
    const numericValue = value.replace(/\D/g, '');
    return parseFloat(numericValue) / 100;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!type) {
      setError('Selecione o tipo de despesa');
      return;
    }

    if (!value || value.trim() === '') {
      setError('Informe o valor da despesa');
      return;
    }

    if (type === 'Outro' && !description.trim()) {
      setError('Para despesas do tipo "Outro", é obrigatório informar a descrição');
      return;
    }

    const expenseValue = parseCurrency(value);
    if (expenseValue <= 0) {
      setError('O valor da despesa deve ser maior que zero');
      return;
    }

    updateExpenseMutation.mutate(
      {
        id: expenseId,
        type,
        value: expenseValue,
        description: description.trim() || undefined,
        date: date ? date.toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Despesa atualizada',
            description: 'As alterações foram salvas com sucesso.',
          });
          onOpenChange(false);
        },
        onError: (err) => {
          toast({
            title: 'Erro ao atualizar',
            description: err instanceof Error ? err.message : 'Tente novamente.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Wrench className="w-8 h-8 text-destructive" />
            <div>
              <DialogTitle className="text-xl">Editar Despesa</DialogTitle>
              <DialogDescription>
                Atualize as informações da despesa
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Despesa *</Label>
            <Select value={type} onValueChange={(value) => {
              setType(value);
              setError('');
              if (value !== 'Outro') {
                setDescription('');
              }
            }}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border">
                {expenseTypes.map((expenseType) => (
                  <SelectItem key={expenseType} value={expenseType}>
                    {expenseType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'Outro' && (
            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                placeholder="Ex: Troca de óleo, Revisão completa..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError('');
                }}
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Descreva detalhadamente a despesa
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="value">Valor *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                id="value"
                placeholder="0,00"
                className="pl-9"
                value={value}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  setValue(formatted);
                  setError('');
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (
                    format(date, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateExpenseMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-2 bg-success hover:bg-success/90 text-white"
              disabled={updateExpenseMutation.isPending}
            >
              {updateExpenseMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
