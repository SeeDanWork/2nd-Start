import { Controller, Get, Param } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Controller('viewer')
export class ViewerController {
  constructor(private readonly jwtService: JwtService) {}

  @Get('validate/:token')
  validateToken(@Param('token') token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return {
        valid: true,
        familyId: payload.familyId,
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      return { valid: false };
    }
  }
}
