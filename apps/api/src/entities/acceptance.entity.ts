import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('acceptances')
export class Acceptance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'proposal_option_id' })
  proposalOptionId!: string;

  @Column({ type: 'uuid', name: 'accepted_by' })
  acceptedBy!: string;

  @Column({ type: 'text', name: 'acceptance_type' })
  acceptanceType!: string;

  @Column({ type: 'uuid', name: 'resulting_version_id' })
  resultingVersionId!: string;

  @Column({ type: 'uuid', name: 'counter_bundle_id', nullable: true })
  counterBundleId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
