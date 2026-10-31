import { Pool, PoolConfig } from 'pg';

function getSSLConfig(): PoolConfig['ssl'] {
  const dbUrl = process.env.DATABASE_URL || '';

  // 1. Jika URL database eksplisit menonaktifkan SSL
  if (dbUrl.includes('sslmode=disable') || dbUrl.includes('ssl=false')) {
    return false;
  }

  // 2. Jika ada environment variable DATABASE_SSL
  if (process.env.DATABASE_SSL === 'false') {
    return false;
  }
  if (process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }

  // 3. Jika URL database eksplisit meminta SSL (misal sslmode=require / verify-ca / verify-full)
  if (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) {
    return { rejectUnauthorized: false };
  }

  // 4. Deteksi koneksi internal container Docker / localhost
  try {
    const parsed = new URL(dbUrl);
    const hostname = parsed.hostname;
    // Hostname internal container docker (contoh: "postgres", "db", "postgres_container") biasanya tidak memiliki dot (dotless)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || !hostname.includes('.')) {
      return false;
    }
  } catch {
    // fallback jika bukan valid URL string
  }

  // 5. Default production untuk cloud database (Neon, Supabase, RDS)
  return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSSLConfig(),
});

export default pool;