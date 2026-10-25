-- Database PostgreSQL
-- DB users
-- DB quotes
-- Jalankan di server database.

CREATE TABLE IF NOT EXISTS users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  name           VARCHAR(150) NOT NULL,
  password_hash  TEXT         NOT NULL,              -- format: scrypt$<salt>$<hash>, JANGAN simpan password asli
  role           VARCHAR(30)  NOT NULL DEFAULT 'user'
                 CHECK (role IN ('admin', 'user')),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Email unik, tidak case-sensitive
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (LOWER(email));

-- Auto-update kolom updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Membuat user pertama: jalankan dari project
--   node --env-file=.env.local scripts/create-user.mjs admin@demo.com "Admin" "PasswordKuat123" admin

CREATE TABLE IF NOT EXISTS quote (
  quote_id SERIAL PRIMARY KEY,
  public_figure TEXT,
  quote_text TEXT,
  main_topic TEXT,
  interpretation TEXT,
  real_life_event TEXT,
  fun_fact TEXT,
  related_event TEXT,
  url TEXT,
  status VARCHAR DEFAULT 'Draft',
  agent_stat VARCHAR,
  hashtag TEXT,
  hook_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);