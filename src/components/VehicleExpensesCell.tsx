import { useExpenses } from '@/hooks/useExpenses';
import { Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VehicleExpensesCellProps {
  vehicleId: string;
  vehicleName?: string;
  onViewExpenses?: (vehicleId: string, vehicleName: string) => void;
}

export function VehicleExpensesCell({ vehicleId, vehicleName, onViewExpenses }: VehicleExpensesCellProps) {
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

  const name = vehicleName ?? 'Veículo';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-destructive font-semibold">
        R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </span>
      {onViewExpenses && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onViewExpenses(vehicleId, name);
          }}
          title="Ver despesas"
        >
          <Eye className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
