import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { FamiliesModule } from './families/families.module';
import { ChildrenModule } from './children/children.module';
import { ConstraintsModule } from './constraints/constraints.module';
import { HolidaysModule } from './holidays/holidays.module';
import { LocationsModule } from './locations/locations.module';
import { SchedulesModule } from './schedules/schedules.module';
import { RequestsModule } from './requests/requests.module';
import { ProposalsModule } from './proposals/proposals.module';
import { GuardrailsModule } from './guardrails/guardrails.module';
import { MetricsModule } from './metrics/metrics.module';
import { SharingModule } from './sharing/sharing.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { NotificationModule } from './notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'adcp',
      password: process.env.DATABASE_PASSWORD || 'adcp_dev_password',
      database: process.env.DATABASE_NAME || 'adcp',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    FamiliesModule,
    ChildrenModule,
    ConstraintsModule,
    HolidaysModule,
    LocationsModule,
    SchedulesModule,
    RequestsModule,
    ProposalsModule,
    GuardrailsModule,
    MetricsModule,
    SharingModule,
    OnboardingModule,
    NotificationModule,
  ],
})
export class AppModule {}
