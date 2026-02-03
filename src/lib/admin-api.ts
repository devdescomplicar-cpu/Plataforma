import { apiClient } from '@/lib/api';

const BASE = '/admin';

export const adminApi = {
  clients: {
    stats: () => apiClient.get<ClientsStats>(`${BASE}/clients/stats`),
    list: (params?: { userId?: string; state?: string; search?: string; page?: number; limit?: number }) =>
      apiClient.get<AdminClient[]>(`${BASE}/clients`, params as Record<string, string | number | undefined>),
    export: (params?: { ids?: string[]; userId?: string; state?: string; search?: string }) => {
      const q: Record<string, string> = {};
      if (params?.ids?.length) q.ids = params.ids.join(',');
      if (params?.userId) q.userId = params.userId;
      if (params?.state) q.state = params.state;
      if (params?.search) q.search = params.search;
      return apiClient.get<AdminClient[]>(`${BASE}/clients/export`, q);
    },
  },
  users: {
    stats: () => apiClient.get<UsersStats>(`${BASE}/users/stats`),
    list: (params?: { search?: string; page?: number; limit?: number }) =>
      apiClient.get<AdminUser[]>(`${BASE}/users`, params as Record<string, string | number | undefined>),
    getById: (id: string) => apiClient.get<AdminUserDetail>(`${BASE}/users/${id}`),
    create: (body: { name: string; email: string; password: string; phone?: string | null; cpfCnpj?: string | null; role?: string; accountName?: string; trialEndsAt?: string | null; status?: string }) =>
      apiClient.post<AdminUserDetail>(`${BASE}/users`, body),
    update: (id: string, body: { name?: string; email?: string; phone?: string | null; cpfCnpj?: string | null; role?: string; accountName?: string; trialEndsAt?: string | null; status?: string }) =>
      apiClient.put<AdminUserDetail>(`${BASE}/users/${id}`, body),
    delete: (id: string) =>
      apiClient.delete<{ data: { message: string } }>(`${BASE}/users/${id}`),
    updateTrial: (accountId: string, trialEndsAt: string | null) =>
      apiClient.put<{ data: { trialEndsAt: string | null } }>(`${BASE}/accounts/${accountId}/trial`, { trialEndsAt }),
    changePlan: (accountId: string, planId: string, endDate?: string | null) =>
      apiClient.put<{ data: { planId: string; planName: string } }>(`${BASE}/accounts/${accountId}/plan`, { planId, endDate }),
  },
  plans: {
    list: (params?: { includeInactive?: string }) => 
      apiClient.get<AdminPlan[]>(`${BASE}/plans`, params as Record<string, string | undefined>),
    getById: (id: string) => apiClient.get<AdminPlan>(`${BASE}/plans/${id}`),
    create: (body: PlanCreateBody) => apiClient.post<AdminPlan>(`${BASE}/plans`, body),
    createBatch: (body: PlanCreateBatchBody) =>
      apiClient.post<AdminPlan[]>(`${BASE}/plans/batch`, body),
    update: (id: string, body: Partial<PlanUpdateBody>) =>
      apiClient.put<AdminPlan>(`${BASE}/plans/${id}`, body),
    delete: (id: string) => apiClient.delete<{ message: string }>(`${BASE}/plans/${id}`),
    stats: () => apiClient.get<PlansStats>(`${BASE}/plans/stats`),
  },
  reports: {
    general: () => apiClient.get<GeneralReport>(`${BASE}/reports/general`),
    financial: (params?: { period?: string; startDate?: string; endDate?: string }) =>
      apiClient.get<FinancialReport>(`${BASE}/reports/financial`, params as Record<string, string | undefined>),
    users: (params?: { period?: string; startDate?: string; endDate?: string }) =>
      apiClient.get<UsersReport>(`${BASE}/reports/users`, params as Record<string, string | undefined>),
    subscriptions: (params?: { period?: string; startDate?: string; endDate?: string }) =>
      apiClient.get<SubscriptionsReport>(`${BASE}/reports/subscriptions`, params as Record<string, string | undefined>),
    platformUsage: (params?: { period?: string; startDate?: string; endDate?: string }) =>
      apiClient.get<PlatformUsageReport>(`${BASE}/reports/platform-usage`, params as Record<string, string | undefined>),
  },
  smtp: {
    get: () => apiClient.get<SmtpConfig | null>(`${BASE}/smtp`),
    getLogs: (params?: { limit?: number; offset?: number }) =>
      apiClient.get<EmailLogEntry[]>(`${BASE}/smtp/logs`, params as Record<string, number | undefined>),
    upsert: (body: { host: string; port?: number; secure?: boolean; user?: string; password?: string; fromEmail: string; fromName?: string; active?: boolean }) =>
      apiClient.put<SmtpConfig>(`${BASE}/smtp`, body),
    test: (email: string) =>
      apiClient.post<{ message: string }>(`${BASE}/smtp/test`, { email }),
  },
  webhooks: {
    list: (params?: { userId?: string }) =>
      apiClient.get<WebhookItem[]>(`${BASE}/webhooks`, params as Record<string, string | undefined>),
    getById: (id: string) => apiClient.get<WebhookItem>(`${BASE}/webhooks/${id}`),
    create: (body: WebhookCreateBody) => apiClient.post<WebhookItem>(`${BASE}/webhooks`, body),
    update: (id: string, body: Partial<WebhookCreateBody>) =>
      apiClient.patch<WebhookItem>(`${BASE}/webhooks/${id}`, body),
    delete: (id: string) => apiClient.delete<{ message: string }>(`${BASE}/webhooks/${id}`),
    getLogs: (id: string, limit?: number) =>
      apiClient.get<WebhookLogEntry[]>(`${BASE}/webhooks/${id}/logs`, limit != null ? { limit } : undefined),
    getAllLogs: (params?: { limit?: number; offset?: number }) =>
      apiClient.get<WebhookLogEntry[]>(`${BASE}/webhooks/logs`, params as Record<string, number | undefined>),
    test: (id: string, payload: Record<string, unknown>) =>
      apiClient.post<WebhookTestResponse>(`${BASE}/webhooks/${id}/test`, payload),
    reprocess: (id: string) =>
      apiClient.post<{ success: boolean; data?: unknown; error?: { message: string } }>(`${BASE}/webhooks/${id}/reprocess`, {}),
    activate: (id: string) => apiClient.post<{ success: boolean; message: string; webhook: WebhookItem }>(`${BASE}/webhooks/${id}/activate`, {}),
    deactivate: (id: string) => apiClient.post<{ success: boolean; message: string; webhook: WebhookItem }>(`${BASE}/webhooks/${id}/deactivate`, {}),
  },
  audit: {
    list: (params?: { userId?: string; entity?: string; action?: string; userRole?: string; page?: number; limit?: number }) =>
      apiClient.get<AuditLogEntry[]>(`${BASE}/audit`, params as Record<string, string | number | undefined>),
  },
  storage: {
    stats: () => apiClient.get<StorageStats>(`${BASE}/storage`),
    growth: (params?: { granularity?: 'day' | 'week' | 'month'; limit?: number }) =>
      apiClient.get<StorageGrowthPoint[]>(`${BASE}/storage/growth`, params as Record<string, string | number | undefined>),
    zombies: () => apiClient.get<StorageZombies>(`${BASE}/storage/zombies`),
    cleanZombies: (days: 90 | 180 | 360) =>
      apiClient.post<{ deletedCount: number; bytesFreed: number; message: string }>(
        `${BASE}/storage/clean-zombies`,
        { days }
      ),
    topConsumers: () => apiClient.get<StorageTopConsumer[]>(`${BASE}/storage/top-consumers`),
    cleanupHistory: (params?: { limit?: number }) =>
      apiClient.get<StorageCleanupEntry[]>(`${BASE}/storage/cleanup-history`, params as Record<string, number | undefined>),
    quality: () => apiClient.get<StorageQuality>(`${BASE}/storage/quality`),
    alerts: () => apiClient.get<StorageAlert[]>(`${BASE}/storage/alerts`),
    cleanObsolete: () =>
      apiClient.post<{ deletedCount: number; failedCount?: number; bytesFreed?: number; message: string }>(
        `${BASE}/storage/clean-obsolete`
      ),
  },
  notifications: {
    log: (params?: { limit?: number }) =>
      apiClient.get<PushNotificationLogEntry[]>(`${BASE}/notifications/log`, params as Record<string, number | undefined>),
    send: (body: { title: string; body: string; targetFilter: 'all' | 'active' | 'vencido' }) =>
      apiClient.post<{ sent: number; total: number; targetFilter: string }>(`${BASE}/notifications/send`, body),
  },
  templates: {
    list: (params?: { trigger?: string; channel?: string }) =>
      apiClient.get<NotificationTemplateEntry[]>(`${BASE}/templates`, params as Record<string, string | undefined>),
    getUsageLog: (params?: { limit?: number; offset?: number }) =>
      apiClient.get<TemplateUsageLogEntry[]>(`${BASE}/templates/usage`, params as Record<string, number | undefined>),
    getById: (id: string) => apiClient.get<NotificationTemplateEntry>(`${BASE}/templates/${id}`),
    create: (body: NotificationTemplateCreate) => apiClient.post<NotificationTemplateEntry>(`${BASE}/templates`, body),
    update: (id: string, body: NotificationTemplateUpdate) =>
      apiClient.put<NotificationTemplateEntry>(`${BASE}/templates/${id}`, body),
    delete: (id: string) => apiClient.delete<{ id: string }>(`${BASE}/templates/${id}`),
    test: (id: string, userId: string) =>
      apiClient.post<{ message: string }>(`${BASE}/templates/${id}/test`, { userId }),
  },
};

