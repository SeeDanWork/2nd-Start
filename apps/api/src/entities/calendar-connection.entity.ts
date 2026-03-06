import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Family } from './family.entity';

@Entity('calendar_connections')
export class CalendarConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'text' })
  provider!: string; // 'google' | 'apple' | 'outlook'

  @Column({ type: 'text', name: 'access_token', nullable: true })
  accessToken!: string | null;

  @Column({ type: 'text', name: 'refresh_token', nullable: true })
  refreshToken!: string | null;

  @Column({ type: 'text', name: 'calendar_id', nullable: true })
  calendarId!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', name: 'last_sync_at', nullable: true })
  lastSyncAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Family)
  @JoinColumn({ name: 'family_id' })
  family!: Family;
}
