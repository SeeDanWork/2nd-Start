import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { EmailModule } from './email/email.module';
import { FamilyContextModule } from './family-context/family-context.module';
import { DisruptionsModule } from './disruptions/disruptions.module';
import { PresetsModule } from './presets/presets.module';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { MediationModule } from './mediation/mediation.module';
import { FeedbackModule } from './feedback/feedback.module';
import { CalendarIntegrationModule } from './calendar-integration/calendar-integration.module';
import { JobsModule } from './jobs/jobs.module';
import { MessagingModule } from './messaging/messaging.module';
import { TimelineModule } from './timeline/timeline.module';

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
    ScheduleModule.forRoot(),
    EmailModule,
    FamilyContextModule,
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
    DisruptionsModule,
    PresetsModule,
    GoogleCalendarModule,
    FeedbackModule,
    MediationModule,
    CalendarIntegrationModule,
    JobsModule,
    MessagingModule,
    TimelineModule,
  ],
})
export class AppModule {}
