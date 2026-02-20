/**
 * Seed script: creates test users, a family, a child, and a basic constraint set.
 *
 * Usage: npx ts-node src/seeds/run.ts
 * Requires: Postgres running with schema synced (start the API once first).
 *
 * Uses fixed UUIDs so the seed is idempotent (safe to re-run).
 */
import { DataSource } from 'typeorm';

// Fixed IDs for idempotent seeding
const parentAId = '00000000-0000-4000-a000-000000000001';
const parentBId = '00000000-0000-4000-a000-000000000002';
const familyId = '00000000-0000-4000-a000-000000000010';
const childId = '00000000-0000-4000-a000-000000000020';
const constraintSetId = '00000000-0000-4000-a000-000000000030';
const memberAId = '00000000-0000-4000-a000-000000000041';
const memberBId = '00000000-0000-4000-a000-000000000042';
const constraint1Id = '00000000-0000-4000-a000-000000000051';
const constraint2Id = '00000000-0000-4000-a000-000000000052';
const constraint3Id = '00000000-0000-4000-a000-000000000053';
const constraint4Id = '00000000-0000-4000-a000-000000000054';

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

  // Clean previous seed data (reverse FK order, match by email to handle old random IDs)
  await qr.query(`DELETE FROM constraints WHERE constraint_set_id IN (SELECT id FROM constraint_sets WHERE family_id = $1)`, [familyId]);
  await qr.query(`DELETE FROM constraint_sets WHERE family_id = $1`, [familyId]);
  await qr.query(`DELETE FROM children WHERE family_id = $1`, [familyId]);
  await qr.query(`DELETE FROM family_memberships WHERE family_id = $1`, [familyId]);
  await qr.query(`DELETE FROM families WHERE id = $1`, [familyId]);
  // Also clean by email in case old random-UUID users exist
  await qr.query(`DELETE FROM family_memberships WHERE user_id IN (SELECT id FROM users WHERE email IN ($1, $2))`, ['alice@example.com', 'bob@example.com']);
  await qr.query(`DELETE FROM users WHERE email IN ($1, $2)`, ['alice@example.com', 'bob@example.com']);

  // Users
  await qr.query(
    `INSERT INTO users (id, email, display_name, timezone, onboarding_completed)
     VALUES ($1, $2, $3, $4, true), ($5, $6, $7, $8, true)`,
    [
      parentAId, 'alice@example.com', 'Alice', 'America/New_York',
      parentBId, 'bob@example.com', 'Bob', 'America/New_York',
    ],
  );

  // Family
  await qr.query(
    `INSERT INTO families (id, name, timezone, status, weekend_definition)
     VALUES ($1, $2, $3, $4, $5)`,
    [familyId, 'Smith-Jones Family', 'America/New_York', 'active', 'fri_sat'],
  );

  // Memberships
  await qr.query(
    `INSERT INTO family_memberships (id, family_id, user_id, role, label, invite_status, accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW()), ($7, $8, $9, $10, $11, $12, NOW())`,
    [
      memberAId, familyId, parentAId, 'parent_a', 'Mom', 'accepted',
      memberBId, familyId, parentBId, 'parent_b', 'Dad', 'accepted',
    ],
  );

  // Child
  await qr.query(
    `INSERT INTO children (id, family_id, first_name, date_of_birth, school_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [childId, familyId, 'Charlie', '2020-06-15', 'Maple Elementary'],
  );

  // Constraint set
  await qr.query(
    `INSERT INTO constraint_sets (id, family_id, version, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [constraintSetId, familyId, 1, true, parentAId],
  );

  // Sample constraints: Mom locked Mon/Tue, Dad locked Thu/Fri, max 5 consecutive each
  await qr.query(
    `INSERT INTO constraints (id, constraint_set_id, type, hardness, weight, owner, parameters)
     VALUES
       ($1, $2, 'locked_night', 'hard', 100, 'parent_a', $3),
       ($4, $5, 'locked_night', 'hard', 100, 'parent_b', $6),
       ($7, $8, 'max_consecutive', 'hard', 100, 'parent_a', $9),
       ($10, $11, 'max_consecutive', 'hard', 100, 'parent_b', $12)`,
    [
      constraint1Id, constraintSetId, JSON.stringify({ parent: 'parent_a', daysOfWeek: [1, 2] }),
      constraint2Id, constraintSetId, JSON.stringify({ parent: 'parent_b', daysOfWeek: [4, 5] }),
      constraint3Id, constraintSetId, JSON.stringify({ parent: 'parent_a', maxNights: 5 }),
      constraint4Id, constraintSetId, JSON.stringify({ parent: 'parent_b', maxNights: 5 }),
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
