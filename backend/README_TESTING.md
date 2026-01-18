# Testing Quick Start

## Quick Commands

```bash
# Run E2E tests
npm run test:e2e

# Run pilot simulator
npm run simulate:pilot

# Run full acceptance suite
npm run pilot:acceptance
```

## Prerequisites

1. Start dependencies:
   ```bash
   docker-compose up -d postgres nats
   ```

2. Run migrations:
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

3. For simulator, start backend:
   ```bash
   npm run start:dev  # In separate terminal
   ```

## Windows Note

If `NODE_ENV=development` syntax doesn't work on Windows, set environment variables manually or use PowerShell:

```powershell
$env:NODE_ENV="development"
$env:PILOT_MODE="true"
npm run simulate:pilot
```

Or install `cross-env` and update package.json scripts to use it.

## See Also

- `TESTING_GUIDE.md` - Detailed testing guide
- `TESTING_IMPLEMENTATION.md` - Implementation details
- `docs/pilot/PILOT_API_COLLECTION.md` - API curl examples
