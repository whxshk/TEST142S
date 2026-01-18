import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ConfigService } from './config/config.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { LedgerModule } from './ledger/ledger.module';
import { OutboxModule } from './outbox/outbox.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ReadmodelsModule } from './readmodels/readmodels.module';
import { RewardsModule } from './rewards/rewards.module';
import { RulesetsModule } from './rulesets/rulesets.module';
import { DevicesModule } from './devices/devices.module';
import { CustomersModule } from './customers/customers.module';
import { LocationsModule } from './locations/locations.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { FraudSignalsModule } from './fraud-signals/fraud-signals.module';
import { OperatorToolsModule } from './operator-tools/operator-tools.module';
import { PilotMetricsModule } from './pilot-metrics/pilot-metrics.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [ConfigService.loadConfig],
    }),

    // Database
    PrismaModule,

    // Core modules
    AuthModule,
    TenancyModule,
    LedgerModule,
    OutboxModule,
    TransactionsModule,
    ReadmodelsModule,

    // Domain modules
    RewardsModule,
    RulesetsModule,
    DevicesModule,
    CustomersModule,
    LocationsModule,
    UsersModule,
    AnalyticsModule,
    AuditModule,
    OnboardingModule,
    FraudSignalsModule,
    OperatorToolsModule,
    PilotMetricsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
