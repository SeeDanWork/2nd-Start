import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO: Implement JWT validation in Phase 1
    return true;
  }
}
