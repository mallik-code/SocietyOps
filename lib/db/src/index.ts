import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracked_groups (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      group_id      TEXT NOT NULL UNIQUE,
      description   TEXT,
      enabled       BOOLEAN NOT NULL DEFAULT TRUE,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tracked_contacts (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      phone         TEXT NOT NULL UNIQUE,
      description   TEXT,
      enabled       BOOLEAN NOT NULL DEFAULT TRUE,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS raw_messages (
      id            SERIAL PRIMARY KEY,
      text          TEXT NOT NULL,
      sender        TEXT NOT NULL,
      group_name    TEXT,
      category      TEXT,
      priority      TEXT,
      is_complaint  BOOLEAN,
      confidence    TEXT,
      media         JSONB,
      timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE raw_messages ADD COLUMN IF NOT EXISTS media JSONB;

    CREATE TABLE IF NOT EXISTS whatsapp_groups (
      id            SERIAL PRIMARY KEY,
      group_id      TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employees (
      id            SERIAL PRIMARY KEY,
      full_name     TEXT NOT NULL,
      first_name    TEXT NOT NULL,
      last_name     TEXT NOT NULL,
      department    TEXT NOT NULL,
      role          TEXT NOT NULL,
      manager_id    INTEGER,
      teams_user_id TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leave_records (
      id              SERIAL PRIMARY KEY,
      employee_id     INTEGER NOT NULL,
      leave_date      DATE NOT NULL,
      leave_type      TEXT NOT NULL DEFAULT 'full_day',
      status          TEXT NOT NULL DEFAULT 'approved',
      approved_by_id  INTEGER,
      source_message  TEXT,
      message_log_id  INTEGER,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS message_log (
      id                     SERIAL PRIMARY KEY,
      message_text           TEXT NOT NULL,
      sender_id              INTEGER NOT NULL,
      channel                TEXT,
      intent                 TEXT NOT NULL DEFAULT 'unknown',
      confidence             REAL NOT NULL DEFAULT 0,
      action_taken           TEXT NOT NULL DEFAULT 'ignored',
      clarification_question TEXT,
      agent_output           JSONB,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id    SERIAL PRIMARY KEY,
      date  DATE NOT NULL UNIQUE,
      name  TEXT NOT NULL,
      type  TEXT NOT NULL DEFAULT 'public'
    );

    CREATE TABLE IF NOT EXISTS llm_settings (
      id         SERIAL PRIMARY KEY,
      provider   TEXT NOT NULL DEFAULT 'openai',
      model      TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      api_key    TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export * from "./schema";
