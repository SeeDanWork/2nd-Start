import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Child } from '../entities';
import { FamilyContextService } from '../family-context/family-context.service';

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    private readonly familyContextService: FamilyContextService,
  ) {}

  async create(familyId: string, data: { firstName: string; dateOfBirth?: string; schoolName?: string }): Promise<Child> {
    const child = await this.childRepo.save(
      this.childRepo.create({ familyId, ...data }),
    );
    await this.familyContextService.refreshContext(familyId);
    return child;
  }

  async update(familyId: string, childId: string, data: Partial<Pick<Child, 'firstName' | 'dateOfBirth' | 'schoolName'>>): Promise<Child> {
    await this.childRepo.update({ id: childId, familyId }, data);
    const child = await this.childRepo.findOne({ where: { id: childId, familyId } });
    if (!child) throw new NotFoundException('Child not found');
    await this.familyContextService.refreshContext(familyId);
    return child;
  }
}
