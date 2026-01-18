# SharkBand Critical Flows

This document describes the key operational flows in the SharkBand platform using sequence diagrams.

## 1. Unified Transaction Pipeline: Points Issuance

This flow demonstrates the complete end-to-end process from a vendor scan to read model updates.

```mermaid
sequenceDiagram
    participant VendorApp as Vendor App
    participant API as API Gateway
    participant Auth as Auth Middleware
    participant TxService as Transaction Service
    participant Ledger as Ledger Service
    participant DB as PostgreSQL
    participant Outbox as Outbox Service
    participant Dispatcher as Outbox Dispatcher
    participant NATS as NATS Broker
    participant Consumer as Read Model Updater
    participant Dashboard as Merchant Dashboard

    VendorApp->>API: POST /transactions/issue<br/>Idempotency-Key: uuid()
    API->>Auth: Validate JWT<br/>Extract tenant_id, scopes
    Auth->>Auth: Check scope: scan:*
    Auth->>TxService: Forward request<br/>+ tenant context

    TxService->>TxService: Validate request<br/>- Device authorization<br/>- Customer QR token<br/>- Amount > 0

    TxService->>DB: BEGIN TRANSACTION

    TxService->>DB: Check idempotency<br/>SELECT * FROM transactions<br/>WHERE tenant_id = X<br/>AND idempotency_key = Y
    alt Idempotency key exists
        DB-->>TxService: Return existing transaction
        TxService->>DB: COMMIT
        TxService-->>VendorApp: 200 OK (existing transaction)
    else New request
        TxService->>DB: INSERT INTO transactions<br/>(tenant_id, customer_id, amount, ...)
        TxService->>Ledger: appendEntry(tenantId, customerId, amount, idempotencyKey)
        
        Ledger->>DB: Calculate balance_after<br/>SELECT SUM(amount) FROM ledger_entries<br/>WHERE tenant_id = X AND customer_id = Y
        
        Ledger->>DB: INSERT INTO loyalty_ledger_entries<br/>(tenant_id, transaction_id, customer_id,<br/>amount, balance_after, idempotency_key)
        
        Ledger-->>TxService: Entry appended
        
        TxService->>Outbox: writeEvent(tenantId, "points.issued", payload)
        Outbox->>DB: INSERT INTO outbox_events<br/>(tenant_id, event_type, payload, status=PENDING)
        Outbox-->>TxService: Event written
        
        TxService->>DB: COMMIT TRANSACTION
        Note over DB: Atomic: transaction + ledger + outbox
        
        TxService-->>VendorApp: 201 Created<br/>{ transaction_id, balance }
    end

    Note over Dispatcher: Background worker<br/>(polls every 5 seconds)

    Dispatcher->>DB: SELECT * FROM outbox_events<br/>WHERE status = 'PENDING'<br/>LIMIT 100
    DB-->>Dispatcher: Return pending events
    
    loop For each event
        Dispatcher->>NATS: Publish event<br/>Topic: loyalty.points.issued<br/>Payload: { tenant_id, customer_id, amount, ... }
        NATS-->>Dispatcher: ACK
        
        Dispatcher->>DB: UPDATE outbox_events<br/>SET status = 'PUBLISHED'<br/>WHERE id = event_id
    end

    Consumer->>NATS: Subscribe: loyalty.points.issued
    NATS-->>Consumer: Event: points.issued
    
    Consumer->>Consumer: Check idempotency<br/>(deduplication)
    Consumer->>DB: UPSERT customer_balances<br/>SET balance = balance + amount<br/>WHERE tenant_id = X AND customer_id = Y
    Consumer->>DB: INSERT INTO transaction_summaries<br/>(transaction_id, summary data)
    
    Note over Consumer: Read model updated

    Dashboard->>API: GET /analytics/dashboard
    API->>Dashboard: 200 OK<br/>{ customer_balances, ... }
```

### Key Points:
- **Idempotency**: Same `Idempotency-Key` returns existing transaction
- **Atomicity**: Transaction, ledger entry, and outbox event written in single DB transaction
- **Eventual Consistency**: Read models updated asynchronously via NATS
- **Tenant Isolation**: All queries filtered by `tenant_id` from JWT claims

## 2. Reward Redemption with Double-Spend Prevention

This flow demonstrates the 2-step redemption process with protection against double-spending.

