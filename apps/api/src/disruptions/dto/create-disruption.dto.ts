import { IsString, IsEnum, IsOptional, IsDateString, IsObject } from 'class-validator';
import { DisruptionEventType, DisruptionScope, OverrideStrength } from '@adcp/shared';

export class CreateDisruptionDto {
  @IsEnum(DisruptionEventType)
  type!: DisruptionEventType;

  @IsEnum(DisruptionScope)
  @IsOptional()
  scope?: DisruptionScope;

  @IsEnum(OverrideStrength)
  @IsOptional()
  overrideStrength?: OverrideStrength;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
