/**
 * Seed script: creates test users, a family, a child, and a basic constraint set.
 *
 * Usage: npx ts-node src/seeds/run.ts
 * Requires: Postgres running with schema synced (start the API once first).
 */
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'adcp',
  password: process.env.DATABASE_PASSWORD || 'adcp_dev_password',
  database: process.env.DATABASE_NAME || 'adcp',
});

async function seed() {
  await ds.initialize();
  const qr = ds.createQueryRunner();

  const parentAId = randomUUID();
  const parentBId = randomUUID();
  const familyId = randomUUID();
  const constraintSetId = randomUUID();

  // Users
  await qr.query(
    `INSERT INTO users (id, email, display_name, timezone, onboarding_completed)
     VALUES ($1, $2, $3, $4, true), ($5, $6, $7, $8, true)
     ON CONFLICT DO NOTHING`,
    [
      parentAId, 'alice@example.com', 'Alice', 'America/New_York',
      parentBId, 'bob@example.com', 'Bob', 'America/New_York',
    ],
  );

  // Family
  await qr.query(
    `INSERT INTO families (id, name, timezone, status, weekend_definition)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [familyId, 'Smith-Jones Family', 'America/New_York', 'active', 'fri_sat'],
  );

  // Memberships
  await qr.query(
    `INSERT INTO family_memberships (id, family_id, user_id, role, label, invite_status, accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW()), ($7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT DO NOTHING`,
    [
      randomUUID(), familyId, parentAId, 'parent_a', 'Mom', 'accepted',
      randomUUID(), familyId, parentBId, 'parent_b', 'Dad', 'accepted',
    ],
  );

  // Child
  await qr.query(
    `INSERT INTO children (id, family_id, first_name, date_of_birth, school_start_date)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [randomUUID(), familyId, 'Charlie', '2020-06-15', '2025-09-01'],
  );

  // Constraint set
  await qr.query(
    `INSERT INTO constraint_sets (id, family_id, version, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [constraintSetId, familyId, 1, true, parentAId],
  );

  // Sample constraints: Mom locked Mon/Tue, Dad locked Thu/Fri, max 5 consecutive each
  await qr.query(
    `INSERT INTO constraints (id, constraint_set_id, type, hardness, weight, owner, parameters)
     VALUES
       ($1, $2, 'locked_night', 'hard', 100, 'parent_a', $3),
       ($4, $5, 'locked_night', 'hard', 100, 'parent_b', $6),
       ($7, $8, 'max_consecutive', 'hard', 100, 'parent_a', $9),
       ($10, $11, 'max_consecutive', 'hard', 100, 'parent_b', $12)
     ON CONFLICT DO NOTHING`,
    [
      randomUUID(), constraintSetId, JSON.stringify({ parent: 'parent_a', daysOfWeek: [1, 2] }),
      randomUUID(), constraintSetId, JSON.stringify({ parent: 'parent_b', daysOfWeek: [4, 5] }),
      randomUUID(), constraintSetId, JSON.stringify({ parent: 'parent_a', maxNights: 5 }),
      randomUUID(), constraintSetId, JSON.stringify({ parent: 'parent_b', maxNights: 5 }),
    ],
  );

  console.log('Seed complete!');
  console.log(`  Family ID: ${familyId}`);
  console.log(`  Parent A (Alice): ${parentAId}`);
  console.log(`  Parent B (Bob):   ${parentBId}`);
  console.log('');
  console.log('To get a JWT for Alice, call:');
  console.log('  POST /auth/magic-link { "email": "alice@example.com" }');
  console.log('  Then copy the token from the server console log and call:');
  console.log('  POST /auth/verify { "token": "<token>" }');

  await qr.release();
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
