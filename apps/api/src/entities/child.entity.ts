import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Family } from './family.entity';

@Entity('children')
export class Child {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'text', name: 'first_name' })
  firstName!: string;

  @Column({ type: 'date', name: 'date_of_birth', nullable: true })
  dateOfBirth!: string | null;

  @Column({ type: 'text', name: 'school_name', nullable: true })
  schoolName!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Family, (f) => f.children)
  @JoinColumn({ name: 'family_id' })
  family!: Family;
}
