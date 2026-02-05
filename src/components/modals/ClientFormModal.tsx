import { useState, useEffect } from 'react';
import { Loader2, User, Mail, Phone, MapPin, FileText, UserPlus, MessageSquare } from 'lucide-react';
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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useCreateClient, useUpdateClient, useClients, Client } from '@/hooks/useClients';
import { toast } from '@/hooks/use-toast';
import { formatCpfCnpj } from '@/lib/cpf-cnpj';
import { useCep } from '@/hooks/useCep';

const formatPhone = (value: string): string => {
  const numericValue = value.replace(/\D/g, '').slice(0, 11);
  if (!numericValue) return '';
  
  if (numericValue.length <= 2) {
    return `(${numericValue}`;
  } else if (numericValue.length <= 7) {
    return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2)}`;
  } else {
    return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2, 7)}-${numericValue.slice(7)}`;
  }
};

const formatZipCode = (value: string): string => {
  const numericValue = value.replace(/\D/g, '').slice(0, 8);
  if (numericValue.length === 0) return '';
  if (numericValue.length <= 5) return numericValue;
  return `${numericValue.slice(0, 5)}-${numericValue.slice(5)}`;
};

interface ClientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientToEdit?: Client | null;
}

export function ClientFormModal({
  open,
  onOpenChange,
  clientToEdit,
}: ClientFormModalProps) {
  const isEditMode = !!clientToEdit;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('_');
  const [observations, setObservations] = useState('');
  const [referredByClientId, setReferredByClientId] = useState<string>('');
  const [error, setError] = useState('');
  
  const { fetchCep, loading: loadingCep } = useCep();

  const { data: allClientsData } = useClients({ limit: 500 });
  const clientsForReferral = allClientsData?.data ?? [];

  const referralOptions = [
    { value: '_none', label: 'Sem indicação' },
    ...clientsForReferral
      .filter((c) => c.id !== clientToEdit?.id)
      .map((c) => ({
        value: c.id,
        label: c.name,
        searchText: [c.name, c.cpfCnpj, c.phone, c.email].filter(Boolean).join(' '),
      })),
  ];

  const EMPTY_STATE = '_';

  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();

  useEffect(() => {
    if (open) {
      if (clientToEdit) {
        setName(clientToEdit.name || '');
        setEmail(clientToEdit.email || '');
        setPhone(clientToEdit.phone || '');
        setCpfCnpj(clientToEdit.cpfCnpj || '');
        setZipCode(clientToEdit.zipCode ? formatZipCode(clientToEdit.zipCode) : '');
        setStreet(clientToEdit.street || '');
        setNumber(clientToEdit.number || '');
        setComplement(clientToEdit.complement || '');
        setNeighborhood(clientToEdit.neighborhood || '');
        setCity(clientToEdit.city || '');
        setState(clientToEdit.state || EMPTY_STATE);
        setObservations(clientToEdit.observations ?? '');
        setReferredByClientId(clientToEdit.referredByClientId ?? '');
      } else {
        setName('');
        setEmail('');
        setPhone('');
        setCpfCnpj('');
        setZipCode('');
        setStreet('');
        setNumber('');
        setComplement('');
        setNeighborhood('');
        setCity('');
        setState(EMPTY_STATE);
        setObservations('');
        setReferredByClientId('');
      }
      setError('');
    }
  }, [open, clientToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (!phone.trim()) {
      setError('Telefone é obrigatório');
      return;
    }

    try {
      const data = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        cpfCnpj: cpfCnpj.replace(/\D/g, '') || undefined,
        zipCode: zipCode.replace(/\D/g, '') || undefined,
        street: street.trim() || undefined,
        number: number.trim() || undefined,
        complement: complement.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        city: city.trim() || undefined,
        state: state && state !== EMPTY_STATE ? state.trim() : undefined,
        observations: observations.trim() || undefined,
        referredByClientId: referredByClientId.trim() || undefined,
      };

      if (isEditMode && clientToEdit) {
        await updateClientMutation.mutateAsync({
          id: clientToEdit.id,
          ...data,
        });

        toast({
          title: 'Cliente atualizado!',
          description: 'Os dados do cliente foram atualizados com sucesso.',
        });
      } else {
        await createClientMutation.mutateAsync(data);

        toast({
          title: 'Cliente cadastrado!',
          description: 'O cliente foi cadastrado com sucesso.',
        });
      }

      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Erro ao salvar cliente');
      toast({
        title: 'Erro',
        description: err?.response?.data?.error?.message || 'Erro ao salvar cliente',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-modal">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {isEditMode ? (
              <User className="w-8 h-8 text-primary" />
            ) : (
              <UserPlus className="w-8 h-8 text-primary" />
            )}
            <div>
              <DialogTitle className="text-xl">
                {isEditMode ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Atualize os dados do cliente' : 'Preencha os dados do novo cliente'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="name"
                className="pl-9"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">
                Telefone <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  className="pl-9"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    if (formatted.replace(/\D/g, '').length <= 11) {
                      setPhone(formatted);
                    }
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="cpfCnpj"
                className="pl-9"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => {
                  const formatted = formatCpfCnpj(e.target.value);
                  if (formatted.replace(/\D/g, '').length <= 14) {
                    setCpfCnpj(formatted);
                  }
                }}
              />
            </div>
          </div>

          {/* Seção de Endereço */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-sm font-semibold text-foreground">Endereço</h4>
            
            <div className="space-y-2">
              <Label htmlFor="zipCode">CEP</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="zipCode"
                  className="pl-9"
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={async (e) => {
                    const formatted = formatZipCode(e.target.value);
                    setZipCode(formatted);
                    
                    const cleanCep = formatted.replace(/\D/g, '');
                    
                    // Se o CEP tiver menos de 8 dígitos, limpa os campos de endereço
                    if (cleanCep.length < 8) {
                      setStreet('');
                      setNeighborhood('');
                      setCity('');
                      setState(EMPTY_STATE);
                      setComplement('');
                      return;
                    }
                    
                    // Busca CEP quando tiver exatamente 8 dígitos
                    if (cleanCep.length === 8) {
                      // Limpa os campos antes de buscar para garantir que dados antigos não fiquem
                      setStreet('');
                      setNeighborhood('');
                      setCity('');
                      setState(EMPTY_STATE);
                      setComplement('');
                      
                      const cepData = await fetchCep(cleanCep);
                      if (cepData) {
                        setStreet(cepData.logradouro || '');
                        setNeighborhood(cepData.bairro || '');
                        setCity(cepData.localidade || '');
                        setState(cepData.uf || EMPTY_STATE);
                        setComplement(cepData.complemento || '');
                      }
                    }
                  }}
                  disabled={loadingCep}
                />
                {loadingCep && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Digite o CEP para preencher automaticamente</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="street">Rua/Logradouro</Label>
              <Input
                id="street"
                placeholder="Rua, Avenida, etc."
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-1">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  placeholder="123"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  placeholder="Apto, Bloco, etc."
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                placeholder="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px] gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="stateFromAddress">Estado (UF)</Label>
                <Input
                  id="stateFromAddress"
                  placeholder="SP"
                  maxLength={2}
                  value={state && state !== EMPTY_STATE ? state : ''}
                  onChange={(e) => setState(e.target.value.toUpperCase() || EMPTY_STATE)}
                  className="uppercase"
                  readOnly
                  title="Preenchido automaticamente pelo CEP"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Textarea
                id="observations"
                className="pl-9 min-h-[80px] resize-y"
                placeholder="Anotações sobre o cliente..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referral">Indicação</Label>
            <SearchableSelect
              options={referralOptions}
              value={referredByClientId || '_none'}
              onValueChange={(v) => setReferredByClientId(v === '_none' ? '' : v)}
              placeholder="Amigo que indicou (opcional)"
              emptyMessage="Nenhum cliente encontrado. Busque por nome, CPF, telefone ou e-mail."
            />
            <p className="text-xs text-muted-foreground">
              Vincule ao cliente que indicou para facilitar cobrança ou comissão.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createClientMutation.isPending || updateClientMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createClientMutation.isPending || updateClientMutation.isPending}
              className="gap-2"
            >
              {(createClientMutation.isPending || updateClientMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditMode ? 'Salvando...' : 'Cadastrando...'}
                </>
              ) : (
                <>
                  {isEditMode ? 'Salvar alterações' : 'Cadastrar cliente'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
