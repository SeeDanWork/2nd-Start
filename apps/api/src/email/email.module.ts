import { Global, Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email.provider';
import { EmailService } from './email.service';
import { ConsoleEmailProvider } from './providers/console.provider';
import { ResendEmailProvider } from './providers/resend.provider';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: () => {
        const provider = process.env.EMAIL_PROVIDER || 'console';
        if (provider === 'resend') {
          return new ResendEmailProvider();
        }
        return new ConsoleEmailProvider();
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