export interface AdminClient {
  id: string;
  accountId: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string } | null;
  accountName: string;
  vehicleCount: number;
  totalSpent: number;
  lastPurchaseDate: string | null;
  status: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  cpfCnpj?: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    name: string;
    status: string;
    trialEndsAt: string | null;
    createdAt: string;
    subscription: {
      id: string;
      status: string;
      startDate: string;
      endDate: string | null;
      plan: {
        id: string;
        name: string;
        price: number;
        durationType?: string;
        durationMonths?: number;
      };
    } | null;
  } | null;
}

export interface AdminUserDetail extends AdminUser {}

export interface CustomBenefit {
  text: string;
  positive: boolean;
}

export interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  features: string[];
  maxVehicles: number | null;
  maxClients: number | null;
  maxStorageMb: number | null;
  durationType: string;
  durationMonths: number;
  checkoutUrl: string | null;
  customBenefits: CustomBenefit[] | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  subscribersCount?: number;
}

export type PlanDurationType = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface PlanOffer {
  durationType: PlanDurationType;
  durationMonths: number;
  price: number;
}

export interface PlanCreateBody {
  name: string;
  description?: string;
  price: number;
  features?: string[];
  maxVehicles?: number | null;
  maxStorageMb?: number | null;
  durationType?: string;
  durationMonths?: number;
  active?: boolean;
}

