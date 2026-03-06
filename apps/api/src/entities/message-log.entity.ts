import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ConversationSession } from './conversation-session.entity';

@Entity('message_logs')
export class MessageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'conversation_session_id' })
  conversationSessionId!: string;

  @Column({ type: 'text' })
  direction!: string;

  @Column({ type: 'text' })
  channel!: string;

  @Column({ type: 'text', name: 'from_number' })
  fromNumber!: string;

  @Column({ type: 'text', name: 'to_number' })
  toNumber!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'jsonb', name: 'parsed_intent', nullable: true })
  parsedIntent!: Record<string, unknown> | null;

  @Column({ type: 'float', nullable: true })
  confidence!: number | null;

  @Column({ type: 'text', name: 'provider_message_id', nullable: true })
  providerMessageId!: string | null;

  @Column({ type: 'text', name: 'delivery_status', default: 'queued' })
  deliveryStatus!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => ConversationSession)
  @JoinColumn({ name: 'conversation_session_id' })
  conversationSession!: ConversationSession;
}
