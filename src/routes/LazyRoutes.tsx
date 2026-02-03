import { lazy } from "react";

// App (authenticated) pages
export const Dashboard = lazy(() => import("@/pages/Dashboard"));
export const Veiculos = lazy(() => import("@/pages/Veiculos"));
export const Despesas = lazy(() => import("@/pages/Despesas"));
export const Vendas = lazy(() => import("@/pages/Vendas"));
export const Relatorios = lazy(() => import("@/pages/Relatorios"));
export const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
export const Clientes = lazy(() => import("@/pages/Clientes"));
export const Checklist = lazy(() => import("@/pages/Checklist"));
export const Perfil = lazy(() => import("@/pages/Perfil"));

// Auth pages
export const Login = lazy(() => import("@/pages/Login"));
export const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

// Fallback
export const NotFound = lazy(() => import("@/pages/NotFound"));

// Admin pages
export const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
export const AdminUsuarios = lazy(() => import("@/pages/admin/AdminUsuarios"));
export const AdminPlanos = lazy(() => import("@/pages/admin/AdminPlanos"));
export const AdminRelatorios = lazy(() => import("@/pages/admin/AdminRelatorios"));
export const AdminSMTP = lazy(() => import("@/pages/admin/AdminSMTP"));
export const AdminWebhooks = lazy(() => import("@/pages/admin/AdminWebhooks"));
export const AdminAuditoria = lazy(() => import("@/pages/admin/AdminAuditoria"));
export const AdminArmazenamento = lazy(() => import("@/pages/admin/AdminArmazenamento"));
export const AdminNotificacoes = lazy(() => import("@/pages/admin/AdminNotificacoes"));
export const AdminTemplates = lazy(() => import("@/pages/admin/AdminTemplates"));
export const AdminClientes = lazy(() => import("@/pages/admin/AdminClientes"));
