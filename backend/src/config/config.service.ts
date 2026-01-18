import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
}

export interface JwtConfig {
  secret: string;
  accessTokenExpiry: string;
  refreshTokenSecret: string;
  refreshTokenExpiry: string;
}

export interface NatsConfig {
  url: string;
  clusterId: string;
  clientId: string;
}

export interface OutboxConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
}

export interface QrTokenConfig {
  rotationIntervalSec: number;
  clockSkewToleranceSec: number;
}

export interface PilotConfig {
  enabled: boolean;
  strictLogging: boolean;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: DatabaseConfig;
  jwt: JwtConfig;
  nats: NatsConfig;
  outbox: OutboxConfig;
  qrToken: QrTokenConfig;
  pilot: PilotConfig;
}

export const ConfigService = {
  loadConfig: (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    database: {
      url: process.env.DATABASE_URL || 'postgresql://sharkband:sharkband@localhost:5432/sharkband',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
      refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-in-production',
      refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
    },
    nats: {
      url: process.env.NATS_URL || 'nats://localhost:4222',
      clusterId: process.env.NATS_CLUSTER_ID || 'sharkband-cluster',
      clientId: process.env.NATS_CLIENT_ID || 'sharkband-backend',
    },
    outbox: {
      pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '5000', 10),
      batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '100', 10),
      maxRetries: parseInt(process.env.OUTBOX_MAX_RETRIES || '3', 10),
    },
    qrToken: {
      rotationIntervalSec: parseInt(process.env.QR_TOKEN_ROTATION_INTERVAL_SEC || '30', 10),
      clockSkewToleranceSec: parseInt(process.env.QR_TOKEN_CLOCK_SKEW_TOLERANCE_SEC || '60', 10),
    },
    pilot: {
      enabled: process.env.PILOT_MODE === 'true' || process.env.NODE_ENV === 'development',
      strictLogging: process.env.PILOT_STRICT_LOGGING === 'true',
    },
  }),
};

export default registerAs('app', ConfigService.loadConfig);
