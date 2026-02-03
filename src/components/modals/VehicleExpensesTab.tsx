import { useState, useMemo } from 'react';
import { Trash2, Pencil, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useExpenses, useCreateExpense, useDeleteExpense, useUpdateExpense, CreateExpenseData } from '@/hooks/useExpenses';
import { useSettings } from '@/hooks/useSettings';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { getExpenseTypeColor } from '@/utils/expenseColors';
import { EditExpenseModal } from './EditExpenseModal';
import { ConfirmDialog } from './ConfirmDialog';

interface VehicleExpensesTabProps {
  vehicleId: string;
}

export function VehicleExpensesTab({ vehicleId }: VehicleExpensesTabProps) {
  const [expenseToEdit, setExpenseToEdit] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; type: string; value: number } | null>(null);

  const { data: expensesData, isLoading } = useExpenses({ vehicleId });
  const { data: settingsData } = useSettings();
  const deleteExpenseMutation = useDeleteExpense();

  const expenses = expensesData?.data || [];
  
  // Obter categorias das configurações + "Outro"
  const expenseTypes = useMemo(() => {
    const categories = settingsData?.settings?.expenseCategories || [];
    return [...categories, 'Outro'] as const;
  }, [settingsData]);

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.value, 0);

  const statusConfig = {
    paid: { label: 'Pago', className: 'bg-success-soft text-success' },
    pending: { label: 'Pendente', className: 'bg-warning-soft text-warning' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Despesas do Veículo</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Total: <span className="font-semibold text-foreground">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg bg-muted/30">
          <DollarSign className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground font-medium">Nenhuma despesa cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione despesas relacionadas a este veículo</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const status = statusConfig[expense.status];
                return (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-medium border",
                          getExpenseTypeColor(expense.type).bg,
                          getExpenseTypeColor(expense.type).text,
                          getExpenseTypeColor(expense.type).border,
                          `hover:${getExpenseTypeColor(expense.type).bg}`
                        )}
                      >
                        {expense.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <TruncatedText 
                        text={expense.description || '—'}
                        maxWidth="200px"
                      >
                        {expense.description || '—'}
                      </TruncatedText>
                    </TableCell>
                    <TableCell className="font-semibold">
                      R$ {expense.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(expense.date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', status.className)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setExpenseToEdit(expense.id)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setExpenseToDelete({
                            id: expense.id,
                            type: expense.type,
                            value: expense.value,
                          })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Expense Modal */}
      {expenseToEdit && (
        <EditExpenseModal
          open={!!expenseToEdit}
          onOpenChange={(open) => !open && setExpenseToEdit(null)}
          expenseId={expenseToEdit}
          expenseTypes={expenseTypes}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!expenseToDelete}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title="Confirmar Exclusão"
        description={
          <>
            Você tem certeza que deseja excluir a despesa <strong>{expenseToDelete?.type}</strong> de{' '}
            <strong>R$ {expenseToDelete?.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>?
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              Esta ação não pode ser desfeita.
            </span>
          </>
        }
        onConfirm={() => {
          if (expenseToDelete) {
            deleteExpenseMutation.mutate(expenseToDelete.id, {
              onSuccess: () => {
                toast({
                  title: 'Despesa excluída',
                  description: 'A despesa foi removida com sucesso.',
                });
                setExpenseToDelete(null);
              },
              onError: (err) => {
                toast({
                  title: 'Erro ao excluir',
                  description: err instanceof Error ? err.message : 'Tente novamente.',
                  variant: 'destructive',
                });
              },
            });
          }
        }}
        confirmText="Sim, Excluir"
        confirmVariant="destructive"
      />
    </div>
  );
}
