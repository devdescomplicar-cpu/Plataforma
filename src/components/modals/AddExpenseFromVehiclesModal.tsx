import { useState, useEffect, useMemo } from 'react';
import { Wrench, Loader2, Calendar as CalendarIcon, Car, Search, ChevronLeft } from 'lucide-react';
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
import { useCreateExpense, useVehiclesWithExpenses } from '@/hooks/useExpenses';
import { useSettings } from '@/hooks/useSettings';
import { useVehicles } from '@/hooks/useVehicles';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, toPublicImageUrl } from '@/lib/utils';

interface AddExpenseFromVehiclesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExpenseFromVehiclesModal({
  open,
  onOpenChange,
}: AddExpenseFromVehiclesModalProps) {
  const [step, setStep] = useState<'select-vehicle' | 'add-expense'>('select-vehicle');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [error, setError] = useState('');

  const { data: vehiclesData } = useVehicles();
  const { data: settingsData } = useSettings();
  const createExpenseMutation = useCreateExpense();
  
  // Obter categorias das configurações + "Outro"
  const expenseTypes = useMemo(() => {
    const categories = settingsData?.settings?.expenseCategories || [];
    return [...categories, 'Outro'] as const;
  }, [settingsData]);

  const vehicles = vehiclesData?.data || [];
  // Filtrar apenas veículos em estoque (available ou reserved), excluindo vendidos
  const availableVehicles = vehicles.filter((vehicle) => 
    vehicle.status === 'available' || vehicle.status === 'reserved'
  );
  
  const filteredVehicles = availableVehicles.filter((vehicle) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      vehicle.brand.toLowerCase().includes(search) ||
      vehicle.model.toLowerCase().includes(search) ||
      vehicle.year.toString().includes(search) ||
      (vehicle.plate && vehicle.plate.toLowerCase().includes(search))
    );
  });

  const selectedVehicle = availableVehicles.find((v) => v.id === selectedVehicleId);

  const formatCurrency = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    const number = parseFloat(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  };

  const parseCurrency = (value: string): number => {
    const numericValue = value.replace(/\D/g, '');
    return parseFloat(numericValue) / 100;
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setStep('add-expense');
  };

  const handleBack = () => {
    setStep('select-vehicle');
    setSelectedVehicleId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedVehicleId) {
      setError('Selecione um veículo');
      return;
    }

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

    createExpenseMutation.mutate(
      {
        vehicleId: selectedVehicleId,
        type,
        value: expenseValue,
        description: description.trim() || undefined,
        date: date ? date.toISOString() : undefined,
        status: 'paid',
      },
      {
        onSuccess: () => {
          toast({
            title: 'Despesa adicionada',
            description: 'A despesa foi cadastrada com sucesso.',
          });
          resetForm();
          onOpenChange(false);
        },
        onError: (err) => {
          toast({
            title: 'Erro ao adicionar',
            description: err instanceof Error ? err.message : 'Tente novamente.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const resetForm = () => {
    setStep('select-vehicle');
    setSelectedVehicleId(null);
    setSearchTerm('');
    setType('');
    setValue('');
    setDescription('');
    setDate(new Date());
    setError('');
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const getVehicleImage = (vehicle: typeof vehicles[0]) => {
    if (vehicle.images && vehicle.images.length > 0) {
      const sortedImages = [...vehicle.images].sort((a, b) => (a.order || 0) - (b.order || 0));
      return toPublicImageUrl(sortedImages[0].url) || sortedImages[0].url;
    }
    return vehicle.image || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <Wrench className="w-8 h-8 text-destructive" />
            <div className="flex-1">
              <DialogTitle className="text-xl">
                {step === 'select-vehicle' ? 'Selecionar Veículo' : 'Adicionar Despesa'}
              </DialogTitle>
              <DialogDescription>
                {step === 'select-vehicle'
                  ? 'Selecione o veículo para adicionar a despesa'
                  : selectedVehicle
                  ? `Cadastre uma nova despesa para ${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.year}`
                  : 'Cadastre uma nova despesa'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'select-vehicle' ? (
          <div className="space-y-4 mt-4 flex-1 flex flex-col min-h-0">
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar veículo por marca, modelo, ano ou placa..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {filteredVehicles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground h-full flex flex-col items-center justify-center">
                  <Car className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum veículo encontrado</p>
                </div>
              ) : (
                <div 
                  className="h-[440px] overflow-y-auto space-y-2 pr-1 scrollbar-modal"
                >
                  {filteredVehicles.map((vehicle) => {
                    const imageUrl = getVehicleImage(vehicle);
                    return (
                      <button
                        key={vehicle.id}
                        onClick={() => handleVehicleSelect(vehicle.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={`${vehicle.brand} ${vehicle.model}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Car className="w-6 h-6 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {vehicle.brand} {vehicle.model}
                            {vehicle.version ? ` ${vehicle.version}` : ''}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {vehicle.year} {vehicle.plate ? `• ${vehicle.plate}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {selectedVehicle && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1.5 hover:bg-background rounded-lg transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-background flex-shrink-0">
                  {getVehicleImage(selectedVehicle) ? (
                    <img
                      src={getVehicleImage(selectedVehicle)!}
                      alt={`${selectedVehicle.brand} ${selectedVehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {selectedVehicle.brand} {selectedVehicle.model}
                    {selectedVehicle.version ? ` ${selectedVehicle.version}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedVehicle.year} {selectedVehicle.plate ? `• ${selectedVehicle.plate}` : ''}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Despesa *</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  setType(value);
                  setError('');
                  if (value !== 'Outro') {
                    setDescription('');
                  }
                }}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border">
                  {(expenseTypes || []).map((expenseType) => (
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm z-10">R$</span>
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
                  autoFocus
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

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={createExpenseMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="gap-2 bg-success hover:bg-success/90 text-white"
                disabled={createExpenseMutation.isPending}
              >
                {createExpenseMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    Adicionar Despesa
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