export interface PlanCreateBatchBody {
  name: string;
  description?: string;
  features?: string[];
  maxVehicles?: number | null;
  maxClients?: number | null;
  maxStorageMb?: number | null;
  checkoutUrl?: string | null;
  customBenefits?: CustomBenefit[] | null;
  active?: boolean;
  offers: PlanOffer[];
}

export type PlanUpdateBody = Partial<
  Omit<AdminPlan, 'id' | 'createdAt' | 'updatedAt' | 'subscribersCount'>
>;

export interface GeneralReport {
  totalUsers: number;
  totalAccounts: number;
  totalVehicles: number;
  totalSales: number;
  totalClients: number;
  usersByRole: Record<string, number>;
  accountsByStatus: Record<string, number>;
  generatedAt: string;
}

export interface FinancialReport {
  totalRevenue: number;
  mrr: number;
  arpu: number;
  ltv: number; // Média de meses que usuários ficam ativos
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  churnRate: number;
  revenueOverTime: { date: string; value: number }[];
  mrrOverTime: { date: string; value: number }[];
  revenueByPlan: { planName: string; revenue: number }[];
  ltvByPlan: { planName: string; ltv: number }[]; // LTV em meses por plano
}

export interface UsersReport {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsers: number;
  newUsersOverTime: { date: string; value: number }[];
  usersByPlan: { planName: string; count: number }[];
  usersByStatus: { status: string; count: number }[];
  topUserBySales: {
    userId: string;
    userName: string;
    userEmail: string;
    salesCount: number;
  } | null;
  topUserByVehicles: {
    userId: string;
    userName: string;
    userEmail: string;
    vehiclesCount: number;
  } | null;
  oldestActiveUser: {
    userId: string;
    userName: string;
    userEmail: string;
    daysActive: number;
    createdAt: string;
  } | null;
}

export interface SubscriptionsReport {
  activeSubscriptions: number;
  newSubscriptions: number;
  cancellations: number;
  subscriptionsOverTime: { date: string; active: number; cancelled: number }[];
  churnOverTime: { date: string; churnRate: number }[];
  subscriptionsByPlan: { planName: string; count: number }[];
}

export interface PlatformUsageReport {
  vehiclesCreated: number;
  salesCreated: number;
  expensesCreated: number;
  checklistsCompleted: number;
  dailyActivity: { date: string; vehicles: number; sales: number; expenses: number; checklists: number }[];
  topActiveUsers: { userId: string; userName: string; userEmail: string; activityCount: number }[];
}

export interface UsersStats {
  totalUsers: number;
  activeUsers: number;
  expiringIn7Days: number;
  topUserBySales: {
    id: string;
    name: string;
    email: string;
    salesCount: number;
  } | null;
}

