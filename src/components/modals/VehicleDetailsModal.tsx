import { Car, Calendar, Fuel, Gauge, Palette, Settings, MapPin, DollarSign, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVehicle } from '@/hooks/useVehicles';
import { Loader2 } from 'lucide-react';
import { cn, toPublicImageUrl } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { VehicleExpensesTab } from './VehicleExpensesTab';
import { VEHICLE_COLORS } from '@/components/ui/ColorSelect';

interface VehicleDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string | null;
}

const statusConfig = {
  available: { label: 'Disponível', className: 'bg-success-soft text-success' },
  reserved: { label: 'Reservado', className: 'bg-warning-soft text-warning' },
  sold: { label: 'Vendido', className: 'bg-info-soft text-info' },
};

const originConfig = {
  own: 'Próprio',
  consignment: 'Consignado',
  repass: 'Repasse',
};

export function VehicleDetailsModal({ open, onOpenChange, vehicleId }: VehicleDetailsModalProps) {
  const { data: vehicle, isLoading } = useVehicle(vehicleId || '', {
    enabled: !!vehicleId && open,
  });

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

  if (!vehicle) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Veículo não encontrado</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const status = statusConfig[vehicle.status];
  const vehicleData = vehicle as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl">
                {vehicle.brand} {vehicle.model}{vehicleData.version ? ` ${vehicleData.version}` : ''}
              </DialogTitle>
              <DialogDescription className="text-base mt-1">
                {vehicle.year} • {vehicle.plate || 'Sem placa'}
              </DialogDescription>
            </div>
            <Badge className={cn('font-medium text-sm', status.className)}>
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50">
            <TabsTrigger value="details" className="data-[state=active]:bg-background">Detalhes</TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:bg-background">Despesas</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-4">
          {/* Imagens */}
          {vehicle.images && vehicle.images.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Fotos do Veículo</h3>
              <div className="grid grid-cols-4 gap-2">
                {vehicle.images.map((img, index) => {
                  const imageUrl = toPublicImageUrl(img.url);
                  return imageUrl ? (
                    <div key={index} className="aspect-video rounded-lg overflow-hidden bg-muted">
                      <img
                        src={imageUrl}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Informações Básicas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Marca</p>
                <p className="font-medium">{vehicle.brand}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Modelo</p>
                <p className="font-medium">{vehicle.model}</p>
              </div>
              {vehicleData.version && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Versão</p>
                  <p className="font-medium">{vehicleData.version}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Ano</p>
                <p className="font-medium">{vehicle.year}</p>
              </div>
              {vehicleData.km && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    Quilometragem
                  </p>
                  <p className="font-medium">{vehicleData.km.toLocaleString('pt-BR')} km</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Fuel className="w-3 h-3" />
                  Combustível
                </p>
                <p className="font-medium">{vehicle.fuel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Palette className="w-3 h-3" />
                  Cor
                </p>
                <div className="flex items-center gap-2">
                  {(() => {
                    if (!vehicle.color) return null;
                    
                    const colorData = VEHICLE_COLORS.find(
                      (c) => c.value.toLowerCase() === vehicle.color.toLowerCase()
                    );
                    
                    let colorHex = colorData?.hex || '#808080';
                    
                    // Se for um hex válido, usar diretamente
                    if (!colorData && /^#[0-9A-F]{6}$/i.test(vehicle.color)) {
                      colorHex = vehicle.color;
                    }
                    
                    return (
                      <div 
                        className="w-4 h-4 rounded-full border border-border flex-shrink-0" 
                        style={{ backgroundColor: colorHex }} 
                      />
                    );
                  })()}
                  <p className="font-medium">{vehicle.color}</p>
                </div>
              </div>
              {vehicleData.transmission && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Transmissão</p>
                  <p className="font-medium">{vehicleData.transmission}</p>
                </div>
              )}
              {vehicleData.steering && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Direção</p>
                  <p className="font-medium">{vehicleData.steering}</p>
                </div>
              )}
              {vehicleData.origin && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="font-medium">
                    {originConfig[vehicleData.origin as keyof typeof originConfig] ||
                      vehicleData.origin}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Preços */}
          {(vehicle.purchasePrice || vehicle.salePrice) && (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Valores
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {vehicle.purchasePrice && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Preço de Compra</p>
                      <p className="font-semibold text-lg">
                        R$ {vehicle.purchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {vehicle.salePrice && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Preço de Venda</p>
                      <p className="font-semibold text-lg text-success">
                        R$ {vehicle.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {vehicle.profit !== undefined && vehicle.profitPercent !== undefined && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className="font-semibold text-lg text-success">
                        +R$ {vehicle.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <span className="text-sm ml-1">({vehicle.profitPercent.toFixed(1)}%)</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Dados de Consignado */}
          {vehicleData.origin === 'consignment' &&
            (vehicleData.consignmentOwnerName ||
              vehicleData.consignmentOwnerPhone ||
              vehicleData.consignmentCommissionType) && (
              <>
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Dados do Consignante
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vehicleData.consignmentOwnerName && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Nome do Proprietário</p>
                        <p className="font-medium">{vehicleData.consignmentOwnerName}</p>
                      </div>
                    )}
                    {vehicleData.consignmentOwnerPhone && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="font-medium">{vehicleData.consignmentOwnerPhone}</p>
                      </div>
                    )}
                    {vehicleData.consignmentCommissionType && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Tipo de Comissão</p>
                        <p className="font-medium">
                          {vehicleData.consignmentCommissionType === 'percentual'
                            ? 'Percentual'
                            : 'Valor Fixo'}
                        </p>
                      </div>
                    )}
                    {vehicleData.consignmentCommissionValue && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Valor da Comissão</p>
                        <p className="font-medium">
                          {vehicleData.consignmentCommissionType === 'percentual'
                            ? `${vehicleData.consignmentCommissionValue}%`
                            : `R$ ${vehicleData.consignmentCommissionValue.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                              })}`}
                        </p>
                      </div>
                    )}
                    {vehicleData.consignmentMinRepassValue && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Valor Mínimo de Repasse</p>
                        <p className="font-medium">
                          R${' '}
                          {vehicleData.consignmentMinRepassValue.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    )}
                    {vehicleData.consignmentStartDate && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Data de Início
                        </p>
                        <p className="font-medium">
                          {format(
                            new Date(vehicleData.consignmentStartDate),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

          {/* Opcionais e Acessórios */}
          {vehicleData.features && vehicleData.features.length > 0 && (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Opcionais e Acessórios</h3>
                <div className="flex flex-wrap gap-2">
                  {vehicleData.features.map((feature: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Observações */}
          {vehicle.description && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Observações
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {vehicle.description}
              </p>
            </div>
          )}

          {/* Informações do Sistema */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <p>Cadastrado em</p>
              <p className="font-medium text-foreground">
                {format(new Date((vehicle as any).createdAt), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
            </div>
            {vehicleData.daysInStock !== undefined && (
              <div>
                <p>Dias em estoque</p>
                <p className="font-medium text-foreground">{vehicleData.daysInStock} dias</p>
              </div>
            )}
          </div>
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            {vehicle?.id && <VehicleExpensesTab vehicleId={vehicle.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
