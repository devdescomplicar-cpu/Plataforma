import { useExpenses } from '@/hooks/useExpenses';
import { Loader2 } from 'lucide-react';

interface VehicleExpensesCellProps {
  vehicleId: string;
}

export function VehicleExpensesCell({ vehicleId }: VehicleExpensesCellProps) {
  const { data: expensesData, isLoading } = useExpenses({ vehicleId });

  if (isLoading) {
    return (
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    );
  }

  const expenses = expensesData?.data || [];
  const total = expenses.reduce((sum, expense) => sum + expense.value, 0);

  if (total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="text-destructive font-semibold">
      R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    </span>
  );
}
