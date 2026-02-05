import { Suspense, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { PwaInstallProvider } from "@/contexts/PwaInstallContext";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import { PageLoader } from "@/components/PageLoader";
import { getRouterBasename } from "@/lib/app-config";
import { queryClient } from "@/lib/queryClient";
import { queryPersister } from "@/lib/queryPersister";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { useViewportFix } from "@/hooks/useViewportFix";
import {
  Dashboard,
  Veiculos,
  Despesas,
  Vendas,
  Relatorios,
  Configuracoes,
  Clientes,
  Checklist,
  Perfil,
  Colaboradores,
  Login,
  ResetPassword,
  NotFound,
  AdminDashboard,
  AdminUsuarios,
  AdminPlanos,
  AdminRelatorios,
  AdminSMTP,
  AdminWebhooks,
  AdminAuditoria,
  AdminArmazenamento,
  AdminNotificacoes,
  AdminTemplates,
  AdminClientes,
} from "@/routes/LazyRoutes";

const DASHBOARD_ICONS = ['/car-moto-icon.webp', '/checklist-icon.webp', '/handshake-icon.webp', '/expense-icon.webp'] as const;

const AppContent = () => {
  // Gerencia atualizações automáticas do Service Worker
  useServiceWorkerUpdate();
  // Corrige cálculo do viewport no PWA mobile
  useViewportFix();

  // Pré-carrega ícones do dashboard em cache para exibição instantânea ao navegar
  useEffect(() => {
    const base = getRouterBasename() || '';
    DASHBOARD_ICONS.forEach((path) => {
      const img = new Image();
      img.src = base + path;
    });
  }, []);

  return (
    <>
      <Toaster />
      <Sonner />
      <PWAInstallPrompt />
      <BrowserRouter basename={getRouterBasename()} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/veiculos" element={<Veiculos />} />
              <Route path="/despesas" element={<Despesas />} />
              <Route path="/checklist" element={<Checklist />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/colaboradores" element={<Colaboradores />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>
            <Route element={<RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              <Route path="/admin/clientes" element={<AdminClientes />} />
              <Route path="/admin/planos" element={<AdminPlanos />} />
              <Route path="/admin/relatorios" element={<AdminRelatorios />} />
              <Route path="/admin/notificacoes" element={<AdminNotificacoes />} />
              <Route path="/admin/templates" element={<AdminTemplates />} />
              <Route path="/admin/smtp" element={<AdminSMTP />} />
              <Route path="/admin/webhooks" element={<AdminWebhooks />} />
              <Route path="/admin/auditoria" element={<AdminAuditoria />} />
              <Route path="/admin/armazenamento" element={<AdminArmazenamento />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      maxAge: ONE_DAY_MS,
    }}
  >
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="theme" enableSystem={false}>
      <TooltipProvider>
        <AppProvider>
          <PwaInstallProvider>
            <AppContent />
          </PwaInstallProvider>
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  </PersistQueryClientProvider>
);

export default App;
