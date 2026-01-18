# SharkBand API Surface Outline

All endpoints are prefixed with `/api/v1` and require JWT authentication unless otherwise specified.

## Authentication Endpoints

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/auth/login` | Login with email/password, returns access_token and refresh_token | None (public) |
| POST | `/auth/refresh` | Refresh access token using refresh_token | None (public) |
| POST | `/auth/logout` | Invalidate refresh token | Any authenticated |
| GET | `/auth/me` | Get current user profile and scopes | Any authenticated |

## Tenant & Merchant Management

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/tenants` | Create new tenant/merchant (admin only) | `admin:tenants:create` |
| GET | `/tenants/:id` | Get tenant details | `merchant:*` or `admin:tenants:read` |
| PATCH | `/tenants/:id` | Update tenant configuration | `merchant:*` |
| GET | `/tenants/me` | Get current tenant (from JWT claims) | `merchant:*` |

## Location Management

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/locations` | Create new location | `merchant:*` |
| GET | `/locations` | List all locations for tenant | `merchant:*` |
| GET | `/locations/:id` | Get location details | `merchant:*` |
| PATCH | `/locations/:id` | Update location | `merchant:*` |
| DELETE | `/locations/:id` | Soft delete location | `merchant:*` |

## Staff & User Management

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/users` | Create staff user | `merchant:*` |
| GET | `/users` | List all staff users for tenant | `merchant:*` |
| GET | `/users/:id` | Get user details | `merchant:*` |
| PATCH | `/users/:id` | Update user roles/scopes | `merchant:*` |
| DELETE | `/users/:id` | Deactivate user | `merchant:*` |

## Device Registration

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/devices` | Register new device for location | `scan:*` or `merchant:*` |
| GET | `/devices` | List devices for tenant/location | `merchant:*` or `scan:*` |
| GET | `/devices/:id` | Get device details | `merchant:*` or `scan:*` |
| PATCH | `/devices/:id` | Update device (activate/deactivate) | `merchant:*` |
| DELETE | `/devices/:id` | Unregister device | `merchant:*` |

## Transaction Pipeline

| Method | Path | Description | Required JWT Scope | Idempotency Key |
|--------|------|-------------|-------------------|-----------------|
| POST | `/transactions/issue` | Issue points to customer (via QR scan) | `scan:*` | **Required** |
| POST | `/transactions/redeem` | Redeem points for reward | `scan:*` or `customer:*` | **Required** |
| GET | `/transactions` | List transactions (filtered by tenant) | `merchant:*` or `customer:*` | No |
| GET | `/transactions/:id` | Get transaction details | `merchant:*` or `customer:*` | No |

**Note**: Transaction endpoints require `Idempotency-Key` header (UUID format). Same key with same parameters = idempotent operation.

## Ledger Endpoints

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| GET | `/ledger/balance` | Get customer balance (derived from ledger) | `customer:*` or `merchant:*` |
| GET | `/ledger/history` | Get ledger entry history for customer | `customer:*` or `merchant:*` |
| GET | `/ledger/entries/:id` | Get specific ledger entry (read-only) | `merchant:*` or `customer:*` |

**Note**: Ledger entries are append-only. No write endpoints exposed directly.

## Customer Management

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/customers` | Register new customer (or return existing) | `customer:*` (public with validation) |
| GET | `/customers/me` | Get current customer profile | `customer:*` |
| GET | `/customers/:id` | Get customer details (merchant view) | `merchant:*` |
| GET | `/customers/me/qr-token` | Get current QR token (rotates server-side) | `customer:*` |
| GET | `/customers/:id/memberships` | List customer's merchant memberships | `merchant:*` or `customer:*` |

## Rewards Management

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/rewards` | Create new reward | `merchant:*` |
| GET | `/rewards` | List rewards for tenant | `merchant:*` or `customer:*` |
| GET | `/rewards/:id` | Get reward details | `merchant:*` or `customer:*` |
| PATCH | `/rewards/:id` | Update reward | `merchant:*` |
| DELETE | `/rewards/:id` | Deactivate reward | `merchant:*` |

## Redemptions

| Method | Path | Description | Required JWT Scope | Idempotency Key |
|--------|------|-------------|-------------------|-----------------|
| POST | `/redemptions` | Initiate redemption request | `customer:*` or `scan:*` | **Required** |
| GET | `/redemptions` | List redemptions (customer or merchant view) | `customer:*` or `merchant:*` | No |
| GET | `/redemptions/:id` | Get redemption details | `customer:*` or `merchant:*` | No |
| PATCH | `/redemptions/:id/confirm` | Confirm redemption (2-step pattern) | `scan:*` | **Required** |

## Rulesets

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| POST | `/rulesets` | Create rule set | `merchant:*` |
| GET | `/rulesets` | List active rule sets | `merchant:*` |
| GET | `/rulesets/:id` | Get rule set details | `merchant:*` |
| PATCH | `/rulesets/:id` | Update rule set | `merchant:*` |
| DELETE | `/rulesets/:id` | Deactivate rule set | `merchant:*` |

## Analytics (Read Models)

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| GET | `/analytics/dashboard` | Get dashboard summary (KPIs) | `merchant:*` |
| GET | `/analytics/customers` | Get customer statistics | `merchant:*` |
| GET | `/analytics/transactions` | Get transaction statistics (filtered by date range) | `merchant:*` |
| GET | `/analytics/rewards` | Get redemption statistics | `merchant:*` |
| GET | `/analytics/trends` | Get trend data (time-series) | `merchant:*` |

**Note**: Analytics endpoints read from denormalized read model tables updated via NATS event consumers.

## Audit Logs

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| GET | `/audit/logs` | List audit logs (filtered by tenant) | `merchant:*` or `admin:audit:read` |
| GET | `/audit/logs/:id` | Get audit log entry | `merchant:*` or `admin:audit:read` |

## Outbox Management (Admin)

| Method | Path | Description | Required JWT Scope |
|--------|------|-------------|-------------------|
| GET | `/outbox/events` | List pending/failed outbox events | `admin:outbox:read` |
| POST | `/outbox/events/:id/retry` | Manually trigger event dispatch | `admin:outbox:write` |

## Common Query Parameters

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `tenant_id`: Filter by tenant (automatically applied from JWT, admin override)
- `date_from`: ISO 8601 date
- `date_to`: ISO 8601 date

## Common Headers

- `Authorization`: `Bearer <access_token>`
- `Idempotency-Key`: UUID (required for transaction endpoints)
- `X-Request-ID`: UUID (optional, for tracing)
- `Accept`: `application/vnd.sharkband.v1+json` or `application/json`

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { ... }
  }
}
```
