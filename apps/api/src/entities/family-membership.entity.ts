import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Family } from './family.entity';

@Entity('family_memberships')
export class FamilyMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'text' })
  role!: string;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'text', name: 'invite_status', default: 'pending' })
  inviteStatus!: string;

  @Column({ type: 'text', name: 'invite_email', nullable: true })
  inviteEmail!: string | null;

  @Column({ type: 'timestamptz', name: 'invited_at', nullable: true })
  invitedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Family, (f) => f.memberships)
  @JoinColumn({ name: 'family_id' })
  family!: Family;

  @ManyToOne(() => User, (u) => u.memberships)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
