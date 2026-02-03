import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Car, Loader2, Calendar as CalendarIcon, DollarSign, TrendingUp, TrendingDown, Calculator, User, Search, ChevronLeft, ChevronDown, UserPlus, Mail, Phone, MapPin, FileText, Check } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { useCreateSale, useUpdateSale, Sale } from '@/hooks/useSales';
import { useVehicles } from '@/hooks/useVehicles';
import { useExpenses } from '@/hooks/useExpenses';
import { useClients, useCreateClient, useClient } from '@/hooks/useClients';
import { useCep } from '@/hooks/useCep';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, toPublicImageUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PAYMENT_METHODS = ['PIX', 'DINHEIRO', 'CARTÃO DE CRÉDITO', 'FINANCIAMENTO', 'TROCA'] as const;

interface RegisterSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVehicleId?: string | null;
  saleToEdit?: Sale | null;
}

export function RegisterSaleModal({
  open,
  onOpenChange,
  preselectedVehicleId,
  saleToEdit,
}: RegisterSaleModalProps) {
  const isEditMode = !!saleToEdit;
  const [step, setStep] = useState<'select-vehicle' | 'sale-data'>('select-vehicle');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(preselectedVehicleId || saleToEdit?.vehicleId || null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [salePrice, setSalePrice] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['PIX']);
  const [saleDate, setSaleDate] = useState<Date | undefined>(new Date());
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [activeClientTab, setActiveClientTab] = useState<'existing' | 'new'>('existing');
  
  // Novo cliente
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCpfCnpj, setNewClientCpfCnpj] = useState('');
  const [newClientZipCode, setNewClientZipCode] = useState('');
  const [newClientStreet, setNewClientStreet] = useState('');
  const [newClientNumber, setNewClientNumber] = useState('');
  const [newClientComplement, setNewClientComplement] = useState('');
  const [newClientNeighborhood, setNewClientNeighborhood] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientState, setNewClientState] = useState('');
  
  const { fetchCep, loading: loadingCep } = useCep();
  
  const [error, setError] = useState('');

  const queryClient = useQueryClient();
  const { data: vehiclesData } = useVehicles();
  const { data: expensesData } = useExpenses({ vehicleId: selectedVehicleId || undefined });
  const shouldSearchClients = clientSearchTerm.trim().length >= 2;
  const { data: clientsData } = useClients({
    search: shouldSearchClients ? clientSearchTerm : undefined,
    limit: shouldSearchClients ? 20 : 10,
  });
  const createSaleMutation = useCreateSale();
  const updateSaleMutation = useUpdateSale();
  const createClientMutation = useCreateClient();
  
  // Buscar cliente selecionado quando não houver busca ativa
  const shouldFetchSelectedClient = !!selectedClientId && !shouldSearchClients;
  const { data: selectedClient } = useClient(selectedClientId || '', {
    enabled: shouldFetchSelectedClient
  });

  const vehicles = vehiclesData?.data || [];
  const availableVehicles = vehicles.filter((v) => v.status !== 'sold');
  const clients = clientsData?.data || [];

  // Exibir últimos 10 cadastrados quando sem pesquisa; resultados filtrados quando pesquisando
  let displayClients = clients;

  // Cliente selecionado fora da lista atual: garantir que apareça
  if (selectedClientId && !clients.some((c) => c.id === selectedClientId) && selectedClient) {
    displayClients = [selectedClient, ...clients];
  }
  
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

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const expenses = expensesData?.data || [];
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.value, 0);

  // Cálculo automático de lucro/prejuízo
  const calculations = useMemo(() => {
    if (!selectedVehicle) {
      return {
        purchasePrice: 0,
        totalExpenses: 0,
        totalCost: 0,
        salePrice: 0,
        profit: 0,
        profitPercent: 0,
      };
    }

    const purchasePrice = selectedVehicle.purchasePrice || 0;
    const totalCost = purchasePrice + totalExpenses;
    const salePriceValue = parseFloat(salePrice.replace(/\D/g, '')) / 100 || 0;
    const profit = salePriceValue - totalCost;
    const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return {
      purchasePrice,
      totalExpenses,
      totalCost,
      salePrice: salePriceValue,
      profit,
      profitPercent,
    };
  }, [selectedVehicle, totalExpenses, salePrice]);

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

  const formatPhone = (value: string): string => {
    const numericValue = value.replace(/\D/g, '').slice(0, 11); // Limita a 11 dígitos
    if (numericValue.length <= 10) {
      return numericValue.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    }
    return numericValue.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  };

  const formatZipCode = (value: string): string => {
    // Remove todos os caracteres não numéricos
    const numericValue = value.replace(/\D/g, '').slice(0, 8);
    
    if (numericValue.length === 0) {
      return '';
    }
    
    // Formata como CEP: 00000-000
    if (numericValue.length <= 5) {
      return numericValue;
    } else {
      return `${numericValue.slice(0, 5)}-${numericValue.slice(5)}`;
    }
  };

  const handleZipCodeChange = async (value: string) => {
    const formatted = formatZipCode(value);
    setNewClientZipCode(formatted);
    
    const cleanCep = formatted.replace(/\D/g, '');
    
    // Se o CEP tiver menos de 8 dígitos, limpa os campos de endereço
    if (cleanCep.length < 8) {
      setNewClientStreet('');
      setNewClientNeighborhood('');
      setNewClientCity('');
      setNewClientState('');
      setNewClientComplement('');
      return;
    }
    
    // Busca CEP quando tiver exatamente 8 dígitos
    if (cleanCep.length === 8) {
      // Limpa os campos antes de buscar para garantir que dados antigos não fiquem
      setNewClientStreet('');
      setNewClientNeighborhood('');
      setNewClientCity('');
      setNewClientState('');
      setNewClientComplement('');
      
      const cepData = await fetchCep(cleanCep);
      if (cepData) {
        setNewClientStreet(cepData.logradouro || '');
        setNewClientNeighborhood(cepData.bairro || '');
        setNewClientCity(cepData.localidade || '');
        setNewClientState(cepData.uf || '');
        setNewClientComplement(cepData.complemento || '');
      }
    }
  };

  const formatCpfCnpj = (value: string): string => {
    // Remove todos os caracteres não numéricos
    const numericValue = value.replace(/\D/g, '').slice(0, 14);
    
    if (numericValue.length === 0) {
      return '';
    }
    
    // Formatação progressiva baseada no comprimento
    if (numericValue.length <= 11) {
      // CPF: 000.000.000-00
      if (numericValue.length <= 3) {
        return numericValue;
      } else if (numericValue.length <= 6) {
        return `${numericValue.slice(0, 3)}.${numericValue.slice(3)}`;
      } else if (numericValue.length <= 9) {
        return `${numericValue.slice(0, 3)}.${numericValue.slice(3, 6)}.${numericValue.slice(6)}`;
      } else {
        return `${numericValue.slice(0, 3)}.${numericValue.slice(3, 6)}.${numericValue.slice(6, 9)}-${numericValue.slice(9)}`;
      }
    } else {
      // CNPJ: 00.000.000/0000-00
      if (numericValue.length <= 2) {
        return numericValue;
      } else if (numericValue.length <= 5) {
        return `${numericValue.slice(0, 2)}.${numericValue.slice(2)}`;
      } else if (numericValue.length <= 8) {
        return `${numericValue.slice(0, 2)}.${numericValue.slice(2, 5)}.${numericValue.slice(5)}`;
      } else if (numericValue.length <= 12) {
        return `${numericValue.slice(0, 2)}.${numericValue.slice(2, 5)}.${numericValue.slice(5, 8)}/${numericValue.slice(8)}`;
      } else {
        return `${numericValue.slice(0, 2)}.${numericValue.slice(2, 5)}.${numericValue.slice(5, 8)}/${numericValue.slice(8, 12)}-${numericValue.slice(12)}`;
      }
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setStep('sale-data');
  };

  const handleBack = () => {
    setStep('select-vehicle');
    setSelectedVehicleId(null);
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
  };

  const handleCreateNewClient = async () => {
    if (!newClientName.trim()) {
      setError('Nome do cliente é obrigatório');
      return;
    }

    try {
      const newClient = await createClientMutation.mutateAsync({
        name: newClientName,
        email: newClientEmail || undefined,
        phone: newClientPhone || undefined,
        cpfCnpj: newClientCpfCnpj.replace(/\D/g, '') || undefined,
        zipCode: newClientZipCode.replace(/\D/g, '') || undefined,
        street: newClientStreet || undefined,
        number: newClientNumber || undefined,
        complement: newClientComplement || undefined,
        neighborhood: newClientNeighborhood || undefined,
        city: newClientCity || undefined,
        state: newClientState || undefined,
      });

      // Selecionar o cliente recém-criado
      setSelectedClientId(newClient.id);
      
      // Invalidar queries para garantir que os dados sejam atualizados
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      
      // Reset novo cliente form
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientCpfCnpj('');
      setNewClientZipCode('');
      setNewClientStreet('');
      setNewClientNumber('');
      setNewClientComplement('');
      setNewClientNeighborhood('');
      setNewClientCity('');
      setNewClientState('');
      
      // Limpar termo de busca para mostrar o novo cliente na lista
      setClientSearchTerm('');
      
      // Aguardar um pouco para a query atualizar antes de mudar de aba
      setTimeout(() => {
        // Mudar para a aba "Cliente existente" para mostrar o cliente selecionado
        setActiveClientTab('existing');
      }, 100);
      
      toast({
        title: 'Cliente criado!',
        description: `${newClient.name} foi cadastrado e selecionado com sucesso.`,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Erro ao criar cliente');
      toast({
        title: 'Erro',
        description: err?.response?.data?.error?.message || 'Erro ao criar cliente',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedVehicleId) {
      setError('Selecione um veículo');
      return;
    }

    if (!salePrice || parseCurrency(salePrice) <= 0) {
      setError('Valor da venda é obrigatório');
      return;
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      setError('Selecione pelo menos uma forma de pagamento');
      return;
    }

    try {
      if (isEditMode && saleToEdit) {
        await updateSaleMutation.mutateAsync({
          id: saleToEdit.id,
          vehicleId: selectedVehicleId,
          salePrice: parseCurrency(salePrice),
          paymentMethod: paymentMethods.join(', '),
          saleDate: saleDate?.toISOString(),
          clientId: selectedClientId || undefined,
        });

        toast({
          title: 'Venda atualizada!',
          description: 'A venda foi atualizada com sucesso.',
        });
      } else {
        await createSaleMutation.mutateAsync({
          vehicleId: selectedVehicleId,
          salePrice: parseCurrency(salePrice),
          paymentMethod: paymentMethods.join(', '),
          saleDate: saleDate?.toISOString(),
          clientId: selectedClientId || undefined,
        });

        toast({
          title: 'Venda registrada!',
          description: 'A venda foi registrada com sucesso.',
        });
      }

      // Reset form apenas se não estiver em modo edição
      if (!isEditMode) {
        setStep('select-vehicle');
        setSelectedVehicleId(null);
        setSalePrice('');
        setPaymentMethods(['PIX']);
        setSaleDate(new Date());
        setSelectedClientId(null);
        setClientSearchTerm('');
        setNewClientName('');
        setNewClientEmail('');
        setNewClientPhone('');
        setNewClientCpfCnpj('');
        setNewClientZipCode('');
        setNewClientStreet('');
        setNewClientNumber('');
        setNewClientComplement('');
        setNewClientNeighborhood('');
        setNewClientCity('');
        setNewClientState('');
        setSearchTerm('');
        setError('');
      }

      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Erro ao registrar venda');
      toast({
        title: 'Erro',
        description: err?.response?.data?.error?.message || 'Erro ao registrar venda',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (open) {
      if (saleToEdit) {
        // Modo edição
        setSelectedVehicleId(saleToEdit.vehicleId);
        setStep('sale-data');
        // Formatar preço para o input (sem R$ e com vírgula)
        const priceInCents = Math.round(saleToEdit.salePrice * 100);
        const formattedPrice = formatCurrency(priceInCents.toString());
        setSalePrice(formattedPrice);
        // Separar formas de pagamento por vírgula se houver múltiplas
        const methods = saleToEdit.paymentMethod.split(',').map(m => m.trim()).filter(m => m);
        setPaymentMethods(methods.length > 0 ? methods : ['PIX']);
        setSaleDate(new Date(saleToEdit.saleDate));
        setSelectedClientId(saleToEdit.clientId || null);
      } else if (preselectedVehicleId) {
        // Modo criação com veículo pré-selecionado
        setSelectedVehicleId(preselectedVehicleId);
        setStep('sale-data');
      }
    } else if (!open) {
      setStep('select-vehicle');
      setSelectedVehicleId(preselectedVehicleId || null);
      setSalePrice('');
      setPaymentMethods(['PIX']);
      setSaleDate(new Date());
      setSelectedClientId(null);
      setClientSearchTerm('');
      setActiveClientTab('existing');
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientCpfCnpj('');
      setNewClientZipCode('');
      setNewClientStreet('');
      setNewClientNumber('');
      setNewClientComplement('');
      setNewClientNeighborhood('');
      setNewClientCity('');
      setNewClientState('');
      setSearchTerm('');
      setError('');
    }
  }, [open, preselectedVehicleId, saleToEdit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto scrollbar-thin bg-card rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-primary" />
            <div>
              <DialogTitle className="text-xl">{isEditMode ? 'Editar Venda' : 'Registrar Venda'}</DialogTitle>
              <DialogDescription>
                {step === 'select-vehicle' 
                  ? 'Selecione o veículo que foi vendido'
                  : isEditMode 
                    ? 'Edite os dados da venda'
                    : 'Preencha os dados da venda'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'select-vehicle' ? (
          <div className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por marca, modelo, ano ou placa..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-2">
              {filteredVehicles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Car className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum veículo em estoque encontrado</p>
                </div>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const imageUrl = toPublicImageUrl(vehicle.image);
                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => handleVehicleSelect(vehicle.id)}
                      className="w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {imageUrl ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={imageUrl}
                              alt={`${vehicle.brand} ${vehicle.model}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Car className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {vehicle.brand} {vehicle.model}
                            {vehicle.version ? ` ${vehicle.version}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.year} • {vehicle.plate || 'Sem placa'} • {vehicle.km?.toLocaleString('pt-BR') || 'N/A'} km
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            Em estoque
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {selectedVehicle && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-3">
                  {selectedVehicle.image ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={toPublicImageUrl(selectedVehicle.image)}
                        alt={`${selectedVehicle.brand} ${selectedVehicle.model}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Car className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {selectedVehicle.brand} {selectedVehicle.model}
                      {selectedVehicle.version ? ` ${selectedVehicle.version}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedVehicle.year} • {selectedVehicle.plate || 'Sem placa'} • {selectedVehicle.km?.toLocaleString('pt-BR') || 'N/A'} km
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Trocar
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salePrice">Valor da venda *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                  <Input
                    id="salePrice"
                    placeholder="0,00"
                    className="pl-10"
                    value={salePrice}
                    onChange={(e) => {
                      const formatted = formatCurrency(e.target.value);
                      setSalePrice(formatted);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Forma de pagamento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="paymentMethod"
                      variant="outline"
                      className={cn(
                        'w-full justify-between text-left font-normal',
                        paymentMethods.length === 0 && 'text-muted-foreground'
                      )}
                    >
                      <span className="truncate">
                        {paymentMethods.length === 0
                          ? 'Selecione as formas de pagamento'
                          : paymentMethods.length === 1
                          ? paymentMethods[0]
                          : `${paymentMethods.length} formas selecionadas`}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                      {PAYMENT_METHODS.map((method) => {
                        const isSelected = paymentMethods.includes(method);
                        return (
                          <div
                            key={method}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                              if (isSelected) {
                                setPaymentMethods(paymentMethods.filter(m => m !== method));
                              } else {
                                setPaymentMethods([...paymentMethods, method]);
                              }
                            }}
                          >
                            <Checkbox
                              id={`payment-${method}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setPaymentMethods([...paymentMethods, method]);
                                } else {
                                  setPaymentMethods(paymentMethods.filter(m => m !== method));
                                }
                              }}
                            />
                            <label
                              htmlFor={`payment-${method}`}
                              className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {method}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                {paymentMethods.length === 0 && (
                  <p className="text-xs text-destructive mt-1">Selecione pelo menos uma forma de pagamento</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="saleDate">Data da venda</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="saleDate"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !saleDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {saleDate ? format(saleDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={saleDate}
                    onSelect={setSaleDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Seção de Cliente */}
            <div className="space-y-2">
              <Label>Comprador (opcional)</Label>
              <Tabs value={activeClientTab} onValueChange={(value) => setActiveClientTab(value as 'existing' | 'new')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Cliente existente</TabsTrigger>
                  <TabsTrigger value="new">Novo cliente</TabsTrigger>
                </TabsList>
                
                <TabsContent value="existing" className="space-y-3 mt-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente por nome, email ou telefone..."
                      className="pl-9"
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin space-y-2 border border-border rounded-lg p-2 min-h-[120px]">
                    {displayClients.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-sm text-foreground mb-1">
                          {shouldSearchClients ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {shouldSearchClients
                            ? 'Tente buscar por nome, email, telefone ou CPF/CNPJ'
                            : 'Cadastre um novo cliente na aba ao lado'}
                        </p>
                      </div>
                    ) : (
                      displayClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleClientSelect(client.id)}
                          className={cn(
                            'w-full p-3 rounded-lg border transition-colors text-left',
                            selectedClientId === client.id
                              ? 'bg-primary/10 border-primary'
                              : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                              selectedClientId === client.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10"
                            )}>
                              {selectedClientId === client.id ? (
                                <Check className="w-5 h-5" />
                              ) : (
                                <User className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{client.name}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {client.email && (
                                  <span className="text-xs text-muted-foreground truncate">{client.email}</span>
                                )}
                                {client.phone && (
                                  <span className="text-xs text-muted-foreground">{client.phone}</span>
                                )}
                                {client.cpfCnpj && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatCpfCnpj(client.cpfCnpj)}
                                  </span>
                                )}
                                {client.city && (
                                  <span className="text-xs text-muted-foreground">{client.city}</span>
                                )}
                              </div>
                            </div>
                            {selectedClientId === client.id && (
                              <Badge variant="default" className="text-xs">Selecionado</Badge>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="new" className="space-y-3 mt-3">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="newClientName">Nome *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="newClientName"
                          placeholder="Nome completo"
                          className="pl-9"
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newClientCpfCnpj">CPF/CNPJ</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="newClientCpfCnpj"
                            placeholder="000.000.000-00 ou 00.000.000/0000-00"
                            className="pl-9"
                            value={newClientCpfCnpj}
                            onChange={(e) => {
                              const formatted = formatCpfCnpj(e.target.value);
                              setNewClientCpfCnpj(formatted);
                            }}
                          />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="newClientEmail">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="newClientEmail"
                            type="email"
                            placeholder="email@exemplo.com"
                            className="pl-9"
                            value={newClientEmail}
                            onChange={(e) => setNewClientEmail(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="newClientPhone">WhatsApp</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="newClientPhone"
                            placeholder="(00) 00000-0000"
                            className="pl-9"
                            value={newClientPhone}
                            onChange={(e) => {
                              const formatted = formatPhone(e.target.value);
                              setNewClientPhone(formatted);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Seção de Endereço */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <h4 className="text-sm font-semibold text-foreground">Endereço</h4>
                      
                      <div className="space-y-2">
                        <Label htmlFor="newClientZipCode">CEP</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="newClientZipCode"
                            placeholder="00000-000"
                            className="pl-9"
                            value={newClientZipCode}
                            onChange={(e) => handleZipCodeChange(e.target.value)}
                            disabled={loadingCep}
                          />
                          {loadingCep && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Digite o CEP para preencher automaticamente</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="newClientStreet">Rua/Logradouro</Label>
                        <Input
                          id="newClientStreet"
                          placeholder="Rua, Avenida, etc."
                          value={newClientStreet}
                          onChange={(e) => setNewClientStreet(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2 col-span-1">
                          <Label htmlFor="newClientNumber">Número</Label>
                          <Input
                            id="newClientNumber"
                            placeholder="123"
                            value={newClientNumber}
                            onChange={(e) => setNewClientNumber(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="newClientComplement">Complemento</Label>
                          <Input
                            id="newClientComplement"
                            placeholder="Apto, Bloco, etc."
                            value={newClientComplement}
                            onChange={(e) => setNewClientComplement(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="newClientNeighborhood">Bairro</Label>
                        <Input
                          id="newClientNeighborhood"
                          placeholder="Bairro"
                          value={newClientNeighborhood}
                          onChange={(e) => setNewClientNeighborhood(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="newClientCity">Cidade</Label>
                          <Input
                            id="newClientCity"
                            placeholder="Cidade"
                            value={newClientCity}
                            onChange={(e) => setNewClientCity(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newClientState">Estado (UF)</Label>
                          <Input
                            id="newClientState"
                            placeholder="SP"
                            maxLength={2}
                            value={newClientState}
                            onChange={(e) => setNewClientState(e.target.value.toUpperCase())}
                            className="uppercase"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCreateNewClient}
                      disabled={createClientMutation.isPending || !newClientName.trim()}
                      className="w-full gap-2"
                    >
                      {createClientMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Cadastrar cliente
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Cálculo automático */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">Cálculo Automático</h3>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor de compra:</span>
                  <span className="font-medium">
                    R$ {calculations.purchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Despesas totais:</span>
                  <span className="font-medium">
                    R$ {calculations.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-medium">Custo total:</span>
                  <span className="font-semibold">
                    R$ {calculations.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor de venda:</span>
                  <span className="font-medium">
                    R$ {calculations.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-semibold">
                    {calculations.profit >= 0 ? 'Lucro' : 'Prejuízo'}:
                  </span>
                  <span className={cn(
                    'font-bold text-lg',
                    calculations.profit >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    {calculations.profit >= 0 ? (
                      <TrendingUp className="w-4 h-4 inline mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 inline mr-1" />
                    )}
                    R$ {Math.abs(calculations.profit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-sm font-normal ml-2">
                      ({calculations.profitPercent >= 0 ? '+' : ''}{calculations.profitPercent.toFixed(2)}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createSaleMutation.isPending || updateSaleMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createSaleMutation.isPending || updateSaleMutation.isPending}
                className="gap-2"
              >
                {(createSaleMutation.isPending || updateSaleMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isEditMode ? 'Atualizando...' : 'Registrando...'}
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    {isEditMode ? 'Salvar alterações' : 'Confirmar venda'}
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
