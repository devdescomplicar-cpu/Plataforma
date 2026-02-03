import { useState, useEffect } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
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

interface SellVehicleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName: string;
  currentSalePrice?: number;
  onConfirm: (salePrice: number) => void;
  isSubmitting?: boolean;
}

export function SellVehicleModal({
  open,
  onOpenChange,
  vehicleName,
  currentSalePrice,
  onConfirm,
  isSubmitting = false,
}: SellVehicleModalProps) {
  const [salePrice, setSalePrice] = useState('');
  const [error, setError] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);

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

    if (!salePrice || salePrice.trim() === '') {
      setError('Por favor, informe o valor da venda');
      return;
    }

    const price = parseCurrency(salePrice);
    if (price <= 0) {
      setError('O valor da venda deve ser maior que zero');
      return;
    }

    onConfirm(price);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      setSalePrice('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  // Preencher com valor atual se existir
  useEffect(() => {
    if (open && !hasInitialized) {
      if (currentSalePrice) {
        const formatted = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(currentSalePrice);
        setSalePrice(formatted);
      }
      setHasInitialized(true);
    } else if (!open) {
      // Resetar quando fechar
      setSalePrice('');
      setError('');
      setHasInitialized(false);
    }
  }, [open, currentSalePrice, hasInitialized]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <DialogTitle className="text-xl">Confirmar Venda</DialogTitle>
              <DialogDescription>
                Informe o valor pelo qual o veículo foi vendido
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-1">Veículo</p>
            <p className="font-semibold text-foreground">{vehicleName}</p>
            {currentSalePrice && (
              <p className="text-xs text-muted-foreground mt-1">
                Valor pretendido: R$ {currentSalePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="salePrice">Valor da Venda *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                id="salePrice"
                placeholder="0,00"
                className="pl-9"
                value={salePrice}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  setSalePrice(formatted);
                  setError('');
                }}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Este valor será atualizado no cadastro do veículo
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gap-2 bg-success hover:bg-success/90 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Confirmar Venda
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
