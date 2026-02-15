import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProposalBundle } from './proposal-bundle.entity';

@Entity('proposal_options')
export class ProposalOption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'bundle_id' })
  bundleId!: string;

  @Column({ type: 'int' })
  rank!: number;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ type: 'jsonb', name: 'calendar_diff' })
  calendarDiff!: Record<string, unknown>[];

  @Column({ type: 'jsonb', name: 'fairness_impact' })
  fairnessImpact!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'stability_impact' })
  stabilityImpact!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'handoff_impact' })
  handoffImpact!: Record<string, unknown>;

  @Column({ type: 'float', name: 'penalty_score' })
  penaltyScore!: number;

  @Column({ type: 'boolean', name: 'is_auto_approvable', default: false })
  isAutoApprovable!: boolean;

  @ManyToOne(() => ProposalBundle, (b) => b.options)
  @JoinColumn({ name: 'bundle_id' })
  bundle!: ProposalBundle;
}
