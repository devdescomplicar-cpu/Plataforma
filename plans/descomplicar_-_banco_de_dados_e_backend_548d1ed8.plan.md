---
name: DescompliCAR - Banco de Dados e Backend
overview: Implementar infraestrutura completa de banco de dados (PostgreSQL + Prisma), armazenamento de imagens (MinIO), backend API REST, e remover todos os dados mockados conectando o frontend ao banco de dados real.
todos:
  - id: install-postgres
    content: Instalar PostgreSQL e criar banco de dados descompliCAR
    status: completed
  - id: install-minio
    content: Instalar e configurar MinIO com bucket vehicle-images
    status: completed
  - id: setup-prisma
    content: Configurar Prisma e criar schema completo do banco de dados
    status: completed
  - id: create-migrations
    content: Criar e aplicar migrations iniciais do Prisma
    status: completed
  - id: backend-structure
    content: Criar estrutura base do backend (Express, serviços, middleware)
    status: completed
  - id: minio-service
    content: Implementar serviço MinIO com upload e compressão de imagens
    status: completed
  - id: vehicles-api
    content: Implementar rotas e controllers de Vehicles (CRUD completo)
    status: completed
  - id: api-client
    content: Criar cliente API no frontend e hooks React Query
    status: completed
  - id: remove-mocks
    content: Remover todos os dados mockados e conectar ao backend
    status: completed
  - id: upload-images
    content: Implementar upload de imagens no AddVehicleModal
    status: completed
  - id: other-apis
    content: Implementar APIs de Sales, Expenses, Clients e Checklists
    status: completed
  - id: dashboard-metrics
    content: Conectar métricas do dashboard ao backend
    status: completed
  - id: auth-basic
    content: Implementar autenticação básica (JWT)
    status: completed
  - id: soft-delete
    content: Implementar soft delete em todas as entidades
    status: completed
  - id: calculations
    content: Implementar cálculos automáticos (lucro, dias em estoque)
    status: completed
isProject: false
---

# Plano de Implementação - DescompliCAR

## Objetivo

Transformar o projeto frontend atual (com dados mockados) em uma aplicação full-stack funcional com PostgreSQL, MinIO para armazenamento de imagens, e backend API REST, mantendo os padrões atuais do código.

## Fase 1: Infraestrutura Base

### 1.1 Instalação PostgreSQL

- Instalar PostgreSQL via apt
- Criar banco de dados `descompliCAR`
- Criar usuário e senha
- Configurar variáveis de ambiente (.env)
- Testar conexão

**Arquivos criados:**

- `.env` - Variáveis de ambiente
- `.env.example` - Template de variáveis

### 1.2 Instalação MinIO

- Instalar MinIO via Docker ou binário
- Configurar bucket `vehicle-images`
- Criar credenciais de acesso (Access Key / Secret Key)
- Configurar política de acesso público para leitura
- Testar upload/download

**Arquivos criados:**

- `docker-compose.yml` - Configuração MinIO (opcional)
- `.env` - Credenciais MinIO

### 1.3 Configuração Prisma

- Instalar Prisma CLI e cliente
- Inicializar Prisma no projeto
- Criar schema inicial com todas as tabelas principais
- Configurar conexão com PostgreSQL
- Gerar cliente Prisma

**Arquivos criados:**

- `prisma/schema.prisma` - Schema do banco de dados
- `.env` - DATABASE_URL

**Tabelas principais:**

- `users` - Usuários do sistema
- `accounts` - Contas de clientes (multi-tenant)
- `vehicles` - Veículos cadastrados
- `vehicle_images` - Imagens dos veículos (relacionamento)
- `sales` - Vendas realizadas
- `expenses` - Despesas
- `clients` - Clientes
- `checklists` - Checklists de veículos
- `checklist_items` - Itens do checklist
- `subscriptions` - Assinaturas
- `plans` - Planos disponíveis

## Fase 2: Schema do Banco de Dados

### 2.1 Schema Prisma Completo

Criar schema em `prisma/schema.prisma` com:

**Entidades principais:**

- User (id, email, password, name, role, createdAt, updatedAt, deletedAt)
- Account (id, name, userId, status, trialEndsAt, createdAt, updatedAt, deletedAt)
- Vehicle (id, accountId, brand, model, year, plate, fuel, color, purchasePrice, salePrice, status, description, createdAt, updatedAt, deletedAt)
- VehicleImage (id, vehicleId, url, key, order, createdAt)
- Sale (id, accountId, vehicleId, clientId, salePrice, profit, paymentMethod, saleDate, createdAt, updatedAt, deletedAt)
- Expense (id, accountId, vehicleId, type, value, description, date, status, createdAt, updatedAt, deletedAt)
- Client (id, accountId, name, email, phone, city, createdAt, updatedAt, deletedAt)
- Checklist (id, accountId, vehicleId, status, createdAt, updatedAt, deletedAt)
- ChecklistItem (id, checklistId, name, done, createdAt, updatedAt)

**Relacionamentos:**

