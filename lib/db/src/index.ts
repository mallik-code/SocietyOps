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
      id          SERIAL PRIMARY KEY,
      text        TEXT NOT NULL,
      sender      TEXT NOT NULL,
      group_name  TEXT,
      category    TEXT,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_groups (
      id            SERIAL PRIMARY KEY,
      group_id      TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export * from "./schema";
