import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('notification_records')
export class NotificationRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text' })
  channel!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId!: string | null;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt!: Date | null;
}
