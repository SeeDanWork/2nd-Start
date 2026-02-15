import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('emergency_modes')
export class EmergencyMode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'activated_by' })
  activatedBy!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'activated_at' })
  activatedAt!: Date;

  @Column({ type: 'date', name: 'return_to_baseline_at' })
  returnToBaselineAt!: string;

  @Column({ type: 'jsonb', name: 'relaxed_constraints', default: '[]' })
  relaxedConstraints!: Record<string, unknown>[];

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @Column({ type: 'timestamptz', name: 'returned_at', nullable: true })
  returnedAt!: Date | null;
}
