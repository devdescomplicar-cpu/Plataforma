import { useState } from "react";
import { usePwaInstall, type PwaPlatform } from "@/hooks/usePwaInstall";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Monitor, Smartphone, Apple } from "lucide-react";

const DESKTOP_STEPS = [
  "Abra o site no **Chrome** ou **Microsoft Edge**.",
  "Na barra de endereço, clique no ícone **Instalar** (➕ ou ícone de computador).",
  "Na janela que abrir, clique em **Instalar** para adicionar o app ao seu computador.",
];

const ANDROID_STEPS = [
  "Abra o site no **Chrome** (navegador do Android).",
  "Toque no menu **⋮** (três pontos) no canto superior direito.",
  "Toque em **Instalar app** ou **Adicionar à tela inicial**.",
  "Confirme em **Instalar** na mensagem exibida.",
];

const IOS_STEPS = [
  "Abra o site no **Safari** (não use Chrome ou outros navegadores).",
  "Toque no botão **Compartilhar** (quadrado com seta para cima) na barra inferior.",
  "Role e toque em **Adicionar à Tela de Início**.",
  "Toque em **Adicionar** no canto superior direito.",
];

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <li key={i} className="leading-relaxed">
          {step.split(/\*\*(.*?)\*\*/g).map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="text-foreground font-medium">{part}</strong> : part,
          )}
        </li>
      ))}
    </ol>
  );
}

const PLATFORM_CONFIG: Record<
  Exclude<PwaPlatform, "unknown">,
  { steps: string[]; label: string; icon: React.ElementType }
> = {
  desktop: { steps: DESKTOP_STEPS, label: "Desktop", icon: Monitor },
  android: { steps: ANDROID_STEPS, label: "Android", icon: Smartphone },
  ios: { steps: IOS_STEPS, label: "iOS", icon: Apple },
};

export function PWAInstallPrompt() {
  const {
    showBanner,
    platform,
    canPrompt,
    install,
    dismiss,
    isInstalling,
  } = usePwaInstall();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!showBanner) return null;

  const effectivePlatform = platform === "unknown" ? "desktop" : platform;
  const config = PLATFORM_CONFIG[effectivePlatform];
  const Icon = config.icon;

  const handleOpenChange = (open: boolean) => {
    if (!open) dismiss(dontShowAgain);
  };

  return (
    <Sheet open={showBanner} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] flex flex-col"
        aria-describedby="pwa-install-description"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="size-5 shrink-0" />
            Instalar DescompliCAR
          </SheetTitle>
          <SheetDescription id="pwa-install-description">
            Use o app como um aplicativo no seu {config.label.toLowerCase()}: acesso rápido, notificações e uso offline.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          <div className="rounded-lg border bg-muted/30 p-4">
            <StepList steps={config.steps} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mt-2">
          <Checkbox
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            aria-label="Não exibir mais este aviso"
          />
          <span>Não exibir mais</span>
        </label>

        <SheetFooter className="flex-row gap-2 sm:gap-2 mt-4 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => dismiss(dontShowAgain)}
            className="flex-1 sm:flex-initial"
          >
            Agora não
          </Button>
          {canPrompt && (
            <Button
              onClick={install}
              disabled={isInstalling}
              className="flex-1 sm:flex-initial"
            >
              {isInstalling ? "Instalando…" : "Instalar app"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
