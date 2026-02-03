import * as React from "react";
import { cn } from "@/lib/utils";

export interface ImageLazyProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Largura fixa (evita layout shift). Ex: "200" ou "100%" */
  width?: number | string;
  /** Altura fixa (evita layout shift). Ex: 140 ou "140px" */
  height?: number | string;
  /** Aspect ratio para reservar espaço. Ex: "16/9" */
  aspectRatio?: string;
  /** Classe do container (ex: para rounded-lg) */
  containerClassName?: string;
}

/**
 * Imagem com lazy loading, placeholder blur e dimensões fixas para evitar layout shift.
 * Uso: <ImageLazy src={url} alt="..." width={200} height={140} />
 */
const ImageLazy = React.forwardRef<HTMLImageElement, ImageLazyProps>(
  (
    {
      src,
      alt = "",
      width,
      height,
      aspectRatio,
      containerClassName,
      className,
      ...props
    },
    ref
  ) => {
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState(false);

    const style: React.CSSProperties = {
      ...(typeof width !== "undefined" && { width: typeof width === "number" ? `${width}px` : width }),
      ...(typeof height !== "undefined" && { height: typeof height === "number" ? `${height}px` : height }),
      ...(aspectRatio && { aspectRatio }),
    };

    return (
      <span
        className={cn("block overflow-hidden bg-muted", containerClassName)}
        style={{
          width: style.width,
          height: style.height,
          aspectRatio: style.aspectRatio,
          minHeight: aspectRatio && !height ? "80px" : undefined,
        }}
      >
        {error ? (
          <span
            className={cn("flex h-full w-full items-center justify-center text-muted-foreground", className)}
            style={style}
            aria-hidden
          >
            —
          </span>
        ) : (
          <img
            ref={ref}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={cn(
              "object-cover transition-[filter,opacity] duration-300",
              !loaded && "blur-sm opacity-70",
              loaded && "blur-0 opacity-100",
              className
            )}
            style={style}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            {...props}
          />
        )}
      </span>
    );
  }
);

ImageLazy.displayName = "ImageLazy";

export { ImageLazy };
