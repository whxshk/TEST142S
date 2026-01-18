-- SharkBand Initial Database Schema
-- PostgreSQL 16+
-- Multi-tenant loyalty platform with immutable ledger

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TENANT MANAGEMENT
-- ============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenants_created_at ON tenants(created_at);

-- ============================================
-- LOCATIONS
-- ============================================

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_locations_tenant_id ON locations(tenant_id);
CREATE INDEX idx_locations_is_active ON locations(is_active);

-- ============================================
-- USERS (Staff & Merchant Owners)
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    roles JSONB DEFAULT '[]',
    scopes JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ============================================
-- CUSTOMERS
-- ============================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_token_secret VARCHAR(255) NOT NULL,
    rotation_interval_sec INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_created_at ON customers(created_at);

-- ============================================
-- CUSTOMER MERCHANT ACCOUNTS (Memberships)
-- ============================================

CREATE TABLE customer_merchant_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    membership_status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, tenant_id)
);

CREATE INDEX idx_customer_merchant_accounts_customer_id ON customer_merchant_accounts(customer_id);
CREATE INDEX idx_customer_merchant_accounts_tenant_id ON customer_merchant_accounts(tenant_id);
CREATE INDEX idx_customer_merchant_accounts_status ON customer_merchant_accounts(membership_status);

-- ============================================
-- TRANSACTIONS (Business Transaction Headers)
-- ============================================

CREATE TYPE transaction_type AS ENUM ('ISSUE', 'REDEEM');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    idempotency_key VARCHAR(255) NOT NULL,
    device_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_idempotency_key ON transactions(idempotency_key);

-- ============================================
-- LOYALTY LEDGER ENTRIES (IMMUTABLE APPEND-ONLY)
-- ============================================

CREATE TABLE loyalty_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, idempotency_key, operation_type)
);

CREATE INDEX idx_ledger_entries_tenant_id ON loyalty_ledger_entries(tenant_id);
CREATE INDEX idx_ledger_entries_transaction_id ON loyalty_ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_customer_id ON loyalty_ledger_entries(customer_id);
CREATE INDEX idx_ledger_entries_created_at ON loyalty_ledger_entries(created_at);
CREATE INDEX idx_ledger_entries_tenant_customer ON loyalty_ledger_entries(tenant_id, customer_id, created_at);

-- Prevent updates and deletes on ledger entries
CREATE OR REPLACE FUNCTION prevent_ledger_modifications()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Loyalty ledger entries are immutable and cannot be updated';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Loyalty ledger entries are immutable and cannot be deleted';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_ledger_updates
    BEFORE UPDATE OR DELETE ON loyalty_ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_modifications();

-- ============================================
-- REWARDS
-- ============================================

CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    points_required DECIMAL(15, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rewards_tenant_id ON rewards(tenant_id);
CREATE INDEX idx_rewards_is_active ON rewards(is_active);

-- ============================================
-- REDEMPTIONS
-- ============================================

CREATE TYPE redemption_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
    points_deducted DECIMAL(15, 2) NOT NULL,
    status redemption_status DEFAULT 'PENDING',
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX idx_redemptions_tenant_id ON redemptions(tenant_id);
CREATE INDEX idx_redemptions_customer_id ON redemptions(customer_id);
CREATE INDEX idx_redemptions_reward_id ON redemptions(reward_id);
CREATE INDEX idx_redemptions_status ON redemptions(status);
CREATE INDEX idx_redemptions_idempotency_key ON redemptions(idempotency_key);

-- ============================================
-- RULESETS
-- ============================================

CREATE TABLE rulesets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_type VARCHAR(100) NOT NULL,
    config JSONB DEFAULT '{}',
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rulesets_tenant_id ON rulesets(tenant_id);
CREATE INDEX idx_rulesets_rule_type ON rulesets(rule_type);
CREATE INDEX idx_rulesets_effective_dates ON rulesets(effective_from, effective_to);

-- ============================================
-- DEVICES
-- ============================================

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    device_identifier VARCHAR(255) NOT NULL,
    registered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, device_identifier)
);

CREATE INDEX idx_devices_tenant_id ON devices(tenant_id);
CREATE INDEX idx_devices_location_id ON devices(location_id);
CREATE INDEX idx_devices_is_active ON devices(is_active);
CREATE INDEX idx_devices_identifier ON devices(device_identifier);

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- OUTBOX EVENTS (Transactional Outbox Pattern)
-- ============================================

CREATE TYPE outbox_event_status AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status outbox_event_status DEFAULT 'PENDING',
    published_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_outbox_events_tenant_id ON outbox_events(tenant_id);
CREATE INDEX idx_outbox_events_status ON outbox_events(status);
CREATE INDEX idx_outbox_events_created_at ON outbox_events(created_at);
CREATE INDEX idx_outbox_events_pending ON outbox_events(status, created_at) WHERE status = 'PENDING';

-- ============================================
-- READ MODELS (Denormalized for Analytics)
-- ============================================

CREATE TABLE customer_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, customer_id)
);

CREATE INDEX idx_customer_balances_tenant_id ON customer_balances(tenant_id);
CREATE INDEX idx_customer_balances_customer_id ON customer_balances(customer_id);
CREATE INDEX idx_customer_balances_last_updated ON customer_balances(last_updated_at);

CREATE TABLE transaction_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type transaction_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id)
);

CREATE INDEX idx_transaction_summaries_tenant_id ON transaction_summaries(tenant_id);
CREATE INDEX idx_transaction_summaries_customer_id ON transaction_summaries(customer_id);
CREATE INDEX idx_transaction_summaries_date ON transaction_summaries(transaction_date);
CREATE INDEX idx_transaction_summaries_type ON transaction_summaries(type);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE loyalty_ledger_entries IS 'IMMUTABLE APPEND-ONLY: Single source of truth for loyalty points. Balances are DERIVED from entries, not stored.';
COMMENT ON TABLE outbox_events IS 'Transactional Outbox Pattern: Events written atomically with domain writes, published by dispatcher to NATS.';
COMMENT ON TABLE customer_balances IS 'Read Model: Denormalized balance updated via NATS event consumers. Derived from loyalty_ledger_entries.';
COMMENT ON TABLE transactions IS 'Business transaction headers. Idempotency enforced via UNIQUE(tenant_id, idempotency_key).';
