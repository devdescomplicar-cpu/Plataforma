import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env first (VITE_APP_URL, etc.), then server/.env (pode sobrescrever)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

/** Allowed origins for CORS (comma-separated CORS_ORIGINS or single CORS_ORIGIN). Empty = allow any. */
const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Trust first proxy so req.ip reflects client IP (X-Forwarded-For / X-Real-IP)
app.set('trust proxy', 1);

// CORS: explicit preflight handler so OPTIONS always returns correct headers (proxy/deploy-safe)
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  const allowOrigin =
    corsOrigins.length === 0
      ? origin ?? '*'
      : origin && corsOrigins.includes(origin)
        ? origin
        : null;
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, X-Requested-With'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
import vehiclesRoutes from './routes/vehicles.routes.js';
import vehicleImagesRoutes from './routes/vehicle-images.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import authRoutes from './routes/auth.routes.js';
import salesRoutes from './routes/sales.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import clientsRoutes from './routes/clients.routes.js';
import checklistsRoutes from './routes/checklists.routes.js';
import adminRoutes from './routes/admin.routes.js';
import webhooksReceiveRoutes from './routes/webhooks.receive.routes.js';
import pushRoutes from './routes/push.routes.js';
import fipeRoutes from './routes/fipe.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import collaboratorsRoutes from './routes/collaborators.routes.js';
import publicRoutes from './routes/public.routes.js';
import { startExpirationTriggersJob } from './jobs/expiration-triggers.job.js';
import { ensureAdminUser } from './lib/ensure-admin.js';

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/webhooks', webhooksReceiveRoutes);
app.use('/api/vehicle-images', vehicleImagesRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/fipe', fipeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/collaborators', collaboratorsRoutes);

// Production: API 404 for unhandled /api/*, then static + SPA
if (isProduction) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return notFoundHandler(req, res);
    }
    next();
  });
  const distPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.use(notFoundHandler);
}

app.use(errorHandler);

async function start() {
  await ensureAdminUser();
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : undefined;
  const listenCallback = () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (isProduction) {
      console.log(`🌐 Frontend + /api at http://localhost:${PORT}`);
    }
    startExpirationTriggersJob();
  };
  if (host !== undefined) {
    app.listen(PORT, host, listenCallback);
  } else {
    app.listen(PORT, listenCallback);
  }
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
