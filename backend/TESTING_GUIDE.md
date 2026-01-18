# SharkBand Testing & Pilot Simulation Guide

This guide covers running E2E tests and pilot simulations for the SharkBand platform.

## Prerequisites

1. **Database**: PostgreSQL running (via Docker or local)
   ```bash
   docker-compose up -d postgres
   ```

2. **NATS**: NATS server running (via Docker or local)
   ```bash
   docker-compose up -d nats
   ```

3. **Migrations**: Run database migrations
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

4. **Dependencies**: Install backend dependencies
   ```bash
   npm install
   ```

## Running E2E Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npm run test:e2e -- app.e2e-spec
```

### Test Coverage

The E2E test suite (`test/e2e/app.e2e-spec.ts`) covers:

- **Auth + Scopes**
  - Merchant admin can access analytics endpoints
  - Staff cannot access merchant admin endpoints
  - Unauthenticated requests are rejected

- **Idempotency**
  - Issue same request twice with same Idempotency-Key → only 1 ledger entry
  - Redeem same request twice → only 1 redeem effect

- **Double-Spend Protection**
  - Attempt to redeem more than available → fails
  - Concurrent redemptions handled safely

- **Tenant Isolation**
  - Tenant A cannot read Tenant B's data
  - Tenant B cannot access Tenant A resources

- **Metrics Correctness**
  - Daily metrics match expected counts
  - Transaction counts accurate

## Pilot Simulator

### Run Simulator
```bash
npm run simulate:pilot
```

**Requirements**:
- `NODE_ENV=development`
- `PILOT_MODE=true`
- Backend API running on `http://localhost:3000`
- Database and NATS running

### What the Simulator Does

1. **Creates Pilot Tenant** (or uses existing)
   - Tenant, location, admin user, staff user, device
   - Reward for redemption testing

2. **Simulates 60 Customers**:
   - 40 customers: 1 issue each (spread across 7 days)
   - 15 customers: 2 issues each (repeat customers)
   - 10 customers: 1 redeem each (after issuing points)
   - 5 error scenarios (tracked in audit logs)

3. **Operational Scenarios**:
   - 2 manual adjustments
   - 1 transaction reversal

4. **Backdates Transactions**:
   - Spreads transactions across last 7 days
   - Updates `created_at` timestamps (dev-only)

5. **Generates Reports**:
   - Weekly pilot report
   - Onboarding funnel metrics
   - Prints readable summary

### Output

The simulator prints:
- Setup progress
- Transaction simulation progress
- Weekly report summary (metrics, improvements, issues)
- Onboarding funnel durations

## Pilot Acceptance Command

### Run Full Acceptance Suite
```bash
npm run pilot:acceptance
```

This command:
1. Runs E2E tests (`npm run test:e2e`)
2. Runs pilot simulator (`npm run simulate:pilot`)
3. Prints "PASS" only if all succeed

### Manual Acceptance Checklist

Before marking pilot as ready:

- [ ] E2E tests pass
- [ ] Simulator completes without errors
- [ ] Weekly report shows expected metrics:
  - Active customers count
  - Repeat customers count
  - Transaction totals match
  - Redemption rate calculated correctly
- [ ] Onboarding funnel shows all milestones
- [ ] No errors in simulator output

## Troubleshooting

### Tests Fail: Database Connection
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Check connection string in .env
DATABASE_URL=postgresql://sharkband:sharkband@localhost:5432/sharkband
```

### Tests Fail: NATS Connection
```bash
# Ensure NATS is running
docker-compose up -d nats

# Check NATS URL in .env
NATS_URL=nats://localhost:4222
```

### Simulator: API Not Available
```bash
# Start backend in another terminal
npm run start:dev

# Or set API_BASE_URL if running on different port
export API_BASE_URL=http://localhost:3001/api/v1
npm run simulate:pilot
```

### Simulator: Timestamp Backdating Not Working
- Backdating only works in `NODE_ENV=development` and `PILOT_MODE=true`
- Check environment variables are set correctly
- Verify transactions have correct `created_at` in database

### Metrics Not Updating
- Metrics update asynchronously via NATS
- Simulator waits 2 seconds after transactions
- For tests, may need longer waits or manual metric refresh

## Test Data Cleanup

E2E tests clean up after themselves. If you need to manually clean up:

```bash
# Connect to database
psql -U sharkband -d sharkband

# Delete pilot simulator tenant data
DELETE FROM pilot_daily_metrics WHERE tenant_id IN (
  SELECT id FROM tenants WHERE name = 'Pilot Simulator Tenant'
);

DELETE FROM tenants WHERE name = 'Pilot Simulator Tenant';
```

## Writing New E2E Tests

1. Create test file in `test/e2e/`
2. Follow pattern from `app.e2e-spec.ts`
3. Use `beforeAll` for setup, `afterAll` for cleanup
4. Test one concept per `describe` block
5. Use `supertest` for API calls

Example:
```typescript
describe('My Feature', () => {
  it('should do something', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({...});
  });
});
```

## Deterministic Testing

Both E2E tests and simulator use:
- Fixed UUIDs for test entities
- Deterministic transaction sequencing
- Fixed timestamps (simulator backdates to specific days)

This ensures:
- Repeat runs produce same results
- Metrics are predictable
- Debugging is easier

## Environment Variables for Testing

Required for E2E:
```bash
NODE_ENV=test
DATABASE_URL=postgresql://sharkband:sharkband@localhost:5432/sharkband
NATS_URL=nats://localhost:4222
JWT_SECRET=test-secret
JWT_REFRESH_TOKEN_SECRET=test-refresh-secret
```

Required for Simulator:
```bash
NODE_ENV=development
PILOT_MODE=true
DATABASE_URL=postgresql://sharkband:sharkband@localhost:5432/sharkband
NATS_URL=nats://localhost:4222
API_BASE_URL=http://localhost:3000/api/v1  # Optional, defaults to localhost:3000
```

## Next Steps

- Run `npm run pilot:acceptance` to validate everything works
- Review weekly report output for expected metrics
- Check onboarding funnel shows reasonable durations
- Use simulator output to validate pilot readiness
