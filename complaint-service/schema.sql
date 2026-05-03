-- ============================================================
-- WhatsApp Complaint Management System — SQLite Schema
-- ============================================================
-- Apply with:  sqlite3 data/complaints.db < schema.sql
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─────────────────────────────────────────────────────────────
-- 1. tickets
--    Core entity. One ticket per complaint message.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    message_text  TEXT    NOT NULL,
    category      TEXT,                          -- AI-classified category
    priority      TEXT    NOT NULL               -- Low | Medium | High | Critical
                  CHECK (priority IN ('Low','Medium','High','Critical'))
                  DEFAULT 'Medium',
    location      TEXT,                          -- extracted or provided location
    status        TEXT    NOT NULL               -- open | in_progress | resolved | delayed | closed
                  CHECK (status IN ('open','in_progress','resolved','delayed','closed'))
                  DEFAULT 'open',
    created_at    TEXT    NOT NULL               -- ISO-8601 UTC timestamp
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at    TEXT    NOT NULL
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    reporter_name TEXT,                          -- WhatsApp display name
    group_name    TEXT,                          -- WhatsApp group name
    is_test       INTEGER NOT NULL DEFAULT 0,    -- 1 if seeded/test data
    confidence    TEXT                           -- AI confidence score
);

-- Keep updated_at in sync automatically
CREATE TRIGGER IF NOT EXISTS tickets_set_updated_at
AFTER UPDATE ON tickets
FOR EACH ROW
BEGIN
    UPDATE tickets
    SET    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE  id = OLD.id;
END;

CREATE INDEX IF NOT EXISTS idx_tickets_status    ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority  ON tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category  ON tickets (category);
CREATE INDEX IF NOT EXISTS idx_tickets_created   ON tickets (created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_group     ON tickets (group_name);

-- ─────────────────────────────────────────────────────────────
-- 2. message_logs
--    Raw audit log of every incoming WhatsApp message.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_message TEXT    NOT NULL,
    sender      TEXT,                            -- WhatsApp sender ID / phone
    group_name  TEXT,
    timestamp   TEXT    NOT NULL
                DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    is_complaint INTEGER,                        -- 1 if AI thinks it is a complaint
    category    TEXT,                            -- AI category
    priority    TEXT,                            -- AI priority
    confidence  TEXT,                            -- AI confidence score
    is_test     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_message_logs_sender    ON message_logs (sender);
CREATE INDEX IF NOT EXISTS idx_message_logs_timestamp ON message_logs (timestamp);

-- ─────────────────────────────────────────────────────────────
-- 3. supervisor_actions
--    Audit trail of every action a supervisor takes on a ticket.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supervisor_actions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL
              REFERENCES tickets (id) ON DELETE CASCADE,
    action    TEXT    NOT NULL                   -- started | resolved | delayed
              CHECK (action IN ('started','resolved','delayed')),
    timestamp TEXT    NOT NULL
              DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    is_test   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_supervisor_actions_ticket ON supervisor_actions (ticket_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_ts     ON supervisor_actions (timestamp);

-- ─────────────────────────────────────────────────────────────
-- Seed data — removed from this file.
-- Use the CSV files in this directory to load test data:
--   seed_tickets.csv          → tickets table
--   seed_message_logs.csv     → message_logs table
--   seed_supervisor_actions.csv → supervisor_actions table
--
-- Example (SQLite):
--   .mode csv
--   .import seed_tickets.csv tickets
--   .import seed_message_logs.csv message_logs
--   .import seed_supervisor_actions.csv supervisor_actions
-- ─────────────────────────────────────────────────────────────

