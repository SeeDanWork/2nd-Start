import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SmsConversationState =
  | 'IDLE'
  | 'AWAITING_CLARIFICATION'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_DATES'
  | 'REGISTRATION';

@Entity('sms_conversations')
export class SmsConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'text', name: 'phone_number' })
  phoneNumber!: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'uuid', name: 'family_id', nullable: true })
  familyId!: string | null;

  @Column({ type: 'text', default: 'IDLE' })
  state!: SmsConversationState;

  @Column({ type: 'jsonb', name: 'pending_intent', nullable: true })
  pendingIntent!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', name: 'last_message_at', default: () => 'NOW()' })
  lastMessageAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