```mermaid
sequenceDiagram
    participant CustomerApp as Customer App
    participant API as API Gateway
    participant TxService as Transaction Service
    participant Rewards as Rewards Service
    participant Ledger as Ledger Service
    participant DB as PostgreSQL
    participant Outbox as Outbox Service

    CustomerApp->>API: POST /redemptions<br/>Idempotency-Key: uuid()<br/>{ reward_id }
    API->>TxService: Forward request<br/>+ tenant context

    TxService->>Rewards: getReward(reward_id)
    Rewards->>DB: SELECT * FROM rewards<br/>WHERE id = reward_id AND tenant_id = X
    Rewards-->>TxService: { points_required: 100 }

    TxService->>DB: BEGIN TRANSACTION

    TxService->>DB: SELECT FOR UPDATE<br/>customer_merchant_accounts<br/>WHERE customer_id = Y AND tenant_id = X
    DB-->>TxService: Lock row (prevents concurrent redemption)

    TxService->>Ledger: getBalance(tenantId, customerId)
    Ledger->>DB: SELECT SUM(amount) FROM loyalty_ledger_entries<br/>WHERE tenant_id = X AND customer_id = Y
    Ledger-->>TxService: balance = 150

    alt Insufficient balance
        TxService->>DB: ROLLBACK
        TxService-->>CustomerApp: 400 Bad Request<br/>{ error: "Insufficient points" }
    else Sufficient balance
        TxService->>DB: INSERT INTO redemptions<br/>(tenant_id, customer_id, reward_id,<br/>points_deducted, status='PENDING',<br/>idempotency_key)
        
        Note over TxService: Reserve points but don't deduct yet
        
        TxService->>DB: COMMIT
        TxService-->>CustomerApp: 201 Created<br/>{ redemption_id, status: "PENDING" }
    end

    Note over CustomerApp: Customer presents redemption<br/>to vendor/staff

    CustomerApp->>API: PATCH /redemptions/:id/confirm<br/>Idempotency-Key: uuid-v2()
    API->>TxService: confirmRedemption(redemptionId, idempotencyKey)

    TxService->>DB: BEGIN TRANSACTION

    TxService->>DB: SELECT * FROM redemptions<br/>WHERE id = redemption_id<br/>FOR UPDATE
    DB-->>TxService: { status: "PENDING", points_deducted: 100 }

    alt Redemption already completed
        TxService->>DB: ROLLBACK
        TxService-->>CustomerApp: 400 Bad Request<br/>{ error: "Already redeemed" }
    else Valid redemption
        TxService->>Ledger: appendEntry(tenantId, customerId, -points_deducted, idempotencyKey)
        Ledger->>DB: INSERT INTO loyalty_ledger_entries<br/>(amount: -100, balance_after: 50)
        
        TxService->>DB: UPDATE redemptions<br/>SET status = 'COMPLETED'<br/>WHERE id = redemption_id
        
        TxService->>Outbox: writeEvent("points.redeemed", payload)
        Outbox->>DB: INSERT INTO outbox_events (status=PENDING)
        
        TxService->>DB: COMMIT TRANSACTION
        TxService-->>CustomerApp: 200 OK<br/>{ redemption_id, status: "COMPLETED" }
    end

    Note over DB: Outbox dispatcher will publish<br/>points.redeemed event<br/>Read model updater will<br/>deduct from customer_balances
```

### Key Points:
- **2-Step Process**: Initiate → Confirm (prevents accidental redemptions)
- **Double-Spend Prevention**: `SELECT FOR UPDATE` locks account during balance check
- **Idempotency**: Confirm endpoint also idempotent (same key = no duplicate deduction)
- **Status Tracking**: Redemption moves PENDING → COMPLETED (or FAILED)

## 3. Merchant Onboarding Flow

This flow shows the complete setup process for a new merchant joining the platform.

