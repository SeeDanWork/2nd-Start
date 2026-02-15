import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Query('userId') userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.notificationService.getNotifications(userId, limit);
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string) {
    await this.notificationService.markRead(id);
    return { success: true };
  }
}
