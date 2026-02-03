import { Loader2, Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useExpenses } from '@/hooks/useExpenses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getExpenseTypeColor } from '@/utils/expenseColors';

interface VehicleExpensesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string | null;
  vehicleName: string;
}

const statusConfig = {
  paid: { label: 'Pago', className: 'bg-success-soft text-success' },
  pending: { label: 'Pendente', className: 'bg-warning-soft text-warning' },
};

export function VehicleExpensesModal({
  open,
  onOpenChange,
  vehicleId,
  vehicleName,
}: VehicleExpensesModalProps) {
  const { data: expensesData, isLoading } = useExpenses({
    vehicleId: vehicleId || undefined,
  });

  const expenses = expensesData?.data || [];
  const total = expenses.reduce((sum, expense) => sum + expense.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Despesas do veículo
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{vehicleName}</p>

        {!vehicleId ? (
          <p className="text-muted-foreground py-4">Nenhum veículo selecionado.</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg bg-muted/30">
            <Receipt className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">Nenhuma despesa cadastrada</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
            <div className="border border-border rounded-lg overflow-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
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
                              'font-medium border',
                              getExpenseTypeColor(expense.type).bg,
                              getExpenseTypeColor(expense.type).text,
                              getExpenseTypeColor(expense.type).border
                            )}
                          >
                            {expense.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          R$ {expense.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(expense.date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', status.className)}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
