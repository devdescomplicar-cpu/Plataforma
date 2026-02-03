import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminMiddleware } from '../middleware/auth.middleware.js';
import * as usersController from '../controllers/admin/users.controller.js';
import * as plansController from '../controllers/admin/plans.controller.js';
import * as reportsController from '../controllers/admin/reports.controller.js';
import * as smtpController from '../controllers/admin/smtp.controller.js';
import * as webhooksController from '../controllers/admin/webhooks.controller.js';
import * as auditController from '../controllers/admin/audit.controller.js';
import * as storageController from '../controllers/admin/storage.controller.js';
import * as notificationsController from '../controllers/admin/notifications.controller.js';
import * as templatesController from '../controllers/admin/templates.controller.js';
import * as clientsController from '../controllers/admin/clients.controller.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// Clients (admin list all clients from all users)
router.get('/clients/stats', clientsController.getClientsStats);
router.get('/clients/export', clientsController.exportClients);
router.get('/clients', clientsController.listClients);

// Users
router.get('/users/stats', usersController.getUsersStats);
router.get('/users', usersController.listUsers);
router.post('/users', usersController.createUser);
router.get('/users/:id', usersController.getUserById);
router.put('/users/:id', usersController.updateUser);
router.delete('/users/:id', usersController.deleteUserPermanently);
router.put('/accounts/:accountId/trial', usersController.updateAccountTrial);
router.put('/accounts/:accountId/plan', usersController.changeAccountPlan);

// Plans (batch route before :id)
router.get('/plans/stats', plansController.getPlansStats);
router.get('/plans', plansController.listPlans);
router.post('/plans/batch', plansController.createPlansBatch);
router.get('/plans/:id', plansController.getPlanById);
router.post('/plans', plansController.createPlan);
router.put('/plans/:id', plansController.updatePlan);
router.delete('/plans/:id', plansController.softDeletePlan);

// Reports
router.get('/reports/general', reportsController.getGeneralReport);
router.get('/reports/financial', reportsController.getFinancialReport);
router.get('/reports/users', reportsController.getUsersReport);
router.get('/reports/subscriptions', reportsController.getSubscriptionsReport);
router.get('/reports/platform-usage', reportsController.getPlatformUsageReport);

// SMTP
router.get('/smtp', smtpController.getSmtpConfig);
router.get('/smtp/logs', smtpController.listEmailLogs);
router.put('/smtp', smtpController.upsertSmtpConfig);
router.post('/smtp/test', smtpController.testSmtpConfig);

// Webhooks (base idêntica à outra plataforma) – rotas mais específicas primeiro
router.get('/webhooks', webhooksController.listWebhooks);
router.get('/webhooks/logs', webhooksController.listAllWebhookLogs);
router.get('/webhooks/:id/logs', webhooksController.getWebhookLogs);
router.post('/webhooks/:id/test', webhooksController.testWebhook);
router.post('/webhooks/:id/reprocess', webhooksController.reprocessWebhook);
router.post('/webhooks/:id/activate', webhooksController.activateWebhook);
router.post('/webhooks/:id/deactivate', webhooksController.deactivateWebhook);
router.get('/webhooks/:id', webhooksController.getWebhookById);
router.post('/webhooks', webhooksController.createWebhook);
router.patch('/webhooks/:id', webhooksController.updateWebhook);
router.delete('/webhooks/:id', webhooksController.softDeleteWebhook);

// Audit
router.get('/audit', auditController.listAuditLogs);

// Storage
router.get('/storage', storageController.getStorageStats);
router.get('/storage/growth', storageController.getStorageGrowth);
router.get('/storage/zombies', storageController.getZombieFiles);
router.post('/storage/clean-zombies', storageController.cleanZombieFiles);
router.get('/storage/top-consumers', storageController.getTopConsumers);
router.get('/storage/cleanup-history', storageController.getCleanupHistory);
router.get('/storage/quality', storageController.getFileQuality);
router.get('/storage/alerts', storageController.getStorageAlerts);
router.post('/storage/clean-obsolete', storageController.cleanObsoleteStorage);

// Notifications (push to PWA)
router.get('/notifications/log', notificationsController.listLog);
router.post('/notifications/send', notificationsController.sendNotification);

// Templates (message templates for triggers)
router.get('/templates', templatesController.listTemplates);
router.get('/templates/usage', templatesController.listTemplateUsageLog);
router.post('/templates', templatesController.createTemplate);
router.get('/templates/:id', templatesController.getTemplateById);
router.put('/templates/:id', templatesController.updateTemplate);
router.delete('/templates/:id', templatesController.softDeleteTemplate);
router.post('/templates/:id/test', templatesController.testTemplate);

export default router;
