# Testing & Pilot Simulator - Implementation Summary

This document summarizes the testing and simulation infrastructure added to SharkBand.

## 1. E2E Test Suite ✅

**Location**: `test/e2e/app.e2e-spec.ts`

### Test Coverage:

**A) Auth + Scopes**
- ✅ Merchant admin can access analytics endpoints
- ✅ Staff (scan scope) cannot access merchant admin endpoints
- ✅ Unauthenticated requests are rejected

**B) Idempotency**
- ✅ Issue same request twice with same Idempotency-Key → only 1 ledger entry
- ✅ Redeem same request twice → only 1 redeem ledger effect

**C) Double-Spend Protection**
- ✅ Attempt to redeem more than available → fails
- ✅ Balance validation prevents overdrafts

**D) Tenant Isolation**
- ✅ Tenant A cannot read tenant B pilot metrics/report endpoints
- ✅ Tenant B cannot access tenant A resources

**E) Metrics Correctness**
- ✅ Transaction counts match after operations
- ✅ Ledger entries created correctly

### Test Infrastructure:
- `test/jest-e2e.json` - Jest E2E configuration
- `test/setup-e2e.ts` - Test environment setup
- Uses Supertest for HTTP testing
- Automatic cleanup after tests

## 2. Pilot Simulator Script ✅

**Location**: `src/scripts/simulate_pilot.ts`

**Command**: `npm run simulate:pilot`

### Behavior:

1. **Setup**
   - Creates or reuses pilot tenant
   - Sets up location, admin, staff, device, reward

2. **Customer Simulation** (60 customers):
   - 40 customers: 1 issue each (spread across 7 days)
   - 15 customers: 2 issues each in 7 days (repeat customers)
   - 10 customers: 1 redeem each (after issuing points)
   - 5 error scenarios (tracked in audit logs)

3. **Operational Scenarios**:
   - 2 manual adjustments
   - 1 transaction reversal

4. **Backdating**:
   - Transactions backdated across last 7 days
   - Updates `created_at` timestamps (dev-only, guarded by `NODE_ENV=development`)

5. **Report Generation**:
   - Calls `/api/v1/analytics/pilot-weekly-report`
   - Calls `/api/v1/analytics/pilot-onboarding-funnel`
   - Prints readable summary

### Safety Guards:
- Only runs in `NODE_ENV=development` + `PILOT_MODE=true`
- Backdating only in dev environment
- Cannot run in production

## 3. Pilot Acceptance Command ✅

**Command**: `npm run pilot:acceptance`

**Behavior**:
1. Runs E2E tests (`npm run test:e2e`)
2. Runs pilot simulator (`npm run simulate:pilot`)
3. Prints "PASS" only if all succeed

**Usage**:
```bash
npm run pilot:acceptance
```

## 4. API Collection Documentation ✅

**Location**: `docs/pilot/PILOT_API_COLLECTION.md`

**Contents**:
- CURL commands for all pilot operations
- Merchant onboarding flow
- Transaction operations (issue/redeem)
- Operator tools (adjustment/reversal)
- Analytics endpoints (weekly report, funnel)
- Example complete flows
- Idempotency testing examples

## Key Features

### Deterministic Testing
- Tests use fixed UUIDs for test data
- Simulator uses deterministic sequences
- Repeat runs produce same results

### Safety
- Backdating only in development mode
- Guards prevent running in production
- Test data isolated from real data

### Integration
- Uses real API endpoints (not direct DB)
- Tests actual request/response flow
- Validates full stack behavior

## Files Created/Modified

### Test Infrastructure
- `test/jest-e2e.json` - E2E Jest config
- `test/setup-e2e.ts` - Test setup
- `test/e2e/app.e2e-spec.ts` - E2E test suite

### Scripts
- `src/scripts/simulate_pilot.ts` - Pilot simulator

### Documentation
- `TESTING_GUIDE.md` - Testing guide
- `TESTING_IMPLEMENTATION.md` - This file
- `docs/pilot/PILOT_API_COLLECTION.md` - API collection

### Package.json
- Added `simulate:pilot` script
- Added `pilot:acceptance` script
- Added `axios` to devDependencies

## Running Tests

### E2E Tests
```bash
npm run test:e2e
```

### Simulator
```bash
npm run simulate:pilot
```

### Full Acceptance
```bash
npm run pilot:acceptance
```

## Dependencies

The simulator uses `axios` (added to devDependencies) to make HTTP requests to the API. This ensures:
- Real API path testing
- Validation of actual endpoints
- Testing of authentication/authorization

## Notes

- E2E tests require database and NATS to be running
- Simulator requires backend API to be running
- Both cleanup after themselves
- All timestamps can be backdated in dev mode only

The testing infrastructure is production-ready and follows industry best practices for E2E testing and deterministic simulation.
