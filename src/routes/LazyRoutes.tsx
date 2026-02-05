import { lazy } from "react";

// Loaders usados por lazy() — reutilizados para prefetch no hover (navegação instantânea)
const loaders = {
  "/": () => import("@/pages/Dashboard"),
  "/veiculos": () => import("@/pages/Veiculos"),
  "/despesas": () => import("@/pages/Despesas"),
  "/vendas": () => import("@/pages/Vendas"),
  "/relatorios": () => import("@/pages/Relatorios"),
  "/configuracoes": () => import("@/pages/Configuracoes"),
  "/clientes": () => import("@/pages/Clientes"),
  "/checklist": () => import("@/pages/Checklist"),
  "/perfil": () => import("@/pages/Perfil"),
  "/colaboradores": () => import("@/pages/Colaboradores"),
  "/admin": () => import("@/pages/admin/AdminDashboard"),
  "/admin/usuarios": () => import("@/pages/admin/AdminUsuarios"),
  "/admin/clientes": () => import("@/pages/admin/AdminClientes"),
  "/admin/planos": () => import("@/pages/admin/AdminPlanos"),
  "/admin/relatorios": () => import("@/pages/admin/AdminRelatorios"),
  "/admin/notificacoes": () => import("@/pages/admin/AdminNotificacoes"),
  "/admin/templates": () => import("@/pages/admin/AdminTemplates"),
  "/admin/smtp": () => import("@/pages/admin/AdminSMTP"),
  "/admin/webhooks": () => import("@/pages/admin/AdminWebhooks"),
  "/admin/auditoria": () => import("@/pages/admin/AdminAuditoria"),
  "/admin/armazenamento": () => import("@/pages/admin/AdminArmazenamento"),
} as const;

/** Prefetch do chunk da rota no hover/focus para navegação instantânea. */
export function prefetchRoute(path: string): void {
  const load = loaders[path as keyof typeof loaders];
  if (load) void load();
}

// App (authenticated) pages
export const Dashboard = lazy(loaders["/"]);
export const Veiculos = lazy(loaders["/veiculos"]);
export const Despesas = lazy(loaders["/despesas"]);
export const Vendas = lazy(loaders["/vendas"]);
export const Relatorios = lazy(loaders["/relatorios"]);
export const Configuracoes = lazy(loaders["/configuracoes"]);
export const Clientes = lazy(loaders["/clientes"]);
export const Checklist = lazy(loaders["/checklist"]);
export const Perfil = lazy(loaders["/perfil"]);
export const Colaboradores = lazy(loaders["/colaboradores"]);

// Auth pages
export const Login = lazy(() => import("@/pages/Login"));
export const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

// Fallback
export const NotFound = lazy(() => import("@/pages/NotFound"));

// Admin pages
export const AdminDashboard = lazy(loaders["/admin"]);
export const AdminUsuarios = lazy(loaders["/admin/usuarios"]);
export const AdminPlanos = lazy(loaders["/admin/planos"]);
export const AdminRelatorios = lazy(loaders["/admin/relatorios"]);
export const AdminSMTP = lazy(loaders["/admin/smtp"]);
export const AdminWebhooks = lazy(loaders["/admin/webhooks"]);
export const AdminAuditoria = lazy(loaders["/admin/auditoria"]);
export const AdminArmazenamento = lazy(loaders["/admin/armazenamento"]);
export const AdminNotificacoes = lazy(loaders["/admin/notificacoes"]);
export const AdminTemplates = lazy(loaders["/admin/templates"]);
export const AdminClientes = lazy(loaders["/admin/clientes"]);
