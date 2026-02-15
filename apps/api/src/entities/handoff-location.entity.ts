import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('handoff_locations')
export class HandoffLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'boolean', name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ type: 'jsonb', name: 'available_windows', default: '[]' })
  availableWindows!: Record<string, unknown>[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
