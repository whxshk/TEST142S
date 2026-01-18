# Pilot Operations & Metrics - Implementation Summary

This document summarizes the operational tooling and metrics reporting added for pilot execution.

## 1. Pilot Mode Configuration ✅

**Configuration**: `config/config.service.ts`

- `PILOT_MODE` environment variable (defaults to `true` in development)
- `PILOT_STRICT_LOGGING` for enhanced logging
- Per-environment control without affecting customer UX

## 2. Metrics Data Model ✅

**Migration**: `migrations/002_pilot_metrics.sql`
**Prisma Models**: Added to `schema.prisma`

### Tables Created:
- `pilot_daily_metrics` - Daily aggregated metrics per tenant/location
- `pilot_onboarding_funnel` - Time-to-first-value tracking
- `pilot_customer_activity` - Customer transaction tracking (for repeat customer calculation)
- `pilot_reward_usage` - Reward redemption tracking

### Metrics Tracked:
- Active customers (unique customers with >=1 transaction)
- Repeat customers (customers with >=2 transactions in last 7 days)
- Transaction counts (issue/redeem/adjust/reverse)
- Redemption rate (redeems / issues)
- Scan errors (expired QR, insufficient balance, unauthorized device)

## 3. Metrics Tracking Integration ✅

**Updated Modules**:
- `readmodels/readmodels.consumer.ts` - Tracks metrics from NATS events
- `onboarding/onboarding.service.ts` - Tracks onboarding milestones
- `devices/devices.service.ts` - Tracks first device registration
- `transactions/transactions.service.ts` - Tracks first scan

**Service**: `pilot-metrics/pilot-metrics.service.ts`
- `updateDailyMetrics()` - Updates daily aggregations
- `trackCustomerActivity()` - Tracks customer transactions
- `trackRewardUsage()` - Tracks reward redemptions
- `trackOnboardingMilestone()` - Tracks onboarding funnel

## 4. Weekly Merchant Report ✅

**Endpoint**: `GET /api/v1/analytics/pilot-weekly-report?week=YYYY-WW`

**Returns**:
- Summary metrics for the week
- Daily breakdown
- Top rewards used
- Retention signals (repeat customers)
- Operational friction signals (errors, reversals, adjustments)
- Plain English summary ("What improved" / "What needs fixing")

**Service**: `analytics/pilot-reports.service.ts`

## 5. Onboarding Funnel Tracking ✅

**Endpoint**: `GET /api/v1/analytics/pilot-onboarding-funnel`

**Tracks**:
- Merchant signup time
- First location created
- First staff invited
- First device registered
- First successful scan

**Calculates**:
- Time to location (minutes)
- Time to staff (minutes)
- Time to device (minutes)
- Time to first scan (minutes)

## 6. Dashboard Pilot Report Page ✅

**New Page**: `clients/merchant-dashboard/src/pages/PilotReport.tsx`

**Features**:
- Weekly report display
- Onboarding funnel visualization
- Daily breakdown table
- Top rewards list
- Export JSON button
- Plain English summary display

**Navigation**: Added "Pilot Report" button to main dashboard

## 7. Pilot Playbook Documentation ✅

**File**: `docs/pilot/PILOT_PLAYBOOK.md`

**Contents**:
- 10-minute merchant onboarding guide
- Reward recommendations
- Staff training scripts
- Customer communication scripts
- Daily/weekly checklists
- Troubleshooting guide
- Success criteria
- Best practices

## Key Features

### Metrics Calculation
- **Active Customers**: Counted from `pilot_customer_activity` table
- **Repeat Customers**: Customers with >=2 transactions in last 7 days
- **Redemption Rate**: `redeems / issues` (capped at 1.0)
- **Error Rate**: `scan_errors_total / transactions_total`

### Onboarding Funnel
- Automatically tracked at each milestone
- Durations calculated in minutes
- Completion status tracked

### Weekly Report Intelligence
- Generates actionable insights
- Identifies improvement areas
- Highlights operational friction
- Provides retention metrics

## Usage

### Enable Pilot Mode
```bash
export PILOT_MODE=true
export PILOT_STRICT_LOGGING=true
```

### Run Weekly Report
```bash
GET /api/v1/analytics/pilot-weekly-report?week=2025-03
```

### Check Onboarding Funnel
```bash
GET /api/v1/analytics/pilot-onboarding-funnel
```

### Access Dashboard
Navigate to `/pilot-report` in merchant dashboard

## Database Migration

Run the migration to create metrics tables:
```bash
psql -U sharkband -d sharkband -f migrations/002_pilot_metrics.sql
```

Or use Prisma:
```bash
npx prisma migrate dev --name pilot_metrics
```

## Notes

- All metrics are tenant-isolated
- Metrics updated asynchronously via NATS events
- No performance impact on transaction processing
- Metrics tables are denormalized for fast queries
- Weekly reports can be generated for any week (past or current)

All changes maintain existing architecture, are scope-guarded, and include full audit trails.
