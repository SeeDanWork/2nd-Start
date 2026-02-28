import { IsString, IsEnum, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { DisruptionEventType, OverlayActionType, OverrideStrength } from '@adcp/shared';

export class CreatePolicyDto {
  @IsEnum(DisruptionEventType)
  appliesToEventType!: DisruptionEventType;

  @IsEnum(OverlayActionType)
  actionType!: OverlayActionType;

  @IsEnum(OverrideStrength)
  @IsOptional()
  defaultStrength?: OverrideStrength;

  @IsObject()
  @IsOptional()
  promptingRules?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  fairnessAccounting?: Record<string, unknown>;
}
