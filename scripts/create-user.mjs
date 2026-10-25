// Usage: node --env-file=.env.local scripts/create-user.mjs <email> <name> <password> [role]
import pg from 'pg';
import { scryptSync, randomBytes } from 'crypto';

const [email, name, password, role = 'user'] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-user.mjs <email> <name> <password> [role]');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const res = await client.query(
    'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
    [email.trim().toLowerCase(), name, hash, role]
  );
  console.log('User dibuat:', res.rows[0]);
} finally {
  await client.end();
}