export interface ClientsStats {
  totalClients: number;
  topClientByPurchases: {
    id: string;
    name: string;
    purchaseCount: number;
  } | null;
  topClientBySpent: {
    id: string;
    name: string;
    totalSpent: number;
  } | null;
}

export interface PlansStats {
  activeSubscriptions: number;
  mrr: number;
  topPlanBySales: {
    id: string;
    name: string;
    subscriptionsCount: number;
  } | null;
  topPlanByRevenue: {
    id: string;
    name: string;
    totalRevenue: number;
  } | null;
}

export interface SmtpConfig {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  fromEmail: string;
  fromName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookFieldMapping {
  webhookField: string;
  systemField: string;
  label: string;
  prefix?: string;
  suffix?: string;
}

export interface WebhookAction {
  type: 'create_member' | 'update_member' | 'send_email' | 'add_to_group' | 'remove_from_group';
  conditions?: { field: string; operator: string; value: unknown }[];
  config: { telegramGroupId?: string; emailTemplateId?: string; memberStatus?: string; productId?: string };
}

export interface WebhookItem {
  id: string;
  name: string;
  url: string;
  serverUrl: string;
  fieldMappings: WebhookFieldMapping[];
  isActive: boolean;
  testMode: boolean;
  lastTestPayload?: Record<string, unknown>;
  actions: WebhookAction[];
  secret?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookCreateBody {
  name: string;
  url?: string;
  fieldMappings?: WebhookFieldMapping[];
  isActive?: boolean;
  testMode?: boolean;
  actions?: WebhookAction[];
}

export interface WebhookLogEntry {
  id: string;
  webhookId: string;
  webhookName: string;
  webhookTestMode?: boolean;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  statusCode: number | null;
  response: Record<string, unknown> | null;
  error: string | null;
  receivedAt: string;
}

export interface WebhookTestResponse {
  success: boolean;
  message: string;
  payload: unknown;
  webhook: { id: string; name: string; fieldMappings: WebhookFieldMapping[] };
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface StorageStats {
  available: boolean;
  bucketName: string;
  totalSizeBytes: number;
  totalSizeMb: number;
  totalSpaceMb: number | null;
  freeSpaceMb: number | null;
  usagePercent: number | null;
  fileCount: number;
  totalImages: number;
  avgFileSizeBytes: number | null;
  largestFileBytes: number | null;
  growth30DaysBytes: number | null;
  growth30DaysMb: number | null;
  generatedAt: string;
}

export interface StorageGrowthPoint {
  period: string;
  totalBytes: number;
  fileCount: number;
}

export interface StorageZombies {
  zombie30: { count: number; bytes: number };
  zombie90: { count: number; bytes: number };
  zombie180: { count: number; bytes: number };
}

export interface StorageTopConsumer {
  accountId: string;
  accountName: string;
  userEmail: string;
  userName: string;
  fileCount: number;
  bytes: number;
}

export interface StorageCleanupEntry {
  id: string;
  cleanedAt: string;
  filesRemoved: number;
  bytesFreed: number;
  triggerType: string;
}

export interface StorageQuality {
  totalImagesWithSize: number;
  percentOver2Mb: number;
  percentNotOptimized: number;
  savingsSuggestionPercent: number;
  message: string | null;
}

export interface StorageAlert {
  type: string;
  severity: 'warning' | 'danger' | 'info';
  message: string;
}

export interface PushNotificationLogEntry {
  id: string;
  title: string;
  body: string;
  targetFilter: string;
  sentCount: number;
  failedCount?: number;
  createdAt: string;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  status: 'success' | 'error';
  errorMessage: string | null;
  origin: string | null;
  templateId: string | null;
  sentAt: string;
}

export interface TemplateUsageLogEntry {
  id: string;
  templateId: string;
  templateName: string;
  trigger: string;
  channel: string;
  recipientInfo: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export type NotificationTemplateTrigger =
  | 'welcome'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'password_recovery'
  | 'non_renewal_warning';
export type NotificationTemplateChannel = 'pwa' | 'email';

export interface NotificationTemplateEntry {
  id: string;
  name: string | null;
  trigger: NotificationTemplateTrigger;
  channel: NotificationTemplateChannel;
  daysOffset: number | null;
  subject: string | null;
  title: string | null;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplateCreate {
  name?: string | null;
  trigger: NotificationTemplateTrigger;
  channel: NotificationTemplateChannel;
  daysOffset?: number | null;
  subject?: string | null;
  title?: string | null;
  body: string;
  active?: boolean;
}

export type NotificationTemplateUpdate = Partial<NotificationTemplateCreate>;
