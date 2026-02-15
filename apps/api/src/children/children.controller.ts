import { Controller, Get } from '@nestjs/common';
import { ChildrenService } from './children.service';

@Controller('families/:familyId/children')
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'children' };
  }
}
