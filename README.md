# DescompliCAR - Sistema de Gestão de Veículos

Sistema completo de gestão de veículos desenvolvido com tecnologias modernas.

## Tecnologias Utilizadas

Este projeto é construído com:

- **Frontend:**
  - React 18 + TypeScript
  - Vite
  - shadcn/ui
  - Tailwind CSS
  - React Router
  - TanStack Query (React Query)
  - React Hook Form + Zod

- **Backend:**
  - Node.js 20+
  - Express
  - Prisma ORM
  - PostgreSQL
  - MinIO (armazenamento de imagens)
  - JWT (autenticação)

## Pré-requisitos

- Node.js 20+ instalado
- PostgreSQL instalado e rodando
- MinIO instalado (ou usar Docker)

## Instalação

### 1. Instalar dependências do frontend

```bash
npm install
```

### 2. Instalar dependências do backend

```bash
cd server
npm install
cd ..
```

### 3. Configurar banco de dados

O banco de dados `descomplicar` já deve estar criado. Se não estiver:

```bash
sudo -u postgres psql -c "CREATE DATABASE descomplicar;"
```

### 4. Gerar Prisma Client

```bash
npx prisma generate
```

## Configuração

### Variáveis de Ambiente

O arquivo `.env` já está configurado na raiz do projeto com:

```env
DATABASE_URL="postgresql://postgres@localhost:5432/descomplicar"
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="vehicle-images"
VITE_API_URL="http://localhost:3001/api"
```

## Executando o Projeto

### MinIO como serviço (recomendado – fica rodando)

**Opção A – Docker (recomendado se tiver Docker):**
```bash
npm run minio:up    # sobe MinIO em background (restart automático)
npm run minio:down  # para o MinIO
npm run minio:logs  # ver logs
```

**Opção B – systemd (Linux, inicia no boot):**
```bash
sudo ./scripts/install-minio-service.sh
# MinIO passa a rodar como serviço (minio-descomplicar) e reinicia com a máquina
```

**Opção C – script único (tudo no mesmo terminal):**
```bash
./start-all.sh
```

### Desenvolvimento (front + back com um comando)

```bash
# 1. Subir MinIO (uma vez) – Docker ou script acima
npm run minio:up
# ou: sudo ./scripts/install-minio-service.sh

# 2. Frontend (3000) + Backend (3001) juntos
npm run dev
```

### Produção

```bash
npm start   # build + servidor na porta 3000 (front + /api)
```

## Acessos

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **MinIO Console:** http://localhost:9001 (minioadmin/minioadmin)

## Estrutura do Projeto

```
/app
├── src/                    # Frontend React
│   ├── components/        # Componentes React
│   ├── pages/             # Páginas da aplicação
│   ├── hooks/             # Custom hooks (React Query)
│   └── lib/               # Utilitários e API client
├── server/                 # Backend Express
│   └── src/
│       ├── routes/        # Rotas da API
│       ├── controllers/   # Controllers
│       ├── services/       # Serviços (Prisma, MinIO)
│       └── middleware/     # Middlewares
├── prisma/                 # Schema do banco de dados
└── minio-data/            # Dados do MinIO (local)
```

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login

### Veículos
- `GET /api/vehicles` - Listar veículos
- `GET /api/vehicles/:id` - Detalhes do veículo
- `POST /api/vehicles` - Criar veículo (com upload de imagens)
- `PUT /api/vehicles/:id` - Atualizar veículo
- `DELETE /api/vehicles/:id` - Excluir veículo (soft delete)

### Vendas
- `GET /api/sales` - Listar vendas
- `POST /api/sales` - Criar venda
- `PUT /api/sales/:id` - Atualizar venda
- `DELETE /api/sales/:id` - Excluir venda

### Despesas
- `GET /api/expenses` - Listar despesas
- `POST /api/expenses` - Criar despesa
- `PUT /api/expenses/:id` - Atualizar despesa
- `DELETE /api/expenses/:id` - Excluir despesa

### Clientes
- `GET /api/clients` - Listar clientes
- `POST /api/clients` - Criar cliente
- `PUT /api/clients/:id` - Atualizar cliente
- `DELETE /api/clients/:id` - Excluir cliente

### Checklists
- `GET /api/checklists` - Listar checklists
- `POST /api/checklists` - Criar checklist
- `PUT /api/checklists/:id` - Atualizar checklist
- `PUT /api/checklists/:id/items/:itemId` - Atualizar item do checklist
- `DELETE /api/checklists/:id` - Excluir checklist

### Dashboard
- `GET /api/dashboard/metrics` - Métricas do dashboard
- `GET /api/dashboard/vehicles` - Veículos em estoque

## Funcionalidades Implementadas

- ✅ Dashboard com métricas em tempo real
- ✅ Gestão completa de veículos (CRUD)
- ✅ Upload e compressão de imagens (MinIO)
- ✅ Gestão de vendas com cálculo automático de lucro
- ✅ Controle de despesas
- ✅ Cadastro de clientes
- ✅ Sistema de checklists
- ✅ Soft delete em todas as entidades
- ✅ Cálculos automáticos (lucro, dias em estoque)
- ✅ Autenticação básica (JWT)
- ✅ Multi-tenant (isolamento por conta)

## Próximos Passos

- [ ] Implementar relatórios completos
- [ ] Sistema de notificações
- [ ] Área administrativa completa
- [ ] Sistema de assinaturas
- [ ] Webhooks universais
- [ ] Sistema de email
- [ ] PWA completo

## Notas Importantes

- Todas as exclusões são **soft delete** (usando `deletedAt`)
- Imagens são comprimidas automaticamente (Lanczos3, 1071x1428, MozJPEG 60%)
- O sistema usa multi-tenant com isolamento por `accountId`
- Autenticação temporária permite acesso sem token (será removida em produção)

## Suporte

Para dúvidas ou problemas, consulte a documentação ou entre em contato com a equipe de desenvolvimento.
