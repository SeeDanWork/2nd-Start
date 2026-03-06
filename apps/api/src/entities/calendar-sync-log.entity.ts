import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('calendar_sync_logs')
@Index('idx_sync_log_source', ['sourceId'])
export class CalendarSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'source_id' })
  sourceId!: string;

  @Column({ type: 'text' })
  status!: string; // 'success' | 'error' | 'partial'

  @Column({ type: 'int', name: 'events_found', default: 0 })
  eventsFound!: number;

  @Column({ type: 'int', name: 'events_created', default: 0 })
  eventsCreated!: number;

  @Column({ type: 'int', name: 'events_updated', default: 0 })
  eventsUpdated!: number;

  @Column({ type: 'int', name: 'disruptions_created', default: 0 })
  disruptionsCreated!: number;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', name: 'duration_ms', default: 0 })
  durationMs!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'synced_at' })
  syncedAt!: Date;
}
