import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('change_budget_ledgers')
export class ChangeBudgetLedger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'date' })
  month!: string;

  @Column({ type: 'int', name: 'budget_limit' })
  budgetLimit!: number;

  @Column({ type: 'int', default: 0 })
  used!: number;
}
