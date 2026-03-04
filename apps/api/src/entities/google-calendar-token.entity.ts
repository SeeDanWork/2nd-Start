import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_calendar_tokens')
export class GoogleCalendarToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId!: string;

  @Column({ type: 'text', name: 'access_token_encrypted' })
  accessTokenEncrypted!: string;

  @Column({ type: 'text', name: 'refresh_token_encrypted' })
  refreshTokenEncrypted!: string;

  @Column({ type: 'timestamptz', name: 'token_expiry' })
  tokenExpiry!: Date;

  @Column({ type: 'text', name: 'google_email' })
  googleEmail!: string;

  @Column({ type: 'text', name: 'calendar_id', nullable: true })
  calendarId!: string | null;

  @Column({ type: 'text', name: 'sync_status', default: 'active' })
  syncStatus!: string;

  @Column({ type: 'text', name: 'last_sync_error', nullable: true })
  lastSyncError!: string | null;

  @Column({ type: 'timestamptz', name: 'last_synced_at', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
