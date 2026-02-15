import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ProposalOption } from './proposal-option.entity';

@Entity('proposal_bundles')
@Index('idx_proposal_expiry', ['expiresAt'])
export class ProposalBundle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'request_id' })
  requestId!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'text', name: 'solver_run_id', nullable: true })
  solverRunId!: string | null;

  @Column({ type: 'jsonb', name: 'generation_params', nullable: true })
  generationParams!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => ProposalOption, (o) => o.bundle)
  options!: ProposalOption[];
}
