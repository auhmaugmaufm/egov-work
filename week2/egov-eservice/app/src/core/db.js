'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL,
  username      TEXT UNIQUE,
  password_hash TEXT,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  dept          TEXT,
  id_hash       TEXT UNIQUE,
  id_enc        TEXT,
  mobile_enc    TEXT,
  email         TEXT,
  registered    INTEGER NOT NULL DEFAULT 0,
  consent_at    TEXT,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  fee         INTEGER NOT NULL,
  fee_per_sqm INTEGER,
  sla         INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  id            INTEGER PRIMARY KEY,
  draft_id      TEXT UNIQUE,
  case_no       TEXT UNIQUE,
  receipt_no    TEXT UNIQUE,
  service_id    TEXT NOT NULL,
  applicant_id  INTEGER NOT NULL,
  qty           INTEGER,
  area_sqm      INTEGER,
  fee           INTEGER NOT NULL,
  fee_locked_at TEXT,
  status        TEXT NOT NULL,
  step          INTEGER,
  current_dept  TEXT,
  visited_depts TEXT NOT NULL DEFAULT '',
  owner         TEXT,
  issuer        TEXT,
  approved_by   TEXT,
  approved_at   TEXT,
  paid_at       TEXT,
  due_at        TEXT,
  return_count  INTEGER NOT NULL DEFAULT 0,
  returned_at   TEXT,
  return_reason TEXT,
  fix_deadline  TEXT,
  closed_at     TEXT,
  reject_reason TEXT,
  cancelled_at  TEXT,
  cancel_reason TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  case_id     INTEGER NOT NULL,
  doc_key     TEXT NOT NULL,
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        BLOB NOT NULL,
  uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  ref           TEXT PRIMARY KEY,
  case_id       INTEGER NOT NULL,
  amount        INTEGER NOT NULL,
  status        TEXT NOT NULL,
  qr_created_at TEXT NOT NULL,
  qr_expires_at TEXT NOT NULL,
  paid_at       TEXT
);
CREATE TABLE IF NOT EXISTS documents (
  doc_no      TEXT PRIMARY KEY,
  case_id     INTEGER NOT NULL UNIQUE,
  case_no     TEXT NOT NULL,
  verify_code TEXT NOT NULL UNIQUE,
  applicant   TEXT NOT NULL,
  service_id  TEXT NOT NULL,
  issued_at   TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  signer      TEXT NOT NULL,
  signature   TEXT NOT NULL,
  issued_by   TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL,
  case_id    INTEGER NOT NULL,
  case_no    TEXT NOT NULL,
  level      TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (username, case_id, level)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  time        TEXT NOT NULL,
  username    TEXT,
  role        TEXT,
  event       TEXT NOT NULL,
  case_no     TEXT,
  from_status TEXT,
  to_status   TEXT,
  detail      TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS case_events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  at      TEXT NOT NULL,
  type    TEXT NOT NULL,
  text    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS otp_attempts (
  id_hash      TEXT PRIMARY KEY,
  fail_count   INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
`;

const TABLES = ['users', 'services', 'holidays', 'counters', 'cases', 'files', 'payments',
  'documents', 'notifications', 'audit_log', 'case_events', 'otp_attempts'];

function removeDbFiles(dbPath) {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try { fs.rmSync(dbPath + suffix, { force: true }); } catch (e) { /* ignore */ }
  }
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = DELETE');
  db.pragma('secure_delete = ON');
  db.pragma('foreign_keys = OFF');
  return db;
}

function createSchema(db) { db.exec(SCHEMA_SQL); }

function clearAll(db) {
  for (const t of TABLES) db.exec(`DELETE FROM ${t}`);
  const hasSeq = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'").get();
  if (hasSeq) db.exec('DELETE FROM sqlite_sequence');
}

module.exports = { SCHEMA_SQL, TABLES, openDb, createSchema, clearAll, removeDbFiles };
