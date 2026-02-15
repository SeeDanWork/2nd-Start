import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('share_links')
@Index('idx_share_token', ['token'], { unique: true })
export class ShareLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'text', unique: true })
  token!: string;

  @Column({ type: 'text' })
  scope!: string;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ type: 'text', default: 'web' })
  format!: string;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
