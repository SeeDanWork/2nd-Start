import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class FamilyMemberGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO: Validate user is member of :familyId in Phase 1
    return true;
  }
}
