import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FamilyMembership } from './family-membership.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text', name: 'display_name' })
  displayName!: string;

  @Column({ type: 'text', default: 'America/New_York' })
  timezone!: string;

  @Column({ type: 'jsonb', name: 'notification_preferences', default: '{"email":true,"push":false,"reminderHoursBefore":24}' })
  notificationPreferences!: Record<string, unknown>;

  @Column({ type: 'text', array: true, name: 'device_tokens', default: '{}' })
  deviceTokens!: string[];

  @Column({ type: 'text', name: 'phone_number', nullable: true, unique: true })
  phoneNumber!: string | null;

  @Column({ type: 'text', name: 'messaging_channel', nullable: true })
  messagingChannel!: string | null;

  @Column({ type: 'boolean', name: 'onboarding_completed', default: false })
  onboardingCompleted!: boolean;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => FamilyMembership, (m) => m.user)
  memberships!: FamilyMembership[];
}
