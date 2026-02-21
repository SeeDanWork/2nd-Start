import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FamilyMembership } from './family-membership.entity';
import { Child } from './child.entity';

@Entity('families')
export class Family {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', default: 'America/New_York' })
  timezone!: string;

  @Column({ type: 'text', name: 'weekend_definition', default: 'fri_sat' })
  weekendDefinition!: string;

  @Column({ type: 'jsonb', name: 'fairness_band', default: '{"maxOvernightDelta":1,"windowWeeks":8}' })
  fairnessBand!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'change_budget', default: '{"maxPerMonth":4}' })
  changeBudget!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'onboarding_input', nullable: true })
  onboardingInput!: Record<string, unknown> | null;

  @Column({ type: 'text', default: 'onboarding' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => FamilyMembership, (m) => m.family)
  memberships!: FamilyMembership[];

  @OneToMany(() => Child, (c) => c.family)
  children!: Child[];
}
