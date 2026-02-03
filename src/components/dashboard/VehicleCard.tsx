import React, { useState, useMemo } from "react";
import { Car, MoreVertical, Clock, TrendingUp, Calendar, Fuel, Eye, Pencil, Trash2, Wrench, DollarSign, RotateCcw, Gauge, Tag, TrendingDown, Award, ArrowUpRight } from 'lucide-react';
import { HiddenValue } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn, toPublicImageUrl } from '@/lib/utils';
import { VEHICLE_COLORS } from '@/components/ui/ColorSelect';
import { ImageGalleryModal } from '@/components/modals/ImageGalleryModal';

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  version?: string;
  year: number;
  plate?: string;
  km?: number;
  purchasePrice?: number;
  salePrice?: number;
  fipePrice?: number;
  profit?: number;
  profitPercent?: number;
  daysInStock: number;
  fuel: string;
  color: string;
  image?: string;
  status: 'available' | 'reserved' | 'sold';
  totalExpenses?: number;
  images?: Array<{
    id: string;
    url: string;
    key: string;
    order: number;
  }>;
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddExpense?: (id: string) => void;
  onMarkAsSold?: (id: string) => void;
  onReturnToStock?: (id: string) => void;
}

function VehicleCardInner({
  vehicle,
  onEdit,
  onView,
  onDelete,
  onAddExpense,
  onMarkAsSold,
  onReturnToStock,
}: VehicleCardProps) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  const statusConfig = {
    available: { label: 'Em estoque', className: 'bg-info text-white' },
    reserved: { label: 'Reservado', className: 'bg-warning-soft text-warning' },
    sold: { label: 'Vendido', className: 'bg-green-600 text-white' },
  };

  const status = statusConfig[vehicle.status];
  const imageUrl = toPublicImageUrl(vehicle.image);
  
  // Preparar imagens para o lightbox - sempre usar as imagens mais recentes
  const galleryImages = useMemo(() => {
    // Priorizar vehicle.images se existir e tiver itens
    if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
      return [...vehicle.images].sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    // Fallback para vehicle.image se não houver array de imagens
    if (vehicle.image) {
      return [{ id: 'main', url: vehicle.image, key: '', order: 0 }];
    }
    return [];
  }, [vehicle.images, vehicle.image]);

  return (
    <div className="card-interactive overflow-hidden group">
      {/* Image */}
      <div 
        className="relative h-40 bg-muted overflow-hidden cursor-pointer"
        onClick={() => {
          if (galleryImages.length > 0) {
            setIsGalleryOpen(true);
          }
        }}
      >
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={`${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="w-16 h-16 text-muted-foreground/50" />
          </div>
        )}
        <Badge className={cn("absolute top-3 left-3 pointer-events-none", status.className)}>
          {status.label}
        </Badge>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute top-3 right-3 h-8 w-8 bg-card/90 hover:bg-card shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border border-border">
            <DropdownMenuItem 
              className="gap-2"
              onClick={() => onView?.(vehicle.id)}
            >
              <Eye className="w-4 h-4" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-2"
              onClick={() => onEdit?.(vehicle.id)}
            >
              <Pencil className="w-4 h-4" />
              Editar
            </DropdownMenuItem>
            {onAddExpense && (
              <DropdownMenuItem 
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={() => onAddExpense(vehicle.id)}
              >
                <Wrench className="w-4 h-4" />
                <span className="font-medium">Adicionar Despesa</span>
              </DropdownMenuItem>
            )}
            {vehicle.status !== 'sold' && onMarkAsSold ? (
              <DropdownMenuItem 
                className="gap-2 text-success focus:text-success focus:bg-success/10"
                onClick={() => onMarkAsSold(vehicle.id)}
              >
                <DollarSign className="w-4 h-4" />
                <span className="font-medium">Marcar como Vendido</span>
              </DropdownMenuItem>
            ) : vehicle.status === 'sold' && onReturnToStock ? (
              <DropdownMenuItem 
                className="gap-2 text-info focus:text-info focus:bg-info/10"
                onClick={() => onReturnToStock(vehicle.id)}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="font-medium">Voltar para Estoque</span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="gap-2 text-destructive focus:text-destructive"
              onClick={() => onDelete?.(vehicle.id)}
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="font-bold text-foreground text-lg truncate leading-tight" title={`${vehicle.brand} ${vehicle.model}${vehicle.version ? ` ${vehicle.version}` : ''}`}>
            {vehicle.brand} {vehicle.model}{vehicle.version ? ` ${vehicle.version}` : ''}
          </h3>
          <p className="text-sm text-muted-foreground">
            {vehicle.year} • {vehicle.plate || 'Sem placa'}
          </p>
        </div>

        {/* Details Row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {vehicle.km !== undefined && vehicle.km !== null && (
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" />
              {vehicle.km.toLocaleString('pt-BR')} km
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Fuel className="w-3.5 h-3.5" />
            {vehicle.fuel}
          </span>
          <span className="flex items-center gap-1.5">
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
                  className="w-3 h-3 rounded-full border border-border flex-shrink-0" 
                  style={{ backgroundColor: colorHex }} 
                />
              );
            })()}
            {vehicle.color}
          </span>
        </div>

        {/* Financial Info - Modern Layout */}
        <div className="pt-4 border-t border-border/60">
          {/* Linha divisória visual: Custo vs Resultado */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Coluna Esquerda: CUSTO */}
            <div className="space-y-3 pr-4 border-r border-border/40 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Custo</p>
              
              {/* Preço de Compra */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Preço Compra</p>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {vehicle.purchasePrice ? (
                    <HiddenValue value={vehicle.purchasePrice.toLocaleString('pt-BR')} prefix="R$ " />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </p>
              </div>

              {/* Despesas */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Despesas</p>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {vehicle.totalExpenses !== undefined && vehicle.totalExpenses > 0 ? (
                    <HiddenValue value={vehicle.totalExpenses.toLocaleString('pt-BR')} prefix="R$ " />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </p>
              </div>
            </div>

            {/* Coluna Direita: RESULTADO */}
            <div className="space-y-3 pl-4 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Resultado</p>
              
              {/* Preço de Venda - DESTAQUE */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Preço Venda</p>
                <p className="text-base font-bold text-info leading-tight">
                  {vehicle.salePrice ? (
                    <HiddenValue value={vehicle.salePrice.toLocaleString('pt-BR')} prefix="R$ " />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </p>
              </div>

              {/* Lucro - DESTAQUE PRINCIPAL */}
              {vehicle.profit !== undefined && vehicle.profitPercent !== undefined ? (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Lucro</p>
                  <div className="flex items-baseline justify-center gap-1.5 leading-tight">
                    <p className="text-base font-bold text-success">
                      <HiddenValue value={vehicle.profit.toLocaleString('pt-BR')} prefix="+R$ " />
                    </p>
                    <p className="text-[10px] font-medium text-success">
                      ({vehicle.profitPercent.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Informações Secundárias - Linha inferior */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/40">
            {/* FIPE */}
            <div className="pr-4 border-r border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">FIPE</p>
              <p className="text-xs font-medium text-muted-foreground leading-tight">
                {vehicle.fipePrice ? (
                  <HiddenValue value={vehicle.fipePrice.toLocaleString('pt-BR')} prefix="R$ " />
                ) : (
                  <span>—</span>
                )}
              </p>
            </div>

            {/* Dias em Estoque */}
            <div className="pl-4 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Em Estoque</p>
              <p className={cn(
                "text-xs font-medium leading-tight",
                vehicle.daysInStock > 30 ? "text-amber-600 dark:text-amber-400" : vehicle.daysInStock > 15 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
              )}>
                {vehicle.daysInStock === 1 ? '1 dia' : `${vehicle.daysInStock} dias`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Image Gallery Modal */}
      {galleryImages.length > 0 && (
        <ImageGalleryModal
          key={`gallery-${vehicle.id}-${galleryImages.length}-${galleryImages.map(img => img.id || img.url).join('-')}`}
          open={isGalleryOpen}
          onOpenChange={setIsGalleryOpen}
          images={galleryImages}
          initialIndex={0}
        />
      )}
    </div>
  );
}

export const VehicleCard = React.memo(VehicleCardInner);
