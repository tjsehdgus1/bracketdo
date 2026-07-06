-- 001_init: users + dojos (인증 + 검도관 토대)
-- Neon(Postgres 15+)은 gen_random_uuid() 내장.

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  phone         text,
  sido_code     text,
  sido_name     text,
  sigungu_code  text,
  sigungu_name  text,
  dojo_id       uuid,
  role          text NOT NULL CHECK (role IN ('super_admin','admin','club_manager','player')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dojos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  sido_code     text NOT NULL,
  sido_name     text NOT NULL,
  sigungu_code  text NOT NULL,
  sigungu_name  text NOT NULL,
  owner_id      uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, sido_code, sigungu_code)
);

-- users.dojo_id → dojos.id (dojos 생성 이후에 FK 부여)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_dojo_fk,
  ADD CONSTRAINT users_dojo_fk FOREIGN KEY (dojo_id) REFERENCES dojos(id);

CREATE INDEX IF NOT EXISTS idx_dojos_region ON dojos (sido_code, sigungu_code);