- User 1:N Account
- Account 1:N Vehicle
- Account 1:N Sale
- Account 1:N Expense
- Account 1:N Client
- Account 1:N Checklist
- Vehicle 1:N VehicleImage
- Vehicle 1:N Sale
- Vehicle 1:N Expense
- Vehicle 1:N Checklist
- Client 1:N Sale
- Checklist 1:N ChecklistItem

**Índices:**

- Índices em campos de busca frequente (plate, brand, model)
- Índices em foreign keys
- Índices em campos de filtro (status, date)

### 2.2 Migrations

- Criar migration inicial
- Aplicar migration no banco
- Verificar estrutura criada

**Comandos:**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Fase 3: Backend API REST

### 3.1 Estrutura do Backend

Criar estrutura de pastas seguindo padrões do projeto:

```
server/
├── src/
│   ├── routes/
│   │   ├── vehicles.routes.ts
│   │   ├── sales.routes.ts
│   │   ├── expenses.routes.ts
│   │   ├── clients.routes.ts
│   │   ├── checklists.routes.ts
│   │   └── dashboard.routes.ts
│   ├── controllers/
│   │   ├── vehicles.controller.ts
│   │   ├── sales.controller.ts
│   │   ├── expenses.controller.ts
│   │   ├── clients.controller.ts
│   │   ├── checklists.controller.ts
│   │   └── dashboard.controller.ts
│   ├── services/
│   │   ├── minio.service.ts
│   │   └── prisma.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── utils/
│   │   └── validators.ts
│   └── app.ts
├── package.json
└── tsconfig.json
```

### 3.2 Dependências Backend

Instalar dependências necessárias:

- `express` - Framework web
- `@prisma/client` - Cliente Prisma
- `minio` - Cliente MinIO
- `zod` - Validação
- `bcrypt` - Hash de senhas
- `jsonwebtoken` - JWT tokens
- `cors` - CORS
- `dotenv` - Variáveis de ambiente
- `multer` - Upload de arquivos
- `sharp` - Processamento de imagens (compressão)

### 3.3 Serviços Base

**PrismaService** (`server/src/services/prisma.service.ts`):

- Singleton do PrismaClient
- Conexão com banco
- Métodos auxiliares

**MinIOService** (`server/src/services/minio.service.ts`):

- Cliente MinIO configurado
- Método uploadImage (com compressão)
- Método deleteImage
- Método getImageUrl
- Compressão de imagens conforme especificação (Lanczos3, 1071x1428, MozJPEG 60%)

### 3.4 Rotas e Controllers

**Vehicles** (`/api/vehicles`):

- GET `/` - Listar veículos (com filtros e paginação)
- GET `/:id` - Detalhes do veículo
- POST `/` - Criar veículo (com upload de imagens)
- PUT `/:id` - Atualizar veículo
- DELETE `/:id` - Soft delete veículo
- POST `/:id/images` - Adicionar imagem
- DELETE `/:id/images/:imageId` - Remover imagem

**Sales** (`/api/sales`):

- GET `/` - Listar vendas
- GET `/:id` - Detalhes da venda
- POST `/` - Criar venda
- PUT `/:id` - Atualizar venda
- DELETE `/:id` - Soft delete venda

**Expenses** (`/api/expenses`):

- GET `/` - Listar despesas
- GET `/:id` - Detalhes da despesa
- POST `/` - Criar despesa
- PUT `/:id` - Atualizar despesa
- DELETE `/:id` - Soft delete despesa

**Clients** (`/api/clients`):

- GET `/` - Listar clientes
- GET `/:id` - Detalhes do cliente
- POST `/` - Criar cliente
- PUT `/:id` - Atualizar cliente
- DELETE `/:id` - Soft delete cliente

**Checklists** (`/api/checklists`):

- GET `/` - Listar checklists
- GET `/:id` - Detalhes do checklist
- POST `/` - Criar checklist
- PUT `/:id` - Atualizar checklist
- PUT `/:id/items/:itemId` - Atualizar item do checklist
- DELETE `/:id` - Soft delete checklist

**Dashboard** (`/api/dashboard`):

- GET `/metrics` - Métricas do dashboard
- GET `/vehicles` - Veículos em estoque
- GET `/stats` - Estatísticas gerais

### 3.5 Validação com Zod

Criar schemas de validação para todas as rotas:

- VehicleSchema
- SaleSchema
- ExpenseSchema
- ClientSchema
- ChecklistSchema

## Fase 4: Integração Frontend-Backend

### 4.1 Configuração API Client

Criar cliente HTTP centralizado:

**Arquivo:** `src/lib/api.ts`

- Configuração base do axios/fetch
- Interceptors para autenticação
- Tratamento de erros
- Tipos TypeScript

### 4.2 Hooks Customizados

Criar hooks React Query para cada módulo:

**Arquivos:**

- `src/hooks/useVehicles.ts`
- `src/hooks/useSales.ts`
- `src/hooks/useExpenses.ts`
- `src/hooks/useClients.ts`
- `src/hooks/useChecklists.ts`
- `src/hooks/useDashboard.ts`

**Cada hook terá:**

- useQuery para listagem
- useMutation para criação/atualização/deleção
- Tipos TypeScript

### 4.3 Remoção de Dados Mockados

**Arquivos a modificar:**

