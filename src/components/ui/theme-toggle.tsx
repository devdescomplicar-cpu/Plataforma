import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  iconClassName,
  showTooltip = true,
}: {
  className?: string;
  iconClassName?: string;
  showTooltip?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className={cn(className)}
    >
      {!mounted ? (
        <span className={cn("h-5 w-5", iconClassName)} aria-hidden />
      ) : isDark ? (
        <Sun className={cn("h-5 w-5", iconClassName)} />
      ) : (
        <Moon className={cn("h-5 w-5", iconClassName)} />
      )}
    </Button>
  );

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom">
          {isDark ? "Modo claro" : "Modo escuro"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
