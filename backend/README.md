# SharkBand Backend

Production-ready Node.js backend for SharkBand universal loyalty platform.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: NestJS 10+ (Fastify adapter)
- **Database**: PostgreSQL 16+ with Prisma ORM
- **Messaging**: NATS 2.10+ (event streaming)
- **Authentication**: JWT with refresh token rotation
- **Validation**: Zod (runtime validation + TypeScript inference)
- **API Documentation**: OpenAPI/Swagger

## Architecture Principles

- **Ledger-First**: Immutable `loyalty_ledger_entries` table is single source of truth. Balances are derived, not stored.
- **Transactional Outbox**: Domain events written atomically with ledger entries, dispatched via NATS.
- **Multi-Tenancy**: Tenant isolation enforced at middleware and query layers.
- **Idempotency**: All transaction endpoints require `Idempotency-Key` header.
- **Scope-Based Auth**: JWT contains scope claims (`merchant:*`, `scan:*`, `customer:*`).

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+ (or use Docker)
- NATS 2.10+ (or use Docker)

## Setup

1. **Clone and install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start infrastructure with Docker Compose**:
   ```bash
   docker-compose up -d postgres nats
   ```

4. **Run database migrations**:
   ```bash
   # Option 1: Using Prisma (recommended)
   npx prisma migrate dev

   # Option 2: Direct SQL (if migrations folder exists)
   psql -U sharkband -d sharkband -f migrations/001_initial_schema.sql
   ```

5. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

6. **Start development server**:
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3000`.

## Development

### Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Prisma schema
├── migrations/                 # SQL migrations (optional, Prisma manages these)
├── src/
│   ├── auth/                  # Authentication module
│   ├── tenancy/               # Multi-tenancy middleware/guards
│   ├── ledger/                # Ledger service (immutable entries)
│   ├── outbox/                # Transactional outbox pattern
│   ├── transactions/          # Transaction pipeline (issue/redeem)
│   ├── readmodels/            # Read model updaters (NATS consumers)
│   ├── rewards/               # Rewards management
│   ├── rulesets/              # Rule evaluation engine
│   ├── devices/               # Device registration
│   ├── customers/             # Customer management + QR tokens
│   ├── locations/             # Location CRUD
│   ├── users/                 # Staff management
│   ├── analytics/             # Analytics endpoints (read models)
│   ├── audit/                 # Audit logging
│   ├── common/                # Shared guards, filters, decorators
│   ├── config/                # Configuration module
│   └── main.ts                # Application entry point
└── test/                      # E2E tests
```

### Database Management

**Prisma Studio** (visual database browser):
```bash
npm run prisma:studio
```

**Create migration**:
```bash
npm run prisma:migrate
```

**Apply migrations in production**:
```bash
npm run prisma:migrate:deploy
```

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Documentation

Once the server is running, Swagger UI is available at:
- **Swagger UI**: `http://localhost:3000/api/docs`
- **OpenAPI JSON**: `http://localhost:3000/api/docs-json`

## Environment Variables

See `.env.example` for all configuration options. Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for access token signing
- `JWT_REFRESH_TOKEN_SECRET`: Secret for refresh token signing
- `NATS_URL`: NATS broker connection URL
- `OUTBOX_POLL_INTERVAL_MS`: Outbox dispatcher polling interval

## Docker Compose Services

- **postgres**: PostgreSQL 16 database
- **nats**: NATS message broker
- **pgadmin**: Optional database admin UI (port 5050)
- **backend**: Backend API service (development mode with hot reload)

To start all services:
```bash
docker-compose up -d
```

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set production environment variables.

3. Run migrations:
   ```bash
   npm run prisma:migrate:deploy
   ```

4. Start the server:
   ```bash
   npm run start:prod
   ```

## Key Features

### Ledger-First Accounting
- All points movements recorded in immutable `loyalty_ledger_entries`
- Balance calculated as `SUM(amount) WHERE tenant_id = X AND customer_id = Y`
- No mutable balance fields (except in read models for performance)

### Transactional Outbox
- Domain events written atomically with business transactions
- Background dispatcher polls `outbox_events` and publishes to NATS
- At-least-once delivery with idempotent consumers

### Idempotency
- Transaction endpoints require `Idempotency-Key: <UUID>` header
- Database UNIQUE constraint on `(tenant_id, idempotency_key)`
- Repeated requests return existing transaction

### Multi-Tenancy
- Tenant ID extracted from JWT claims
- All queries automatically filtered by `tenant_id`
- Middleware enforces tenant context on all requests

## License

UNLICENSED - Proprietary