- `src/components/dashboard/VehicleCard.tsx` - Remover `mockVehicles`
- `src/pages/Dashboard.tsx` - Substituir `mockVehicles` por hook
- `src/pages/Veiculos.tsx` - Substituir `mockVehicles` por hook
- `src/pages/Vendas.tsx` - Substituir `mockVendas` por hook
- `src/pages/Despesas.tsx` - Substituir `mockDespesas` por hook
- `src/pages/Clientes.tsx` - Substituir `mockClientes` por hook
- `src/pages/Checklist.tsx` - Substituir `mockChecklists` por hook
- `src/components/dashboard/MetricCards.tsx` - Conectar métricas ao backend
- `src/pages/Relatorios.tsx` - Conectar dados de relatórios ao backend

### 4.4 Upload de Imagens

Modificar `AddVehicleModal.tsx`:

- Implementar upload múltiplo de imagens
- Preview antes de enviar
- Progress indicator
- Integração com MinIO via API
- Compressão no frontend (opcional) ou backend

## Fase 5: Autenticação Básica

### 5.1 Sistema de Autenticação

- Criar rotas de auth (`/api/auth/login`, `/api/auth/register`)
- Implementar JWT
- Middleware de autenticação
- Context de autenticação no frontend
- Proteção de rotas

**Arquivos:**

- `server/src/routes/auth.routes.ts`
- `server/src/controllers/auth.controller.ts`
- `src/contexts/AuthContext.tsx`

## Fase 6: Ajustes e Melhorias

### 6.1 Cálculos Automáticos

- Lucro calculado automaticamente (salePrice - purchasePrice)
- Percentual de lucro calculado
- Dias em estoque calculado automaticamente
- Métricas do dashboard calculadas do banco

### 6.2 Soft Delete

- Implementar soft delete em todas as entidades
- Usar campo `deletedAt` (nullable DateTime)
- Filtrar registros deletados nas queries
- Manter histórico completo

### 6.3 Performance

- Paginação em todas as listagens
- Índices no banco de dados
- Cache de queries frequentes (opcional)
- Lazy loading de imagens

## Fase 7: Testes e Validação

### 7.1 Testes Básicos

- Testar todas as rotas da API
- Testar upload de imagens
- Testar soft delete
- Testar cálculos automáticos

### 7.2 Validação de Dados

- Validar todos os inputs
- Mensagens de erro amigáveis
- Tratamento de erros no frontend

## Arquivos Principais a Criar/Modificar

### Novos Arquivos:

- `prisma/schema.prisma`
- `server/src/app.ts`
- `server/src/services/prisma.service.ts`
- `server/src/services/minio.service.ts`
- `server/src/routes/*.routes.ts` (6 arquivos)
- `server/src/controllers/*.controller.ts` (6 arquivos)
- `src/lib/api.ts`
- `src/hooks/use*.ts` (6 arquivos)
- `.env`
- `.env.example`
- `docker-compose.yml` (opcional)

### Arquivos a Modificar:

- `package.json` - Adicionar dependências backend
- `src/components/dashboard/VehicleCard.tsx` - Remover mockVehicles
- `src/pages/Dashboard.tsx` - Conectar ao backend
- `src/pages/Veiculos.tsx` - Conectar ao backend
- `src/pages/Vendas.tsx` - Conectar ao backend
- `src/pages/Despesas.tsx` - Conectar ao backend
- `src/pages/Clientes.tsx` - Conectar ao backend
- `src/pages/Checklist.tsx` - Conectar ao backend
- `src/components/modals/AddVehicleModal.tsx` - Upload de imagens
- `src/components/dashboard/MetricCards.tsx` - Conectar métricas
- `src/pages/Relatorios.tsx` - Conectar relatórios
- `vite.config.ts` - Proxy para API (opcional)

## Ordem de Implementação Recomendada

1. **Instalar PostgreSQL e MinIO** (Fase 1)
2. **Criar schema Prisma e migrations** (Fase 2)
3. **Criar estrutura básica do backend** (Fase 3.1-3.3)
4. **Implementar rotas de Vehicles primeiro** (Fase 3.4)
5. **Conectar Dashboard e Veículos ao backend** (Fase 4)
6. **Implementar upload de imagens** (Fase 4.4)
7. **Implementar outras rotas** (Sales, Expenses, Clients, Checklists)
8. **Conectar demais páginas** (Fase 4.3)
9. **Autenticação básica** (Fase 5)
10. **Ajustes finais** (Fase 6-7)

## Considerações Técnicas

- **Soft Delete**: Todas as exclusões serão lógicas usando `deletedAt`
- **Multi-tenant**: Usar `accountId` em todas as queries para isolamento
- **Compressão de Imagens**: Backend processa imagens conforme especificação (Lanczos3, 1071x1428, MozJPEG 60%)
- **TypeScript**: Manter tipagem forte em todo o projeto
- **Error Handling**: Tratamento consistente de erros em todo o stack
- **Performance**: Paginação e índices desde o início

## Variáveis de Ambiente Necessárias

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/descompliCAR"

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="vehicle-images"
MINIO_USE_SSL=false

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV=development
```