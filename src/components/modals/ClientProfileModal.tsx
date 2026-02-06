import { useClient } from '@/hooks/useClients';
import { Car, DollarSign, Clock, Mail, MapPin, FileText, Loader2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatCpfCnpj } from '@/lib/cpf-cnpj';
import { cn } from '@/lib/utils';
import { formatDateBR } from '@/lib/date-br';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ClientProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

export function ClientProfileModal({
  open,
  onOpenChange,
  clientId,
}: ClientProfileModalProps) {
  const { data: client, isLoading, isError } = useClient(clientId, {
    enabled: open && !!clientId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getDaysSinceLastPurchase = () => {
    // Se lastPurchase não estiver disponível, calcular a partir de sales
    if (client?.sales && client.sales.length > 0) {
      const lastSale = client.sales[0];
      const lastSaleDate = new Date(lastSale.saleDate);
      const days = Math.floor((Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
      return days;
    }
    if (client?.lastPurchase) {
      const days = Math.floor((Date.now() - new Date(client.lastPurchase).getTime()) / (1000 * 60 * 60 * 24));
      return days;
    }
    return null;
  };

  const getClientStatus = () => {
    if (!client) return { label: '', variant: 'outline' as const, className: '' };
    const clientPurchases = client.purchases ?? (client.sales?.length || 0);
    const clientTotalSpent = client.totalSpent ?? (client.sales?.reduce((sum, sale) => sum + sale.salePrice, 0) || 0);
    
    if (clientPurchases === 0) {
      return { label: 'Sem compras', variant: 'outline' as const, className: 'bg-muted text-muted-foreground' };
    } else if (clientPurchases === 1) {
      return { label: 'Novo', variant: 'outline' as const, className: 'bg-info/10 text-info border-info/20' };
    } else if (clientPurchases >= 2 && clientTotalSpent >= 100000) {
      return { label: 'VIP', variant: 'default' as const, className: 'bg-yellow-500 text-white hover:bg-yellow-500' };
    } else if (clientPurchases >= 2) {
      return { label: 'Recorrente', variant: 'default' as const, className: 'bg-primary text-white' };
    } else {
      return { label: 'Novo', variant: 'outline' as const, className: 'bg-info/10 text-info border-info/20' };
    }
  };

  // Calcular purchases, totalSpent e avgTicket a partir de sales se não estiverem disponíveis
  const purchases = client?.purchases ?? (client?.sales?.length || 0);
  const totalSpent = client?.totalSpent ?? (client?.sales?.reduce((sum, sale) => sum + sale.salePrice, 0) || 0);
  const avgTicket = purchases > 0 ? totalSpent / purchases : 0;

  const status = getClientStatus();
  const daysSince = getDaysSinceLastPurchase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-modal">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-primary" />
            <div>
              <DialogTitle className="text-xl">Perfil do Cliente</DialogTitle>
              <DialogDescription>
                Informações completas e histórico de compras
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !client ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cliente não encontrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dados Básicos */}
            <div className="card-elevated p-5">
              <h3 className="font-semibold text-lg mb-4">Dados Básicos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Nome</p>
                  <p className="font-medium">{client.name}</p>
                </div>
                {client.cpfCnpj && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">CPF/CNPJ</p>
                    <p className="font-medium">{formatCpfCnpj(client.cpfCnpj)}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Telefone</p>
                    <a 
                      href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      {client.phone}
                    </a>
                  </div>
                )}
                {client.email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <a 
                      href={`mailto:${client.email}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Mail className="w-4 h-4" />
                      {client.email}
                    </a>
                  </div>
                )}
                {client.city && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Cidade</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {client.city}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge variant={status.variant} className={cn("font-medium border", status.className)}>
                    {status.label}
                  </Badge>
                </div>
                {client.referredBy && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Indicado por</p>
                    <p className="font-medium">{client.referredBy.name}</p>
                  </div>
                )}
              </div>
              {client.observations && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">{client.observations}</p>
                </div>
              )}
            </div>

            {/* Indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card-elevated p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de veículos</p>
                    <p className="text-xl font-bold">{purchases}</p>
                  </div>
                </div>
              </div>

              <div className="card-elevated p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total gasto</p>
                    <p className="text-xl font-bold">{formatCurrency(totalSpent)}</p>
                  </div>
                </div>
              </div>

              <div className="card-elevated p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Última compra</p>
                    <p className="text-xl font-bold">
                      {daysSince !== null ? `${daysSince} ${daysSince === 1 ? 'dia' : 'dias'}` : 'Nunca'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Histórico de Compras */}
            {client.sales && client.sales.length > 0 ? (
              <div className="card-elevated p-5">
                <h3 className="font-semibold text-lg mb-4">Histórico de Compras</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Veículo</TableHead>
                        <TableHead className="font-semibold">Data</TableHead>
                        <TableHead className="font-semibold">Valor</TableHead>
                        <TableHead className="font-semibold">Pagamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {client.sales.map((sale) => {
                        const vehicleName = sale.vehicle
                          ? `${sale.vehicle.brand} ${sale.vehicle.model} ${sale.vehicle.year}`
                          : 'N/A';
                        
                        return (
                          <TableRow key={sale.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{vehicleName}</span>
                                {sale.vehicle?.plate && (
                                  <span className="text-xs text-muted-foreground">
                                    Placa: {sale.vehicle.plate}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatDateBR(sale.saleDate)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(sale.salePrice)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-medium">
                                {sale.paymentMethod}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="card-elevated p-8 text-center">
                <Car className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma compra registrada</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
