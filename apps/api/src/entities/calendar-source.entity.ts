import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('calendar_sources')
@Index('idx_calendar_source_family', ['familyId'])
export class CalendarSource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'text' })
  type!: string; // 'ics_feed' | 'google_calendar' | 'manual'

  @Column({ type: 'text' })
  label!: string; // e.g. "Springfield Elementary Calendar"

  @Column({ type: 'text', nullable: true })
  url!: string | null; // ICS feed URL

  @Column({ type: 'text', name: 'google_calendar_id', nullable: true })
  googleCalendarId!: string | null;

  @Column({ type: 'text', name: 'google_user_id', nullable: true })
  googleUserId!: string | null;

  @Column({ type: 'int', name: 'sync_frequency_hours', default: 24 })
  syncFrequencyHours!: number;

  @Column({ type: 'int', default: 0 })
  precedence!: number; // higher = overrides lower; manual=100, ics=50, google=25

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', name: 'last_synced_at', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'text', name: 'last_sync_error', nullable: true })
  lastSyncError!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
