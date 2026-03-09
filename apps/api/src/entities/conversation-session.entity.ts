import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Family } from './family.entity';

@Entity('conversation_sessions')
export class ConversationSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'family_id', nullable: true })
  familyId!: string | null;

  @Column({ type: 'text', default: 'idle' })
  state!: string;

  @Column({ type: 'jsonb', default: '{}' })
  context!: Record<string, unknown>;

  @Column({ type: 'text' })
  channel!: string;

  @Column({ type: 'text', name: 'phone_number' })
  phoneNumber!: string;

  @Column({ type: 'timestamptz', name: 'last_message_at', nullable: true })
  lastMessageAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Family)
  @JoinColumn({ name: 'family_id' })
  family!: Family;
}