```mermaid
sequenceDiagram
    participant Admin as Admin/Platform
    participant Merchant as Merchant Dashboard
    participant API as API Gateway
    participant TenantService as Tenancy Service
    participant LocationService as Location Service
    participant UserService as User Service
    participant DeviceService as Device Service
    participant DB as PostgreSQL
    participant Staff as Staff Member

    Admin->>API: POST /tenants<br/>{ name, config }
    API->>TenantService: createTenant(data)
    TenantService->>DB: INSERT INTO tenants (name, config)
    DB-->>TenantService: { tenant_id }
    TenantService-->>Admin: 201 Created<br/>{ tenant_id, api_key }

    Note over Merchant: Merchant receives credentials

    Merchant->>API: POST /auth/login<br/>{ email, password }<br/>+ tenant context
    API-->>Merchant: { access_token, refresh_token<br/>scopes: ["merchant:*"] }

    Merchant->>API: POST /locations<br/>Authorization: Bearer token<br/>{ name, address }
    API->>LocationService: createLocation(tenant_id, data)
    LocationService->>DB: INSERT INTO locations<br/>(tenant_id, name, address)
    LocationService-->>Merchant: 201 Created<br/>{ location_id }

    Merchant->>API: POST /users<br/>{ email, password, roles, scopes: ["scan:*"] }
    API->>UserService: createUser(tenant_id, data)
    UserService->>DB: INSERT INTO users<br/>(tenant_id, email, hashed_password, scopes)
    UserService-->>Merchant: 201 Created<br/>{ user_id }

    Note over Staff: Staff member receives credentials<br/>Installs vendor app

    Staff->>API: POST /auth/login<br/>{ email, password }
    API-->>Staff: { access_token, refresh_token<br/>scopes: ["scan:*"] }

    Staff->>API: POST /devices<br/>Authorization: Bearer token<br/>{ device_identifier, location_id }
    API->>DeviceService: registerDevice(tenant_id, location_id, device_identifier)
    
    DeviceService->>DB: SELECT * FROM devices<br/>WHERE device_identifier = X
    alt Device already registered
        DeviceService-->>Staff: 400 Bad Request<br/>{ error: "Device already registered" }
    else New device
        DeviceService->>DB: INSERT INTO devices<br/>(tenant_id, location_id, device_identifier,<br/>registered_by_user_id)
        DeviceService-->>Staff: 201 Created<br/>{ device_id }
    end

    Note over Staff: Staff can now scan customer QR codes

    Staff->>API: POST /transactions/issue<br/>Idempotency-Key: uuid()<br/>{ customer_qr_token, amount, device_id }
    API-->>Staff: 201 Created<br/>{ transaction_id, balance }

    Note over Merchant,DB: Merchant is now fully onboarded<br/>and processing transactions
```

### Key Points:
- **Progressive Setup**: Tenant → Location → Staff → Device → First Transaction
- **Scope Assignment**: Staff users get `scan:*` scope, merchant owners get `merchant:*`
- **Device Binding**: Each device tied to location and registered user
- **First Transaction**: Validates entire onboarding chain

## 4. Customer QR Token Rotation

This flow shows how customer QR tokens are securely rotated server-side.

```mermaid
sequenceDiagram
    participant CustomerApp as Customer App
    participant API as API Gateway
    participant CustomerService as Customer Service
    participant DB as PostgreSQL

    Note over CustomerApp: App opens QR display screen

    CustomerApp->>API: GET /customers/me/qr-token<br/>Authorization: Bearer token
    API->>CustomerService: getQrToken(customer_id, tenant_context)

    CustomerService->>DB: SELECT qr_token_secret,<br/>rotation_interval_sec<br/>FROM customers<br/>WHERE id = customer_id

    CustomerService->>CustomerService: Calculate current token<br/>token = HMAC_SHA256(<br/>secret + timestamp_bucket,<br/>customer_id<br/>)<br/><br/>timestamp_bucket =<br/>floor(now() / rotation_interval)
    
    Note over CustomerService: Token rotates every<br/>rotation_interval_sec (15-60s)<br/>Same token valid for entire interval

    CustomerService-->>API: { qr_token, expires_at, refresh_interval }
    API-->>CustomerApp: 200 OK<br/>{ qr_token, expires_at }

    CustomerApp->>CustomerApp: Display QR code<br/>Refresh in refresh_interval seconds

    Note over CustomerApp: Vendor scans QR token

    VendorApp->>API: POST /transactions/issue<br/>{ qr_token }
    API->>CustomerService: validateQrToken(qr_token)
    
    CustomerService->>CustomerService: Reverse lookup:<br/>Try token for current + previous buckets<br/>(account for clock skew)
    
    CustomerService->>DB: SELECT id FROM customers<br/>WHERE HMAC_SHA256(secret + bucket, id) = token
    
    alt Token valid
        CustomerService-->>API: { customer_id }
        API->>API: Continue transaction flow
    else Token invalid/expired
        CustomerService-->>API: 401 Unauthorized<br/>{ error: "Invalid or expired QR token" }
    end
```

### Key Points:
- **Server-Side Rotation**: Token generated server-side, not client-side
- **Time-Based Bucketing**: Token valid for entire interval (15-60s), prevents race conditions
- **HMAC Signing**: Token is signed hash, cannot be forged
- **Clock Skew Tolerance**: Validates against current + previous bucket
