import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CalendarConnection } from './calendar-connection.entity';

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'calendar_connection_id' })
  calendarConnectionId!: string;

  @Column({ type: 'uuid', name: 'assignment_id', nullable: true })
  assignmentId!: string | null;

  @Column({ type: 'text', name: 'external_event_id', nullable: true })
  externalEventId!: string | null;

  @Column({ type: 'text', name: 'event_type' })
  eventType!: string; // custody_block, exchange, holiday, disruption

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'timestamptz', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'timestamptz', name: 'end_time' })
  endTime!: Date;

  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'sync_status', default: 'pending' })
  syncStatus!: string; // pending, synced, failed, stale

  @Column({ type: 'int', name: 'sync_version', default: 1 })
  syncVersion!: number;

  @Column({ type: 'timestamptz', name: 'last_synced_at', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => CalendarConnection)
  @JoinColumn({ name: 'calendar_connection_id' })
  calendarConnection!: CalendarConnection;
}
