# SharkBand Pilot API Collection

CURL commands for pilot operations. All commands use `/api/v1` base URL.

## Authentication

### Login (Merchant Admin)
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "demo123456"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

### Login (Staff)
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@demo.com",
    "password": "staff123456"
  }'
```

## Merchant Onboarding

### Merchant Signup
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/merchant-signup \
  -H "Content-Type: application/json" \
  -d '{
    "merchantName": "Coffee Shop",
    "adminEmail": "owner@coffeeshop.com",
    "adminPassword": "securepass123",
    "locationName": "Main Store",
    "locationAddress": "123 Main St, Doha"
  }'
```

### Invite Staff
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/invite-staff \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@coffeeshop.com",
    "scopes": ["scan:*"]
  }'
```

### Accept Invite
```bash
curl -X POST http://localhost:3000/api/v1/onboarding/accept-invite \
  -H "Content-Type: application/json" \
  -d '{
    "inviteToken": "uuid-from-invite-link",
    "password": "staffpass123"
  }'
```

## Transactions

### Issue Points (Scan)
```bash
curl -X POST http://localhost:3000/api/v1/transactions/issue \
  -H "Authorization: Bearer YOUR_STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "customerId": "customer-uuid",
    "amount": 50,
    "deviceId": "device-uuid"
  }'
```

### Redeem Points
```bash
curl -X POST http://localhost:3000/api/v1/transactions/redeem \
  -H "Authorization: Bearer YOUR_STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440001" \
  -d '{
    "customerId": "customer-uuid",
    "rewardId": "reward-uuid"
  }'
```

## Operator Tools (Admin Only)

### Manual Adjustment
```bash
curl -X POST http://localhost:3000/api/v1/operator-tools/adjustment \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440002" \
  -d '{
    "customerId": "customer-uuid",
    "amount": 10,
    "reason": "Customer service adjustment"
  }'
```

### Reverse Transaction
```bash
curl -X POST http://localhost:3000/api/v1/operator-tools/reverse \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "transaction-uuid",
    "reason": "Customer requested refund"
  }'
```

## Analytics & Reporting

### Dashboard Summary
```bash
curl -X GET http://localhost:3000/api/v1/analytics/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Weekly Pilot Report
```bash
# Current week
curl -X GET http://localhost:3000/api/v1/analytics/pilot-weekly-report \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Specific week (format: YYYY-WW)
curl -X GET "http://localhost:3000/api/v1/analytics/pilot-weekly-report?week=2025-03" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Onboarding Funnel
```bash
curl -X GET http://localhost:3000/api/v1/analytics/pilot-onboarding-funnel \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Fraud Signals
```bash
curl -X GET http://localhost:3000/api/v1/fraud-signals \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# With filters
curl -X GET "http://localhost:3000/api/v1/fraud-signals?deviceId=device-uuid&customerId=customer-uuid" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Rewards Management

### List Rewards
```bash
curl -X GET http://localhost:3000/api/v1/rewards \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Create Reward
```bash
curl -X POST http://localhost:3000/api/v1/rewards \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Free Coffee",
    "pointsRequired": 100,
    "description": "Redeem 100 points for a free coffee",
    "isActive": true
  }'
```

## Devices

### Register Device
```bash
curl -X POST http://localhost:3000/api/v1/devices \
  -H "Authorization: Bearer YOUR_STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceIdentifier": "device-unique-id",
    "locationId": "location-uuid"
  }'
```

### List Devices
```bash
curl -X GET http://localhost:3000/api/v1/devices \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Common Headers

All authenticated requests require:
```
Authorization: Bearer <access_token>
```

Transaction endpoints require:
```
Idempotency-Key: <uuid>
```

All requests can include:
```
X-Request-ID: <uuid>  # Optional, for tracing
Content-Type: application/json
```

## Example: Complete Flow

```bash
# 1. Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123456"}' | jq -r '.access_token')

# 2. Create reward
REWARD_ID=$(curl -s -X POST http://localhost:3000/api/v1/rewards \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Free Coffee","pointsRequired":100,"isActive":true}' | jq -r '.id')

# 3. Get weekly report
curl -X GET http://localhost:3000/api/v1/analytics/pilot-weekly-report \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

## Testing with Idempotency

To test idempotency, use the same `Idempotency-Key` twice:

```bash
IDEMPOTENCY_KEY="550e8400-e29b-41d4-a716-446655440000"

# First request
curl -X POST http://localhost:3000/api/v1/transactions/issue \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"...","amount":50}'

# Second request (same key) - should return same result
curl -X POST http://localhost:3000/api/v1/transactions/issue \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"...","amount":50}'
```

Both requests should return the same transaction ID and only create one ledger entry.
