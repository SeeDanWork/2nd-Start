import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { RequestsService } from './requests.service';

@Controller('families/:familyId/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  async create(
    @Param('familyId') familyId: string,
    @Body()
    dto: {
      userId: string;
      type: string;
      dates: string[];
      reasonTag?: string;
      reasonNote?: string;
      urgency?: string;
    },
  ) {
    return this.requestsService.create(familyId, dto.userId, dto);
  }

  @Get()
  async list(
    @Param('familyId') familyId: string,
    @Query('status') status?: string,
  ) {
    const statuses = status ? status.split(',').map((s) => s.trim()) : undefined;
    return this.requestsService.list(familyId, statuses);
  }

  @Get('budget')
  async getBudget(
    @Param('familyId') familyId: string,
    @Query('userId') userId: string,
  ) {
    return this.requestsService.getBudget(familyId, userId);
  }

  @Get(':requestId')
  async get(
    @Param('familyId') familyId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.requestsService.get(familyId, requestId);
  }

  @Post(':requestId/cancel')
  async cancel(
    @Param('familyId') familyId: string,
    @Param('requestId') requestId: string,
    @Body('userId') userId: string,
  ) {
    return this.requestsService.cancel(familyId, requestId, userId);
  }

  @Post('impact-preview')
  async impactPreview(
    @Param('familyId') familyId: string,
    @Body('dates') dates: string[],
  ) {
    return this.requestsService.getImpactPreview(familyId, dates);
  }
}
