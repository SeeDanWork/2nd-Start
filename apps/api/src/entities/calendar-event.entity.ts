import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('calendar_events')
@Index('idx_calendar_event_family_dates', ['familyId', 'startDate', 'endDate'])
@Index('idx_calendar_event_source', ['sourceId'])
@Unique('uq_calendar_event_external', ['sourceId', 'externalId'])
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'source_id' })
  sourceId!: string;

  @Column({ type: 'text', name: 'external_id', nullable: true })
  externalId!: string | null; // UID from ICS or Google event ID

  @Column({ type: 'text', name: 'source_type' })
  sourceType!: string; // 'ics_feed' | 'google_calendar' | 'manual'

  @Column({ type: 'text', name: 'event_type' })
  eventType!: string; // mapped DisruptionEventType

  @Column({ type: 'text', name: 'raw_summary', nullable: true })
  rawSummary!: string | null; // original event title

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: string;

  @Column({ type: 'text', name: 'start_time', nullable: true })
  startTime!: string | null; // HH:mm for partial-day events

  @Column({ type: 'text', name: 'end_time', nullable: true })
  endTime!: string | null;

  @Column({ type: 'float', default: 1.0 })
  confidence!: number; // 1.0 for manual, 0.8 for keyword match

  @Column({ type: 'uuid', name: 'disruption_event_id', nullable: true })
  disruptionEventId!: string | null; // linked DisruptionEvent once resolved

  @Column({ type: 'boolean', name: 'is_resolved', default: false })
  isResolved!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
