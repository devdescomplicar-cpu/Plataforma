import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toPublicImageUrl } from '@/lib/utils';

interface ImageGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: Array<{ id?: string; url: string; key?: string; order?: number }>;
  initialIndex?: number;
}

export function ImageGalleryModal({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Resetar índice quando o modal abrir ou as imagens mudarem
  useEffect(() => {
    if (open && images.length > 0) {
      const safeIndex = Math.min(Math.max(0, initialIndex), images.length - 1);
      setCurrentIndex(safeIndex);
    }
  }, [open, images, initialIndex]);

  // Atualizar índice quando as imagens mudarem (ex: após adicionar novas)
  useEffect(() => {
    if (open && images.length > 0) {
      if (currentIndex >= images.length) {
        setCurrentIndex(images.length - 1);
      }
    }
  }, [images.length, currentIndex, open]);


  // Navegação com teclado
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, images.length, onOpenChange]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  if (images.length === 0) return null;

  // Garantir que o índice está dentro dos limites
  const safeIndex = Math.min(Math.max(0, currentIndex), images.length - 1);
  const currentImage = images[safeIndex];
  const imageUrl = toPublicImageUrl(currentImage?.url) || currentImage?.url;

  if (!currentImage || !imageUrl) {
    console.error('[ImageGalleryModal] Invalid image at index:', safeIndex, 'Total images:', images.length);
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] sm:w-[90vw] h-[70vh] sm:h-[90vh] p-0 bg-white border border-border overflow-hidden">
        <DialogHeader className="absolute w-px h-px overflow-hidden -m-px" style={{ clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
          <DialogTitle>Galeria de Imagens do Veículo</DialogTitle>
          <DialogDescription>
            Visualize todas as imagens do veículo. Use as setas ou teclado para navegar.
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full h-full flex flex-col bg-white overflow-hidden">
          {/* Header com contador e botão fechar - FIXO NO TOPO */}
          <div className="flex-shrink-0 flex items-center justify-between p-1.5 sm:p-4 bg-white border-b border-border z-50">
            <div className="bg-muted rounded-lg px-2 py-0.5 sm:px-4 sm:py-2">
              <p className="text-foreground text-xs sm:text-sm font-semibold">
                {currentIndex + 1} / {images.length}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg hover:bg-muted"
            >
              <X className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </Button>
          </div>

          {/* Área central para imagem - FLEXÍVEL COM CONTROLES FIXOS */}
          <div className="flex-1 relative bg-muted/30 overflow-hidden">
            {/* Botões de navegação - FIXOS NAS LATERAIS (sempre no mesmo lugar) */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevious}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white hover:bg-muted border border-border h-10 w-10 sm:h-12 sm:w-12 rounded-lg z-50 transition-all hover:scale-110 shadow-md"
                  style={{ 
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white hover:bg-muted border border-border h-10 w-10 sm:h-12 sm:w-12 rounded-lg z-50 transition-all hover:scale-110 shadow-md"
                  style={{ 
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </>
            )}

            {/* Container da imagem com padding inteligente - responsivo */}
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{ 
                paddingLeft: images.length > 1 ? '56px' : '12px',
                paddingRight: images.length > 1 ? '56px' : '12px',
                paddingTop: '4px',
                paddingBottom: images.length > 1 ? '56px' : '4px'
              }}
            >
              <img
                src={imageUrl}
                alt={`Imagem ${currentIndex + 1}`}
                className="w-auto h-auto object-contain rounded-lg shadow-lg"
                style={{ 
                  maxHeight: '100%',
                  maxWidth: '100%',
                  width: 'auto',
                  height: 'auto'
                }}
                onError={(e) => {
                  console.error('Erro ao carregar imagem:', imageUrl);
                }}
              />
            </div>
          </div>

          {/* Miniaturas na parte inferior - FIXAS */}
          {images.length > 1 && (
            <div className="flex-shrink-0 pb-1.5 pt-1.5 sm:pb-4 sm:pt-4 bg-white border-t border-border z-50">
              <div className="flex justify-center">
                <div className="flex gap-1.5 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 bg-muted/50 rounded-lg border border-border max-w-[90vw] sm:max-w-[85vw] overflow-x-auto scrollbar-thin">
                  {images.map((img, index) => {
                    const thumbUrl = toPublicImageUrl(img.url) || img.url;
                    return (
                      <button
                        key={img.id || `${img.url}-${index}`}
                        onClick={() => setCurrentIndex(index)}
                        className={cn(
                          "flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 bg-white",
                          currentIndex === index
                            ? "border-primary scale-110 shadow-md ring-2 ring-primary/20"
                            : "border-border opacity-70 hover:opacity-100 hover:scale-105 hover:border-primary/50"
                        )}
                      >
                        <img
                          src={thumbUrl}
                          alt={`Miniatura ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Erro ao carregar miniatura:', thumbUrl);
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
