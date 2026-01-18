-- Pilot Metrics Tables
-- Denormalized metrics for pilot reporting

-- Daily metrics per tenant/location
CREATE TABLE pilot_daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    metric_date DATE NOT NULL,
    
    -- Customer metrics
    active_customers INTEGER DEFAULT 0,
    repeat_customers INTEGER DEFAULT 0, -- customers with >=2 transactions in last 7 days
    
    -- Transaction metrics
    transactions_issue INTEGER DEFAULT 0,
    transactions_redeem INTEGER DEFAULT 0,
    transactions_adjust INTEGER DEFAULT 0,
    transactions_reverse INTEGER DEFAULT 0,
    transactions_total INTEGER DEFAULT 0,
    
    -- Redemption metrics
    redemption_rate DECIMAL(5, 4) DEFAULT 0, -- redeems / issues (if issues > 0)
    avg_time_to_redeem_hours DECIMAL(10, 2), -- average hours between issue and redeem
    
    -- Error metrics
    scan_errors_expired_qr INTEGER DEFAULT 0,
    scan_errors_insufficient_balance INTEGER DEFAULT 0,
    scan_errors_unauthorized_device INTEGER DEFAULT 0,
    scan_errors_total INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, location_id, metric_date)
);

CREATE INDEX idx_pilot_daily_metrics_tenant_date ON pilot_daily_metrics(tenant_id, metric_date);
CREATE INDEX idx_pilot_daily_metrics_location_date ON pilot_daily_metrics(location_id, metric_date);

-- Onboarding funnel tracking
CREATE TABLE pilot_onboarding_funnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    merchant_signup_at TIMESTAMP WITH TIME ZONE,
    first_location_created_at TIMESTAMP WITH TIME ZONE,
    first_staff_invited_at TIMESTAMP WITH TIME ZONE,
    first_device_registered_at TIMESTAMP WITH TIME ZONE,
    first_scan_at TIMESTAMP WITH TIME ZONE,
    
    -- Calculated durations (in minutes)
    time_to_location_minutes INTEGER,
    time_to_staff_minutes INTEGER,
    time_to_device_minutes INTEGER,
    time_to_first_scan_minutes INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id)
);

CREATE INDEX idx_pilot_onboarding_funnel_tenant ON pilot_onboarding_funnel(tenant_id);

-- Customer activity tracking (for repeat customer calculation)
CREATE TABLE pilot_customer_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    first_transaction_at TIMESTAMP WITH TIME ZONE,
    last_transaction_at TIMESTAMP WITH TIME ZONE,
    transaction_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, customer_id)
);

CREATE INDEX idx_pilot_customer_activity_tenant ON pilot_customer_activity(tenant_id);
CREATE INDEX idx_pilot_customer_activity_customer ON pilot_customer_activity(customer_id);
CREATE INDEX idx_pilot_customer_activity_last_transaction ON pilot_customer_activity(tenant_id, last_transaction_at);

-- Reward usage tracking
CREATE TABLE pilot_reward_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    redemption_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, reward_id, metric_date)
);

CREATE INDEX idx_pilot_reward_usage_tenant_date ON pilot_reward_usage(tenant_id, metric_date);
